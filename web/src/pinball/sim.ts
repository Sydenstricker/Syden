/**
 * O PINBALL DA HORTA (16/11/2026): a mesa, a bola e a regra. SÓ A MECÂNICA dos pinballs (palhetas, mola, rebatedores,
 * estilingues, alvos que caem, a volta pela órbita, a bola salva, o multibola e a mesa que trava quando se sacode demais);
 * o desenho da mesa, os nomes e a arte são nossos.
 *
 * ESTE ARQUIVO MORA EM DUAS CÓPIAS IGUAIS BYTE A BYTE (web/src/pinball/sim.ts e server/src/pinball-sim.ts;
 * web/test/pinball.test.ts confere), como a física do golfe e a do skate: o site joga e manda os COMANDOS de cada passo em
 * trechos, e o servidor REFAZ a partida com a mesma conta. Os pontos que valem são os dele. Mexeu num, copie no outro:
 * servidor e site sobem juntos.
 *
 * Por isso a conta é só + − × ÷ e raiz: nada de seno, cosseno, sorteio ou relógio (os ângulos das palhetas e o arco do alto
 * saem de giros por constantes escritas aqui, multiplicados na carga do módulo, o que dá o mesmo número em qualquer
 * navegador). Passos fixos de 1/60 s com 8 subpassos; o tempo da partida é o número de passos.
 *
 * As medidas são os pixels da mesa desenhada (240 × 400, y para baixo), e a "gravidade" é a inclinação da mesa.
 *
 * O QUE ENTROU EM 19/11/2026 (a auditoria dos mini-games: "uma mesa sem missões"):
 *  - A TACADA CERTEIRA: a bola lançada pela mola que entra numa pista do alto antes de tocar em qualquer outra coisa vale 2500. É
 *    a força certa da mola (medida: só uma faixa estreita de carga leva a bola direto às pistas).
 *  - A BOLA EXTRA nos marcos de pontos (MARCOS_DA_BOLA_EXTRA): a bola que cai depois disso volta sem gastar uma das três.
 *  - AS MISSÕES, em ciclo (MISSOES): uma de cada vez, com o prazo contado só com bola em jogo; cumprida, vale 1000 × a PATENTE
 *    da partida, e a patente sobe (até 9). Perdida no prazo, vem a seguinte, sem castigo.
 *  - A RAMPA com trilho: a bola rápida que sobe pela boca dela (à direita, acima do estilingue) vai pelo trilho até o alto e cai
 *    na primeira pista. Ela não tem parede: a bola lenta passa por baixo dela.
 */

export const LARGURA = 240;
export const ALTURA = 400;
export const RAIO = 4.5;
export const PASSO = 1 / 60;
const SUB = 8;
const DT = PASSO / SUB;
const G = 700;
const VMAX = 1100;
/** As bolas de uma partida. */
export const BOLAS = 3;
/** A bola salva: este tanto de passos depois do lançamento (8 s), e no começo do multibola (10 s). */
export const SALVA_PASSOS = 480;
const SALVA_MULTIBOLA = 600;
/** A mola: segurar carrega até este tanto de passos; a força vai de MOLA_MIN a MOLA_MIN + MOLA_MAX_CARGA × MOLA_POR_PASSO. */
const MOLA_MAX_CARGA = 50;
const MOLA_MIN = 300;
const MOLA_POR_PASSO = 14;
/** Ninguém puxou a mola em 10 s: ela sai sozinha (a partida não fica parada). */
const MOLA_OCIOSA = 600;
const MOLA_AUTOMATICA = 40;
/** O sacudir: cada tranco soma isto ao tremor, que cai 1 por passo; passou do limite, a mesa trava até a bola cair. */
const TRANCO = 80;
const TREMOR_AVISO = 110;
const TREMOR_TILT = 200;
const BUSCA = 300;
/** O teto de passos de qualquer partida (30 min), o do Solo; a da sala é menor (o servidor diz). */
export const PASSOS_MAXIMOS = 108_000;
/** Um trecho mandado ao servidor tem no máximo isto de passos. */
export const PASSOS_POR_TRECHO = 1200;
export const COMANDO_MAXIMO = 15;

// os bits do comando de cada passo
export const ESQ = 1;
export const DIR = 2;
export const MOLA = 4;
export const SACUDIR = 8;

/** A bola extra: cada marco de pontos dá uma (19/11/2026). */
export const MARCOS_DA_BOLA_EXTRA = [40_000, 120_000, 300_000];
/** A tacada certeira: quanto vale, e por quanto tempo depois do lançamento ela pode acontecer. */
export const PONTOS_DA_TACADA = 2500;
const TACADA_PASSOS = 240;

/** AS MISSÕES, em ciclo: o evento que conta, quantos, e o prazo (em passos com bola em jogo). */
export type IdDaMissao = 'cenouras' | 'repolhos' | 'orbitas' | 'rampas' | 'toca' | 'estilingues';
export const MISSOES: readonly { id: IdDaMissao; evento: string; meta: number; passos: number }[] = [
  { id: 'cenouras', evento: 'cenoura', meta: 3, passos: 1200 },
  { id: 'repolhos', evento: 'repolho', meta: 10, passos: 1200 },
  { id: 'orbitas', evento: 'orbita', meta: 2, passos: 2400 },
  { id: 'rampas', evento: 'rampa', meta: 2, passos: 2400 },
  { id: 'toca', evento: 'toca', meta: 1, passos: 2400 },
  { id: 'estilingues', evento: 'estilingue', meta: 6, passos: 1200 },
];
export const PONTOS_DA_MISSAO = 1000;
export const PATENTE_MAXIMA = 9;

