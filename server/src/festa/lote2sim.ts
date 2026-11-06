/**
 * AS CONTAS DO LOTE 2 DA FESTA (05/11/2026): o que a tela faz e o servidor REFAZ, para o resultado ser dele. DUAS CÓPIAS IGUAIS
 * BYTE A BYTE, server/src/festa/lote2sim.ts e web/src/festa/lote2sim.ts (server/test/festa-regar.test.ts confere). Sem import.
 *
 * Só + − × ÷, Math.sqrt, floor, min, max e abs: o mesmo número em qualquer navegador e no Node. Nada de seno nem cosseno.
 *
 * - regar (Regar a horta) e galinha (Pegue a galinha): passos fixos de PASSO_MS, e o que a pessoa faz é uma lista de ENTRADAS
 *   (o passo em que a direção mudou e a direção nova). O servidor recebe cada mudança na hora e roda a mesma simulação.
 * - rio (Fuga do rio): as braçadas e os mergulhos, cada um com o instante dele; a distância do peixe é refeita no servidor.
 * - cipo (De galho em galho): cada soltura com o instante dela; o balanço do cipó é uma conta só de + − ×.
 */

/** O passo das simulações (25 por segundo). */
export const PASSO_MS = 40;
const DT = PASSO_MS / 1000;
const DIAGONAL = 0.7071067811865476;

/** Uma mudança de direção: o passo em que vale, e a direção (−1, 0 ou 1 em cada eixo). */
export type Entrada = [number, number, number];

/** A direção em vigor no passo `n` (a última entrada com passo ≤ n), andando o ponteiro `j` do estado. */
function lerEntrada(s: { n: number; j: number }, e: Entrada[]): [number, number] {
  while (s.j < e.length && e[s.j][0] <= s.n) s.j++;
  if (s.j === 0) return [0, 0];
  const dx = e[s.j - 1][1];
  const dy = e[s.j - 1][2];
  return dx !== 0 && dy !== 0 ? [dx * DIAGONAL, dy * DIAGONAL] : [dx, dy];
}

const entre = (v: number, min: number, max: number) => (v < min ? min : v > max ? max : v);

// ================================================ REGAR A HORTA ================================================

export const REGAR_MS = 22000;
export const REGAR_PASSOS = REGAR_MS / PASSO_MS;
/** Os cinco canteiros (o do meio é onde a nuvem começa). */
export const CANTEIROS: [number, number][] = [
  [62, 58],
  [238, 58],
  [150, 104],
  [62, 150],
  [238, 150],
];
/** Cada canteiro fica com sede por este tempo, e a sede passa para outro. */
export const SEDE_MS = 3200;
/** O vento muda a cada rajada. */
export const RAJADA_MS = 1600;
export const RAIO_DA_CHUVA = 24;
const NUVEM_ACEL = 300;
const NUVEM_VENTO = 140;
const NUVEM_ATRITO = 0.9;

export interface DadosRegar {
  /** O canteiro com sede em cada trecho de SEDE_MS. */
  sede: number[];
  /** O vento de cada rajada (de −1 a 1 em cada eixo). */
  ventos: [number, number][];
}
export interface Nuvem {
  n: number;
  j: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Os passos com a chuva em cima do canteiro com sede. */
  agua: number;
}
export const nuvemInicial = (): Nuvem => ({ n: 0, j: 0, x: 150, y: 104, vx: 0, vy: 0, agua: 0 });
export const sedeEm = (d: DadosRegar, n: number) => d.sede[Math.min(d.sede.length - 1, Math.floor((n * PASSO_MS) / SEDE_MS))];

/** Um passo da nuvem: a pessoa sopra, o vento empurra, o atrito freia; chovendo no canteiro com sede, conta água. */
export function passoDaNuvem(s: Nuvem, d: DadosRegar, e: Entrada[]): void {
  const [dx, dy] = lerEntrada(s, e);
  const v = d.ventos[Math.min(d.ventos.length - 1, Math.floor((s.n * PASSO_MS) / RAJADA_MS))];
  s.vx = (s.vx + (dx * NUVEM_ACEL + v[0] * NUVEM_VENTO) * DT) * NUVEM_ATRITO;
  s.vy = (s.vy + (dy * NUVEM_ACEL + v[1] * NUVEM_VENTO) * DT) * NUVEM_ATRITO;
  s.x += s.vx * DT;
  s.y += s.vy * DT;
  if (s.x < 22 || s.x > 278) {
    s.x = entre(s.x, 22, 278);
    s.vx = 0;
  }
  if (s.y < 22 || s.y > 178) {
    s.y = entre(s.y, 22, 178);
    s.vy = 0;
  }
  const c = CANTEIROS[sedeEm(d, s.n)];
  const ax = s.x - c[0];
  const ay = s.y - c[1];
  if (ax * ax + ay * ay <= RAIO_DA_CHUVA * RAIO_DA_CHUVA) s.agua++;
  s.n++;
}

