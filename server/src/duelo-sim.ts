/**
 * O DUELO DE AVIÕEZINHOS: AS CONTAS QUE O SITE E O SERVIDOR FAZEM IGUAIS (05/11/2026). Este arquivo tem DUAS CÓPIAS IGUAIS
 * BYTE A BYTE: server/src/duelo-sim.ts e web/src/duelo/sim.ts (o teste do servidor confere). Mudou um, copie sobre o outro.
 *
 * O que mora aqui: a ARENA (a horta vista de cima, um retângulo fechado), o voo do teco-teco (acelera, freia e vira), a
 * ERVILHA (o tiro reto, lento e gordo), a CENOURA TELEGUIADA (o míssil, que persegue o alvo pelas AMOSTRAS que o alvo mandou)
 * e a CURVA FECHADA NA BORDA, que protege por um instante.
 *
 * AS AMOSTRAS: cada avião manda a posição a cada 4 passos (n, x, y e a direção hx, hy, arredondados), e é com elas, e só com
 * elas, que a cenoura teleguiada se guia. Por isso o caminho dela é o MESMO em todo computador que tem as mesmas amostras: no
 * do alvo (que as mandou), no do servidor (que as aceitou e repassou) e no de quem assiste (que as recebeu).
 *
 * DETERMINISMO: só + − × ÷ e Math.sqrt, sem seno nem cosseno. O avião vira por uma rotação de seno e cosseno já escritos em
 * número, e a direção vai sempre como um vetor (hx, hy), nunca como um ângulo.
 */

/** O relógio da partida: 60 passos por segundo, contados desde o sinal verde (o mesmo para todos). */
export const PASSOS_POR_SEGUNDO = 60;
/** Cada um aguenta dois acertos, e cai no terceiro. */
export const VIDAS = 3;
/** A partida dura 75 s; acabando o tempo, ganha quem tem mais vida. */
export const DURACAO_PASSOS = 75 * PASSOS_POR_SEGUNDO;
/** Depois de um acerto, 2 s sem levar outro (a mesma rajada não derruba de uma vez). */
export const INVULNERAVEL = 120;
/** As amostras: uma a cada isto. */
export const PASSOS_POR_AMOSTRA = 4;

/** A tela e a arena (em pixels da tela): a cerca da horta em volta. */
export const LARGURA = 320;
export const ALTURA = 240;
export const ARENA: readonly [number, number, number, number] = [14, 14, 306, 226];
/** O raio do avião contra a cerca. */
export const RAIO_DO_AVIAO = 6;

/** O VOO: a velocidade (pixels por segundo) freando, sem nada e acelerando; e o quanto ela muda por passo. */
export const VEL_MIN = 55;
export const VEL_CRUZEIRO = 85;
export const VEL_MAX = 120;
const ACELERACAO = 1.5;
/** A virada por passo: cos e sen de 0,05 rad (3 rad/s) e, freando, de 0,075 rad (4,5 rad/s). */
const GIRO_C = 0.99875026;
const GIRO_S = 0.04997917;
const GIRO_FECHADO_C = 0.99718882;
const GIRO_FECHADO_S = 0.07492971;
/** A virada mais rápida, em radianos por passo (o servidor confere as amostras contra ela). */
export const GIRO_MAXIMO = 0.075;

/** A ERVILHA: sai a 150 por segundo, vive 1,4 s, e pega a menos de 5 do centro do avião. Uma a cada 24 passos. */
export const VEL_DA_ERVILHA = 150;
export const VIDA_DA_ERVILHA = 84;
export const RAIO_DA_ERVILHA = 5;
export const RECARGA_DA_ERVILHA = 24;
/** No primeiro segundo e meio, ninguém atira (cada um acha o próprio avião na tela). */
export const SEM_TIRO = 90;

/**
 * A CENOURA TELEGUIADA: segurar o tiro por 0,5 s (CARGA) e soltar. Anda a 100 por segundo (mais que o cruzeiro, menos que o
 * avião acelerando), vira até ~2,4 rad/s (o avião freando vira mais: é assim que se escapa), vive 5 s e quebra na cerca. Os
 * primeiros 12 passos saem retos, sem se guiar.
 */
export const CARGA = 30;
export const VEL_DO_MISSIL = 100;
export const VIDA_DO_MISSIL = 300;
export const ARMANDO = 12;
const GUIA = 0.04;
export const RAIO_DO_MISSIL = 8;

