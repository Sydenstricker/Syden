/**
 * A MASMORRA DA TOCA: O MAPA, O ANDAR E O PILOTO (16/11/2026). DUAS CÓPIAS IGUAIS BYTE A BYTE: server/src/masmorra-regras.ts ↔
 * web/src/masmorra/regras.ts (web/test/masmorra.test.ts confere). O servidor confere a posição e move os bichos pelas mesmas
 * casas que o site desenha e por onde o coelho anda. Sem import nenhum, para as duas cópias poderem ser a mesma.
 *
 * Só a MECÂNICA dos jogos de masmorra vistos de cima (salas trancadas, chave, baú, bloco que se empurra, botões no chão): o
 * mapa, as salas, os bichos e os itens são daqui. A masmorra é uma fileira de salas de 17 × 11 casas (a borda é parede); a
 * turma está sempre na MESMA sala, e quem passa por uma porta aberta leva todo mundo para a próxima.
 */

export const TILE = 40;
export const COLS = 17;
export const LINHAS = 11;
export const LARGURA = TILE * COLS;
export const ALTURA = TILE * LINHAS;

export type Lado = 'n' | 's' | 'o' | 'l';
export const LADOS: Lado[] = ['n', 's', 'o', 'l'];
export const OPOSTO: Record<Lado, Lado> = { n: 's', s: 'n', o: 'l', l: 'o' };
/** A casa de cada porta, na parede. */
export const PORTA: Record<Lado, [number, number]> = { n: [8, 0], s: [8, 10], o: [0, 5], l: [16, 5] };
/** Onde aparece quem entra pela porta de cada lado (o meio, um pouco para dentro). */
export const CHEGADA: Record<Lado, [number, number]> = {
  n: [8.5 * TILE, 1.6 * TILE],
  s: [8.5 * TILE, 9.4 * TILE],
  o: [1.6 * TILE, 5.5 * TILE],
  l: [15.4 * TILE, 5.5 * TILE],
};
/** Os coelhos que chegam juntos ficam um pouco ao lado um do outro (dentro da casa da porta e das vizinhas). */
export const AO_LADO = [-12, 12, -28, 28];

/** As direções: 0 baixo, 1 cima, 2 esquerda, 3 direita. */
export const DIRS: [number, number][] = [
  [0, 1],
  [0, -1],
  [-1, 0],
  [1, 0],
];
export const LADO_DA_DIR: Lado[] = ['s', 'n', 'o', 'l'];

// ---------------- OS BICHOS (as folhas da Briga: os monstros da Quaternius, CC0) ----------------
export const TIPOS = ['cogumelo', 'cacto', 'sapo', 'rei-cogumelo'] as const;
export type TipoDoBicho = (typeof TIPOS)[number];
/**
 * Cada bicho é um COMPORTAMENTO: o cogumelo anda até quem está perto e morde (a preparação treme), o cacto mira e atira
 * reto, o sapo agacha mirando onde a pessoa está e cai em cima, e o rei-cogumelo é o chefe.
 */
export const BICHOS: Record<TipoDoBicho, { hp: number; raio: number; vel: number; pontos: number }> = {
  cogumelo: { hp: 3, raio: 14, vel: 55, pontos: 20 },
  cacto: { hp: 3, raio: 14, vel: 0, pontos: 25 },
  sapo: { hp: 2, raio: 13, vel: 0, pontos: 25 },
  'rei-cogumelo': { hp: 20, raio: 30, vel: 45, pontos: 200 },
};
/** Os estados dos bichos, na ordem do código que vai no quadro. */
export const ESTADOS = [
  'entrando', 'parado', 'andando', 'preparando', 'atacando', 'recuperando', 'dor', 'atordoado', 'morto', 'mirando', 'saltando',
  'prep-investida', 'investida', 'cansado', 'prep-sopro', 'sopro',
] as const;
export type EstadoDoBicho = (typeof ESTADOS)[number];
/** As ações do coelho (o que a pessoa diz que ele está fazendo, para os outros o desenharem). */
export const ACOES = ['parado', 'andando', 'pa', 'cenoura', 'arrancada', 'dor'] as const;
export type Acao = (typeof ACOES)[number];

