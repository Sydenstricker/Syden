import { Readable } from 'node:stream';
import type { ReadableStream as StreamDaWeb } from 'node:stream/web';
import type { FastifyInstance } from 'fastify';
import {
  AGENTE_DA_CULTURA,
  arquivoDaCultura,
  culturaDe,
  origemDoAudio,
  secaoDe,
  SECOES,
  TAMANHO_MAXIMO_DE_AUDIO,
  type SecaoDaCultura,
} from './cultura.js';
import { requireUser } from './routes.js';

// A faixa de cultura da home (ver cultura.ts). O país e a língua vêm da tela, que os tira da
// preferência de idioma do sistema da pessoa — nunca do endereço de rede.

/**
 * Os tipos de áudio que passam. O content-type é palavra de terceiro, e áudio não dá para conferir pelos
 * primeiros bytes sem segurar a música inteira: por isso só uma lista curta, e com `nosniff` na
 * resposta — o navegador não trata como página o que foi declarado como som.
 */
const TIPOS_DE_AUDIO: Record<string, string> = {
  'audio/ogg': 'audio/ogg',
  'application/ogg': 'audio/ogg',
  'audio/mpeg': 'audio/mpeg',
  'audio/wav': 'audio/wav',
  'audio/x-wav': 'audio/wav',
  'audio/flac': 'audio/flac',
  'audio/webm': 'audio/webm',
};

export function registerCulturaRoutes(app: FastifyInstance) {
  // SEM LOGIN, como os avatares: uma <img> não manda o cabeçalho de quem está logado. E não há nada
  // a proteger — só sai daqui arquivo público, e só os que a lista do dia já selecionou.
  app.get<{ Params: { id: string } }>('/api/cultura/arquivo/:id', async (request, reply) => {
    const arquivo = await arquivoDaCultura(request.params.id);
    if (!arquivo) return reply.code(404).send({ error: 'Arquivo não encontrado.' });
    return reply
      .header('content-type', arquivo.tipo)
      .header('x-content-type-options', 'nosniff')
      .header('cache-control', 'public, max-age=86400')
      .send(arquivo.bytes);
  });

  /**
   * A música da seção de música, tocada daqui pelo mesmo motivo das imagens: o navegador de ninguém
   * fala com o Commons. Sem login, pelo motivo das imagens também (o <audio> não manda o cabeçalho).
   *
   * VAI AOS POUCOS, sem guardar: uma faixa passa de 10 MB, e guardar seis por país na memória não cabe.
   * O pedido de trecho (Range) é repassado, e é isso que deixa avançar e voltar a música.
   */
  app.get<{ Params: { id: string } }>('/api/cultura/audio/:id', async (request, reply) => {
    const origem = origemDoAudio(request.params.id);
    if (!origem) return reply.code(404).send({ error: 'Áudio não encontrado.' });
    const cabecalhos: Record<string, string> = { 'user-agent': AGENTE_DA_CULTURA };
    const trecho = request.headers.range;
    if (typeof trecho === 'string' && /^bytes=\d*-\d*$/.test(trecho)) cabecalhos.range = trecho;

    // O prazo vale para a RESPOSTA começar, e não para a música inteira chegar: um AbortSignal.timeout
    // cortaria a faixa no meio para quem ouve devagar.
    const controle = new AbortController();
    const prazo = setTimeout(() => controle.abort(), 15_000);
    let resposta: Response;
    try {
      resposta = await fetch(origem, { headers: cabecalhos, signal: controle.signal });
    } catch {
      return reply.code(502).send({ error: 'O áudio não veio.' });
    } finally {
      clearTimeout(prazo);
    }
    const tipo = TIPOS_DE_AUDIO[(resposta.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()];
    const total = Number(resposta.headers.get('content-length') ?? 0);
    if (!resposta.ok || !resposta.body || !tipo || total > TAMANHO_MAXIMO_DE_AUDIO) {
      void resposta.body?.cancel();
      return reply.code(502).send({ error: 'O áudio não veio.' });
    }
    // Quem fecha a página no meio da música não deixa o servidor baixando o resto.
    request.raw.on('close', () => controle.abort());

    reply
      .code(resposta.status === 206 ? 206 : 200)
      .header('content-type', tipo)
      .header('accept-ranges', 'bytes')
      .header('x-content-type-options', 'nosniff')
      .header('cache-control', 'public, max-age=86400');
    if (total) reply.header('content-length', String(total));
    const faixa = resposta.headers.get('content-range');
    if (faixa) reply.header('content-range', faixa);
    return reply.send(Readable.fromWeb(resposta.body as StreamDaWeb<Uint8Array>));
  });

  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    const lugarValido = (pais: string, lingua: string) => /^[A-Z]{2}$/.test(pais) && /^[a-z]{2,3}$/.test(lingua);

    authed.get<{ Querystring: { pais?: string; lingua?: string } }>('/api/cultura', async (request, reply) => {
      const pais = String(request.query.pais ?? '').toUpperCase();
      const lingua = String(request.query.lingua ?? '').toLowerCase();
      if (!lugarValido(pais, lingua)) {
        return reply.code(400).send({ error: 'País ou língua inválidos.' });
      }
      return culturaDe(pais, lingua);
    });

    // Comida, dança, música e teatro: cada uma no seu pedido (ver SecaoDaCultura em cultura.ts).
    authed.get<{ Params: { secao: string }; Querystring: { pais?: string; lingua?: string } }>(
      '/api/cultura/secao/:secao',
      async (request, reply) => {
        const secao = request.params.secao as SecaoDaCultura;
        const pais = String(request.query.pais ?? '').toUpperCase();
        const lingua = String(request.query.lingua ?? '').toLowerCase();
        if (!SECOES.includes(secao)) return reply.code(404).send({ error: 'Seção desconhecida.' });
        if (!lugarValido(pais, lingua)) return reply.code(400).send({ error: 'País ou língua inválidos.' });
        return secaoDe(secao, pais, lingua);
      },
    );
  });
}