/** A CURVA FECHADA NA BORDA: perto da cerca (16), virar 60° ou mais em até 24 passos protege por 30 passos (0,5 s). */
export const BORDA = 16;
export const JANELA_DA_MANOBRA = 24;
export const PROTECAO = 30;
const VIROU = 0.5;

/** As seis largadas (x, y): a direção é de lado para o centro da arena. */
export const LARGADAS: readonly (readonly [number, number])[] = [
  [56, 56],
  [264, 184],
  [264, 56],
  [56, 184],
  [160, 40],
  [160, 200],
];

export interface Aviao {
  x: number;
  y: number;
  /** A direção, um vetor de tamanho 1. */
  hx: number;
  hy: number;
  /** A velocidade, em pixels por segundo. */
  v: number;
}

export interface Manche {
  acelera: boolean;
  freia: boolean;
  /** −1 vira para a esquerda (anti-horário na tela), 1 para a direita, 0 segue. */
  vira: number;
}

/** O avião na largada `i`, de lado para o centro. */
export function largada(i: number): Aviao {
  const [x, y] = LARGADAS[((i % LARGADAS.length) + LARGADAS.length) % LARGADAS.length];
  const cx = (ARENA[0] + ARENA[2]) / 2, cy = (ARENA[1] + ARENA[3]) / 2;
  const dx = cx - x, dy = cy - y, d = Math.sqrt(dx * dx + dy * dy);
  // de lado para o centro (girando em volta dele), e não de frente: senão a partida começaria com todo mundo trocando tiros
  return { x, y, hx: -dy / d, hy: dx / d, v: VEL_CRUZEIRO };
}

/** Um passo de voo (1/60 s). Bateu na cerca, o avião quica (a direção reflete), e devolve true. */
export function voar(a: Aviao, c: Manche): boolean {
  const alvo = c.acelera && !c.freia ? VEL_MAX : c.freia ? VEL_MIN : VEL_CRUZEIRO;
  a.v = a.v < alvo ? Math.min(alvo, a.v + ACELERACAO) : Math.max(alvo, a.v - ACELERACAO);
  const lado = c.vira > 0 ? 1 : c.vira < 0 ? -1 : 0;
  if (lado !== 0) {
    const co = c.freia ? GIRO_FECHADO_C : GIRO_C;
    const se = (c.freia ? GIRO_FECHADO_S : GIRO_S) * lado;
    const hx = a.hx * co - a.hy * se;
    const hy = a.hx * se + a.hy * co;
    a.hx = hx;
    a.hy = hy;
  }
  const t = Math.sqrt(a.hx * a.hx + a.hy * a.hy) || 1;
  a.hx /= t;
  a.hy /= t;
  a.x += (a.hx * a.v) / PASSOS_POR_SEGUNDO;
  a.y += (a.hy * a.v) / PASSOS_POR_SEGUNDO;
  const [x0, y0, x1, y1] = ARENA;
  const r = RAIO_DO_AVIAO;
  let bateu = false;
  if (a.x < x0 + r) { a.x = 2 * (x0 + r) - a.x; a.hx = a.hx < 0 ? -a.hx : a.hx; bateu = true; }
  if (a.x > x1 - r) { a.x = 2 * (x1 - r) - a.x; a.hx = a.hx > 0 ? -a.hx : a.hx; bateu = true; }
  if (a.y < y0 + r) { a.y = 2 * (y0 + r) - a.y; a.hy = a.hy < 0 ? -a.hy : a.hy; bateu = true; }
  if (a.y > y1 - r) { a.y = 2 * (y1 - r) - a.y; a.hy = a.hy > 0 ? -a.hy : a.hy; bateu = true; }
  return bateu;
}

/** O ponto está dentro da arena (`folga` > 0 aceita um pouco fora)? */
export function naArena(x: number, y: number, folga = 0): boolean {
  return x >= ARENA[0] - folga && x <= ARENA[2] + folga && y >= ARENA[1] - folga && y <= ARENA[3] + folga;
}

/** Perto da cerca (para a curva fechada). */
export function naBorda(x: number, y: number): boolean {
  return x < ARENA[0] + BORDA || x > ARENA[2] - BORDA || y < ARENA[1] + BORDA || y > ARENA[3] - BORDA;
}

/** Arredonda a amostra como ela vai pela rede (assim quem manda guarda o mesmo número que quem recebe). */
export const umaCasa = (v: number) => Math.round(v * 10) / 10;
export const tresCasas = (v: number) => Math.round(v * 1000) / 1000;

