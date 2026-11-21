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

/** As plataformas (tábuas sobre caixotes): de x0 a x1, na altura h. Só se pisa nelas por cima. As da floresta (as de sempre). */
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

/**
 * AS TÁBUAS DE CADA FASE (21/11/2026, a segunda auditoria: antes, as mesmas nas duas): a floresta continua com as de sempre; o
 * deserto e a neve têm as delas, com DEGRAUS (uma tábua alta ao lado de uma baixa, a alta só se alcança pela baixa). Toda arena
 * tem pelo menos uma tábua: é para ela que se sobe para fugir do fogo, da investida e da avalanche do chefe. Nenhuma passa de
 * 55, para o pulo em cima dela caber em H_MAX.
 */
export type Tabuas = readonly (readonly [number, number, number])[];
export const PLATAFORMAS_DA_FASE: Record<'floresta' | 'deserto' | 'neve', Tabuas> = {
  floresta: PLATAFORMAS,
  deserto: [
    [90, 150, 32],
    [158, 208, 52],
    [480, 560, 38],
    [860, 920, 32],
    [928, 978, 52],
    [1240, 1310, 40],
    [1450, 1510, 38],
    [1650, 1710, 32],
    [1718, 1768, 52],
    [1830, 1890, 34],
  ],
  neve: [
    [150, 230, 40],
    [520, 580, 30],
    [588, 638, 50],
    [900, 990, 40],
    [1280, 1330, 32],
    [1338, 1388, 52],
    [1440, 1500, 36],
    [1660, 1730, 44],
    [1800, 1870, 44],
  ],
};

/** A altura do chão (ou da plataforma) embaixo de x, para quem cai de `h0` até `h1` (null: nada embaixo, segue caindo). */
export function pousoEm(x: number, h0: number, h1: number, tabuas: Tabuas = PLATAFORMAS): number | null {
  for (const [x0, x1, h] of tabuas) if (x >= x0 && x <= x1 && h0 >= h && h1 <= h) return h;
  return h1 <= 0 ? 0 : null;
}

