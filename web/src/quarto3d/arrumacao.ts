/**
 * A ARRUMAÇÃO DO QUARTO 3D É A DO QUARTO DE PIXEL ART (decisão dele, 06/11/2026: "a POSIÇÃO do item no quarto 2D terá o
 * OBJETO EQUIVALENTE 3D na MESMA POSIÇÃO"). O quarto 3D não tem arrumação própria: ele lê a mesma que o servidor guarda
 * (server/src/quarto.ts, GET /api/quarto e /api/quarto/:id na visita) e desenha cada peça de pixel pela equivalente 3D, na
 * mesma casa e no mesmo giro. Quem arruma no pixel vê igual no 3D, e quem visita vê o quarto da pessoa nos dois estilos.
 *
 * Este arquivo é só a TRADUÇÃO, sem three.js: o que a página do quarto de pixel (e2e/pixel-art/quarto/novo/quarto/montar.mjs)
 * sabe e o servidor não guarda — as plantas (as casas de chão e as paredes), a arrumação de fábrica de cada planta, o tamanho
 * de cada móvel na grade, onde cada objeto da parede e cada janela foram pintados — copiado de lá, e a conta que leva uma
 * arrumação guardada (ou nenhuma: a de fábrica) ao mundo do 3D. Os números foram lidos da própria página (tamDoTeste,
 * retratoDoTeste, o ITENS_PAREDE e o JANELAS do quarto.html) em 06/11/2026; peça nova no pixel pede a linha dela aqui (o
 * teste web/test/quarto3d-arrumacao.test.ts confere as que existem).
 *
 * OS EIXOS. No pixel, a casa é (u, v): a parede da DIREITA da tela é a linha u = 0 (corre ao longo de v) e a da ESQUERDA é
 * v = 0 (corre ao longo de u); o lado 0 olha para +u, o 1 para −v, o 2 para −u e o 3 para +v. No 3D, a parede do FUNDO é
 * z = 0 (corre ao longo de x) e a da esquerda é x = 0, vistas de (+x, +z): então x = v e z = u, e os lados batem com os do 3D
 * (o lado 0 olha para +z). A parede "direita" do pixel é a do fundo do 3D.
 */

export type ParedeDoPixel = 'direita' | 'esquerda';

/** O que o servidor guarda (o mesmo formato de server/src/quarto.ts; só o que o 3D lê). */
export interface ArrumacaoDoPixel {
  moveis?: Record<string, { c: [number, number]; lado: number }>;
  cadeira?: { u: number; v: number; th: number };
  janela?: { tipo: string; parede: ParedeDoPixel; v: number };
  cortina?: boolean;
  janelaAberta?: boolean;
  abajurApagado?: boolean;
  parede?: Record<string, { parede: ParedeDoPixel; v: number; h: number }>;
  cores?: Record<string, string>;
  emCima?: Record<string, { tipo: string; em: string; s: number; t: number; lado: number }>;
  guardados?: string[];
  conhecidos?: string[];
  planta?: string;
}

export const N = 8;

/** Um trecho de parede: de "de" a "ate" casas ao longo dela, "recuo" casas à frente da parede do fundo (o pilar do L). */
type Trecho = [number, number, number];
interface Planta {
  chao: (u: number, v: number) => boolean;
  paredes: Record<ParedeDoPixel, Trecho[]>;
  /** O que a planta tira do chão (o pilar do L): [u0, u1, v0, v1]. */
  solidos: [number, number, number, number][];
}

/** As plantas do quarto (montar.mjs, PLANTAS): o de sempre, a sala em L e o cubículo. */
export const PLANTAS: Record<string, Planta> = {
  quadrado: { chao: () => true, paredes: { direita: [[0, 8, 0]], esquerda: [[0, 8, 0]] }, solidos: [] },
  l: { chao: (i, j) => i >= 4 || j >= 4, paredes: { direita: [[0, 4, 4], [4, 8, 0]], esquerda: [[0, 4, 4], [4, 8, 0]] }, solidos: [[0, 4, 0, 4]] },
  cubiculo: { chao: (i, j) => i >= 2 && j >= 2, paredes: { direita: [[2, 8, 2]], esquerda: [[2, 8, 2]] }, solidos: [[0, 2, 0, 8], [0, 8, 0, 2]] },
};

