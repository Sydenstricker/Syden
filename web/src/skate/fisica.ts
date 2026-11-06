/**
 * A FÍSICA DO SKATE (05/11/2026): passos fixos de 1/60 s, como a do kart e a do Pulo do coelho. O mesmo comando dá a mesma
 * sessão, e a sessão é o número de passos (1 minuto = 3600), não o relógio: a janela sem foco pausa tudo. Só + − × ÷ e raiz
 * (os giros são por constantes escritas aqui, não por seno e cosseno), para que um dia o servidor possa refazer a conta.
 *
 * O MODELO, em 2,5 D: no chão o skatista anda na superfície (a velocidade é a DA SUPERFÍCIE, e a gravidade puxa ao longo da
 * inclinação: subir o quarter freia, descer acelera). O chão é o da pista (pista.ts): dentro de uma peça ele é contínuo, e na
 * borda entre duas peças a física compara as alturas — o degrau para cima é parede, o degrau para baixo é sair do chão. Sair
 * de uma subida com velocidade (a rampa que acaba, a borda do quarter) lança o skatista com a velocidade que ele tinha. No
 * alto do quarter, o "vert": o que ia para dentro da parede é tirado, ele sobe e volta para a mesma parede.
 *
 * AS MANOBRAS (só a mecânica dos jogos de skate): ollie (Espaço: segurar carrega, soltar pula), kickflip (Z no ar), grab (X
 * segurado no ar), giros (as setas no ar: 180, 360, 540…), grind (cair alinhado num corrimão ou na caixa, com o equilíbrio nas
 * setas) e manual (C: no chão, ou no ar para cair já nele, com o equilíbrio em ↑ ↓). Encadeadas, viram um COMBO: os pontos
 * somados vezes o número de manobras. O combo se fecha quando o skatista roda no chão sem manobra por um instante; cair
 * (pousar torto, com o flip pela metade, perder o equilíbrio, bater de frente) perde o combo inteiro.
 */
import { altura, alturaDaPeca, dentro, LARGURA, MARGEM, pecaEm, PROFUNDIDADE, perfilDaPeca, subidaDaPeca, TRILHOS, type Trilho } from './pista';

export const PASSO = 1 / 60;
/** A sessão: 1 minuto (eram 2 até 06/11/2026, pedido dele). */
export const PASSOS_DA_SESSAO = 3600;
/** Acabou o tempo no meio de um combo: ele ainda tem isto para fechar (depois, fecha como estiver). */
export const PASSOS_DE_FOLGA = 600;

const G = 6;
const EMPURRAO = 0.09;
const VEL_DO_EMPURRAO = 4.2;
const VEL_MAX = 6.5;
const FREIO = 0.16;
const ATRITO = 0.005;
const OLLIE = 2.05;
const OLLIE_CARREGADO = 0.55;
const CARGA_MAX = 24;
/** O passo do giro no chão (0,045 rad) e no ar (7,5°), escritos para não depender do seno e do cosseno de ninguém. */
const VIRA_C = 0.9989875951053857;
const VIRA_S = 0.04498481410829857;
const GIRO_C = 0.9914448613738104;
const GIRO_S = 0.13052619222005157;
/** 24 passos de 7,5° = 180°. */
const GIRO_MEIA_VOLTA = 24;
const FLIP_PASSOS = 20;
/** Pousar com o flip faltando mais que isto é cair. */
const FLIP_TOLERANCIA = 4;
/** Prancha e caminho: pousar com mais que ~40° de diferença (nem de frente, nem de costas) é cair. */
const POUSO_ALINHADO = 0.76;
/** Depois de pousar, este tanto para emendar um manual sem perder o combo. */
const GRACA = 14;
const QUEDA_PASSOS = 75;
const PAREDE = 0.07;
const DEGRAU_PARA_BAIXO = 0.012;

export interface Comandos {
  frente: boolean;
  tras: boolean;
  esquerda: boolean;
  direita: boolean;
  pulo: boolean;
  flip: boolean;
  grab: boolean;
  manual: boolean;
}

export const NADA: Comandos = { frente: false, tras: false, esquerda: false, direita: false, pulo: false, flip: false, grab: false, manual: false };

