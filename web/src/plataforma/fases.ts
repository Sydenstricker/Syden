/**
 * AS FASES DO PULO DO COELHO (03/11/2026): três fases curtas de plataforma, desenhadas POR CÓDIGO como uma grade de
 * blocos de 16 px (nenhuma arte de terceiro). Cada fase é montada por um roteiro de chamadas (chão, buraco, tábua, mola,
 * espinhos, plataforma que anda), e não por um mapa escrito à mão: mexer num trecho não desalinha o resto.
 *
 * O id da fase leva a versão ("prado-1"): mudar o traçado é fase nova, e os recordes e fantasmas da antiga não se misturam.
 * O servidor guarda as medidas de cada uma (server/src/plataforma.ts: a largada, a chegada, os postos, o tamanho); o teste
 * web/test/plataforma.test.ts confere que batem.
 */

export const T = 16;
export const LINHAS = 14;
export const ALTURA = LINHAS * T;

export const Bloco = { Vazio: 0, Chao: 1, Tabua: 2, Espinho: 3, Mola: 4 } as const;
export type Bloco = (typeof Bloco)[keyof typeof Bloco];

/** Uma plataforma que anda, de (x0, y0) a (x1, y1) e volta, em `periodo` passos. As posições são do canto de cima à esquerda. */
export interface Movel {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  w: number;
  periodo: number;
}

export type Tema = 'prado' | 'toca' | 'copas';

export interface Fase {
  id: string;
  tema: Tema;
  colunas: number;
  /** A grade, linha a linha (colunas × LINHAS). */
  blocos: Uint8Array;
  /** Onde se larga (o pé do coelho). */
  largada: { x: number; y: number };
  /** A linha de chegada (x da bandeira): passou dela, terminou. */
  chegada: number;
  /** Os postos (onde se volta depois de cair): o pé do coelho em cada um, da esquerda para a direita. */
  postos: { x: number; y: number }[];
  moveis: Movel[];
}

/** O que existe numa casa da grade (fora dela: o alto é teto, os lados são parede, embaixo é vazio). */
export function blocoEm(f: Fase, c: number, l: number): Bloco {
  if (l < 0) return Bloco.Chao;
  if (l >= LINHAS) return Bloco.Vazio;
  if (c < 0 || c >= f.colunas) return Bloco.Chao;
  return f.blocos[l * f.colunas + c] as Bloco;
}

/** Onde está a plataforma que anda no passo `n`. */
export function movelEm(m: Movel, n: number): { x: number; y: number } {
  const t = (1 - Math.cos((2 * Math.PI * n) / m.periodo)) / 2;
  return { x: m.x0 + (m.x1 - m.x0) * t, y: m.y0 + (m.y1 - m.y0) * t };
}

/** O montador: cada chamada escreve um trecho da grade. Altura `h` = quantas casas de chão a partir de baixo. */
function montador(id: string, tema: Tema, colunas: number) {
  const blocos = new Uint8Array(colunas * LINHAS);
  const por = (c: number, l: number, b: Bloco) => {
    if (c >= 0 && c < colunas && l >= 0 && l < LINHAS) blocos[l * colunas + c] = b;
  };
  const f: Fase = { id, tema, colunas, blocos, largada: { x: 0, y: 0 }, chegada: 0, postos: [], moveis: [] };
  const topo = (h: number) => (LINHAS - h) * T;
  return {
    f,
    /** Chão de altura h nas colunas [c0, c1). */
    chao(c0: number, c1: number, h: number) {
      for (let c = c0; c < c1; c++) for (let l = LINHAS - h; l < LINHAS; l++) por(c, l, Bloco.Chao);
    },
    /** Um bloco maciço (teto de caverna, pilar): linhas [l0, l1). */
    bloco(c0: number, c1: number, l0: number, l1: number) {
      for (let c = c0; c < c1; c++) for (let l = l0; l < l1; l++) por(c, l, Bloco.Chao);
    },
    /** Uma tábua (atravessa por baixo, segura por cima) na linha l. */
    tabua(c0: number, c1: number, l: number) {
      for (let c = c0; c < c1; c++) por(c, l, Bloco.Tabua);
    },
    /** Espinhos em cima do chão de altura h. */
    espinhos(c0: number, c1: number, h: number) {
      for (let c = c0; c < c1; c++) por(c, LINHAS - h - 1, Bloco.Espinho);
    },
    /** Espinhos numa linha qualquer (o teto da toca). */
    espinhosNa(c0: number, c1: number, l: number) {
      for (let c = c0; c < c1; c++) por(c, l, Bloco.Espinho);
    },
    /** Uma mola em cima do chão de altura h. */
    mola(c: number, h: number) {
      por(c, LINHAS - h - 1, Bloco.Mola);
    },
    /** Uma mola solta, na linha l. */
    molaNa(c: number, l: number) {
      por(c, l, Bloco.Mola);
    },
    largada(c: number, h: number) {
      f.largada = { x: c * T + T / 2, y: topo(h) };
      f.postos.push({ ...f.largada });
    },
    posto(c: number, h: number) {
      f.postos.push({ x: c * T + T / 2, y: topo(h) });
    },
    chegada(c: number) {
      f.chegada = c * T;
    },
    /** Uma plataforma que anda: da coluna c0 à c1 (o canto esquerdo), na linha l0 à l1, com w casas de largura. */
    movel(c0: number, l0: number, c1: number, l1: number, w: number, periodo: number) {
      f.moveis.push({ x0: c0 * T, y0: l0 * T, x1: c1 * T, y1: l1 * T, w: w * T, periodo });
    },
  };
}

