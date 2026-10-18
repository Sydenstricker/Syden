import { readFileSync } from 'node:fs';
import type { FastifyBaseLogger } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import { arquivoExiste, caminhoDe } from './arquivos.js';
import * as db from './db.js';
import { sniffMime } from './media.js';
import { channelRoom, communityRoom, emitToUser } from './realtime.js';
import { anotarBloqueio, conferir, type Resultado, shieldConfigurado } from './shield.js';

/**
 * A RECONFERÊNCIA DA FILA DO SHIELD (auditoria de 17/10/2026).
 *
 * A política de falha, decidida em 28/09/2026, é aceitar e reconferir depois: com o Shield fora do ar, a imagem entra e
 * o sha dela vai para `shield_fila` (ver media.ts e chat-routes.ts). Só que ninguém lia a fila: a promessa "reconferida
 * quando o serviço voltar" não se cumpria, e tudo o que entrou durante uma queda nunca passou pela conferência. Isto é
 * o leitor que faltava.
 *
 * A cada rodada, os primeiros da fila (os que menos falharam primeiro) são conferidos:
 *   - limpo: sai da fila;
 *   - Shield ainda fora: conta mais uma tentativa e a rodada para (os outros dariam o mesmo resultado);
 *   - bloqueado: a imagem JÁ ESTAVA NO AR, então o caso é o de docs/autoridades.md, e o Syden faz sozinho a parte que
 *     não pode esperar alguém: tira do ar em todo lugar (todas as cópias, pelo sha), guarda o arquivo como prova (sem
 *     rota nenhuma, ver "A PROVA DO SHIELD" em db.ts) e abre uma denúncia GRAVE no painel, sem a imagem. Banir e
 *     comunicar às autoridades continuam sendo de uma pessoa.
 */
const INTERVALO_MS = 10 * 60_000;
const PRIMEIRA_RODADA_MS = 60_000;
const POR_RODADA = 20;

/** Os bytes e o tipo da imagem: da linha (as antigas guardavam no banco) ou do disco. Sem nenhum dos dois, ela já saiu. */
function lerImagem(sha: string): { mime: string; dados: Buffer } | null {
  const linha = db.imagemPeloSha(sha);
  const dados = linha && linha.data.length ? linha.data : arquivoExiste(sha) ? readFileSync(caminhoDe(sha)) : null;
  if (!dados) return null;
  // Sem linha (quem subiu já apagou), o arquivo ainda pode estar no disco até a vassoura passar: confere-se do mesmo
  // jeito, porque um positivo continua sendo prova, mesmo sem nada no ar.
  const mime = linha?.mime ?? sniffMime(dados);
  return mime?.startsWith('image/') ? { mime, dados } : null;
}

const QUEM_SUBIU: Record<string, boolean> = { avatar: true, anexo: true };
const DA_COMUNIDADE: Record<string, boolean> = { 'icone-comunidade': true, 'capa-comunidade': true, emoji: true };

/** A denúncia grave de UMA conta que subiu o arquivo, e a prova ligada a ela. */
function denunciar(log: FastifyBaseLogger, item: db.NaFila, resultado: Resultado, autorId: number | null) {
  const autor = autorId === null ? undefined : db.findUserById(autorId);
  const denuncia = db.criarDenuncia({
    reporter: { id: db.contaDoSyden(), username: 'Syden' },
    kind: 'pessoa',
    targetId: autor?.id ?? null,
    targetName: autor?.username ?? null,
    reason:
      `O Shield reconheceu uma imagem como material de abuso infantil conhecido (${item.onde}), na reconferência de uma ` +
      'imagem que entrou enquanto ele estava fora do ar. Ela já foi tirada do ar em todo lugar onde aparecia e está ' +
      'guardada como prova, sem ser mostrada aqui. Falta o que é de uma pessoa: banir a conta, comunicar às ' +
      'autoridades e registrar o protocolo (docs/autoridades.md).',
    communityId: DA_COMUNIDADE[item.onde] ? item.alvoId : null,
    grave: true,
  });
  db.guardarProvaDoShield({
    sha: item.sha256,
    onde: item.onde,
    alvoId: item.alvoId,
    autorId: autor?.id ?? null,
    classificacao: resultado.classificacao,
    tipo: resultado.tipo,
    denunciaId: denuncia.id,
  });
  log.error({ denuncia: denuncia.id, sha256: item.sha256, onde: item.onde }, 'shield: imagem que já estava no ar deu positivo na reconferência; tirada do ar e denúncia grave aberta');
}

