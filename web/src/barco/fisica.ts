import { naLinha, pontoMaisPerto, pontoNaLinha, type PistaDoBarco } from './pista';

/**
 * A FÍSICA DA REGATA DA TOCA (05/11/2026): o que faz ser barco, e não kart, é a INÉRCIA DA ÁGUA. O barco tem velocidade
 * própria (um vetor), e o motor só empurra para onde o nariz aponta: virar muda o nariz, e a velocidade vem atrás, devagar.
 * A água segura pouco para a frente e mais de lado (a quilha), então a curva rápida demais DERRAPA, o barco escorrega para
 * fora e bate na margem, que freia e empurra de volta. O giro também tem inércia: o barco demora a começar e a parar de virar.
 *
 * A CORRENTEZA é a água andando: o arrasto age sobre a velocidade DO BARCO EM RELAÇÃO À ÁGUA, então ela leva o barco junto,
 * a favor ou contra a corrida, e também de lado numa curva. As BOIAS DE TURBO são argolas na água: passar por dentro dá um
 * empurrão de um segundo.
 *
 * Como no kart e no jato, o passo é FIXO (60 por segundo) e o tempo é o número de passos. O fantasma guarda as POSIÇÕES, uma
 * a cada 4 passos, no mesmo formato do kart (x e y em décimos, o ângulo em milésimos): o servidor confere como confere o do
 * kart (server/src/barco.ts). A física roda só no computador de quem joga: as contas não precisam ser iguais em todo lugar.
 */

export const PASSO = 1 / 60;
export const AMOSTRA = 4;
/** O empurrão do motor e o arrasto para a frente: a velocidade de cruzeiro é EMPUXO / ARRASTO (~167); o barco demora a pegar velocidade e demora a perder. */
export const EMPUXO = 150;
export const ARRASTO = 0.9;
/** O arrasto de lado (a quilha): bem maior que o da frente, mas não infinito como o pneu. É ele que deixa derrapar. */
export const ARRASTO_DE_LADO = 3.2;
/** O turbo da boia: o motor empurra o dobro por este tempo (s). */
export const TEMPO_DO_TURBO = 1;
export const VCRUZEIRO = EMPUXO / ARRASTO;
export const VTURBO = (2 * EMPUXO) / ARRASTO;
/** O quanto o barco vira por segundo, a toda (com a inércia do giro). */
export const GIRO = 2.2;
/** O raio da argola de turbo (passar a menos disto do meio dela vale). */
export const RAIO_DA_ARGOLA = 11;
/** O raio do barco contra a margem. */
const RAIO = 6;
/** Acima desta velocidade de lado, o barco está derrapando (a espuma e o som). */
export const DERRAPA = 42;

export interface ComandosDoBarco {
  acelera: boolean;
  freia: boolean;
  /** −1 esquerda, 0, 1 direita. */
  vira: number;
}

export interface Barco {
  x: number;
  y: number;
  /** A velocidade, no mundo. */
  vx: number;
  vy: number;
  /** Para onde o nariz aponta. */
  angulo: number;
  /** O quanto ele está virando agora (rad/s). */
  giro: number;
  /** Turbo que falta (s). */
  turbo: number;
  /** O balanço para o lado (−1 a 1), para o desenho: a derrapagem e a curva. */
  banco: number;
  indice: number;
  volta: number;
  meio: boolean;
  voltas: number[];
  passos: number;
  terminou: boolean;
  /** Neste passo: bateu na margem / pegou uma boia / completou uma volta. */
  bateu: boolean;
  boia: boolean;
  fezVolta: boolean;
  encostado: boolean;
  /** A velocidade de lado em relação à água (para a espuma da derrapagem). */
  lateral: number;
  /** A velocidade para a frente em relação à água. */
  frente: number;
}

export function novoBarco(p: PistaDoBarco): Barco {
  const { x, y, angulo, indice } = p.largada;
  return {
    x, y, vx: 0, vy: 0, angulo, giro: 0, turbo: 0, banco: 0, indice, volta: 0, meio: false, voltas: [], passos: 0, terminou: false,
    bateu: false, boia: false, fezVolta: false, encostado: false, lateral: 0, frente: 0,
  };
}

export const normal = (a: number) => {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
};

/** A velocidade no chão (o tamanho do vetor). */
export const rapidez = (b: Barco) => Math.hypot(b.vx, b.vy);

