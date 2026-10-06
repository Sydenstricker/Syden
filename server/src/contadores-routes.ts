import type { FastifyInstance } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import * as db from './db.js';
import { communityRoom } from './realtime.js';
import { manages, requireUser } from './routes.js';

/**
 * OS CONTADORES (ver o bloco em db.ts).
 *
 * No Discord, o MEE6 faz isto renomeando um canal a cada poucos minutos ("Membros: 42"), porque lá não
 * existe outro lugar para um número. Aqui o servidor guarda só QUAIS contadores aparecem; a conta sai da
 * tela de cada pessoa, que já sabe quem é membro, quem está online e quem está em chamada. Fica ao vivo,
 * na língua de quem lê, e sem servidor reescrevendo nome de canal para ninguém.
 */
export const CONTADORES = ['membros', 'online', 'em-chamada'] as const;

export function registerContadoresRoutes(app: FastifyInstance, io: IOServer) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    authed.put<{ Params: { id: string }; Body: { lista?: unknown } }>('/api/communities/:id/contadores', async (request, reply) => {
      const communityId = Number(request.params.id);
      const papel = db.memberRole(communityId, request.user.id);
      if (!papel) return reply.code(404).send({ error: 'Comunidade não encontrada.' });
      if (!manages(papel)) return reply.code(403).send({ error: 'Só quem administra a comunidade escolhe os contadores.' });
      const lista = request.body?.lista;
      if (!Array.isArray(lista) || lista.some((c) => !CONTADORES.includes(c))) return reply.code(400).send({ error: 'Contador desconhecido.' });
      // Na ordem fixa, sem repetir: a faixa sai igual para todo mundo, qualquer que tenha sido o clique.
      db.definirContadores(communityId, CONTADORES.filter((c) => lista.includes(c)));
      const community = db.findCommunity(communityId)!;
      io.to(communityRoom(communityId)).emit('community:updated', community);
      return community;
    });
  });
}
