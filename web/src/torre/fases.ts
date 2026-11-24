/**
 * AS TORRES DO CELEIRO (05/11/2026): a subida vertical, no motor do Pulo do coelho (web/src/plataforma/), com a grade
 * de blocos de 16 px e tudo desenhado por código. Cada torre é montada por um ROTEIRO de trechos de baixo para cima
 * (escada de tábuas, vigas que sobem e descem, prateleiras que andam de lado, fardos de feno, ferramentas que caem,
 * corvos), separados por ANDARES: um assoalho de tábua de parede a parede, com o posto para onde se volta.
 *
 * NADA É SORTEADO AO VIVO: as vigas, as prateleiras, o que cai e os corvos dependem só do PASSO da subida (contas de
 * + − × ÷, sem seno nem cosseno). Todo mundo vê o mesmo no mesmo instante da própria subida, sem a rede.
 *
 * O id leva a versão ("celeiro-1"): mudar o roteiro é torre nova, e os recordes e fantasmas não se misturam. O servidor
 * guarda as medidas de cada uma (server/src/torre.ts: TORRES_DO_CELEIRO); web/test/torre.test.ts confere que batem.
 */

export const T = 16;
/** A largura de dentro do celeiro, em casas (as paredes ficam fora, no desenho). */
export const COLUNAS = 18;
export const LARGURA = COLUNAS * T;

export const Bloco = { Vazio: 0, Viga: 1, Tabua: 2, Feno: 3 } as const;
export type Bloco = (typeof Bloco)[keyof typeof Bloco];

/** Uma plataforma que anda (a viga que sobe e desce, a prateleira que vai e volta). Posições do canto de cima à esquerda. */
export interface Movel {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  w: number;
  periodo: number;
  /** Em que ponto do vaivém ela está no passo 0. */
  desloc: number;
  tipo: 'viga' | 'prateleira';
}

export type Ferramenta = 'pa' | 'saco' | 'regador' | 'ancinho';

/** O que cai: do alto (y0) até y1, a cada `periodo` passos. O centro do objeto. */
export interface Queda {
  x: number;
  y0: number;
  y1: number;
  periodo: number;
  desloc: number;
  tipo: Ferramenta;
}

/** O corvo: voa de x0 a x1 e volta, na altura y (o centro), a cada `periodo` passos. */
export interface Corvo {
  y: number;
  x0: number;
  x1: number;
  periodo: number;
  desloc: number;
}

export type Tema = 'celeiro' | 'paiol' | 'silo' | 'moinho' | 'pombal';

export interface Torre {
  id: string;
  tema: Tema;
  linhas: number;
  /** A grade, linha a linha (COLUNAS × linhas), de cima para baixo. */
  blocos: Uint8Array;
  largada: { x: number; y: number };
  /** O assoalho do topo (o y do pé em cima dele): passou dele, chegou. */
  chegada: number;
  /** Os postos, de baixo para cima (o pé do coelho em cada um). O primeiro é a largada. */
  postos: { x: number; y: number }[];
  moveis: Movel[];
  quedas: Queda[];
  corvos: Corvo[];
}

export const altura = (f: Torre) => f.linhas * T;

/** O que existe numa casa (fora da grade: os lados são parede, o alto é telhado, embaixo é chão). */
export function blocoEm(f: Torre, c: number, l: number): Bloco {
  if (l < 0 || l >= f.linhas) return Bloco.Viga;
  if (c < 0 || c >= COLUNAS) return Bloco.Viga;
  return f.blocos[l * COLUNAS + c] as Bloco;
}

/** O vaivém de 0 a 1 e de volta, suave nas pontas (sem cosseno: o mesmo número em qualquer computador). */
export function vaivem(n: number, periodo: number, desloc: number): number {
  const u = ((((n + desloc) % periodo) + periodo) % periodo) / periodo;
  const t = u < 0.5 ? 2 * u : 2 - 2 * u;
  return t * t * (3 - 2 * t);
}

