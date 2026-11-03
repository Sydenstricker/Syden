/**
 * A PISTA DA CORRIDA DOS COELHOS (03/11/2026, degrau 1): uma volta fechada desenhada POR CÓDIGO, como os mapas do Super
 * Nintendo (uma imagem vista de cima, que a câmera em perspectiva deita no chão: render.ts). Nenhuma arte de terceiro e
 * nenhum arquivo para baixar.
 *
 * O mundo tem 1024 × 1024 unidades; a textura e o mapa do que é cada chão têm 2048 × 2048 (meia unidade por ponto), para
 * a zebra e a faixa de largada ficarem nítidas perto do kart. Tudo sai de UMA linha do meio (uma curva fechada pelos
 * pontos de controle): a distância até ela diz se o chão é asfalto, zebra ou grama, e o quanto se andou ao longo dela
 * pinta a zebra e conta as voltas.
 *
 * O id da pista leva a versão ("horta-1"): mudar o traçado invalida os recordes e os fantasmas guardados, que então
 * vão para uma pista nova, e não se misturam com os da antiga.
 */

export const MUNDO = 1024;
export const RES = 2048;
const K = RES / MUNDO;

export const Chao = { Asfalto: 0, Zebra: 1, Grama: 2, Turbo: 3, Parede: 4, Terra: 5 } as const;
export type Chao = (typeof Chao)[keyof typeof Chao];

export interface DefinicaoDaPista {
  id: string;
  /** Os pontos de controle da linha do meio, no sentido da corrida. A largada fica no primeiro. */
  pontos: [number, number][];
  /** Meia largura do asfalto. */
  meiaLargura: number;
  voltas: number;
  /** Onde ficam as placas de turbo: [começo, fim] em fração da volta. */
  turbos: [number, number][];
  /** Lagos (paredes redondas na grama): [x, y, raio]. */
  lagos: [number, number, number][];
  semente: number;
}

export const HORTA: DefinicaoDaPista = {
  id: 'horta-1',
  pontos: [
    [250, 190], [470, 150], [700, 170], [850, 250], [860, 380], [740, 450], [600, 430], [530, 510], [600, 600],
    [790, 640], [870, 760], [800, 880], [600, 900], [420, 860], [330, 740], [220, 660], [150, 520], [200, 400],
    [150, 290],
  ],
  meiaLargura: 30,
  voltas: 3,
  turbos: [[0.205, 0.225], [0.62, 0.64]],
  lagos: [[380, 470, 70]],
  semente: 7,
};

export interface Objeto {
  x: number;
  y: number;
  tipo: 'arvore' | 'cenoura' | 'flor';
  /** Raio sólido (0 = atravessa). */
  raio: number;
}

export interface Pista {
  def: DefinicaoDaPista;
  /** A linha do meio, amostrada: x, y e o comprimento acumulado até cada ponto. */
  lx: Float32Array;
  ly: Float32Array;
  la: Float32Array;
  comprimento: number;
  /** O que é cada ponto do chão (Chao), RES × RES. */
  chao: Uint8Array;
  /** As cores da textura (0xAABBGGRR, a ordem do ImageData), RES × RES. */
  textura: Uint32Array;
  objetos: Objeto[];
  /** De onde se larga: o kart atrás da linha, olhando o sentido da corrida. */
  largada: { x: number; y: number; angulo: number };
}

/** Catmull-Rom fechada: `porTrecho` pontos entre cada par de pontos de controle. */
function linhaDoMeio(pontos: [number, number][], porTrecho: number) {
  const n = pontos.length;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = pontos[(i - 1 + n) % n], p1 = pontos[i], p2 = pontos[(i + 1) % n], p3 = pontos[(i + 2) % n];
    for (let k = 0; k < porTrecho; k++) {
      const t = k / porTrecho, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      xs.push(f(p0[0], p1[0], p2[0], p3[0]));
      ys.push(f(p0[1], p1[1], p2[1], p3[1]));
    }
  }
  return { xs, ys };
}

