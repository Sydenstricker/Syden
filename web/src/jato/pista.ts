/**
 * AS PISTAS DOS COELHOS A JATO (05/11/2026): faixas suspensas no ar, desenhadas POR CÓDIGO como as da Corrida dos coelhos
 * (web/src/corrida/pista.ts, de onde a forma foi copiada e adaptada: lá é dono outro jogo). Tudo sai de UMA linha do meio
 * (Catmull-Rom fechada pelos pontos de controle): a distância até ela diz se o chão é pista, borda ou o vazio, e o quanto
 * se andou ao longo dela pinta as faixas de luz e conta as voltas.
 *
 * Fora da pista NÃO há chão: é o vazio (a cidade lá embaixo, o espaço, o mar de nuvens), desenhado num SEGUNDO plano, mais
 * fundo, pela câmera (render.ts). Na maior parte da volta, a BORDA DE ENERGIA segura a nave (e cobra energia); nos trechos
 * ABERTOS não há borda, e quem sai da pista cai.
 *
 * O id leva a versão ("cidade-1"): mudar o traçado é pista nova, e os recordes e fantasmas da antiga não se misturam.
 * O servidor tem as medidas de cada pista (server/src/jato.ts, PISTAS_DO_JATO); web/test/jato.test.ts confere que batem.
 */
import { sorteio } from './util';

export const MUNDO = 1024;
export const RES = 2048;
const K = RES / MUNDO;

/** O que é cada ponto do mapa (só para o desenho e o mapa pequeno: a física usa a linha do meio). */
export const Chao = { Pista: 0, Borda: 1, Vazio: 2, Placa: 3, Recarga: 4, Aviso: 5 } as const;
export type Chao = (typeof Chao)[keyof typeof Chao];

export type Fundo = 'cidade' | 'espaco' | 'nuvens';

export interface TemaDoJato {
  /** O céu, de cima para baixo, e o que fica lá embaixo, fora da pista. */
  ceu: { topo: [number, number, number]; meio: [number, number, number]; baixo: [number, number, number] };
  fundo: Fundo;
  /** As placas do piso (três tons), a costura entre elas e as faixas de luz que atravessam a pista. */
  piso: [number, number, number];
  costura: number;
  luz: number;
  /** A borda de energia: duas cores que se alternam. */
  borda: [number, number];
  /** A névoa de longe (a cor do horizonte). */
  nevoa: [number, number, number];
}

export interface DefinicaoDoJato {
  id: string;
  /** Os pontos de controle da linha do meio, no sentido da corrida. A linha de chegada fica no primeiro. */
  pontos: [number, number][];
  meiaLargura: number;
  voltas: number;
  /** As placas de impulso: [fração da volta, de que lado do meio (−1 a 1, em meias larguras)]. */
  placas: [number, number][];
  /** A faixa de recarga (no meio da pista): [começo, fim] em fração da volta. */
  recargas: [number, number][];
  /** Os trechos SEM borda (quem sai da pista cai): [começo, fim] em fração da volta. */
  abertos: [number, number][];
  /** OS PERIGOS da pista (21/11/2026): ver `Perigo` e `perigoQueAtinge`. */
  perigos?: Perigo[];
  semente: number;
  tema: TemaDoJato;
}

