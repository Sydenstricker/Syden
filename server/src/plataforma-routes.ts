/**
 * O Pulo do coelho: os recordes e os fantasmas do contra o relógio (ver plataforma.ts). A mesma regra da corrida de kart
 * (corrida-routes.ts): o recorde e o fantasma de alguém, só a própria pessoa e os AMIGOS ACEITOS veem — o fantasma é o
 * caminho que alguém fez, e o tempo diz quando a pessoa jogou.
 */
import type { FastifyInstance } from 'fastify';
import * as db from './db.js';
import { Freio } from './freio.js';
import { FASES_DO_PULO, validarPulo } from './plataforma.js';
import { requireUser } from './routes.js';

/** Sessenta fases guardadas por hora, por conta (uma fase leva mais de 30 s). */
const freioDePulos = new Freio(60, 60 * 60_000);

export function registerPlataformaRoutes(app: FastifyInstance) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    authed.get<{ Params: { fase: string } }>('/api/plataforma/:fase', async (request, reply) => {
      const { fase } = request.params;
      if (!FASES_DO_PULO[fase]) return reply.code(404).send({ error: 'Fase desconhecida.' });
      return { recordes: db.recordesDoPulo(request.user.id, fase) };
    });

    /** O fantasma de alguém: o meu, ou o de um amigo aceito. */
    authed.get<{ Params: { fase: string; id: string } }>('/api/plataforma/:fase/fantasma/:id', async (request, reply) => {
      const { fase } = request.params;
      const dono = Number(request.params.id);
      const nada = { error: 'Fantasma não encontrado.' };
      if (!FASES_DO_PULO[fase] || !Number.isInteger(dono) || dono <= 0) return reply.code(404).send(nada);
      if (dono !== request.user.id) {
        const amizade = db.amizadeEntre(request.user.id, dono);
        if (amizade?.situacao !== 'aceita' || db.haBloqueio(request.user.id, dono)) return reply.code(404).send(nada);
      }
      const r = db.recordeDoPulo(dono, fase);
      if (!r) return reply.code(404).send(nada);
      return { tempoMs: r.tempoMs, amostras: JSON.parse(r.amostras) as number[] };
    });

    authed.post<{ Params: { fase: string }; Body: unknown }>('/api/plataforma/:fase', { bodyLimit: 200_000 }, async (request, reply) => {
      if (freioDePulos.tentar(String(request.user.id))) {
        return reply.code(429).send({ error: 'Muitas corridas seguidas. Tente de novo daqui a pouco.' });
      }
      const v = validarPulo(request.params.fase, request.body);
      if ('erro' in v) return reply.code(400).send({ error: v.erro });
      db.registrarPulo(request.user.id, v.ok.tempoMs);
      const r = db.guardarPulo(request.user.id, request.params.fase, v.ok.tempoMs, JSON.stringify(v.ok.amostras));
      return { tempoMs: v.ok.tempoMs, ...r };
    });
  });
}