export function movelEm(m: Movel, n: number): { x: number; y: number } {
  const t = vaivem(n, m.periodo, m.desloc);
  return { x: m.x0 + (m.x1 - m.x0) * t, y: m.y0 + (m.y1 - m.y0) * t };
}

/** Quantos passos o objeto treme lá em cima antes de cair (o aviso). */
export const AVISO = 45;
/** Depois de bater embaixo, quantos passos a poeira fica. */
export const POEIRA = 10;

/**
 * Onde está o que cai no passo n: 'aviso' (tremendo no alto), 'caindo', 'poeira' (bateu embaixo) ou null (esperando, não
 * aparece). Cai com aceleração, como coisa pesada.
 */
export function quedaEm(q: Queda, n: number): { y: number; estado: 'aviso' | 'caindo' | 'poeira'; t: number } | null {
  const c = (((n + q.desloc) % q.periodo) + q.periodo) % q.periodo;
  if (c < AVISO) return { y: q.y0, estado: 'aviso', t: c };
  const t = c - AVISO;
  const y = q.y0 + 1.2 * t + 0.06 * t * t;
  if (y < q.y1) return { y, estado: 'caindo', t };
  const dur = tempoDeQueda(q);
  if (t < dur + POEIRA) return { y: q.y1, estado: 'poeira', t: t - dur };
  return null;
}

/** Quantos passos a queda leva do alto até embaixo. */
export function tempoDeQueda(q: Queda): number {
  // 0,06 t² + 1,2 t = d  →  t = (−1,2 + √(1,44 + 0,24 d)) / 0,12
  return Math.ceil((-1.2 + Math.sqrt(1.44 + 0.24 * (q.y1 - q.y0))) / 0.12);
}

export function corvoEm(k: Corvo, n: number): { x: number; y: number; lado: number } {
  const u = ((((n + k.desloc) % k.periodo) + k.periodo) % k.periodo) / k.periodo;
  const t = u < 0.5 ? 2 * u : 2 - 2 * u;
  // um tico de onda no voo: sobe e desce 3 px, em triângulo
  const v = ((n + k.desloc) % 40) / 40;
  const onda = (v < 0.5 ? v * 4 - 1 : 3 - v * 4) * 3;
  return {
    x: k.x0 + (k.x1 - k.x0) * t,
    y: k.y + onda,
    lado: u < 0.5 ? (k.x1 > k.x0 ? 1 : -1) : k.x1 > k.x0 ? -1 : 1,
  };
}

// =====================================================================================================================
// O MONTADOR: tudo é escrito em "linha a partir de baixo" (b = 0 é o chão), e convertido no fim.
// =====================================================================================================================

type Op = (blocos: Uint8Array, linhas: number) => void;

