/**
 * AS FASES DO PULO DO COELHO (03/11/2026): três fases curtas de plataforma, desenhadas POR CÓDIGO como uma grade de
 * blocos de 16 px (a grade é nossa; o desenho dos blocos vem do Pixel Platformer da Kenney, em desenho.ts). Cada fase é montada por um roteiro de chamadas (chão, buraco, tábua, mola,
 * espinhos, plataforma que anda), e não por um mapa escrito à mão: mexer num trecho não desalinha o resto.
 *
 * O id da fase leva a versão ("prado-1"): mudar o traçado é fase nova, e os recordes e fantasmas da antiga não se misturam.
 * O servidor guarda as medidas de cada uma (server/src/plataforma.ts: a largada, a chegada, os postos, o tamanho); o teste
 * web/test/plataforma.test.ts confere que batem.
 */

export const T = 16;
export const LINHAS = 14;
export const ALTURA = LINHAS * T;

export const Bloco = {
  Vazio: 0,
  Chao: 1,
  Tabua: 2,
  Espinho: 3,
  Mola: 4,
  /** A PEDRA QUE RACHA (21/11/2026): segura por cima como a tábua; pisada, treme e cai, e volta depois (fisica.ts). */
  Racha: 5,
  /** AS TÁBUAS QUE PISCAM (21/11/2026): a A existe nos tempos pares, a B nos ímpares (`piscaPresente`); seguram por cima. */
  PiscaA: 6,
  PiscaB: 7,
} as const;
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

/**
 * Um bicho de patrulha (19/11/2026): vai de x0 a x1 e volta em `periodo` passos, só pelo passo (o mesmo lugar no mesmo
 * instante para todos). O BESOURO anda no chão (y é o pé dele); a ABELHA voa (y é o meio dela). Os dois se pisam: cair em cima
 * dá um pulinho; encostar de lado volta ao posto.
 */
export interface Patrulha {
  tipo: 'besouro' | 'abelha';
  x0: number;
  x1: number;
  y: number;
  periodo: number;
}

/**
 * Uma CORRENTE DE AR que sobe (21/11/2026): dentro do retângulo, o coelho no ar é empurrado para cima até VSOPRO (fisica.ts).
 * Pelo meio do corpo; não depende do passo, então é igual para todos.
 */
