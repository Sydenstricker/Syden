/**
 * A FÍSICA DO MINIGOLFE 3D (05/11/2026). UM ARQUIVO SÓ, EM DOIS LUGARES: server/src/golfe3d-fisica.ts e
 * web/src/golfe3d/fisica.ts são o MESMO texto, byte a byte (web/test/golfe3d.test.ts confere). Mexeu num, copie no outro.
 *
 * É o irmão em 3D do Minigolfe da toca (golfe-fisica.ts), e segue as mesmas regras: o servidor não confia no "acertei" do
 * site; cada tacada vai ao servidor na hora (o passo do relógio do buraco e o vetor em inteiros), e ele a SIMULA com este
 * código. O site simula igual para mostrar sem esperar a rede.
 *
 * O BURACO É UMA GRADE DE PEÇAS do Minigolf Kit da Kenney (CC0): cada casa tem uma peça, um giro (0 a 3 quartos de volta, o
 * mesmo `rotation.y` do three.js) e a altura da base. A física continua no PLANO (x, z), com a ALTURA de cada peça: a rampa é
 * um gradiente que freia quem sobe e acelera quem desce, o monte e a lombada empurram para os lados, e cair num buraco do
 * chão ou para fora da pista devolve a bola, com uma tacada a mais. As paredes são polígonos (retângulos e arcos), medidos nos
 * próprios modelos (a casa tem 1 de lado; o chão fica a 0,0633 e a parede vai de 0,4 a 0,5 do centro).
 *
 * DETERMINISMO, como no golfe da toca: só + − × ÷ e Math.sqrt (mais floor, ceil e abs, que são exatos). Nada de seno nem
 * cosseno: os giros são de quartos de volta (0 e ±1), e os arcos saem de uma parametrização racional do círculo.
 */

/** A altura do chão de uma peça (medida nos modelos): a bola rola em cima dele. */
export const CHAO = 0.0633;
export const RAIO_BOLA = 0.03;
export const RAIO_BURACO = 0.07;
/** A tacada é (dx, dz) inteiros, com o tamanho entre FORCA_MIN e FORCA_MAX. */
export const FORCA_MAX = 1000;
export const FORCA_MIN = 30;
/** A velocidade da força toda, em casas por passo (1/60 s). */
export const VELOCIDADE_MAX = 0.15;
export const ATRITO = 0.982;
export const FREIO = 0.0004;
export const PARADA = 0.0015;
/** Abaixo desta velocidade, a bola que passa sobre o buraco cai. */
export const CAPTURA = 0.065;
export const QUIQUE_PAREDE = 0.7;
/** A gravidade: quanto a inclinação tira (ou dá) de velocidade a cada passo. */
export const GRAVIDADE = 0.01;
/** Abaixo desta inclinação, a bola lenta para; acima, ela continua rolando ladeira abaixo. */
export const INCLINACAO_PARADA = 0.05;
/** O tamanho máximo de cada pedaço de movimento dentro do passo: metade do raio, para não atravessar parede. */
const PEDACO = RAIO_BOLA / 2;
/** Uma tacada não rola mais que isto (20 s). */
export const PASSOS_MAX_DA_TACADA = 60 * 20;
/** O limite de tacadas no buraco (cair fora conta uma). Quem chega nele sem acertar fica com TACADAS_MAX + 1. */
export const TACADAS_MAX = 6;

export type Peca =
  | 'reta'
  | 'fim'
  | 'canto'
  | 'curva'
  | 'buraco'
  | 'buraco-aberto'
  | 'rampa-baixa'
  | 'rampa-media'
  | 'rampa'
  | 'monte'
  | 'cova'
  | 'lombada'
  | 'bloco'
  | 'losango'
  | 'triangulos'
  | 'estreito'
  | 'castelo'
  | 'moinho'
  | 'lacuna'
  | 'tunel'
  | 'lado'
  | 'aberto'
  | 'canto-interno';