function montador(id: string, tema: Tema) {
  const ops: Op[] = [];
  const pendentes: ((linhas: number) => void)[] = [];
  let topo = 0;
  const f: Torre = {
    id,
    tema,
    linhas: 0,
    blocos: new Uint8Array(0),
    largada: { x: 0, y: 0 },
    chegada: 0,
    postos: [],
    moveis: [],
    quedas: [],
    corvos: [],
  };
  /** O y (de cima para baixo) do topo da casa na linha b (a partir de baixo): onde fica o pé de quem pisa nela. */
  const yDe = (b: number, linhas: number) => (linhas - 1 - b) * T;
  const marcar = (b: number) => {
    if (b > topo) topo = b;
  };
  const por = (c0: number, c1: number, b0: number, b1: number, bloco: Bloco) => {
    marcar(b1 - 1);
    ops.push((blocos, linhas) => {
      for (let c = Math.max(0, c0); c < Math.min(COLUNAS, c1); c++) for (let b = b0; b < b1; b++) blocos[(linhas - 1 - b) * COLUNAS + c] = bloco;
    });
  };
  const m = {
    f,
    /** O chão do celeiro (b = 0), de parede a parede, e a largada nele. */
    chao(c: number) {
      por(0, COLUNAS, 0, 1, Bloco.Viga);
      pendentes.push((linhas) => {
        f.largada = { x: c * T + T / 2, y: yDe(0, linhas) };
        f.postos.unshift({ ...f.largada });
      });
    },
    tabua(c0: number, c1: number, b: number) {
      por(c0, c1, b, b + 1, Bloco.Tabua);
    },
    viga(c0: number, c1: number, b0: number, b1 = b0 + 1) {
      por(c0, c1, b0, b1, Bloco.Viga);
    },
    feno(c0: number, c1: number, b0: number, b1: number) {
      por(c0, c1, b0, b1, Bloco.Feno);
    },
    /** Um andar: o assoalho de tábua de parede a parede (com um vão, se pedido), e o posto nele. */
    andar(b: number, posto: number, vao?: [number, number]) {
      if (vao) {
        m.tabua(0, vao[0], b);
        m.tabua(vao[1], COLUNAS, b);
      } else m.tabua(0, COLUNAS, b);
      pendentes.push((linhas) => f.postos.push({ x: posto * T + T / 2, y: yDe(b, linhas) }));
    },
    /** O topo: o assoalho do palheiro de cima, onde fica o cata-vento (de tábua: atravessa-se por baixo). */
    topo(b: number) {
      por(0, COLUNAS, b, b + 1, Bloco.Tabua);
      pendentes.push((linhas) => (f.chegada = yDe(b, linhas)));
    },
    /** Uma plataforma que anda: o canto esquerdo em (c0, b0) → (c1, b1), w casas de largura. */
    movel(tipo: Movel['tipo'], c0: number, b0: number, c1: number, b1: number, w: number, periodo: number, desloc = 0) {
      marcar(Math.max(b0, b1));
      pendentes.push((linhas) =>
        f.moveis.push({
          tipo,
          x0: c0 * T,
          y0: yDe(b0, linhas),
          x1: c1 * T,
          y1: yDe(b1, linhas),
          w: w * T,
          periodo,
          desloc,
        }),
      );
    },
    /** O que cai: na coluna c, do alto da linha b0 até pousar na casa da linha b1 (a de baixo). */
    queda(tipo: Ferramenta, c: number, b0: number, b1: number, periodo: number, desloc = 0) {
      pendentes.push((linhas) =>
        f.quedas.push({
          tipo,
          x: c * T + T / 2,
          y0: yDe(b0, linhas) + 6,
          y1: yDe(b1, linhas) - 6,
          periodo,
          desloc,
        }),
      );
    },
    /** O corvo: na linha b (meia casa acima dela), da coluna c0 à c1 e de volta. */
    corvo(b: number, c0: number, c1: number, periodo: number, desloc = 0) {
      pendentes.push((linhas) =>
        f.corvos.push({
          y: yDe(b, linhas) - 12,
          x0: c0 * T + T / 2,
          x1: c1 * T + T / 2,
          periodo,
          desloc,
        }),
      );
    },
    pronto(): Torre {
      // o telhado: 6 linhas acima do topo, para o cata-vento e o céu da janela
      f.linhas = topo + 8;
      f.blocos = new Uint8Array(COLUNAS * f.linhas);
      for (const op of ops) op(f.blocos, f.linhas);
      for (const p of pendentes) p(f.linhas);
      return f;
    },
  };
  return m;
}

type M = ReturnType<typeof montador>;

// OS TRECHOS: cada um começa com o coelho num andar na linha b e devolve a linha do andar seguinte.

/** A escada de tábuas em zigue-zague: a cada 2 linhas uma tábua de 4, andando pelas colunas `cols` (o canto esquerdo). */
function escada(m: M, b: number, cols: number[], larg = 4): number {
  cols.forEach((c, i) => m.tabua(c, c + larg, b + 2 + 2 * i));
  return b + 2 + 2 * cols.length;
}

/** Duas vigas que sobem e descem, uma de cada lado, com um patamar no meio. */
function elevadores(m: M, b: number, lado: 'esquerda' | 'direita', periodo = 300): number {
  const [ca, cp, cb] = lado === 'esquerda' ? [1, 5, 10] : [14, 9, 5];
  m.movel('viga', ca, b + 1, ca, b + 8, 3, periodo, 0);
  m.tabua(cp, cp + 4, b + 10);
  m.movel('viga', cb, b + 11, cb, b + 18, 3, periodo, periodo / 2);
  return b + 20;
}

