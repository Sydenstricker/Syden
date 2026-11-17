/**
 * A ARENA DOS COELHOS (17/11/2026, dentro dos Bichos da Toca): as medidas e as contas que o servidor e o site fazem IGUAIS. São
 * DUAS CÓPIAS IGUAIS BYTE A BYTE — server/src/arena/conta.ts e web/src/arena/conta.ts —, e o teste do servidor confere. Só
 * + − × ÷ e raiz (sem seno nem cosseno: os ângulos do leque são números prontos), para dar o mesmo número em qualquer computador.
 * Sem import nenhum, de propósito: o arquivo é o mesmo nos dois lados.
 *
 * O mundo é visto de cima (três quartos, a vista do quarto e do salão): x para a direita, y para baixo (para quem olha, "sul").
 * Tudo acontece no chão: o coelho é um círculo de RAIO em volta do pé, e as cenouras, as sementes e as zonas também andam no chão.
 */

/** A tela (pixels do jogo: o coelho do PixelLab cabe nela no tamanho dele, sem reduzir) e o passo do servidor (20 por segundo). */
export const W = 640;
export const H = 360;
export const PASSO_MS = 50;

/** O mundo: maior que a tela, e a câmera segue quem joga. A cerca em volta tem BORDA de espessura. */
export const MUNDO_W = 1280;
export const MUNDO_H = 896;
export const BORDA = 28;

// ---------------- O COELHO ----------------
/** Andar (px/s), o raio do corpo no chão, a vida e as vidas. */
export const VEL = 100;
export const RAIO = 12;
export const PV = 100;
export const VIDAS = 3;
/** A ARRANCADA (Espaço): rápida e curta, para desviar; ~54 px. Sem pulo. */
export const ARRANCADA = { ms: 170, vel: 320, recarga: 900 };
/** Trocar o bicho da frente (R, 1, 2, 3). */
export const RECARGA_DA_TROCA = 3000;
/** O especial (E) enche até 100: com o tempo e com o dano que se causa. */
export const ESPECIAL_MAX = 100;
export const ESPECIAL_POR_SEG = 2;
export const ESPECIAL_POR_DANO = 0.8;
/** O suprimento de velocidade. */
export const RAPIDO = { mult: 1.4, ms: 6000 };

// ---------------- OS CENÁRIOS ----------------
export const CENARIOS = ['grama', 'praia'] as const;
export type Cenario = (typeof CENARIOS)[number];

/**
 * Os OBSTÁCULOS de cada cenário: [x, y, raio] no chão (a árvore, a pedra, o coqueiro, a poça). Simétricos pelo centro, para
 * nenhum lado da arena ganhar. Ninguém atravessa, e as cenouras param neles.
 */
export const OBSTACULOS: Record<Cenario, readonly (readonly [number, number, number])[]> = {
  grama: [
    [420, 300, 26],
    [860, 596, 26],
    [420, 596, 22],
    [860, 300, 22],
    [640, 448, 30],
    [250, 170, 20],
    [1030, 726, 20],
    [250, 726, 24],
    [1030, 170, 24],
  ],
  praia: [
    [470, 250, 24],
    [810, 646, 24],
    [470, 646, 24],
    [810, 250, 24],
    [640, 448, 40],
    [300, 448, 18],
    [980, 448, 18],
  ],
};

/** Onde cada um nasce e volta: [x, y]. Nos times, o 0 à esquerda e o 1 à direita; cada um por si, em roda. */
export const NASCER_TIME: readonly (readonly (readonly [number, number])[])[] = [
  [
    [170, 448],
    [170, 330],
    [170, 566],
  ],
  [
    [1110, 448],
    [1110, 566],
    [1110, 330],
  ],
];
export const NASCER_TODOS: readonly (readonly [number, number])[] = [
  [170, 448],
  [1110, 448],
  [640, 150],
  [640, 746],
  [200, 180],
  [1080, 716],
];