// ---------------- AS SALAS ----------------
export interface Sala {
  id: number;
  /** Onde ela fica no mapa do canto (coluna, linha). */
  mapa: [number, number];
  /** '#' parede, 'T' tocha, '.' chão, '~' água, '=' ponte (água até o cristal), 'P' botão no chão, 'B' bloco, 'C' baú, 'K' cristal. */
  grade: string[];
  portas: Partial<Record<Lado, { para: number; trava?: 'placas' | 'chave' }>>;
  bichos: { tipo: TipoDoBicho; c: number; l: number }[];
  /** O baú: o que ele guarda, e se só aparece com a sala limpa. */
  bau?: { guarda: 'cenoura' | 'chave'; aparece?: 'limpa' };
}

export const SALAS: Sala[] = [
  {
    // a entrada: calma, com as tochas
    id: 0,
    mapa: [2, 6],
    grade: [
      '#################',
      '#T.............T#',
      '#...............#',
      '#...##.....##...#',
      '#...##.....##...#',
      '#...............#',
      '#...............#',
      '#...............#',
      '#...............#',
      '#T.............T#',
      '#################',
    ],
    portas: { n: { para: 1 } },
    bichos: [],
  },
  {
    // o salão dos cogumelos: as portas fecham até a sala ficar limpa
    id: 1,
    mapa: [2, 5],
    grade: [
      '#################',
      '#...............#',
      '#..##.......##..#',
      '#..##.......##..#',
      '#...............#',
      '#...............#',
      '#...............#',
      '#..##.......##..#',
      '#..##.......##..#',
      '#...............#',
      '#################',
    ],
    portas: { n: { para: 2 }, s: { para: 0 } },
    bichos: [
      { tipo: 'cogumelo', c: 4, l: 5 },
      { tipo: 'cogumelo', c: 12, l: 5 },
      { tipo: 'cogumelo', c: 8, l: 3 },
      { tipo: 'sapo', c: 8, l: 7 },
    ],
  },
  {
    // a encruzilhada: os DOIS botões apertados ao mesmo tempo abrem o norte (sozinho, o bloco segura um)
    id: 2,
    mapa: [2, 4],
    grade: [
      '#################',
      '#T.............T#',
      '#...............#',
      '#....P.....P....#',
      '#...............#',
      '#...............#',
      '#.......B.......#',
      '#...............#',
      '#...............#',
      '#T.............T#',
      '#################',
    ],
    portas: { n: { para: 4, trava: 'placas' }, s: { para: 1 }, o: { para: 3 } },
    bichos: [],
  },
  {
    // a sala do baú: limpa, aparece o baú com a cenoura que vai e volta
    id: 3,
    mapa: [1, 4],
    grade: [
      '#################',
      '#...............#',
      '#...............#',
      '#.....#...#.....#',
      '#...............#',
      '#..C............#',
      '#...............#',
      '#.....#...#.....#',
      '#...............#',
      '#...............#',
      '#################',
    ],
    portas: { l: { para: 2 } },
    bichos: [
      { tipo: 'cacto', c: 3, l: 2 },
      { tipo: 'cacto', c: 3, l: 8 },
      { tipo: 'cogumelo', c: 11, l: 4 },
      { tipo: 'cogumelo', c: 11, l: 6 },
    ],
    bau: { guarda: 'cenoura', aparece: 'limpa' },
  },
  {
    // o lago: o cristal do outro lado só a cenoura alcança, e acertado ele levanta a ponte; a chave está no baú de lá
    id: 4,
    mapa: [2, 3],
    grade: [
      '#################',
      '#...............#',
      '#..C.........K..#',
      '#...............#',
      '#~~~~~~===~~~~~~#',
      '#~~~~~~===~~~~~~#',
      '#...............#',
      '#...............#',
      '#...............#',
      '#...............#',
      '#################',
    ],
    portas: { n: { para: 5 }, s: { para: 2 } },
    bichos: [
      { tipo: 'sapo', c: 4, l: 7 },
      { tipo: 'sapo', c: 12, l: 7 },
    ],
    bau: { guarda: 'chave' },
  },
  {
    // o corredor: a porta do chefe é trancada
    id: 5,
    mapa: [2, 2],
    grade: [
      '#################',
      '#.....#...#.....#',
      '#.....#...#.....#',
      '#...............#',
      '#..#.........#..#',
      '#...............#',
      '#..#.........#..#',
      '#...............#',
      '#.....#...#.....#',
      '#.....#...#.....#',
      '#################',
    ],
    portas: { n: { para: 6, trava: 'chave' }, s: { para: 4 } },
    bichos: [
      { tipo: 'cacto', c: 2, l: 2 },
      { tipo: 'cacto', c: 14, l: 2 },
      { tipo: 'cogumelo', c: 8, l: 5 },
      { tipo: 'sapo', c: 8, l: 3 },
    ],
  },
  {
    // o rei-cogumelo
    id: 6,
    mapa: [2, 1],
    grade: [
      '#################',
      '#...............#',
      '#.##.........##.#',
      '#.##.........##.#',
      '#...............#',
      '#...............#',
      '#...............#',
      '#.##.........##.#',
      '#.##.........##.#',
      '#...............#',
      '#################',
    ],
    portas: { s: { para: 5 } },
    bichos: [{ tipo: 'rei-cogumelo', c: 8, l: 3 }],
  },
];
export const SALA_DO_CHEFE = 6;

