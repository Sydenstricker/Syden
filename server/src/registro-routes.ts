import type { FastifyInstance } from 'fastify';
import * as db from './db.js';
import { manages, requireUser } from './routes.js';

/**
 * O REGISTRO DE MODERAÇÃO DA COMUNIDADE (23/11/2026, pelo mapa das permissões do Discord): quem fez o quê, sobre quem e
 * quando — remover, banir, advertir, silenciar, dar cargo, apagar a mensagem de outra pessoa, fixar, mexer nos canais, no
 * modo lento, nas regras e no convite. Só para quem administra (ver registroDaComunidade em db.ts). Para quem não é
 * membro, a comunidade não existe (404), como nas outras rotas.
 */
export function registerRegistroRoutes(app: FastifyInstance) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    authed.get<{ Params: { id: string }; Querystring: { antes?: string } }>('/api/communities/:id/registro', async (request, reply) => {
      const communityId = Number(request.params.id);
      const papel = db.memberRole(communityId, request.user.id);
      if (!papel) return reply.code(404).send({ error: 'Comunidade não encontrada.' });
      if (!manages(papel)) return reply.code(403).send({ error: 'Só quem administra a comunidade vê o registro de moderação.' });
      const antes = Number(request.query.antes);
      return db.registroDaComunidade(communityId, Number.isInteger(antes) && antes > 0 ? antes : undefined);
    });
  });
}