export type Modo = 'chao' | 'ar' | 'grind' | 'manual' | 'caido';

/** O nome da manobra (o mesmo em toda língua: é a gíria do skate) e os pontos que ela valeu dentro do combo. */
export interface Manobra {
  nome: string;
  pontos: number;
}

export type Evento =
  | { tipo: 'ollie' }
  | { tipo: 'pouso' }
  | { tipo: 'grind' }
  | { tipo: 'manobra'; nome: string; pontos: number }
  | { tipo: 'combo'; pontos: number; vezes: number; manobras: number }
  | { tipo: 'queda'; perdeu: number };

export interface Skatista {
  passo: number;
  x: number;
  y: number;
  z: number;
  /** Para onde anda, no chão (unitário), e a velocidade na superfície. */
  rx: number;
  rz: number;
  vel: number;
  /** No ar. */
  vx: number;
  vy: number;
  vz: number;
  /** Para onde a prancha aponta (no chão, igual ao caminho; no ar, gira com as setas). */
  cx: number;
  cz: number;
  /** De que lado o coelho está em cima da prancha (1 ou −1): troca a cada pouso de costas. Só desenho. */
  base: number;
  modo: Modo;
  /** A peça em que está (pista.ts; −1 = o piso). */
  peca: number;
  carga: number;
  /** No ar: quantos passos, de onde saiu, o giro (em passos de 7,5°, com sinal), o flip que falta e o grab segurado. */
  noAr: number;
  saida: 'ollie' | 'rampa' | 'vert' | 'queda';
  giro: number;
  flip: number;
  grab: number;
  grabs: number;
  manualArmado: boolean;
  /** No grind e no manual: o equilíbrio (de −1 a 1; passou, caiu) e a deriva dele. */
  equilibrio: number;
  deriva: number;
  /** No grind: qual linha, onde nela (de 0 ao comprimento) e para que lado. */
  trilho: number;
  t: number;
  sentido: number;
  /** Passos na manobra contínua de agora (grind, manual). */
  duracao: number;
  /** Desde o pouso, no chão: a janela para emendar o manual. */
  desdePouso: number;
  queda: number;
  /** O combo aberto, e os pontos da sessão. */
  combo: Manobra[];
  pontos: number;
  melhorCombo: number;
  /** Os comandos do passo anterior (para saber o que acabou de ser apertado). */
  antes: Comandos;
  terminou: boolean;
  /** O que aconteceu neste passo (o desenho e o som leem; o próximo passo limpa). */
  eventos: Evento[];
}

