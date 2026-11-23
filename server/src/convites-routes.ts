import type { FastifyInstance } from 'fastify';
import * as db from './db.js';
import { manages, requireUser } from './routes.js';

const NAO_ENCONTRADA = 'Comunidade não encontrada.';

/** As validades que a tela oferece, em milissegundos; null é "nunca". As mesmas de ConfigurarConvite.tsx. */
export const VALIDADES: Record<string, number | null> = {
  '30m': 30 * 60_000,
  '1h': 3_600_000,
  '6h': 6 * 3_600_000,
  '12h': 12 * 3_600_000,
  '1d': 24 * 3_600_000,
  '7d': 7 * 24 * 3_600_000,
  nunca: null,
};

/** Os limites de usos; null é "sem limite". */
export const LIMITES_DE_USO: (number | null)[] = [null, 1, 5, 10, 25, 50, 100];

/** Quantos convites que ainda valem uma pessoa pode ter numa comunidade: o bastante para qualquer uso, e não uma fábrica. */
export const CONVITES_POR_PESSOA = 25;

/**
 * CONVITES COM PRAZO E LIMITE DE USOS (23/11/2026, pelo mapa das permissões do Discord). O código de sempre da
 * comunidade continua igual (o "Chamar alguém" e o botão da capa o usam, e só quem administra o troca). Estes são os A
 * MAIS: qualquer membro cria um com validade (30 min a 7 dias, ou nunca) e número de usos (1 a 100, ou sem limite), para
 * chamar alguém sem espalhar o link que não expira.
 *
 * A entrada por eles é a mesma do código de sempre (/api/communities/join): banido continua barrado, a comunidade cheia
 * continua cheia, e o uso só conta para quem entrou de verdade. Quem administra vê todos os que ainda valem, com quem
 * criou, e revoga qualquer um; quem criou vê e revoga os seus. Vencidos e gastos saem sozinhos (limparConvitesVencidos).
 */
export function registerConvitesRoutes(app: FastifyInstance) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    authed.post<{ Params: { id: string }; Body: { validade?: string; usos?: number | null } }>(
      '/api/communities/:id/convites',
      async (request, reply) => {
        const communityId = Number(request.params.id);
        const papel = db.memberRole(communityId, request.user.id);
        if (!papel) return reply.code(404).send({ error: NAO_ENCONTRADA });
        const validade = request.body?.validade ?? '7d';
        const usos = request.body?.usos ?? null;
        if (!(validade in VALIDADES) || !LIMITES_DE_USO.includes(usos)) {
          return reply.code(400).send({ error: 'Escolha uma validade e um limite de usos da lista.' });
        }
        const meus = db.convitesDaComunidade(communityId).filter((c) => c.criadoPor === request.user.id).length;
        if (meus >= CONVITES_POR_PESSOA) {
          return reply.code(429).send({ error: 'Você já tem convites demais nesta comunidade. Revogue algum antes de criar outro.' });
        }
        const convite = db.criarConvite(communityId, request.user.id, VALIDADES[validade], usos);
        return { code: convite.code, expiraEm: convite.expiraEm, usosMax: convite.usosMax, usos: convite.usos };
      },
    );

    /** Quem administra vê todos; os outros, só os que criaram. Com ?meus, todo mundo só os seus (a janela do convite). */
    authed.get<{ Params: { id: string }; Querystring: { meus?: string } }>('/api/communities/:id/convites', async (request, reply) => {
      const communityId = Number(request.params.id);
      const papel = db.memberRole(communityId, request.user.id);
      if (!papel) return reply.code(404).send({ error: NAO_ENCONTRADA });
      const todos = db.convitesDaComunidade(communityId);
      return manages(papel) && request.query.meus === undefined ? todos : todos.filter((c) => c.criadoPor === request.user.id);
    });

    authed.delete<{ Params: { id: string; code: string } }>('/api/communities/:id/convites/:code', async (request, reply) => {
      const communityId = Number(request.params.id);
      const papel = db.memberRole(communityId, request.user.id);
      if (!papel) return reply.code(404).send({ error: NAO_ENCONTRADA });
      const convite = db.acharConvite(request.params.code ?? '');
      if (!convite || convite.communityId !== communityId) return reply.code(404).send({ error: 'Convite não encontrado.' });
      if (convite.criadoPor !== request.user.id && !manages(papel)) {
        return reply.code(403).send({ error: 'Só quem criou o convite, ou quem administra a comunidade, pode revogá-lo.' });
      }
      db.revogarConvite(convite.code);
      return { ok: true };
    });
  });
}
