import type { FastifyInstance } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import * as db from './db.js';
import { manages, requireUser } from './routes.js';
import { preencher, publicarComoSyden } from './syden-app.js';

/**
 * OS COMANDOS PERSONALIZADOS (ver o bloco em db.ts): "!regras" e o Syden responde no canal com o texto
 * cadastrado. Quem administra cadastra; todo membro vê a lista (para saber o que existe) e usa.
 *
 * O texto pode chamar quem pediu e a comunidade: {pessoa} e {comunidade}.
 */
export const NOME_DE_COMANDO = /^[a-z0-9_-]{1,20}$/;
const RESPOSTA_MAXIMA = 2000;
/** O mesmo comando no mesmo canal responde no máximo a cada 5 s: dez "!regras" seguidos são uma resposta. */
const ESPERA_POR_CANAL_MS = 5_000;
const NAO_ENCONTRADA = 'Comunidade não encontrada.';

const ultimaResposta = new Map<string, number>();

/**
 * Depois de uma mensagem publicada: se ela começa por "!nome" e a comunidade tem esse comando, o Syden
 * responde. Chamado pelo realtime.ts, no mesmo caminho de qualquer mensagem.
 */
export function responderComando(io: IOServer, channel: db.Channel, autor: db.User, conteudo: string, threadId: number | null) {
  if (channel.communityId === null) return;
  const pedido = /^!([a-z0-9_-]{1,20})(?:\s|$)/i.exec(conteudo.trim());
  if (!pedido) return;
  const comando = db.acharComando(channel.communityId, pedido[1].toLowerCase());
  if (!comando) return;
  const chave = `${channel.id}:${comando.id}`;
  const agora = Date.now();
  if (agora - (ultimaResposta.get(chave) ?? 0) < ESPERA_POR_CANAL_MS) return;
  ultimaResposta.set(chave, agora);
  const comunidade = db.findCommunity(channel.communityId)?.name ?? '';
  publicarComoSyden(io, channel, preencher(comando.resposta, { pessoa: autor.username, comunidade }), threadId);
}

export function registerComandosRoutes(app: FastifyInstance) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    authed.get<{ Params: { id: string } }>('/api/communities/:id/comandos', async (request, reply) => {
      const communityId = Number(request.params.id);
      if (!db.memberRole(communityId, request.user.id)) return reply.code(404).send({ error: NAO_ENCONTRADA });
      return db.listarComandos(communityId);
    });

    authed.put<{ Params: { id: string }; Body: { nome?: string; resposta?: string } }>(
      '/api/communities/:id/comandos',
      async (request, reply) => {
        const communityId = Number(request.params.id);
        const papel = db.memberRole(communityId, request.user.id);
        if (!papel) return reply.code(404).send({ error: NAO_ENCONTRADA });
        if (!manages(papel)) return reply.code(403).send({ error: 'Só quem administra a comunidade cria comandos.' });
        const nome = String(request.body?.nome ?? '').trim().replace(/^!/, '').toLowerCase();
        if (!NOME_DE_COMANDO.test(nome)) {
          return reply.code(400).send({ error: 'O nome do comando usa letras sem acento, números, - ou _, até 20.' });
        }
        const resposta = String(request.body?.resposta ?? '').trim();
        if (!resposta || resposta.length > RESPOSTA_MAXIMA) {
          return reply.code(400).send({ error: `A resposta deve ter de 1 a ${RESPOSTA_MAXIMA} caracteres.` });
        }
        const novo = !db.acharComando(communityId, nome);
        if (novo && db.listarComandos(communityId).length >= db.MAXIMO_DE_COMANDOS) {
          return reply.code(409).send({ error: `Esta comunidade já tem ${db.MAXIMO_DE_COMANDOS} comandos, o máximo.` });
        }
        return db.salvarComando(communityId, nome, resposta);
      },
    );

    authed.delete<{ Params: { id: string; comandoId: string } }>('/api/communities/:id/comandos/:comandoId', async (request, reply) => {
      const communityId = Number(request.params.id);
      const papel = db.memberRole(communityId, request.user.id);
      if (!papel) return reply.code(404).send({ error: NAO_ENCONTRADA });
      if (!manages(papel)) return reply.code(403).send({ error: 'Só quem administra a comunidade apaga comandos.' });
      if (!db.apagarComando(communityId, Number(request.params.comandoId))) return reply.code(404).send({ error: 'Comando não encontrado.' });
      return { ok: true };
    });
  });
}