/** As casas de uma letra na grade de uma sala. */
export function casasDe(s: Sala, letra: string): [number, number][] {
  const r: [number, number][] = [];
  s.grade.forEach((linha, l) => [...linha].forEach((ch, c) => ch === letra && r.push([c, l])));
  return r;
}
export const centro = (c: number, l: number): [number, number] => [(c + 0.5) * TILE, (l + 0.5) * TILE];

// ---------------- O COELHO ----------------
export const VEL = 150;
export const RAIO = 12;
export const CORACOES = 5;
export const ARRANCADA_MS = 180;
export const ARRANCADA_VEL = 360;
export const ARRANCADA_RECARGA_MS = 700;
/** A pá de jardim: quanto dura, quando pega, o meio do golpe à frente e o raio dele. */
export const PA = { dura: 320, de: 60, ate: 200, frente: 24, raio: 26 };
/** A cenoura que vai e volta: velocidade, até onde vai, o raio e a recarga. */
export const CENOURA = { vel: 380, alcance: 220, raio: 10, recarga: 600, dura: 1500 };
/** Quanto tempo apertando contra o bloco até ele andar uma casa. */
export const EMPURRAO_MS = 250;
/** O quanto a quina escorrega (para entrar na porta sem acertar o meio dela). */
const QUINA = 14;

// ---------------- O QUE É PAREDE ----------------
/** O que muda na sala: os blocos, o baú (está na sala?), a ponte e as portas abertas. */
export interface Mundo {
  blocos: [number, number][];
  bau: boolean;
  ponte: boolean;
  abertas: Lado[];
}
export type Quem = 'coelho' | 'bicho' | 'tiro';

export function solida(s: Sala, m: Mundo, c: number, l: number, quem: Quem): boolean {
  if (c < 0 || l < 0 || c >= COLS || l >= LINHAS) return true;
  for (const lado of LADOS) {
    const [pc, pl] = PORTA[lado];
    // a porta: só o coelho passa, e só aberta
    if (pc === c && pl === l) return !(quem === 'coelho' && s.portas[lado] !== undefined && m.abertas.includes(lado));
  }
  const ch = s.grade[l][c];
  if (ch === '#' || ch === 'T' || ch === 'K') return true;
  if (ch === '~') return quem !== 'tiro';
  if (ch === '=') return !m.ponte && quem !== 'tiro';
  if (ch === 'C' && m.bau) return true;
  return m.blocos.some(([bc, bl]) => bc === c && bl === l);
}

/** A caixa de (x, y), de lado 2r, não encosta em nada sólido. */
export function livre(s: Sala, m: Mundo, x: number, y: number, r: number, quem: Quem): boolean {
  const c0 = Math.floor((x - r) / TILE);
  const c1 = Math.floor((x + r) / TILE);
  const l0 = Math.floor((y - r) / TILE);
  const l1 = Math.floor((y + r) / TILE);
  for (let l = l0; l <= l1; l++) for (let c = c0; c <= c1; c++) if (solida(s, m, c, l, quem)) return false;
  return true;
}

/** Anda (dx, dy) um eixo de cada vez; parado por uma parede, a quina escorrega para o lado livre (até QUINA px). */
export function mover(s: Sala, m: Mundo, x: number, y: number, dx: number, dy: number, r: number, quem: Quem): [number, number] {
  let nx = x;
  let ny = y;
  if (dx !== 0) {
    if (livre(s, m, nx + dx, ny, r, quem)) nx += dx;
    else if (dy === 0 && quem === 'coelho') [nx, ny] = quina(s, m, nx, ny, dx, 0, r);
  }
  if (dy !== 0) {
    if (livre(s, m, nx, ny + dy, r, quem)) ny += dy;
    else if (dx === 0 && quem === 'coelho') [nx, ny] = quina(s, m, nx, ny, 0, dy, r);
  }
  return [nx, ny];
}