/** O tamanho de cada móvel na grade, [ao longo de u, ao longo de v], em cada lado (tamDoTeste, medido no desenho). */
export const TAMANHOS: Record<string, [number, number][]> = {
  pufe: [[2, 2], [2, 2], [2, 2], [2, 2]],
  poltrona: [[2, 2], [2, 2], [2, 2], [2, 2]],
  cama: [[3, 2], [2, 3], [3, 2], [2, 3]],
  abajur: [[1, 1], [1, 1], [1, 1], [1, 1]],
  'guarda-roupa': [[1, 2], [2, 1], [1, 2], [2, 1]],
  tapete: [[4, 4], [4, 4], [4, 4], [4, 4]],
  mesa: [[1, 3], [2, 1], [1, 2], [3, 1]],
  'planta-alta': [[1, 1], [1, 1], [1, 1], [1, 1]],
  'planta-baixa': [[1, 1], [1, 1], [1, 1], [1, 1]],
  ventilador: [[1, 1], [1, 1], [1, 1], [1, 1]],
  'caminha-gato': [[1, 1], [1, 1], [1, 1], [1, 1]],
};

/** Onde cada objeto da parede foi pintado: as casas ao longo da parede (com v = 0) e a altura, em px do pixel art. */
export const ITENS_DA_PAREDE: Record<string, { ocupa: [number, number]; alto: [number, number]; chao?: boolean }> = {
  fone: { ocupa: [3.48, 4.7], alto: [104.1, 153.1] },
  quadro: { ocupa: [3.37, 5.56], alto: [112.3, 182.3] },
  cortica: { ocupa: [3.44, 4.93], alto: [91.1, 153.1] },
  prateleira: { ocupa: [2.93, 5.37], alto: [99.6, 163.6] },
  pintura: { ocupa: [3.3, 4.89], alto: [97.1, 180.1] },
  'prateleira-bar': { ocupa: [2.81, 5.63], alto: [79.6, 170.6] },
  'prateleira-snacks': { ocupa: [3, 5.52], alto: [98.2, 160.2] },
  trofeus: { ocupa: [3.11, 5.56], alto: [104.2, 157.2] },
  neon: { ocupa: [3.37, 5.22], alto: [115.7, 171.7] },
  relogio: { ocupa: [3.85, 4.7], alto: [122.7, 151.7] },
  violao: { ocupa: [4, 4.96], alto: [101.3, 166.3] },
  porta: { ocupa: [3.56, 5.19], alto: [16.8, 124.8], chao: true },
};

/** As janelas: as casas que ocupam ao longo da parede com v = 0. A grande ("original") foi pintada com as cortinas abertas
 *  até as pontas da parede (0,04 a 8): o 3D usa só o vão do vidro dela, de 1,4 a 5. */
export const JANELAS: Record<string, { ocupa: [number, number]; vidro?: [number, number] }> = {
  original: { ocupa: [0.26, 8], vidro: [1.4, 5] },
  arco: { ocupa: [3.3, 5.3] },
  redonda: { ocupa: [3.41, 5.3] },
  floreira: { ocupa: [3.33, 5.3] },
  cortinas: { ocupa: [2.7, 5.89] },
};

/** A altura da parede do pixel art (do chão à cornija, ~190 px) é a do 3D: 1 px vale isto em unidades do 3D. */
export const PX = 3 / 195;

/** A arrumação de fábrica de cada planta (o retrato da página com a planta escolhida e nada mexido). */
interface Fabrica {
  moveis: Record<string, { c: [number, number]; lado: number }>;
  cadeira: { u: number; v: number; th: number };
  janela: { tipo: string; parede: ParedeDoPixel; v: number };
  parede: Record<string, { parede: ParedeDoPixel; v: number; h: number }>;
}
const DE_CIMA_DE_FABRICA: NonNullable<ArrumacaoDoPixel['emCima']> = {
  o1: { tipo: 'plantinha', em: 'mesa', s: 0.1, t: 0.8, lado: 0 },
  o2: { tipo: 'livros', em: 'mesa', s: 0.32, t: 0.82, lado: 0 },
  o3: { tipo: 'caneca', em: 'abajur', s: 0.2, t: 0.5, lado: 0 },
};
const GUARDADOS_DE_FABRICA = ['poltrona', 'ventilador'];
/**
 * O MÓVEL NOVO CHEGA GUARDADO (o ventilador, 09/11/2026): quem já arrumou o quarto não o acha no meio dele, e sim no
 * catálogo do Editar. Sem lugar na arrumação guardada, ele está guardado (a página faz igual: CHEGAM_GUARDADOS, em montar.mjs).
 */