export interface Vento {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Quantos passos dura cada tempo das tábuas que piscam (2 s), e quantos antes da troca elas avisam piscando. */
export const PISCA_PERIODO = 120;
export const PISCA_AVISO = 36;
/** A tábua que pisca existe no passo `n`? A nos tempos pares, B nos ímpares. */
export function piscaPresente(b: Bloco, n: number): boolean {
  const par = Math.floor(n / PISCA_PERIODO) % 2 === 0;
  return b === Bloco.PiscaA ? par : b === Bloco.PiscaB ? !par : false;
}

/** Uma cenoura para juntar: o meio dela. */
export interface Ponto {
  x: number;
  y: number;
}

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
  /** As cenouras para juntar (contadas à parte do tempo), no máximo 30. */
  cenouras: Ponto[];
  /** A cenoura DOURADA, escondida: uma por fase. */
  dourada: Ponto | null;
  bichos: Patrulha[];
  /** As correntes de ar (21/11/2026). */
  ventos: Vento[];
  /** As pedras que racham (21/11/2026): o índice de cada casa na grade (l × colunas + c), na ordem em que foram postas. */
  rachas: number[];
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

/** Meia largura e meia altura de cada bicho (a caixa que bate). */
export const BICHO_MEIA = { besouro: [7, 9], abelha: [6, 5] } as const;

/** Onde está o bicho no passo `n` (o meio da caixa), e para onde olha. Vaivém em triângulo, sem seno. */
export function bichoEm(b: Patrulha, n: number): { x: number; y: number; lado: number } {
  const u = (((n % b.periodo) + b.periodo) % b.periodo) / b.periodo;
  const t = u < 0.5 ? 2 * u : 2 - 2 * u;
  const ida = b.x1 >= b.x0 ? 1 : -1;
  // a abelha sobe e desce um pouco (3 px, em triângulo)
  const v = (n % 48) / 48;
  const onda = b.tipo === 'abelha' ? (v < 0.5 ? v * 4 - 1 : 3 - v * 4) * 3 : 0;
  return {
    x: b.x0 + (b.x1 - b.x0) * t,
    y: b.tipo === 'besouro' ? b.y - BICHO_MEIA.besouro[1] : b.y + onda,
    lado: u < 0.5 ? ida : -ida,
  };
}

/** O montador: cada chamada escreve um trecho da grade. Altura `h` = quantas casas de chão a partir de baixo. */
function montador(id: string, tema: Tema, colunas: number) {
  const blocos = new Uint8Array(colunas * LINHAS);
  const por = (c: number, l: number, b: Bloco) => {
    if (c >= 0 && c < colunas && l >= 0 && l < LINHAS) blocos[l * colunas + c] = b;
  };
  const f: Fase = {
    id,
    tema,
    colunas,
    blocos,
    largada: { x: 0, y: 0 },
    chegada: 0,
    postos: [],
    moveis: [],
    cenouras: [],
    dourada: null,
    bichos: [],
    ventos: [],
    rachas: [],
  };
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
    /** Cenouras em fila, nas colunas [c0, c1) a cada `passo`, uma casa acima do chão de altura h (onde se pega correndo). */
    cenouras(c0: number, c1: number, h: number, passo = 2) {
      for (let c = c0; c < c1; c += passo) f.cenouras.push({ x: c * T + T / 2, y: topo(h) - 10 });
    },
    /** Uma cenoura solta, na linha l (o meio dela fica no meio da casa). */
    cenouraNa(c: number, l: number) {
      f.cenouras.push({ x: c * T + T / 2, y: l * T + T / 2 });
    },
    /** A dourada, na linha l. */
    dourada(c: number, l: number) {
      f.dourada = { x: c * T + T / 2, y: l * T + T / 2 };
    },
    /** Um besouro que anda no chão de altura h, entre as colunas c0 e c1. */
    besouro(c0: number, c1: number, h: number, periodo: number) {
      f.bichos.push({
        tipo: 'besouro',
        x0: c0 * T + T / 2,
        x1: c1 * T + T / 2,
        y: topo(h),
        periodo,
      });
    },
    /** Uma abelha que voa na linha l, entre as colunas c0 e c1. */
    abelha(c0: number, c1: number, l: number, periodo: number) {
      f.bichos.push({
        tipo: 'abelha',
        x0: c0 * T + T / 2,
        x1: c1 * T + T / 2,
        y: l * T + T / 2,
        periodo,
      });
    },
    /** Pedras que racham nas colunas [c0, c1), na linha l. */
    racha(c0: number, c1: number, l: number) {
      for (let c = c0; c < c1; c++) {
        por(c, l, Bloco.Racha);
        f.rachas.push(l * colunas + c);
      }
    },
    /** Tábuas que piscam nas colunas [c0, c1), na linha l: a 'a' existe nos tempos pares, a 'b' nos ímpares. */
    pisca(c0: number, c1: number, l: number, qual: 'a' | 'b') {
      for (let c = c0; c < c1; c++) por(c, l, qual === 'a' ? Bloco.PiscaA : Bloco.PiscaB);
    },
    /** Uma corrente de ar nas colunas [c0, c1), das linhas [l0, l1); até o fundo, ela passa da tela (pega quem cai). */
    vento(c0: number, c1: number, l0: number, l1: number) {
      f.ventos.push({ x0: c0 * T, x1: c1 * T, y0: l0 * T, y1: l1 >= LINHAS ? ALTURA + 40 : l1 * T });
    },
    /** Uma plataforma que anda: da coluna c0 à c1 (o canto esquerdo), na linha l0 à l1, com w casas de largura. */
    movel(c0: number, l0: number, c1: number, l1: number, w: number, periodo: number) {
      f.moveis.push({
        x0: c0 * T,
        y0: l0 * T,
        x1: c1 * T,
        y1: l1 * T,
        w: w * T,
        periodo,
      });
    },
  };
}

