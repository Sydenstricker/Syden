/**
 * O quarto de cada pessoa: guardar a própria arrumação e VISITAR a de outra (ver quarto.ts).
 *
 * Quem visita: QUALQUER CONTA (decisão dele, 15/10/2026), menos quando há bloqueio entre as duas, em qualquer sentido.
 * O bloqueio fecha toda porta entre duas pessoas (bloqueio.test.ts), e o quarto mostra o estado de quem mora nele
 * (dormindo, em call). A resposta de quem foi bloqueado é a MESMA de "essa pessoa não arrumou o quarto": quem foi
 * bloqueado não descobre que foi.
 *
 * A visita é por id, nunca por nome: procurar conta pelo nome é a porta de varrer a lista de contas (amigos-routes.ts),
 * e quem visita chega ao quarto a partir de onde já viu a pessoa (o cartão dela). Mesmo assim há um freio, porque os
 * ids são sequenciais e a rota diria quem tem quarto.
 */
import type { FastifyInstance } from 'fastify';
import * as db from './db.js';
import { Freio } from './freio.js';
import { requireUser } from './routes.js';
import { ACEITA_COPIAS, MAX_BYTES, validarArrumacao } from './quarto.js';

/** Sessenta visitas por hora, por conta: folgado para gente, apertado para varrer ids. */
const freioDeVisitas = new Freio(60, 60 * 60_000);

export function registerQuartoRoutes(app: FastifyInstance) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    /** O meu quarto: a arrumação guardada, ou null (ainda não mexeu: a página usa a de fábrica). */
    authed.get('/api/quarto', async (request) => {
      const q = db.lerQuarto(request.user.id);
      return { arrumacao: q ? JSON.parse(q.arrumacao) : null, em: q?.em ?? null, copias: ACEITA_COPIAS };
    });

    authed.put<{ Body: unknown }>('/api/quarto', { bodyLimit: MAX_BYTES * 2 }, async (request, reply) => {
      const v = validarArrumacao(request.body);
      if ('erro' in v) return reply.code(400).send({ error: v.erro });
      const texto = JSON.stringify(v.ok);
      if (texto.length > MAX_BYTES) return reply.code(413).send({ error: 'Arrumação grande demais.' });
      db.guardarQuarto(request.user.id, texto);
      return { ok: true };
    });

    /** A VISITA: o quarto de outra pessoa, como ela deixou. */
    authed.get<{ Params: { id: string } }>('/api/quarto/:id', async (request, reply) => {
      const dono = Number(request.params.id);
      if (!Number.isInteger(dono) || dono <= 0) return reply.code(400).send({ error: 'Pedido inválido.' });
      if (dono !== request.user.id && freioDeVisitas.tentar(String(request.user.id))) {
        return reply.code(429).send({ error: 'Muitas visitas seguidas. Tente de novo daqui a pouco.' });
      }
      const nada = { error: 'Este quarto não está aberto para visita.' };
      const pessoa = db.findUserById(dono);
      if (!pessoa || db.ehContaDoSistema(dono) || db.haBloqueio(request.user.id, dono)) return reply.code(404).send(nada);
      const q = db.lerQuarto(dono);
      if (!q) return reply.code(404).send(nada);
      return { dono: { id: pessoa.id, username: pessoa.username, nomeDeExibicao: pessoa.nomeDeExibicao }, arrumacao: JSON.parse(q.arrumacao), em: q.em };
    });
  });
}