function quina(s: Sala, m: Mundo, x: number, y: number, dx: number, dy: number, r: number): [number, number] {
  const passo = Math.abs(dx) + Math.abs(dy);
  for (let k = 1; k <= QUINA; k++) {
    for (const sinal of [1, -1]) {
      const ox = dy !== 0 ? k * sinal : 0;
      const oy = dx !== 0 ? k * sinal : 0;
      if (!livre(s, m, x + ox + dx, y + oy + dy, r, 'coelho')) continue;
      const nx = x + Math.sign(ox) * Math.min(passo, k);
      const ny = y + Math.sign(oy) * Math.min(passo, k);
      if (livre(s, m, nx, ny, r, 'coelho')) return [nx, ny];
    }
  }
  return [x, y];
}

/** A porta em que (x, y) está, ou null. */
export function portaEm(s: Sala, x: number, y: number): Lado | null {
  const c = Math.floor(x / TILE);
  const l = Math.floor(y / TILE);
  for (const lado of LADOS) if (s.portas[lado] && PORTA[lado][0] === c && PORTA[lado][1] === l) return lado;
  return null;
}

// ---------------- O PASSO DO COELHO (no site, e no piloto do teste) ----------------
export interface Comandos {
  cima: boolean;
  baixo: boolean;
  esquerda: boolean;
  direita: boolean;
  /** Os de um toque: o site os apaga depois de usar. */
  golpe: boolean;
  item: boolean;
  arrancada: boolean;
}
export const comandosVazios = (): Comandos => ({ cima: false, baixo: false, esquerda: false, direita: false, golpe: false, item: false, arrancada: false });

export interface Coelho {
  x: number;
  y: number;
  dir: number;
  /** Para onde o desenho olha (o coelho é desenhado de lado): 1 direita, -1 esquerda. */
  lado: 1 | -1;
  acao: Acao;
  /** Há quanto tempo (ms) na ação. */
  t: number;
  relogio: number;
  ultimaArrancada: number;
  ultimaCenoura: number;
  /** O número do último golpe (cresce a cada um; o servidor confere). */
  ataque: number;
  /** O empurrão da pancada levada (px/s). */
  vx: number;
  vy: number;
  empurrando: number;
  /** Até quando pisca (relogio). */
  piscandoAte: number;
}

export const novoCoelho = (x: number, y: number): Coelho => ({
  x,
  y,
  dir: 1,
  lado: 1,
  acao: 'parado',
  t: 0,
  relogio: 0,
  ultimaArrancada: -1e9,
  ultimaCenoura: -1e9,
  ataque: 0,
  vx: 0,
  vy: 0,
  empurrando: 0,
  piscandoAte: 0,
});

export interface Novidade {
  comecou?: { id: number; g: 'pa' | 'cenoura' };
  empurrar?: number;
  porta?: Lado;
  arrancou?: boolean;
}

const mudar = (c: Coelho, acao: Acao) => {
  c.acao = acao;
  c.t = 0;
};