// (a caminha do gato vem POSTA no quarto novo, decisão dele de 09/11/2026, e chega guardada no já arrumado)
const CHEGAM_GUARDADOS = ['ventilador', 'caminha-gato'];
/** A poltrona começa guardada; posta de volta sem lugar guardado, ela vai para cá (o INICIAL da página). */
const POLTRONA = { c: [7, 5] as [number, number], lado: 0 };
export const FABRICA: Record<string, Fabrica> = {
  quadrado: {
    moveis: {
      pufe: { c: [4, 4], lado: 0 },
      poltrona: POLTRONA,
      cama: { c: [1.5, 7], lado: 0 },
      abajur: { c: [0.5, 5.5], lado: 0 },
      'guarda-roupa': { c: [6, 0.5], lado: 3 },
      tapete: { c: [5, 4], lado: 0 },
      mesa: { c: [1.5, 0.5], lado: 3 },
      'planta-alta': { c: [4.5, 0.5], lado: 0 },
      'planta-baixa': { c: [7.5, 0.5], lado: 0 },
      ventilador: { c: [0.5, 3.5], lado: 0 },
      'caminha-gato': { c: [7.5, 7.5], lado: 0 },
    },
    cadeira: { u: 1.5, v: 2.15, th: -1.571 },
    janela: { tipo: 'original', parede: 'direita', v: 0 },
    parede: {
      quadro: { parede: 'esquerda', v: 0, h: 0 },
      fone: { parede: 'esquerda', v: -2.5, h: -6 },
      cortica: { parede: 'esquerda', v: 3, h: 0 },
      trofeus: { parede: 'direita', v: 2.4, h: 16 },
    },
  },
  l: {
    moveis: {
      pufe: { c: [6, 6], lado: 0 },
      poltrona: { c: [7, 3], lado: 0 },
      cama: { c: [1.5, 7], lado: 0 },
      abajur: { c: [0.5, 5.5], lado: 0 },
      'guarda-roupa': { c: [7, 0.5], lado: 3 },
      tapete: { c: [6, 6], lado: 0 },
      mesa: { c: [4.5, 1.5], lado: 0 },
      'planta-alta': { c: [4.5, 3.5], lado: 0 },
      'planta-baixa': { c: [3.5, 4.5], lado: 0 },
      ventilador: { c: [0.5, 4.5], lado: 0 },
      'caminha-gato': { c: [7.5, 7.5], lado: 0 },
    },
    cadeira: { u: 6.15, v: 1.5, th: -3.142 },
    janela: { tipo: 'cortinas', parede: 'direita', v: 1.7 },
    parede: {
      quadro: { parede: 'esquerda', v: -1.6, h: 0 },
      fone: { parede: 'esquerda', v: -3.1, h: -6 },
      cortica: { parede: 'esquerda', v: 0.9, h: 0 },
      trofeus: { parede: 'direita', v: -3.1, h: 33 },
    },
  },
  cubiculo: {
    moveis: {
      pufe: { c: [6, 6], lado: 0 },
      poltrona: { c: [7, 4], lado: 0 },
      cama: { c: [3.5, 7], lado: 0 },
      abajur: { c: [2.5, 5.5], lado: 0 },
      'guarda-roupa': { c: [2.5, 3], lado: 0 },
      tapete: { c: [6, 6], lado: 0 },
      mesa: { c: [4.5, 2.5], lado: 3 },
      'planta-alta': { c: [7.5, 2.5], lado: 0 },
      'planta-baixa': { c: [6.5, 2.5], lado: 0 },
      ventilador: { c: [2.5, 4.5], lado: 0 },
      'caminha-gato': { c: [7.5, 7.5], lado: 0 },
    },
    cadeira: { u: 4.5, v: 4.15, th: -1.571 },
    janela: { tipo: 'cortinas', parede: 'direita', v: 1.4 },
    parede: {
      quadro: { parede: 'esquerda', v: -0.6, h: 0 },
      trofeus: { parede: 'esquerda', v: 2.3, h: 19 },
      fone: { parede: 'esquerda', v: 2, h: -40 },
      cortica: { parede: 'direita', v: -1.1, h: 30 },
    },
  },
};

