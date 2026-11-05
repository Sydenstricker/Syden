/**
 * O ESTOURA-BALÃO: AS CONTAS QUE O SITE E O SERVIDOR FAZEM IGUAIS (05/11/2026). Este arquivo tem DUAS CÓPIAS IGUAIS BYTE A
 * BYTE: server/src/balao-sim.ts e web/src/balao/sim.ts (o teste do servidor confere). Mudou um, copie sobre o outro.
 *
 * O que mora aqui: as ARENAS (a forma, os obstáculos, as caixas e as largadas, em números: o site pinta o chão a partir
 * delas, e o servidor sabe onde há parede sem conhecer a textura), o caminho do REPOLHO (anda em linha reta e quica nas
 * paredes), o sorteio do item de cada caixa, e o "pegou?" de cada item.
 *
 * DETERMINISMO: só + − × ÷ e Math.sqrt, sem seno nem cosseno, para os dois lados chegarem ao mesmo número em qualquer
 * computador. A direção do repolho vai como um vetor (dx, dy), e não como um ângulo.
 */

/** O relógio da partida: 60 passos por segundo, contados desde o sinal verde (o mesmo para todos). */
export const PASSOS_POR_SEGUNDO = 60;
/** Quantos balões cada um tem na largada. */
export const BALOES = 3;
/** A partida dura 2 min 30 s; acabando o tempo, ganha quem tem mais balões. */
export const DURACAO_PASSOS = 150 * PASSOS_POR_SEGUNDO;
/** Depois de perder um balão, 2 s sem perder outro (a mesma lama não leva os três). */
export const INVULNERAVEL = 2 * PASSOS_POR_SEGUNDO;

/** O repolho: anda 210 por segundo, por 4 s, e quica em até 3 paredes; quebra na quarta. */
export const VELOCIDADE_DO_REPOLHO = 210;
export const VIDA_DO_REPOLHO = 4 * PASSOS_POR_SEGUNDO;
export const QUIQUES = 3;
/** O raio do repolho contra a parede. */
const RAIO_DO_REPOLHO_NA_PAREDE = 4;
/** A lama fica 20 s onde caiu. O escudo de alface, 10 s (ou até segurar um item). */
export const VIDA_DA_LAMA = 20 * PASSOS_POR_SEGUNDO;
export const VIDA_DA_ALFACE = 10 * PASSOS_POR_SEGUNDO;
/** A que distância do centro do kart o item pega. */
export const RAIO_DO_REPOLHO = 10;
export const RAIO_DA_LAMA = 9;
/** A caixa: pega-se passando a menos disto, e ela volta (para quem pegou) 6 s depois. */
export const RAIO_DA_CAIXA = 12;
export const VOLTA_DA_CAIXA = 6 * PASSOS_POR_SEGUNDO;

export type ItemDoBalao = 'cenoura' | 'repolho' | 'lama' | 'alface';
export const ITENS_DO_BALAO: readonly ItemDoBalao[] = ['cenoura', 'repolho', 'lama', 'alface'];

/** Um obstáculo redondo: x, y, raio e o que é (o desenho). */
export type Circulo = [number, number, number, 'pedra' | 'arvore' | 'agua' | 'canteiro'];
/** Um obstáculo retangular (alinhado aos eixos): x0, y0, x1, y1 e o que é. */
export type Muro = [number, number, number, number, 'feno' | 'caixote'];
/** Uma mancha no chão, que não bloqueia: grama (segura), gelo (escorrega), turbo. */
export type Mancha = [number, number, number, 'grama' | 'gelo' | 'turbo'];

export interface Arena {
  id: string;
  /** A borda: um retângulo [x0, y0, x1, y1] ou um círculo [cx, cy, r]. */
  retangulo: [number, number, number, number] | null;
  circulo: [number, number, number] | null;
  circulos: Circulo[];
  muros: Muro[];
  manchas: Mancha[];
  /** Oito largadas: x, y (a direção é para o centro da arena). */
  largadas: [number, number][];
  caixas: [number, number][];
}

