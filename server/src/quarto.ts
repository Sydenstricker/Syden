/**
 * O QUARTO DE CADA PESSOA: a arrumação dela (decisão dele, 14–15/10/2026: "o quarto é individual", "cada pessoa
 * arruma como quiser", e qualquer conta pode VISITAR).
 *
 * O servidor só guarda POSIÇÕES E CÓDIGOS: qual móvel, em que casa da grade 8 × 8, virado para onde; onde a cadeira
 * parou; o tipo de janela, a parede e quantas casas ela andou. A arte, os tamanhos e o que cada móvel faz moram na
 * página do quarto — acrescentar um móvel ou um tipo de janela é publicar o site, sem tocar no servidor. Por isso os
 * códigos são conferidos pela FORMA (letras, números e hífen), e não por uma lista.
 *
 * Validar aqui não é capricho: o que entra é desenhado na tela de QUEM VISITA. Uma arrumação gigante ou com valores
 * absurdos (NaN, casas fora do quarto) viraria um quarto quebrado, ou travado, na tela de outra pessoa.
 */

/** O quarto é uma grade de 8 × 8 casas. */
const N = 8;
const CODIGO = /^[a-z][a-z0-9-]{0,23}$/;
const MAX_MOVEIS = 40;
/** Folgado para 40 móveis com números longos; o que passa disto não é arrumação. */
export const MAX_BYTES = 8000;

export interface Arrumacao {
  moveis: Record<string, { c: [number, number]; lado: number }>;
  cadeira?: { u: number; v: number; th: number };
  janela?: { tipo: string; parede: 'direita' | 'esquerda'; v: number };
  cortina?: boolean;
  janelaAberta?: boolean;
  vista?: number;
  /** Os objetos da parede (quadro, fone, prateleira…): a parede, quantas casas andaram nela e quantos px subiram. */
  parede?: Record<string, { parede: 'direita' | 'esquerda'; v: number; h: number }>;
}

const numero = (x: unknown, min: number, max: number): number | null =>
  typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max ? Math.round(x * 1000) / 1000 : null;

/** Devolve a arrumação limpa (só os campos conhecidos), ou o motivo da recusa. */
export function validarArrumacao(x: unknown): { ok: Arrumacao } | { erro: string } {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return { erro: 'Arrumação inválida.' };
  const a = x as Record<string, unknown>;
  const m = a.moveis;
  if (!m || typeof m !== 'object' || Array.isArray(m)) return { erro: 'Arrumação sem os móveis.' };
  const ids = Object.keys(m);
  if (ids.length > MAX_MOVEIS) return { erro: 'Móveis demais.' };
  const moveis: Arrumacao['moveis'] = {};
  for (const id of ids) {
    const it = (m as Record<string, unknown>)[id] as { c?: unknown; lado?: unknown } | null;
    if (!CODIGO.test(id) || !it || typeof it !== 'object' || !Array.isArray(it.c) || it.c.length !== 2) return { erro: 'Móvel inválido.' };
    const u = numero(it.c[0], 0, N), v = numero(it.c[1], 0, N);
    if (u === null || v === null || !Number.isInteger(it.lado) || (it.lado as number) < 0 || (it.lado as number) > 3) return { erro: 'Móvel fora do quarto.' };
    moveis[id] = { c: [u, v], lado: it.lado as number };
  }
  const saida: Arrumacao = { moveis };
  if (a.cadeira !== undefined) {
    const c = a.cadeira as { u?: unknown; v?: unknown; th?: unknown } | null;
    const u = numero(c?.u, 0, N), v = numero(c?.v, 0, N), th = numero(c?.th, -1e6, 1e6);
    if (u === null || v === null || th === null) return { erro: 'Cadeira fora do quarto.' };
    // O ângulo volta para uma volta só: girar muito não pode virar um número sem fim.
    saida.cadeira = { u, v, th: Math.round(((th % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) * 1000) / 1000 };
  }
  if (a.janela !== undefined) {
    const j = a.janela as { tipo?: unknown; parede?: unknown; v?: unknown } | null;
    const v = numero(j?.v, -N, N);
    if (typeof j?.tipo !== 'string' || !CODIGO.test(j.tipo) || (j.parede !== 'direita' && j.parede !== 'esquerda') || v === null) return { erro: 'Janela inválida.' };
    saida.janela = { tipo: j.tipo, parede: j.parede, v };
  }
  for (const k of ['cortina', 'janelaAberta'] as const) {
    if (a[k] === undefined) continue;
    if (typeof a[k] !== 'boolean') return { erro: 'Arrumação inválida.' };
    saida[k] = a[k] as boolean;
  }
  if (a.parede !== undefined) {
    const p = a.parede;
    if (!p || typeof p !== 'object' || Array.isArray(p) || Object.keys(p).length > MAX_MOVEIS) return { erro: 'Objetos da parede inválidos.' };
    saida.parede = {};
    for (const [id, q] of Object.entries(p as Record<string, { parede?: unknown; v?: unknown; h?: unknown } | null>)) {
      const v = numero(q?.v, -N, N), h = numero(q?.h, -300, 300);
      if (!CODIGO.test(id) || (q?.parede !== 'direita' && q?.parede !== 'esquerda') || v === null || h === null) return { erro: 'Objeto da parede inválido.' };
      saida.parede[id] = { parede: q.parede, v, h };
    }
  }
  if (a.vista !== undefined) {
    if (!Number.isInteger(a.vista) || (a.vista as number) < 0 || (a.vista as number) > 15) return { erro: 'Vista inválida.' };
    saida.vista = a.vista as number;
  }
  return { ok: saida };
}
