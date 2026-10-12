import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import * as db from './db.js';
import type { Contexto, Definicao, Jogo } from './minijogo-motor.js';
import { stop } from './minijogo-stop.js';
import { sudoku } from './minijogo-sudoku.js';
import { gomoku, mancala } from './minijogo-tabuleiro.js';
import { PLACAR_MS, tamanho } from './minijogos.js';
import { communityRoom, quemEstaNaSala, salaDeVozDe } from './realtime.js';
import { manages, requireUser } from './routes.js';

/**
 * As rotas dos mini-games (ver minijogo-motor.ts). Como o palco: as ações vão por HTTP, e a cada mudança a
 * comunidade recebe 'minijogo:mudou' e quem está na sala busca o estado de novo — cada um o SEU estado,
 * porque o que se vê depende de quem pede (as próprias respostas, o próprio tabuleiro).
 *
 * Jogar exige ESTAR NA SALA DE VOZ: o jogo é da turma que está conversando. Ver o estado basta participar
 * da comunidade, para quem entra no meio já cair na rodada certa.
 *
 * A PARTIDA MORA SÓ NA MEMÓRIA. Ela dura minutos e não vale nada depois; reiniciar o servidor acaba com
 * ela, como acaba com a chamada. Sem tabela, sem limpeza.
 */
export const JOGOS: Record<string, Definicao> = { tamanho, stop, sudoku, gomoku, mancala };

interface Partida {
  channelId: number;
  communityId: number;
  jogo: string;
  criadaPor: number;
  terminada: boolean;
  /** Quando o relógio da partida dispara (hora do servidor). */
  ate: number;
  relogio: ReturnType<typeof setTimeout> | null;
  instancia: Jogo | null;
}

const partidas = new Map<number, Partida>();

/** Para os testes: as partidas de agora. */
export const _partidas = partidas;

export function registerMinijogosRoutes(app: FastifyInstance, io: IOServer) {
  const nome = (userId: number) => db.findUserById(userId)?.username ?? '?';
  const avisar = (p: Partida) => io.to(communityRoom(p.communityId)).emit('minijogo:mudou', { channelId: p.channelId });

  function agendar(p: Partida, ms: number, depois: () => void) {
    if (p.relogio) clearTimeout(p.relogio);
    p.ate = Date.now() + ms;
    p.relogio = setTimeout(() => {
      // A sala esvaziou: a partida acaba junto, sem esperar ninguém.
      if (quemEstaNaSala(p.channelId).length === 0) return encerrar(p);
      depois();
    }, ms);
    p.relogio.unref?.();
  }

  function encerrar(p: Partida) {
    if (p.relogio) clearTimeout(p.relogio);
    if (partidas.get(p.channelId) === p) partidas.delete(p.channelId);
    avisar(p);
  }

  const estado = (p: Partida, quem: number) => ({
    jogo: p.jogo,
    criadaPor: p.criadaPor,
    terminada: p.terminada,
    restanteMs: Math.max(0, p.ate - Date.now()),
    ...p.instancia?.publico(quem),
  });

  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    /** A sala de voz e se quem pede participa da comunidade; senão a resposta de recusa já vai. */
    function sala(id: string, userId: number, reply: FastifyReply) {
      const canal = db.findChannel(Number(id));
      if (!canal || canal.type !== 'voice' || canal.communityId === null || !db.memberRole(canal.communityId, userId)) {
        void reply.code(404).send({ error: 'Sala de voz não encontrada.' });
        return undefined;
      }
      return { ...canal, communityId: canal.communityId };
    }

    const estaNaSala = (userId: number, channelId: number) => salaDeVozDe(userId)?.channelId === channelId;

    authed.get<{ Params: { id: string } }>('/api/channels/:id/minijogo', async (request, reply) => {
      const canal = sala(request.params.id, request.user.id, reply);
      if (!canal) return reply;
      const p = partidas.get(canal.id);
      return { partida: p ? estado(p, request.user.id) : null };
    });

    authed.post<{ Params: { id: string }; Body: Record<string, unknown> & { jogo?: string } }>(
      '/api/channels/:id/minijogo',
      async (request, reply) => {
        const canal = sala(request.params.id, request.user.id, reply);
        if (!canal) return reply;
        const definicao = JOGOS[request.body?.jogo ?? ''];
        if (!definicao) return reply.code(400).send({ error: 'Jogo desconhecido.' });
        if (!estaNaSala(request.user.id, canal.id)) return reply.code(403).send({ error: 'Entre na sala de voz para jogar com a turma.' });
        const atual = partidas.get(canal.id);
        if (atual && !atual.terminada) return reply.code(409).send({ error: 'Já tem uma partida acontecendo nesta sala.' });
        if (atual?.relogio) clearTimeout(atual.relogio);

        const p: Partida = {
          channelId: canal.id,
          communityId: canal.communityId,
          jogo: request.body!.jogo!,
          criadaPor: request.user.id,
          terminada: false,
          ate: 0,
          relogio: null,
          instancia: null,
        };
        const ctx: Contexto = {
          agendar: (ms, depois) => agendar(p, ms, depois),
          avisar: () => avisar(p),
          terminar: () => {
            p.terminada = true;
            agendar(p, PLACAR_MS, () => encerrar(p));
            avisar(p);
          },
          naSala: () => quemEstaNaSala(canal.id),
          nome,
        };
        const instancia = definicao.comecar(ctx, { naSala: quemEstaNaSala(canal.id), criadaPor: request.user.id, corpo: request.body ?? {} });
        if (typeof instancia === 'string') {
          if (p.relogio) clearTimeout(p.relogio);
          return reply.code(400).send({ error: instancia });
        }
        p.instancia = instancia;
        partidas.set(canal.id, p);
        avisar(p);
        return { partida: estado(p, request.user.id) };
      },
    );

    authed.post<{ Params: { id: string }; Body: Record<string, unknown> }>('/api/channels/:id/minijogo/acao', async (request, reply) => {
      const canal = sala(request.params.id, request.user.id, reply);
      if (!canal) return reply;
      const p = partidas.get(canal.id);
      if (!p?.instancia || p.terminada) return reply.code(409).send({ error: 'A partida acabou.' });
      if (!estaNaSala(request.user.id, canal.id)) return reply.code(403).send({ error: 'Entre na sala de voz para jogar com a turma.' });
      const erro = p.instancia.acao(request.user.id, request.body ?? {});
      if (erro) return reply.code(409).send({ error: erro });
      return { partida: estado(p, request.user.id) };
    });

    authed.delete<{ Params: { id: string } }>('/api/channels/:id/minijogo', async (request, reply) => {
      const canal = sala(request.params.id, request.user.id, reply);
      if (!canal) return reply;
      const p = partidas.get(canal.id);
      if (!p) return { ok: true };
      // Fecha quem começou, quem administra, ou qualquer um da sala depois do placar final.
      const pode =
        p.criadaPor === request.user.id ||
        manages(db.memberRole(canal.communityId, request.user.id)) ||
        (p.terminada && estaNaSala(request.user.id, canal.id));
      if (!pode) return reply.code(403).send({ error: 'Só quem começou a partida pode encerrá-la antes do fim.' });
      encerrar(p);
      return { ok: true };
    });
  });
}