/** As cores do tapete, da parede e do piso que a página conhece (os nomes de "cores"); o 3D as pinta à sua moda. */
export const CORES_DO_TAPETE: Record<string, string> = { salvia: '#a3b384', terracota: '#c9714f', azul: '#7d9fbf', mostarda: '#d6a640', rosa: '#d99ba3', cinza: '#a9a49b' };
/** A parede e o piso: a razão entre a cor escolhida e a de fábrica (creme e mel), como a página faz na casca. */
export const CORES_DA_PAREDE: Record<string, [number, number, number] | null> = { creme: null, salvia: [204, 210, 184], terracota: [228, 186, 164], azul: [192, 204, 212], lavanda: [210, 196, 212], mostarda: [232, 208, 156], rosa: [234, 200, 194], cinza: [208, 202, 194] };
export const CORES_DO_PISO: Record<string, [number, number, number] | null> = { mel: null, carvalho: [202, 160, 112], nogueira: [104, 68, 50], cerejeira: [168, 94, 70], cinza: [152, 140, 128], pinho: [214, 180, 128] };
/** As cores médias da casca de fábrica (o reboco creme e o piso mel), contra as quais a razão é tirada. */
export const BASE_DA_PAREDE: [number, number, number] = [230, 214, 190];
export const BASE_DO_PISO: [number, number, number] = [176, 120, 80];

/** As funções do quarto (os ids de AcoesDoQuarto, em Home.tsx) nos mesmos objetos do pixel. A cópia ("cama~2") não tem. */
export const FUNCAO_DO_MOVEL: Record<string, string> = { abajur: 'abajur', 'guarda-roupa': 'gavetas', mesa: 'computador' };
export const FUNCAO_DA_PAREDE: Record<string, string> = { fone: 'fone', quadro: 'quadro', cortica: 'cortica', trofeus: 'trofeu' };

/** Os móveis com tampo, onde se põem os objetos de cima (TOPOS, na página). */
const TAMPOS = ['mesa', 'abajur', 'guarda-roupa'];

export const tipoDe = (id: string) => {
  const i = id.indexOf('~');
  return i < 0 ? id : id.slice(0, i);
};

// ---- o mundo do 3D ----

/** Um móvel no 3D: o centro (x, z), o pé na grade (x0..x1, z0..z1) e para onde olha. */
export interface MovelNoMundo {
  id: string;
  tipo: string;
  x: number;
  z: number;
  lado: number;
  /** O pé, como na grade do pixel (a área que ele ocupa). */
  pe: { x0: number; x1: number; z0: number; z1: number };
  /** O tamanho do pé no referencial do próprio móvel (antes do giro): a largura (x) e a profundidade (z). */
  largura: number;
  fundo: number;
}
/** Um objeto da parede (ou a janela) no 3D: a parede, o ponto do meio ao longo dela, a largura e a altura do meio. */
export interface NaParedeNoMundo {
  id: string;
  tipo: string;
  parede: 'fundo' | 'esquerda';
  /** Ao longo da parede (x na do fundo, z na da esquerda). */
  a: number;
  /** Onde a face da parede está (z na do fundo, x na da esquerda): o recuo do trecho. */
  recuo: number;
  largura: number;
  /** A altura do meio e a altura toda, em unidades do 3D. */
  y: number;
  altura: number;
  chao?: boolean;
}
export interface TrechoNoMundo {
  parede: 'fundo' | 'esquerda';
  de: number;
  ate: number;
  recuo: number;
}
export interface DeCimaNoMundo {
  id: string;
  tipo: string;
  em: string;
  /** A posição no tampo do móvel, já girada com ele: a fração ao longo de x e de z do pé. */
  fx: number;
  fz: number;
  lado: number;
}
export interface QuartoNoMundo {
  planta: string;
  chao: (x: number, z: number) => boolean;
  trechos: TrechoNoMundo[];
  solidos: { x0: number; x1: number; z0: number; z1: number }[];
  moveis: MovelNoMundo[];
  cadeira: { x: number; z: number; giro: number };
  janela: NaParedeNoMundo & { cortina: boolean; aberta: boolean };
  naParede: NaParedeNoMundo[];
  deCima: DeCimaNoMundo[];
  cores: { tapete?: string; parede?: [number, number, number]; piso?: [number, number, number] };
  abajurApagado: boolean;
}

const lado = (x: unknown) => (Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 3 ? (x as number) : 0);
const num = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) ? x : d);

function trechoEm(pl: Planta, parede: ParedeDoPixel, a: number): Trecho {
  const ts = pl.paredes[parede];
  let m = ts[0];
  let dm = Infinity;
  for (const t of ts) {
    const d = a < t[0] ? t[0] - a : a > t[1] ? a - t[1] : 0;
    if (d < dm) [dm, m] = [d, t];
  }
  return m;
}

