import type { FastifyInstance } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import * as db from './db.js';
import { channelRoom } from './realtime.js';
import { canUseChannel, manages, requireUser, roleIn } from './routes.js';

/** Quantas mensagens um canal pode ter fixadas ao mesmo tempo (o mesmo teto do Discord). */
export const MAXIMO_DE_FIXADAS = 50;

/**
 * FIXAR MENSAGENS (23/11/2026, pedido dele, pelo mapa das permissões do Discord): as regras, o IP do servidor do jogo, o
 * horário do treino. Só mensagens do canal (não as respostas de um tópico), em canal de texto ou conversa privada.
 *
 * QUEM FIXA: na comunidade, quem administra (fixar muda o que todo mundo vê ao abrir o alfinete); na conversa privada, quem
 * está nela, porque lá não existe administrador. Apagar a mensagem a tira das fixadas (a chave estrangeira).
 */
export function registerFixadasRoutes(app: FastifyInstance, io: IOServer) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    authed.get<{ Params: { id: string } }>('/api/channels/:id/fixadas', async (request, reply) => {
      const channel = db.findChannel(Number(request.params.id));
      if (!channel || (channel.type !== 'text' && channel.type !== 'dm') || !canUseChannel(request.user, channel)) {
        return reply.code(404).send({ error: 'Canal não encontrado.' });
      }
      return db.mensagensFixadas(channel.id, request.user.id);
    });

    authed.post<{ Params: { id: string }; Body: { fixar?: boolean } }>('/api/messages/:id/fixar', async (request, reply) => {
      const message = db.findMessage(Number(request.params.id));
      const channel = message && db.findChannel(message.channelId);
      if (!message || !channel || (channel.type !== 'text' && channel.type !== 'dm') || !canUseChannel(request.user, channel)) {
        return reply.code(404).send({ error: 'Mensagem não encontrada.' });
      }
      if (message.threadId !== null) return reply.code(400).send({ error: 'Só as mensagens do canal podem ser fixadas, não as de um tópico.' });
      if (channel.communityId !== null && !manages(roleIn(request.user, channel.communityId))) {
        return reply.code(403).send({ error: 'Só quem administra a comunidade fixa mensagens.' });
      }
      const fixar = request.body?.fixar !== false;
      if (fixar) {
        if (db.estaFixada(message.id)) return { ok: true };
        if (db.quantasFixadas(channel.id) >= MAXIMO_DE_FIXADAS) {
          return reply.code(409).send({ error: 'Este canal já tem 50 mensagens fixadas. Desafixe uma antes.' });
        }
        db.fixarMensagem(message.id, channel.id, request.user.id);
      } else {
        db.desafixarMensagem(message.id);
      }
      const fixadaEm = fixar ? new Date().toISOString() : null;
      io.to(channelRoom(channel)).emit('mensagem:fixada', { channelId: channel.id, messageId: message.id, fixadaEm });
      return { ok: true };
    });
  });
}