/** A partida inteira de regar, até `ate` passos. */
export function regar(d: DadosRegar, e: Entrada[], ate = REGAR_PASSOS): Nuvem {
  const s = nuvemInicial();
  while (s.n < ate) passoDaNuvem(s, d, e);
  return s;
}

// ================================================ PEGUE A GALINHA ================================================

export const GALINHA_MS = 20000;
export const GALINHA_PASSOS = GALINHA_MS / PASSO_MS;
/** O cercado. */
export const CERCA = { x0: 16, x1: 284, y0: 18, y1: 184 };
/** Por passo. */
export const COELHO_VEL = 3.8;
const GALINHA_CORRE = 5.0;
const GALINHA_CANSADA = 1.3;
const GALINHA_PASSEIA = 0.7;
/** De perto assim, ela se assusta e corre. */
export const ALERTA = 78;
/** De perto assim, foi pega. */
export const PEGA = 15;
/** Quantos passos ela aguenta correr, e quantos descansa depois. */
export const FOLEGO = 34;
export const DESCANSO = 20;

export interface DadosGalinha {
  /** Onde cada galinha nova aparece (a primeira, e depois de cada uma pega). */
  surgir: [number, number][];
  /** Para que lado cada uma desvia ao fugir (1 ou −1). */
  lado: number[];
  /** Os pontos por onde ela passeia quando está calma (um a cada 2 s). */
  passeio: [number, number][];
}
export interface Cercado {
  n: number;
  j: number;
  /** O coelho. */
  cx: number;
  cy: number;
  /** A galinha. */
  gx: number;
  gy: number;
  folego: number;
  cansada: number;
  /** Quantas pegou, e o passo da última. */
  k: number;
  ultimo: number;
}
export const cercadoInicial = (d: DadosGalinha): Cercado => ({
  n: 0,
  j: 0,
  cx: 150,
  cy: 160,
  gx: d.surgir[0][0],
  gy: d.surgir[0][1],
  folego: FOLEGO,
  cansada: 0,
  k: 0,
  ultimo: 0,
});

/** Um passo do cercado: o coelho anda, e a galinha foge (ou cansa, ou passeia). */
export function passoDoCercado(s: Cercado, d: DadosGalinha, e: Entrada[]): void {
  const [dx, dy] = lerEntrada(s, e);
  s.cx = entre(s.cx + dx * COELHO_VEL, CERCA.x0, CERCA.x1);
  s.cy = entre(s.cy + dy * COELHO_VEL, CERCA.y0, CERCA.y1);
  let ax = s.gx - s.cx;
  let ay = s.gy - s.cy;
  const d2 = ax * ax + ay * ay;
  if (d2 < PEGA * PEGA) {
    s.k++;
    s.ultimo = s.n;
    const p = d.surgir[s.k % d.surgir.length];
    s.gx = p[0];
    s.gy = p[1];
    s.folego = FOLEGO;
    s.cansada = 0;
    s.n++;
    return;
  }
  let vel = 0;
  if (s.cansada > 0) {
    s.cansada--;
    vel = GALINHA_CANSADA;
  } else if (d2 < ALERTA * ALERTA) {
    vel = GALINHA_CORRE;
    s.folego--;
    if (s.folego <= 0) {
      s.cansada = DESCANSO;
      s.folego = FOLEGO;
    }
  } else {
    s.folego = Math.min(FOLEGO, s.folego + 1);
  }
  if (vel > 0) {
    const dist = Math.sqrt(d2) || 1;
    ax /= dist;
    ay /= dist;
    // foge para longe do coelho, desviando para o lado dela
    const lado = d.lado[s.k % d.lado.length];
    let fx = ax - lado * ay * 0.55;
    let fy = ay + lado * ax * 0.55;
    const f = Math.sqrt(fx * fx + fy * fy) || 1;
    fx /= f;
    fy /= f;
    s.gx += fx * vel;
    s.gy += fy * vel;
  } else {
    const alvo = d.passeio[Math.floor((s.n * PASSO_MS) / 2000) % d.passeio.length];
    const px = alvo[0] - s.gx;
    const py = alvo[1] - s.gy;
    const dist = Math.sqrt(px * px + py * py);
    if (dist > 2) {
      s.gx += (px / dist) * GALINHA_PASSEIA;
      s.gy += (py / dist) * GALINHA_PASSEIA;
    }
  }
  s.gx = entre(s.gx, CERCA.x0, CERCA.x1);
  s.gy = entre(s.gy, CERCA.y0, CERCA.y1);
  s.n++;
}