/** Os SUPRIMENTOS caem nestes quatro pontos fixos, à mesma distância do centro. */
export const PONTOS_DE_SUPRIMENTO: readonly (readonly [number, number])[] = [
  [640, 208],
  [640, 688],
  [400, 448],
  [880, 448],
];
export const SUPRIMENTOS = ['cura', 'energia', 'rapido'] as const;
export type Suprimento = (typeof SUPRIMENTOS)[number];
/** O quanto cada um dá, e de quão perto se pega. */
export const CURA = 35;
export const ENERGIA = 35;
export const PERTO_DO_SUPRIMENTO = 22;

// ---------------- O CHÃO ----------------
/** Dentro da cerca, com o corpo inteiro. */
export function naCerca(x: number, y: number, r = RAIO): [number, number] {
  const x0 = BORDA + r, x1 = MUNDO_W - BORDA - r, y0 = BORDA + r, y1 = MUNDO_H - BORDA - r;
  return [x < x0 ? x0 : x > x1 ? x1 : x, y < y0 ? y0 : y > y1 ? y1 : y];
}

/** Empurra para fora de cada obstáculo em que o corpo entrou. */
export function foraDosObstaculos(cenario: Cenario, x: number, y: number, r = RAIO): [number, number] {
  for (const [ox, oy, or] of OBSTACULOS[cenario]) {
    const dx = x - ox, dy = y - oy;
    const d2 = dx * dx + dy * dy;
    const min = or + r;
    if (d2 >= min * min) continue;
    const d = Math.sqrt(d2);
    if (d < 0.001) {
      x = ox + min;
      continue;
    }
    x = ox + (dx / d) * min;
    y = oy + (dy / d) * min;
  }
  return naCerca(x, y, r);
}

/** O corpo está dentro de um obstáculo (mais que `folga` px)? */
export function dentroDeObstaculo(cenario: Cenario, x: number, y: number, folga: number): boolean {
  for (const [ox, oy, or] of OBSTACULOS[cenario]) {
    const dx = x - ox, dy = y - oy;
    const min = or + RAIO - folga;
    if (min > 0 && dx * dx + dy * dy < min * min) return true;
  }
  return false;
}

/** Um passo de (dx, dy), sem atravessar a cerca nem os obstáculos. */
export function andar(cenario: Cenario, x: number, y: number, dx: number, dy: number): [number, number] {
  return foraDosObstaculos(cenario, x + dx, y + dy);
}

/** O vetor de tamanho 1 na direção de (dx, dy); parado, para a direita. */
export function unitario(dx: number, dy: number): [number, number] {
  const d = Math.sqrt(dx * dx + dy * dy);
  return d < 1e-6 ? [1, 0] : [dx / d, dy / d];
}

// ---------------- OS GOLPES ----------------
/**
 * Cada elemento é um KIT de quatro golpes, nas teclas da arena: b o básico (botão esquerdo), s o secundário (botão direito), q o
 * golpe forte e e o especial. Três formas:
 * - 'tiro': sai da mão e anda pelo chão (uma bala, ou o leque de `balas` abrindo `abre`); quem atira tem razão (o acerto vai ao
 *   servidor, que confere pelo passado do alvo);
 * - 'roda': em volta de quem bate, na hora (também de quem bate);
 * - 'zona': marcada no chão onde se mira, e só bate `aviso` ms depois (quem apanha tem folga: sai da marca e escapa).
 * O dano é o de base, vezes a vantagem do elemento (bichos-regras.ts, amaciada na arena: ver fatorDaArena).
 */