const rgb = (r: number, g: number, b: number) => (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;

/** A CIDADE À NOITE: a pista passa por cima das ruas acesas, com os prédios no horizonte. */
export const CIDADE: DefinicaoDoJato = {
  id: 'cidade-1',
  pontos: [
    [200, 190], [460, 140], [720, 150], [880, 260], [910, 470], [860, 680], [700, 720], [560, 640], [420, 720],
    [400, 880], [220, 900], [120, 700], [120, 420],
  ],
  meiaLargura: 38,
  voltas: 4,
  placas: [[0.14, -0.45], [0.36, 0.4], [0.72, 0], [0.88, -0.4]],
  recargas: [[0.025, 0.1]],
  abertos: [[0.19, 0.25]],
  semente: 3,
  tema: {
    ceu: { topo: [14, 12, 36], meio: [44, 30, 76], baixo: [118, 64, 104] },
    fundo: 'cidade',
    piso: [rgb(58, 60, 84), rgb(64, 66, 90), rgb(54, 56, 78)],
    costura: rgb(40, 40, 60),
    luz: rgb(120, 220, 255),
    borda: [rgb(90, 230, 255), rgb(255, 120, 210)],
    nevoa: [86, 52, 96],
  },
};

/** A ÓRBITA: no espaço, com as estrelas lá embaixo também, e o planeta no horizonte. */
export const ORBITA: DefinicaoDoJato = {
  id: 'orbita-1',
  pontos: [
    [170, 300], [360, 160], [620, 130], [850, 220], [910, 420], [800, 580], [860, 760], [720, 910], [470, 900],
    [330, 760], [180, 680], [110, 480],
  ],
  meiaLargura: 38,
  voltas: 4,
  placas: [[0.12, 0.4], [0.3, -0.4], [0.68, 0.4], [0.86, 0]],
  recargas: [[0.03, 0.1]],
  abertos: [[0.6, 0.66], [0.9, 0.95]],
  semente: 17,
  tema: {
    ceu: { topo: [6, 6, 18], meio: [16, 14, 40], baixo: [40, 30, 74] },
    fundo: 'espaco',
    piso: [rgb(70, 64, 96), rgb(76, 70, 102), rgb(64, 58, 90)],
    costura: rgb(44, 40, 66),
    luz: rgb(255, 200, 120),
    borda: [rgb(255, 196, 90), rgb(150, 120, 255)],
    nevoa: [34, 28, 64],
  },
};

/** O MAR DE NUVENS: o fim de tarde por cima das nuvens, uma volta mais curta e mais rápida. */
export const NUVENS: DefinicaoDoJato = {
  id: 'nuvens-1',
  pontos: [
    [240, 220], [500, 170], [740, 220], [850, 400], [760, 560], [780, 740], [600, 860], [360, 820], [220, 640],
    [160, 420],
  ],
  meiaLargura: 36,
  voltas: 5,
  placas: [[0.15, 0.4], [0.56, -0.4], [0.8, 0.3]],
  recargas: [[0.03, 0.11]],
  abertos: [[0.62, 0.68]],
  semente: 29,
  tema: {
    ceu: { topo: [70, 84, 160], meio: [214, 140, 160], baixo: [250, 200, 170] },
    fundo: 'nuvens',
    piso: [rgb(96, 92, 120), rgb(102, 98, 126), rgb(90, 86, 114)],
    costura: rgb(70, 66, 92),
    luz: rgb(255, 236, 170),
    borda: [rgb(255, 160, 110), rgb(120, 220, 255)],
    nevoa: [246, 196, 176],
  },
};

/** A AURORA (19/11/2026, a auditoria: mais pistas): no espaço, com o céu verde, um "S" no meio e um grampo no fim. */
export const AURORA: DefinicaoDoJato = {
  id: 'aurora-1',
  pontos: [
    [180, 240], [420, 130], [650, 170], [800, 120], [910, 300], [820, 470], [650, 430], [540, 540], [690, 660],
    [880, 700], [850, 890], [600, 910], [400, 800], [230, 880], [110, 700], [180, 500],
  ],
  meiaLargura: 36,
  voltas: 3,
  placas: [[0.1, 0.4], [0.33, -0.3], [0.6, 0.4], [0.84, -0.4]],
  recargas: [[0.02, 0.09]],
  abertos: [[0.46, 0.52]],
  semente: 41,
  tema: {
    ceu: { topo: [6, 16, 22], meio: [20, 70, 70], baixo: [60, 150, 120] },
    fundo: 'espaco',
    piso: [rgb(56, 78, 84), rgb(62, 84, 90), rgb(50, 72, 78)],
    costura: rgb(36, 52, 58),
    luz: rgb(140, 255, 190),
    borda: [rgb(120, 255, 180), rgb(200, 120, 255)],
    nevoa: [30, 90, 84],
  },
};

/** A TEMPESTADE (19/11/2026): por cima das nuvens escuras, curta e cheia de curvas, com dois trechos abertos. */
export const TEMPESTADE: DefinicaoDoJato = {
  id: 'tempestade-1',
  pontos: [
    [260, 200], [520, 150], [760, 230], [860, 420], [700, 520], [520, 470], [380, 560], [460, 720], [700, 700],
    [820, 840], [560, 920], [300, 860], [160, 680], [150, 420],
  ],
  meiaLargura: 36,
  voltas: 4,
  placas: [[0.12, -0.4], [0.4, 0.3], [0.7, -0.3], [0.9, 0.4]],
  recargas: [[0.03, 0.1]],
  abertos: [[0.27, 0.32], [0.78, 0.83]],
  semente: 53,
  tema: {
    ceu: { topo: [30, 30, 50], meio: [80, 78, 110], baixo: [130, 128, 150] },
    fundo: 'nuvens',
    piso: [rgb(78, 76, 96), rgb(84, 82, 102), rgb(72, 70, 90)],
    costura: rgb(54, 52, 70),
    luz: rgb(200, 220, 255),
    borda: [rgb(255, 236, 120), rgb(140, 170, 255)],
    nevoa: [110, 108, 132],
  },
};

/**
 * OS PERIGOS (21/11/2026, a segunda auditoria: "um elemento de cada pista que tira energia ou atrapalha"). Andam pelo PASSO
 * da corrida de cada um (o tempo é de passos): no mesmo passo estão no mesmo lugar em todo computador, e quem vê os outros
 * no mesmo passo os vê iguais. O servidor não os conhece (como não conhece a borda): quem leva um só fica mais lento.
 * - O METEORO atravessa a pista de um lado ao outro e volta, num ponto da volta; encostar nele cobra energia e freia.
 * - O LASER corta a pista inteira de lado a lado: liga, desliga, e pisca antes de ligar; passar com ele ligado cobra e freia.
 * Só nas pistas novas: nas cinco de antes a física é a mesma, e os recordes e fantasmas delas valem como eram.
 */
export interface Perigo {
  tipo: 'meteoro' | 'laser';
  /** Onde fica, em fração da volta. */
  f: number;
  /** Onde começa o ciclo dele, em passos. */
  fase: number;
}
export const CICLO_DO_METEORO = 160;
export const RAIO_DO_METEORO = 13;
export const CICLO_DO_LASER = 200;
/** O laser fica ligado nos primeiros LASER_LIGADO passos do ciclo, e pisca nos AVISO_DO_LASER antes de ligar. */
export const LASER_LIGADO = 50;
export const AVISO_DO_LASER = 30;
/** O que cada um faz: a energia que cobra e quanto da velocidade sobra. */
export const DANO_DO_PERIGO = { meteoro: 8, laser: 12 } as const;
export const SOBRA_DO_PERIGO = { meteoro: 0.5, laser: 0.4 } as const;

const ciclo = (passos: number, fase: number, total: number) => (((passos + fase) % total) + total) % total;

/** De que lado do meio está o meteoro no passo `passos`, em unidades (vai e volta, de −0,85 a 0,85 da meia largura). */
export function ladoDoMeteoro(pe: Perigo, meiaLargura: number, passos: number): number {
  const t = ciclo(passos, pe.fase, CICLO_DO_METEORO) / CICLO_DO_METEORO;
  const tri = t < 0.5 ? t * 4 - 1 : 3 - t * 4;
  return tri * meiaLargura * 0.85;
}

/** O laser está ligado neste passo? E quantos passos faltam para ligar (0 se ligado). */
export const laserLigado = (pe: Perigo, passos: number) => ciclo(passos, pe.fase, CICLO_DO_LASER) < LASER_LIGADO;
export const passosAteOLaser = (pe: Perigo, passos: number) => {
  const t = ciclo(passos, pe.fase, CICLO_DO_LASER);
  return t < LASER_LIGADO ? 0 : CICLO_DO_LASER - t;
};

/**
 * O perigo que pega a nave que andou de `de` a `ate` (o s da linha do meio) e está a `lado` do meio, no passo `passos`; ou null.
 * O laser pega quem CRUZOU a linha dele neste passo (a nave anda até 7 unidades por passo); o meteoro, quem está encostado.
 */
export function perigoQueAtinge(p: Pick<PistaDoJato, 'def' | 'comprimento'>, de: number, ate: number, lado: number, passos: number): Perigo | null {
  const C = p.comprimento;
  for (const pe of p.def.perigos ?? []) {
    const s = pe.f * C;
    const ds = (((ate - s) % C) + C * 1.5) % C - C / 2;
    if (pe.tipo === 'meteoro') {
      if (Math.hypot(ds, lado - ladoDoMeteoro(pe, p.def.meiaLargura, passos)) < RAIO_DO_METEORO) return pe;
    } else if (laserLigado(pe, passos)) {
      const antes = (((de - s) % C) + C * 1.5) % C - C / 2;
      if (antes < 0 && ds >= 0 && ds < 40) return pe;
    }
  }
  return null;
}

/** O CINTURÃO DE ASTEROIDES (21/11/2026): no espaço, a volta longa entre as rochas, e os METEOROS que cruzam a pista. */
export const ASTEROIDES: DefinicaoDoJato = {
  id: 'asteroides-1',
  pontos: [
    [200, 200], [470, 140], [740, 190], [890, 340], [800, 500], [880, 680], [760, 880], [520, 860], [420, 700],
    [260, 820], [120, 640], [200, 460], [120, 320],
  ],
  meiaLargura: 38,
  voltas: 3,
  placas: [[0.12, 0.4], [0.4, -0.4], [0.62, 0.3], [0.86, -0.3]],
  recargas: [[0.03, 0.1]],
  abertos: [[0.7, 0.75]],
  perigos: [
    { tipo: 'meteoro', f: 0.2, fase: 0 },
    { tipo: 'meteoro', f: 0.32, fase: 80 },
    { tipo: 'meteoro', f: 0.52, fase: 40 },
    { tipo: 'meteoro', f: 0.78, fase: 120 },
    { tipo: 'meteoro', f: 0.93, fase: 60 },
  ],
  semente: 61,
  tema: {
    ceu: { topo: [10, 8, 20], meio: [30, 22, 46], baixo: [80, 50, 60] },
    fundo: 'espaco',
    piso: [rgb(80, 70, 70), rgb(86, 76, 76), rgb(74, 64, 64)],
    costura: rgb(50, 44, 46),
    luz: rgb(255, 170, 110),
    borda: [rgb(255, 150, 80), rgb(120, 200, 255)],
    nevoa: [60, 40, 54],
  },
};

/** A AVENIDA NEON (21/11/2026): por cima da cidade, retas longas cortadas pelos LASERS que ligam e desligam. */
export const AVENIDA: DefinicaoDoJato = {
  id: 'avenida-1',
  pontos: [
    [220, 170], [520, 140], [800, 180], [900, 380], [820, 560], [620, 520], [480, 620], [620, 760], [860, 800],
    [780, 920], [460, 910], [220, 860], [120, 640], [150, 380],
  ],
  meiaLargura: 38,
  voltas: 3,
  placas: [[0.08, -0.4], [0.3, 0.3], [0.58, -0.3], [0.8, 0.4]],
  recargas: [[0.02, 0.09]],
  abertos: [[0.44, 0.49]],
  perigos: [
    { tipo: 'laser', f: 0.16, fase: 0 },
    { tipo: 'laser', f: 0.38, fase: 70 },
    { tipo: 'laser', f: 0.66, fase: 130 },
    { tipo: 'laser', f: 0.9, fase: 40 },
  ],
  semente: 73,
  tema: {
    ceu: { topo: [20, 8, 40], meio: [70, 24, 90], baixo: [170, 60, 120] },
    fundo: 'cidade',
    piso: [rgb(50, 46, 76), rgb(56, 52, 82), rgb(46, 42, 70)],
    costura: rgb(34, 30, 54),
    luz: rgb(255, 90, 200),
    borda: [rgb(255, 80, 200), rgb(90, 240, 255)],
    nevoa: [96, 40, 100],
  },
};

export const PISTAS_DO_JATO = [CIDADE, ORBITA, NUVENS, AURORA, TEMPESTADE, ASTEROIDES, AVENIDA];

/** As copas do Solo contra o computador (19/11/2026): três pistas seguidas, pontos pela posição. Só no site: não vale nada no servidor. */
export const COPAS_DO_JATO: Record<string, string[]> = {
  'copa-estelar': ['cidade-1', 'orbita-1', 'nuvens-1'],
  'copa-da-tempestade': ['aurora-1', 'tempestade-1', 'orbita-1'],
  // a terceira (21/11/2026): as duas pistas com perigos e a cidade
  'copa-dos-perigos': ['avenida-1', 'asteroides-1', 'cidade-1'],
};
/** Os pontos por posição na copa, entre as 12 naves. */
export const PONTOS_DA_COPA_DO_JATO = [15, 12, 10, 8, 7, 6, 5, 4, 3, 2, 1, 0];
export const pistaDoJatoPorId = (id: string) => PISTAS_DO_JATO.find((p) => p.id === id) ?? CIDADE;

export interface PistaDoJato {
  def: DefinicaoDoJato;
  lx: Float32Array;
  ly: Float32Array;
  /** O comprimento acumulado até cada ponto (la[n] é a volta inteira). */
  la: Float32Array;
  comprimento: number;
  /** A curvatura de cada ponto (1/raio), olhando um pouco à frente: o piloto automático e os robôs freiam por ela. */
  curva: Float32Array;
  /** Cada ponto: está num trecho aberto (sem borda)? */
  aberto: Uint8Array;
  chao: Uint8Array;
  textura: Uint32Array;
  /** Os postes da borda de energia, para o desenho (de pé, dos dois lados). */
  postes: { x: number; y: number }[];
  /** De onde se larga: 100 unidades antes da linha, no meio, olhando o sentido da corrida. */
  largada: { x: number; y: number; angulo: number; indice: number };
}

/** Catmull-Rom fechada: `porTrecho` pontos entre cada par de pontos de controle. */
function linhaDoMeio(pontos: [number, number][], porTrecho: number) {
  const n = pontos.length;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = pontos[(i - 1 + n) % n], p1 = pontos[i], p2 = pontos[(i + 1) % n], p3 = pontos[(i + 2) % n];
    for (let k = 0; k < porTrecho; k++) {
      const t = k / porTrecho, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      xs.push(f(p0[0], p1[0], p2[0], p3[0]));
      ys.push(f(p0[1], p1[1], p2[1], p3[1]));
    }
  }
  return { xs, ys };
}