/** O PRADO: chão de grama, buracos curtos, degraus, tábuas, uma mola para a ribanceira e a plataforma sobre o rio. */
function prado(): Fase {
  const b = montador('prado-1', 'prado', 224);
  b.chao(0, 20, 3);
  b.largada(3, 3);
  b.cenouras(6, 18, 3, 3);
  b.chao(23, 40, 3);
  b.cenouras(25, 40, 3, 3);
  b.chao(40, 48, 5);
  b.chao(51, 60, 5);
  b.espinhos(55, 57, 5);
  b.chao(60, 72, 3);
  b.posto(64, 3);
  // as tábuas sobre o buraco largo
  b.tabua(74, 78, 9);
  b.tabua(81, 85, 7);
  b.tabua(88, 92, 9);
  b.cenouraNa(76, 8);
  b.cenouraNa(83, 6);
  b.cenouraNa(90, 8);
  b.chao(94, 112, 3);
  // a dourada: numa tábua alta à esquerda da mola (subindo por ela, volta-se um pouco)
  b.tabua(98, 102, 4);
  b.dourada(100, 3);
  // a mola e a ribanceira (sem ela não se sobe)
  b.mola(104, 3);
  b.chao(108, 124, 9);
  b.chao(124, 138, 4);
  b.posto(127, 4);
  b.cenouras(112, 122, 9, 3);
  b.chao(141, 152, 4);
  b.espinhos(146, 148, 4);
  // o rio, com a plataforma que vai e volta
  b.movel(152, 10, 162, 10, 3, 240);
  b.chao(165, 188, 4);
  b.posto(168, 4);
  b.espinhos(176, 178, 4);
  b.cenouras(170, 175, 4, 2);
  b.chao(191, 224, 3);
  b.cenouras(195, 211, 3, 3);
  b.chegada(212);
  return b.f;
}

/** A TOCA: caverna com teto, espinhos em cima e embaixo, o elevador e a mola que leva ao túnel de cima. */
function toca(): Fase {
  const b = montador('toca-1', 'toca', 236);
  b.bloco(0, 236, 0, 2); // o teto de sempre
  b.chao(0, 22, 3);
  b.largada(3, 3);
  b.cenouras(4, 13, 3, 3);
  b.bloco(14, 22, 2, 6); // o teto baixa: passa-se andando
  b.cenouras(15, 21, 3, 2);
  b.chao(25, 44, 3);
  b.espinhos(31, 33, 3);
  b.espinhos(38, 40, 3);
  b.cenouras(34, 37, 3, 2);
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
  b.cenouras(82, 94, 9, 3);
  b.chao(99, 112, 9);
  b.espinhos(105, 107, 9);
  // a descida, com tábuas
  b.tabua(114, 118, 7);
  b.tabua(120, 124, 9);
  b.cenouraNa(116, 6);
  b.cenouraNa(122, 8);
  b.chao(126, 146, 3);
  b.posto(129, 3);
  b.bloco(134, 142, 2, 7);
  b.espinhosNa(134, 142, 7); // estalactites: aqui não se pula
  b.cenouras(135, 142, 3, 2);
  b.chao(149, 160, 3);
  b.mola(156, 3);
  // a dourada: numa tábua alta à esquerda da mola
  b.tabua(150, 154, 4);
  b.dourada(151, 3);
  b.chao(160, 172, 8);
  b.chao(172, 186, 4);
  b.posto(175, 4);
  b.movel(186, 10, 196, 10, 3, 220);
  b.chao(199, 236, 4);
  b.espinhos(206, 208, 4);
  b.cenouras(200, 206, 4, 2);
  b.cenouras(209, 223, 4, 3);
  b.chegada(224);
  return b.f;
}