/** Prateleiras que andam de lado, em escada, com pontos de descanso nas paredes. */
function prateleiras(m: M, b: number, periodos: number[]): number {
  periodos.forEach((p, i) => {
    const l = b + 2 + 2 * i;
    m.movel('prateleira', 2, l, 12, l, 4, p, (i * p) / 3);
    // o descanso: uma tábua curta encostada numa parede, alternando
    if (i % 2 === 1) m.tabua(i % 4 === 1 ? 0 : COLUNAS - 2, i % 4 === 1 ? 2 : COLUNAS, l);
  });
  return b + 2 + 2 * periodos.length;
}

/** Fardos de feno empilhados (maciços: sobe-se por fora), em degraus de 2 linhas. */
function fenos(m: M, b: number, degraus: [number, number][]): number {
  let alto = b;
  degraus.forEach(([c, larg], i) => {
    alto = b + 2 + 2 * i;
    m.feno(c, c + larg, alto - 1, alto + 1);
  });
  return alto + 2;
}

/** A torre do CELEIRO (a de dia): a escada, os fardos, as vigas, as ferramentas, os corvos e as prateleiras. */
function celeiro(): Torre {
  const m = montador('celeiro-1', 'celeiro');
  m.chao(3);
  let b = escada(m, 0, [6, 11, 14, 10, 6, 2]);
  m.andar(b, 4);
  b = fenos(m, b, [
    [12, 3],
    [15, 3],
    [11, 3],
    [7, 3],
    [3, 3],
    [0, 2],
  ]);
  m.andar(b, 2);
  let e0 = b;
  b = escada(m, b, [4, 9, 13, 9, 5, 1, 5]);
  // as ferramentas caem do andar de cima e param num degrau
  m.queda('pa', 10, b, e0 + 8, 170, 0);
  m.queda('saco', 6, b, e0 + 10, 190, 80);
  m.queda('regador', 3, b, e0 + 12, 160, 40);
  m.andar(b, 2);
  b = elevadores(m, b, 'esquerda');
  m.andar(b, 12);
  let c0 = b;
  b = escada(m, b, [13, 9, 5, 1, 4, 8, 12]);
  m.corvo(c0 + 5, 0, 17, 260, 0);
  m.corvo(c0 + 11, 17, 0, 300, 120);
  m.andar(b, 14);
  b = prateleiras(m, b, [200, 240, 220, 260]);
  m.andar(b, 8);
  b = fenos(m, b, [
    [2, 3],
    [6, 3],
    [10, 3],
    [14, 3],
    [15, 3],
    [11, 3],
    [7, 3],
  ]);
  m.andar(b, 8);
  e0 = b;
  b = escada(m, b, [12, 8, 4, 0, 4, 8]);
  m.queda('saco', 14, b, e0 + 2, 180, 20);
  m.queda('ancinho', 10, b, e0 + 4, 170, 110);
  m.queda('pa', 6, b, e0 + 6, 200, 60);
  m.andar(b, 10);
  b = elevadores(m, b, 'direita', 280);
  m.andar(b, 6);
  c0 = b;
  b = escada(m, b, [2, 6, 10, 14, 10]);
  m.corvo(c0 + 5, 17, 0, 240, 90);
  m.topo(b);
  return m.pronto();
}