/** Um passo de dt segundos do coelho de quem joga. */
export function passoDoCoelho(s: Sala, m: Mundo, c: Coelho, cmd: Comandos, dt: number, temCenoura: boolean): Novidade {
  const nov: Novidade = {};
  c.relogio += dt * 1000;
  c.t += dt * 1000;
  const golpe = cmd.golpe;
  const item = cmd.item;
  const arrancada = cmd.arrancada;
  cmd.golpe = cmd.item = cmd.arrancada = false;
  if (c.acao === 'dor') {
    if (c.t < 300) {
      [c.x, c.y] = mover(s, m, c.x, c.y, c.vx * dt, c.vy * dt, RAIO, 'coelho');
      c.vx *= 0.85;
      c.vy *= 0.85;
      return nov;
    }
    mudar(c, 'parado');
  }
  if (c.acao === 'pa' && c.t < PA.dura) return nov;
  if (c.acao === 'cenoura' && c.t < 200) return nov;
  if (c.acao === 'arrancada') {
    if (c.t < ARRANCADA_MS) {
      const [ddx, ddy] = DIRS[c.dir];
      [c.x, c.y] = mover(s, m, c.x, c.y, ddx * ARRANCADA_VEL * dt, ddy * ARRANCADA_VEL * dt, RAIO, 'coelho');
      const p = portaEm(s, c.x, c.y);
      if (p) nov.porta = p;
      return nov;
    }
    mudar(c, 'parado');
  }
  if (c.acao === 'pa' || c.acao === 'cenoura') mudar(c, 'parado');

  if (golpe) {
    c.ataque++;
    mudar(c, 'pa');
    nov.comecou = { id: c.ataque, g: 'pa' };
    return nov;
  }
  if (item && temCenoura && c.relogio - c.ultimaCenoura >= CENOURA.recarga) {
    c.ataque++;
    c.ultimaCenoura = c.relogio;
    mudar(c, 'cenoura');
    nov.comecou = { id: c.ataque, g: 'cenoura' };
    return nov;
  }
  if (arrancada && c.relogio - c.ultimaArrancada >= ARRANCADA_RECARGA_MS) {
    c.ultimaArrancada = c.relogio;
    mudar(c, 'arrancada');
    nov.arrancou = true;
    return nov;
  }

  const dx = (cmd.direita ? 1 : 0) - (cmd.esquerda ? 1 : 0);
  const dy = (cmd.baixo ? 1 : 0) - (cmd.cima ? 1 : 0);
  if (dx === 0 && dy === 0) {
    if (c.acao !== 'parado') mudar(c, 'parado');
    c.empurrando = 0;
    // parado dentro da porta aberta também passa (o servidor pode ter perdido o pedido de quando ele entrou)
    const aqui = portaEm(s, c.x, c.y);
    if (aqui) nov.porta = aqui;
    return nov;
  }
  // para onde olha: o eixo que mudou; nas diagonais, fica o de antes se ele ainda vale
  const horizontal = c.dir >= 2;
  if (dx !== 0 && (dy === 0 || horizontal)) c.dir = dx < 0 ? 2 : 3;
  else if (dy !== 0) c.dir = dy < 0 ? 1 : 0;
  if (dx !== 0) c.lado = dx < 0 ? -1 : 1;
  if (c.acao !== 'andando') mudar(c, 'andando');
  const k = dx !== 0 && dy !== 0 ? Math.SQRT1_2 : 1;
  const [ax, ay] = [c.x, c.y];
  [c.x, c.y] = mover(s, m, c.x, c.y, dx * VEL * k * dt, dy * VEL * k * dt, RAIO, 'coelho');
  // apertando contra o bloco (num eixo só, alinhado com ele): passado EMPURRAO_MS, ele anda uma casa
  const bloco = (dx === 0) !== (dy === 0) ? blocoAFrente(m, c.x, c.y, dx, dy) : -1;
  if (bloco >= 0 && Math.abs(c.x - ax) + Math.abs(c.y - ay) < 0.5) {
    c.empurrando += dt * 1000;
    if (c.empurrando >= EMPURRAO_MS) {
      c.empurrando = 0;
      nov.empurrar = dx < 0 ? 2 : dx > 0 ? 3 : dy < 0 ? 1 : 0;
    }
  } else c.empurrando = 0;
  // a porta: dentro dela, ou apertando contra uma fechada (a trancada abre com a chave)
  const p = portaEm(s, c.x, c.y) ?? portaEm(s, c.x + dx * (RAIO + 4), c.y + dy * (RAIO + 4));
  if (p) nov.porta = p;
  return nov;
}

/** O bloco logo à frente de quem anda (dx, dy), alinhado com ele: o índice em m.blocos, ou -1. */
export function blocoAFrente(m: Mundo, x: number, y: number, dx: number, dy: number): number {
  const fx = x + dx * (RAIO + 4);
  const fy = y + dy * (RAIO + 4);
  return m.blocos.findIndex(([bc, bl]) => {
    const [cx, cy] = centro(bc, bl);
    const dentro = Math.floor(fx / TILE) === bc && Math.floor(fy / TILE) === bl;
    const alinhado = dx !== 0 ? Math.abs(y - cy) < 14 : Math.abs(x - cx) < 14;
    return dentro && alinhado;
  });
}