/** AS COPAS: galhos (tábuas) sobre o vazio, plataformas que andam e molas presas no tronco. */
function copas(): Fase {
  const b = montador('copas-1', 'copas', 232);
  b.chao(0, 14, 4);
  b.largada(3, 4);
  b.cenouras(6, 13, 4, 3);
  b.tabua(16, 21, 9);
  b.tabua(24, 29, 8);
  b.tabua(32, 37, 9);
  b.cenouraNa(18, 8);
  b.cenouraNa(26, 7);
  b.cenouraNa(34, 8);
  b.chao(39, 50, 5);
  b.posto(42, 5);
  b.espinhos(46, 48, 5);
  b.cenouras(40, 45, 5, 2);
  b.movel(50, 8, 60, 8, 3, 240);
  b.tabua(64, 69, 8);
  b.tabua(72, 76, 6);
  b.cenouraNa(66, 7);
  b.cenouraNa(74, 5);
  b.molaNa(79, 11);
  b.chao(82, 96, 10);
  b.posto(85, 10);
  b.cenouras(87, 95, 10, 3);
  // a dourada: no alto da copa, um pulo acima do fim do galho grande
  b.dourada(95, 2);
  b.tabua(98, 102, 6);
  b.tabua(105, 109, 8);
  b.tabua(112, 117, 9);
  b.cenouraNa(100, 5);
  b.cenouraNa(107, 7);
  b.cenouraNa(114, 8);
  b.chao(119, 132, 4);
  b.posto(122, 4);
  b.cenouras(120, 125, 4, 2);
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
  b.cenouras(193, 197, 4, 2);
  b.cenouras(202, 219, 4, 3);
  b.chegada(220);
  return b.f;
}

/**
 * O CÓRREGO (19/11/2026): o prado com bichos de patrulha. O ATALHO: no fundo do córrego, embaixo das tábuas, há uma mola. Quem
 * cai nela sobe até a ponte de cima, que pula a abelha e os espinhos; quem pula as tábuas nem a vê.
 */
function corrego(): Fase {
  const b = montador('corrego-1', 'prado', 230);
  b.chao(0, 20, 3);
  b.largada(3, 3);
  b.cenouras(6, 18, 3, 3);
  b.besouro(11, 18, 3, 180);
  b.chao(23, 42, 3);
  b.besouro(27, 40, 3, 240);
  b.cenouras(25, 40, 3, 3);
  // o córrego, com as tábuas; e no fundo, a mola do atalho
  b.tabua(45, 49, 9);
  b.tabua(52, 56, 8);
  b.tabua(59, 63, 9);
  b.cenouraNa(47, 8);
  b.cenouraNa(54, 7);
  b.cenouraNa(61, 8);
  b.molaNa(50, 13);
  b.molaNa(51, 13);
  b.tabua(48, 86, 6);
  b.cenouraNa(66, 5);
  b.cenouraNa(72, 5);
  b.cenouraNa(78, 5);
  b.dourada(84, 5);
  b.chao(65, 88, 3);
  b.posto(67, 3);
  b.abelha(71, 81, 10, 180);
  b.espinhos(83, 85, 3);
  b.chao(88, 108, 3);
  b.besouro(92, 104, 3, 170);
  b.espinhos(105, 107, 3);
  b.chao(110, 126, 3);
  b.posto(112, 3);
  b.cenouras(114, 125, 3, 3);
  b.besouro(116, 125, 3, 200);
  // o rio grande, com a plataforma que vai e volta
  b.movel(126, 10, 136, 10, 3, 240);
  b.chao(139, 160, 4);
  b.posto(142, 4);
  b.abelha(147, 158, 9, 150);
  b.chao(160, 172, 6);
  b.espinhos(165, 167, 6);
  b.chao(175, 190, 4);
  b.besouro(178, 188, 4, 180);
  b.chao(193, 230, 3);
  b.cenouras(196, 216, 3, 3);
  b.chegada(218);
  return b.f;
}

/**
 * A MINA (19/11/2026): a toca com bichos. O ATALHO: um buraco que parece perigo, logo depois da ribanceira, tem uma mola no
 * fundo; ela leva à tábua alta, que passa por cima dos espinhos e da abelha.
 */
