import type { FastifyInstance } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import * as db from './db.js';
import { communityRoom, emitToUser, leaveCommunityRoom, salaDeVozDe } from './realtime.js';
import { manages, requireUser, tirarDaChamada } from './routes.js';

const NAO_ENCONTRADA = 'Comunidade não encontrada.';

/**
 * BANIR DA COMUNIDADE (23/11/2026, pedido dele, pelo mapa das permissões do Discord). Antes, expulsar só valia até a
 * pessoa voltar pelo MESMO convite, e o único jeito de impedir era trocar o código, o que matava o link de todo mundo.
 *
 * Banir tira a pessoa como a remoção (sai dos canais e de qualquer chamada da comunidade na hora) e a põe numa lista que
 * TODA porta de entrada confere: o convite, o link de aula com conta. Desbanir só libera a volta; ela precisa de convite.
 *
 * QUEM PODE BANIR QUEM é a regra da remoção e das advertências: ninguém sobre o dono, nem sobre si; administrador sobre
 * membro; sobre outro administrador, só o dono. A pessoa banida não é avisada pelo Syden (como no Discord): ela só vê a
 * comunidade sumir, como na remoção. Fica na auditoria, com nome e hora.
 */
export function registerBanidosRoutes(app: FastifyInstance, io: IOServer) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    authed.post<{ Params: { id: string; userId: string } }>('/api/communities/:id/members/:userId/banir', async (request, reply) => {
      const communityId = Number(request.params.id);
      const community = db.findCommunity(communityId);
      const papel = community && db.memberRole(communityId, request.user.id);
      if (!community || !papel) return reply.code(404).send({ error: NAO_ENCONTRADA });
      if (!manages(papel)) return reply.code(403).send({ error: 'Só quem administra a comunidade pode banir alguém.' });
      const alvoId = Number(request.params.userId);
      if (alvoId === request.user.id) return reply.code(400).send({ error: 'Não dá para fazer isso consigo.' });
      const papelDoAlvo = db.memberRole(communityId, alvoId);
      if (!papelDoAlvo) return reply.code(404).send({ error: 'Essa pessoa não participa da comunidade.' });
      if (papelDoAlvo === 'owner') return reply.code(403).send({ error: 'Quem criou a comunidade não pode ser removido.' });
      if (papelDoAlvo === 'admin' && papel !== 'owner') {
        return reply.code(403).send({ error: 'Só quem criou a comunidade pode remover um administrador.' });
      }
      db.registrarAuditoria({
        actor: request.user,
        action: 'membro.banido',
        target: db.findUserById(alvoId)?.username ?? String(alvoId),
        targetId: alvoId,
        communityId,
        detail: community.name,
      });
      db.banirDaComunidade(communityId, alvoId, request.user.id);
      db.removeMember(communityId, alvoId);
      leaveCommunityRoom(io, alvoId, communityId);
      const naVoz = salaDeVozDe(alvoId);
      if (naVoz?.communityId === communityId) await tirarDaChamada(naVoz.channelId, alvoId);
      io.to(communityRoom(communityId)).emit('member:removed', { communityId, userId: alvoId });
      // A própria pessoa já saiu da sala da comunidade (leaveCommunityRoom): o aviso vai direto a ela, para a comunidade sumir da tela.
      emitToUser(io, alvoId, 'member:removed', { communityId, userId: alvoId });
      return { ok: true };
    });

    authed.get<{ Params: { id: string } }>('/api/communities/:id/banidos', async (request, reply) => {
      const communityId = Number(request.params.id);
      const papel = db.memberRole(communityId, request.user.id);
      if (!papel) return reply.code(404).send({ error: NAO_ENCONTRADA });
      if (!manages(papel)) return reply.code(403).send({ error: 'Só quem administra a comunidade vê quem foi banido.' });
      return db.banidosDaComunidade(communityId);
    });

    authed.delete<{ Params: { id: string; userId: string } }>('/api/communities/:id/banidos/:userId', async (request, reply) => {
      const communityId = Number(request.params.id);
      const papel = db.memberRole(communityId, request.user.id);
      if (!papel) return reply.code(404).send({ error: NAO_ENCONTRADA });
      if (!manages(papel)) return reply.code(403).send({ error: 'Só quem administra a comunidade pode desbanir alguém.' });
      const alvoId = Number(request.params.userId);
      if (!db.desbanirDaComunidade(communityId, alvoId)) return reply.code(404).send({ error: 'Essa pessoa não está banida.' });
      db.registrarAuditoria({
        actor: request.user,
        action: 'membro.desbanido',
        target: db.findUserById(alvoId)?.username ?? String(alvoId),
        targetId: alvoId,
        communityId,
        detail: db.findCommunity(communityId)?.name ?? '',
      });
      return { ok: true };
    });
  });
}
