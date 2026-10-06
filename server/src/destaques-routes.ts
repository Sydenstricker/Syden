import type { FastifyInstance } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import * as db from './db.js';
import { channelRoom } from './realtime.js';
import { manages, requireUser } from './routes.js';

/**
 * OS DESTAQUES (ver o bloco em db.ts): quem administra escolhe o canal e quantas ⭐ bastam; a reação de
 * sempre faz o resto.
 *
 * O DESTAQUE NÃO TEM FRASE, só sinais: "⭐ 4 · @ana · #geral" e o texto dela. Ele é publicado no meio de
 * uma comunidade que conversa numa língua que o servidor não sabe, e sinais todo mundo lê.
 */
const NAO_ENCONTRADA = 'Comunidade não encontrada.';
const TRECHO_MAXIMO = 1500;

/** Depois de cada reação: se a mensagem passou do mínimo de ⭐ agora, o Syden a destaca. */
export function talvezDestacar(io: IOServer, messageId: number) {
  const mensagem = db.findMessage(messageId);
  const canal = mensagem && db.findChannel(mensagem.channelId);
  if (!mensagem || !canal || canal.communityId === null) return;
  const config = db.configDeDestaques(canal.communityId);
  const destino = config.canalId === null ? undefined : db.findChannel(config.canalId);
  // O próprio canal de destaques não se destaca de novo, e as mensagens do Syden também não.
  if (!destino || destino.id === canal.id || db.ehContaDoSistema(mensagem.userId) || db.jaDestacada(mensagem.id)) return;
  const estrelas = db.estrelasQueContam(mensagem.id, mensagem.userId);
  if (estrelas < config.minimo) return;

  const autor = db.findUserById(mensagem.userId)?.username ?? '?';
  const texto = (db.findMessageContent(mensagem.id) ?? '').trim();
  const trecho = texto.length > TRECHO_MAXIMO ? texto.slice(0, TRECHO_MAXIMO) + '…' : texto;
  const post = db.mensagemDoSyden(destino.id, `${db.EMOJI_DO_DESTAQUE} ${estrelas} · @${autor} · #${canal.name}${trecho ? '\n' + trecho : ''}`);
  db.copiarImagens(mensagem.id, post.id);
  db.registrarDestaque(mensagem.id, post.id);
  // Lido de novo para levar as imagens que acabaram de ser apontadas.
  const completo = db.findMessageFull(post.id, db.contaDoSyden()) ?? post;
  io.to(channelRoom(destino)).emit('message:new', { ...completo, communityId: destino.communityId });
}

export function registerDestaquesRoutes(app: FastifyInstance) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    authed.get<{ Params: { id: string } }>('/api/communities/:id/destaques', async (request, reply) => {
      const communityId = Number(request.params.id);
      const papel = db.memberRole(communityId, request.user.id);
      if (!papel) return reply.code(404).send({ error: NAO_ENCONTRADA });
      if (!manages(papel)) return reply.code(403).send({ error: 'Só quem administra a comunidade vê os destaques.' });
      return db.configDeDestaques(communityId);
    });

    authed.put<{ Params: { id: string }; Body: { canalId?: number | null; minimo?: number } }>('/api/communities/:id/destaques', async (request, reply) => {
      const communityId = Number(request.params.id);
      const papel = db.memberRole(communityId, request.user.id);
      if (!papel) return reply.code(404).send({ error: NAO_ENCONTRADA });
      if (!manages(papel)) return reply.code(403).send({ error: 'Só quem administra a comunidade muda os destaques.' });
      const minimo = Number(request.body?.minimo ?? 3);
      if (!Number.isInteger(minimo) || minimo < 1 || minimo > 50) return reply.code(400).send({ error: 'De 1 a 50 estrelas.' });
      if (request.body?.canalId === null) {
        db.definirDestaques(communityId, null, minimo);
        return db.configDeDestaques(communityId);
      }
      const canal = db.findChannel(Number(request.body?.canalId));
      if (!canal || canal.communityId !== communityId || canal.type !== 'text') return reply.code(400).send({ error: 'Escolha um canal de texto da comunidade.' });
      db.definirDestaques(communityId, canal.id, minimo);
      return db.configDeDestaques(communityId);
    });
  });
}
