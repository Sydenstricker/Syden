/**
 * Entregar um arquivo a quem pediu — do disco quando ele já migrou, da memória quando ainda não.
 *
 * ESTE É O ÚNICO LUGAR QUE MANDA BYTES PARA FORA, e isso é o que permitiu trocar o armazenamento sem
 * mexer em cinco rotas. Antes cada rota fazia o seu `send(Buffer.from(file.data))`; agora todas
 * chamam daqui, e o cabeçalho de cache, o `nosniff` e o pedido de pedaço moram num lugar só.
 *
 * ---------------------------------------------------------------------------------------------------
 * O PEDIDO DE PEDAÇO (Range) É A FUNÇÃO NOVA, e é ele que conserta o karaokê.
 *
 * Quando alguém arrasta a barra de uma música para o meio, o navegador não quer a música inteira: ele
 * manda `Range: bytes=4000000-` e quer continuar dali. Sem resposta a isso, o navegador só tem uma
 * saída — baixar tudo de novo desde o começo. Numa música de 12 MB, arrastar a barra três vezes são
 * 36 MB de tráfego e três esperas, e esse é o uso NORMAL do karaokê, não o caso raro.
 *
 * BLOB no SQLite não tem como responder a isso: ele sai inteiro ou não sai. Arquivo no disco tem —
 * `createReadStream` com início e fim lê só o pedaço pedido, e o resto nunca é lido.
 *
 * O `Accept-Ranges: bytes` é obrigatório e não é enfeite: é por ele que o navegador SABE que pode
 * pedir pedaço. Sem esse cabeçalho, ele nem tenta — e a barra do áudio fica sem poder ser arrastada
 * em alguns navegadores, que é um sintoma difícil de ligar à causa.
 * ---------------------------------------------------------------------------------------------------
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { abrirArquivo, arquivoExiste, tamanhoNoDisco } from './arquivos.js';

/**
 * O que uma consulta de arquivo devolve hoje.
 *
 * `sha` presente quer dizer "está no disco"; `data` presente quer dizer "ainda está no banco". Durante
 * a migração os dois casos convivem, e é isso que permite migrar com o Syden no ar: linha já movida é
 * servida do disco, linha ainda não movida é servida como sempre foi.
 */
export interface ArquivoGuardado {
  mime: string;
  sha?: string | null;
  bytes?: number | null;
  data?: Uint8Array | null;
  /** Só para anexo: o nome que a pessoa deu ao arquivo. */
  name?: string;
}

const UM_ANO = 'public, max-age=31536000, immutable';

/** `bytes=1000-`, `bytes=1000-1999`, `bytes=-500`. Devolve nulo quando não dá para atender. */
function pedacoPedido(cabecalho: string | undefined, total: number): { de: number; ate: number } | null {
  if (!cabecalho) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(cabecalho.trim());
  if (!m) return null;

  // `bytes=-500` são os ÚLTIMOS 500, e não "do começo até 500". É o jeito de pegar o fim de um arquivo
  // sem saber o tamanho dele — alguns tocadores usam isso para ler o rodapé de um MP3.
  const de = m[1] === '' ? Math.max(0, total - Number(m[2])) : Number(m[1]);
  const ate = m[1] === '' ? total - 1 : m[2] === '' ? total - 1 : Math.min(Number(m[2]), total - 1);

  if (!Number.isFinite(de) || !Number.isFinite(ate) || de > ate || de < 0) return null;
  return { de, ate };
}

/**
 * Manda o arquivo. Responde 404 quando ele não existe, 206 quando foi pedido um pedaço, 200 no resto.
 *
 * A URL de cada arquivo muda quando o arquivo muda (id novo, ou ?v= na versão), então o navegador pode
 * guardar para sempre — daí o `immutable`. O `nosniff` impede que o navegador decida sozinho que
 * aquele arquivo é outra coisa, que é como uma imagem vira script.
 */
export function entregarArquivo(
  request: FastifyRequest,
  reply: FastifyReply,
  arquivo: ArquivoGuardado | undefined,
  extras?: Record<string, string>,
) {
  if (!arquivo) return reply.code(404).send({ error: 'Arquivo não encontrado.' });

  reply.header('content-type', arquivo.mime).header('cache-control', UM_ANO).header('x-content-type-options', 'nosniff');
  if (extras) for (const [nome, valor] of Object.entries(extras)) reply.header(nome, valor);

  // AINDA NO BANCO: o jeito antigo, enquanto a migração não passou por esta linha. Sem Range, porque
  // não há como entregar um pedaço de um BLOB que já veio inteiro para a memória.
  if (!arquivo.sha) {
    if (!arquivo.data) return reply.code(404).send({ error: 'Arquivo não encontrado.' });
    return reply.send(Buffer.from(arquivo.data));
  }

  // JÁ NO DISCO. A linha diz onde; o disco é quem confirma. Se o arquivo sumiu — disco trocado,
  // backup restaurado pela metade —, isso é um 404 honesto e não um erro de leitura no meio do envio.
  if (!arquivoExiste(arquivo.sha)) {
    request.log.warn({ sha: arquivo.sha }, 'arquivo no banco e não no disco');
    return reply.code(404).send({ error: 'Arquivo não encontrado.' });
  }

  const total = arquivo.bytes || tamanhoNoDisco(arquivo.sha);
  reply.header('accept-ranges', 'bytes');

  const pedaco = pedacoPedido(request.headers.range, total);
  if (pedaco) {
    return reply
      .code(206)
      .header('content-range', `bytes ${pedaco.de}-${pedaco.ate}/${total}`)
      .header('content-length', String(pedaco.ate - pedaco.de + 1))
      .send(abrirArquivo(arquivo.sha, pedaco.de, pedaco.ate));
  }

  return reply.header('content-length', String(total)).send(abrirArquivo(arquivo.sha));
}
