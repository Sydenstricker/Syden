import type { FastifyInstance } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import * as db from './db.js';
import { communityRoom, pessoasNaSala } from './realtime.js';
import { manages, requireUser, roleIn } from './routes.js';

/**
 * AS SALAS TEMPORÁRIAS (ver o bloco em db.ts).
 *
 * NASCE NA SENHA DE ENTRADA: quem pede para entrar na sala que cria salas recebe a senha de uma sala
 * nova, já com o número dela (ver voice-token em routes.ts). O app entra direto na nova — não existe o
 * meio segundo em que a pessoa "está" na sala de criar.
 *
 * SOME QUANDO ESVAZIA, por dois caminhos: na hora em que a última pessoa sai (endVoiceSession, em
 * realtime.ts), e numa varredura do agendador para o que escapa disso — servidor que reiniciou com a
 * sala vazia, ou quem pegou a senha e nunca chegou a conectar. A varredura dá um minuto de folga: é o
 * tempo entre a senha e a conexão.
 *
 * O NOME É O DA PESSOA ("ana"), e não "Sala da Ana": o servidor não sabe a língua da comunidade, e um
 * nome não precisa de tradução. Quem é dona da sala a renomeia pelo lápis de sempre.
 */
const FOLGA_MS = 60_000;
export const LIMITE_MAXIMO = 99;

export function apagarSeVazia(io: IOServer, channelId: number) {
  const canal = db.findChannel(channelId);
  if (!canal || !canal.temporaria || canal.communityId === null || pessoasNaSala(channelId) > 0) return;
  db.deleteChannel(canal.id);
  io.to(communityRoom(canal.communityId)).emit('channel:deleted', { id: canal.id, communityId: canal.communityId });
}

export function varrerSalasTemporarias(io: IOServer, agora = Date.now()) {
  for (const sala of db.salasTemporarias()) {
    if (agora - Date.parse(sala.desde) >= FOLGA_MS) apagarSeVazia(io, sala.id);
  }
}

/**
 * A sala em que a pessoa vai entrar de fato: ela mesma, ou — se for uma sala que cria salas — a sala
 * temporária da pessoa (a que já existe, ou uma nova).
 */
export function salaParaEntrar(io: IOServer, canal: db.Channel, user: db.User): db.Channel {
  if (!canal.criaSalas || canal.communityId === null) return canal;
  const existente = db.salaTemporariaDe(canal.communityId, user.id);
  if (existente) return existente;
  const nova = db.criarSalaTemporaria(canal, user.id, user.username.slice(0, 50));
  // depoisDe: a lista de quem já está com a tela aberta põe a sala nova no lugar certo, logo abaixo.
  io.to(communityRoom(canal.communityId)).emit('channel:created', { ...nova, depoisDe: canal.id });
  return nova;
}

export function registerSalasTemporariasRoutes(app: FastifyInstance, io: IOServer) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    /** Liga ou desliga "cria salas" numa sala de voz. Só quem administra. */
    authed.put<{ Params: { id: string }; Body: { ligado?: boolean } }>('/api/channels/:id/cria-salas', async (request, reply) => {
      const canal = db.findChannel(Number(request.params.id));
      if (!canal || canal.communityId === null || !roleIn(request.user, canal.communityId)) return reply.code(404).send({ error: 'Canal não encontrado.' });
      if (!manages(roleIn(request.user, canal.communityId))) return reply.code(403).send({ error: 'Só quem administra a comunidade muda isso.' });
      if (canal.type !== 'voice' || canal.temporaria) return reply.code(400).send({ error: 'Só uma sala de voz comum pode criar salas.' });
      const atualizado = db.definirCriaSalas(canal.id, request.body?.ligado === true);
      io.to(communityRoom(canal.communityId)).emit('channel:updated', atualizado);
      return atualizado;
    });

    /** Quantas pessoas cabem: quem administra, ou quem é dona da sala temporária. 0 tira o limite. */
    authed.put<{ Params: { id: string }; Body: { limite?: number } }>('/api/channels/:id/limite', async (request, reply) => {
      const canal = db.findChannel(Number(request.params.id));
      if (!canal || canal.communityId === null || !roleIn(request.user, canal.communityId)) return reply.code(404).send({ error: 'Canal não encontrado.' });
      const dona = canal.temporaria === 1 && canal.createdBy === request.user.id;
      if (!dona && !manages(roleIn(request.user, canal.communityId))) return reply.code(403).send({ error: 'Só quem criou a sala ou quem administra muda o limite.' });
      if (canal.type !== 'voice' || canal.criaSalas) return reply.code(400).send({ error: 'O limite vale para salas de voz.' });
      const limite = Number(request.body?.limite);
      if (!Number.isInteger(limite) || limite < 0 || limite > LIMITE_MAXIMO) return reply.code(400).send({ error: `De 0 (sem limite) a ${LIMITE_MAXIMO} pessoas.` });
      const atualizado = db.definirLimite(canal.id, limite);
      io.to(communityRoom(canal.communityId)).emit('channel:updated', atualizado);
      return atualizado;
    });
  });
}