/** Um objeto (ou a janela) preso inteiro num trecho da parede, como a página faz (prenderNaParede). */
function naParede(pl: Planta, id: string, tipo: string, P: { parede: ParedeDoPixel; v: number; h: number }, ocupa: [number, number], alto: [number, number], chao = false): NaParedeNoMundo {
  const tr = trechoEm(pl, P.parede, P.v + (ocupa[0] + ocupa[1]) / 2);
  const v = Math.max(tr[0] - ocupa[0], Math.min(tr[1] - ocupa[1], P.v));
  const h = chao ? -Math.max(0, alto[0]) : P.h;
  return {
    id,
    tipo,
    parede: P.parede === 'direita' ? 'fundo' : 'esquerda',
    a: v + (ocupa[0] + ocupa[1]) / 2,
    recuo: tr[2],
    largura: ocupa[1] - ocupa[0],
    y: ((alto[0] + alto[1]) / 2 + h) * PX,
    altura: (alto[1] - alto[0]) * PX,
    ...(chao && { chao: true }),
  };
}

/** A arrumação guardada (ou null: a de fábrica) no mundo do 3D, como a página do pixel a veste (vestir, em montar.mjs). */
export function noMundo(a: ArrumacaoDoPixel | null | undefined): QuartoNoMundo {
  const arr = a && typeof a === 'object' ? a : {};
  const planta = typeof arr.planta === 'string' && PLANTAS[arr.planta] ? arr.planta : 'quadrado';
  const pl = PLANTAS[planta];
  const fab = FABRICA[planta];
  // os móveis: os de fábrica, com o que a arrumação diz por cima (o que falta nela fica no lugar de fábrica), sem os guardados
  const moveis: Record<string, { c: [number, number]; lado: number }> = JSON.parse(JSON.stringify(fab.moveis));
  for (const [id, m] of Object.entries(arr.moveis ?? {})) {
    if (!TAMANHOS[tipoDe(id)] || (!fab.moveis[id] && tipoDe(id) === id) || !m || !Array.isArray(m.c)) continue;
    moveis[id] = { c: [num(m.c[0], 0), num(m.c[1], 0)], lado: lado(m.lado) };
  }
  // (sem arrumação nenhuma, os guardados de fábrica: a poltrona; com uma sem a lista, nenhum, como a página faz)
  const guardados = Array.isArray(arr.guardados) ? arr.guardados : arr.moveis ? [] : GUARDADOS_DE_FABRICA;
  for (const id of guardados) if (id !== 'cama' && !FUNCAO_DO_MOVEL[id]) delete moveis[id];
  // (só numa arrumação guardada: sem nenhuma, é o quarto novo, e a caminha vem posta)
  if (arr.moveis) for (const id of CHEGAM_GUARDADOS) if (!arr.moveis[id]) delete moveis[id];

  const mundo: MovelNoMundo[] = Object.entries(moveis).map(([id, m]) => {
    const tipo = tipoDe(id);
    const [tu, tv] = TAMANHOS[tipo][m.lado];
    // o centro dentro do quarto (a página prende o pé dentro do chão)
    const u = Math.max(tu / 2, Math.min(N - tu / 2, m.c[0]));
    const v = Math.max(tv / 2, Math.min(N - tv / 2, m.c[1]));
    return {
      id,
      tipo,
      x: v,
      z: u,
      lado: m.lado,
      pe: { x0: v - tv / 2, x1: v + tv / 2, z0: u - tu / 2, z1: u + tu / 2 },
      largura: m.lado % 2 ? tu : tv,
      fundo: m.lado % 2 ? tv : tu,
    };
  });

  const c = arr.cadeira ?? fab.cadeira;
  const cadeira = { x: num(c.v, fab.cadeira.v), z: num(c.u, fab.cadeira.u), giro: num(c.th, fab.cadeira.th) };

  // a janela: a guardada, se o tipo existe e cabe num trecho; senão, a de fábrica da planta
  const cabe = (t: string) => {
    const j = JANELAS[t];
    return !!j && Object.values(pl.paredes).some((ts) => ts.some((tr) => tr[1] - tr[0] >= j.ocupa[1] - j.ocupa[0] - 0.01));
  };
  const jg = arr.janela && cabe(arr.janela.tipo) && (arr.janela.parede === 'direita' || arr.janela.parede === 'esquerda') ? arr.janela : fab.janela;
  const tipoJanela = JANELAS[jg.tipo] ? jg.tipo : fab.janela.tipo;
  const J = JANELAS[tipoJanela];
  const preso = naParede(pl, 'janela', tipoJanela, { parede: jg.parede, v: num(jg.v, 0), h: 0 }, J.ocupa, [0, 0]);
  // o vão do vidro (a grande: o desenho vai até as pontas, o vidro não)
  const vidro = J.vidro ?? J.ocupa;
  const janela = {
    ...preso,
    a: preso.a - (J.ocupa[0] + J.ocupa[1]) / 2 + (vidro[0] + vidro[1]) / 2,
    largura: vidro[1] - vidro[0],
    cortina: !!arr.cortina && tipoJanela === 'original',
    aberta: !!arr.janelaAberta && tipoJanela === 'original',
  };

  // os objetos da parede: os guardados, ou os de fábrica da planta; um de fábrica que a página não conhecia ao salvar entra
  let paredes = arr.parede && typeof arr.parede === 'object' ? { ...arr.parede } : { ...fab.parede };
  if (arr.parede) {
    const sabe = new Set(Array.isArray(arr.conhecidos) ? arr.conhecidos : Object.keys(arr.parede));
    for (const [id, P] of Object.entries(FABRICA.quadrado.parede)) if (!sabe.has(id) && !paredes[id]) paredes[id] = P;
  }
  paredes = Object.fromEntries(Object.entries(paredes).filter(([id, P]) => ITENS_DA_PAREDE[tipoDe(id)] && P && (P.parede === 'direita' || P.parede === 'esquerda')));
  const objetos = Object.entries(paredes).map(([id, P]) => {
    const it = ITENS_DA_PAREDE[tipoDe(id)];
    return naParede(pl, id, tipoDe(id), { parede: P.parede, v: num(P.v, 0), h: num(P.h, 0) }, it.ocupa, it.alto, it.chao);
  });

  // os objetos de cima: só nos móveis que estão no quarto; a posição no tampo gira com o móvel (ondeEmCima, na página)
  const emCima = arr.emCima && typeof arr.emCima === 'object' ? arr.emCima : DE_CIMA_DE_FABRICA;
  const deCima: DeCimaNoMundo[] = [];
  for (const [uid, o] of Object.entries(emCima)) {
    const m = mundo.find((x) => x.id === o?.em);
    // só nos móveis que têm tampo na página (TOPOS: a mesa, o criado-mudo e o guarda-roupa)
    if (!m || typeof o.tipo !== 'string' || !TAMPOS.includes(m.tipo)) continue;
    let [s, t] = [Math.min(1, Math.max(0, num(o.s, 0.5))), Math.min(1, Math.max(0, num(o.t, 0.5)))];
    for (let r = 0; r < m.lado; r++) [s, t] = [1 - t, s];
    // s anda em u (o z do 3D) e t em v (o x)
    deCima.push({ id: uid, tipo: o.tipo, em: m.id, fx: t, fz: s, lado: lado(o.lado) });
  }

  const cores: QuartoNoMundo['cores'] = {};
  const co = arr.cores ?? {};
  // (a cor livre, '#rrggbb', vai como veio: no 3D o tapete é pintado liso, sem a trama do pixel)
  if (CORES_DO_TAPETE[co.tapete]) cores.tapete = CORES_DO_TAPETE[co.tapete];
  else if (typeof co.tapete === 'string' && /^#[0-9a-f]{6}$/.test(co.tapete)) cores.tapete = co.tapete;
  if (CORES_DA_PAREDE[co.parede]) cores.parede = CORES_DA_PAREDE[co.parede]!;
  if (CORES_DO_PISO[co.piso]) cores.piso = CORES_DO_PISO[co.piso]!;

  const trechos: TrechoNoMundo[] = [];
  for (const parede of ['direita', 'esquerda'] as const)
    for (const [de, ate, recuo] of pl.paredes[parede]) trechos.push({ parede: parede === 'direita' ? 'fundo' : 'esquerda', de, ate, recuo });

  return {
    planta,
    chao: (x, z) => x >= 0 && z >= 0 && x < N && z < N && pl.chao(Math.floor(z), Math.floor(x)),
    trechos,
    solidos: pl.solidos.map(([u0, u1, v0, v1]) => ({ x0: v0, x1: v1, z0: u0, z1: u1 })),
    moveis: mundo,
    cadeira,
    janela,
    naParede: objetos,
    deCima,
    cores,
    abajurApagado: !!arr.abajurApagado,
  };
}