/** O PAIOL (o fim da tarde): mais prateleiras, as vigas do outro lado, sacos caindo sobre a escada. */
function paiol(): Torre {
  const m = montador('paiol-1', 'paiol');
  m.chao(14);
  let b = escada(m, 0, [10, 6, 2, 6, 10, 14]);
  m.andar(b, 15);
  b = elevadores(m, b, 'direita', 280);
  m.andar(b, 6);
  let e0 = b;
  b = escada(m, b, [2, 6, 10, 14, 10, 6, 2]);
  m.queda('saco', 4, b, e0 + 2, 180, 0);
  m.queda('ancinho', 8, b, e0 + 4, 200, 60);
  m.queda('saco', 12, b, e0 + 6, 170, 120);
  m.queda('pa', 15, b, e0 + 8, 190, 30);
  m.andar(b, 3);
  b = prateleiras(m, b, [220, 180, 260, 200, 240]);
  m.andar(b, 9);
  let c0 = b;
  b = fenos(m, b, [
    [13, 3],
    [9, 3],
    [5, 3],
    [1, 3],
    [0, 3],
    [4, 3],
    [8, 3],
  ]);
  m.corvo(c0 + 4, 17, 0, 280, 40);
  m.corvo(c0 + 10, 0, 17, 240, 160);
  m.andar(b, 10);
  b = elevadores(m, b, 'esquerda', 260);
  m.andar(b, 12);
  e0 = b;
  b = escada(m, b, [13, 9, 5, 1, 5, 9]);
  m.queda('regador', 15, b, e0 + 2, 160, 50);
  m.queda('saco', 7, b, e0 + 6, 180, 0);
  m.queda('pa', 3, b, e0 + 8, 170, 90);
  m.andar(b, 10);
  c0 = b;
  b = prateleiras(m, b, [240, 200, 260]);
  m.corvo(c0 + 3, 0, 17, 300, 70);
  m.andar(b, 4);
  b = elevadores(m, b, 'direita', 240);
  m.andar(b, 6);
  b = escada(m, b, [7, 3, 7, 11]);
  m.topo(b);
  return m.pronto();
}

/** O SILO (a noite): tudo junto, e corvos sobre as prateleiras. */
function silo(): Torre {
  const m = montador('silo-1', 'silo');
  m.chao(8);
  let b = fenos(m, 0, [
    [11, 3],
    [14, 3],
    [10, 3],
    [6, 3],
    [2, 3],
  ]);
  m.andar(b, 3);
  b = elevadores(m, b, 'esquerda', 260);
  m.andar(b, 12);
  let p0 = b;
  b = prateleiras(m, b, [210, 250, 190, 230]);
  m.corvo(p0 + 7, 0, 17, 320, 0);
  m.andar(b, 15);
  let e0 = b;
  b = escada(m, b, [12, 8, 4, 0, 4, 8, 12]);
  m.queda('regador', 14, b, e0 + 2, 170, 0);
  m.queda('pa', 10, b, e0 + 4, 160, 70);
  m.queda('saco', 6, b, e0 + 6, 180, 20);
  m.queda('ancinho', 2, b, e0 + 8, 200, 110);
  m.andar(b, 13);
  b = elevadores(m, b, 'direita', 300);
  m.andar(b, 5);
  let c0 = b;
  b = escada(m, b, [2, 6, 10, 14, 10, 6]);
  m.corvo(c0 + 3, 17, 0, 250, 60);
  m.corvo(c0 + 9, 0, 17, 270, 190);
  m.andar(b, 4);
  b = fenos(m, b, [
    [1, 3],
    [5, 3],
    [9, 3],
    [13, 3],
    [15, 3],
    [11, 3],
    [7, 3],
  ]);
  m.andar(b, 2);
  p0 = b;
  b = prateleiras(m, b, [190, 230, 210, 250]);
  m.corvo(p0 + 5, 17, 0, 280, 140);
  m.andar(b, 15);
  e0 = b;
  b = escada(m, b, [11, 7, 3, 7, 11]);
  m.queda('saco', 13, b, e0 + 2, 170, 30);
  m.queda('pa', 9, b, e0 + 4, 180, 120);
  m.queda('regador', 5, b, e0 + 6, 160, 80);
  m.andar(b, 13);
  b = elevadores(m, b, 'esquerda', 280);
  m.andar(b, 9);
  c0 = b;
  b = escada(m, b, [9, 5, 1, 5]);
  m.corvo(c0 + 4, 0, 17, 230, 30);
  m.topo(b);
  return m.pronto();
}