function positivo(io: IOServer, log: FastifyBaseLogger, item: db.NaFila, resultado: Resultado) {
  const saiu = db.retirarPeloShield(item.sha256);
  // UMA DENÚNCIA POR CONTA QUE SUBIU o arquivo: o mesmo material no avatar de duas pessoas são duas contas a rever.
  const autores: (number | null)[] = saiu.autores.length ? saiu.autores : QUEM_SUBIU[item.onde] ? [item.alvoId] : [null];
  for (const autorId of autores) denunciar(log, item, resultado, autorId);
  // Todas as entradas do arquivo saem da fila: o positivo já levou todas as cópias dele.
  db.tirarShaDaFilaDoShield(item.sha256);
  anotarBloqueio(resultado, item.onde, item.alvoId);
  // quem administra vê o número de denúncias abertas subir na hora (o mesmo aviso da denúncia feita por alguém)
  for (const admin of db.listAdmins()) emitToUser(io, admin.id, 'report:new', { abertas: db.contarDenunciasAbertas() });

  // Some da tela de quem está com o Syden aberto, pelos mesmos avisos da exclusão comum.
  for (const id of saiu.avatares) {
    const user = db.findUserById(id);
    if (user) io.emit('user:updated', user);
  }
  for (const id of [...saiu.icones, ...saiu.capas]) {
    const comunidade = db.findCommunity(id);
    if (comunidade) io.to(communityRoom(id)).emit('community:updated', comunidade);
  }
  for (const e of saiu.emojis) io.to(communityRoom(e.communityId)).emit('emoji:deleted', { id: e.id, communityId: e.communityId });
  for (const a of saiu.anexos) {
    const canal = db.findChannel(a.channelId);
    if (!canal) continue;
    if (a.mensagemApagada) io.to(channelRoom(canal)).emit('message:deleted', { id: a.messageId, channelId: a.channelId, threadId: null });
    else io.to(channelRoom(canal)).emit('attachment:removed', { id: a.id, messageId: a.messageId, channelId: a.channelId });
  }
}

/** Uma rodada. Devolve quantas saíram da fila e quantas deram positivo (para o teste e o registro). */
export async function reconferirFila(io: IOServer, log: FastifyBaseLogger): Promise<{ conferidas: number; positivas: number }> {
  let conferidas = 0;
  let positivas = 0;
  if (!shieldConfigurado()) return { conferidas, positivas };
  const resolvidos = new Set<string>();
  for (const item of db.lerFilaDoShield(POR_RODADA)) {
    if (resolvidos.has(item.sha256)) continue; // outra entrada do mesmo arquivo, que o positivo já levou
    const imagem = lerImagem(item.sha256);
    if (!imagem) {
      // Não há mais o arquivo em lugar nenhum: nada a conferir nem a tirar do ar.
      db.tirarDaFilaDoShield(item.sha256, item.onde, item.alvoId);
      continue;
    }
    const resultado = await conferir(imagem.dados, imagem.mime);
    if (resultado.veredito === 'indisponivel' || resultado.veredito === 'desligado') {
      db.maisUmaTentativaNoShield(item.sha256, item.onde, item.alvoId);
      break;
    }
    conferidas++;
    if (resultado.veredito === 'bloqueado') {
      positivas++;
      positivo(io, log, item, resultado);
      resolvidos.add(item.sha256);
    } else db.tirarDaFilaDoShield(item.sha256, item.onde, item.alvoId);
  }
  if (conferidas) log.info({ conferidas, positivas, naFila: db.tamanhoDaFilaDoShield() }, 'shield: fila reconferida');
  return { conferidas, positivas };
}

/** Na subida (um minuto depois, para não disputar com ela) e a cada 10 minutos. Uma rodada nunca encavala na outra. */
export function iniciarReconferencia(io: IOServer, log: FastifyBaseLogger) {
  let rodando = false;
  const rodada = async () => {
    if (rodando) return;
    rodando = true;
    try {
      await reconferirFila(io, log);
    } catch (erro) {
      log.error({ err: erro }, 'shield: a reconferência falhou');
    } finally {
      rodando = false;
    }
  };
  setTimeout(() => void rodada(), PRIMEIRA_RODADA_MS).unref();
  setInterval(() => void rodada(), INTERVALO_MS).unref();
}