/** A pancada que o coelho leva: vai para trás, longe de (deX, deY). */
export function apanhar(c: Coelho, deX: number, deY: number) {
  const d = Math.hypot(c.x - deX, c.y - deY) || 1;
  c.vx = ((c.x - deX) / d) * 260;
  c.vy = ((c.y - deY) / d) * 260;
  mudar(c, 'dor');
  c.piscandoAte = c.relogio + 1000;
}

// ---------------- A CENOURA QUE VAI E VOLTA ----------------
export interface Cenoura {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  andou: number;
  volta: boolean;
  t: number;
}

/** Um passo da cenoura: vai até o alcance ou até bater, e volta para o dono. Devolve a casa em que bateu, e se acabou. */
export function passoDaCenoura(s: Sala, m: Mundo, cen: Cenoura, dono: { x: number; y: number }, dt: number): { bateu: [number, number] | null; fim: boolean } {
  cen.t += dt * 1000;
  const passo = CENOURA.vel * dt;
  if (!cen.volta) {
    const nx = cen.x + cen.dx * passo;
    const ny = cen.y + cen.dy * passo;
    const c = Math.floor(nx / TILE);
    const l = Math.floor(ny / TILE);
    if (solida(s, m, c, l, 'tiro')) {
      cen.volta = true;
      return { bateu: [c, l], fim: false };
    }
    cen.x = nx;
    cen.y = ny;
    cen.andou += passo;
    if (cen.andou >= CENOURA.alcance) cen.volta = true;
    return { bateu: null, fim: false };
  }
  const d = Math.hypot(dono.x - cen.x, dono.y - cen.y);
  if (d <= passo + 8 || cen.t > CENOURA.dura) return { bateu: null, fim: true };
  cen.x += ((dono.x - cen.x) / d) * passo;
  cen.y += ((dono.y - cen.y) / d) * passo;
  return { bateu: null, fim: false };
}

// ---------------- O QUADRO DO SERVIDOR ----------------
export type Fase = 'jogando' | 'vitoria' | 'derrota' | 'fim';
export interface Quadro {
  tipo: 'q';
  n: number;
  f: Fase;
  /** A sala em que a turma está. */
  s: number;
  /** As portas [n, s, o, l]: 0 sem porta, 1 aberta, 2 fechada, 3 trancada. */
  p: number[];
  /** Os blocos: [id, c, l]. */
  b: number[][];
  /** O baú da sala: 0 sem, 1 fechado, 2 aberto. */
  bau: number;
  ponte: number;
  /** Os botões do chão (1 apertado), na ordem da grade, e se o enigma já foi resolvido. */
  pl: number[];
  pr: number;
  /** [tem a cenoura, chaves]. */
  it: number[];
  /** [id, tipo, x, y, z, estado, lado, hp%, ms no estado, alvoX, alvoY] */
  i: number[][];
  /** Os tiros: [id, x, y]. */
  t: number[][];
  /** Os corações no chão: [id, x, y]. */
  c: number[][];
  /** As salas já visitadas. */
  v: number[];
  /** [userId, x, y, dir, ação, ms da ação, corações, estado (0 em pé, 1 fora), pontos, avatar, último golpe aceito, teleporte] */
  j: unknown[][];
  e: unknown[][];
}

export const ehQuadro = (d: unknown): d is Quadro => {
  const q = d as Quadro | null;
  return !!q && q.tipo === 'q' && typeof q.n === 'number' && typeof q.s === 'number' && Array.isArray(q.i) && Array.isArray(q.j);
};

/** O mundo da sala, como o quadro o diz. */
export function mundoDoQuadro(q: Quadro): Mundo {
  return {
    blocos: q.b.map((b) => [b[1], b[2]] as [number, number]),
    bau: q.bau > 0,
    ponte: q.ponte === 1,
    abertas: LADOS.filter((_, k) => q.p[k] === 1),
  };
}