/** O PRADO: chão de grama, buracos curtos, degraus, tábuas, uma mola para a ribanceira e a plataforma sobre o rio. */
function prado(): Fase {
  const b = montador('prado-1', 'prado', 224);
  b.chao(0, 20, 3);
  b.largada(3, 3);
  b.chao(23, 40, 3);
  b.chao(40, 48, 5);
  b.chao(51, 60, 5);
  b.espinhos(55, 57, 5);
  b.chao(60, 72, 3);
  b.posto(64, 3);
  // as tábuas sobre o buraco largo
  b.tabua(74, 78, 9);
  b.tabua(81, 85, 7);
  b.tabua(88, 92, 9);
  b.chao(94, 112, 3);
  // a mola e a ribanceira (sem ela não se sobe)
  b.mola(104, 3);
  b.chao(108, 124, 9);
  b.chao(124, 138, 4);
  b.posto(127, 4);
  b.chao(141, 152, 4);
  b.espinhos(146, 148, 4);
  // o rio, com a plataforma que vai e volta
  b.movel(152, 10, 162, 10, 3, 240);
  b.chao(165, 188, 4);
  b.posto(168, 4);
  b.espinhos(176, 178, 4);
  b.chao(191, 224, 3);
  b.chegada(212);
  return b.f;
}

/** A TOCA: caverna com teto, espinhos em cima e embaixo, o elevador e a mola que leva ao túnel de cima. */
function toca(): Fase {
  const b = montador('toca-1', 'toca', 236);
  b.bloco(0, 236, 0, 2); // o teto de sempre
  b.chao(0, 22, 3);
  b.largada(3, 3);
  b.bloco(14, 22, 2, 6); // o teto baixa: passa-se andando
  b.chao(25, 44, 3);
  b.espinhos(31, 33, 3);
  b.espinhos(38, 40, 3);
  b.chao(44, 56, 5);
  b.bloco(44, 56, 2, 4);
  b.chao(59, 74, 3);
  b.posto(62, 3);
  // o elevador: sobe do fundo até o túnel de cima
  b.movel(74, 11, 74, 5, 3, 300);
  b.chao(74, 77, 1);
  b.espinhosNa(74, 77, 12);
  b.chao(77, 96, 9);
  b.bloco(77, 96, 2, 3);
  b.posto(80, 9);
  b.chao(99, 112, 9);
  b.espinhos(105, 107, 9);
  // a descida, com tábuas
  b.tabua(114, 118, 7);
  b.tabua(120, 124, 9);
  b.chao(126, 146, 3);
  b.posto(129, 3);
  b.bloco(134, 142, 2, 7);
  b.espinhosNa(134, 142, 7); // estalactites: aqui não se pula
  b.chao(149, 160, 3);
  b.mola(156, 3);
  b.chao(160, 172, 8);
  b.chao(172, 186, 4);
  b.posto(175, 4);
  b.movel(186, 10, 196, 10, 3, 220);
  b.chao(199, 236, 4);
  b.espinhos(206, 208, 4);
  b.chegada(224);
  return b.f;
}

/** AS COPAS: galhos (tábuas) sobre o vazio, plataformas que andam e molas presas no tronco. */
function copas(): Fase {
  const b = montador('copas-1', 'copas', 232);
  b.chao(0, 14, 4);
  b.largada(3, 4);
  b.tabua(16, 21, 9);
  b.tabua(24, 29, 8);
  b.tabua(32, 37, 9);
  b.chao(39, 50, 5);
  b.posto(42, 5);
  b.espinhos(46, 48, 5);
  b.movel(50, 8, 60, 8, 3, 240);
  b.tabua(64, 69, 8);
  b.tabua(72, 76, 6);
  b.molaNa(79, 11);
  b.chao(82, 96, 10);
  b.posto(85, 10);
  b.tabua(98, 102, 6);
  b.tabua(105, 109, 8);
  b.tabua(112, 117, 9);
  b.chao(119, 132, 4);
  b.posto(122, 4);
  b.espinhos(126, 128, 4);
  b.movel(132, 9, 132, 5, 3, 260);
  b.tabua(136, 141, 5);
  b.tabua(144, 148, 7);
  b.tabua(151, 155, 9);
  b.chao(157, 170, 4);
  b.posto(160, 4);
  b.movel(170, 9, 180, 9, 3, 220);
  b.tabua(184, 188, 8);
  b.chao(191, 232, 4);
  b.espinhos(198, 200, 4);
  b.chegada(220);
  return b.f;
}

export const FASES: Fase[] = [prado(), toca(), copas()];
export const fasePorId = (id: string) => FASES.find((f) => f.id === id) ?? FASES[0];

/** A copa: as três fases seguidas (o servidor tem a mesma lista: server/src/plataforma.ts). */
export const COPA_DO_PULO = 'copa-do-pulo';
export const COPAS_DO_PULO: Record<string, string[]> = { [COPA_DO_PULO]: ['prado-1', 'toca-1', 'copas-1'] };