export function galinha(d: DadosGalinha, e: Entrada[], ate = GALINHA_PASSOS): Cercado {
  const s = cercadoInicial(d);
  while (s.n < ate) passoDoCercado(s, d, e);
  return s;
}

// ================================================ FUGA DO RIO ================================================

export const RIO_MS = 20000;
/** A folga inicial até o peixe, a maior possível, e o quanto cada braçada vale. */
export const RIO_FOLGA = 110;
export const RIO_FOLGA_MAX = 190;
export const BRACADA = 8;
/** Braçadas mais juntas que isto não contam (ninguém bate mais de 14 por segundo). */
export const BRACADA_MIN_MS = 70;
/** O mergulho: quanto fica embaixo, e quanto precisa na superfície antes de mergulhar de novo. Embaixo, braçada não conta. */
export const MERGULHO_MS = 500;
export const MERGULHO_RECARGA_MS = 250;
/** O tronco que acerta quem está na superfície. */
export const TRONCO_GOLPE = 60;
/** A velocidade do peixe (por segundo), a cada 5 s. */
export const PEIXE_VEL = [38, 46, 54, 62];
const TRECHO_MS = 5000;

export interface DadosRio {
  /** Quando cada tronco passa pelo coelho (ms desde o começo). */
  troncos: number[];
}
export const podeMergulhar = (ultimo: number | undefined, t: number) => ultimo === undefined || t >= ultimo + MERGULHO_MS + MERGULHO_RECARGA_MS;
export const mergulhado = (mergulhos: number[], t: number) => {
  for (const m of mergulhos) if (m <= t && t < m + MERGULHO_MS) return true;
  return false;
};

export interface Fuga {
  /** Quando o peixe alcançou (ou null: aguentou até o fim). */
  pegoEm: number | null;
  /** A folga no fim (ou quando foi pego: 0). */
  folga: number;
  golpes: number;
}

/**
 * A fuga inteira até `ate` (ms): as braçadas (em ordem) e os mergulhos (em ordem, já válidos). A folga cai com a velocidade do
 * peixe entre um acontecimento e outro; cada braçada na superfície soma, cada tronco na superfície tira.
 */
export function fuga(d: DadosRio, bracadas: number[], mergulhos: number[], ate = RIO_MS): Fuga {
  const fim = Math.min(ate, RIO_MS);
  // os acontecimentos: 0 = braçada, 1 = tronco, 2 = troca de trecho
  const ev: [number, number][] = [];
  for (const b of bracadas) if (b >= 0 && b <= fim) ev.push([b, 0]);
  for (const t of d.troncos) if (t <= fim) ev.push([t, 1]);
  for (let t = TRECHO_MS; t < fim; t += TRECHO_MS) ev.push([t, 2]);
  ev.push([fim, 2]);
  ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let folga = RIO_FOLGA;
  let antes = 0;
  let ultimaBracada = -Infinity;
  let golpes = 0;
  for (const [t, tipo] of ev) {
    const vel = PEIXE_VEL[Math.min(PEIXE_VEL.length - 1, Math.floor(antes / TRECHO_MS))];
    const perde = (vel * (t - antes)) / 1000;
    if (perde >= folga) return { pegoEm: antes + (folga * 1000) / vel, folga: 0, golpes };
    folga -= perde;
    antes = t;
    if (tipo === 0) {
      if (t - ultimaBracada >= BRACADA_MIN_MS && !mergulhado(mergulhos, t)) {
        ultimaBracada = t;
        folga = Math.min(RIO_FOLGA_MAX, folga + BRACADA);
      }
    } else if (tipo === 1 && !mergulhado(mergulhos, t)) {
      golpes++;
      folga -= TRONCO_GOLPE;
      if (folga <= 0) return { pegoEm: t, folga: 0, golpes };
    }
  }
  return { pegoEm: null, folga, golpes };
}