export function novoSkatista(): Skatista {
  return {
    passo: 0,
    x: 6,
    y: 0,
    z: 9,
    rx: 0,
    rz: -1,
    vel: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    cx: 0,
    cz: -1,
    base: 1,
    modo: 'chao',
    peca: -1,
    carga: 0,
    noAr: 0,
    saida: 'ollie',
    giro: 0,
    flip: 0,
    grab: 0,
    grabs: 0,
    manualArmado: false,
    equilibrio: 0,
    deriva: 0,
    trilho: -1,
    t: 0,
    sentido: 1,
    duracao: 0,
    desdePouso: 99,
    queda: 0,
    combo: [],
    pontos: 0,
    melhorCombo: 0,
    antes: NADA,
    terminou: false,
    eventos: [],
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// OS PONTOS
// ---------------------------------------------------------------------------------------------------------------------

/** O valor de uma manobra; `seg` é a duração (grind, manual, grab, ar). */
function valorBase(nome: string, seg: number): number {
  switch (nome) {
    case 'Ollie':
      return 50;
    case 'Kickflip':
      return 150;
    case 'Grab':
      return 150 + Math.floor(300 * seg);
    case 'Grind':
      return 100 + Math.floor(200 * seg);
    case 'Stall':
      // a beirada do quarter: só se chega a ela de um vert com meio giro, e por isso vale mais que o grind
      return 200 + Math.floor(250 * seg);
    case 'Manual':
      return 50 + Math.floor(150 * seg);
    case 'Air':
      return 50 + Math.floor(150 * seg);
    default: {
      // os giros: "180", "360", "540"…
      const g = Number(nome);
      return g >= 180 ? (g / 180) * ((g / 180) + 1) * 75 : 0;
    }
  }
}

/** Repetir a mesma manobra no combo vale menos: 100%, 75%, 50%, 25%. */
function somar(k: Skatista, nome: string, seg = 0) {
  const vezes = k.combo.filter((m) => m.nome === nome).length;
  const pontos = Math.floor((valorBase(nome, seg) * Math.max(1, 4 - vezes)) / 4);
  if (pontos <= 0) return;
  k.combo.push({ nome, pontos });
  k.eventos.push({ tipo: 'manobra', nome, pontos });
}

export const valorDoCombo = (combo: Manobra[]) => combo.reduce((s, m) => s + m.pontos, 0) * combo.length;

function fecharCombo(k: Skatista) {
  if (k.combo.length === 0) return;
  const total = valorDoCombo(k.combo);
  k.pontos += total;
  if (total > k.melhorCombo) k.melhorCombo = total;
  k.eventos.push({ tipo: 'combo', pontos: total, vezes: k.combo.length, manobras: k.combo.length });
  k.combo = [];
}

function cair(k: Skatista) {
  const perdeu = valorDoCombo(k.combo);
  k.combo = [];
  k.modo = 'caido';
  k.queda = QUEDA_PASSOS;
  k.flip = 0;
  k.grab = 0;
  k.giro = 0;
  k.manualArmado = false;
  k.trilho = -1;
  k.vy = 0;
  k.eventos.push({ tipo: 'queda', perdeu });
}

// ---------------------------------------------------------------------------------------------------------------------
// O CHÃO
// ---------------------------------------------------------------------------------------------------------------------

/** A inclinação da peça `i` no ponto, olhando para (dx, dz): a diferença para trás, dentro da própria peça. */
function inclinacao(i: number, x: number, z: number, dx: number, dz: number): number {
  const e = 0.02;
  return (alturaDaPeca(i, x, z) - alturaDaPeca(i, x - dx * e, z - dz * e)) / e;
}

function normalizar(k: Skatista) {
  const n = Math.sqrt(k.rx * k.rx + k.rz * k.rz);
  if (n > 0) {
    k.rx /= n;
    k.rz /= n;
  }
  const m = Math.sqrt(k.cx * k.cx + k.cz * k.cz);
  if (m > 0) {
    k.cx /= m;
    k.cz /= m;
  }
}

/** Sai do chão com a velocidade que tem, na inclinação `s` em que estava. */
function decolar(k: Skatista, s: number, saida: Skatista['saida'], extra: number) {
  const n = Math.sqrt(1 + s * s);
  const h = k.vel / n;
  k.vx = k.rx * h;
  k.vz = k.rz * h;
  k.vy = (k.vel * s) / n + extra;
  k.saida = saida;
  // O VERT: saindo da borda do quarter, o que ia para dentro da parede sai, e ele volta para a mesma parede
  if (saida === 'rampa' && s > 1.8 && perfilDaPeca(k.peca) === 'quarter') {
    const [ux, uz] = subidaDaPeca(k.peca);
    const p = k.vx * ux + k.vz * uz;
    if (p > 0) {
      k.vx -= ux * p;
      k.vz -= uz * p;
      // um tico para dentro da curva, para descer nela (e não no patamar)
      k.x -= ux * 0.05;
      k.z -= uz * 0.05;
      k.saida = 'vert';
    }
  }
  k.modo = 'ar';
  k.noAr = 0;
  k.giro = 0;
  k.flip = 0;
  k.grab = 0;
  k.grabs = 0;
  k.manualArmado = false;
}

/**
 * Anda no chão (no modo chão e no manual). Devolve false se saiu do chão (decolou) ou caiu.
 */
function rodar(k: Skatista, c: Comandos, noManual: boolean): boolean {
  // virar
  if (c.esquerda !== c.direita) {
    const s = c.esquerda ? VIRA_S : -VIRA_S;
    const rx = k.rx * VIRA_C + k.rz * s;
    const rz = -k.rx * s + k.rz * VIRA_C;
    k.rx = rx;
    k.rz = rz;
  }
  // empurrar e frear (no manual, ↑ ↓ são o equilíbrio)
  if (!noManual) {
    if (c.frente && k.vel < VEL_DO_EMPURRAO && k.carga === 0) k.vel = Math.min(VEL_DO_EMPURRAO, k.vel + EMPURRAO);
    if (c.tras) k.vel = Math.max(0, k.vel - FREIO);
  }
  k.vel = Math.max(0, k.vel - ATRITO);
  // a gravidade ao longo da inclinação
  const s0 = inclinacao(k.peca, k.x, k.z, k.rx, k.rz);
  const n0 = Math.sqrt(1 + s0 * s0);
  k.vel -= (G * PASSO * s0) / n0;
  if (k.vel < 0) {
    // desceu de costas: o caminho vira (e o coelho fica de costas, o "fakie")
    k.vel = -k.vel;
    k.rx = -k.rx;
    k.rz = -k.rz;
    k.base = -k.base;
  }
  if (k.vel > VEL_MAX) k.vel = VEL_MAX;
  normalizar(k);
  const s = inclinacao(k.peca, k.x, k.z, k.rx, k.rz);
  const d = (k.vel * PASSO) / Math.sqrt(1 + s * s);
  if (d <= 0) {
    k.cx = k.rx;
    k.cz = k.rz;
    return true;
  }
  const tentar = (nx: number, nz: number): 'ok' | 'parede' | 'degrau' => {
    if (!dentro(nx, nz)) return 'parede';
    const i = pecaEm(nx, nz);
    const h = alturaDaPeca(i, nx, nz);
    const previsto = k.y + s * d;
    if (i !== k.peca) {
      // a borda entre duas peças: o chão continua, sobe num degrau (parede) ou cai num degrau
      const continua = alturaDaPeca(k.peca, nx, nz);
      if (h - continua > PAREDE && h > k.y + PAREDE) return 'parede';
      if (h < continua - DEGRAU_PARA_BAIXO * 3) return 'degrau';
    }
    if (h < previsto - DEGRAU_PARA_BAIXO) return 'degrau';
    return 'ok';
  };
  let nx = k.x + k.rx * d;
  let nz = k.z + k.rz * d;
  let r = tentar(nx, nz);
  if (r === 'parede') {
    // raspa na parede: tenta seguir só por um dos eixos
    const porX = Math.abs(k.rx) > 0.2 ? tentar(k.x + k.rx * d, k.z) : 'parede';
    const porZ = Math.abs(k.rz) > 0.2 ? tentar(k.x, k.z + k.rz * d) : 'parede';
    const deFrente = porX === 'parede' && porZ === 'parede';
    if (deFrente) {
      if (k.vel > 3.2 && !noManual) {
        cair(k);
        return false;
      }
      k.rx = -k.rx;
      k.rz = -k.rz;
      k.vel *= 0.35;
      k.base = -k.base;
      k.cx = k.rx;
      k.cz = k.rz;
      return true;
    }
    // segue pelo eixo que deu (o de maior componente, se os dois deram)
    const eixoX = porX !== 'parede' && (porZ === 'parede' || Math.abs(k.rx) >= Math.abs(k.rz));
    if (eixoX) {
      k.vel *= Math.abs(k.rx);
      k.rx = k.rx > 0 ? 1 : -1;
      k.rz = 0;
      nz = k.z;
      r = porX;
    } else {
      k.vel *= Math.abs(k.rz);
      k.rz = k.rz > 0 ? 1 : -1;
      k.rx = 0;
      nx = k.x;
      r = porZ;
    }
    nx = k.x + k.rx * d;
    nz = k.z + k.rz * d;
  }
  k.cx = k.rx;
  k.cz = k.rz;
  if (r === 'degrau') {
    // saiu do chão: a rampa que acaba, a borda do quarter, o degrau
    const y = k.y + s * d;
    decolar(k, s, s > 0.3 ? 'rampa' : 'queda', 0);
    if (k.saida !== 'vert') {
      k.x = nx;
      k.z = nz;
    }
    k.y = y;
    return false;
  }
  k.x = nx;
  k.z = nz;
  k.peca = pecaEm(nx, nz);
  k.y = altura(nx, nz);
  return true;
}

// ---------------------------------------------------------------------------------------------------------------------
// O PASSO
// ---------------------------------------------------------------------------------------------------------------------

/** Um tico de deriva que muda com o passo (sem sorteio: o mesmo passo dá a mesma deriva). */
const tremor = (n: number) => (((n * 37) % 23) - 11) * 0.00003;

export function passo(k: Skatista, comandos: Comandos) {
  k.eventos = [];
  if (k.terminou) return;
  const acabouOTempo = k.passo >= PASSOS_DA_SESSAO;
  // acabado o tempo, não começa nada novo: só deixa fechar o que está no ar
  const c = acabouOTempo ? { ...NADA, esquerda: comandos.esquerda, direita: comandos.direita, frente: comandos.frente, tras: comandos.tras } : comandos;
  const a = k.antes;
  const apertou = (b: keyof Comandos) => c[b] && !a[b];
  k.passo++;

  switch (k.modo) {
    case 'caido': {
      k.vel = Math.max(0, k.vel - 0.08);
      if (--k.queda <= 0) {
        k.modo = 'chao';
        k.vel = 0;
        k.cx = k.rx;
        k.cz = k.rz;
        k.carga = 0;
        k.desdePouso = 99;
      }
      break;
    }
    case 'chao': {
      if (k.combo.length && ++k.desdePouso > GRACA) fecharCombo(k);
      if (apertou('manual') && k.vel > 0.5) {
        k.modo = 'manual';
        k.equilibrio = 0;
        k.deriva = 0;
        k.duracao = 0;
        k.carga = 0;
        break;
      }
      if (c.pulo) k.carga = Math.min(CARGA_MAX, k.carga + 1);
      else if (a.pulo && k.carga > 0) {
        // o ollie sai ao soltar; carregado, mais alto
        const s = inclinacao(k.peca, k.x, k.z, k.rx, k.rz);
        const extra = OLLIE + (OLLIE_CARREGADO * k.carga) / CARGA_MAX;
        k.carga = 0;
        decolar(k, s, 'ollie', extra);
        somar(k, 'Ollie');
        k.eventos.push({ tipo: 'ollie' });
        break;
      }
      rodar(k, c, false);
      break;
    }
    case 'manual': {
      k.duracao++;
      k.deriva += k.equilibrio * 0.0012 + tremor(k.passo) * 2;
      if (c.frente) k.deriva -= 0.0019;
      if (c.tras) k.deriva += 0.0019;
      k.equilibrio += k.deriva;
      const fim = () => somar(k, 'Manual', k.duracao * PASSO);
      if (k.equilibrio > 1 || k.equilibrio < -1) {
        cair(k);
        break;
      }
      if (apertou('pulo')) {
        fim();
        const s = inclinacao(k.peca, k.x, k.z, k.rx, k.rz);
        decolar(k, s, 'ollie', OLLIE);
        somar(k, 'Ollie');
        k.eventos.push({ tipo: 'ollie' });
        break;
      }
      if (apertou('manual') || k.vel < 0.3) {
        fim();
        k.modo = 'chao';
        k.desdePouso = 0;
        break;
      }
      // saiu do chão no manual (o degrau, a rampa): a manobra conta, e o combo segue no ar
      if (!rodar(k, c, true) && (k.modo as Modo) === 'ar') fim();
      break;
    }
    case 'grind': {
      const tr = TRILHOS[k.trilho];
      k.duracao++;
      k.vel = Math.max(0, k.vel - 0.004);
      k.deriva += k.equilibrio * 0.0011 + tremor(k.passo);
      if (c.esquerda) k.deriva -= 0.0017;
      if (c.direita) k.deriva += 0.0017;
      k.equilibrio += k.deriva;
      if (k.equilibrio > 1 || k.equilibrio < -1) {
        // caiu da linha: no chão da pista (da cerca, para dentro dela; da beirada, na própria rampa, virado para descer)
        if (tr.dentro) {
          k.x += tr.dentro[0] * 0.35;
          k.z += tr.dentro[1] * 0.35;
          k.rx = tr.dentro[0];
          k.rz = tr.dentro[1];
        }
        paraDentro(k);
        k.peca = pecaEm(k.x, k.z);
        k.y = altura(k.x, k.z);
        cair(k);
        break;
      }
      k.t += k.sentido * k.vel * PASSO;
      const fora = k.t < 0 || k.t > tr.comp;
      const t = fora ? (k.t < 0 ? 0 : tr.comp) : k.t;
      k.x = tr.x1 + tr.dx * t;
      k.z = tr.z1 + tr.dz * t;
      k.y = tr.y;
      if (apertou('pulo') || fora || k.vel < 0.4) {
        somar(k, tr.nome, k.duracao * PASSO);
        k.rx = tr.dx * k.sentido;
        k.rz = tr.dz * k.sentido;
        if (tr.dentro) {
          // DA BEIRADA, DE VOLTA À RAMPA: um tico para o lado da curva, e o caminho virado para ela (metade ao longo da linha),
          // para cair na parede descendo; no patamar estreito atrás da beirada ele ficaria preso contra a cerca
          k.rx = k.rx * 0.5 + tr.dentro[0];
          k.rz = k.rz * 0.5 + tr.dentro[1];
          const n = Math.sqrt(k.rx * k.rx + k.rz * k.rz);
          k.rx /= n;
          k.rz /= n;
          k.cx = k.rx;
          k.cz = k.rz;
          k.x += tr.dentro[0] * 0.08;
          k.z += tr.dentro[1] * 0.08;
          k.vel = Math.max(k.vel, 1.2);
        }
        paraDentro(k);
        k.peca = pecaEm(k.x, k.z);
        decolar(k, 0, apertou('pulo') ? 'ollie' : 'queda', apertou('pulo') ? OLLIE : tr.dentro ? 0.3 : 0.7);
        if (k.saida === 'ollie') {
          somar(k, 'Ollie');
          k.eventos.push({ tipo: 'ollie' });
        }
        k.trilho = -1;
      }
      break;
    }
    case 'ar': {
      k.noAr++;
      // os giros: as setas giram a prancha (e o coelho) em passos de 7,5°
      if (c.esquerda !== c.direita) {
        const s = c.esquerda ? GIRO_S : -GIRO_S;
        const cx = k.cx * GIRO_C + k.cz * s;
        const cz = -k.cx * s + k.cz * GIRO_C;
        k.cx = cx;
        k.cz = cz;
        k.giro += c.esquerda ? 1 : -1;
      }
      if (k.flip > 0) k.flip--;
      if (apertou('flip') && k.flip === 0) {
        k.flip = FLIP_PASSOS;
        somar(k, 'Kickflip');
      }
      if (c.grab) k.grab++;
      else if (k.grab > 0) {
        if (k.grab >= 6) somar(k, 'Grab', k.grab * PASSO);
        k.grab = 0;
      }
      if (apertou('manual')) k.manualArmado = true;
      // o voo
      k.vy -= G * PASSO;
      const yAntes = k.y;
      let nx = k.x + k.vx * PASSO;
      let nz = k.z + k.vz * PASSO;
      const ny = k.y + k.vy * PASSO;
      // bateu de lado em alguma coisa (ou na cerca): perde o que ia para lá
      if (!dentro(nx, nz) || altura(nx, nz) > yAntes + 0.06) {
        if (!dentro(nx, k.z) || altura(nx, k.z) > yAntes + 0.06) {
          k.vx = -k.vx * 0.2;
          nx = k.x;
        }
        if (!dentro(nx, nz) || altura(nx, nz) > yAntes + 0.06) {
          k.vz = -k.vz * 0.2;
          nz = k.z;
        }
      }
      k.x = nx;
      k.z = nz;
      k.y = ny;
      // o grind: descendo, cruzando a altura de uma linha perto dela
      if (k.vy <= 0.3 && k.noAr > 4) {
        const i = pegarTrilho(k, yAntes);
        if (i >= 0) {
          comecarGrind(k, i);
          break;
        }
      }
      const h = altura(k.x, k.z);
      if (k.y <= h) {
        k.y = h;
        k.peca = pecaEm(k.x, k.z);
        // caiu em cima da caixa ou do corrimão, alinhado: é grind também
        const p = perfilDaPeca(k.peca);
        if ((p === 'caixa' || p === 'corrimao') && k.noAr > 4) {
          const i = pegarTrilho(k, yAntes, true);
          if (i >= 0) {
            comecarGrind(k, i);
            break;
          }
        }
        pousar(k);
      }
      break;
    }
  }

  if (acabouOTempo) {
    const parado = k.modo === 'chao' || k.modo === 'caido';
    if ((parado && (k.combo.length === 0 || k.desdePouso > GRACA)) || k.passo >= PASSOS_DA_SESSAO + PASSOS_DE_FOLGA) {
      if (k.modo !== 'caido') fecharCombo(k);
      k.combo = [];
      k.terminou = true;
    } else if (parado) {
      fecharCombo(k);
    }
  }
  k.antes = { ...comandos };
}

/** Saindo da linha do alto da cerca (que fica por fora da pista), o skatista volta para dentro dela. */
function paraDentro(k: Skatista) {
  const m = MARGEM + 0.01;
  k.x = Math.min(LARGURA - m, Math.max(m, k.x));
  k.z = Math.min(PROFUNDIDADE - m, Math.max(m, k.z));
}

/** A linha de grind que a prancha pega neste passo, ou −1. */
function pegarTrilho(k: Skatista, yAntes: number, pousando = false): number {
  for (let i = 0; i < TRILHOS.length; i++) {
    const tr = TRILHOS[i];
    if (!pousando && !(yAntes >= tr.y - 0.03 && k.y <= tr.y + 0.02)) continue;
    const t = (k.x - tr.x1) * tr.dx + (k.z - tr.z1) * tr.dz;
    if (t < -0.05 || t > tr.comp - 0.1) continue;
    const px = tr.x1 + tr.dx * t - k.x;
    const pz = tr.z1 + tr.dz * t - k.z;
    if (px * px + pz * pz > tr.folga * tr.folga) continue;
    // alinhado: o caminho (ou, quase parado, a prancha) não pode cruzar a linha de través
    const h = Math.sqrt(k.vx * k.vx + k.vz * k.vz);
    const [ax, az] = h > 0.4 ? [k.vx / h, k.vz / h] : [k.cx, k.cz];
    if (Math.abs(ax * tr.dx + az * tr.dz) < 0.55) continue;
    // a beirada pede a PRANCHA ao longo dela (o meio giro no vert), e não só o caminho
    if (tr.prancha && Math.abs(k.cx * tr.dx + k.cz * tr.dz) < tr.prancha) continue;
    return i;
  }
  return -1;
}

function comecarGrind(k: Skatista, i: number) {
  const tr: Trilho = TRILHOS[i];
  if (k.flip > FLIP_TOLERANCIA) return cair(k);
  fecharAr(k);
  const h = Math.sqrt(k.vx * k.vx + k.vz * k.vz);
  const p = k.vx * tr.dx + k.vz * tr.dz;
  // quase sem caminho ao longo da linha (o vert, que sobe e desce reto), o sentido é o da prancha
  k.sentido = Math.abs(p) > 0.3 ? (p > 0 ? 1 : -1) : k.cx * tr.dx + k.cz * tr.dz >= 0 ? 1 : -1;
  k.vel = Math.max(1.6, Math.abs(p), h * 0.8);
  k.t = Math.max(0, (k.x - tr.x1) * tr.dx + (k.z - tr.z1) * tr.dz);
  k.x = tr.x1 + tr.dx * k.t;
  k.z = tr.z1 + tr.dz * k.t;
  k.y = tr.y;
  k.trilho = i;
  k.modo = 'grind';
  k.equilibrio = 0;
  k.deriva = 0;
  k.duracao = 0;
  // a prancha fica de lado na linha? Não: no 50-50 ela vai junto com a linha (e o coelho, de frente ou de costas)
  const pr = k.cx * tr.dx + k.cz * tr.dz;
  if (pr < 0) k.base = -k.base;
  k.cx = tr.dx * k.sentido;
  k.cz = tr.dz * k.sentido;
  k.rx = k.cx;
  k.rz = k.cz;
  k.eventos.push({ tipo: 'grind' });
}

/** As manobras do voo que só fecham ao pousar (ou ao pegar a linha): o grab segurado, o giro, o "Air" das rampas. */
function fecharAr(k: Skatista) {
  if (k.grab >= 6) somar(k, 'Grab', k.grab * PASSO);
  k.grab = 0;
  const g = Math.abs(k.giro);
  // o giro arredonda para a meia volta mais perto (com 45° de folga: o pouso torto já caiu antes)
  const meias = Math.floor((g + GIRO_MEIA_VOLTA / 2) / GIRO_MEIA_VOLTA);
  if (meias >= 1) somar(k, String(meias * 180));
  if ((k.saida === 'rampa' || k.saida === 'vert') && k.noAr >= 24) somar(k, 'Air', k.noAr * PASSO);
  k.giro = 0;
}

function pousar(k: Skatista) {
  // a velocidade que sobra é a que vai ao longo do chão (a gravidade e o choque levam o resto)
  const i = k.peca;
  const e = 0.02;
  const gx = (alturaDaPeca(i, k.x + e, k.z) - alturaDaPeca(i, k.x - e, k.z)) / (2 * e);
  const gz = (alturaDaPeca(i, k.x, k.z + e) - alturaDaPeca(i, k.x, k.z - e)) / (2 * e);
  const nn = 1 + gx * gx + gz * gz;
  // a normal é (−gx, 1, −gz)/√nn; tira-se dela o componente da velocidade
  const vn = (-gx * k.vx + k.vy - gz * k.vz) / nn;
  const tx = k.vx + gx * vn;
  const ty = k.vy - vn;
  const tz = k.vz + gz * vn;
  const vel = Math.sqrt(tx * tx + ty * ty + tz * tz);
  const h = Math.sqrt(tx * tx + tz * tz);
  let rx = k.rx;
  let rz = k.rz;
  if (h > 0.05) {
    rx = tx / h;
    rz = tz / h;
  }
  // pousou torto (nem de frente, nem de costas) ou com o flip pela metade: caiu
  const alinhado = Math.abs(k.cx * rx + k.cz * rz);
  if (k.flip > FLIP_TOLERANCIA || (vel > 0.3 && alinhado < POUSO_ALINHADO)) {
    k.rx = rx;
    k.rz = rz;
    k.vel = vel * 0.5;
    cair(k);
    return;
  }
  // de costas: o coelho troca de base
  if (k.cx * rx + k.cz * rz < 0) k.base = -k.base;
  fecharAr(k);
  k.rx = rx;
  k.rz = rz;
  k.cx = rx;
  k.cz = rz;
  // o choque do pouso come um tico (sem isso, cair mais baixo do que saiu no quarter dava velocidade de graça)
  k.vel = Math.min(VEL_MAX, vel * 0.95);
  k.flip = 0;
  k.eventos.push({ tipo: 'pouso' });
  if (k.manualArmado && k.combo.length) {
    k.modo = 'manual';
    k.equilibrio = 0;
    k.deriva = 0;
    k.duracao = 0;
  } else {
    k.modo = 'chao';
    k.desdePouso = 0;
  }
  k.manualArmado = false;
  k.carga = 0;
}

/** As manobras em andamento, como o placar as mostra (o grind e o manual valendo o que já valem). */
export function comboAberto(k: Skatista): Manobra[] {
  const extra: Manobra[] = [];
  if (k.modo === 'grind') {
    const nome = TRILHOS[k.trilho].nome;
    extra.push({ nome, pontos: valorBase(nome, k.duracao * PASSO) });
  }
  if (k.modo === 'manual') extra.push({ nome: 'Manual', pontos: valorBase('Manual', k.duracao * PASSO) });
  if (k.modo === 'ar' && k.grab >= 6) extra.push({ nome: 'Grab', pontos: valorBase('Grab', k.grab * PASSO) });
  return [...k.combo, ...extra];
}