/** O MOINHO (19/11/2026, de manhã cedo): as prateleiras que andam e as vigas, com pouca coisa caindo. Para correr e pular longe. */
function moinho(): Torre {
  const m = montador('moinho-1', 'moinho');
  m.chao(9);
  let b = prateleiras(m, 0, [200, 230, 210]);
  m.andar(b, 2);
  b = elevadores(m, b, 'esquerda', 260);
  m.andar(b, 12);
  let p0 = b;
  b = prateleiras(m, b, [190, 240, 200, 250]);
  m.corvo(p0 + 5, 0, 17, 300, 40);
  m.andar(b, 15);
  let e0 = b;
  b = escada(m, b, [12, 8, 4, 0, 4, 8]);
  m.queda('saco', 10, b, e0 + 4, 180, 0);
  m.queda('pa', 6, b, e0 + 6, 200, 90);
  m.andar(b, 10);
  b = elevadores(m, b, 'direita', 240);
  m.andar(b, 6);
  b = fenos(m, b, [
    [2, 3],
    [6, 3],
    [10, 3],
    [14, 3],
    [15, 3],
  ]);
  m.andar(b, 14);
  p0 = b;
  b = prateleiras(m, b, [220, 180, 240]);
  m.corvo(p0 + 3, 17, 0, 260, 120);
  m.andar(b, 4);
  e0 = b;
  b = escada(m, b, [3, 7, 11, 15, 11, 7, 3]);
  m.queda('regador', 9, b, e0 + 4, 170, 50);
  m.queda('ancinho', 5, b, e0 + 8, 190, 0);
  m.andar(b, 2);
  b = elevadores(m, b, 'esquerda', 280);
  m.andar(b, 12);
  b = escada(m, b, [12, 8, 4, 8]);
  m.topo(b);
  return m.pronto();
}

/** O POMBAL (19/11/2026, ao entardecer): corvos por toda parte e ferramentas sobre a escada. Para esperar a hora certa. */
function pombal(): Torre {
  const m = montador('pombal-1', 'pombal');
  m.chao(4);
  let b = escada(m, 0, [7, 11, 14, 10, 6, 2]);
  let c0 = 0;
  m.corvo(c0 + 5, 17, 0, 240, 0);
  m.andar(b, 2);
  c0 = b;
  b = fenos(m, b, [
    [2, 3],
    [6, 3],
    [10, 3],
    [14, 3],
    [15, 3],
    [11, 3],
    [7, 3],
  ]);
  m.andar(b, 9);
  b = elevadores(m, b, 'direita', 280);
  m.andar(b, 5);
  let e0 = b;
  b = escada(m, b, [2, 6, 10, 14, 10, 6, 2]);
  m.queda('regador', 4, b, e0 + 2, 170, 0);
  m.queda('saco', 8, b, e0 + 4, 190, 70);
  m.queda('ancinho', 12, b, e0 + 6, 160, 30);
  m.queda('pa', 15, b, e0 + 8, 200, 110);
  m.andar(b, 3);
  c0 = b;
  b = escada(m, b, [6, 10, 14, 10, 6]);
  m.corvo(c0 + 3, 0, 17, 220, 30);
  m.corvo(c0 + 7, 17, 0, 260, 150);
  m.andar(b, 8);
  b = elevadores(m, b, 'esquerda', 300);
  m.andar(b, 12);
  e0 = b;
  b = escada(m, b, [13, 9, 5, 1, 5, 9, 13]);
  m.queda('saco', 15, b, e0 + 2, 180, 40);
  m.queda('pa', 11, b, e0 + 4, 170, 0);
  m.corvo(e0 + 9, 0, 17, 250, 90);
  m.andar(b, 14);
  b = escada(m, b, [10, 6, 2, 6]);
  m.topo(b);
  return m.pronto();
}

export const TORRES: Torre[] = [celeiro(), paiol(), silo(), moinho(), pombal()];

/**
 * AS MEDALHAS DE CADA TORRE (19/11/2026), sobre o tempo do PILOTO AUTOMÁTICO (em passos: web/test/torre.test.ts confere que é
 * o dele). Ouro: até o tempo dele; prata: até 25% a mais; bronze: até 60% a mais. Só desenho e conversa: o recorde continua o
 * tempo, e o servidor não guarda medalha.
 */