/** Uma casa da grade: [peça, coluna (x), linha (z), giro (quartos de volta), altura da base]. */
export type Casa = [Peca, number, number, number, number];

export interface Buraco {
  par: number;
  /** Onde a bola começa (x, z), no meio de uma casa. */
  inicio: [number, number];
  casas: Casa[];
}

/** A subida de cada rampa, de uma ponta à outra da casa (medida nos modelos). */
export const SUBIDA: Partial<Record<Peca, number>> = { 'rampa-baixa': 0.1, 'rampa-media': 0.25, rampa: 0.5 };

const c = (peca: Peca, x: number, z: number, giro = 0, base = 0): Casa => [peca, x, z, giro, base];

/**
 * OS BURACOS, na ordem do jogo. O x cresce para a direita e o z para baixo (no mapa de cima). As peças abertas: a reta vai de
 * −z a +z; o fim só abre para −z (giro 2: para +z); o canto e a curva abrem para −x e −z (giro 1: −x e +z; 2: +x e +z; 3: +x
 * e −z); a rampa sobe para +z (giro 1: +x; 2: −z; 3: −x). Buraco novo: as alturas iguais nas bordas abertas, e o teste do
 * piloto (web/test/golfe3d.test.ts) confere que dá para acertar.
 */
export const BURACOS: Buraco[] = [
  {
    // 1. A reta, com um montinho no meio do caminho.
    par: 2,
    inicio: [0, 0],
    casas: [c('fim', 0, 0, 2), c('reta', 0, 1), c('monte', 0, 2), c('reta', 0, 3), c('buraco', 0, 4)],
  },
  {
    // 2. A curva: desce e vira para a direita.
    par: 2,
    inicio: [0, 0],
    casas: [c('fim', 0, 0, 2), c('reta', 0, 1), c('curva', 0, 2, 3), c('reta', 1, 2, 1), c('bloco', 2, 2, 1), c('buraco', 3, 2, 1)],
  },
  {
    // 3. A subida: uma rampa até o castelo, lá em cima.
    par: 3,
    inicio: [0, 0],
    casas: [c('fim', 0, 0, 2), c('reta', 0, 1), c('rampa-media', 0, 2, 0, 0), c('reta', 0, 3, 0, 0.25), c('castelo', 0, 4, 0, 0.25), c('buraco', 0, 5, 0, 0.25)],
  },
  {
    // 4. O campo largo: três de largura, com o losango e os triângulos no meio.
    par: 3,
    inicio: [1, 0],
    casas: [
      c('canto', 0, 0, 2),
      c('lado', 1, 0, 1),
      c('canto', 2, 0, 1),
      c('lado', 0, 1, 2),
      c('aberto', 1, 1),
      c('lado', 2, 1, 0),
      c('lado', 0, 2, 2),
      c('losango', 1, 2),
      c('lado', 2, 2, 0),
      c('lado', 0, 3, 2),
      c('triangulos', 1, 3),
      c('lado', 2, 3, 0),
      c('lado', 0, 4, 2),
      c('buraco-aberto', 1, 4),
      c('lado', 2, 4, 0),
      c('canto', 0, 5, 3),
      c('lado', 1, 5, 3),
      c('canto', 2, 5, 0),
    ],
  },
  {
    // 5. O moinho: o bloco no caminho, e a passagem estreita debaixo dele.
    par: 3,
    inicio: [0, 0],
    casas: [c('fim', 0, 0, 2), c('bloco', 0, 1), c('moinho', 0, 2), c('reta', 0, 3), c('buraco', 0, 4)],
  },
  {
    // 6. O "S": a lombada, a curva, o buraco no chão e a volta.
    par: 3,
    inicio: [0, 0],
    casas: [
      c('fim', 0, 0, 2),
      c('lombada', 0, 1),
      c('curva', 0, 2, 3),
      c('reta', 1, 2, 1),
      c('curva', 2, 2, 1),
      c('lacuna', 2, 3),
      c('reta', 2, 4),
      c('buraco', 2, 5),
    ],
  },
  {
    // 7. O morro: a rampa grande, o estreito lá em cima e a descida.
    par: 3,
    inicio: [0, 0],
    casas: [
      c('fim', 0, 0, 2),
      c('rampa', 0, 1, 0, 0),
      c('reta', 0, 2, 0, 0.5),
      c('curva', 0, 3, 3, 0.5),
      c('estreito', 1, 3, 1, 0.5),
      c('rampa-media', 2, 3, 3, 0.25),
      c('curva', 3, 3, 1, 0.25),
      c('buraco', 3, 4, 0, 0.25),
    ],
  },
  {
    // 8. O castelo: a volta em "U", com o bloco, a cova e o castelo no caminho.
    par: 4,
    inicio: [0, 0],
    casas: [
      c('fim', 0, 0, 2),
      c('bloco', 0, 1),
      c('reta', 0, 2),
      c('curva', 0, 3, 3),
      c('monte', 1, 3, 1),
      c('castelo', 2, 3, 1),
      c('curva', 3, 3, 0),
      c('reta', 3, 2),
      c('cova', 3, 1),
      c('buraco', 3, 0, 2),
    ],
  },
];