export const ARENAS: Arena[] = [
  {
    // A HORTA: uma quadra de terra batida, com o canteiro no meio, os fardos de feno e as árvores dos cantos
    id: 'horta',
    retangulo: [212, 212, 812, 812],
    circulo: null,
    circulos: [
      [512, 512, 42, 'canteiro'],
      [300, 300, 9, 'arvore'],
      [724, 300, 9, 'arvore'],
      [300, 724, 9, 'arvore'],
      [724, 724, 9, 'arvore'],
      [512, 300, 14, 'pedra'],
      [512, 724, 14, 'pedra'],
    ],
    muros: [
      [380, 420, 420, 450, 'feno'],
      [604, 420, 644, 450, 'feno'],
      [380, 574, 420, 604, 'feno'],
      [604, 574, 644, 604, 'feno'],
    ],
    manchas: [
      [300, 512, 34, 'grama'],
      [724, 512, 34, 'grama'],
      [512, 400, 12, 'turbo'],
      [512, 624, 12, 'turbo'],
    ],
    largadas: [
      [262, 262], [762, 762], [762, 262], [262, 762], [512, 252], [512, 772], [252, 512], [772, 512],
    ],
    caixas: [
      [420, 512], [604, 512], [512, 360], [512, 664], [350, 380], [674, 644], [674, 380], [350, 644],
    ],
  },
  {
    // A PRAIA: redonda, com a lagoa no meio, coqueiros e pedras
    id: 'praia',
    retangulo: null,
    circulo: [512, 512, 330],
    circulos: [
      [512, 512, 48, 'agua'],
      [380, 400, 9, 'arvore'],
      [650, 620, 9, 'arvore'],
      [640, 380, 9, 'arvore'],
      [390, 640, 9, 'arvore'],
      [512, 330, 16, 'pedra'],
      [512, 700, 16, 'pedra'],
      [330, 512, 16, 'pedra'],
      [700, 512, 16, 'pedra'],
    ],
    muros: [
      [588, 268, 618, 298, 'caixote'],
      [406, 726, 436, 756, 'caixote'],
    ],
    manchas: [
      [430, 512, 22, 'turbo'],
      [594, 512, 22, 'turbo'],
    ],
    largadas: [
      [512, 222], [512, 802], [222, 512], [802, 512], [307, 307], [717, 717], [717, 307], [307, 717],
    ],
    caixas: [
      [512, 420], [512, 604], [420, 512], [604, 512], [400, 300], [624, 724], [724, 400], [300, 624],
    ],
  },
  {
    // A NEVE: comprida, com a pista de gelo no meio, pinheiros e pedras, e caixotes fazendo corredores
    id: 'neve',
    retangulo: [172, 252, 852, 772],
    circulo: null,
    circulos: [
      [260, 340, 9, 'arvore'],
      [764, 340, 9, 'arvore'],
      [260, 684, 9, 'arvore'],
      [764, 684, 9, 'arvore'],
      [400, 512, 18, 'pedra'],
      [624, 512, 18, 'pedra'],
    ],
    muros: [
      [492, 300, 532, 360, 'caixote'],
      [492, 664, 532, 724, 'caixote'],
      [300, 470, 330, 554, 'feno'],
      [694, 470, 724, 554, 'feno'],
    ],
    manchas: [
      [512, 512, 90, 'gelo'],
      [512, 290, 10, 'turbo'],
      [512, 734, 10, 'turbo'],
    ],
    largadas: [
      [222, 302], [802, 722], [802, 302], [222, 722], [380, 302], [644, 722], [644, 302], [380, 722],
    ],
    caixas: [
      [512, 420], [512, 604], [360, 400], [664, 624], [664, 400], [360, 624], [240, 512], [784, 512],
    ],
  },
];

export const arenaPorId = (id: string): Arena => ARENAS.find((a) => a.id === id) ?? ARENAS[0];

/** O centro da arena (para onde as largadas olham). */
export function centroDa(a: Arena): [number, number] {
  if (a.circulo) return [a.circulo[0], a.circulo[1]];
  const r = a.retangulo!;
  return [(r[0] + r[2]) / 2, (r[1] + r[3]) / 2];
}

/**
 * O ponto está dentro de uma parede (fora da borda, ou dentro de um obstáculo)? `folga` > 0 encolhe as paredes (o servidor
 * aceita a posição um pouco dentro, pelo arredondamento da textura do site); < 0 as engorda (o repolho tem tamanho).
 */
export function naParede(a: Arena, x: number, y: number, folga = 0): boolean {
  if (a.retangulo) {
    const [x0, y0, x1, y1] = a.retangulo;
    if (x < x0 - folga || y < y0 - folga || x > x1 + folga || y > y1 + folga) return true;
  } else if (a.circulo) {
    const [cx, cy, r] = a.circulo;
    const dx = x - cx, dy = y - cy, rr = r + folga;
    if (dx * dx + dy * dy > rr * rr) return true;
  }
  for (const [cx, cy, r] of a.circulos) {
    const dx = x - cx, dy = y - cy, rr = r - folga;
    if (rr > 0 && dx * dx + dy * dy < rr * rr) return true;
  }
  for (const [x0, y0, x1, y1] of a.muros) {
    if (x > x0 + folga && x < x1 - folga && y > y0 + folga && y < y1 - folga) return true;
  }
  return false;
}

/** Um repolho: onde saiu, para onde (o vetor é normalizado aqui) e no passo `n` de quem o soltou. */
export interface Lancamento {
  n: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
}

/**
 * O CAMINHO DO REPOLHO, passo a passo desde o lançamento: x, y de cada passo (o índice k é o passo n + k). Anda em linha reta
 * e quica nas paredes (a borda e os obstáculos); na parede de número QUIQUES + 1, quebra, e o caminho acaba ali. Devolve null
 * se a direção não for um vetor de verdade.
 */
