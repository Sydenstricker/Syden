/**
 * A PONTE DO RIACHO, A REGRA (05/11/2026): as pedras que afundam e voltam, e o passo do coelho. DUAS CÓPIAS IGUAIS BYTE A BYTE:
 * server/src/festa/ponteriacho-sim.ts e web/src/festa/ponteriacho-sim.ts (o teste do servidor confere). O site anda com ela, e
 * o servidor refaz cada passo com ela: o que conta são as tábuas que o servidor viu chegar. Só inteiros, + − × ÷ e %.
 *
 * O riacho é uma grade: a margem da esquerda (x = 0, onde estão as tábuas), LARGURA colunas de pedras e a margem da direita
 * (x = LARGURA + 1, onde está a ponte quebrada). Cada pedra é firme ou afunda e volta num ciclo próprio. Pisar numa pedra
 * afundada, ou estar numa quando ela afunda, é cair na água: o coelho volta à margem das tábuas, e a tábua que levava volta à
 * pilha.
 */

export const LARGURA = 5;
export const LINHAS = 5;
/** Quantas tábuas consertam a ponte. */
export const CARGA = 3;
/** Quanto dura o jogo (ms). */
export const PONTE_MS = 30000;
/** Quanto antes de afundar a pedra treme (só o desenho; a regra não muda). */
export const AVISO_MS = 600;
/** Um passo depois do outro, no mínimo isto (quem aperta muito rápido; mais que isso é atravessar de uma vez pelo console). */
export const PASSO_MINIMO_MS = 100;

/** Uma pedra: p = 0 é firme; senão o ciclo (p ms), a fase (f) e quanto do ciclo ela fica de pé (s). */
export interface Pedra {
  p: number;
  f: number;
  s: number;
}

export interface Riacho {
  /** As pedras, linha a linha: a da coluna x (1..LARGURA) e linha y é pedras[y * LARGURA + x - 1]. */
  pedras: Pedra[];
}

export interface Coelho {
  x: number;
  y: number;
  tabua: boolean;
  entregues: number;
  /** O instante (ms desde o começo) do último passo, ou da queda. */
  t: number;
  quedas: number;
  /** O instante da última entrega (0 se nenhuma). */
  ultima: number;
}

export const inicial = (): Coelho => ({ x: 0, y: Math.floor(LINHAS / 2), tabua: true, entregues: 0, t: 0, quedas: 0, ultima: 0 });

export const pedraEm = (r: Riacho, x: number, y: number): Pedra | null =>
  x >= 1 && x <= LARGURA && y >= 0 && y < LINHAS ? r.pedras[y * LARGURA + x - 1] : null;

/** A pedra está de pé no instante t? As margens sempre. */
export function dePe(r: Riacho, x: number, y: number, t: number): boolean {
  const p = pedraEm(r, x, y);
  if (!p || p.p === 0) return true;
  return (t + p.f) % p.p < p.s;
}

/** Quando a pedra afunda de novo, a partir de t (estando de pé em t). Firme ou margem: nunca. */
export function afundaEm(r: Riacho, x: number, y: number, t: number): number {
  const p = pedraEm(r, x, y);
  if (!p || p.p === 0) return Infinity;
  const fase = (t + p.f) % p.p;
  return fase < p.s ? t + (p.s - fase) : t;
}

/** Na margem das tábuas, pega uma (se ainda falta alguma); na da ponte, entrega a que leva. */
function chegar(c: Coelho): Coelho {
  if (c.x === 0 && !c.tabua && c.entregues < CARGA) return { ...c, tabua: true };
  if (c.x === LARGURA + 1 && c.tabua) {
    return { ...c, tabua: false, entregues: c.entregues + 1, ultima: c.t };
  }
  return c;
}

/** Caiu na água em t: volta à margem das tábuas, na mesma linha, e a tábua que levava volta à pilha. */
const cair = (c: Coelho, t: number): Coelho => chegar({ ...c, x: 0, tabua: false, t, quedas: c.quedas + 1 });

/** Até t, a pedra onde o coelho está afundou? Então ele caiu naquela hora. */
export function ate(r: Riacho, c: Coelho, t: number): Coelho {
  const quando = afundaEm(r, c.x, c.y, c.t);
  return quando <= t ? cair(c, quando) : c;
}

/**
 * Um passo para a casa (x, y) no instante t. null se não vale (não é vizinha, veio depressa demais depois do anterior, fora da grade, ou o
 * conserto já acabou). Pisar numa pedra afundada é cair.
 */
export function passo(r: Riacho, c0: Coelho, x: number, y: number, t: number): Coelho | null {
  if (t < c0.t + PASSO_MINIMO_MS || t > PONTE_MS || c0.entregues >= CARGA) return null;
  if (x < 0 || x > LARGURA + 1 || y < 0 || y >= LINHAS) return null;
  const c = ate(r, c0, t);
  if (Math.abs(x - c.x) + Math.abs(y - c.y) !== 1) return null;
  const novo: Coelho = { ...c, x, y, t };
  return dePe(r, x, y, t) ? chegar(novo) : cair(novo, t);
}

/** As pedras do riacho, de um sorteio (números de 0 a 1). Uma em cada quatro, mais ou menos, é firme. */
export function riacho(aleatorio: () => number): Riacho {
  const pedras: Pedra[] = [];
  for (let i = 0; i < LARGURA * LINHAS; i++) {
    if (aleatorio() < 0.25) {
      pedras.push({ p: 0, f: 0, s: 0 });
      continue;
    }
    const p = 2200 + 200 * Math.floor(aleatorio() * 8);
    pedras.push({ p, f: Math.floor(aleatorio() * p), s: Math.floor((p * 3) / 5) });
  }
  return { pedras };
}