// ——— as formas das peças, no sistema da peça (u para +x, v para +z, de −0,5 a 0,5) ———

const ret = (x0: number, z0: number, x1: number, z1: number) => [x0, z0, x1, z0, x1, z1, x0, z1];
const PAREDE_X = ret(0.4, -0.5, 0.5, 0.5);
const PAREDE_X_NEG = ret(-0.5, -0.5, -0.4, 0.5);
const PAREDE_Z = ret(-0.5, 0.4, 0.5, 0.5);
const LADOS = [PAREDE_X, PAREDE_X_NEG];

/** Um quarto de círculo sem trigonometria: os pontos ((1 − t²)/(1 + t²), 2t/(1 + t²)), de t = 0 (ângulo 0) a t = 1 (90°). */
function quartoDeCirculo(n: number): [number, number][] {
  const p: [number, number][] = [];
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const d = 1 + t * t;
    p.push([(1 - t * t) / d, (2 * t) / d]);
  }
  return p;
}
const QUARTO = quartoDeCirculo(8);

/** A parede em arco: o anel entre `r0` e `r1` em volta de (cx, cz), pelos pontos (cos, sen) dados. */
function arco(cx: number, cz: number, r0: number, r1: number, pontos: [number, number][]): number[] {
  const p: number[] = [];
  for (const [a, b] of pontos) p.push(cx + a * r0, cz + b * r0);
  for (let k = pontos.length - 1; k >= 0; k--) p.push(cx + pontos[k][0] * r1, cz + pontos[k][1] * r1);
  return p;
}

/** A altura da peça e a inclinação dela: [h, ∂h/∂u, ∂h/∂v]. */
type Relevo = (u: number, v: number) => [number, number, number];

/** O monte redondo (ou a cova, com `a` negativo): a(1 − r²/R²)², de raio R. */
function monte(a: number, r: number): Relevo {
  return (u, v) => {
    const q = (u * u + v * v) / (r * r);
    if (q >= 1) return [0, 0, 0];
    const k = 1 - q;
    const d = (-4 * a * k) / (r * r);
    return [a * k * k, d * u, d * v];
  };
}
/** A lombada de lado a lado: a(1 − v²/L²)², de meia largura L. */
function lombada(a: number, l: number): Relevo {
  return (_u, v) => {
    const q = (v * v) / (l * l);
    if (q >= 1) return [0, 0, 0];
    const k = 1 - q;
    return [a * k * k, 0, ((-4 * a * k) / (l * l)) * v];
  };
}
const rampa =
  (subida: number): Relevo =>
  (_u, v) => [subida * (v + 0.5), 0, subida];

