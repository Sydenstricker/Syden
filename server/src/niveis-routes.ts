import type { FastifyInstance } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import * as db from './db.js';
import { nivelDe } from './niveis.js';
import { communityRoom } from './realtime.js';
import { manages, requireUser } from './routes.js';

/** O ranking mostra os cem primeiros: é uma vitrine, não um relatório. */
const TAMANHO_DO_RANKING = 100;
const NIVEL_MAXIMO_DE_RECOMPENSA = 200;
const NAO_ENCONTRADA = 'Comunidade não encontrada.';

/**
 * OS NÍVEIS (ver niveis.ts): o ranking, que todo membro vê com os níveis ligados, e a configuração —
 * ligar, desligar e as recompensas ("no nível 5, ganha o cargo Veterano") —, que é de quem administra.
 */
export function registerNiveisRoutes(app: FastifyInstance, io: IOServer) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    authed.get<{ Params: { id: string } }>('/api/communities/:id/niveis', async (request, reply) => {
      const communityId = Number(request.params.id);
      if (!db.memberRole(communityId, request.user.id)) return reply.code(404).send({ error: NAO_ENCONTRADA });
      const ligado = db.niveisLigados(communityId);
      const meus = db.pontosDe(communityId, request.user.id);
      return {
        ligado,
        recompensas: db.recompensasDeNivel(communityId),
        ranking: ligado
          ? db.rankingDePontos(communityId, TAMANHO_DO_RANKING).map((linha) => ({ ...linha, ...nivelDe(linha.pontos) }))
          : [],
        eu: { pontos: meus, ...nivelDe(meus), posicao: ligado ? db.posicaoNoRanking(communityId, request.user.id) : null },
      };
    });

    authed.patch<{ Params: { id: string }; Body: { ligado?: boolean } }>('/api/communities/:id/niveis', async (request, reply) => {
      const communityId = Number(request.params.id);
      const papel = db.memberRole(communityId, request.user.id);
      if (!papel) return reply.code(404).send({ error: NAO_ENCONTRADA });
      if (!manages(papel)) return reply.code(403).send({ error: 'Só quem administra a comunidade liga e desliga os níveis.' });
      if (typeof request.body?.ligado !== 'boolean') return reply.code(400).send({ error: 'Diga se os níveis ficam ligados ou não.' });
      db.ligarNiveis(communityId, request.body.ligado);
      const community = db.findCommunity(communityId)!;
      io.to(communityRoom(communityId)).emit('community:updated', community);
      return community;
    });

    authed.put<{ Params: { id: string }; Body: { nivel?: number; cargoId?: number } }>(
      '/api/communities/:id/niveis/recompensas',
      async (request, reply) => {
        const communityId = Number(request.params.id);
        const papel = db.memberRole(communityId, request.user.id);
        if (!papel) return reply.code(404).send({ error: NAO_ENCONTRADA });
        if (!manages(papel)) return reply.code(403).send({ error: 'Só quem administra a comunidade define recompensas.' });
        const nivel = Number(request.body?.nivel);
        if (!Number.isInteger(nivel) || nivel < 1 || nivel > NIVEL_MAXIMO_DE_RECOMPENSA) {
          return reply.code(400).send({ error: `O nível vai de 1 a ${NIVEL_MAXIMO_DE_RECOMPENSA}.` });
        }
        const cargoId = Number(request.body?.cargoId);
        if (!db.acharCargo(communityId, cargoId)) return reply.code(404).send({ error: 'Cargo não encontrado.' });
        db.definirRecompensa(communityId, nivel, cargoId);
        return db.recompensasDeNivel(communityId);
      },
    );

    authed.delete<{ Params: { id: string; nivel: string; cargoId: string } }>(
      '/api/communities/:id/niveis/recompensas/:nivel/:cargoId',
      async (request, reply) => {
        const communityId = Number(request.params.id);
        const papel = db.memberRole(communityId, request.user.id);
        if (!papel) return reply.code(404).send({ error: NAO_ENCONTRADA });
        if (!manages(papel)) return reply.code(403).send({ error: 'Só quem administra a comunidade define recompensas.' });
        // Tirar a recompensa não tira o cargo de quem já ganhou: o que foi dado fica dado.
        if (!db.tirarRecompensa(communityId, Number(request.params.nivel), Number(request.params.cargoId))) {
          return reply.code(404).send({ error: 'Recompensa não encontrada.' });
        }
        return db.recompensasDeNivel(communityId);
      },
    );
  });
}
