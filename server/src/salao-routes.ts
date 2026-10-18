/**
 * O SALÃO DE CADA COMUNIDADE: a arrumação do salão isométrico (decisão dele, 15/10/2026: "só quem administra pode
 * mexer"). O formato é o do quarto (quarto.ts: só posições e códigos, validados porque são desenhados na tela de todo
 * membro), e a página é a mesma (e2e/pixel-art/salao/), na cena do salão.
 *
 * - LER: qualquer membro da comunidade. Quem não participa recebe 404, como nas outras rotas da comunidade (os ids são
 *   sequenciais; um 403 contaria quais comunidades existem).
 * - GUARDAR: quem administra (dono ou admin) e quem tem um cargo marcado "Pode arrumar o salão" (decisão dele,
 *   18/10/2026: a turma contribui sem o dono fazer toda a manutenção; o único poder que um cargo dá, ver db.ts). A trava
 *   fica aqui, e não só na barra de arrumar escondida: a tela é a parte que qualquer um contorna.
 * - DESFAZER: só quem administra volta o salão ao que era antes de quem mexeu por último (o ponto de volta, db.ts).
 * - Guardou, a turma vê na hora: o aviso vai à sala da comunidade, e quem está com o salão aberto relê.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import * as db from './db.js';
import { communityRoom } from './realtime.js';
import { manages, requireUser, roleIn } from './routes.js';
import { ACEITA_COPIAS, CASAS_DO_SALAO, MAX_BYTES, validarArrumacao } from './quarto.js';

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

    const podeArrumar = (communityId: number, role: db.Role, userId: number) => manages(role) || db.cargoArrumaSalao(communityId, userId);
    const avisar = (communityId: number, por: number) => io.to(communityRoom(communityId)).emit('salao:mudou', { communityId, por });

    /**
     * O salão como a turma deixou, ou null (ninguém mexeu: a página usa o de fábrica). Com quem mexeu por último, e, para
     * quem administra, se dá para desfazer o que essa pessoa fez.
     */
    authed.get<{ Params: { id: string } }>('/api/communities/:id/salao', async (request, reply) => {
      const m = membro(request, reply);
      if (!m) return reply;
      const s = db.lerSalao(m.communityId);
      const quem = s?.por ? db.findUserById(s.por) : undefined;
      return {
        arrumacao: s ? JSON.parse(s.arrumacao) : null,
        em: s?.em ?? null,
        podeEditar: podeArrumar(m.communityId, m.role, request.user.id),
        porUltimo: quem ? { id: quem.id, nome: quem.username } : null,
        podeDesfazer: manages(m.role) && !!s?.temAnterior,
        copias: ACEITA_COPIAS,
      };
    });

    authed.put<{ Params: { id: string }; Body: unknown }>('/api/communities/:id/salao', { bodyLimit: MAX_BYTES * 2 }, async (request, reply) => {
      const m = membro(request, reply);
      if (!m) return reply;
      if (!podeArrumar(m.communityId, m.role, request.user.id)) return reply.code(403).send({ error: 'Você não tem um cargo que arruma o salão.' });
      const v = validarArrumacao(request.body, CASAS_DO_SALAO);
      if ('erro' in v) return reply.code(400).send({ error: v.erro });
      const texto = JSON.stringify(v.ok);
      if (texto.length > MAX_BYTES) return reply.code(413).send({ error: 'Arrumação grande demais.' });
      db.guardarSalao(m.communityId, request.user.id, texto);
      avisar(m.communityId, request.user.id);
      return { ok: true };
    });

    /** Quem administra desfaz o que a última pessoa fez no salão. */
    authed.post<{ Params: { id: string } }>('/api/communities/:id/salao/desfazer', async (request, reply) => {
      const m = membro(request, reply);
      if (!m) return reply;
      if (!manages(m.role)) return reply.code(403).send({ error: 'Só quem administra a comunidade desfaz o salão.' });
      if (!db.voltarSalao(m.communityId, request.user.id)) return reply.code(409).send({ error: 'Não há o que desfazer.' });
      avisar(m.communityId, request.user.id);
      return { ok: true };
    });
  });
}