interface Forma {
  paredes: number[][];
  /** Os buracos do chão (a bola cai e volta). */
  fossos: number[][];
  relevo: Relevo | null;
  /** A peça tem o buraco no meio. */
  buraco: boolean;
}
const forma = (paredes: number[][], extra: Partial<Forma> = {}): Forma => ({ paredes, fossos: [], relevo: null, buraco: false, ...extra });

export const FORMAS: Record<Peca, Forma> = {
  reta: forma(LADOS),
  tunel: forma(LADOS),
  fim: forma([...LADOS, PAREDE_Z]),
  canto: forma([PAREDE_X, PAREDE_Z]),
  // a curva liga −z a −x pela volta de fora, com o pilarzinho no canto de dentro
  curva: forma([arco(-0.5, -0.5, 0.9, 1, QUARTO), ret(-0.5, -0.5, -0.4, -0.4)]),
  // o fim arredondado, com o buraco no meio
  buraco: forma([ret(0.4, -0.5, 0.5, 0), ret(-0.5, -0.5, -0.4, 0), arco(0, 0, 0.4, 0.5, [...QUARTO, ...QUARTO.slice(1).map(([a, b]): [number, number] => [-b, a])])], { buraco: true }),
  'buraco-aberto': forma([], { buraco: true }),
  'rampa-baixa': forma(LADOS, { relevo: rampa(0.1) }),
  'rampa-media': forma(LADOS, { relevo: rampa(0.25) }),
  rampa: forma(LADOS, { relevo: rampa(0.5) }),
  monte: forma(LADOS, { relevo: monte(0.04, 0.32) }),
  cova: forma(LADOS, { relevo: monte(-0.03, 0.32) }),
  lombada: forma(LADOS, { relevo: lombada(0.09, 0.3) }),
  bloco: forma([...LADOS, ret(-0.1, -0.3, 0.1, 0.3)]),
  losango: forma([[0, -0.25, 0.25, 0, 0, 0.25, -0.25, 0]]),
  triangulos: forma([
    [-0.3, -0.3, -0.07, -0.3, -0.3, -0.07],
    [0.3, 0.3, 0.07, 0.3, 0.3, 0.07],
  ]),
  estreito: forma([...LADOS, ret(0.2, -0.25, 0.4, 0.25), ret(-0.4, -0.25, -0.2, 0.25)]),
  castelo: forma([...LADOS, ret(-0.4, -0.15, -0.12, 0.15), ret(0.12, -0.15, 0.4, 0.15)]),
  moinho: forma([...LADOS, ret(-0.4, -0.45, -0.15, 0.38), ret(0.15, -0.45, 0.4, 0.38)]),
  lacuna: forma(LADOS, { fossos: [ret(-0.2, -0.25, 0.2, 0.22)] }),
  lado: forma([PAREDE_X]),
  aberto: forma([]),
  'canto-interno': forma([ret(0.4, -0.5, 0.5, -0.4)]),
};

// ——— o giro: o mesmo do rotation.y do three.js, em quartos de volta (x' = cos·u + sen·v; z' = −sen·u + cos·v) ———

const COS = [1, 0, -1, 0];
const SEN = [0, 1, 0, -1];
const giroDe = (g: number) => ((g % 4) + 4) % 4;

/** O ponto da peça (u, v) no buraco, para a casa (cx, cz) com o giro g. */
export function paraOBuraco(cx: number, cz: number, g: number, u: number, v: number): [number, number] {
  const k = giroDe(g);
  return [cx + COS[k] * u + SEN[k] * v, cz - SEN[k] * u + COS[k] * v];
}
function paraAPeca(cx: number, cz: number, g: number, x: number, z: number): [number, number] {
  const k = giroDe(g);
  const dx = x - cx;
  const dz = z - cz;
  return [COS[k] * dx - SEN[k] * dz, SEN[k] * dx + COS[k] * dz];
}

// ——— o buraco montado: as casas numa grade, as paredes em segmentos, guardado por buraco ———