function mina(): Fase {
  const b = montador('mina-1', 'toca', 228);
  b.bloco(0, 228, 0, 2);
  b.chao(0, 20, 3);
  b.largada(3, 3);
  b.cenouras(5, 18, 3, 3);
  b.besouro(10, 19, 3, 160);
  b.chao(23, 44, 3);
  b.espinhos(30, 32, 3);
  b.cenouras(24, 29, 3, 2);
  b.bloco(36, 44, 2, 7);
  b.besouro(35, 43, 3, 180);
  b.chao(47, 62, 5);
  b.posto(49, 5);
  b.cenouras(52, 61, 5, 3);
  b.abelha(54, 61, 8, 160);
  b.chao(65, 80, 3);
  b.besouro(66, 75, 3, 170);
  b.mola(77, 3);
  b.chao(80, 100, 9);
  b.bloco(80, 100, 2, 3);
  b.posto(82, 9);
  b.cenouras(84, 98, 9, 3);
  b.chao(100, 103, 3);
  // o buraco da mola (as colunas 103 e 104) e a tábua alta do atalho
  b.molaNa(103, 13);
  b.molaNa(104, 13);
  b.tabua(106, 128, 6);
  b.cenouraNa(108, 5);
  b.cenouraNa(114, 5);
  b.cenouraNa(120, 5);
  b.dourada(126, 5);
  b.chao(105, 130, 3);
  b.posto(107, 3);
  b.espinhos(112, 114, 3);
  b.abelha(116, 126, 10, 150);
  b.espinhos(127, 129, 3);
  b.chao(130, 146, 3);
  b.besouro(133, 145, 3, 170);
  b.movel(146, 10, 156, 10, 3, 220);
  b.chao(159, 176, 4);
  b.posto(162, 4);
  b.cenouras(164, 175, 4, 3);
  b.bloco(166, 176, 2, 7);
  b.chao(179, 192, 4);
  b.besouro(181, 191, 4, 160);
  b.chao(195, 228, 4);
  b.espinhos(200, 202, 4);
  b.cenouras(204, 216, 4, 3);
  b.chegada(216);
  return b.f;
}

/**
 * O NINHO (19/11/2026): as copas com bichos. O ATALHO: do fim do galho grande, um pulo alcança o galho escondido lá em cima,
 * que passa por cima das tábuas e da abelha da descida.
 */
function ninho(): Fase {
  const b = montador('ninho-1', 'copas', 226);
  b.chao(0, 14, 4);
  b.largada(3, 4);
  b.cenouras(6, 13, 4, 3);
  b.tabua(16, 21, 9);
  b.tabua(24, 29, 8);
  b.tabua(32, 37, 9);
  b.cenouraNa(18, 8);
  b.cenouraNa(26, 7);
  b.cenouraNa(34, 8);
  b.chao(39, 52, 5);
  b.posto(41, 5);
  b.besouro(45, 51, 5, 150);
  b.cenouras(42, 45, 5, 2);
  b.movel(52, 8, 62, 8, 3, 240);
  b.tabua(66, 71, 8);
  b.tabua(74, 78, 6);
  b.cenouraNa(68, 7);
  b.cenouraNa(76, 5);
  b.molaNa(81, 11);
  b.chao(84, 98, 10);
  b.posto(86, 10);
  b.besouro(90, 97, 10, 170);
  b.cenouras(89, 97, 10, 3);
  // o galho escondido, no alto
  b.tabua(99, 138, 2);
  b.cenouraNa(104, 1);
  b.cenouraNa(112, 1);
  b.dourada(120, 0);
  b.cenouraNa(128, 1);
  b.tabua(100, 104, 6);
  b.tabua(107, 111, 8);
  b.tabua(114, 119, 9);
  b.abelha(107, 118, 6, 170);
  b.chao(121, 136, 4);
  b.posto(123, 4);
  b.abelha(127, 135, 9, 160);
  b.cenouras(122, 126, 4, 2);
  b.movel(136, 9, 146, 9, 3, 220);
  b.chao(150, 164, 4);
  b.posto(152, 4);
  b.besouro(155, 163, 4, 160);
  b.tabua(167, 171, 8);
  b.tabua(174, 178, 7);
  b.tabua(181, 185, 8);
  b.cenouraNa(169, 7);
  b.cenouraNa(176, 6);
  b.cenouraNa(183, 7);
  b.chao(188, 226, 4);
  b.cenouras(190, 212, 4, 3);
  b.chegada(214);
  return b.f;
}

/**
 * O VENTO (21/11/2026): as copas com CORRENTES DE AR que sobem. Sobre o vão largo demais para o pulo, a corrente segura o
 * coelho no alto e ele vai de lado até o outro galho; a do chão baixo leva ao galho alto. A dourada fica no galho mais alto
 * de todos, onde só a corrente do meio alcança.
 */
