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
export const CENARIOS = ['grama', 'praia', 'gelo', 'lama'] as const;
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
  // 19/11/2026: o lago congelado (montes de neve) e o brejo (tocos)
  gelo: [
    [450, 260, 24],
    [830, 636, 24],
    [450, 636, 24],
    [830, 260, 24],
    [640, 448, 28],
    [280, 300, 18],
    [1000, 596, 18],
  ],
  lama: [
    [440, 330, 22],
    [840, 566, 22],
    [440, 566, 22],
    [840, 330, 22],
    [640, 448, 30],
    [260, 200, 20],
    [1020, 696, 20],
  ],
};

/**
 * A REGRA DE CADA CHÃO (19/11/2026), igual no site e no servidor (os robôs andam por ela):
 * - no GELO o coelho ESCORREGA: a velocidade vai para a desejada aos poucos (ACEL_NO_GELO por segundo), também ao parar; a
 *   arrancada não escorrega;
 * - na LAMA, as POÇAS (círculos no chão, simétricos pelo centro) seguram: dentro delas, LAMA_SEGURA da velocidade.
 * Nenhum dos dois passa da velocidade do coelho: a conferência do servidor continua a mesma.
 */
export const ACEL_NO_GELO = 2.6;
export const LAMA_SEGURA = 0.5;
export const POCAS_DE_LAMA: readonly (readonly [number, number, number])[] = [
  [640, 250, 70],
  [640, 646, 70],
  [300, 600, 60],
  [980, 296, 60],
  [300, 296, 50],
  [980, 600, 50],
];

/** Quanto do andar normal o chão deixa, aqui (a lama segura; o resto, 1). */
export function velDoChao(cenario: Cenario, x: number, y: number): number {
  if (cenario !== 'lama') return 1;
  for (const [px, py, r] of POCAS_DE_LAMA) if ((x - px) * (x - px) + (y - py) * (y - py) <= r * r) return LAMA_SEGURA;
  return 1;
}

/** A velocidade de agora indo para a desejada (vx, vy em px/s): no gelo aos poucos, nos outros na hora. */
export function seguirVelocidade(cenario: Cenario, vx: number, vy: number, querX: number, querY: number, dt: number): [number, number] {
  if (cenario !== 'gelo') return [querX, querY];
  const k = dt * ACEL_NO_GELO > 1 ? 1 : dt * ACEL_NO_GELO;
  return [vx + (querX - vx) * k, vy + (querY - vy) * k];
}

// ---------------- O MATO QUE ESCONDE ----------------
/**
 * O MATO ALTO (20/11/2026): moitas no chão de cada cenário, [x, y, raio], simétricas pelo centro e longe de onde se nasce, dos
 * suprimentos e da zona do meio. Quem está com o pé dentro de uma moita SOME para os adversários (os aliados continuam vendo), a
 * não ser que:
 * - um adversário de pé esteja a menos de PERTO_REVELA dele, ou na MESMA moita;
 * - ele tenha golpeado, ou levado um golpe, há menos de REVELADO_MS.
 * Quem esconde é o SERVIDOR: o quadro de cada um só leva a posição de quem essa pessoa pode ver (minijogo-motor.ts,
 * difundirPorPessoa). Não segura bala nem atrapalha o andar: é só esconderijo.
 */
export const MATO: Record<Cenario, readonly (readonly [number, number, number])[]> = {
  grama: [
    [300, 560, 50],
    [980, 336, 50],
    [540, 300, 46],
    [740, 596, 46],
    [110, 800, 44],
    [1170, 96, 44],
  ],
  praia: [
    [300, 600, 48],
    [980, 296, 48],
    [530, 140, 46],
    [750, 756, 46],
    [380, 800, 44],
    [900, 96, 44],
  ],
  gelo: [
    [300, 620, 48],
    [980, 276, 48],
    [540, 140, 46],
    [740, 756, 46],
  ],
  lama: [
    [530, 130, 46],
    [750, 766, 46],
    [160, 760, 46],
    [1120, 136, 46],
  ],
};
export const PERTO_REVELA = 80;
export const REVELADO_MS = 1200;

