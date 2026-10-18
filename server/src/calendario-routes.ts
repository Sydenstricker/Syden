import type { FastifyInstance } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import * as db from './db.js';
import { communityRoom } from './realtime.js';
import { manages, requireUser } from './routes.js';

/**
 * O CALENDÁRIO DA COMUNIDADE (pedido dele, 18/10/2026; ver o bloco em db.ts): os eventos que quem administra marca e os
 * aniversários dos membros (só com os parabéns ligados).
 *
 * - LER: qualquer membro, num intervalo de no máximo ~400 dias (um mês da tela pede o mês). Quem não participa: 404.
 * - CRIAR e APAGAR evento: só quem administra. O nome é texto de fora (aparece na tela de todo membro): sem caracteres
 *   invisíveis nem de controle, e com tamanho. A data, de uma hora atrás a dois anos à frente.
 * - Mudou, a turma relê na hora (calendario:mudou).
 */
const NOME_MAXIMO = 80;
const FUTUROS_MAXIMOS = 100;
const DIA = 24 * 60 * 60 * 1000;
const NAO_ENCONTRADA = 'Comunidade não encontrada.';

const limparNome = (valor: unknown) => {
  const limpo = String(valor ?? '').replace(/(?!\u{200D})[\p{Cc}\p{Cf}]/gu, '').trim().replace(/\s+/g, ' ');
  return /[^\s\u{200D}]/u.test(limpo) && limpo.length <= NOME_MAXIMO ? limpo : null;
};

export function registerCalendarioRoutes(app: FastifyInstance, io: IOServer) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);
    const avisar = (communityId: number) => io.to(communityRoom(communityId)).emit('calendario:mudou', { communityId });

    authed.get<{ Params: { id: string }; Querystring: { de?: string; ate?: string } }>('/api/communities/:id/calendario', async (request, reply) => {
      const communityId = Number(request.params.id);
      const papel = Number.isInteger(communityId) ? db.memberRole(communityId, request.user.id) : undefined;
      if (!papel) return reply.code(404).send({ error: NAO_ENCONTRADA });
      const agora = Date.now();
      const de = Date.parse(request.query.de ?? '') || agora - DIA;
      const ate = Date.parse(request.query.ate ?? '') || agora + 60 * DIA;
      if (ate <= de || ate - de > 400 * DIA) return reply.code(400).send({ error: 'Intervalo inválido.' });
      return {
        eventos: db.eventosDaComunidade(communityId, new Date(de).toISOString(), new Date(ate).toISOString()),
        aniversarios: db.aniversariosNoCalendario(communityId),
        podeEditar: manages(papel),
      };
    });

    authed.post<{ Params: { id: string }; Body: { titulo?: unknown; quando?: unknown } }>('/api/communities/:id/eventos', async (request, reply) => {
      const communityId = Number(request.params.id);
      const papel = Number.isInteger(communityId) ? db.memberRole(communityId, request.user.id) : undefined;
      if (!papel) return reply.code(404).send({ error: NAO_ENCONTRADA });
      if (!manages(papel)) return reply.code(403).send({ error: 'Só quem administra a comunidade marca eventos.' });
      const titulo = limparNome(request.body?.titulo);
      if (!titulo) return reply.code(400).send({ error: `O nome do evento deve ter de 1 a ${NOME_MAXIMO} caracteres.` });
      const quando = typeof request.body?.quando === 'string' ? Date.parse(request.body.quando) : NaN;
      const agora = Date.now();
      if (!Number.isFinite(quando) || quando < agora - 60 * 60 * 1000 || quando > agora + 730 * DIA) return reply.code(400).send({ error: 'Data inválida.' });
      if (db.eventosFuturos(communityId, new Date(agora).toISOString()) >= FUTUROS_MAXIMOS) {
        return reply.code(409).send({ error: `Esta comunidade já tem ${FUTUROS_MAXIMOS} eventos marcados, o máximo.` });
      }
      const evento = db.criarEvento(communityId, titulo, new Date(quando).toISOString(), request.user.id);
      avisar(communityId);
      return reply.code(201).send(evento);
    });

    authed.delete<{ Params: { id: string; eventoId: string } }>('/api/communities/:id/eventos/:eventoId', async (request, reply) => {
      const communityId = Number(request.params.id);
      const papel = Number.isInteger(communityId) ? db.memberRole(communityId, request.user.id) : undefined;
      if (!papel) return reply.code(404).send({ error: NAO_ENCONTRADA });
      if (!manages(papel)) return reply.code(403).send({ error: 'Só quem administra a comunidade apaga eventos.' });
      if (!db.apagarEvento(communityId, Number(request.params.eventoId))) return reply.code(404).send({ error: 'Evento não encontrado.' });
      avisar(communityId);
      return { ok: true };
    });
  });
}
