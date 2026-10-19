import type { FastifyInstance } from 'fastify';
import * as db from './db.js';
import { requireUser } from './routes.js';

/**
 * OS IDIOMAS DA PESSOA (19/10/2026): "idiomas falados" e "idiomas em estudo", no cartão de perfil.
 *
 * É o passo 4 de "Aprender idiomas dentro do Syden" (CLAUDE.md): o jeito mais barato de descobrir se alguém quer, antes
 * de construir qualquer coisa. Usa o que já existe, não licencia nada, e cria o encontro de mão dupla (quem fala um
 * acha quem estuda o outro). Opcional; vazio, o cartão não mostra nada.
 *
 * - Os códigos são os da lista de idiomas do site (pt-BR, en, ja…). O servidor confere só o FORMATO, porque a lista
 *   mora no site; código que o site não conhece não aparece na tela.
 * - Ver: quem está logado, menos com bloqueio em qualquer sentido (aí a resposta é a de quem não informou).
 */
export const IDIOMAS_POR_LISTA = 6;
const CODIGO = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;

export function lerIdiomas(corpo: unknown): { falados: string[]; estudo: string[] } | { erro: string } {
  const c = corpo as { falados?: unknown; estudo?: unknown } | null;
  const lista = (v: unknown) => (Array.isArray(v) ? v : v === undefined ? [] : null);
  const falados = lista(c?.falados), estudo = lista(c?.estudo);
  if (!falados || !estudo) return { erro: 'Lista inválida.' };
  for (const l of [falados, estudo]) {
    if (l.length > IDIOMAS_POR_LISTA) return { erro: `No máximo ${IDIOMAS_POR_LISTA} idiomas em cada lista.` };
    if (!l.every((x) => typeof x === 'string' && CODIGO.test(x))) return { erro: 'Idioma desconhecido.' };
    if (new Set(l).size !== l.length) return { erro: 'O mesmo idioma duas vezes.' };
  }
  // quem fala não estuda: o mesmo idioma nas duas listas é engano de clique
  if (falados.some((x) => estudo.includes(x))) return { erro: 'Um idioma fica numa lista só.' };
  return { falados: falados as string[], estudo: estudo as string[] };
}

export function registerIdiomasRoutes(app: FastifyInstance) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    authed.get<{ Params: { id: string } }>('/api/users/:id/idiomas', async (request) => {
      const id = Number(request.params.id);
      if (!Number.isInteger(id) || (id !== request.user.id && db.haBloqueio(id, request.user.id))) return { falados: [], estudo: [] };
      return db.idiomasDe(id);
    });

    authed.get('/api/me/idiomas', async (request) => db.idiomasDe(request.user.id));

    authed.put('/api/me/idiomas', async (request, reply) => {
      const lido = lerIdiomas(request.body);
      if ('erro' in lido) return reply.code(400).send({ error: lido.erro });
      db.definirIdiomas(request.user.id, lido);
      return lido;
    });
  });
}
