/**
 * O COMANDO CENOURA (16/11/2026): as medidas e as contas que o servidor e o site fazem IGUAIS. São DUAS CÓPIAS IGUAIS BYTE A
 * BYTE — server/src/comando/conta.ts e web/src/comando/conta.ts —, e web/test/comando.test.ts confere. Só + − × ÷ (sem seno
 * nem cosseno), para dar o mesmo número em qualquer computador.
 *
 * O mundo é visto de lado: x para a direita, `h` é a altura acima do chão (0 é o chão; sobe para cima). A fase é uma faixa
 * comprida, dividida em arenas de uma tela (ONDAS_X), como na Briga na horta; a última é a do chefe.
 */

/** A tela (320 × 180, ampliada com os pixels nítidos) e onde fica o chão nela. */
export const W = 320;
export const H = 180;
export const CHAO_TELA = 152;
/** A largura de cada arena, e onde cada uma começa; a última é a do chefe. */
export const ARENA_L = 320;
export const ONDAS_X = [0, 400, 800, 1200, 1600];
export const FIM_DA_FASE = 1600 + ARENA_L;
/** O passo do servidor (20 por segundo). */
export const PASSO_MS = 50;

// ---------------- O COELHO ----------------
/** Correr (px/s), o impulso do pulo e a gravidade: o pulo sobe ~45 px. */
export const VEL = 84;
export const PULO_VEL = 260;
export const GRAVIDADE = 760;
/** A caixa do coelho: meia largura e altura (os golpes e as balas inimigas usam ela). */
export const COELHO_L = 7;
export const COELHO_A = 38;
/** A altura mais alta que se alcança (a plataforma mais alta e um pulo em cima dela). */
export const H_MAX = 100;
export const VIDAS = 3;
/** Os golpes que cada vida aguenta. */
export const VIDA = 3;

/** As plataformas (tábuas sobre caixotes): de x0 a x1, na altura h. Só se pisa nelas por cima. */
export const PLATAFORMAS: readonly (readonly [number, number, number])[] = [
  [110, 180, 38],
  [470, 540, 38],
  [600, 650, 38],
  [880, 950, 40],
  [1050, 1110, 40],
  [1260, 1330, 38],
  [1400, 1460, 38],
  [1680, 1740, 40],
  [1800, 1850, 40],
];

/** A altura do chão (ou da plataforma) embaixo de x, para quem cai de `h0` até `h1` (null: nada embaixo, segue caindo). */
export function pousoEm(x: number, h0: number, h1: number): number | null {
  for (const [x0, x1, h] of PLATAFORMAS) if (x >= x0 && x <= x1 && h0 >= h && h1 <= h) return h;
  return h1 <= 0 ? 0 : null;
}

/** Está em pé em cima de alguma coisa? */
export function apoiado(x: number, h: number): boolean {
  if (h <= 0) return true;
  for (const [x0, x1, ph] of PLATAFORMAS) if (x >= x0 && x <= x1 && h > ph - 0.5 && h < ph + 0.5) return true;
  return false;
}

// ---------------- O LANÇA-CENOURAS ----------------
/** As oito direções, a partir da direita, no sentido anti-horário: [dx, dh] com tamanho 1. */
const R = 0.7071067811865476;
export const DIRECOES: readonly (readonly [number, number])[] = [
  [1, 0],
  [R, R],
  [0, 1],
  [-R, R],
  [-1, 0],
  [-R, -R],
  [0, -1],
  [R, -R],
];
/** As armas: 0 a de sempre, 1 o leque de três, 2 a rápida. O intervalo entre tiros (ms). */
export const ARMAS = ['normal', 'leque', 'rapida'] as const;
export type Arma = (typeof ARMAS)[number];
export const INTERVALO: Record<Arma, number> = { normal: 210, leque: 280, rapida: 105 };
/** Quanto dura a arma de reforço (ms). */
export const ARMA_MS = 30_000;
/** A bala: velocidade (px/s), alcance (px) e o raio. */
export const BALA = { vel: 300, alcance: 240, raio: 3 };
/** O leque abre 15° para cada lado: cos e sen de 15°. */
const C15 = 0.9659258262890683;
const S15 = 0.25881904510252074;