/** Em qual moita está o pé em (x, y) (-1: em nenhuma). */
export function moitaEm(cenario: Cenario, x: number, y: number): number {
  const m = MATO[cenario];
  for (let k = 0; k < m.length; k++) {
    const [mx, my, r] = m[k];
    if ((x - mx) * (x - mx) + (y - my) * (y - my) <= r * r) return k;
  }
  return -1;
}

// ---------------- O MODO DE OBJETIVO ----------------
/**
 * SEGURAR A ZONA (19/11/2026): um círculo no meio da arena; a cada segundo em que só um time tem gente de pé dentro dele, esse
 * time faz um ponto. Quem chega a PONTOS_DA_ZONA vence (no tempo, quem tem mais). Ninguém fica sem vidas: quem cai volta. Funciona
 * com a internet lenta porque quem conta é o servidor, pelas posições que ele já confere.
 */
export const ZONA_DO_OBJETIVO = { x: 640, y: 448, raio: 110 };
export const PONTOS_DA_ZONA = 60;

/**
 * O FIM COM PRESSÃO (20/11/2026): no último minuto da partida, as zonas da arena vêm mais depressa e maiores, e a tela avisa. O
 * relógio que o quadro leva (o "r", o que falta) diz à tela quando começa; o servidor marca as zonas.
 */
export const ZONA_FINAL = { falta: 60_000, cada: 3500, raio: 70 };

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

/**
 * O golpe forte e o especial de cada elemento (19/11/2026; antes eram a mesma zona em todos): as mesmas três formas, com números
 * que dizem quem o bicho é. A folha planta um campo grande e lento; a brasa explode em volta; a gota abre um leque de ondas; a
 * pedra derruba a avalanche pesada; o vento gira e sopra o leque largo; a faísca atira o raio rápido e cai num ponto só.
 */
export const KITS: Record<string, { b: Golpe; s: Golpe; q: Golpe; e: Golpe; nomes: readonly [string, string] }> = {
  folha: { b: tiro(8, 500, 240, 230, 6), s: tiro(7, 2600, 250, 200, 6, 3, 2), q: zona(24, 6000, 180, 40, 600), e: zona(38, 0, 200, 92, 850), nomes: ['semente', 'cipo'] },
  brasa: { b: tiro(9, 500, 220, 210, 7), s: roda(15, 3000, 58), q: zona(30, 6000, 160, 40, 650), e: roda(42, 0, 104), nomes: ['fogo', 'vulcao'] },
  gota: { b: tiro(7, 500, 270, 250, 6), s: tiro(6, 2600, 280, 220, 5, 3, 1), q: tiro(13, 6000, 300, 280, 8, 3, 1), e: zona(34, 0, 220, 80, 650), nomes: ['chuva', 'onda'] },
  pedra: { b: tiro(10, 500, 190, 200, 8), s: zona(18, 3000, 130, 36, 450), q: zona(34, 6500, 150, 50, 850), e: roda(46, 0, 96), nomes: ['pedrada', 'avalanche'] },
  vento: { b: tiro(7, 500, 300, 220, 6), s: roda(12, 2600, 66), q: roda(22, 5500, 88), e: tiro(18, 0, 380, 320, 10, 3, 2), nomes: ['sopro', 'tornado'] },
  faisca: { b: tiro(7, 500, 330, 240, 5), s: tiro(15, 3000, 420, 260, 8), q: tiro(28, 6000, 520, 320, 9), e: zona(44, 0, 240, 60, 450), nomes: ['choque', 'raio'] },
};

/** De quão longe o golpe pega alguém: a roda, o raio dela; o tiro, o alcance; a zona, o alcance mais o raio dela. */
export function alcanceDoGolpe(g: Golpe): number {
  return g.forma === 'roda' ? g.raio + RAIO : g.forma === 'tiro' ? g.alcance : g.alcance + g.raio;
}
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