/** Está em pé em cima de alguma coisa? */
export function apoiado(x: number, h: number, tabuas: Tabuas = PLATAFORMAS): boolean {
  if (h <= 0) return true;
  for (const [x0, x1, ph] of tabuas) if (x >= x0 && x <= x1 && h > ph - 0.5 && h < ph + 0.5) return true;
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
/**
 * As armas: 0 a de sempre, 1 o leque de três, 2 a rápida; desde 19/11/2026, 3 a CHAMA CURTA (uma rajada de faíscas de cenoura
 * que alcança pouco e sai sem parar) e 4 a TELEGUIADA (lenta, vai atrás do bicho mais perto da mira). A ordem é o código que
 * vai no quadro: arma nova entra no FIM. O intervalo entre tiros (ms).
 */
export const ARMAS = ['normal', 'leque', 'rapida', 'chama', 'teleguiada'] as const;
export type Arma = (typeof ARMAS)[number];
export const INTERVALO: Record<Arma, number> = { normal: 210, leque: 280, rapida: 105, chama: 70, teleguiada: 420 };
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

/** A velocidade (px/s) e o alcance (px) de cada arma: a chama vai perto, a teleguiada é lenta e vai longe. */
export const VEL_DA_ARMA: Record<Arma, number> = { normal: 300, leque: 300, rapida: 300, chama: 260, teleguiada: 170 };
export const ALCANCE_DA_ARMA: Record<Arma, number> = { normal: 240, leque: 240, rapida: 240, chama: 64, teleguiada: 300 };
/** Quanto a teleguiada vira por segundo (radianos), no desenho de quem atirou: o servidor confere pela distância. */
export const TELEGUIADA = { giro: 5, dano: 2 };

/** Quanto a bala andou em `ms` (para no alcance da arma). */
export function andouABala(ms: number, arma: Arma = 'normal'): number {
  const d = (VEL_DA_ARMA[arma] * (ms < 0 ? 0 : ms)) / 1000;
  return d > ALCANCE_DA_ARMA[arma] ? ALCANCE_DA_ARMA[arma] : d;
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

// ---------------- A FACA-CENOURA ----------------
/**
 * O GOLPE DE PERTO (19/11/2026): com o bicho COLADO (a até `alcance` px da caixa dele, do lado para onde se olha, na altura
 * dele), atirar vira a facada com a cenoura: sem bala, mais dano, no máximo uma a cada `intervalo` ms.
 */
export const FACA = { alcance: 12, dano: 2, intervalo: 320 };

/** O bicho com o pé em (bx, bh), de meia largura `larg` e altura `alto`, está colado no coelho em (x, h) olhando para `lado`? */
export function coladoNaFaca(x: number, h: number, lado: number, bx: number, bh: number, larg: number, alto: number, folga: number): boolean {
  const dx = (bx - x) * (lado < 0 ? -1 : 1);
  if (dx < -larg - folga || dx > larg + FACA.alcance + folga) return false;
  return h + 30 >= bh - folga && h <= bh + alto + folga;
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
export const TIPOS = ['cogumelo', 'dino', 'abelha', 'dragao', 'capsula', 'cacto', 'golem', 'redemoinho', 'yeti', 'alpaca-rei', 'macaco', 'espinhento', 'corvo'] as const;
export type TipoDoBicho = (typeof TIPOS)[number];
/**
 * O que cada bicho FAZ (19/11/2026: a segunda fase traz bichos novos das folhas da Briga com os comportamentos de sempre): o
 * andarilho, o atirador, o voador, o chefe (o dragão no fim, o yeti como subchefe) e a cápsula voadora, que não ataca e,
 * derrubada, solta uma arma.
 */
export type Comportamento = 'andarilho' | 'atirador' | 'voador' | 'chefe' | 'capsula';
/** Meia largura e altura da caixa, a vida, os pontos de quem derruba e o comportamento. */
export const BICHOS: Record<TipoDoBicho, { larg: number; alto: number; hp: number; pontos: number; comp: Comportamento }> = {
  cogumelo: { larg: 9, alto: 38, hp: 4, pontos: 100, comp: 'andarilho' },
  dino: { larg: 10, alto: 34, hp: 5, pontos: 120, comp: 'atirador' },
  abelha: { larg: 9, alto: 22, hp: 3, pontos: 120, comp: 'voador' },
  dragao: { larg: 24, alto: 70, hp: 150, pontos: 1000, comp: 'chefe' },
  capsula: { larg: 9, alto: 12, hp: 2, pontos: 150, comp: 'capsula' },
  cacto: { larg: 10, alto: 40, hp: 5, pontos: 110, comp: 'andarilho' },
  golem: { larg: 9, alto: 36, hp: 6, pontos: 130, comp: 'atirador' },
  redemoinho: { larg: 10, alto: 26, hp: 3, pontos: 130, comp: 'voador' },
  yeti: { larg: 22, alto: 64, hp: 90, pontos: 700, comp: 'chefe' },
  // 21/11/2026: o chefe próprio do deserto, e os bichos da neve (a terceira fase)
  'alpaca-rei': { larg: 22, alto: 66, hp: 150, pontos: 1000, comp: 'chefe' },
  macaco: { larg: 9, alto: 40, hp: 5, pontos: 110, comp: 'andarilho' },
  espinhento: { larg: 10, alto: 30, hp: 6, pontos: 130, comp: 'atirador' },
  corvo: { larg: 9, alto: 24, hp: 3, pontos: 120, comp: 'voador' },
};

/** A CÁPSULA VOADORA: atravessa o alto da arena devagar, ondulando; derrubada, a arma cai no chão e fica ITEM_MS. */
export const CAPSULA = { vel: 45, h: 84, onda: 8, itemMs: 15_000 };

/**
 * AS FASES (19/11/2026): a floresta (a de sempre) e o deserto (bichos novos e o yeti de subchefe no meio); desde 21/11/2026, a
 * NEVE (os bichos da neve da Briga e o pombo no ar, com o yeti de chefe), e o deserto com o chefe dele, a alpaca-rei. Escolhe-se
 * na largada uma delas ou a campanha (as três seguidas). O índice é o cenário da Briga em que cada uma acontece.
 */
export const FASES_DO_COMANDO = ['floresta', 'deserto', 'neve'] as const;
export type MapaDoComando = (typeof FASES_DO_COMANDO)[number];
export const CAMPANHA_DO_COMANDO = 'campanha';
export const CENARIO_DA_FASE: Record<MapaDoComando, number> = { floresta: 1, deserto: 2, neve: 3 };
/**
 * A VARIANTE DO RECORDE do Solo (21/11/2026): o deserto mudou (as tábuas, as gaiolas, o chefe) e a campanha ganhou a neve, então
 * os dois guardam o recorde com um nome novo; o da floresta continua o de sempre.
 */
export const VARIANTE_DO_RECORDE: Record<string, string> = { floresta: 'floresta', deserto: 'deserto-2', neve: 'neve', campanha: 'campanha-3' };
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
  // 21/11/2026: o cuspe e a investida da alpaca-rei, a avalanche do yeti
  'prep-cuspe',
  'cuspe',
  'prep-investida',
  'investida',
  'prep-avalanche',
  'avalanche',
] as const;
export type EstadoDoBicho = (typeof ESTADOS)[number];

/** O que o coelho está fazendo (para os outros o desenharem). */
export const ACOES = ['parado', 'andando', 'pulo', 'dor', 'caido'] as const;
export type AcaoDoCoelho = (typeof ACOES)[number];

// ---------------- OS COELHINHOS PRESOS ----------------
/** Onde estão as gaiolas e o reforço que cada uma dá a quem a abre (as da floresta, as de sempre). */
export const REFENS: readonly (readonly [number, Arma])[] = [
  [350, 'leque'],
  [1150, 'rapida'],
  [1550, 'leque'],
];
/** As gaiolas de cada fase (21/11/2026): três em cada, em lugares e com reforços próprios. */
export const REFENS_DA_FASE: Record<MapaDoComando, readonly (readonly [number, Arma])[]> = {
  floresta: REFENS,
  deserto: [
    [360, 'rapida'],
    [760, 'leque'],
    [1560, 'rapida'],
  ],
  neve: [
    [740, 'leque'],
    [1160, 'rapida'],
    [1540, 'leque'],
  ],
};
/** A fase pelo código do quadro (`mp`); sem ele, a floresta. */
export const mapaDoCodigo = (k: number | undefined): MapaDoComando => FASES_DO_COMANDO[k ?? 0] ?? 'floresta';
/** De quão perto se abre a gaiola. */
export const PERTO_DA_GAIOLA = 18;