/** Os vetores das balas de um tiro na direção `dir` com a arma `arma` (o leque são três). */
export function balasDoTiro(dir: number, arma: Arma): [number, number][] {
  const [dx, dh] = DIRECOES[((dir % 8) + 8) % 8];
  if (arma !== 'leque') return [[dx, dh]];
  return [
    [dx, dh],
    [dx * C15 - dh * S15, dx * S15 + dh * C15],
    [dx * C15 + dh * S15, -dx * S15 + dh * C15],
  ];
}

/** De onde sai a bala: a ponta do lança-cenouras, pela direção. */
export function bocaDoLanca(x: number, h: number, dir: number): [number, number] {
  const [dx, dh] = DIRECOES[((dir % 8) + 8) % 8];
  return [x + dx * 12, h + 20 + dh * 10];
}

/** Quanto a bala andou em `ms` (para no alcance). */
export function andouABala(ms: number): number {
  const d = (BALA.vel * (ms < 0 ? 0 : ms)) / 1000;
  return d > BALA.alcance ? BALA.alcance : d;
}

/**
 * A bala que sai de (x0, h0) na direção (dx, dh) passa, entre as distâncias d0 e d1, pela caixa de um bicho com o pé em
 * (cx, ch), de meia largura `larg` e altura `alto`? Confere a cada 3 px do caminho. O site usa folga 0; o servidor, uma folga
 * pequena para o desenho e o arredondamento.
 */
export function balaNaCaixa(x0: number, h0: number, dx: number, dh: number, d0: number, d1: number, cx: number, ch: number, larg: number, alto: number, folga: number): boolean {
  const r = BALA.raio + folga;
  for (let d = d0 < 0 ? 0 : d0; ; d += 3) {
    if (d > d1) d = d1;
    const x = x0 + dx * d;
    const h = h0 + dh * d;
    if (x >= cx - larg - r && x <= cx + larg + r && h >= ch - r && h <= ch + alto + r) return true;
    if (d >= d1) return false;
  }
}

// ---------------- A GRANADA ----------------
/** Até onde vai (px à frente), quanto voa (ms), o raio da explosão, o dano e a recarga (ms). */
export const GRANADA = { alcance: 92, voo: 650, raio: 34, dano: 5, recarga: 4000 };

// ---------------- OS BICHOS ----------------
/**
 * Os bichos do Comando, com as folhas da Briga (os Ultimate Monsters da Quaternius, CC0): o andarilho (o cogumelo) chega
 * perto e bate, o atirador (o dino) para longe e atira rente ao chão, o voador (a abelha) fica no alto e solta sementes, e o
 * chefe é o dragão. A ordem é o código que vai no quadro: bicho novo entra no FIM.
 */
export const TIPOS = ['cogumelo', 'dino', 'abelha', 'dragao'] as const;
export type TipoDoBicho = (typeof TIPOS)[number];
/** Meia largura e altura da caixa, a vida e os pontos de quem derruba. */
export const BICHOS: Record<TipoDoBicho, { larg: number; alto: number; hp: number; pontos: number }> = {
  cogumelo: { larg: 9, alto: 38, hp: 4, pontos: 100 },
  dino: { larg: 10, alto: 34, hp: 5, pontos: 120 },
  abelha: { larg: 9, alto: 22, hp: 3, pontos: 120 },
  dragao: { larg: 24, alto: 70, hp: 150, pontos: 1000 },
};
/** A altura em que o voador paira. */
export const VOO_H = 66;

/** Os estados dos bichos, na ordem do código que vai no quadro. */
export const ESTADOS = [
  'entrando',
  'andando',
  'preparando',
  'atacando',
  'recuperando',
  'mirando',
  'rondando',
  'marcando',
  'dor',
  'morto',
  'prep-fogo',
  'fogo',
  'prep-pisao',
  'saltando',
  'chamando',
] as const;
export type EstadoDoBicho = (typeof ESTADOS)[number];

/** O que o coelho está fazendo (para os outros o desenharem). */
export const ACOES = ['parado', 'andando', 'pulo', 'dor', 'caido'] as const;
export type AcaoDoCoelho = (typeof ACOES)[number];

// ---------------- OS COELHINHOS PRESOS ----------------
/** Onde estão as gaiolas e o reforço que cada uma dá a quem a abre. */
export const REFENS: readonly (readonly [number, Arma])[] = [
  [350, 'leque'],
  [1150, 'rapida'],
  [1550, 'leque'],
];
/** De quão perto se abre a gaiola. */
export const PERTO_DA_GAIOLA = 18;