// ---------------- O CAMINHO E O PILOTO AUTOMÁTICO (os testes e o e2e) ----------------
/** A próxima casa no caminho mais curto de `de` até `para` (pelas casas livres para o coelho), ou null. */
export function proximaCasa(s: Sala, m: Mundo, de: [number, number], para: [number, number]): [number, number] | null {
  if (de[0] === para[0] && de[1] === para[1]) return para;
  const chave = (c: number, l: number) => l * COLS + c;
  const veio = new Map<number, number>();
  veio.set(chave(para[0], para[1]), -1);
  // do destino para a origem: a primeira casa achada a partir de `de` é o próximo passo
  const fila: [number, number][] = [para];
  while (fila.length) {
    const [c, l] = fila.shift()!;
    for (const [dx, dy] of DIRS) {
      const nc = c + dx;
      const nl = l + dy;
      const k = chave(nc, nl);
      if (veio.has(k)) continue;
      if (nc === de[0] && nl === de[1]) return [c, l];
      if (solida(s, m, nc, nl, 'coelho')) continue;
      veio.set(k, chave(c, l));
      fila.push([nc, nl]);
    }
  }
  return null;
}

export interface VistaDoPiloto {
  sala: Sala;
  m: Mundo;
  eu: Coelho;
  temCenoura: boolean;
  chaves: number;
  /** O enigma dos botões resolvido; os botões apertados agora (ordem da grade). */
  placasResolvidas: boolean;
  bauAberto: boolean;
  bichos: { tipo: TipoDoBicho; x: number; y: number; z: number; estado: EstadoDoBicho }[];
}

/** Aperta as setas na direção de (x, y), pelo caminho. Devolve a distância. */
function irPara(v: VistaDoPiloto, cmd: Comandos, x: number, y: number): number {
  const { eu, sala, m } = v;
  const d = Math.hypot(x - eu.x, y - eu.y);
  let tx = x;
  let ty = y;
  const minha: [number, number] = [Math.floor(eu.x / TILE), Math.floor(eu.y / TILE)];
  const alvo: [number, number] = [Math.floor(x / TILE), Math.floor(y / TILE)];
  if (minha[0] !== alvo[0] || minha[1] !== alvo[1]) {
    const prox = proximaCasa(sala, m, minha, alvo);
    if (prox) [tx, ty] = centro(prox[0], prox[1]);
  }
  const folga = 3;
  cmd.esquerda = tx < eu.x - folga;
  cmd.direita = tx > eu.x + folga;
  cmd.cima = ty < eu.y - folga;
  cmd.baixo = ty > eu.y + folga;
  return d;
}

/** Olha para a direção `dir` (aperta a seta dela) e bate. */
function olharEBater(cmd: Comandos, dir: number) {
  cmd.cima = dir === 1;
  cmd.baixo = dir === 0;
  cmd.esquerda = dir === 2;
  cmd.direita = dir === 3;
}

/**
 * O PILOTO AUTOMÁTICO: luta com o bicho mais perto, abre o baú, acerta o cristal com a cenoura, empurra o bloco até um botão
 * e pisa no outro, e vai para a próxima porta. Só para o teste do servidor e o e2e (window.masmorraPilotoAutomatico).
 */
