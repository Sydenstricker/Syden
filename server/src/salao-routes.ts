/**
 * O SALÃO DE CADA COMUNIDADE: a arrumação do salão isométrico (decisão dele, 15/10/2026: "só quem administra pode
 * mexer"). O formato é o do quarto (quarto.ts: só posições e códigos, validados porque são desenhados na tela de todo
 * membro), e a página é a mesma (e2e/pixel-art/salao/), na cena do salão.
 *
 * - LER: qualquer membro da comunidade. Quem não participa recebe 404, como nas outras rotas da comunidade (os ids são
 *   sequenciais; um 403 contaria quais comunidades existem).
 * - GUARDAR: só quem administra (dono ou admin). A trava fica aqui, e não só na barra de arrumar escondida: a tela é a
 *   parte que qualquer um contorna.
 * - Guardou, a turma vê na hora: o aviso vai à sala da comunidade, e quem está com o salão aberto relê.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import * as db from './db.js';
import { communityRoom } from './realtime.js';
import { manages, requireUser, roleIn } from './routes.js';
import { MAX_BYTES, validarArrumacao } from './quarto.js';

export function registerSalaoRoutes(app: FastifyInstance, io: IOServer) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    const membro = (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const communityId = Number(request.params.id);
      const role = Number.isInteger(communityId) && db.findCommunity(communityId) ? roleIn(request.user, communityId) : undefined;
      if (!role) {
        reply.code(404).send({ error: 'Comunidade não encontrada.' });
        return null;
      }
      return { communityId, role };
    };

    /** O salão como quem administra deixou, ou null (ninguém mexeu: a página usa o de fábrica). */
    authed.get<{ Params: { id: string } }>('/api/communities/:id/salao', async (request, reply) => {
      const m = membro(request, reply);
      if (!m) return reply;
      const s = db.lerSalao(m.communityId);
      return { arrumacao: s ? JSON.parse(s.arrumacao) : null, em: s?.em ?? null, podeEditar: manages(m.role) };
    });

    authed.put<{ Params: { id: string }; Body: unknown }>('/api/communities/:id/salao', { bodyLimit: MAX_BYTES * 2 }, async (request, reply) => {
      const m = membro(request, reply);
      if (!m) return reply;
      if (!manages(m.role)) return reply.code(403).send({ error: 'Só quem administra a comunidade arruma o salão.' });
      const v = validarArrumacao(request.body);
      if ('erro' in v) return reply.code(400).send({ error: v.erro });
      const texto = JSON.stringify(v.ok);
      if (texto.length > MAX_BYTES) return reply.code(413).send({ error: 'Arrumação grande demais.' });
      db.guardarSalao(m.communityId, request.user.id, texto);
      io.to(communityRoom(m.communityId)).emit('salao:mudou', { communityId: m.communityId, por: request.user.id });
      return { ok: true };
    });
  });
}