/** Um sorteio que sai sempre igual para a mesma semente (mulberry32). */
export function sorteio(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rgb = (r: number, g: number, b: number) => (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;

/** As cores, quentes e pouco saturadas, como o quarto: uma horta no fim da tarde. */
const COR = {
  asfalto: [rgb(104, 98, 106), rgb(110, 104, 112), rgb(98, 92, 100)],
  faixa: rgb(222, 214, 196),
  zebraA: rgb(196, 70, 62),
  zebraB: rgb(232, 226, 210),
  grama: [rgb(98, 150, 70), rgb(90, 140, 64)],
  gramaPonto: rgb(122, 172, 84),
  gramaEscura: rgb(76, 122, 56),
  terra: [rgb(150, 104, 66), rgb(138, 94, 58)],
  sulco: rgb(112, 76, 48),
  cerca: [rgb(54, 92, 50), rgb(44, 78, 42)],
  agua: [rgb(70, 128, 168), rgb(84, 144, 182)],
  aguaBorda: rgb(196, 182, 140),
  turbo: rgb(244, 176, 60),
  turboFundo: rgb(150, 70, 40),
  quadrado: [rgb(30, 26, 32), rgb(236, 230, 216)],
  flor: [rgb(236, 120, 150), rgb(246, 214, 96), rgb(236, 236, 230)],
};

export function montarPista(def: DefinicaoDaPista = HORTA): Pista {
  const { xs, ys } = linhaDoMeio(def.pontos, 24);
  const n = xs.length;
  const lx = Float32Array.from(xs), ly = Float32Array.from(ys);
  const la = new Float32Array(n + 1);
  for (let i = 0; i < n; i++) la[i + 1] = la[i] + Math.hypot(lx[(i + 1) % n] - lx[i], ly[(i + 1) % n] - ly[i]);
  const comprimento = la[n];

  // A DISTÂNCIA até a linha do meio e o quanto se andou nela, ponto a ponto, até MAX além do asfalto: cada trecho
  // pinta só a caixa em volta dele (bem mais barato que medir cada ponto contra a linha inteira).
  const MAX = def.meiaLargura + 40;
  const dist = new Float32Array(RES * RES).fill(1e9);
  const ao = new Float32Array(RES * RES);
  for (let i = 0; i < n; i++) {
    const ax = lx[i], ay = ly[i], bx = lx[(i + 1) % n], by = ly[(i + 1) % n];
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, seg = Math.sqrt(l2);
    const x0 = Math.max(0, Math.floor((Math.min(ax, bx) - MAX) * K)), x1 = Math.min(RES - 1, Math.ceil((Math.max(ax, bx) + MAX) * K));
    const y0 = Math.max(0, Math.floor((Math.min(ay, by) - MAX) * K)), y1 = Math.min(RES - 1, Math.ceil((Math.max(ay, by) + MAX) * K));
    for (let ty = y0; ty <= y1; ty++) {
      const py = (ty + 0.5) / K;
      for (let tx = x0; tx <= x1; tx++) {
        const px = (tx + 0.5) / K;
        let t = ((px - ax) * dx + (py - ay) * dy) / l2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = ax + t * dx - px, qy = ay + t * dy - py;
        const d = qx * qx + qy * qy;
        const k = ty * RES + tx;
        if (d < dist[k]) {
          dist[k] = d;
          ao[k] = la[i] + t * seg;
        }
      }
    }
  }

  const chao = new Uint8Array(RES * RES);
  const textura = new Uint32Array(RES * RES);
  const sorte = sorteio(def.semente);
  const hw = def.meiaLargura;
  const BORDA = 14;
  for (let ty = 0; ty < RES; ty++) {
    const y = (ty + 0.5) / K;
    for (let tx = 0; tx < RES; tx++) {
      const x = (tx + 0.5) / K;
      const k = ty * RES + tx;
      const d = Math.sqrt(dist[k]);
      const s = ao[k];
      const ruido = (tx * 73856093) ^ (ty * 19349663);
      const r3 = ((ruido >>> 8) & 0xff) % 3;
      let tipo: Chao, cor: number;
      if (x < BORDA || y < BORDA || x > MUNDO - BORDA || y > MUNDO - BORDA) {
        tipo = Chao.Parede;
        cor = COR.cerca[(((tx >> 3) + (ty >> 3)) & 1)];
      } else if (d < hw) {
        tipo = Chao.Asfalto;
        cor = COR.asfalto[r3];
        // a faixa do meio, tracejada
        if (d < 0.75 && Math.floor(s / 10) % 2 === 0) cor = COR.faixa;
        // a faixa da largada: quadriculada de lado a lado
        if (s < 7 || s > comprimento - 1) {
          cor = COR.quadrado[(Math.floor(s / 2.5) + Math.floor((x + y) / 2.5)) & 1];
        }
        const f = s / comprimento;
        for (const [a, b] of def.turbos) {
          if (f >= a && f <= b && d < hw * 0.55) {
            tipo = Chao.Turbo;
            // as setas do turbo: chevrons apontando para a frente
            const u = (s - a * comprimento) % 12;
            const lado = d / (hw * 0.55);
            cor = Math.abs(u - 6 - lado * 4) < 2.2 ? COR.turbo : COR.turboFundo;
          }
        }
      } else if (d < hw + 4) {
        tipo = Chao.Zebra;
        cor = Math.floor(s / 7) % 2 === 0 ? COR.zebraA : COR.zebraB;
      } else {
        tipo = Chao.Grama;
        // a grama cortada em faixas largas, como um gramado
        const faixa = Math.floor((x + y * 0.6) / 28) & 1;
        cor = COR.grama[faixa];
        if (((ruido >>> 4) & 0x3f) === 0) cor = COR.gramaPonto;
        if (d < hw + 6) cor = COR.gramaEscura;
      }
      chao[k] = tipo;
      textura[k] = cor;
    }
  }

  // OS LAGOS: água na grama, com a areia em volta, e parede para o kart
  for (const [cx, cy, r] of def.lagos) pintarCirculo(chao, textura, cx, cy, r, (d, tx, ty) => {
    if (d > r - 3) return [Chao.Terra, COR.aguaBorda];
    return [Chao.Parede, COR.agua[((tx >> 2) + (ty >> 4)) & 1]];
  });

  // OS OBJETOS: árvores (sólidas), canteiros de cenoura e flores, sorteados na grama longe do asfalto
  const objetos: Objeto[] = [];
  const longeDoAsfalto = (x: number, y: number, m: number) => {
    const k = Math.floor(y * K) * RES + Math.floor(x * K);
    return Math.sqrt(dist[k]) > hw + m && chao[k] === Chao.Grama;
  };
  for (let tentativa = 0; tentativa < 4000 && objetos.length < 150; tentativa++) {
    const x = 30 + sorte() * (MUNDO - 60), y = 30 + sorte() * (MUNDO - 60);
    if (!longeDoAsfalto(x, y, 12)) continue;
    if (objetos.some((o) => Math.hypot(o.x - x, o.y - y) < 26)) continue;
    const q = sorte();
    objetos.push(q < 0.55 ? { x, y, tipo: 'arvore', raio: 5 } : q < 0.8 ? { x, y, tipo: 'cenoura', raio: 0 } : { x, y, tipo: 'flor', raio: 0 });
  }
  // os canteiros: terra com sulcos debaixo de cada cenoura
  for (const o of objetos) {
    if (o.tipo === 'cenoura') {
      pintarRetangulo(chao, textura, o.x - 9, o.y - 6, 18, 12, (tx, ty) => [Chao.Terra, (ty >> 2) % 2 ? COR.sulco : COR.terra[tx & 1]]);
    }
    if (o.tipo === 'flor') {
      const cor = COR.flor[Math.floor(sorte() * 3)];
      for (let i = 0; i < 9; i++) {
        const fx = Math.floor((o.x + (sorte() - 0.5) * 20) * K), fy = Math.floor((o.y + (sorte() - 0.5) * 20) * K);
        if (fx > 0 && fy > 0 && fx < RES - 1 && fy < RES - 1 && chao[fy * RES + fx] === Chao.Grama) {
          textura[fy * RES + fx] = cor;
          textura[fy * RES + fx + 1] = cor;
        }
      }
    }
  }
  const sombra = (c: number) => {
    const r = c & 0xff, g = (c >> 8) & 0xff, b = (c >> 16) & 0xff;
    return rgb(Math.round(r * 0.62), Math.round(g * 0.62), Math.round(b * 0.7));
  };
  // a sombra das árvores no chão, um pouco para a direita (o sol baixo da tarde)
  for (const o of objetos.filter((o) => o.tipo === 'arvore')) {
    pintarCirculo(chao, textura, o.x + 3, o.y + 2, 9, (_d, tx, ty) => {
      const k = ty * RES + tx;
      return [chao[k] as Chao, sombra(textura[k])];
    });
  }

  // A LARGADA: três pontos antes da linha, olhando o sentido da corrida
  const i0 = n - 3;
  const angulo = Math.atan2(ly[0] - ly[i0], lx[0] - lx[i0]);
  return { def, lx, ly, la, comprimento, chao, textura, objetos, largada: { x: lx[i0], y: ly[i0], angulo } };
}

function pintarCirculo(
  chao: Uint8Array,
  textura: Uint32Array,
  cx: number,
  cy: number,
  r: number,
  f: (d: number, tx: number, ty: number) => [Chao, number],
) {
  for (let ty = Math.max(0, Math.floor((cy - r) * K)); ty <= Math.min(RES - 1, Math.ceil((cy + r) * K)); ty++) {
    for (let tx = Math.max(0, Math.floor((cx - r) * K)); tx <= Math.min(RES - 1, Math.ceil((cx + r) * K)); tx++) {
      const d = Math.hypot((tx + 0.5) / K - cx, (ty + 0.5) / K - cy);
      if (d > r) continue;
      const [tipo, cor] = f(d, tx, ty);
      chao[ty * RES + tx] = tipo;
      textura[ty * RES + tx] = cor;
    }
  }
}

function pintarRetangulo(
  chao: Uint8Array,
  textura: Uint32Array,
  x: number,
  y: number,
  w: number,
  h: number,
  f: (tx: number, ty: number) => [Chao, number],
) {
  for (let ty = Math.max(0, Math.floor(y * K)); ty < Math.min(RES, Math.ceil((y + h) * K)); ty++) {
    for (let tx = Math.max(0, Math.floor(x * K)); tx < Math.min(RES, Math.ceil((x + w) * K)); tx++) {
      if (chao[ty * RES + tx] !== Chao.Grama) continue;
      const [tipo, cor] = f(tx, ty);
      chao[ty * RES + tx] = tipo;
      textura[ty * RES + tx] = cor;
    }
  }
}

/** O chão num ponto do mundo (fora do mapa é parede). */
export function chaoEm(p: Pista, x: number, y: number): Chao {
  const tx = Math.floor(x * K), ty = Math.floor(y * K);
  if (tx < 0 || ty < 0 || tx >= RES || ty >= RES) return Chao.Parede;
  return p.chao[ty * RES + tx] as Chao;
}

/** O ponto da linha do meio mais perto, procurando perto do último (o kart não pula de um lado da pista ao outro). */
export function pontoMaisPerto(p: Pista, x: number, y: number, ultimo: number, janela = 14): number {
  const n = p.lx.length;
  let melhor = ultimo, md = Infinity;
  for (let k = -janela; k <= janela; k++) {
    const i = (((ultimo + k) % n) + n) % n;
    const d = (p.lx[i] - x) ** 2 + (p.ly[i] - y) ** 2;
    if (d < md) {
      md = d;
      melhor = i;
    }
  }
  return melhor;
}