export function piloto(v: VistaDoPiloto, cmd: Comandos) {
  const { eu, sala, m } = v;
  Object.assign(cmd, comandosVazios());
  if (eu.acao === 'pa' || eu.acao === 'dor') return;
  // 1. os bichos
  const vivos = v.bichos.filter((b) => b.estado !== 'morto');
  if (vivos.length) {
    const alvo = vivos.sort((a, b) => Math.hypot(a.x - eu.x, a.y - eu.y) - Math.hypot(b.x - eu.x, b.y - eu.y))[0];
    const raio = BICHOS[alvo.tipo].raio;
    const ddx = alvo.x - eu.x;
    const ddy = alvo.y - eu.y;
    const longe = raio + 22;
    const opcoes: [number, number, number][] = [
      [alvo.x - Math.sign(ddx || 1) * longe, alvo.y, ddx >= 0 ? 3 : 2],
      [alvo.x, alvo.y - Math.sign(ddy || 1) * longe, ddy >= 0 ? 0 : 1],
      [alvo.x + Math.sign(ddx || 1) * longe, alvo.y, ddx >= 0 ? 2 : 3],
      [alvo.x, alvo.y + Math.sign(ddy || 1) * longe, ddy >= 0 ? 1 : 0],
    ];
    if (Math.abs(ddy) > Math.abs(ddx)) [opcoes[0], opcoes[1]] = [opcoes[1], opcoes[0]];
    const lugar = opcoes.find(([x, y]) => livre(sala, m, x, y, RAIO, 'coelho')) ?? opcoes[0];
    const [lx, ly, dir] = lugar;
    if (Math.hypot(lx - eu.x, ly - eu.y) < 9) {
      if (alvo.z > 12) return;
      olharEBater(cmd, dir);
      cmd.golpe = eu.dir === dir;
      return;
    }
    irPara(v, cmd, lx, ly);
    return;
  }
  // 2. o baú fechado
  const bau = casasDe(sala, 'C')[0];
  const minha: [number, number] = [Math.floor(eu.x / TILE), Math.floor(eu.y / TILE)];
  if (bau && m.bau && !v.bauAberto && proximaCasa(sala, m, minha, [bau[0], bau[1] + 1])) {
    const [bx, by] = centro(bau[0], bau[1]);
    irPara(v, cmd, bx, by + TILE);
    if (Math.hypot(bx - eu.x, by + TILE - eu.y) < 10) cmd.cima = true;
    return;
  }
  // 3. o cristal do outro lado da água: de frente para ele, a cenoura
  const cristal = casasDe(sala, 'K')[0];
  if (cristal && !m.ponte && v.temCenoura) {
    let l = cristal[1] + 1;
    while (l < LINHAS && sala.grade[l][cristal[0]] !== '~') l++;
    while (l < LINHAS && sala.grade[l][cristal[0]] === '~') l++;
    const [px, py] = centro(cristal[0], l);
    if (irPara(v, cmd, px, py) < 6) {
      olharEBater(cmd, 1);
      cmd.item = eu.dir === 1;
    }
    return;
  }
  // 4. os botões do chão: o bloco num, e o coelho no outro (sem a cenoura, primeiro o baú do oeste)
  const placas = casasDe(sala, 'P');
  if (placas.length && !v.placasResolvidas && v.temCenoura && m.blocos.length) {
    const [b] = m.blocos;
    const naPlaca = placas.findIndex(([c, l]) => c === b[0] && l === b[1]);
    if (naPlaca >= 0) {
      const outra = placas[1 - naPlaca];
      const [ox, oy] = centro(outra[0], outra[1]);
      irPara(v, cmd, ox, oy);
      return;
    }
    const alvo = placas.slice().sort((a, z) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) - (Math.abs(z[0] - b[0]) + Math.abs(z[1] - b[1])))[0];
    const dc = alvo[0] - b[0];
    const dl = alvo[1] - b[1];
    const [ddx, ddy] = dc !== 0 ? [Math.sign(dc), 0] : [0, Math.sign(dl)];
    const atras = centro(b[0] - ddx, b[1] - ddy);
    // atrás do bloco e alinhado (encostado nele também conta: é de onde se empurra)
    const perp = ddx !== 0 ? Math.abs(atras[1] - eu.y) : Math.abs(atras[0] - eu.x);
    const ao = ddx !== 0 ? (eu.x - atras[0]) * ddx : (eu.y - atras[1]) * ddy;
    if (perp < 4 && ao > -4 && ao < 10) {
      cmd.esquerda = ddx < 0;
      cmd.direita = ddx > 0;
      cmd.cima = ddy < 0;
      cmd.baixo = ddy > 0;
    } else if (irPara(v, cmd, atras[0], atras[1]) < 12) {
      // perto: só o ajuste fino, para entrar alinhado com o bloco
      cmd.esquerda = atras[0] < eu.x - 1;
      cmd.direita = atras[0] > eu.x + 1;
      cmd.cima = atras[1] < eu.y - 1;
      cmd.baixo = atras[1] > eu.y + 1;
    }
    return;
  }
  // 5. a próxima porta
  const lado: Lado | undefined =
    sala.id === 2 ? (v.temCenoura ? 'n' : 'o') : sala.id === 3 ? 'l' : sala.portas.n ? 'n' : undefined;
  if (!lado) return;
  const [pc, pl] = PORTA[lado];
  if (m.abertas.includes(lado)) {
    const [px, py] = centro(pc, pl);
    irPara(v, cmd, px, py);
    return;
  }
  // fechada (a trancada abre com a chave): apertar contra ela, de dentro
  const [ddx, ddy] = DIRS[LADO_DA_DIR.indexOf(lado)];
  const [dx, dy] = centro(pc - ddx, pl - ddy);
  if (irPara(v, cmd, dx, dy) < 5) {
    cmd.cima = ddy < 0;
    cmd.baixo = ddy > 0;
    cmd.esquerda = ddx < 0;
    cmd.direita = ddx > 0;
  }
}