export function caminhoDoRepolho(a: Arena, l: Lancamento): number[] | null {
  const tam = Math.sqrt(l.dx * l.dx + l.dy * l.dy);
  if (!(tam > 1e-6)) return null;
  const v = VELOCIDADE_DO_REPOLHO / PASSOS_POR_SEGUNDO;
  let vx = (l.dx / tam) * v, vy = (l.dy / tam) * v;
  let x = l.x, y = l.y;
  let quiques = 0;
  const m = RAIO_DO_REPOLHO_NA_PAREDE;
  const caminho: number[] = [x, y];
  for (let k = 1; k <= VIDA_DO_REPOLHO; k++) {
    x += vx;
    y += vy;
    let bateu = false;
    // a borda
    if (a.retangulo) {
      const [x0, y0, x1, y1] = a.retangulo;
      if (x < x0 + m) { x = 2 * (x0 + m) - x; vx = -vx; bateu = true; }
      if (x > x1 - m) { x = 2 * (x1 - m) - x; vx = -vx; bateu = true; }
      if (y < y0 + m) { y = 2 * (y0 + m) - y; vy = -vy; bateu = true; }
      if (y > y1 - m) { y = 2 * (y1 - m) - y; vy = -vy; bateu = true; }
    } else if (a.circulo) {
      const [cx, cy, r] = a.circulo;
      const dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy), lim = r - m;
      if (d > lim) {
        const nx = dx / d, ny = dy / d;
        const pv = vx * nx + vy * ny;
        vx -= 2 * pv * nx;
        vy -= 2 * pv * ny;
        x = cx + nx * (2 * lim - d);
        y = cy + ny * (2 * lim - d);
        bateu = true;
      }
    }
    // os obstáculos redondos: reflete na normal e sai para fora
    for (const [cx, cy, r] of a.circulos) {
      const dx = x - cx, dy = y - cy, lim = r + m, d2 = dx * dx + dy * dy;
      if (d2 >= lim * lim) continue;
      const d = Math.sqrt(d2) || 1e-6, nx = dx / d, ny = dy / d;
      const pv = vx * nx + vy * ny;
      if (pv < 0) {
        vx -= 2 * pv * nx;
        vy -= 2 * pv * ny;
      }
      x = cx + nx * lim;
      y = cy + ny * lim;
      bateu = true;
    }
    // os muros: o lado em que entrou menos é o que bate
    for (const [x0, y0, x1, y1] of a.muros) {
      if (x <= x0 - m || x >= x1 + m || y <= y0 - m || y >= y1 + m) continue;
      const esq = x - (x0 - m), dir = x1 + m - x, cima = y - (y0 - m), baixo = y1 + m - y;
      const menor = Math.min(esq, dir, cima, baixo);
      if (menor === esq) { x = x0 - m; vx = -Math.abs(vx); }
      else if (menor === dir) { x = x1 + m; vx = Math.abs(vx); }
      else if (menor === cima) { y = y0 - m; vy = -Math.abs(vy); }
      else { y = y1 + m; vy = Math.abs(vy); }
      bateu = true;
    }
    if (bateu && ++quiques > QUIQUES) break;
    caminho.push(x, y);
  }
  return caminho;
}

/** Onde está o repolho no passo `m` (null antes de sair ou depois de acabar). */
export function repolhoNoPasso(caminho: number[], n: number, m: number): [number, number] | null {
  const k = m - n;
  if (k < 0 || 2 * k + 1 >= caminho.length) return null;
  return [caminho[2 * k], caminho[2 * k + 1]];
}

/** O kart em (x, y) no passo `m` foi pego por este repolho? */
export function repolhoPegou(caminho: number[], n: number, m: number, x: number, y: number, raio = RAIO_DO_REPOLHO): boolean {
  const p = repolhoNoPasso(caminho, n, m);
  if (!p) return false;
  const dx = p[0] - x, dy = p[1] - y;
  return dx * dx + dy * dy < raio * raio;
}

/** O kart em (x, y) no passo `m` pisou nesta lama (posta no passo `n`)? */
export function lamaPegou(lx: number, ly: number, n: number, m: number, x: number, y: number, raio = RAIO_DA_LAMA): boolean {
  if (m < n || m - n >= VIDA_DA_LAMA) return false;
  const dx = lx - x, dy = ly - y;
  return dx * dx + dy * dy < raio * raio;
}

/**
 * O ITEM DA CAIXA: sai de um sorteio que os dois lados fazem igual, pela semente da partida, por quem pegou e por quantas
 * caixas essa pessoa já pegou. Assim o servidor sabe que item cada um tem na mão sem perguntar: quem usa outro, não usa.
 * Repolho é o mais comum (é o que estoura), depois a cenoura e a lama, e a alface é a mais rara.
 */
export function itemDaCaixa(semente: number, quem: number, k: number): ItemDoBalao {
  let h = Math.imul(semente | 0, 0x9e3779b1) ^ Math.imul(quem | 0, 0x85ebca6b) ^ Math.imul(k | 0, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  const r = (h >>> 0) % 100;
  return r < 40 ? 'repolho' : r < 65 ? 'cenoura' : r < 85 ? 'lama' : 'alface';
}
