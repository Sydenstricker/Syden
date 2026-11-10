/**
 * O quarto de cada pessoa: guardar a própria arrumação e VISITAR a de outra (ver quarto.ts).
 *
 * Quem visita: desde 03/11/2026, quem o DONO deixa (público, amigos ou privado com convidados; podeVisitarQuarto, em
 * trofeus-routes.ts). Era qualquer conta (15/10/2026) até a estante de troféus mostrar a quem visita contra quem a pessoa
 * jogou. O bloqueio fecha a porta em qualquer modo, e a resposta é a MESMA de "não está aberto": quem foi bloqueado não
 * descobre que foi. Quem pode entrar num quarto que nunca foi arrumado vê o de fábrica (arrumacao: null).
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
import { podeVisitarQuarto } from './trofeus-routes.js';

/** Sessenta visitas por hora, por conta: folgado para gente, apertado para varrer ids. */
const freioDeVisitas = new Freio(60, 60 * 60_000);

export function registerQuartoRoutes(app: FastifyInstance) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    /**
     * O meu quarto: a arrumação guardada, ou null (ainda não mexeu: a página usa a de fábrica). E o MEU COELHO (10/11/2026, o
     * coelho de cada um na cena): a receita do criador e o coelho pronto, que o app lê (coelho/receita.ts, receitaDe) e a
     * página desenha.
     */
    authed.get('/api/quarto', async (request) => {
      const q = db.lerQuarto(request.user.id);
      const eu = db.findUserById(request.user.id);
      return { arrumacao: q ? JSON.parse(q.arrumacao) : null, em: q?.em ?? null, copias: ACEITA_COPIAS, coelho: eu?.coelho ?? null, avatarPronto: eu?.avatarPronto ?? null };
    });

    authed.put<{ Body: unknown }>('/api/quarto', { bodyLimit: MAX_BYTES * 2 }, async (request, reply) => {
      const v = validarArrumacao(request.body);
      if ('erro' in v) return reply.code(400).send({ error: v.erro });
      const texto = JSON.stringify(v.ok);
      if (texto.length > MAX_BYTES) return reply.code(413).send({ error: 'Arrumação grande demais.' });
      db.guardarQuarto(request.user.id, texto);
      return { ok: true };
    });

    /**
     * O BICHO DO QUARTO, pelo Guarda-roupa do app (09/11/2026): qual bicho (cores.pet: 'gato', 'nenhum'…) e o nome dele,
     * sem precisar da arrumação inteira — o resto do quarto fica como está (ou de fábrica, se nunca foi arrumado).
     */
    authed.put<{ Body: { pet?: unknown; nome?: unknown } }>('/api/quarto/pet', async (request, reply) => {
      const { pet, nome } = request.body ?? {};
      const q = db.lerQuarto(request.user.id);
      const atual = q ? (JSON.parse(q.arrumacao) as Record<string, unknown>) : { moveis: {} };
      const cores = { ...((atual.cores as Record<string, string> | undefined) ?? {}) };
      if (pet !== undefined) cores.pet = pet as string;
      const nova: Record<string, unknown> = { ...atual, cores };
      if (nome !== undefined) nova.nomeDoPet = nome;
      const v = validarArrumacao(nova);
      if ('erro' in v) return reply.code(400).send({ error: v.erro });
      const texto = JSON.stringify(v.ok);
      if (texto.length > MAX_BYTES) return reply.code(413).send({ error: 'Arrumação grande demais.' });
      db.guardarQuarto(request.user.id, texto);
      return { pet: v.ok.cores?.pet ?? 'gato', nome: v.ok.nomeDoPet ?? '' };
    });

    /** A VISITA: o quarto de outra pessoa, como ela deixou (com o coelho dela, que é quem aparece lá). */
    authed.get<{ Params: { id: string } }>('/api/quarto/:id', async (request, reply) => {
      const dono = Number(request.params.id);
      if (!Number.isInteger(dono) || dono <= 0) return reply.code(400).send({ error: 'Pedido inválido.' });
      if (dono !== request.user.id && freioDeVisitas.tentar(String(request.user.id))) {
        return reply.code(429).send({ error: 'Muitas visitas seguidas. Tente de novo daqui a pouco.' });
      }
      const nada = { error: 'Este quarto não está aberto para visita.' };
      if (!podeVisitarQuarto(request.user.id, dono)) return reply.code(404).send(nada);
      const pessoa = db.findUserById(dono)!;
      const q = db.lerQuarto(dono);
      return { dono: { id: pessoa.id, username: pessoa.username, nomeDeExibicao: pessoa.nomeDeExibicao, coelho: pessoa.coelho ?? null, avatarPronto: pessoa.avatarPronto ?? null }, arrumacao: q ? JSON.parse(q.arrumacao) : null, em: q?.em ?? null };
    });
  });
}