// ================================================ DE GALHO EM GALHO ================================================

export const CIPO_MS = 24000;
export const CIPOS = 14;
/** O voo de um cipó ao outro, e o tempo de voltar ao cipó depois de cair. */
export const VOO_MS = 420;
export const QUEDA_MS = 1300;

export interface DadosCipo {
  /** O período do balanço de cada cipó (ms), e o quanto ele precisa estar para a frente para o pulo alcançar o próximo. */
  periodos: number[];
  limiares: number[];
}

/**
 * O BALANÇO, de −1 (todo para trás) a 1 (todo para a frente), na fração `u` do período: começa no meio indo para a frente.
 * Duas parábolas, que é quase o seno e só usa + − ×.
 */
export function balanco(u: number): number {
  const w = u - Math.floor(u);
  return w < 0.5 ? 16 * w * (0.5 - w) : -16 * (w - 0.5) * (1 - w);
}

export interface Cipozal {
  /** O cipó em que está (CIPOS: chegou do outro lado). */
  k: number;
  /** Quando pegou (ou vai pegar) o cipó `k`: o balanço conta dali. */
  g: number;
  quedas: number;
  /** Quando chegou ao último (ms), ou null. */
  chegou: number | null;
}
export const cipozalInicial = (): Cipozal => ({ k: 0, g: 0, quedas: 0, chegou: null });

/** Solta o cipó no instante `t`: alcança o próximo, cai (e volta ao mesmo), ou não está num cipó (null: não conta). */
export function soltar(s: Cipozal, d: DadosCipo, t: number): 'pegou' | 'caiu' | null {
  if (s.k >= CIPOS || t < s.g) return null;
  const a = balanco((t - s.g) / d.periodos[s.k]);
  if (a >= d.limiares[s.k]) {
    s.k++;
    s.g = t + VOO_MS;
    if (s.k >= CIPOS) s.chegou = s.g;
    return 'pegou';
  }
  s.quedas++;
  s.g = t + QUEDA_MS;
  return 'caiu';
}

// ================================================ OS PILOTOS (para os testes) ================================================

/** O piloto da nuvem: a cada 3 passos, sopra para o canteiro com sede, freando antes de chegar. As entradas que ele faria. */
export function pilotoDaNuvem(d: DadosRegar, ate = REGAR_PASSOS): Entrada[] {
  const e: Entrada[] = [];
  const s = nuvemInicial();
  const sinal = (v: number) => (v > 6 ? 1 : v < -6 ? -1 : 0);
  while (s.n < ate) {
    if (s.n % 3 === 0) {
      const c = CANTEIROS[sedeEm(d, s.n)];
      const dx = sinal(c[0] - s.x - s.vx * 0.6);
      const dy = sinal(c[1] - s.y - s.vy * 0.6);
      const u = e[e.length - 1];
      if (u ? u[1] !== dx || u[2] !== dy : dx !== 0 || dy !== 0) e.push([s.n, dx, dy]);
    }
    passoDaNuvem(s, d, e);
  }
  return e;
}

/** O piloto do cercado: a cada 3 passos, corre direto para a galinha. */
export function pilotoDaGalinha(d: DadosGalinha, ate = GALINHA_PASSOS): Entrada[] {
  const e: Entrada[] = [];
  const s = cercadoInicial(d);
  const sinal = (v: number) => (v > 4 ? 1 : v < -4 ? -1 : 0);
  while (s.n < ate) {
    if (s.n % 3 === 0) {
      const dx = sinal(s.gx - s.cx);
      const dy = sinal(s.gy - s.cy);
      const u = e[e.length - 1];
      if (u ? u[1] !== dx || u[2] !== dy : dx !== 0 || dy !== 0) e.push([s.n, dx, dy]);
    }
    passoDoCercado(s, d, e);
  }
  return e;
}
