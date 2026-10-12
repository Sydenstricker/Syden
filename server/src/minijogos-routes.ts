import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import * as db from './db.js';
import {
  estadoPublico,
  maior,
  PLACAR_MS,
  REVELANDO_MS,
  RODADAS,
  sortearPar,
  VOTANDO_MS,
  type Partida,
} from './minijogos.js';
import { communityRoom, quemEstaNaSala, salaDeVozDe } from './realtime.js';
import { manages, requireUser } from './routes.js';

/**
 * As rotas dos mini-games (ver minijogos.ts). Como o palco: as ações vão por HTTP, e a cada mudança a
 * comunidade recebe 'minijogo:mudou' e quem está na sala busca o estado de novo.
 *
 * Jogar exige ESTAR NA SALA DE VOZ: o jogo é da turma que está conversando. Ver o estado basta participar
 * da comunidade, para quem entra no meio já cair na rodada certa.
 */
const partidas = new Map<number, Partida>();

/** Para os testes: as partidas de agora e um jeito de adiantar o relógio. */
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

  function novaRodada(p: Partida) {
    p.par = sortearPar(p.usados);
    p.par.forEach((id) => p.usados.add(id));
    p.votos.clear();
    p.fase = 'votando';
    agendar(p, VOTANDO_MS, () => revelar(p));
    avisar(p);
  }

  function revelar(p: Partida) {
    if (p.fase !== 'votando') return;
    const certo = maior(p.par);
    for (const [userId, escolha] of p.votos) p.pontos.set(userId, (p.pontos.get(userId) ?? 0) + (escolha === certo ? 1 : 0));
    p.fase = 'revelando';
    agendar(p, REVELANDO_MS, () => {
      if (p.rodada >= RODADAS) return terminar(p);
      p.rodada++;
      novaRodada(p);
    });
    avisar(p);
  }

  function terminar(p: Partida) {
    p.fase = 'fim';
    agendar(p, PLACAR_MS, () => encerrar(p));
    avisar(p);
  }

  function encerrar(p: Partida) {
    if (p.relogio) clearTimeout(p.relogio);
    if (partidas.get(p.channelId) === p) partidas.delete(p.channelId);
    avisar(p);
  }

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
      return { partida: p ? estadoPublico(p, nome) : null };
    });

    authed.post<{ Params: { id: string }; Body: { jogo?: string } }>('/api/channels/:id/minijogo', async (request, reply) => {
      const canal = sala(request.params.id, request.user.id, reply);
      if (!canal) return reply;
      if (request.body?.jogo !== 'tamanho') return reply.code(400).send({ error: 'Jogo desconhecido.' });
      if (!estaNaSala(request.user.id, canal.id)) return reply.code(403).send({ error: 'Entre na sala de voz para jogar com a turma.' });
      const atual = partidas.get(canal.id);
      if (atual && atual.fase !== 'fim') return reply.code(409).send({ error: 'Já tem uma partida acontecendo nesta sala.' });
      if (atual?.relogio) clearTimeout(atual.relogio);

      const p: Partida = {
        channelId: canal.id,
        communityId: canal.communityId,
        jogo: 'tamanho',
        criadaPor: request.user.id,
        rodada: 1,
        fase: 'votando',
        par: ['gato', 'cavalo'],
        usados: new Set(),
        votos: new Map(),
        // Todo mundo que está na sala começa no placar, com zero: quem não votar aparece, e não some.
        pontos: new Map(quemEstaNaSala(canal.id).map((id) => [id, 0])),
        ate: 0,
        relogio: null,
      };
      partidas.set(canal.id, p);
      novaRodada(p);
      return { partida: estadoPublico(p, nome) };
    });

    authed.post<{ Params: { id: string }; Body: { escolha?: number } }>('/api/channels/:id/minijogo/voto', async (request, reply) => {
      const canal = sala(request.params.id, request.user.id, reply);
      if (!canal) return reply;
      const p = partidas.get(canal.id);
      if (!p || p.fase !== 'votando') return reply.code(409).send({ error: 'Agora não é hora de votar.' });
      if (!estaNaSala(request.user.id, canal.id)) return reply.code(403).send({ error: 'Entre na sala de voz para jogar com a turma.' });
      const escolha = request.body?.escolha;
      if (escolha !== 0 && escolha !== 1) return reply.code(400).send({ error: 'Escolha um dos dois.' });
      p.votos.set(request.user.id, escolha);
      if (!p.pontos.has(request.user.id)) p.pontos.set(request.user.id, 0);
      // Todo mundo da sala votou: revela na hora, sem esperar o relógio.
      if (quemEstaNaSala(canal.id).every((id) => p.votos.has(id))) revelar(p);
      else avisar(p);
      return { partida: estadoPublico(p, nome) };
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
        (p.fase === 'fim' && estaNaSala(request.user.id, canal.id));
      if (!pode) return reply.code(403).send({ error: 'Só quem começou a partida pode encerrá-la antes do fim.' });
      encerrar(p);
      return { ok: true };
    });
  });
}
