import type { FastifyInstance } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import { MAXIMO_DE_PALAVRAS, MODOS_LENTOS, normalizar } from './automod.js';
import * as db from './db.js';
import { communityRoom } from './realtime.js';
import { manages, requireUser } from './routes.js';

const NAO_ENCONTRADA = 'Comunidade não encontrada.';
const PALAVRA_MAXIMA = 40;

/**
 * A MODERAÇÃO AUTOMÁTICA (ver automod.ts): as regras da comunidade e o modo lento de cada canal. Tudo
 * aqui é de quem administra — a lista de palavras proibidas inclusive, que não precisa estar à vista
 * de todo mundo.
 */
export function registerAutomodRoutes(app: FastifyInstance, io: IOServer) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    /** O papel de quem pede, ou a resposta de erro já enviada. */
    const administra = (communityId: number, userId: number) => {
      const papel = db.memberRole(communityId, userId);
      if (!papel) return { codigo: 404, erro: NAO_ENCONTRADA };
      if (!manages(papel)) return { codigo: 403, erro: 'Só quem administra a comunidade mexe na moderação.' };
      return null;
    };

    authed.get<{ Params: { id: string } }>('/api/communities/:id/moderacao', async (request, reply) => {
      const communityId = Number(request.params.id);
      const negado = administra(communityId, request.user.id);
      if (negado) return reply.code(negado.codigo).send({ error: negado.erro });
      return db.regrasDeModeracao(communityId);
    });

    authed.put<{ Params: { id: string }; Body: { palavras?: unknown; links?: unknown; flood?: unknown } }>(
      '/api/communities/:id/moderacao',
      async (request, reply) => {
        const communityId = Number(request.params.id);
        const negado = administra(communityId, request.user.id);
        if (negado) return reply.code(negado.codigo).send({ error: negado.erro });
        const corpo = request.body ?? {};
        if (!Array.isArray(corpo.palavras) || typeof corpo.links !== 'boolean' || typeof corpo.flood !== 'boolean') {
          return reply.code(400).send({ error: 'Regras inválidas.' });
        }
        // Sem repetir: "Porra" e "porra" são a mesma regra.
        const vistas = new Set<string>();
        const palavras: string[] = [];
        for (const item of corpo.palavras) {
          const palavra = String(item ?? '').trim().replace(/\s+/g, ' ');
          if (!palavra) continue;
          if (palavra.length > PALAVRA_MAXIMA) return reply.code(400).send({ error: `Cada palavra pode ter até ${PALAVRA_MAXIMA} letras.` });
          if (vistas.has(normalizar(palavra))) continue;
          vistas.add(normalizar(palavra));
          palavras.push(palavra);
        }
        if (palavras.length > MAXIMO_DE_PALAVRAS) return reply.code(400).send({ error: `No máximo ${MAXIMO_DE_PALAVRAS} palavras.` });
        const regras = { palavras, links: corpo.links, flood: corpo.flood };
        db.definirRegrasDeModeracao(communityId, regras);
        return regras;
      },
    );

    authed.put<{ Params: { id: string }; Body: { segundos?: number } }>('/api/channels/:id/modo-lento', async (request, reply) => {
      const channel = db.findChannel(Number(request.params.id));
      if (!channel || channel.communityId === null) return reply.code(404).send({ error: 'Canal não encontrado.' });
      const negado = administra(channel.communityId, request.user.id);
      if (negado) return reply.code(negado.codigo === 404 ? 404 : 403).send({ error: negado.codigo === 404 ? 'Canal não encontrado.' : negado.erro });
      if (channel.type !== 'text') return reply.code(400).send({ error: 'Só canal de texto tem modo lento.' });
      const segundos = Number(request.body?.segundos);
      if (!MODOS_LENTOS.includes(segundos)) return reply.code(400).send({ error: 'Tempo de modo lento inválido.' });
      const atualizado = db.definirModoLento(channel.id, segundos)!;
      io.to(communityRoom(channel.communityId)).emit('channel:updated', atualizado);
      return atualizado;
    });
  });
}