interface CasaMontada {
  peca: Peca;
  cx: number;
  cz: number;
  giro: number;
  base: number;
  forma: Forma;
  /** Os fossos, já no buraco. */
  fossos: number[][];
}
export interface Montado {
  /** O canto de cima à esquerda da grade e o tamanho dela, em casas. */
  x0: number;
  z0: number;
  colunas: number;
  linhas: number;
  casas: (CasaMontada | null)[];
  /** Os segmentos das paredes (x1, z1, x2, z2) que interessam a cada casa (dela e das vizinhas). */
  perto: number[][];
  /** Todas as paredes, já no buraco (para o desenho e o piloto). */
  paredes: number[][];
  buraco: [number, number];
  /** O retângulo do buraco inteiro, para conferir o tempo real. */
  limites: [number, number, number, number];
}

const MONTADOS = new WeakMap<Buraco, Montado>();
export function montar(b: Buraco): Montado {
  const pronto = MONTADOS.get(b);
  if (pronto) return pronto;
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (const [, x, z] of b.casas) {
    x0 = Math.min(x0, x);
    z0 = Math.min(z0, z);
    x1 = Math.max(x1, x);
    z1 = Math.max(z1, z);
  }
  const colunas = x1 - x0 + 1;
  const linhas = z1 - z0 + 1;
  const casas: (CasaMontada | null)[] = new Array(colunas * linhas).fill(null);
  const segmentosDaCasa: number[][] = casas.map(() => []);
  const paredes: number[][] = [];
  let buraco: [number, number] = [b.inicio[0], b.inicio[1]];
  for (const [peca, cx, cz, giro, base] of b.casas) {
    const f = FORMAS[peca];
    const doBuraco = (p: number[]) => {
      const q: number[] = [];
      for (let i = 0; i < p.length; i += 2) q.push(...paraOBuraco(cx, cz, giro, p[i], p[i + 1]));
      return q;
    };
    const i = (cz - z0) * colunas + (cx - x0);
    casas[i] = { peca, cx, cz, giro, base, forma: f, fossos: f.fossos.map(doBuraco) };
    for (const p of f.paredes) {
      const q = doBuraco(p);
      paredes.push(q);
      const n = q.length / 2;
      for (let k = 0; k < n; k++) {
        const j = (k + 1) % n;
        segmentosDaCasa[i].push(q[k * 2], q[k * 2 + 1], q[j * 2], q[j * 2 + 1]);
      }
    }
    if (f.buraco) buraco = [cx, cz];
  }
  const perto: number[][] = casas.map((_, i) => {
    const col = i % colunas;
    const lin = (i - col) / colunas;
    const s: number[] = [];
    for (let dl = -1; dl <= 1; dl++)
      for (let dc = -1; dc <= 1; dc++) {
        const cc = col + dc;
        const ll = lin + dl;
        if (cc < 0 || ll < 0 || cc >= colunas || ll >= linhas) continue;
        s.push(...segmentosDaCasa[ll * colunas + cc]);
      }
    return s;
  });
  const m: Montado = { x0, z0, colunas, linhas, casas, perto, paredes, buraco, limites: [x0 - 0.5, z0 - 0.5, x1 + 0.5, z1 + 0.5] };
  MONTADOS.set(b, m);
  return m;
}

function indiceDaCasa(m: Montado, x: number, z: number): number {
  const col = Math.floor(x + 0.5) - m.x0;
  const lin = Math.floor(z + 0.5) - m.z0;
  if (col < 0 || lin < 0 || col >= m.colunas || lin >= m.linhas) return -1;
  return lin * m.colunas + col;
}

