import type { FastifyInstance } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import * as db from './db.js';
import { emitToUser, joinDirectRoom } from './realtime.js';
import { manages, requireUser } from './routes.js';

/**
 * OS TICKETS (pacote MEE6, 12/10/2026). Alguém precisa falar com quem administra — uma denúncia que não cabe no
 * botão de denunciar, um pedido de cargo, uma dúvida que não é para o canal geral — e abre um ticket com um
 * assunto. Ele vira uma CONVERSA PRIVADA EM GRUPO entre quem abriu e quem administra a comunidade, com o nome
 * "Ticket: assunto". Encerrar renomeia a conversa e guarda quem encerrou; a conversa continua lá como histórico.
 *
 * NÃO É UM CANAL NOVO: o Syden não tem canal privado em comunidade, e um tipo novo de canal secreto seria uma
 * superfície a mais para errar quem vê o quê. A conversa em grupo já resolve "só estas pessoas leem".
 *
 * Desligado por padrão, como os níveis: cada comunidade liga nas configurações.
 */
export const MAXIMO_DE_TICKETS_ABERTOS = 3;
const MAXIMO_NA_CONVERSA = 20;
const NAO_ENCONTRADA = 'Comunidade não encontrada.';

export function registerTicketsRoutes(app: FastifyInstance, io: IOServer) {
  /** Avisa cada pessoa da conversa (a lista de conversas dela ganha ou muda uma). */
  function anunciar(channelId: number, evento: 'direct:created' | 'direct:updated') {
    for (const userId of db.channelMemberIds(channelId)) {
      joinDirectRoom(io, userId, channelId);
      const conversa = db.listDirectChannels(userId).find((c) => c.id === channelId);
      if (conversa) emitToUser(io, userId, evento, conversa);
    }
  }

  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    /** Quem administra vê todos; os outros, só os próprios. `ligados` diz se a comunidade usa tickets. */
    authed.get<{ Params: { id: string } }>('/api/communities/:id/tickets', async (request, reply) => {
      const communityId = Number(request.params.id);
      const papel = db.memberRole(communityId, request.user.id);
      if (!papel) return reply.code(404).send({ error: NAO_ENCONTRADA });
      return {
        ligados: db.ticketsLigados(communityId),
        tickets: db.listarTickets(communityId, manages(papel) ? undefined : request.user.id),
      };
    });

    authed.put<{ Params: { id: string }; Body: { ligados?: boolean } }>('/api/communities/:id/tickets/ligados', async (request, reply) => {
      const communityId = Number(request.params.id);
      const papel = db.memberRole(communityId, request.user.id);
      if (!papel) return reply.code(404).send({ error: NAO_ENCONTRADA });
      if (!manages(papel)) return reply.code(403).send({ error: 'Só quem administra a comunidade liga os tickets.' });
      db.ligarTickets(communityId, request.body?.ligados === true);
      return { ligados: db.ticketsLigados(communityId) };
    });

    authed.post<{ Params: { id: string }; Body: { assunto?: string } }>('/api/communities/:id/tickets', async (request, reply) => {
      const communityId = Number(request.params.id);
      const papel = db.memberRole(communityId, request.user.id);
      if (!papel) return reply.code(404).send({ error: NAO_ENCONTRADA });
      if (!db.ticketsLigados(communityId)) return reply.code(403).send({ error: 'Esta comunidade não usa tickets.' });
      const assunto = String(request.body?.assunto ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
      if (!assunto) return reply.code(400).send({ error: 'Diga em poucas palavras qual é o assunto.' });
      if (db.ticketsAbertosDe(communityId, request.user.id) >= MAXIMO_DE_TICKETS_ABERTOS) {
        return reply.code(409).send({ error: `Você já tem ${MAXIMO_DE_TICKETS_ABERTOS} tickets abertos aqui. Espere um deles ser encerrado.` });
      }
      // Quem atende: quem administra, menos quem abriu e menos a conta do Syden (ela não conversa).
      const atendem = db
        .listCommunityMembers(communityId)
        .filter((m) => manages(m.role) && m.id !== request.user.id && !db.ehContaDoSistema(m.id))
        .map((m) => m.id)
        .slice(0, MAXIMO_NA_CONVERSA - 1);
      if (atendem.length === 0) return reply.code(409).send({ error: 'Ainda não há quem atenda os tickets nesta comunidade.' });

      const conversa = db.createDirectChannel(`Ticket: ${assunto}`, request.user.id, atendem);
      const ticket = db.abrirTicket(communityId, conversa.id, request.user.id, assunto);
      anunciar(conversa.id, 'direct:created');
      return { ticket, conversa: db.listDirectChannels(request.user.id).find((c) => c.id === conversa.id) };
    });

    authed.post<{ Params: { id: string; ticketId: string } }>('/api/communities/:id/tickets/:ticketId/encerrar', async (request, reply) => {
      const communityId = Number(request.params.id);
      const papel = db.memberRole(communityId, request.user.id);
      if (!papel) return reply.code(404).send({ error: NAO_ENCONTRADA });
      const ticket = db.acharTicket(communityId, Number(request.params.ticketId));
      if (!ticket) return reply.code(404).send({ error: 'Ticket não encontrado.' });
      if (!manages(papel) && ticket.abertoPor !== request.user.id) {
        return reply.code(403).send({ error: 'Só quem abriu o ticket ou quem administra pode encerrá-lo.' });
      }
      if (ticket.fechadoEm) return { ticket };
      db.encerrarTicket(communityId, ticket.id, request.user.id);
      db.renameChannel(ticket.channelId, `Encerrado: ${ticket.assunto}`);
      anunciar(ticket.channelId, 'direct:updated');
      return { ticket: db.acharTicket(communityId, ticket.id) };
    });
  });
}