/** Um tiro: onde saiu, para onde (o vetor é normalizado aqui) e no passo `n` de quem atirou. */
export interface Tiro {
  n: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
}

/** A cenoura teleguiada: um tiro com o alvo. */
export interface Missil extends Tiro {
  alvo: number;
}

/** Onde está a ervilha no passo `m` (null antes de sair, depois de acabar ou fora da cerca). */
export function ervilhaNoPasso(t: Tiro, m: number): [number, number] | null {
  const k = m - t.n;
  if (k < 0 || k > VIDA_DA_ERVILHA) return null;
  const tam = Math.sqrt(t.dx * t.dx + t.dy * t.dy);
  if (!(tam > 1e-6)) return null;
  const passo = (VEL_DA_ERVILHA / PASSOS_POR_SEGUNDO) * k;
  const x = t.x + (t.dx / tam) * passo, y = t.y + (t.dy / tam) * passo;
  if (!naArena(x, y)) return null;
  return [x, y];
}

/**
 * O CAMINHO DA CENOURA TELEGUIADA, do passo `m.n` até `ate` (no máximo a vida dela): x, y de cada passo, o índice k sendo o
 * passo m.n + k. No passo s, ela vira para a última amostra do alvo com passo até s − 1 (`amostras` = n, x, y, hx, hy, em
 * ordem); sem amostra, segue reta. Saindo da cerca, quebra, e o caminho acaba ali. Null se a direção não for um vetor.
 */
export function caminhoDoMissil(m: Missil, amostras: readonly number[], ate: number): number[] | null {
  const tam = Math.sqrt(m.dx * m.dx + m.dy * m.dy);
  if (!(tam > 1e-6)) return null;
  let dx = m.dx / tam, dy = m.dy / tam;
  let x = m.x, y = m.y;
  const v = VEL_DO_MISSIL / PASSOS_POR_SEGUNDO;
  const caminho: number[] = [x, y];
  const fim = Math.min(ate, m.n + VIDA_DO_MISSIL);
  let j = -5;
  for (let s = m.n + 1; s <= fim; s++) {
    if (s - m.n > ARMANDO) {
      while (j + 5 < amostras.length && amostras[j + 5] <= s - 1) j += 5;
      if (j >= 0) {
        const tx = amostras[j + 1] - x, ty = amostras[j + 2] - y;
        const d = Math.sqrt(tx * tx + ty * ty);
        if (d > 1e-6) {
          const nx = dx + (GUIA * tx) / d, ny = dy + (GUIA * ty) / d;
          const nt = Math.sqrt(nx * nx + ny * ny);
          if (nt > 1e-6) {
            dx = nx / nt;
            dy = ny / nt;
          }
        }
      }
    }
    x += dx * v;
    y += dy * v;
    if (!naArena(x, y)) break;
    caminho.push(x, y);
  }
  return caminho;
}

/** Onde está o que segue este caminho (que saiu no passo `n`) no passo `m`: null antes de sair ou depois de acabar. */
export function noCaminho(caminho: readonly number[], n: number, m: number): [number, number] | null {
  const k = m - n;
  if (k < 0 || 2 * k + 1 >= caminho.length) return null;
  return [caminho[2 * k], caminho[2 * k + 1]];
}

/**
 * PROTEGIDO PELA CURVA FECHADA NA BORDA no passo `s`? Pelas amostras do próprio avião: duas, `a` e `b`, com b até s e nos
 * últimos PROTECAO passos, a no máximo JANELA_DA_MANOBRA antes de b, as duas perto da cerca, e a direção virou 60° ou mais.
 */
export function protegido(amostras: readonly number[], s: number): boolean {
  for (let b = amostras.length - 5; b >= 0; b -= 5) {
    const nb = amostras[b];
    if (nb > s) continue;
    if (nb <= s - PROTECAO) return false;
    if (!naBorda(amostras[b + 1], amostras[b + 2])) continue;
    for (let a = b - 5; a >= 0; a -= 5) {
      if (nb - amostras[a] > JANELA_DA_MANOBRA) break;
      if (!naBorda(amostras[a + 1], amostras[a + 2])) continue;
      if (amostras[a + 3] * amostras[b + 3] + amostras[a + 4] * amostras[b + 4] <= VIROU) return true;
    }
  }
  return false;
}

/** A última amostra com passo até `s` (o índice dela na lista), ou −1. */
export function amostraAte(amostras: readonly number[], s: number): number {
  for (let b = amostras.length - 5; b >= 0; b -= 5) if (amostras[b] <= s) return b;
  return -1;
}