function vento(): Fase {
  const b = montador('vento-1', 'copas', 220);
  b.chao(0, 14, 4);
  b.largada(3, 4);
  b.cenouras(6, 13, 4, 3);
  // o primeiro vão, com a corrente no meio
  b.vento(16, 24, 6, LINHAS);
  b.cenouraNa(18, 5);
  b.cenouraNa(20, 5);
  b.cenouraNa(22, 5);
  b.chao(26, 38, 5);
  b.posto(28, 5);
  b.espinhos(33, 35, 5);
  // o chão baixo e a corrente que leva ao galho alto
  b.chao(38, 46, 3);
  b.vento(42, 46, 3, 11);
  b.cenouraNa(44, 6);
  b.chao(46, 62, 10);
  b.posto(48, 10);
  b.cenouras(50, 61, 10, 3);
  // a descida pelas tábuas
  b.tabua(64, 68, 6);
  b.tabua(71, 75, 8);
  b.chao(78, 92, 4);
  b.posto(80, 4);
  b.cenouras(82, 91, 4, 3);
  // o vão grande, com duas correntes e uma folga entre elas
  b.vento(94, 98, 6, LINHAS);
  b.vento(100, 104, 6, LINHAS);
  b.cenouraNa(96, 5);
  b.cenouraNa(102, 5);
  b.chao(107, 122, 5);
  b.posto(109, 5);
  b.espinhos(115, 117, 5);
  b.chao(122, 142, 3);
  b.cenouras(124, 134, 3, 3);
  // a corrente do meio: leva ao galho de cima e, no alto dela, ao galho escondido com a dourada
  b.vento(142, 146, 2, 11);
  b.tabua(146, 152, 2);
  b.dourada(150, 1);
  b.chao(146, 160, 8);
  b.posto(150, 8);
  b.cenouras(152, 159, 8, 3);
  b.chao(160, 174, 5);
  b.espinhos(166, 168, 5);
  // o último vão, com a corrente
  b.vento(176, 184, 7, LINHAS);
  b.cenouraNa(180, 6);
  b.chao(186, 220, 4);
  b.espinhos(192, 194, 4);
  b.cenouras(196, 206, 4, 3);
  b.chegada(208);
  return b.f;
}

/**
 * A CAVERNA (21/11/2026): a toca com PEDRAS QUE RACHAM. Pisada, a pedra treme meio segundo e cai; volta 3 s depois. Quem
 * para em cima dela cai junto: a ponte comprida e a de cima dos espinhos se atravessam correndo. A dourada fica numa pedra
 * solta no alto, depois da ribanceira.
 */
function caverna(): Fase {
  const b = montador('caverna-1', 'toca', 224);
  b.bloco(0, 224, 0, 2);
  b.chao(0, 20, 3);
  b.largada(3, 3);
  b.cenouras(5, 18, 3, 3);
  b.racha(23, 26, 10);
  b.racha(29, 32, 9);
  b.cenouraNa(24, 9);
  b.cenouraNa(30, 8);
  b.chao(34, 46, 3);
  b.posto(36, 3);
  b.espinhos(40, 42, 3);
  // a ponte comprida
  b.racha(46, 64, 11);
  b.cenouraNa(50, 10);
  b.cenouraNa(55, 10);
  b.cenouraNa(60, 10);
  b.chao(64, 80, 3);
  b.posto(66, 3);
  b.bloco(70, 78, 2, 7);
  b.cenouras(70, 78, 3, 2);
  // a escada de pedras até a ribanceira
  b.racha(82, 85, 9);
  b.racha(87, 90, 7);
  b.racha(92, 95, 5);
  b.chao(97, 112, 9);
  b.posto(100, 9);
  b.cenouras(101, 111, 9, 3);
  // a pedra solta da dourada, depois da beira
  b.racha(114, 116, 4);
  b.dourada(115, 3);
  b.chao(116, 134, 4);
  b.posto(119, 4);
  b.cenouras(121, 131, 4, 3);
  // a ponte sobre os espinhos
  b.chao(134, 150, 2);
  b.espinhos(134, 150, 2);
  b.racha(134, 150, 10);
  b.chao(150, 166, 4);
  b.posto(152, 4);
  b.bloco(156, 164, 2, 7);
  // os degraus que caem, sobre o buraco
  b.racha(168, 171, 9);
  b.racha(174, 177, 7);
  b.racha(180, 183, 9);
  b.cenouraNa(175, 6);
  b.chao(186, 224, 4);
  b.espinhos(194, 196, 4);
  b.cenouras(198, 210, 4, 3);
  b.chegada(212);
  return b.f;
}

