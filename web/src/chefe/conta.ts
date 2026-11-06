/**
 * O CHEFE DA TURMA (05/11/2026): as medidas e as contas que o servidor e o site fazem IGUAIS. São DUAS CÓPIAS IGUAIS BYTE A
 * BYTE — server/src/chefe/conta.ts e web/src/chefe/conta.ts —, e web/test/chefe.test.ts confere. Só + − × ÷ e Math.sqrt
 * (sem seno nem cosseno), para dar o mesmo número em qualquer computador.
 *
 * O mundo é a própria tela de 480 × 270, vista de cima: x para a direita, y para a frente (a parte de baixo da tela). Cada
 * coisa está no ponto do chão onde pisa.
 */

/** A tela (e o mundo). */
export const W = 480;
export const H = 270;
/** Onde os coelhos podem andar: o chão da horta, entre a cerca de cima e a borda de baixo. */
export const ARENA = { x0: 28, x1: 452, y0: 84, y1: 254 };
/** As tocas de onde a toupeira-rei sai (a primeira é a do meio). */
export const TOCAS: readonly (readonly [number, number])[] = [
  [240, 164],
  [118, 120],
  [362, 120],
  [126, 222],
  [354, 222],
];
/** O passo do servidor (20 por segundo). */
export const PASSO_MS = 50;
/** O coelho anda a VEL px/s (a diagonal também: a direção é normalizada). */
export const VEL = 96;
export const VIDAS = 3;
/** O raio do corpo da toupeira no chão (para os acertos) e o do coelho (para os golpes dela). */
export const CORPO_CHEFE = 24;
export const CORPO_COELHO = 6;
/** O torrão: o raio de onde ele cai, a velocidade e o alcance quando um coelho o atira, o dano, a distância para pegar e quanto tempo o frio fica no chão. */
export const TORRAO = { raio: 12, vel: 260, alcance: 330, dano: 10, pegar: 18, noChaoMs: 6500 };
/** A bomba de semente: até onde vai, quanto voa (ms), o raio da explosão e o dano. Uma por pessoa em cada fase da toupeira. */
export const BOMBA = { alcance: 130, voo: 650, raio: 34, dano: 25 };
/** Tonta depois da investida, a toupeira leva o dobro. */
export const TONTA_VEZES = 2;

/** Os estados da toupeira, na ordem do código que vai no quadro. */
export const ESTADOS = [
  'embaixo',
  'saindo',
  'parada',
  'prep-terremoto',
  'terremoto',
  'prep-pedras',
  'pedras',
  'prep-investida',
  'investida',
  'tonta',
  'prep-torroes',
  'jogando',
  'entrando',
  'fase',
  'caida',
] as const;
export type EstadoDoChefe = (typeof ESTADOS)[number];
/** As marcas no chão (o aviso de cada golpe), na ordem do código que vai no quadro. */
export const MARCAS = ['anel', 'pedra', 'investida', 'torrao'] as const;
export type TipoDeMarca = (typeof MARCAS)[number];
/** O que o coelho está fazendo (para os outros o desenharem). */
export const ACOES = ['parado', 'andando', 'atirando', 'dor', 'caido'] as const;
export type AcaoDoCoelho = (typeof ACOES)[number];

/** Em pé, a toupeira apanha; embaixo da terra, saindo, entrando, rugindo entre as fases ou caída, não. */
export function vulneravel(estado: string): boolean {
  return estado !== 'embaixo' && estado !== 'saindo' && estado !== 'entrando' && estado !== 'fase' && estado !== 'caida';
}

/** A direção de (dx, dy) com tamanho 1 (ou [0, 0]). */
export function normalizar(dx: number, dy: number): [number, number] {
  const d = Math.sqrt(dx * dx + dy * dy);
  return d > 0.0001 ? [dx / d, dy / d] : [0, 0];
}

export function distancia(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

/** A distância do ponto P ao segmento AB. */
export function distSegmento(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax;
  const vy = by - ay;
  const l2 = vx * vx + vy * vy;
  let k = l2 > 0 ? ((px - ax) * vx + (py - ay) * vy) / l2 : 0;
  k = k < 0 ? 0 : k > 1 ? 1 : k;
  return distancia(px, py, ax + vx * k, ay + vy * k);
}

/** Quantos px o torrão atirado andou em `ms` (para no alcance). */
export function andouOTiro(ms: number): number {
  const d = (TORRAO.vel * (ms < 0 ? 0 : ms)) / 1000;
  return d > TORRAO.alcance ? TORRAO.alcance : d;
}

/** Onde está o torrão atirado de (x0, y0) na direção (dx, dy), `ms` depois. */
export function noTiro(x0: number, y0: number, dx: number, dy: number, ms: number): [number, number] {
  const d = andouOTiro(ms);
  return [x0 + dx * d, y0 + dy * d];
}

/**
 * O torrão atirado pega a toupeira em (cx, cy)? O caminho dele, do começo até `ms`, passa a CORPO_CHEFE + o raio do torrão
 * (4) + `folga` do centro dela. O site usa folga 0; o servidor, uma folga pequena para o desenho e o arredondamento.
 */
export function tiroPega(x0: number, y0: number, dx: number, dy: number, ms: number, cx: number, cy: number, folga: number): boolean {
  const [x1, y1] = noTiro(x0, y0, dx, dy, ms);
  return distSegmento(cx, cy, x0, y0, x1, y1) <= CORPO_CHEFE + 4 + folga;
}

/** Para onde vai a bomba atirada de (x, y) mirando em (ax, ay): no máximo BOMBA.alcance. */
export function alvoDaBomba(x: number, y: number, ax: number, ay: number): [number, number] {
  const d = distancia(x, y, ax, ay);
  if (d <= BOMBA.alcance) return [ax, ay];
  return [x + ((ax - x) * BOMBA.alcance) / d, y + ((ay - y) * BOMBA.alcance) / d];
}

/** Prende um ponto dentro do chão da arena. */
export function naArena(x: number, y: number): [number, number] {
  return [x < ARENA.x0 ? ARENA.x0 : x > ARENA.x1 ? ARENA.x1 : x, y < ARENA.y0 ? ARENA.y0 : y > ARENA.y1 ? ARENA.y1 : y];
}

/** O ponto em que a investida que sai de (x, y) na direção (dx, dy) bate na borda da arena (menos `margem`). */
export function fimDaInvestida(x: number, y: number, dx: number, dy: number, margem: number): [number, number] {
  let k = 10000;
  if (dx > 0.0001) k = Math.min(k, (ARENA.x1 - margem - x) / dx);
  if (dx < -0.0001) k = Math.min(k, (ARENA.x0 + margem - x) / dx);
  if (dy > 0.0001) k = Math.min(k, (ARENA.y1 - margem - y) / dy);
  if (dy < -0.0001) k = Math.min(k, (ARENA.y0 + margem - y) / dy);
  if (k < 0) k = 0;
  return [x + dx * k, y + dy * k];
}
