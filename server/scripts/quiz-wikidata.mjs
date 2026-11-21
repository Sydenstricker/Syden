// OS NOMES DOS QUIZZES, DO WIKIDATA (21/11/2026): o que os temas novos (elementos, dinossauros, estados do Brasil, animais)
// têm em comum com a mitologia (quiz-mitologia.mjs). A lista e as colunas de cada tema são NOSSAS, escritas no script dele;
// daqui vem só o NOME em cada idioma do Syden (o Wikidata é CC0: copia-se sem pedir nem creditar) e, quando o tema pede,
// os números que o Wikidata guarda (a população e a área dos estados).
//
// Não é um script para rodar sozinho: os quiz-<tema>.mjs o importam.
import { readFileSync } from 'node:fs';

// Os idiomas do Syden (web/src/i18n/idiomas.ts) e o código de cada um no Wikidata.
const fonte = readFileSync(new URL('../../web/src/i18n/idiomas.ts', import.meta.url), 'utf8');
export const IDIOMAS = [...fonte.matchAll(/codigo: '([^']+)'/g)].map((m) => m[1]);
// O "mul" só vale para as línguas de escrita latina: em grego ou japonês, o nome em letra latina seria pior que a reserva.
const ESCRITA = Object.fromEntries([...fonte.matchAll(/codigo: '([^']+)'[^}]*?escrita: '([^']+)'/g)].map((m) => [m[1], m[2]]));
const NO_WIKIDATA = { 'pt-BR': ['pt-br', 'pt'], 'zh-CN': ['zh-hans', 'zh-cn', 'zh'], no: ['nb', 'no'], cnr: ['sh', 'sr-el', 'hr'], tet: ['tet'] };

const AGENTE = { headers: { 'user-agent': 'Syden (syden.chat) quiz' } };
/** Pede e lê o JSON; se a API pedir calma ("too many requests"), espera e tenta de novo. */
export async function pedir(url) {
  for (let tentativa = 1; ; tentativa++) {
    const r = await fetch(url, AGENTE);
    const texto = await r.text();
    if (r.ok && texto.startsWith('{')) return JSON.parse(texto);
    if (tentativa >= 6) throw new Error(`${r.status}: ${texto.slice(0, 120)}`);
    await new Promise((pronto) => setTimeout(pronto, 15_000 * tentativa));
  }
}

/** O item do Wikidata de cada artigo da Wikipédia em inglês (seguindo os redirecionamentos). Map título → Q-id. */
export async function qidsDaWikipedia(titulos) {
  const saida = new Map();
  for (let i = 0; i < titulos.length; i += 40) {
    const lote = titulos.slice(i, i + 40);
    const wp = await pedir(
      `https://en.wikipedia.org/w/api.php?action=query&format=json&redirects=1&prop=pageprops&ppprop=wikibase_item&titles=${encodeURIComponent(lote.join('|'))}`,
    );
    const destino = new Map(lote.map((t) => [t, t]));
    for (const { from, to } of [...(wp.query.normalized ?? []), ...(wp.query.redirects ?? [])]) {
      for (const [titulo, atual] of destino) if (atual === from) destino.set(titulo, to);
    }
    const qid = new Map(Object.values(wp.query.pages).map((p) => [p.title, p.pageprops?.wikibase_item]));
    const faltando = [];
    for (const t of lote) {
      const q = qid.get(destino.get(t));
      if (q) saida.set(t, q);
      else faltando.push(t);
    }
    if (faltando.length) throw new Error(`a Wikipédia não achou: ${faltando.join(', ')}`);
  }
  return saida;
}

/** As entidades do Wikidata (os rótulos, as descrições e as afirmações), de 40 em 40. Map Q-id → entidade. */
export async function entidades(ids) {
  const saida = new Map();
  for (let i = 0; i < ids.length; i += 40) {
    const lote = ids.slice(i, i + 40);
    const { entities } = await pedir(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=labels|descriptions|claims&ids=${lote.join('|')}`);
    for (const id of lote) saida.set(id, entities[id]);
  }
  return saida;
}

/**
 * O nome de uma entidade em cada idioma do Syden: o rótulo do idioma, o "mul" (multilíngue) nas escritas latinas, e o inglês
 * de reserva. O Wikidata escreve o nome comum em minúscula ("leão"); na lista do quiz ele começa com maiúscula.
 */
export function nomesDe(e) {
  const nome = {};
  for (const idioma of IDIOMAS) {
    for (const codigo of NO_WIKIDATA[idioma] ?? [idioma.toLowerCase()]) {
      if (e.labels[codigo]) {
        nome[idioma] = e.labels[codigo].value;
        break;
      }
    }
  }
  for (const idioma of IDIOMAS) if (!nome[idioma] && e.labels.mul && ESCRITA[idioma] === 'latina') nome[idioma] = e.labels.mul.value;
  nome.en ??= e.labels.mul?.value;
  for (const [idioma, texto] of Object.entries(nome)) {
    let maiuscula;
    try {
      maiuscula = texto.charAt(0).toLocaleUpperCase(idioma);
    } catch {
      maiuscula = texto.charAt(0).toUpperCase();
    }
    nome[idioma] = maiuscula + texto.slice(1);
  }
  if (!nome.en) throw new Error(`sem nome em inglês: ${e.id}`);
  return nome;
}

/** Os códigos de um idioma do Syden no Wikidata, na ordem de preferência. */
export const codigosNoWikidata = (idioma) => NO_WIKIDATA[idioma] ?? [idioma.toLowerCase()];

/** O valor mais recente de uma afirmação numérica (a população: a do último censo, pelo qualificador "data", P585). */
export function numeroMaisRecente(e, propriedade) {
  const valores = (e.claims[propriedade] ?? [])
    .filter((c) => c.rank !== 'deprecated' && c.mainsnak.datavalue)
    .map((c) => ({
      valor: Number(c.mainsnak.datavalue.value.amount),
      data: c.qualifiers?.P585?.[0]?.datavalue?.value?.time ?? '',
      preferido: c.rank === 'preferred',
    }));
  if (!valores.length) return null;
  valores.sort((a, b) => Number(b.preferido) - Number(a.preferido) || b.data.localeCompare(a.data));
  return valores[0].valor;
}

/** Grava a lista como o quiz-mitologia: um item por linha. */
export const jsonDoQuiz = (itens) => `${JSON.stringify(itens).replace(/\},\{"id"/g, '},\n{"id"')}\n`;