/** Só a linha do meio, sem o chão nem a textura (o mapa da escolha, os marcos do servidor). */
export function linhaDoJato(def: Pick<DefinicaoDoJato, 'pontos'>) {
  const { xs, ys } = linhaDoMeio(def.pontos, 24);
  const n = xs.length;
  const lx = Float32Array.from(xs), ly = Float32Array.from(ys);
  const la = new Float32Array(n + 1);
  for (let i = 0; i < n; i++) la[i + 1] = la[i] + Math.hypot(lx[(i + 1) % n] - lx[i], ly[(i + 1) % n] - ly[i]);
  return { lx, ly, la, comprimento: la[n] };
}

/** O ponto da linha do meio a `s` unidades da linha de chegada (dá a volta). */
export function pontoNaLinha(l: { lx: Float32Array; ly: Float32Array; la: Float32Array; comprimento: number }, s: number) {
  const n = l.lx.length;
  const sv = ((s % l.comprimento) + l.comprimento) % l.comprimento;
  let lo = 0, hi = n - 1;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (l.la[m] <= sv) lo = m;
    else hi = m - 1;
  }
  const a = lo, b = (lo + 1) % n;
  const seg = l.la[lo + 1] - l.la[lo] || 1;
  const t = (sv - l.la[lo]) / seg;
  const dx = l.lx[b] - l.lx[a], dy = l.ly[b] - l.ly[a], len = Math.hypot(dx, dy) || 1;
  return { x: l.lx[a] + dx * t, y: l.ly[a] + dy * t, dx: dx / len, dy: dy / len, indice: a };
}

