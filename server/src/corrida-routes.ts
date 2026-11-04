/**
 * A Corrida dos coelhos: os recordes e os fantasmas (ver corrida.ts).
 *
 * QUEM VÊ O RECORDE E O FANTASMA DE QUEM: a própria pessoa e os AMIGOS ACEITOS. Não a comunidade inteira: o fantasma é o
 * caminho que alguém fez, e o tempo diz quando a pessoa jogou; amizade é a relação em que as duas partes disseram sim, e
 * é a mesma regra que vale para o adolescente (protecao.ts: só amigos). O bloqueio desfaz a amizade, então quem bloqueou
 * some da lista de quem foi bloqueado.
 */
import type { FastifyInstance } from 'fastify';
import * as db from './db.js';
import { PISTAS, validarCorrida } from './corrida.js';
import { Freio } from './freio.js';
import { requireUser } from './routes.js';

/** Sessenta corridas guardadas por hora, por conta: uma corrida leva ~1 min, e quem treina seguido não esbarra nisto
 * (revisão independente, 03/11/2026: eram 30). */
const freioDeCorridas = new Freio(60, 60 * 60_000);

export function registerCorridaRoutes(app: FastifyInstance) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    /** Os MEUS troféus (o quarto mostra): o pódio das corridas e das copas na sala, com contra quem foi. */
    authed.get('/api/corrida-trofeus', async (request) => ({ trofeus: db.trofeusDe(request.user.id) }));

    authed.get<{ Params: { pista: string } }>('/api/corrida/:pista', async (request, reply) => {
      const { pista } = request.params;
      if (!PISTAS[pista]) return reply.code(404).send({ error: 'Pista desconhecida.' });
      return { recordes: db.recordesDaCorrida(request.user.id, pista), meuAvatar: db.findUserById(request.user.id)?.avatarPronto ?? null };
    });

    /** O fantasma de alguém: o meu, ou o de um amigo aceito. */
    authed.get<{ Params: { pista: string; id: string } }>('/api/corrida/:pista/fantasma/:id', async (request, reply) => {
      const { pista } = request.params;
      const dono = Number(request.params.id);
      const nada = { error: 'Fantasma não encontrado.' };
      if (!PISTAS[pista] || !Number.isInteger(dono) || dono <= 0) return reply.code(404).send(nada);
      if (dono !== request.user.id) {
        const amizade = db.amizadeEntre(request.user.id, dono);
        if (amizade?.situacao !== 'aceita' || db.haBloqueio(request.user.id, dono)) return reply.code(404).send(nada);
      }
      const r = db.recordeDaCorrida(dono, pista);
      if (!r) return reply.code(404).send(nada);
      return { tempoMs: r.tempoMs, amostras: JSON.parse(r.amostras) as number[] };
    });

    authed.post<{ Params: { pista: string }; Body: unknown }>('/api/corrida/:pista', { bodyLimit: 400_000 }, async (request, reply) => {
      if (freioDeCorridas.tentar(String(request.user.id))) {
        return reply.code(429).send({ error: 'Muitas corridas seguidas. Tente de novo daqui a pouco.' });
      }
      const v = validarCorrida(request.params.pista, request.body);
      if ('erro' in v) return reply.code(400).send({ error: v.erro });
      db.registrarCorrida(request.user.id, v.ok.tempoMs);
      const r = db.guardarCorrida(request.user.id, request.params.pista, v.ok.tempoMs, v.ok.voltas, JSON.stringify(v.ok.amostras));
      return { tempoMs: v.ok.tempoMs, ...r };
    });
  });
}
