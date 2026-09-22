// Conversas privadas: entre duas pessoas ou em grupo. Por baixo são canais sem comunidade (type 'dm'),
// então herdam mensagens, anexos, reações, enquetes e tópicos do resto do chat sem código novo.
import type { FastifyInstance } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import * as db from './db.js';
import { directRoom, emitToUser, joinDirectRoom, leaveDirectRoom } from './realtime.js';
import { requireUser } from './routes.js';

const MAX_GROUP_MEMBERS = 20;

export function registerDirectRoutes(app: FastifyInstance, io: IOServer) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    /** Só dá para conversar com quem divide alguma comunidade com você — nada de mensagem de estranho. */
    function sharesCommunity(a: number, b: number) {
      const mine = new Set(db.communityIdsForUser(a));
      return db.communityIdsForUser(b).some((id) => mine.has(id));
    }

    /** A conversa existe e você está nela? */
    function myConversation(id: number, userId: number) {
      const channel = db.findChannel(id);
      return channel && channel.type === 'dm' && db.isChannelMember(channel.id, userId) ? channel : null;
    }

    /** Avisa as abas de cada participante para a conversa aparecer na lista deles na hora. */
    function announce(channelId: number, event: string) {
      for (const userId of db.channelMemberIds(channelId)) {
        joinDirectRoom(io, userId, channelId);
        const mine = db.listDirectChannels(userId).find((c) => c.id === channelId);
        if (mine) emitToUser(io, userId, event, mine);
      }
    }

    authed.get('/api/direct', async (request) => db.listDirectChannels(request.user.id));

    /** Abre (ou reabre) uma conversa: sem nome e com uma pessoa só = conversa direta; com nome = grupo. */
    authed.post<{ Body: { userIds?: number[]; name?: string } }>('/api/direct', async (request, reply) => {
      const wanted = [...new Set((Array.isArray(request.body?.userIds) ? request.body.userIds : []).map(Number))].filter(
        (id) => Number.isInteger(id) && id !== request.user.id,
      );
      if (wanted.length === 0) return reply.code(400).send({ error: 'Escolha com quem você quer conversar.' });
      if (wanted.length + 1 > MAX_GROUP_MEMBERS) {
        return reply.code(400).send({ error: `Uma conversa em grupo cabe até ${MAX_GROUP_MEMBERS} pessoas.` });
      }
      for (const id of wanted) {
        if (!db.findUserById(id)) return reply.code(404).send({ error: 'Pessoa não encontrada.' });
        if (!sharesCommunity(request.user.id, id)) {
          return reply.code(403).send({ error: 'Você só pode conversar com quem está numa comunidade sua.' });
        }
      }

      const name = String(request.body?.name ?? '').trim().slice(0, 50);
      // Conversa de duas pessoas sem nome: se já existe, devolve a mesma em vez de criar outra.
      if (wanted.length === 1 && !name) {
        const existing = db.findDirectBetween(request.user.id, wanted[0]);
        if (existing) {
          announce(existing.id, 'direct:updated');
          return db.listDirectChannels(request.user.id).find((c) => c.id === existing.id);
        }
      }

      const channel = db.createDirectChannel(name, request.user.id, wanted);
      announce(channel.id, 'direct:created');
      return db.listDirectChannels(request.user.id).find((c) => c.id === channel.id);
    });

    /** Trocar o nome de um grupo (conversa de duas pessoas não tem nome). */
    authed.patch<{ Params: { id: string }; Body: { name?: string } }>('/api/direct/:id', async (request, reply) => {
      const channel = myConversation(Number(request.params.id), request.user.id);
      if (!channel) return reply.code(404).send({ error: 'Conversa não encontrada.' });
      if (db.channelMemberIds(channel.id).length <= 2) {
        return reply.code(400).send({ error: 'Conversa de duas pessoas não tem nome.' });
      }
      const name = String(request.body?.name ?? '').trim().slice(0, 50);
      if (!name) return reply.code(400).send({ error: 'Dê um nome ao grupo.' });
      db.renameChannel(channel.id, name);
      announce(channel.id, 'direct:updated');
      return { ok: true };
    });

    /** Chamar mais alguém para a conversa; a de duas pessoas vira grupo ao receber o terceiro. */
    authed.post<{ Params: { id: string }; Body: { userId?: number } }>('/api/direct/:id/members', async (request, reply) => {
      const channel = myConversation(Number(request.params.id), request.user.id);
      if (!channel) return reply.code(404).send({ error: 'Conversa não encontrada.' });
      const userId = Number(request.body?.userId);
      if (!db.findUserById(userId)) return reply.code(404).send({ error: 'Pessoa não encontrada.' });
      if (!sharesCommunity(request.user.id, userId)) {
        return reply.code(403).send({ error: 'Você só pode chamar quem está numa comunidade sua.' });
      }
      const members = db.channelMemberIds(channel.id);
      if (members.includes(userId)) return reply.code(409).send({ error: 'Essa pessoa já está na conversa.' });
      if (members.length + 1 > MAX_GROUP_MEMBERS) {
        return reply.code(400).send({ error: `Uma conversa em grupo cabe até ${MAX_GROUP_MEMBERS} pessoas.` });
      }

      // Uma conversa de duas pessoas não tem nome; virando grupo, ganha um para não ficar "sem título".
      if (members.length === 2 && !channel.name) db.renameChannel(channel.id, 'Grupo');
      db.addChannelMember(channel.id, userId);
      announce(channel.id, 'direct:created'); // para quem chegou, é conversa nova; para os outros, atualização
      return { ok: true };
    });

    authed.post<{ Params: { id: string } }>('/api/direct/:id/leave', async (request, reply) => {
      const channel = myConversation(Number(request.params.id), request.user.id);
      if (!channel) return reply.code(404).send({ error: 'Conversa não encontrada.' });
      db.removeChannelMember(channel.id, request.user.id);
      leaveDirectRoom(io, request.user.id, channel.id);
      emitToUser(io, request.user.id, 'direct:removed', { id: channel.id });
      // Conversa sem ninguém some junto com as mensagens; com gente, os outros só veem a lista mudar.
      if (db.channelMemberIds(channel.id).length === 0) db.deleteChannel(channel.id);
      else {
        announce(channel.id, 'direct:updated');
        io.to(directRoom(channel.id)).emit('direct:updated', { id: channel.id });
      }
      return { ok: true };
    });
  });
}