/** Os marcos da volta: `quantos` pontos igualmente espaçados da linha do meio (o servidor exige passar por todos, em ordem). */
export function marcosDoJato(def: Pick<DefinicaoDoJato, 'pontos'>, quantos: number): [number, number][] {
  const l = linhaDoJato(def);
  const marcos: [number, number][] = [];
  for (let k = 1; k <= quantos; k++) {
    const q = pontoNaLinha(l, (k / (quantos + 1)) * l.comprimento);
    marcos.push([q.x, q.y]);
  }
  return marcos;
}

/** Quanto antes da linha de chegada fica a largada (os robôs fazem a grade entre ela e a linha). */
export const RECUO_DA_LARGADA = 100;

/** A largada, sem montar a pista inteira (o servidor tem o mesmo ponto: server/src/jato.ts). */
export function largadaDoJato(def: Pick<DefinicaoDoJato, 'pontos'>) {
  const l = linhaDoJato(def);
  const q = pontoNaLinha(l, l.comprimento - RECUO_DA_LARGADA);
  return { x: q.x, y: q.y, angulo: Math.atan2(q.dy, q.dx), indice: q.indice };
}

const dentro = (f: number, trechos: [number, number][]) => trechos.some(([a, b]) => f >= a && f <= b);

export function montarPistaDoJato(def: DefinicaoDoJato = CIDADE): PistaDoJato {
  const { lx, ly, la, comprimento } = linhaDoJato(def);
  const n = lx.length;

  // A CURVATURA de cada ponto: o quanto a direção vira entre 6 pontos antes e 6 depois, pela distância entre eles
  const curva = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i - 6 + n) % n, b = (i + 6) % n;
    const d1x = lx[i] - lx[a], d1y = ly[i] - ly[a], d2x = lx[b] - lx[i], d2y = ly[b] - ly[i];
    const ang = Math.abs(Math.atan2(d1x * d2y - d1y * d2x, d1x * d2x + d1y * d2y));
    const dist = Math.hypot(d1x, d1y) + Math.hypot(d2x, d2y);
    curva[i] = ang / (dist / 2 || 1);
  }
  const aberto = new Uint8Array(n);
  for (let i = 0; i < n; i++) aberto[i] = dentro(la[i] / comprimento, def.abertos) ? 1 : 0;

  // A DISTÂNCIA até a linha do meio e o quanto se andou nela, ponto a ponto (cada trecho pinta só a caixa em volta dele)
  const hw = def.meiaLargura;
  const MAX = hw + 12;
  const dist = new Float32Array(RES * RES).fill(1e9);
  const ao = new Float32Array(RES * RES);
  const lado = new Float32Array(RES * RES);
  for (let i = 0; i < n; i++) {
    const ax = lx[i], ay = ly[i], bx = lx[(i + 1) % n], by = ly[(i + 1) % n];
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, seg = Math.sqrt(l2);
    const x0 = Math.max(0, Math.floor((Math.min(ax, bx) - MAX) * K)), x1 = Math.min(RES - 1, Math.ceil((Math.max(ax, bx) + MAX) * K));
    const y0 = Math.max(0, Math.floor((Math.min(ay, by) - MAX) * K)), y1 = Math.min(RES - 1, Math.ceil((Math.max(ay, by) + MAX) * K));
    for (let ty = y0; ty <= y1; ty++) {
      const py = (ty + 0.5) / K;
      for (let tx = x0; tx <= x1; tx++) {
        const px = (tx + 0.5) / K;
        let t = ((px - ax) * dx + (py - ay) * dy) / l2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = ax + t * dx - px, qy = ay + t * dy - py;
        const d = qx * qx + qy * qy;
        const k = ty * RES + tx;
        if (d < dist[k]) {
          dist[k] = d;
          ao[k] = la[i] + t * seg;
          // de que lado do meio: o mesmo sinal da física (a normal é (−dy, dx))
          lado[k] = (-(px - ax) * dy + (py - ay) * dx) / seg;
        }
      }
    }
  }

  const T = def.tema;
  const chao = new Uint8Array(RES * RES).fill(Chao.Vazio);
  const textura = new Uint32Array(RES * RES);
  const BORDA = 3;
  for (let k = 0; k < RES * RES; k++) {
    if (dist[k] > (hw + BORDA + 1) * (hw + BORDA + 1)) continue;
    const tx = k % RES, ty = (k / RES) | 0;
    const d = Math.sqrt(dist[k]);
    const s = ao[k];
    const f = s / comprimento;
    const ab = dentro(f, def.abertos);
    let tipo: Chao, cor: number;
    if (d < hw) {
      tipo = Chao.Pista;
      // as placas do piso, 16 × 16 unidades ao longo da pista, com a costura escura entre elas
      const u = s % 16, v = (lado[k] + 64) % 16;
      const placa = ((Math.floor(s / 16) + Math.floor((lado[k] + 64) / 16)) & 1) + (((tx * 7 + ty * 13) >> 4) & 1);
      cor = u < 0.6 || v < 0.6 ? T.costura : T.piso[placa % 3];
      // AS FAIXAS DE LUZ que atravessam a pista a cada 48 unidades: é o que faz a velocidade se ver
      if (s % 48 < 1.6) cor = T.luz;
      // as linhas das três faixas, tracejadas
      if (Math.abs(Math.abs(lado[k]) - hw / 3) < 0.5 && Math.floor(s / 12) % 2 === 0) cor = rgb(200, 204, 230);
      // perto da borda aberta, o aviso: as listras amarelas e pretas na beirada
      if (ab && d > hw - 5) {
        tipo = Chao.Aviso;
        cor = Math.floor((s + lado[k]) / 4) % 2 === 0 ? rgb(250, 200, 60) : rgb(30, 26, 34);
      }
      // a recarga: a faixa do meio, cor-de-rosa, com as cruzes que brilham
      if (dentro(f, def.recargas) && Math.abs(lado[k]) < hw * 0.4) {
        tipo = Chao.Recarga;
        const cx = s % 14, cy = (lado[k] + 64) % 14;
        cor = (Math.abs(cx - 7) < 1 && Math.abs(cy - 7) < 4) || (Math.abs(cy - 7) < 1 && Math.abs(cx - 7) < 4) ? rgb(255, 236, 250) : (Math.floor(s / 7) & 1 ? rgb(232, 96, 168) : rgb(206, 74, 148));
      }
      // as placas de impulso: chevrons amarelos apontando para a frente
      for (const [pf, pl] of def.placas) {
        const ds = s - pf * comprimento, dl = lado[k] - pl * hw;
        if (ds >= 0 && ds < 22 && Math.abs(dl) < 11) {
          tipo = Chao.Placa;
          const uu = ds % 8;
          cor = Math.abs(uu - 4 - Math.abs(dl) * 0.45) < 1.4 ? rgb(255, 236, 120) : rgb(200, 110, 30);
        }
      }
      // a linha de chegada: quadriculada de lado a lado
      if (s < 6 || s > comprimento - 1) cor = ((Math.floor(s / 3) + Math.floor((lado[k] + 64) / 3)) & 1) ? rgb(240, 236, 246) : rgb(26, 22, 34);
    } else if (!ab) {
      // a borda de energia, nos dois tons que se alternam
      tipo = Chao.Borda;
      cor = Math.floor(s / 10) % 2 === 0 ? T.borda[0] : T.borda[1];
      if (d > hw + BORDA - 1) cor = rgb(30, 26, 40);
    } else continue;
    chao[k] = tipo;
    textura[k] = cor;
  }

  // os postes da borda: um a cada 40 unidades, dos dois lados, só onde há borda
  const postes: { x: number; y: number }[] = [];
  for (let s = 20; s < comprimento; s += 40) {
    if (dentro(s / comprimento, def.abertos)) continue;
    const q = pontoNaLinha({ lx, ly, la, comprimento }, s);
    for (const l of [-1, 1]) postes.push({ x: q.x - q.dy * (hw + 2) * l, y: q.y + q.dx * (hw + 2) * l });
  }

  return { def, lx, ly, la, comprimento, curva, aberto, chao, textura, postes, largada: largadaDoJato(def) };
}

