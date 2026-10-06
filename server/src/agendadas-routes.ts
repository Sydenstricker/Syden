import type { FastifyInstance } from 'fastify';
import * as db from './db.js';
import { manages, requireUser } from './routes.js';

/**
 * MENSAGENS AGENDADAS (quem administra) e LEMBRETES (qualquer pessoa). Quem cumpre a hora é o
 * agendador.ts. Ver o bloco em db.ts.
 */
const NAO_ENCONTRADA = 'Comunidade não encontrada.';
const TEXTO_MAXIMO = 2000;
const UM_ANO_MS = 366 * 24 * 60 * 60_000;
export const MINUTOS_DE_LEMBRETE = [20, 60, 180, 1440];
const REPETICOES: db.Repeticao[] = ['nunca', 'diario', 'semanal'];
const MAXIMO_DE_AGENDADAS = 50;

export function registerAgendadasRoutes(app: FastifyInstance) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    authed.get<{ Params: { id: string } }>('/api/communities/:id/agendadas', async (request, reply) => {
      const communityId = Number(request.params.id);
      const papel = db.memberRole(communityId, request.user.id);
      if (!papel) return reply.code(404).send({ error: NAO_ENCONTRADA });
      if (!manages(papel)) return reply.code(403).send({ error: 'Só quem administra a comunidade vê as mensagens agendadas.' });
      return db.listarAgendadas(communityId);
    });

    authed.post<{ Params: { id: string }; Body: { channelId?: number; texto?: string; quando?: string; repetir?: string } }>(
      '/api/communities/:id/agendadas',
      async (request, reply) => {
        const communityId = Number(request.params.id);
        const papel = db.memberRole(communityId, request.user.id);
        if (!papel) return reply.code(404).send({ error: NAO_ENCONTRADA });
        if (!manages(papel)) return reply.code(403).send({ error: 'Só quem administra a comunidade agenda mensagens.' });
        const canal = db.findChannel(Number(request.body?.channelId));
        if (!canal || canal.communityId !== communityId || canal.type !== 'text') return reply.code(400).send({ error: 'Escolha um canal de texto da comunidade.' });
        const texto = String(request.body?.texto ?? '').trim();
        if (!texto || texto.length > TEXTO_MAXIMO) return reply.code(400).send({ error: `O texto deve ter de 1 a ${TEXTO_MAXIMO} caracteres.` });
        const quando = Date.parse(String(request.body?.quando ?? ''));
        if (!Number.isFinite(quando) || quando <= Date.now() || quando > Date.now() + UM_ANO_MS) {
          return reply.code(400).send({ error: 'Escolha uma hora no futuro, em até um ano.' });
        }
        const repetir = String(request.body?.repetir ?? 'nunca') as db.Repeticao;
        if (!REPETICOES.includes(repetir)) return reply.code(400).send({ error: 'Repetição inválida.' });
        if (db.listarAgendadas(communityId).length >= MAXIMO_DE_AGENDADAS) {
          return reply.code(409).send({ error: `Esta comunidade já tem ${MAXIMO_DE_AGENDADAS} mensagens agendadas, o máximo.` });
        }
        return db.criarAgendada(communityId, canal.id, texto, new Date(quando).toISOString(), repetir, request.user.id);
      },
    );

    authed.delete<{ Params: { id: string; agendadaId: string } }>('/api/communities/:id/agendadas/:agendadaId', async (request, reply) => {
      const communityId = Number(request.params.id);
      const papel = db.memberRole(communityId, request.user.id);
      if (!papel) return reply.code(404).send({ error: NAO_ENCONTRADA });
      if (!manages(papel)) return reply.code(403).send({ error: 'Só quem administra a comunidade apaga mensagens agendadas.' });
      if (!db.apagarAgendada(communityId, Number(request.params.agendadaId))) return reply.code(404).send({ error: 'Mensagem agendada não encontrada.' });
      return { ok: true };
    });

    /** "Lembrar de mim": sobre uma mensagem que a pessoa enxerga, daqui a alguns minutos. */
    authed.post<{ Body: { messageId?: number; minutos?: number } }>('/api/lembretes', async (request, reply) => {
      const mensagem = db.findMessage(Number(request.body?.messageId));
      const canal = mensagem && db.findChannel(mensagem.channelId);
      const enxerga =
        canal &&
        (canal.communityId === null ? db.isChannelMember(canal.id, request.user.id) : db.memberRole(canal.communityId, request.user.id) !== undefined);
      if (!mensagem || !enxerga) return reply.code(404).send({ error: 'Mensagem não encontrada.' });
      const minutos = Number(request.body?.minutos);
      if (!MINUTOS_DE_LEMBRETE.includes(minutos)) return reply.code(400).send({ error: 'Tempo de lembrete inválido.' });
      const quando = new Date(Date.now() + minutos * 60_000).toISOString();
      db.criarLembrete(request.user.id, mensagem.id, quando);
      return { quando };
    });
  });
}