export type FormaDoGolpe = 'tiro' | 'roda' | 'zona';
export interface Golpe {
  forma: FormaDoGolpe;
  dano: number;
  recarga: number;
  /** tiro: a velocidade (px/s); zona: até onde se mira. */
  vel: number;
  alcance: number;
  /** O raio da bala, da roda ou da zona. */
  raio: number;
  /** O leque: quantas balas, e qual abertura (0 reta, 1 a de 15°, 2 a de 25°). */
  balas: number;
  abre: number;
  /** A zona: quanto tempo marcada antes de bater. */
  aviso: number;
}
export const TECLAS_DE_GOLPE = ['b', 's', 'q', 'e'] as const;
export type TeclaDeGolpe = (typeof TECLAS_DE_GOLPE)[number];

const tiro = (dano: number, recarga: number, vel: number, alcance: number, raio: number, balas = 1, abre = 0): Golpe => ({ forma: 'tiro', dano, recarga, vel, alcance, raio, balas, abre, aviso: 0 });
const roda = (dano: number, recarga: number, raio: number): Golpe => ({ forma: 'roda', dano, recarga, vel: 0, alcance: 0, raio, balas: 0, abre: 0, aviso: 0 });
const zona = (dano: number, recarga: number, alcance: number, raio: number, aviso: number): Golpe => ({ forma: 'zona', dano, recarga, vel: 0, alcance, raio, balas: 0, abre: 0, aviso });

/** O golpe forte e o especial são a mesma forma em todo elemento (a cor e a vantagem mudam). */
const FORTE = zona(26, 6000, 170, 44, 700);
const ESPECIAL = zona(40, 0, 190, 72, 650);

/** Os kits; `nomes`: o golpe do bicho (GOLPES, em bichos-regras.ts) que dá nome ao básico e ao forte, para a tela. */
export const KITS: Record<string, { b: Golpe; s: Golpe; q: Golpe; e: Golpe; nomes: readonly [string, string] }> = {
  folha: { b: tiro(8, 500, 240, 230, 6), s: tiro(7, 2600, 250, 200, 6, 3, 2), q: FORTE, e: ESPECIAL, nomes: ['semente', 'cipo'] },
  brasa: { b: tiro(9, 500, 220, 210, 7), s: roda(15, 3000, 58), q: FORTE, e: ESPECIAL, nomes: ['fogo', 'vulcao'] },
  gota: { b: tiro(7, 500, 270, 250, 6), s: tiro(6, 2600, 280, 220, 5, 3, 1), q: FORTE, e: ESPECIAL, nomes: ['chuva', 'onda'] },
  pedra: { b: tiro(10, 500, 190, 200, 8), s: zona(18, 3000, 130, 36, 450), q: FORTE, e: ESPECIAL, nomes: ['pedrada', 'avalanche'] },
  vento: { b: tiro(7, 500, 300, 220, 6), s: roda(12, 2600, 66), q: FORTE, e: ESPECIAL, nomes: ['sopro', 'tornado'] },
  faisca: { b: tiro(7, 500, 330, 240, 5), s: tiro(15, 3000, 420, 260, 8), q: FORTE, e: ESPECIAL, nomes: ['choque', 'raio'] },
};
export const ELEMENTOS_DA_ARENA = ['folha', 'brasa', 'gota', 'pedra', 'vento', 'faisca'] as const;

/** A vantagem do elemento na arena: o 2 e o 0,5 da luta por turnos viram 1,5 e 0,67 (no tempo real, o dobro decidia sozinho). */
export function fatorDaArena(eficacia: number): number {
  return eficacia >= 2 ? 1.5 : eficacia <= 0.5 ? 0.67 : 1;
}

/** cos e sen de 15° e de 25°: o leque gira o vetor para os dois lados. */
const ABERTURAS: readonly (readonly [number, number])[] = [
  [1, 0],
  [0.9659258262890683, 0.25881904510252074],
  [0.9063077870366499, 0.42261826174069944],
];