/** A RAMPA: a boca (o sensor, em y) e o trilho até o alto, que solta a bola na primeira pista. */
export const BOCA_DA_RAMPA = { x0: 148, x1: 178, y: 238 };
const VELOCIDADE_DA_BOCA = 400;
export const TRILHO: [number, number][] = [
  [163, 238],
  [170, 200],
  [178, 150],
  [180, 100],
  [162, 58],
  [124, 28],
  [84, 34],
];
const TRILHO_POR_PASSO = 5;
export const PONTOS_DA_RAMPA = 750;
/** O comprimento acumulado do trilho até cada ponto. */
export const TRILHO_ACC: number[] = acumulado(TRILHO);

/** O comprimento acumulado de um trilho até cada ponto. */
function acumulado(trilho: readonly [number, number][]): number[] {
  const l = [0];
  for (let i = 1; i < trilho.length; i++) {
    const dx = trilho[i][0] - trilho[i - 1][0];
    const dy = trilho[i][1] - trilho[i - 1][1];
    l.push(l[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  return l;
}

/** O ponto do trilho a `d` do começo (o da mesa `g`; sem ela, o da horta). */
export function pontoDoTrilho(d: number, g: { trilho: readonly [number, number][]; trilhoAcc: readonly number[] } = { trilho: TRILHO, trilhoAcc: TRILHO_ACC }): [number, number] {
  const tr = g.trilho;
  const acc = g.trilhoAcc;
  let i = 1;
  while (i < tr.length - 1 && acc[i] < d) i++;
  const l = acc[i] - acc[i - 1];
  const t = l > 0 ? Math.min(1, Math.max(0, (d - acc[i - 1]) / l)) : 0;
  return [tr[i - 1][0] + (tr[i][0] - tr[i - 1][0]) * t, tr[i - 1][1] + (tr[i][1] - tr[i - 1][1]) * t];
}

// =====================================================================================================================
// A MESA: paredes (segmentos), postes e rebatedores (círculos), as palhetas, a toca e os sensores
// =====================================================================================================================

export type TipoDeParede = 'parede' | 'estilingue' | 'alvo' | 'porta';

export interface Parede {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  tipo: TipoDeParede;
  /** O alvo que cai: qual dos três. */
  alvo?: number;
  /** A porta só bate de um lado: o da normal (nx, ny). */
  nx?: number;
  ny?: number;
}

export interface Circulo {
  x: number;
  y: number;
  r: number;
  tipo: 'poste' | 'repolho';
  /** O repolho: qual dos três (para o desenho piscar). */
  n?: number;
}

/** O meio da área de jogo (as palhetas e os estilingues são espelhados nele). */
export const MEIO = 113;
const m = (x: number) => 2 * MEIO - x;

/** O arco do alto: 24 trechos de 7,5°, do lado esquerdo (180°) ao direito (0°), pelo alto. */
export const ARCO_X = 120;
export const ARCO_Y = 118;
export const ARCO_R = 112;
const C75 = 0.9914448613738104;
const S75 = 0.13052619222005157;
export const PONTOS_DO_ARCO: [number, number][] = (() => {
  const l: [number, number][] = [];
  let ux = -ARCO_R;
  let uy = 0;
  for (let i = 0; i <= 24; i++) {
    l.push([ARCO_X + ux, ARCO_Y + uy]);
    const nx = ux * C75 - uy * S75;
    const ny = ux * S75 + uy * C75;
    ux = nx;
    uy = ny;
  }
  return l;
})();

/** A mola e a raia dela, à direita. */
export const RAIA_X = 225;
export const RAIA_ESQ = 218;
export const RAIA_DIR = 232;
export const MOLA_Y = 386;

/** As palhetas: o pivô, o comprimento, e a palheta é uma cápsula que afina do pivô (5,5) à ponta (3,5). */
export const PIVO_ESQ = { x: 74, y: 350 };
export const PIVO_DIR = { x: m(74), y: 350 };
export const PALHETA = 32;
const RAIO_PIVO = 5.5;
const RAIO_PONTA = 3.5;
/** Os estados da palheta: de 30° abaixo (0, em repouso) a 25° acima (POSICOES), de 2,5° em 2,5°. */
export const POSICOES = 22;
const C25 = 0.9990482215818578;
const S25 = 0.043619387365336;
/** A direção da palheta esquerda em cada estado (a direita é o espelho em x). */
export const DIRECOES: [number, number][] = (() => {
  const l: [number, number][] = [];
  let x = 0.8660254037844387;
  let y = 0.5;
  for (let i = 0; i <= POSICOES; i++) {
    l.push([x, y]);
    const nx = x * C25 + y * S25;
    const ny = -x * S25 + y * C25;
    x = nx;
    y = ny;
  }
  return l;
})();

/** A toca do coelho (a bola que passa devagar fica presa e sai depois), e os três repolhos. */
export const TOCA = { x: 52, y: 196 };
const RAIO_DA_TOCA = 6;
const TOCA_PRESA = 50;
export const REPOLHOS: Circulo[] = [
  { x: 86, y: 112, r: 12, tipo: 'repolho', n: 0 },
  { x: 140, y: 112, r: 12, tipo: 'repolho', n: 1 },
  { x: 113, y: 150, r: 12, tipo: 'repolho', n: 2 },
];
/** As três pistas do alto (os sensores no meio de cada uma) e os postes entre elas. */
export const PISTAS_X = [84, 113, 142];
export const PISTA_Y = 66;
export const POSTES_DAS_PISTAS = [70, 99, 127, 156];
/** As cenouras (os alvos que caem), em pé contra a parede da direita, viradas para a esquerda. */
export const ALVOS_X = 208;
export const ALVOS_Y: [number, number][] = [
  [174, 186],
  [190, 202],
  [206, 218],
];
/** A órbita: a raia da esquerda (entre a parede e a guia), e o sensor dela. */
export const GUIA_DA_ORBITA_X = 24;
const ORBITA_Y = 150;
export const DESVIO: [number, number][] = [
  [8, 200],
  [24, 224],
];

/** Os estilingues (triângulos sobre as palhetas): o lado que chuta é o de dentro. */
export const ESTILINGUE_ESQ: [number, number][] = [
  [40, 270],
  [40, 300],
  [64, 316],
];
export const ESTILINGUE_DIR: [number, number][] = ESTILINGUE_ESQ.map(([x, y]) => [m(x), y]);
/** As guias das raias de dentro (do lado de fora fica a raia de saída, que leva a bola embora). */
export const GUIA_ESQ: [number, number][] = [
  [24, 246],
  [24, 307],
  [77.2, 345.5],
];
export const GUIA_DIR: [number, number][] = GUIA_ESQ.map(([x, y]) => [m(x), y]);

const parede = (ax: number, ay: number, bx: number, by: number, tipo: TipoDeParede = 'parede'): Parede => ({ ax, ay, bx, by, tipo });

export const PAREDES: Parede[] = (() => {
  const l: Parede[] = [];
  for (let i = 0; i < PONTOS_DO_ARCO.length - 1; i++) l.push(parede(PONTOS_DO_ARCO[i][0], PONTOS_DO_ARCO[i][1], PONTOS_DO_ARCO[i + 1][0], PONTOS_DO_ARCO[i + 1][1]));
  const [ex, ey] = PONTOS_DO_ARCO[0];
  const [dx, dy] = PONTOS_DO_ARCO[PONTOS_DO_ARCO.length - 1];
  // as laterais: a esquerda até embaixo, e a de fora da raia da mola
  l.push(parede(ex, ey, ex, 420));
  l.push(parede(dx, dy, RAIA_DIR, 420));
  // a de dentro da raia da mola, e o fundo da raia
  l.push(parede(RAIA_ESQ, 420, RAIA_ESQ, 152));
  l.push(parede(RAIA_ESQ, MOLA_Y + RAIO, RAIA_DIR, MOLA_Y + RAIO));
  // a porta que deixa a bola sair da raia e não deixa voltar (bate só de cima)
  const porta = parede(RAIA_ESQ, 152, RAIA_DIR, 136, 'porta');
  const px = porta.ay - porta.by;
  const py = porta.bx - porta.ax;
  const pl = Math.sqrt(px * px + py * py);
  porta.nx = -px / pl;
  porta.ny = -py / pl;
  l.push(porta);
  // a guia da órbita, e os postes das pistas do alto
  l.push(parede(GUIA_DA_ORBITA_X, 100, GUIA_DA_ORBITA_X, 182));
  // embaixo da raia da órbita, o desvio: quem desce por ela volta para o meio da mesa, e não direto para a saída
  l.push(parede(DESVIO[0][0], DESVIO[0][1], DESVIO[1][0], DESVIO[1][1]));
  for (const x of POSTES_DAS_PISTAS) l.push(parede(x, 46, x, 70));
  // os estilingues: o lado de dentro chuta, os outros dois são parede
  for (const [t, dentro] of [
    [ESTILINGUE_ESQ, [0, 2]],
    [ESTILINGUE_DIR, [0, 2]],
  ] as const) {
    l.push(parede(t[dentro[0]][0], t[dentro[0]][1], t[dentro[1]][0], t[dentro[1]][1], 'estilingue'));
    l.push(parede(t[0][0], t[0][1], t[1][0], t[1][1]));
    l.push(parede(t[1][0], t[1][1], t[2][0], t[2][1]));
  }
  // as guias das raias de dentro
  for (const g of [GUIA_ESQ, GUIA_DIR]) for (let i = 0; i < g.length - 1; i++) l.push(parede(g[i][0], g[i][1], g[i + 1][0], g[i + 1][1]));
  // as cenouras
  // o encaixe das cenouras na parede: as rampinhas de cima e de baixo (sem fresta onde a bola fique presa)
  l.push(parede(RAIA_ESQ, ALVOS_Y[0][0] - 12, ALVOS_X, ALVOS_Y[0][0]));
  l.push(parede(ALVOS_X, ALVOS_Y[2][1], RAIA_ESQ, ALVOS_Y[2][1] + 12));
  ALVOS_Y.forEach(([a, b], i) => l.push({ ...parede(ALVOS_X, a, ALVOS_X, b, 'alvo'), alvo: i }));
  return l;
})();

export const CIRCULOS: Circulo[] = [
  ...REPOLHOS,
  // os postes: o fim da guia da órbita, as pontas das guias de dentro, e os de cima e de baixo das cenouras
  { x: GUIA_DA_ORBITA_X, y: 182, r: 3, tipo: 'poste' },
  { x: GUIA_ESQ[0][0], y: GUIA_ESQ[0][1], r: 3, tipo: 'poste' },
  { x: GUIA_DIR[0][0], y: GUIA_DIR[0][1], r: 3, tipo: 'poste' },
];

/**
 * AS MESAS (19/11/2026): a HORTA (0, a de sempre) e o POMAR (1), com as mesmas paredes, palhetas e cenouras, e o miolo trocado:
 * os três rebatedores em triângulo de ponta para cima, a toca do lado direito e a rampa do lado esquerdo (espelhada, caindo na
 * terceira pista). Cada mesa tem o recorde dela.
 */
export interface Geometria {
  repolhos: Circulo[];
  circulos: Circulo[];
  toca: { x: number; y: number };
  /** Para que lado a toca devolve a bola (1: direita). */
  tocaLado: 1 | -1;
  boca: { x0: number; x1: number; y: number };
  trilho: [number, number][];
  trilhoAcc: number[];
}
const postes = CIRCULOS.filter((c) => c.tipo === 'poste');
const REPOLHOS_DO_POMAR: Circulo[] = [
  { x: 86, y: 150, r: 12, tipo: 'repolho', n: 0 },
  { x: 140, y: 150, r: 12, tipo: 'repolho', n: 1 },
  { x: 113, y: 112, r: 12, tipo: 'repolho', n: 2 },
];
const TRILHO_DO_POMAR: [number, number][] = TRILHO.map(([x, y]) => [m(x), y]);
export const MESAS: readonly Geometria[] = [
  { repolhos: REPOLHOS, circulos: CIRCULOS, toca: TOCA, tocaLado: 1, boca: BOCA_DA_RAMPA, trilho: TRILHO, trilhoAcc: TRILHO_ACC },
  {
    repolhos: REPOLHOS_DO_POMAR,
    circulos: [...REPOLHOS_DO_POMAR, ...postes],
    toca: { x: m(TOCA.x), y: TOCA.y },
    tocaLado: -1,
    boca: { x0: m(BOCA_DA_RAMPA.x1), x1: m(BOCA_DA_RAMPA.x0), y: BOCA_DA_RAMPA.y },
    trilho: TRILHO_DO_POMAR,
    trilhoAcc: acumulado(TRILHO_DO_POMAR),
  },
];
export const mesaValida = (n: unknown): number => (Number.isInteger(n) && (n as number) >= 0 && (n as number) < MESAS.length ? (n as number) : 0);

// =====================================================================================================================
// O ESTADO
// =====================================================================================================================

export interface Bola {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Parada na mola, esperando o lançamento. */
  naMola: boolean;
  /** Lançada sozinha (a bola salva e as do multibola). */
  auto: boolean;
  /** Presa na toca: os passos que faltam para sair. */
  presa: number;
  /** Subiu pela raia da órbita há pouco: chegando ao alto da direita, é volta completa. */
  orbita: number;
  /** Há quantos passos está quase parada fora das palhetas (a busca da bola: parada demais, a mesa a empurra). */
  parada: number;
  /** No trilho da rampa: quanto já andou nele + 1 (0: fora dele). */
  trilho: number;
}

export type Evento =
  | { tipo: 'repolho'; n: number; x: number; y: number; pontos: number }
  | { tipo: 'estilingue'; x: number; y: number; pontos: number }
  | { tipo: 'cenoura'; n: number; x: number; y: number; pontos: number }
  | { tipo: 'colheita'; x: number; y: number; pontos: number }
  | { tipo: 'pista'; n: number; x: number; y: number; pontos: number }
  | { tipo: 'multiplicador'; mult: number }
  | { tipo: 'toca'; x: number; y: number; pontos: number }
  | { tipo: 'multibola'; x: number; y: number; pontos: number }
  | { tipo: 'orbita'; x: number; y: number; pontos: number; jackpot: boolean }
  | { tipo: 'palheta' }
  | { tipo: 'mola'; forca: number }
  | { tipo: 'salva' }
  | { tipo: 'aviso' }
  | { tipo: 'tilt' }
  | { tipo: 'perdeu'; bonus: number }
  | { tipo: 'tacada'; x: number; y: number; pontos: number }
  | { tipo: 'extra' }
  | { tipo: 'rampa'; x: number; y: number; pontos: number }
  | { tipo: 'missao'; missao: IdDaMissao; cumpriu: boolean; pontos: number; x: number; y: number }
  | { tipo: 'fim' };

export interface Mesa {
  /** Qual mesa (o índice em MESAS). */
  mesa: number;
  passo: number;
  /** O teto de passos desta partida (na sala, o tempo da rodada). */
  limite: number;
  pontos: number;
  /** A bola da vez (1 a BOLAS). */
  bola: number;
  bolas: Bola[];
  /** O estado de cada palheta (0 em repouso, POSICOES em cima), e o do subpasso anterior (a velocidade da palheta). */
  esq: number;
  dir: number;
  /** O comando do passo anterior (para os toques: a palheta que acaba de subir, a mola solta, o tranco). */
  antes: number;
  carga: number;
  ocioso: number;
  tremor: number;
  tilt: boolean;
  /** As cenouras em pé, e os passos até elas voltarem depois da colheita. */
  alvos: boolean[];
  alvosVoltam: number;
  /** As pistas do alto acesas, o multiplicador do bônus e o bônus acumulado da bola. */
  pistas: boolean[];
  mult: number;
  reserva: number;
  tocaAcesa: boolean;
  multibola: boolean;
  /** A bola salva: os passos que faltam; e se a próxima saída da mola liga a proteção. */
  salva: number;
  salvaPronta: boolean;
  /** Bolas esperando para sair sozinhas pela mola. */
  fila: number;
  terminou: boolean;
  /** O que aconteceu neste passo (o som e o desenho; o servidor ignora). */
  eventos: Evento[];
  /** Para o desenho: o último passo em que cada repolho e cada estilingue foi acertado. */
  acesoEm: number[];
  /** A tacada certeira: os passos que ainda valem (0: não vale mais). */
  tacada: number;
  /** Os marcos de bola extra já alcançados, e as bolas extras guardadas. */
  marcos: number;
  extras: number;
  /** A missão da vez (o índice em MISSOES, que gira), quanto já contou, os passos que faltam e a patente. */
  missao: number;
  missaoConta: number;
  missaoResta: number;
  patente: number;
  /** Missões cumpridas na partida. */
  cumpridas: number;
}

const bolaNaMola = (auto: boolean): Bola => ({ x: RAIA_X, y: MOLA_Y, vx: 0, vy: 0, naMola: true, auto, presa: 0, orbita: 0, parada: 0, trilho: 0 });

export function novaMesa(limite = PASSOS_MAXIMOS, mesa = 0): Mesa {
  return {
    mesa: mesaValida(mesa),
    passo: 0,
    limite: Math.max(1, Math.min(PASSOS_MAXIMOS, limite)),
    pontos: 0,
    bola: 1,
    bolas: [bolaNaMola(false)],
    esq: 0,
    dir: 0,
    antes: 0,
    carga: 0,
    ocioso: 0,
    tremor: 0,
    tilt: false,
    alvos: [true, true, true],
    alvosVoltam: 0,
    pistas: [false, false, false],
    mult: 1,
    reserva: 0,
    tocaAcesa: false,
    multibola: false,
    salva: 0,
    salvaPronta: true,
    fila: 0,
    terminou: false,
    eventos: [],
    acesoEm: [-99, -99, -99, -99, -99],
    tacada: 0,
    marcos: 0,
    extras: 0,
    missao: 0,
    missaoConta: 0,
    missaoResta: MISSOES[0].passos,
    patente: 1,
    cumpridas: 0,
  };
}

/** Conta os eventos do passo na missão da vez (só o que pontuou: a mesa travada não conta). */
function contarMissao(k: Mesa) {
  const m = MISSOES[k.missao];
  let n = 0;
  for (const e of k.eventos) {
    if (e.tipo === m.evento || (m.id === 'toca' && e.tipo === 'multibola')) {
      if ('pontos' in e && e.pontos <= 0) continue;
      n++;
    }
  }
  if (n === 0 || k.tilt) return;
  k.missaoConta += n;
  if (k.missaoConta >= m.meta) {
    const pontos = marcar(k, PONTOS_DA_MISSAO * k.patente, 0);
    k.eventos.push({ tipo: 'missao', missao: m.id, cumpriu: true, pontos, x: MEIO, y: 230 });
    k.cumpridas++;
    if (k.patente < PATENTE_MAXIMA) k.patente++;
    proximaMissao(k);
  }
}

function proximaMissao(k: Mesa) {
  k.missao = (k.missao + 1) % MISSOES.length;
  k.missaoConta = 0;
  k.missaoResta = MISSOES[k.missao].passos;
}

/** A ponta da palheta (para o desenho e para a conta): `lado` −1 esquerda, 1 direita. */
export function pontaDaPalheta(lado: -1 | 1, estado: number): { x: number; y: number } {
  const [dx, dy] = DIRECOES[estado];
  const p = lado < 0 ? PIVO_ESQ : PIVO_DIR;
  return { x: p.x - lado * dx * PALHETA, y: p.y + dy * PALHETA };
}

// =====================================================================================================================
// A CONTA
// =====================================================================================================================

function marcar(k: Mesa, pontos: number, bonus: number) {
  if (k.tilt) return 0;
  k.tacada = 0;
  k.pontos += pontos;
  k.reserva += bonus;
  return pontos;
}

/** O choque com uma superfície: tira a bola de dentro e devolve a velocidade normal (negativa: vinha contra). */
function rebater(b: Bola, nx: number, ny: number, dentro: number, svx: number, svy: number, e: number): number {
  b.x += nx * dentro;
  b.y += ny * dentro;
  const rvx = b.vx - svx;
  const rvy = b.vy - svy;
  const vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    b.vx -= (1 + e) * vn * nx;
    b.vy -= (1 + e) * vn * ny;
  }
  return vn;
}

/** Chutar a bola pela normal: tira a parte que vinha contra e põe `forca` para fora. */
function chutar(b: Bola, nx: number, ny: number, forca: number) {
  const vn = b.vx * nx + b.vy * ny;
  b.vx += (forca - vn) * nx;
  b.vy += (forca - vn) * ny;
}

function colidirComParedes(k: Mesa, b: Bola) {
  for (const p of PAREDES) {
    if (p.tipo === 'alvo' && !k.alvos[p.alvo!]) continue;
    const ex = p.bx - p.ax;
    const ey = p.by - p.ay;
    const l2 = ex * ex + ey * ey;
    let t = ((b.x - p.ax) * ex + (b.y - p.ay) * ey) / l2;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const cx = p.ax + ex * t;
    const cy = p.ay + ey * t;
    const dx = b.x - cx;
    const dy = b.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= RAIO * RAIO || d2 === 0) continue;
    const d = Math.sqrt(d2);
    const nx = dx / d;
    const ny = dy / d;
    if (p.tipo === 'porta') {
      // só do lado de cima, e só vindo contra
      if ((b.x - p.ax) * p.nx! + (b.y - p.ay) * p.ny! < 0 || b.vx * p.nx! + b.vy * p.ny! >= 0) continue;
    }
    const vn = rebater(b, nx, ny, RAIO - d, 0, 0, 0.4);
    if (p.tipo === 'estilingue' && vn < -50 && !k.tilt) {
      chutar(b, nx, ny, 210);
      const lado = p.ax < MEIO ? 3 : 4;
      if (k.acesoEm[lado] < k.passo - 6) {
        k.acesoEm[lado] = k.passo;
        k.eventos.push({ tipo: 'estilingue', x: cx, y: cy, pontos: marcar(k, 10, 5) });
      }
    } else if (p.tipo === 'alvo' && vn < -20) {
      k.alvos[p.alvo!] = false;
      k.eventos.push({ tipo: 'cenoura', n: p.alvo!, x: cx, y: cy, pontos: marcar(k, 250, 100) });
      if (!k.alvos.some(Boolean) && !k.tilt) {
        k.tocaAcesa = true;
        k.alvosVoltam = 90;
        k.eventos.push({ tipo: 'colheita', x: cx, y: cy, pontos: marcar(k, 1000, 300) });
      } else if (!k.alvos.some(Boolean)) k.alvosVoltam = 90;
    }
  }
  for (const c of MESAS[k.mesa].circulos) {
    const dx = b.x - c.x;
    const dy = b.y - c.y;
    const d2 = dx * dx + dy * dy;
    const r = RAIO + c.r;
    if (d2 >= r * r || d2 === 0) continue;
    const d = Math.sqrt(d2);
    const nx = dx / d;
    const ny = dy / d;
    const vn = rebater(b, nx, ny, r - d, 0, 0, 0.4);
    if (c.tipo === 'repolho' && vn < 0 && !k.tilt) {
      chutar(b, nx, ny, 360);
      k.acesoEm[c.n!] = k.passo;
      k.eventos.push({ tipo: 'repolho', n: c.n!, x: c.x, y: c.y, pontos: marcar(k, 100, 10) });
    }
  }
}

/** A palheta: a cápsula do pivô à ponta, que empurra a bola com a velocidade do ponto onde encostou. */
function colidirComPalheta(b: Bola, lado: -1 | 1, agora: number, antes: number) {
  const p = lado < 0 ? PIVO_ESQ : PIVO_DIR;
  const [ax, ay] = DIRECOES[agora];
  const dx0 = ax * -lado;
  const ex = dx0 * PALHETA;
  const ey = ay * PALHETA;
  let t = ((b.x - p.x) * ex + (b.y - p.y) * ey) / (PALHETA * PALHETA);
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const cx = p.x + ex * t;
  const cy = p.y + ey * t;
  const dx = b.x - cx;
  const dy = b.y - cy;
  const d2 = dx * dx + dy * dy;
  const r = RAIO + RAIO_PIVO + (RAIO_PONTA - RAIO_PIVO) * t;
  if (d2 >= r * r || d2 === 0) return;
  const d = Math.sqrt(d2);
  // a velocidade do ponto da palheta onde a bola encostou: de onde ele estava no subpasso anterior até onde está
  const [bx, by] = DIRECOES[antes];
  const s = PALHETA * t;
  const svx = ((ax - bx) * -lado * s) / DT;
  const svy = ((ay - by) * s) / DT;
  rebater(b, dx / d, dy / d, r - d, svx, svy, 0.25);
}

function lancar(k: Mesa, b: Bola, carga: number) {
  b.naMola = false;
  if (!b.auto) k.tacada = TACADA_PASSOS;
  b.vy = -(MOLA_MIN + carga * MOLA_POR_PASSO);
  b.vx = 0;
  k.eventos.push({ tipo: 'mola', forca: carga / MOLA_MAX_CARGA });
  if (k.salvaPronta) {
    k.salvaPronta = false;
    k.salva = Math.max(k.salva, SALVA_PASSOS);
  }
}

function acenderPista(k: Mesa, n: number, b: Bola) {
  if (k.tilt) return;
  k.pistas[n] = true;
  k.eventos.push({ tipo: 'pista', n, x: PISTAS_X[n], y: PISTA_Y, pontos: marcar(k, 50, 50) });
  if (k.pistas.every(Boolean)) {
    k.pistas = [false, false, false];
    if (k.mult < 5) k.mult++;
    k.eventos.push({ tipo: 'multiplicador', mult: k.mult });
  }
  void b;
}

/** Um passo de 1/60 s com o comando dos bits (ESQ, DIR, MOLA, SACUDIR). */
export function passo(k: Mesa, comando: number) {
  k.eventos = [];
  if (k.terminou) return;
  k.passo++;
  const esq = (comando & ESQ) !== 0 && !k.tilt;
  const dir = (comando & DIR) !== 0 && !k.tilt;
  const mola = (comando & MOLA) !== 0;
  const sacode = (comando & SACUDIR) !== 0 && (k.antes & SACUDIR) === 0;
  // a palheta que acaba de subir troca as pistas acesas de lugar (o truque de sempre para fechar as três)
  if (esq && (k.antes & ESQ) === 0) {
    k.pistas = [k.pistas[1], k.pistas[2], k.pistas[0]];
    k.eventos.push({ tipo: 'palheta' });
  }
  if (dir && (k.antes & DIR) === 0) {
    k.pistas = [k.pistas[2], k.pistas[0], k.pistas[1]];
    k.eventos.push({ tipo: 'palheta' });
  }

  // A MOLA: a bola parada nela sai ao soltar (ou sozinha: a salva e as do multibola; ou depois de 10 s parada)
  const naMola = k.bolas.find((b) => b.naMola);
  if (naMola) {
    if (naMola.auto) lancar(k, naMola, MOLA_AUTOMATICA);
    else if (mola) {
      if (k.carga < MOLA_MAX_CARGA) k.carga++;
    } else if (k.carga > 0) {
      lancar(k, naMola, k.carga);
      k.carga = 0;
    } else if (++k.ocioso >= MOLA_OCIOSA) lancar(k, naMola, MOLA_AUTOMATICA);
    if (!naMola.naMola) k.ocioso = 0;
  } else {
    k.carga = 0;
    k.ocioso = 0;
  }
  // a fila do multibola e da bola salva: sai pela mola quando a raia está livre
  if (k.fila > 0 && !k.bolas.some((b) => b.x > RAIA_ESQ && b.y > 250)) {
    k.fila--;
    k.bolas.push(bolaNaMola(true));
  }

  // O TRANCO: empurra as bolas para o alto; tremor demais trava a mesa até a bola cair
  if (sacode && !k.tilt) {
    for (const b of k.bolas) if (!b.naMola && !b.presa) b.vy -= 45;
    k.tremor += TRANCO;
    if (k.tremor > TREMOR_TILT) {
      k.tilt = true;
      k.eventos.push({ tipo: 'tilt' });
    } else if (k.tremor > TREMOR_AVISO) k.eventos.push({ tipo: 'aviso' });
  }
  if (k.tremor > 0) k.tremor--;
  if (k.salva > 0) k.salva--;
  if (k.tacada > 0) k.tacada--;
  // o prazo da missão só anda com bola em jogo (fora da mola)
  if (k.bolas.some((b) => !b.naMola) && --k.missaoResta <= 0) {
    k.eventos.push({ tipo: 'missao', missao: MISSOES[k.missao].id, cumpriu: false, pontos: 0, x: MEIO, y: 230 });
    proximaMissao(k);
  }
  if (k.alvosVoltam > 0 && --k.alvosVoltam === 0) k.alvos = [true, true, true];

  for (const b of k.bolas) {
    if (b.trilho > 0) {
      // no trilho da rampa: anda por ele, e sai no fim, caindo na primeira pista
      b.trilho += TRILHO_POR_PASSO;
      const g = MESAS[k.mesa];
      const fim = g.trilhoAcc[g.trilhoAcc.length - 1];
      const [x, y] = pontoDoTrilho(b.trilho - 1, g);
      b.x = x;
      b.y = y;
      if (b.trilho - 1 >= fim) {
        // sai com a sobra do lado de quem entrou (guardada em vx): a rampa não devolve a bola sempre igual
        b.trilho = 0;
        b.vx = b.vx < -120 ? -120 : b.vx > 120 ? 120 : b.vx;
        b.vy = 80;
      }
      continue;
    }
    if (b.orbita > 0) b.orbita--;
    // A BUSCA DA BOLA: presa num canto (entre um poste e a parede, em cima de um poste), parada 5 s com as palhetas em repouso,
    // a mesa a empurra sozinha, como as máquinas de verdade fazem
    if (!b.naMola && !b.presa && b.vx * b.vx + b.vy * b.vy < 100 && k.esq === 0 && k.dir === 0) {
      if (++b.parada >= BUSCA) {
        b.parada = 0;
        b.vy -= 160;
        b.vx += b.x < MEIO ? 90 : -90;
      }
    } else b.parada = 0;
    if (b.presa > 0 && --b.presa === 0) {
      // a toca devolve a bola para as palhetas
      const g = MESAS[k.mesa];
      b.vx = 110 * g.tocaLado;
      b.vy = 60;
      b.x = g.toca.x + 8 * g.tocaLado;
    }
  }

  for (let s = 0; s < SUB; s++) {
    const esqAntes = k.esq;
    const dirAntes = k.dir;
    k.esq = esq ? Math.min(POSICOES, k.esq + 1) : Math.max(0, k.esq - 1);
    k.dir = dir ? Math.min(POSICOES, k.dir + 1) : Math.max(0, k.dir - 1);
    for (const b of k.bolas) {
      if (b.naMola || b.presa > 0 || b.trilho > 0) continue;
      const px = b.x;
      const py = b.y;
      b.vy += G * DT;
      const v2 = b.vx * b.vx + b.vy * b.vy;
      if (v2 > VMAX * VMAX) {
        const f = VMAX / Math.sqrt(v2);
        b.vx *= f;
        b.vy *= f;
      }
      b.x += b.vx * DT;
      b.y += b.vy * DT;
      colidirComParedes(k, b);
      colidirComPalheta(b, -1, k.esq, esqAntes);
      colidirComPalheta(b, 1, k.dir, dirAntes);
      // os sensores: as pistas do alto (descendo), a raia da órbita (subindo) e o alto da direita
      if (py < PISTA_Y && b.y >= PISTA_Y) {
        // a tacada certeira: direto da mola para uma pista, sem tocar em mais nada
        if (k.tacada > 0 && !k.tilt && b.x > PISTAS_X[0] - 12 && b.x < PISTAS_X[2] + 12) {
          k.tacada = 0;
          k.pontos += PONTOS_DA_TACADA;
          k.eventos.push({ tipo: 'tacada', x: b.x, y: PISTA_Y, pontos: PONTOS_DA_TACADA });
        }
        for (let n = 0; n < 3; n++) if (b.x > PISTAS_X[n] - 12 && b.x < PISTAS_X[n] + 12 && !k.pistas[n]) acenderPista(k, n, b);
      }
      // a rampa: a bola rápida que sobe pela boca vai para o trilho
      const g = MESAS[k.mesa];
      if (py > g.boca.y && b.y <= g.boca.y && b.x > g.boca.x0 && b.x < g.boca.x1 && b.vy < -VELOCIDADE_DA_BOCA && !k.tilt) {
        b.trilho = 1;
        b.x = g.trilho[0][0];
        b.y = g.trilho[0][1];
        // vx guarda o lado da entrada (metade), para a saída
        b.vx = b.vx * 0.5;
        b.vy = 0;
        k.eventos.push({ tipo: 'rampa', x: g.trilho[0][0], y: g.trilho[0][1], pontos: marcar(k, PONTOS_DA_RAMPA, 150) });
        continue;
      }
      if (py > ORBITA_Y && b.y <= ORBITA_Y && b.x < GUIA_DA_ORBITA_X) b.orbita = 120;
      if (b.orbita > 0 && b.x > 196 && b.y < 110) {
        b.orbita = 0;
        const jackpot = k.multibola;
        k.eventos.push({ tipo: 'orbita', x: b.x, y: b.y, pontos: marcar(k, jackpot ? 5000 : 1000, 200), jackpot });
      }
      // a toca: a bola que passa devagar por cima cai nela
      const toca = g.toca;
      const tx = b.x - toca.x;
      const ty = b.y - toca.y;
      if (tx * tx + ty * ty < RAIO_DA_TOCA * RAIO_DA_TOCA && b.vx * b.vx + b.vy * b.vy < 300 * 300) {
        b.presa = TOCA_PRESA;
        b.x = toca.x;
        b.y = toca.y;
        b.vx = 0;
        b.vy = 0;
        if (k.tocaAcesa && !k.tilt) {
          k.tocaAcesa = false;
          if (!k.multibola) {
            k.multibola = true;
            k.fila++;
            k.salva = Math.max(k.salva, SALVA_MULTIBOLA);
          }
          k.eventos.push({ tipo: 'multibola', x: toca.x, y: toca.y, pontos: marcar(k, 2500, 500) });
        } else k.eventos.push({ tipo: 'toca', x: toca.x, y: toca.y, pontos: marcar(k, 500, 100) });
      }
      // a bola que volta à raia da mola, fraca, para nela de novo
      if (b.x > RAIA_ESQ && b.y >= MOLA_Y - 0.5 && b.vy > -50) {
        b.y = MOLA_Y;
        b.vx = 0;
        b.vy = 0;
        b.x = RAIA_X;
        b.naMola = true;
        // a bola que nem saiu da raia não gastou a proteção
        if (k.bolas.length === 1) {
          k.salvaPronta = true;
          k.salva = 0;
        }
      }
    }
    // as bolas entre si (o multibola): o choque de duas iguais
    for (let i = 0; i < k.bolas.length; i++) {
      for (let j = i + 1; j < k.bolas.length; j++) {
        const a = k.bolas[i];
        const c = k.bolas[j];
        if (a.naMola || c.naMola || a.presa || c.presa || a.trilho || c.trilho) continue;
        const dx = c.x - a.x;
        const dy = c.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= 4 * RAIO * RAIO || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const ny = dy / d;
        const metade = (2 * RAIO - d) / 2;
        a.x -= nx * metade;
        a.y -= ny * metade;
        c.x += nx * metade;
        c.y += ny * metade;
        const vn = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
        if (vn < 0) {
          a.vx += vn * nx;
          a.vy += vn * ny;
          c.vx -= vn * nx;
          c.vy -= vn * ny;
        }
      }
    }
  }

  // A BOLA QUE CAI: salva (volta pela mola), uma a menos no multibola, ou a bola da vez acaba (com o bônus)
  const caiu = k.bolas.filter((b) => b.y > 410);
  if (caiu.length) {
    k.bolas = k.bolas.filter((b) => b.y <= 410);
    for (let i = 0; i < caiu.length; i++) {
      if (k.salva > 0 && !k.tilt) {
        k.fila++;
        k.eventos.push({ tipo: 'salva' });
      }
    }
    if (k.multibola && k.bolas.length + k.fila <= 1) k.multibola = false;
    if (k.bolas.length === 0 && k.fila === 0) {
      const bonus = k.tilt ? 0 : k.reserva * k.mult;
      k.pontos += bonus;
      k.eventos.push({ tipo: 'perdeu', bonus });
      k.reserva = 0;
      k.mult = 1;
      k.tilt = false;
      k.tremor = 0;
      k.multibola = false;
      if (k.extras > 0) {
        // a bola extra: a mesma bola de novo
        k.extras--;
        k.bola--;
      }
      k.bola++;
      if (k.bola > BOLAS) {
        k.bola = BOLAS;
        k.terminou = true;
        k.eventos.push({ tipo: 'fim' });
      } else {
        k.bolas.push(bolaNaMola(false));
        k.salvaPronta = true;
      }
    }
  }
  // A MISSÃO conta o que aconteceu no passo; e o marco de pontos dá a bola extra
  if (!k.terminou) contarMissao(k);
  while (k.marcos < MARCOS_DA_BOLA_EXTRA.length && k.pontos >= MARCOS_DA_BOLA_EXTRA[k.marcos]) {
    k.marcos++;
    k.extras++;
    k.eventos.push({ tipo: 'extra' });
  }
  if (!k.terminou && k.passo >= k.limite) {
    k.terminou = true;
    k.eventos.push({ tipo: 'fim' });
  }
  k.antes = comando;
}

// =====================================================================================================================
// AS ENTRADAS: os comandos de cada passo, em pares [quantos passos, comando]
// =====================================================================================================================

export type Entradas = number[];

export function entradasValidas(e: unknown, maximo = PASSOS_POR_TRECHO): e is Entradas {
  if (!Array.isArray(e) || e.length === 0 || e.length % 2 !== 0 || e.length > 2 * maximo) return false;
  let total = 0;
  for (let i = 0; i < e.length; i += 2) {
    const n: unknown = e[i];
    const b: unknown = e[i + 1];
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || typeof b !== 'number' || !Number.isInteger(b) || b < 0 || b > COMANDO_MAXIMO) return false;
    total += n;
    if (total > maximo) return false;
  }
  return true;
}