/** O ponto está dentro do polígono (o raio que cruza as arestas, só com + − × ÷). */
export function dentroDoPoligono(p: number[], x: number, y: number): boolean {
  let dentro = false;
  const n = p.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = p[i * 2];
    const yi = p[i * 2 + 1];
    const xj = p[j * 2];
    const yj = p[j * 2 + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Há chão aqui? Fora das casas, ou num fosso, não há: a bola cai. */
export function temChao(b: Buraco, x: number, z: number): boolean {
  const m = montar(b);
  const i = indiceDaCasa(m, x, z);
  const casa = i < 0 ? null : m.casas[i];
  if (!casa) return false;
  for (const f of casa.fossos) if (dentroDoPoligono(f, x, z)) return false;
  return true;
}

/** A altura do chão e a inclinação dele no ponto: [y, ∂y/∂x, ∂y/∂z]. Sem chão, a altura da casa mais perto (ou 0). */
export function relevo(b: Buraco, x: number, z: number): [number, number, number] {
  const m = montar(b);
  const i = indiceDaCasa(m, x, z);
  const casa = i < 0 ? null : m.casas[i];
  if (!casa) return [CHAO, 0, 0];
  if (!casa.forma.relevo) return [CHAO + casa.base, 0, 0];
  const [u, v] = paraAPeca(casa.cx, casa.cz, casa.giro, x, z);
  const [h, du, dv] = casa.forma.relevo(u, v);
  const k = giroDe(casa.giro);
  // a inclinação gira como um vetor
  return [CHAO + casa.base + h, COS[k] * du + SEN[k] * dv, -SEN[k] * du + COS[k] * dv];
}

export interface Tacada {
  /** O passo do relógio do buraco em que foi dada. */
  passo: number;
  dx: number;
  dz: number;
}

export interface Bola {
  x: number;
  z: number;
  vx: number;
  vz: number;
  passo: number;
  tacadaEm: number;
  andando: boolean;
  dentro: boolean;
  tacadas: number;
  ultimaX: number;
  ultimaZ: number;
}

export function novaBola(b: Buraco): Bola {
  return { x: b.inicio[0], z: b.inicio[1], vx: 0, vz: 0, passo: 0, tacadaEm: 0, andando: false, dentro: false, tacadas: 0, ultimaX: b.inicio[0], ultimaZ: b.inicio[1] };
}

export const acabouOBuraco = (bola: Bola) => bola.dentro || (!bola.andando && bola.tacadas >= TACADAS_MAX);
export const pontosDoBuraco = (bola: Bola) => (bola.dentro ? bola.tacadas : TACADAS_MAX + 1);

function baterNoSegmento(bola: Bola, ax: number, az: number, bx: number, bz: number) {
  const sx = bx - ax;
  const sz = bz - az;
  const l2 = sx * sx + sz * sz;
  let t = l2 > 0 ? ((bola.x - ax) * sx + (bola.z - az) * sz) / l2 : 0;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const dx = bola.x - (ax + sx * t);
  const dz = bola.z - (az + sz * t);
  const d2 = dx * dx + dz * dz;
  if (d2 >= RAIO_BOLA * RAIO_BOLA) return;
  let nx: number;
  let nz: number;
  let d: number;
  if (d2 > 0) {
    d = Math.sqrt(d2);
    nx = dx / d;
    nz = dz / d;
  } else {
    const l = Math.sqrt(l2);
    nx = -sz / l;
    nz = sx / l;
    d = 0;
  }
  bola.x += nx * (RAIO_BOLA - d);
  bola.z += nz * (RAIO_BOLA - d);
  const vn = bola.vx * nx + bola.vz * nz;
  if (vn < 0) {
    bola.vx -= (1 + QUIQUE_PAREDE) * vn * nx;
    bola.vz -= (1 + QUIQUE_PAREDE) * vn * nz;
  }
}

function parar(bola: Bola) {
  bola.vx = 0;
  bola.vz = 0;
  bola.andando = false;
}

/** A tacada é possível agora? Devolve o motivo, ou null. */
export function tacadaInvalida(bola: Bola, t: Tacada): string | null {
  if (bola.andando) return 'andando';
  if (acabouOBuraco(bola)) return 'acabou';
  if (!Number.isInteger(t.passo) || !Number.isInteger(t.dx) || !Number.isInteger(t.dz)) return 'numeros';
  if (t.passo < bola.passo) return 'cedo';
  const f2 = t.dx * t.dx + t.dz * t.dz;
  if (f2 < FORCA_MIN * FORCA_MIN || f2 > FORCA_MAX * FORCA_MAX) return 'forca';
  return null;
}

export function bater(bola: Bola, t: Tacada) {
  bola.passo = t.passo;
  bola.tacadaEm = t.passo;
  bola.ultimaX = bola.x;
  bola.ultimaZ = bola.z;
  // (+ 0 tira o -0 do Math.round: o JSON o manda como 0, e as duas pontas precisam começar iguais)
  bola.vx = ((t.dx + 0) / FORCA_MAX) * VELOCIDADE_MAX;
  bola.vz = ((t.dz + 0) / FORCA_MAX) * VELOCIDADE_MAX;
  bola.andando = true;
  bola.tacadas++;
}

function noBuraco(m: Montado, bola: Bola): boolean {
  const ex = bola.x - m.buraco[0];
  const ez = bola.z - m.buraco[1];
  return ex * ex + ez * ez < RAIO_BURACO * RAIO_BURACO;
}

/** Um passo de 1/60 s da bola andando. Parada, nada muda. */
export function avancar(b: Buraco, bola: Bola) {
  if (!bola.andando) return;
  const m = montar(b);
  bola.passo++;
  // a ladeira: empurra para baixo, na direção da inclinação
  const [, gx, gz] = relevo(b, bola.x, bola.z);
  bola.vx -= GRAVIDADE * gx;
  bola.vz -= GRAVIDADE * gz;
  const inclinado = gx * gx + gz * gz > INCLINACAO_PARADA * INCLINACAO_PARADA;
  const v = Math.sqrt(bola.vx * bola.vx + bola.vz * bola.vz);
  const nova = v * ATRITO - FREIO;
  if ((nova <= PARADA && !inclinado) || bola.passo - bola.tacadaEm > PASSOS_MAX_DA_TACADA) {
    if (noBuraco(m, bola)) {
      bola.x = m.buraco[0];
      bola.z = m.buraco[1];
      bola.dentro = true;
    }
    return parar(bola);
  }
  if (nova <= 0) {
    // parada por um instante na ladeira: o próximo passo a leva para baixo
    bola.vx = 0;
    bola.vz = 0;
    return;
  }
  bola.vx *= nova / v;
  bola.vz *= nova / v;
  const pedacos = Math.ceil(nova / PEDACO);
  for (let p = 0; p < pedacos; p++) {
    bola.x += bola.vx / pedacos;
    bola.z += bola.vz / pedacos;
    const i = indiceDaCasa(m, bola.x, bola.z);
    if (i >= 0) {
      const s = m.perto[i];
      for (let k = 0; k < s.length; k += 4) baterNoSegmento(bola, s[k], s[k + 1], s[k + 2], s[k + 3]);
    }
    // fora da pista ou num buraco do chão: volta para onde estava, com uma tacada a mais
    if (!temChao(b, bola.x, bola.z)) {
      bola.x = bola.ultimaX;
      bola.z = bola.ultimaZ;
      bola.tacadas++;
      return parar(bola);
    }
    const v2 = bola.vx * bola.vx + bola.vz * bola.vz;
    if (noBuraco(m, bola) && v2 < CAPTURA * CAPTURA) {
      bola.x = m.buraco[0];
      bola.z = m.buraco[1];
      bola.dentro = true;
      return parar(bola);
    }
  }
}

export function rolarAteParar(b: Buraco, bola: Bola) {
  while (bola.andando) avancar(b, bola);
}

export function copiarBola(bola: Bola): Bola {
  return { ...bola };
}

/** A distância de um ponto a um segmento, ao quadrado. */
function distancia2(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const sx = bx - ax;
  const sz = bz - az;
  const l2 = sx * sx + sz * sz;
  let t = l2 > 0 ? ((x - ax) * sx + (z - az) * sz) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = x - (ax + sx * t);
  const dz = z - (az + sz * t);
  return dx * dx + dz * dz;
}

/**
 * A DISTÂNCIA PELO CAMINHO até o buraco, numa grade de 0,05 (contornando as paredes e os fossos): para o piloto automático
 * (os testes e o e2e). Não entra na simulação.
 */
export function mapaDeDistancia(b: Buraco): (x: number, z: number) => number {
  const m = montar(b);
  const passo = 0.05;
  const [lx0, lz0, lx1, lz1] = m.limites;
  const cw = Math.round((lx1 - lx0) / passo);
  const ch = Math.round((lz1 - lz0) / passo);
  const livre = new Uint8Array(cw * ch);
  for (let cy = 0; cy < ch; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      const x = lx0 + (cx + 0.5) * passo;
      const z = lz0 + (cy + 0.5) * passo;
      let ok = temChao(b, x, z) && !m.paredes.some((p) => dentroDoPoligono(p, x, z));
      const i = indiceDaCasa(m, x, z);
      const s = i >= 0 ? m.perto[i] : [];
      for (let k = 0; ok && k < s.length; k += 4) if (distancia2(x, z, s[k], s[k + 1], s[k + 2], s[k + 3]) < RAIO_BOLA * RAIO_BOLA) ok = false;
      livre[cy * cw + cx] = ok ? 1 : 0;
    }
  }
  const dist = new Float64Array(cw * ch).fill(Infinity);
  const inicio = Math.floor((m.buraco[1] - lz0) / passo) * cw + Math.floor((m.buraco[0] - lx0) / passo);
  dist[inicio] = 0;
  const fila = [inicio];
  for (let k = 0; k < fila.length; k++) {
    const i = fila[k];
    const cx = i % cw;
    const cy = (i - cx) / cw;
    for (const [ox, oy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cx + ox;
      const ny = cy + oy;
      if (nx < 0 || ny < 0 || nx >= cw || ny >= ch) continue;
      const j = ny * cw + nx;
      if (!livre[j] || dist[j] !== Infinity) continue;
      dist[j] = dist[i] + passo;
      fila.push(j);
    }
  }
  return (x, z) => {
    const cx = Math.min(cw - 1, Math.max(0, Math.floor((x - lx0) / passo)));
    const cy = Math.min(ch - 1, Math.max(0, Math.floor((z - lz0) / passo)));
    return dist[cy * cw + cx];
  };
}

/**
 * O PILOTO AUTOMÁTICO: experimenta direções e forças e fica com a que deixa a bola mais perto do buraco pelo caminho (ou
 * dentro dele). Para os testes e o e2e (só em desenvolvimento no site). As direções saem da parametrização racional do círculo.
 */
export function melhorTacada(b: Buraco, bola: Bola, passo: number, distancia = mapaDeDistancia(b)): Tacada {
  let melhor: Tacada = { passo, dx: 0, dz: FORCA_MAX };
  let melhorNota = Infinity;
  const direcoes: [number, number][] = [];
  const N = 36;
  for (let k = 0; k < N; k++) {
    const u = -1 + (2 * k) / N;
    const den = 1 + u * u;
    const cx = (1 - u * u) / den;
    const cz = (2 * u) / den;
    direcoes.push([cx, cz], [-cx, -cz]);
  }
  for (const [cx, cz] of direcoes) {
    for (let f = 1; f <= 12; f++) {
      const forca = (f * FORCA_MAX) / 12;
      const t: Tacada = { passo, dx: Math.round(cx * forca), dz: Math.round(cz * forca) };
      if (tacadaInvalida(bola, t)) continue;
      const teste = copiarBola(bola);
      bater(teste, t);
      rolarAteParar(b, teste);
      const nota = teste.dentro ? -1000 + f : distancia(teste.x, teste.z) + (teste.tacadas - bola.tacadas - 1) * 50;
      if (nota < melhorNota) {
        melhorNota = nota;
        melhor = t;
      }
    }
  }
  return melhor;
}