/** As balas de um tiro na direção (dx, dy) de tamanho 1: a do meio e, no leque, as dos lados. */
export function balasDoGolpe(dx: number, dy: number, g: Golpe): [number, number][] {
  const saida: [number, number][] = [[dx, dy]];
  if (g.balas >= 3) {
    const [c, s] = ABERTURAS[g.abre] ?? ABERTURAS[0];
    saida.push([dx * c - dy * s, dx * s + dy * c], [dx * c + dy * s, -dx * s + dy * c]);
  }
  return saida;
}

/** De onde a bala sai: a mão, um pouco à frente do corpo. */
export function bocaDoGolpe(x: number, y: number, dx: number, dy: number): [number, number] {
  return [x + dx * (RAIO + 4), y + dy * (RAIO + 4)];
}

/** Quanto a bala andou em `ms` (para no alcance). */
export function andouABala(g: Golpe, ms: number): number {
  const d = (g.vel * (ms < 0 ? 0 : ms)) / 1000;
  return d > g.alcance ? g.alcance : d;
}

/** Até onde a bala vai antes de bater num obstáculo ou na cerca (no máximo `alcance`). */
export function alcanceLivre(cenario: Cenario, x0: number, y0: number, dx: number, dy: number, alcance: number): number {
  let ate = alcance;
  for (const [ox, oy, or] of OBSTACULOS[cenario]) {
    // o tronco é um pouco menor que o corpo do obstáculo: a bala que raspa a copa passa
    const r = or - 4;
    const fx = x0 - ox, fy = y0 - oy;
    const b = fx * dx + fy * dy;
    const c = fx * fx + fy * fy - r * r;
    if (c <= 0) continue; // saiu de dentro: não bate nele
    const disc = b * b - c;
    if (disc < 0) continue;
    const t = -b - Math.sqrt(disc);
    if (t >= 0 && t < ate) ate = t;
  }
  // a cerca
  const tx = dx > 0 ? (MUNDO_W - BORDA - x0) / dx : dx < 0 ? (BORDA - x0) / dx : Infinity;
  const ty = dy > 0 ? (MUNDO_H - BORDA - y0) / dy : dy < 0 ? (BORDA - y0) / dy : Infinity;
  const cerca = tx < ty ? tx : ty;
  return cerca >= 0 && cerca < ate ? cerca : ate < 0 ? 0 : ate;
}

/**
 * A bala que sai de (x0, y0) na direção (dx, dy) passa, entre as distâncias d0 e d1, a menos de `r` de (cx, cy)? (O ponto do
 * caminho mais perto do alvo.) O site usa r = o corpo + a bala; o servidor, mais uma folga pequena para o arredondamento.
 */
export function balaPassaPerto(x0: number, y0: number, dx: number, dy: number, d0: number, d1: number, cx: number, cy: number, r: number): boolean {
  if (d1 < d0) return false;
  let t = (cx - x0) * dx + (cy - y0) * dy;
  if (t < d0) t = d0;
  if (t > d1) t = d1;
  const px = x0 + dx * t - cx, py = y0 + dy * t - cy;
  return px * px + py * py <= r * r;
}

/** (x, y) está a menos de `r` de (cx, cy)? */
export const perto = (x: number, y: number, cx: number, cy: number, r: number) => (x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r;

/** A zona mirada: até `alcance` de quem a pôs (mais longe, ela vai para a borda do alcance). */
export function alvoDaZona(x: number, y: number, ax: number, ay: number, alcance: number): [number, number] {
  const dx = ax - x, dy = ay - y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d <= alcance) return naCerca(ax, ay, 0);
  return naCerca(x + (dx / d) * alcance, y + (dy / d) * alcance, 0);
}

// ---------------- O QUE O COELHO ESTÁ FAZENDO ----------------
/** Na ordem do código que vai no quadro. */
export const ACOES = ['parado', 'andando', 'arrancada', 'golpe', 'dor', 'fora'] as const;
export type AcaoDoCoelho = (typeof ACOES)[number];
/** Quanto a pose do golpe fica na tela. */
export const GOLPE_MS = 320;