export const TEMPO_DO_PILOTO: Record<string, number> = {
  'celeiro-1': 2632,
  'paiol-1': 2297,
  'silo-1': 2645,
  'moinho-1': 2352,
  'pombal-1': 2177,
};
export const MEDALHAS_DA_TORRE = [1, 1.25, 1.6] as const;
/** 0 ouro, 1 prata, 2 bronze, ou null. */
export function medalhaDaTorre(id: string, passos: number): 0 | 1 | 2 | null {
  const base = TEMPO_DO_PILOTO[id];
  if (!base) return null;
  const i = MEDALHAS_DA_TORRE.findIndex((m) => passos <= Math.round(base * m));
  return i < 0 ? null : (i as 0 | 1 | 2);
}
export const torrePorId = (id: string) => TORRES.find((f) => f.id === id) ?? TORRES[0];

/** A Copa do Celeiro (20/11/2026), só na sala: as cinco torres seguidas (COPA_DO_CELEIRO em server/src/minijogo-torre.ts). */
export const COPA_DO_CELEIRO = 'copa-do-celeiro';
export const TORRES_DA_COPA = ['celeiro-1', 'paiol-1', 'silo-1', 'moinho-1', 'pombal-1'];

// =====================================================================================================================
// A TORRE SEM FIM (24/11/2026, o lote E): uma torre montada por SEMENTE, com os mesmos trechos das torres de sempre, que
// fica mais difícil quanto mais alto (mais coisa caindo, corvos mais ligeiros). A regra da subida sem fim (a água que sobe,
// o fim e a conferência) mora em semfim.ts. Este arquivo mora em DUAS CÓPIAS IGUAIS (web/src/torre/ e server/src/torre/),
// com a física e o semfim.ts: o servidor monta a mesma torre pela semente e refaz a subida.
// =====================================================================================================================

/** O id da subida sem fim (não é uma torre de TORRES: a torre é montada pela semente de cada subida). */
export const SEM_FIM = 'sem-fim';
/** Quantos trechos a torre sem fim tem: mais do que alguém sobe antes de a água chegar (o topo, se alguém chegar, é o fim). */
export const TRECHOS_DO_SEM_FIM = 40;