export function passo(b: Barco, c: ComandosDoBarco, p: PistaDoBarco): void {
  const dt = PASSO;
  b.bateu = false;
  b.boia = false;
  b.fezVolta = false;
  // depois da chegada, o barco vai parando sozinho
  if (b.terminou) c = { acelera: false, freia: false, vira: 0 };
  b.passos++;

  const aqui = naLinha(p, b.x, b.y, b.indice);
  // A BOIA DE TURBO: passar por dentro da argola
  for (const a of p.argolas) {
    const dx = b.x - a.x, dy = b.y - a.y;
    if (dx * dx + dy * dy < RAIO_DA_ARGOLA * RAIO_DA_ARGOLA) {
      if (b.turbo < TEMPO_DO_TURBO * 0.5) b.boia = true;
      b.turbo = Math.max(b.turbo, TEMPO_DO_TURBO);
    }
  }

  // A ÁGUA ANDANDO: a correnteza ao longo da pista, ali
  const corr = p.correnteza[aqui.indice];
  const ax = aqui.dx * corr, ay = aqui.dy * corr;
  // a velocidade em relação à água, de frente e de lado
  const ca = Math.cos(b.angulo), sa = Math.sin(b.angulo);
  const rx = b.vx - ax, ry = b.vy - ay;
  let vf = rx * ca + ry * sa;
  let vl = -rx * sa + ry * ca;
  const empuxo = b.turbo > 0 ? 2 * EMPUXO : EMPUXO;
  if (b.turbo > 0) b.turbo = Math.max(0, b.turbo - dt);
  if (c.acelera && !c.freia) vf += empuxo * dt;
  else if (c.freia) vf -= (vf > 0 ? 260 : 80) * dt;
  // o arrasto: pouco para a frente, mais de lado; a ré é lenta
  vf -= vf * ARRASTO * dt;
  if (vf < -50) vf = -50;
  vl -= vl * ARRASTO_DE_LADO * dt;
  b.frente = vf;
  b.lateral = vl;
  b.vx = ax + vf * ca - vl * sa;
  b.vy = ay + vf * sa + vl * ca;

  // O GIRO, com inércia: parado, o barco vira devagar (o remo); de ré, o leme vira ao contrário
  const forca = Math.min(1, (Math.abs(vf) + 18) / 80);
  const alvo = c.vira * GIRO * forca * (vf < -5 ? -1 : 1);
  b.giro += (alvo - b.giro) * Math.min(1, 5 * dt);
  b.angulo = normal(b.angulo + b.giro * dt);
  b.banco += (Math.max(-1, Math.min(1, -vl / 70 + c.vira * 0.35)) - b.banco) * Math.min(1, 6 * dt);

  // ANDAR
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.indice = pontoMaisPerto(p, b.x, b.y, b.indice);
  const l = naLinha(p, b.x, b.y, b.indice);
  const hw = p.def.meiaLargura;
  if (Math.abs(l.lado) > hw - RAIO) {
    // A MARGEM: devolve o barco para dentro, rebate a parte da velocidade que ia para fora, e freia o resto
    const sinal = Math.sign(l.lado);
    const fora = Math.abs(l.lado) - (hw - RAIO);
    const nx = -l.dy * sinal, ny = l.dx * sinal;
    b.x -= nx * fora;
    b.y -= ny * fora;
    const vn = b.vx * nx + b.vy * ny;
    if (vn > 0) {
      const tx = b.vx - nx * vn, ty = b.vy - ny * vn;
      // o que ia para fora volta com um terço; o que ia ao longo da margem perde um pouco (o atrito na terra)
      b.vx = tx * 0.86 - nx * vn * 0.35;
      b.vy = ty * 0.86 - ny * vn * 0.35;
      b.giro *= 0.5;
      b.bateu = !b.encostado && vn > 14;
    }
    b.encostado = true;
  } else b.encostado = false;

  // A VOLTA: a linha de chegada é o ponto 0 da linha do meio; conta quando o barco passa por ela para a frente, tendo
  // passado pela metade da pista (a mesma regra do kart e do jato)
  const total = p.lx.length;
  if (b.indice > total * 0.4 && b.indice < total * 0.6) b.meio = true;
  const agoraS = p.la[b.indice];
  if (aqui.s > p.comprimento * 0.8 && agoraS < p.comprimento * 0.2 && b.meio && !b.terminou) {
    b.volta++;
    b.meio = false;
    b.voltas.push(b.passos);
    b.fezVolta = true;
    if (b.volta >= p.def.voltas) b.terminou = true;
  }
}

/** A posição na corrida: voltas completas mais a fração da volta (negativa antes da primeira passagem pela linha). */
export const progresso = (b: Barco, p: PistaDoBarco) => {
  const f = p.la[b.indice] / p.comprimento;
  return b.volta + (b.volta === 0 && !b.meio && f > 0.5 ? f - 1 : f);
};

/** O fantasma: x, y (em décimos) e o ângulo (em milésimos de radiano), um trio a cada AMOSTRA passos. */
export function amostrar(b: Barco, fantasma: number[]) {
  if ((b.passos - 1) % AMOSTRA === 0) fantasma.push(Math.round(b.x * 10), Math.round(b.y * 10), Math.round(b.angulo * 1000));
}

/**
 * O PILOTO AUTOMÁTICO (testes e e2e, nunca quem joga): mira um ponto da linha do meio à frente, e aponta o nariz além dele
 * o quanto a velocidade está escorregando (é o contraesterço de quem pilota barco); tira o pé antes das curvas fechadas,
 * pela curvatura, e passa pelas boias de turbo quando elas estão perto do caminho.
 */
export function pilotoAutomatico(b: Barco, p: PistaDoBarco): ComandosDoBarco {
  const total = p.lx.length;
  const aqui = naLinha(p, b.x, b.y, b.indice);
  const v = rapidez(b);
  let alvoLado = 0;
  // a boia de turbo que vem logo à frente puxa a mira para o lado dela
  for (const [f, lado] of p.def.boias) {
    const ds = (((f * p.comprimento - aqui.s) % p.comprimento) + p.comprimento) % p.comprimento;
    if (ds < 110) alvoLado = lado * p.def.meiaLargura;
  }
  const q = pontoNaLinha(p, aqui.s + 22 + v * 0.3);
  const mx = q.x - q.dy * alvoLado, my = q.y + q.dx * alvoLado;
  const desejado = Math.atan2(my - b.y, mx - b.x);
  const rumo = v > 20 ? Math.atan2(b.vy, b.vx) : b.angulo;
  // o nariz vai além do alvo o quanto o rumo ficou para trás
  const nariz = desejado + Math.max(-0.7, Math.min(0.7, normal(desejado - rumo) * 1.1));
  const dif = normal(nariz - b.angulo);
  let kmax = 0;
  for (let k = 0; k < 14 + v / 5; k += 2) kmax = Math.max(kmax, p.curva[(b.indice + k) % total]);
  const limite = kmax > 0 ? GIRO / kmax : 999;
  return {
    acelera: v < limite,
    freia: v > limite * 1.35,
    vira: Math.max(-1, Math.min(1, dif / 0.12)),
  };
}
