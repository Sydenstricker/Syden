import type { FastifyInstance } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import * as db from './db.js';
import { communityRoom, emitToUser, salaDeVozDe } from './realtime.js';
import { manages, requireUser, tirarDaChamada } from './routes.js';

/** Os tempos de silêncio: de cinco minutos a uma semana. 0 tira o silêncio. */
export const MINUTOS_DE_SILENCIO = [0, 5, 60, 600, 1440, 10080];
const NAO_ENCONTRADA = 'Comunidade não encontrada.';

/**
 * ADVERTÊNCIAS E SILÊNCIO TEMPORÁRIO (ver o bloco em db.ts): o que quem administra aplica a uma pessoa.
 *
 * QUEM PODE AGIR SOBRE QUEM é a mesma regra da remoção de membro, para não existirem duas: ninguém age
 * sobre o dono, nem sobre si; administrador age sobre membro; sobre outro administrador, só o dono.
 *
 * O silêncio barra mensagem (pelo automod.ts) e voz (no voice-token), e tira da chamada quem estiver
 * numa sala da comunidade naquela hora. A pessoa é avisada das duas coisas, só ela.
 */
export function registerAdvertenciasRoutes(app: FastifyInstance, io: IOServer) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    const podeAgirSobre = (communityId: number, quem: db.User, alvoId: number) => {
      const papel = db.memberRole(communityId, quem.id);
      if (!papel) return { codigo: 404, erro: NAO_ENCONTRADA };
      if (!manages(papel)) return { codigo: 403, erro: 'Só quem administra a comunidade adverte e silencia.' };
      const papelDoAlvo = db.memberRole(communityId, alvoId);
      if (!papelDoAlvo) return { codigo: 404, erro: 'Essa pessoa não participa da comunidade.' };
      if (alvoId === quem.id) return { codigo: 400, erro: 'Não dá para fazer isso consigo.' };
      if (papelDoAlvo === 'owner') return { codigo: 403, erro: 'Quem criou a comunidade não pode ser advertido nem silenciado.' };
      if (papelDoAlvo === 'admin' && papel !== 'owner') return { codigo: 403, erro: 'Só quem criou a comunidade age sobre um administrador.' };
      return null;
    };

    authed.get<{ Params: { id: string; userId: string } }>('/api/communities/:id/members/:userId/advertencias', async (request, reply) => {
      const communityId = Number(request.params.id);
      const papel = db.memberRole(communityId, request.user.id);
      if (!papel) return reply.code(404).send({ error: NAO_ENCONTRADA });
      if (!manages(papel)) return reply.code(403).send({ error: 'Só quem administra a comunidade vê as advertências.' });
      return db.listarAdvertencias(communityId, Number(request.params.userId));
    });

    authed.post<{ Params: { id: string; userId: string }; Body: { motivo?: string } }>(
      '/api/communities/:id/members/:userId/advertencias',
      async (request, reply) => {
        const communityId = Number(request.params.id);
        const alvoId = Number(request.params.userId);
        const negado = podeAgirSobre(communityId, request.user, alvoId);
        if (negado) return reply.code(negado.codigo).send({ error: negado.erro });
        const motivo = String(request.body?.motivo ?? '').trim();
        if (motivo.length < 3 || motivo.length > 500) return reply.code(400).send({ error: 'Escreva o motivo (de 3 a 500 caracteres).' });
        const advertencia = db.criarAdvertencia(communityId, alvoId, request.user.id, motivo);
        const comunidade = db.findCommunity(communityId)!;
        db.registrarAuditoria({
          actor: request.user,
          action: 'membro.advertido',
          target: db.findUserById(alvoId)?.username ?? String(alvoId),
          communityId,
          detail: motivo,
        });
        emitToUser(io, alvoId, 'advertencia', { communityId, comunidade: comunidade.name, motivo });
        return advertencia;
      },
    );

    authed.put<{ Params: { id: string; userId: string }; Body: { minutos?: number } }>(
      '/api/communities/:id/members/:userId/silencio',
      async (request, reply) => {
        const communityId = Number(request.params.id);
        const alvoId = Number(request.params.userId);
        const negado = podeAgirSobre(communityId, request.user, alvoId);
        if (negado) return reply.code(negado.codigo).send({ error: negado.erro });
        const minutos = Number(request.body?.minutos);
        if (!MINUTOS_DE_SILENCIO.includes(minutos)) return reply.code(400).send({ error: 'Tempo de silêncio inválido.' });
        const ate = minutos === 0 ? null : new Date(Date.now() + minutos * 60_000).toISOString();
        db.silenciar(communityId, alvoId, ate);
        db.registrarAuditoria({
          actor: request.user,
          action: ate ? 'membro.silenciado' : 'membro.silencio-tirado',
          target: db.findUserById(alvoId)?.username ?? String(alvoId),
          communityId,
          detail: ate ? `${minutos} min` : undefined,
        });
        // Quem estava numa sala desta comunidade sai dela agora: o silêncio vale para a voz também.
        const naVoz = salaDeVozDe(alvoId);
        if (ate && naVoz?.communityId === communityId) await tirarDaChamada(naVoz.channelId, alvoId);
        const member = db.listCommunityMembers(communityId).find((m) => m.id === alvoId);
        if (member) io.to(communityRoom(communityId)).emit('member:updated', { communityId, member });
        emitToUser(io, alvoId, 'silencio', { communityId, comunidade: db.findCommunity(communityId)?.name ?? '', ate });
        return member;
      },
    );
  });
}