/** O sorteio da semente: só inteiros (Math.imul), o mesmo número em qualquer computador. */
export function sorteioDaSemente(semente: number): () => number {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** As escadas que as torres de sempre já usam (todas sobem; a primeira tábua fica a 2 linhas do andar, de qualquer lado). */
const ESCADAS: number[][] = [
  [6, 11, 14, 10, 6, 2],
  [4, 9, 13, 9, 5, 1, 5],
  [13, 9, 5, 1, 4, 8, 12],
  [12, 8, 4, 0, 4, 8],
  [2, 6, 10, 14, 10],
  [10, 6, 2, 6, 10, 14],
  [2, 6, 10, 14, 10, 6, 2],
  [13, 9, 5, 1, 5, 9],
  [12, 8, 4, 0, 4, 8, 12],
  [11, 7, 3, 7, 11],
  [3, 7, 11, 15, 11, 7, 3],
  [6, 10, 14, 10, 6],
  [13, 9, 5, 1, 5, 9, 13],
];
/** Os fardos das torres de sempre. */
const FENOS: [number, number][][] = [
  [
    [12, 3],
    [15, 3],
    [11, 3],
    [7, 3],
    [3, 3],
    [0, 2],
  ],
  [
    [2, 3],
    [6, 3],
    [10, 3],
    [14, 3],
    [15, 3],
    [11, 3],
    [7, 3],
  ],
  [
    [13, 3],
    [9, 3],
    [5, 3],
    [1, 3],
    [0, 3],
    [4, 3],
    [8, 3],
  ],
  [
    [11, 3],
    [14, 3],
    [10, 3],
    [6, 3],
    [2, 3],
  ],
  [
    [2, 3],
    [6, 3],
    [10, 3],
    [14, 3],
    [15, 3],
  ],
];
const TEMAS: Tema[] = ['celeiro', 'paiol', 'silo', 'moinho', 'pombal'];
const FERRAMENTAS: Ferramenta[] = ['pa', 'saco', 'regador', 'ancinho'];

/**
 * A torre sem fim da semente. `trechos` só muda nos testes. Os dois primeiros trechos não têm nada caindo; depois, a cada 5
 * trechos, cabe mais uma coisa (até 4), e o ritmo do que cai e dos corvos aperta até 80% do de começo.
 */
export function torreSemFim(semente: number, trechos = TRECHOS_DO_SEM_FIM): Torre {
  const r = sorteioDaSemente(semente);
  const inteiro = (n: number) => Math.floor(r() * n);
  const m = montador(SEM_FIM, TEMAS[inteiro(TEMAS.length)]);
  // o tipo de cada trecho, sorteado antes (o posto de cada andar depende do trecho que vem depois)
  const tipos: number[] = [];
  for (let i = 0; i < trechos; i++) {
    // nunca dois trechos iguais seguidos; a escada sai mais (é onde cabe o que cai)
    let t = inteiro(5);
    if (t === 4) t = 0;
    if (i > 0 && t === tipos[i - 1]) t = (t + 1) % 4;
    tipos.push(t);
  }
  const fenosDe = tipos.map((t) => (t === 3 ? FENOS[inteiro(FENOS.length)] : null));
  /** O posto do andar antes do trecho i: longe do primeiro fardo (cair dentro de um fardo prenderia o coelho). */
  const postoAntes = (i: number) => {
    const fe = fenosDe[i];
    if (fe) return fe[0][0] >= 8 ? 2 : 15;
    return 2 + inteiro(14);
  };
  m.chao(postoAntes(0));
  let b = 0;
  for (let i = 0; i < trechos; i++) {
    const nivel = Math.min(4, i < 2 ? 0 : 1 + Math.floor((i - 2) / 5));
    const ritmo = Math.max(0.8, 1 - i * 0.008);
    const periodo = (base: number) => Math.round((base + inteiro(40)) * ritmo);
    const e0 = b;
    const tipo = tipos[i];
    if (tipo === 0) {
      const cols = ESCADAS[inteiro(ESCADAS.length)];
      b = escada(m, b, cols);
      // o que cai: do andar de cima até um degrau, sobre a tábua (nunca dois no mesmo degrau)
      const degraus = cols.map((_, j) => j).filter((j) => j < cols.length - 1);
      for (let q = 0; q < nivel && degraus.length; q++) {
        const j = degraus.splice(inteiro(degraus.length), 1)[0];
        m.queda(FERRAMENTAS[inteiro(FERRAMENTAS.length)], cols[j] + 1 + inteiro(2), b, e0 + 2 + 2 * j, periodo(160), inteiro(200));
      }
      if (nivel >= 3) {
        const ida = r() < 0.5;
        m.corvo(e0 + 3 + 2 * inteiro(cols.length - 1), ida ? 0 : 17, ida ? 17 : 0, periodo(250), inteiro(200));
      }
    } else if (tipo === 1) {
      b = elevadores(m, b, r() < 0.5 ? 'esquerda' : 'direita', 240 + 20 * inteiro(4));
    } else if (tipo === 2) {
      const n = 3 + inteiro(2);
      const ps: number[] = [];
      for (let j = 0; j < n; j++) ps.push(180 + 10 * inteiro(9));
      b = prateleiras(m, b, ps);
      if (nivel >= 2) {
        const ida = r() < 0.5;
        m.corvo(e0 + 3 + 2 * inteiro(n - 1), ida ? 0 : 17, ida ? 17 : 0, periodo(260), inteiro(200));
      }
    } else {
      b = fenos(m, b, fenosDe[i]!);
      if (nivel >= 1) {
        const ida = r() < 0.5;
        m.corvo(e0 + 5 + 2 * inteiro(3), ida ? 0 : 17, ida ? 17 : 0, periodo(260), inteiro(200));
      }
    }
    if (i < trechos - 1) m.andar(b, postoAntes(i + 1));
  }
  m.topo(b);
  return m.pronto();
}