/** Os comandos de passo a passo em pares [quantos, comando]. */
export function compactar(comandos: ArrayLike<number>, de = 0, ate = comandos.length): Entradas {
  const e: Entradas = [];
  for (let i = de; i < ate; i++) {
    const b = comandos[i];
    const n = e.length;
    if (n && e[n - 1] === b) e[n - 2]++;
    else e.push(1, b);
  }
  return e;
}

/**
 * Anda a mesa pelas entradas: pula as `pular` primeiras (já aplicadas) e para no `teto` de passos (o relógio do servidor) ou
 * no fim da partida. Devolve quantos passos andou.
 */
export function aplicar(k: Mesa, e: Entradas, pular = 0, teto = Infinity): number {
  let andou = 0;
  let i = 0;
  for (let p = 0; p < e.length; p += 2) {
    for (let j = 0; j < e[p]; j++, i++) {
      if (i < pular) continue;
      if (k.terminou || k.passo >= teto) return andou;
      passo(k, e[p + 1]);
      andou++;
    }
  }
  return andou;
}

// =====================================================================================================================
// O PILOTO AUTOMÁTICO (os testes e o e2e; fraco de propósito, mas mantém a bola viva um bom tempo)
// =====================================================================================================================

export function pilotoAutomatico(k: Mesa): number {
  let c = 0;
  const naMola = k.bolas.find((b) => b.naMola && !b.auto);
  if (naMola) {
    // a força varia com o passo (sem sorteio): ora fraca, ora forte
    const alvo = 30 + ((k.passo * 7) % 21);
    if (k.carga < alvo) c |= MOLA;
  }
  for (const b of k.bolas) {
    if (b.naMola || b.presa) continue;
    for (const lado of [-1, 1] as const) {
      const p = lado < 0 ? PIVO_ESQ : PIVO_DIR;
      const rel = (b.x - p.x) * -lado;
      if (rel < -6 || rel > PALHETA + 6) continue;
      // a altura da palheta em repouso naquele ponto
      const yp = p.y + rel * 0.577;
      // onde a bola estará daqui a 3 passos (a bola rápida pede o toque antes)
      const yf = b.y + b.vy * 0.05;
      const perto = (b.y > yp - 26 || yf > yp - 18) && b.y < yp + 6;
      const devagar = b.vx * b.vx + b.vy * b.vy < 30 * 30;
      const estado = lado < 0 ? k.esq : k.dir;
      if (perto && b.vy > -60 && !(devagar && estado === POSICOES)) c |= lado < 0 ? ESQ : DIR;
    }
  }
  return c;
}