/** O chão do mapa num ponto do mundo (fora do mapa é o vazio). */
export function chaoEm(p: PistaDoJato, x: number, y: number): Chao {
  const tx = Math.floor(x * K), ty = Math.floor(y * K);
  if (tx < 0 || ty < 0 || tx >= RES || ty >= RES) return Chao.Vazio;
  return p.chao[ty * RES + tx] as Chao;
}

/** O ponto da linha do meio mais perto, procurando perto do último (a nave não pula de um lado da pista ao outro). */
export function pontoMaisPerto(p: { lx: Float32Array; ly: Float32Array }, x: number, y: number, ultimo: number, janela = 16): number {
  const n = p.lx.length;
  let melhor = ultimo, md = Infinity;
  for (let k = -janela; k <= janela; k++) {
    const i = (((ultimo + k) % n) + n) % n;
    const d = (p.lx[i] - x) ** 2 + (p.ly[i] - y) ** 2;
    if (d < md) {
      md = d;
      melhor = i;
    }
  }
  return melhor;
}

/** Onde está um ponto em relação à linha do meio, perto do ponto `i`: o quanto se andou (s), o lado e a direção ali. */
export function naLinha(p: PistaDoJato, x: number, y: number, i: number) {
  const n = p.lx.length;
  // o trecho que começa em i, ou o que termina nele: o que tiver a projeção dentro
  const trecho = (a: number) => {
    const b = (a + 1) % n;
    const dx = p.lx[b] - p.lx[a], dy = p.ly[b] - p.ly[a], l2 = dx * dx + dy * dy || 1, l = Math.sqrt(l2);
    const t = ((x - p.lx[a]) * dx + (y - p.ly[a]) * dy) / l2;
    return { a, t, dx: dx / l, dy: dy / l, l };
  };
  let q = trecho(i);
  if (q.t < 0) q = trecho((i - 1 + n) % n);
  const t = Math.max(0, Math.min(1, q.t));
  const px = p.lx[q.a] + q.dx * q.l * t, py = p.ly[q.a] + q.dy * q.l * t;
  return { s: p.la[q.a] + q.l * t, lado: -(x - px) * q.dy + (y - py) * q.dx, dx: q.dx, dy: q.dy, aberto: p.aberto[q.a] === 1 };
}

export { sorteio };