/**
 * A CACHOEIRA (21/11/2026): o prado com TÁBUAS QUE PISCAM. A tábua clara existe num tempo, a escura no outro, e trocam a
 * cada 2 s (piscando antes): o caminho sobre o rio se faz no ritmo delas. A dourada fica no alto do rio grande, no pulo mais alto de uma tábua.
 */
function cachoeira(): Fase {
  const b = montador('cachoeira-1', 'prado', 222);
  b.chao(0, 20, 3);
  b.largada(3, 3);
  b.cenouras(6, 18, 3, 3);
  b.pisca(22, 26, 10, 'a');
  b.pisca(28, 32, 10, 'b');
  b.cenouraNa(24, 9);
  b.cenouraNa(30, 9);
  b.chao(34, 48, 3);
  b.posto(36, 3);
  b.cenouras(38, 46, 3, 3);
  // a escada que pisca até a ribanceira
  b.pisca(50, 53, 9, 'a');
  b.pisca(55, 58, 7, 'b');
  b.pisca(60, 63, 5, 'a');
  b.chao(65, 80, 9);
  b.posto(67, 9);
  b.cenouras(69, 79, 9, 3);
  // a descida
  b.pisca(82, 86, 7, 'b');
  b.pisca(88, 92, 9, 'a');
  b.chao(94, 110, 4);
  b.posto(96, 4);
  b.espinhos(102, 104, 4);
  // o rio grande
  b.pisca(112, 115, 10, 'a');
  b.pisca(117, 120, 10, 'b');
  b.pisca(122, 125, 10, 'a');
  b.pisca(127, 130, 10, 'b');
  b.dourada(126, 6);
  b.cenouraNa(113, 9);
  b.cenouraNa(118, 9);
  b.cenouraNa(128, 9);
  b.chao(132, 148, 4);
  b.posto(134, 4);
  b.cenouras(136, 146, 4, 3);
  b.movel(148, 10, 158, 10, 3, 240);
  b.chao(161, 176, 4);
  b.posto(164, 4);
  b.espinhos(170, 172, 4);
  b.chao(179, 222, 4);
  b.espinhos(186, 188, 4);
  b.cenouras(190, 206, 4, 3);
  b.chegada(208);
  return b.f;
}

export const FASES: Fase[] = [prado(), toca(), copas(), corrego(), mina(), ninho(), vento(), caverna(), cachoeira()];
export const fasePorId = (id: string) => FASES.find((f) => f.id === id) ?? FASES[0];

/** A copa: as três fases seguidas (o servidor tem a mesma lista: server/src/plataforma.ts). */
export const COPA_DO_PULO = 'copa-do-pulo';
export const COPAS_DO_PULO: Record<string, string[]> = {
  [COPA_DO_PULO]: ['prado-1', 'toca-1', 'copas-1'],
  // a segunda copa (19/11/2026): as três fases com bichos
  'copa-dos-bichos': ['corrego-1', 'mina-1', 'ninho-1'],
  // a terceira copa (21/11/2026): as três fases com um elemento novo cada (o vento, a pedra que racha, a tábua que pisca)
  'copa-dos-elementos': ['vento-1', 'caverna-1', 'cachoeira-1'],
};

/**
 * AS MEDALHAS DE CADA FASE (20/11/2026, o lote C da segunda auditoria), como as da Torre do Celeiro: sobre o tempo do PILOTO
 * AUTOMÁTICO, em passos (web/test/plataforma.test.ts confere que é o dele: mexeu na fase ou na física, medir de novo). Ouro até
 * ele, prata até 25% a mais, bronze até 60% a mais. Só tela: o servidor guarda o tempo, não a medalha.
 */
export const TEMPO_DO_PILOTO_DO_PULO: Record<string, number> = {
  'prado-1': 1949,
  'toca-1': 2071,
  'copas-1': 1955,
  'corrego-1': 1988,
  'mina-1': 1909,
  'ninho-1': 1979,
  'vento-1': 1788,
  'caverna-1': 1827,
  'cachoeira-1': 2429,
};
export const MEDALHAS_DO_PULO = [1, 1.25, 1.6] as const;
