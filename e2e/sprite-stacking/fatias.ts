// O PILOTO DAS FATIAS (sprite stacking) na câmera da corrida. Só desenho: a pista, a física e as figuras de hoje são as de
// web/src/corrida, importadas sem mudança. As fatias saem DA PRÓPRIA FIGURA de hoje: a árvore, o pinheiro, a laranjeira, a
// cenoura e a flor são "torneadas" (cada linha da figura vira um disco do raio dela), e a caixa vira um cubo com a figura
// pintada nas faces.
import { HORIZONTE, W, H, type Camera, type Figura } from '../../web/src/corrida/render';

// os mesmos números de render.ts (não exportados lá)
export const ALTURA = 22;
export const FOCO = 172;

export interface Pilha {
  n: number; // lado da grade, em vóxeis
  fatias: HTMLCanvasElement[]; // de baixo para cima
}

function pixels(c: HTMLCanvasElement) {
  return c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
}

/** Torneia uma figura de frente: cada linha vira um disco, com a cor que a figura tem naquela coluna. */
export function tornear(fig: HTMLCanvasElement): Pilha {
  const w = fig.width, h = fig.height, d = pixels(fig);
  const op = (x: number, y: number) => d[(y * w + x) * 4 + 3] > 0;
  const cor = (x: number, y: number) => (d[(y * w + x) * 4] << 16) | (d[(y * w + x) * 4 + 1] << 8) | d[(y * w + x) * 4 + 2];
  // o contorno (a cor mais comum no primeiro ponto de cada linha) sai: o contorno das fatias é feito na tela
  const conta = new Map<number, number>();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (op(x, y)) { conta.set(cor(x, y), (conta.get(cor(x, y)) ?? 0) + 1); break; }
  const k = [...conta].sort((a, b) => b[1] - a[1])[0][0];
  const c = w / 2;
  // a figura sem o contorno: cada ponto de contorno pega o vizinho de dentro (na linha; senão, a linha de baixo)
  const cheia: (number | null)[][] = [];
  for (let y = 0; y < h; y++) {
    cheia.push([]);
    for (let x = 0; x < w; x++) cheia[y].push(op(x, y) ? cor(x, y) : null);
  }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (cheia[y][x] !== k) continue;
      const passo = x + 0.5 < c ? 1 : -1;
      let v: number | null = null;
      for (let xx = x + passo; xx >= 0 && xx < w; xx += passo) if (cheia[y][xx] !== null && cheia[y][xx] !== k) { v = cheia[y][xx]; break; }
      for (let yy = y + 1; v === null && yy < h; yy++) if (cheia[yy][x] !== null && cheia[yy][x] !== k) v = cheia[yy][x];
      cheia[y][x] = v ?? k;
    }
  const fatias: HTMLCanvasElement[] = [];
  for (let row = h - 1; row >= 0; row--) {
    let L = -1, R = -1;
    for (let x = 0; x < w; x++) if (op(x, row)) { if (L < 0) L = x; R = x; }
    const s = document.createElement('canvas');
    s.width = s.height = w;
    if (L >= 0) {
      const r = Math.max(c - L, R + 1 - c);
      const g = s.getContext('2d')!;
      for (let y = 0; y < w; y++)
        for (let x = 0; x < w; x++) {
          const dx = x + 0.5 - c, dy = y + 0.5 - c;
          if (dx * dx + dy * dy > r * r) continue;
          let col = Math.floor(c + dx), v: number | null = null;
          // a coluna vazia (o vão entre os galhos): o mais perto, indo para o meio
          for (let t = 0; t < w && v === null; t++) {
            const xx = col + (col + 0.5 < c ? t : -t);
            if (xx >= 0 && xx < w) v = cheia[row][xx];
          }
          if (v === null) continue;
          // a borda do disco é a parede da pilha: um pouco mais escura que o tampo, para os andares (os galhos do
          // pinheiro, o ombro da cenoura) aparecerem vistos de cima
          if (r >= 2 && Math.hypot(dx, dy) > r - 1.2) {
            const f = 0.78;
            v = (Math.round(((v >> 16) & 255) * f) << 16) | (Math.round(((v >> 8) & 255) * f) << 8) | Math.round((v & 255) * f);
          }
          g.fillStyle = '#' + v.toString(16).padStart(6, '0');
          g.fillRect(x, y, 1, 1);
        }
    }
    fatias.push(s);
  }
  return { n: w, fatias };
}

/** A caixa: um cubo com a figura de hoje em cada face (e no tampo). */
export function cubo(fig: HTMLCanvasElement): Pilha {
  const w = fig.width, h = fig.height, d = pixels(fig);
  const n = w;
  const px = (u: number, v: number) => {
    const i = (Math.min(h - 1, v) * w + Math.min(w - 1, u)) * 4;
    return d[i + 3] ? `rgb(${d[i]},${d[i + 1]},${d[i + 2]})` : null;
  };
  const fatias: HTMLCanvasElement[] = [];
  for (let z = 0; z < h; z++) {
    const s = document.createElement('canvas');
    s.width = s.height = n;
    const g = s.getContext('2d')!;
    const linha = h - 1 - z;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        let c: string | null = null;
        if (z === h - 1) c = px(x, Math.floor((y * h) / n)); // o tampo
        else if (y === 0) c = px(x, linha);
        else if (y === n - 1) c = px(n - 1 - x, linha);
        else if (x === 0) c = px(n - 1 - y, linha);
        else if (x === n - 1) c = px(y, linha);
        if (!c) continue;
        g.fillStyle = c;
        g.fillRect(x, y, 1, 1);
      }
    fatias.push(s);
  }
  return { n, fatias };
}

// duas telas de rascunho, do tamanho da tela do jogo: a pilha é montada numa, o contorno na outra
let A: HTMLCanvasElement, B: HTMLCanvasElement, a: CanvasRenderingContext2D, b: CanvasRenderingContext2D;
function rascunho() {
  if (A) return;
  A = document.createElement('canvas');
  B = document.createElement('canvas');
  A.width = B.width = W;
  A.height = B.height = H;
  a = A.getContext('2d')!;
  b = B.getContext('2d')!;
  a.imageSmoothingEnabled = b.imageSmoothingEnabled = false;
}

function proj(cam: Camera, x: number, y: number, h: number) {
  const dx = x - cam.x, dy = y - cam.y;
  const fx = Math.cos(cam.angulo), fy = Math.sin(cam.angulo);
  const z = dx * fx + dy * fy;
  const lado = -dx * fy + dy * fx;
  return { sx: W / 2 + (lado * FOCO) / z, sy: HORIZONTE + ((ALTURA - h) * FOCO) / z, z };
}

export const CONTORNO = '#1e1a20';
export const contagem = { chamadas: 0 };

/**
 * Uma pilha de pé no chão em (x, y), girada `giro` no mundo. `tamanho` é o mesmo da figura de hoje: um vóxel tem o tamanho
 * de um pixel dela (a figura de pé tem `tamanho × ATRAS / FOCO` unidades por pixel na distância de referência).
 */
export function pilhaNoChao(cam: Camera, p: Pilha, x: number, y: number, tamanho: number, giro: number, atras: number, contorno = true): Figura | null {
  const s = (tamanho * atras) / FOCO; // unidades do mundo por vóxel
  const centro = proj(cam, x, y, 0);
  if (centro.z < 6) return null;
  const meio = (p.n * s) / 2;
  if (centro.z - meio < 3) return null;
  const ux = Math.cos(giro), uy = Math.sin(giro), vx = -uy, vy = ux;
  const voxTela = (s * FOCO) / centro.z;
  const alto = p.fatias.length * s;
  // a caixa da tela que a pilha ocupa (com folga para o contorno)
  const cantos = [-1, 1].flatMap((i) => [-1, 1].flatMap((j) => [0, alto].map((hh) => proj(cam, x + (ux * i + vx * j) * meio, y + (uy * i + vy * j) * meio, hh))));
  const folga = Math.ceil(voxTela) + 2;
  const x0 = Math.max(0, Math.floor(Math.min(...cantos.map((q) => q.sx))) - folga);
  const x1 = Math.min(W, Math.ceil(Math.max(...cantos.map((q) => q.sx))) + folga);
  const y0 = Math.max(0, Math.floor(Math.min(...cantos.map((q) => q.sy))) - folga);
  const y1 = Math.min(H, Math.ceil(Math.max(...cantos.map((q) => q.sy))) + folga);
  if (x1 <= x0 || y1 <= y0 || voxTela < 0.12) return null;
  return {
    z: centro.z,
    desenhar: (ctx) => {
      rascunho();
      a.setTransform(1, 0, 0, 1, 0, 0);
      a.clearRect(x0, y0, x1 - x0, y1 - y0);
      // cada fatia, desenhada quantas vezes for preciso para não abrir fresta entre uma e outra
      const copias = Math.max(1, Math.ceil(voxTela));
      for (let i = 0; i < p.fatias.length; i++) {
        for (let k = 0; k < copias; k++) {
          const hh = (i + (k + 0.5) / copias) * s;
          const o = proj(cam, x - (ux + vx) * meio, y - (uy + vy) * meio, hh);
          const pu = proj(cam, x + (ux - vx) * meio, y + (uy - vy) * meio, hh);
          const pv = proj(cam, x + (vx - ux) * meio, y + (vy - uy) * meio, hh);
          a.setTransform((pu.sx - o.sx) / p.n, (pu.sy - o.sy) / p.n, (pv.sx - o.sx) / p.n, (pv.sy - o.sy) / p.n, o.sx, o.sy);
          a.drawImage(p.fatias[i], 0, 0);
          contagem.chamadas++;
        }
      }
      a.setTransform(1, 0, 0, 1, 0, 0);
      if (contorno) {
        // o contorno: a silhueta escura, deslocada nas quatro direções por trás da pilha
        const e = Math.max(1, Math.round(voxTela));
        b.globalCompositeOperation = 'copy';
        b.drawImage(A, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
        b.globalCompositeOperation = 'source-in';
        b.fillStyle = CONTORNO;
        b.fillRect(x0, y0, x1 - x0, y1 - y0);
        b.globalCompositeOperation = 'source-over';
        for (const [ox, oy] of [[e, 0], [-e, 0], [0, e], [0, -e]]) ctx.drawImage(B, x0, y0, x1 - x0, y1 - y0, x0 + ox, y0 + oy, x1 - x0, y1 - y0);
      }
      ctx.drawImage(A, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
    },
  };
}

/**
 * AS FATIAS PRÉ-GIRADAS (a otimização): em vez de empilhar as fatias a cada quadro, cada peça é empilhada UMA vez por
 * ângulo de visada (32 por volta) e por faixa de distância, guardada como uma figura pronta, e depois desenhada como as de
 * hoje: um drawImage, ampliado ou reduzido pela distância. A primeira vez de cada combinação custa; as outras, não.
 */
const GIROS = 32;
const DISTANCIAS = [9, 13, 19, 28, 40, 58, 85, 125, 185, 270, 400];
interface Assada { img: HTMLCanvasElement; ax: number; ay: number }
const assadas = new Map<string, Assada>();
export const cacheInfo = { montadas: 0, msMontando: 0 };

function assar(p: Pilha, tamanho: number, atras: number, giro: number, zRef: number, contorno: boolean): Assada {
  const cam: Camera = { x: 0, y: 0, angulo: 0 };
  const x = zRef, y = 0;
  const s = (tamanho * atras) / FOCO;
  const meio = (p.n * s) / 2;
  const ux = Math.cos(giro), uy = Math.sin(giro), vx = -uy, vy = ux;
  const voxTela = (s * FOCO) / zRef;
  const alto = p.fatias.length * s;
  const cantos = [-1, 1].flatMap((i) => [-1, 1].flatMap((j) => [0, alto].map((hh) => proj(cam, x + (ux * i + vx * j) * meio, y + (uy * i + vy * j) * meio, hh))));
  const folga = Math.ceil(voxTela) + 2;
  const x0 = Math.floor(Math.min(...cantos.map((q) => q.sx))) - folga;
  const y0 = Math.floor(Math.min(...cantos.map((q) => q.sy))) - folga;
  const bw = Math.ceil(Math.max(...cantos.map((q) => q.sx))) + folga - x0;
  const bh = Math.ceil(Math.max(...cantos.map((q) => q.sy))) + folga - y0;
  const novo = () => { const c = document.createElement('canvas'); c.width = Math.max(1, bw); c.height = Math.max(1, bh); const g = c.getContext('2d')!; g.imageSmoothingEnabled = false; return { c, g }; };
  const pilha = novo();
  const copias = Math.max(1, Math.ceil(voxTela));
  for (let i = 0; i < p.fatias.length; i++)
    for (let k = 0; k < copias; k++) {
      const hh = (i + (k + 0.5) / copias) * s;
      const o = proj(cam, x - (ux + vx) * meio, y - (uy + vy) * meio, hh);
      const pu = proj(cam, x + (ux - vx) * meio, y + (uy - vy) * meio, hh);
      const pv = proj(cam, x + (vx - ux) * meio, y + (vy - uy) * meio, hh);
      pilha.g.setTransform((pu.sx - o.sx) / p.n, (pu.sy - o.sy) / p.n, (pv.sx - o.sx) / p.n, (pv.sy - o.sy) / p.n, o.sx - x0, o.sy - y0);
      pilha.g.drawImage(p.fatias[i], 0, 0);
    }
  const pe = proj(cam, x, y, 0);
  if (!contorno) return { img: pilha.c, ax: pe.sx - x0, ay: pe.sy - y0 };
  const silh = novo();
  silh.g.drawImage(pilha.c, 0, 0);
  silh.g.globalCompositeOperation = 'source-in';
  silh.g.fillStyle = CONTORNO;
  silh.g.fillRect(0, 0, bw, bh);
  const fim = novo();
  const e = Math.max(1, Math.round(voxTela));
  for (const [ox, oy] of [[e, 0], [-e, 0], [0, e], [0, -e]]) fim.g.drawImage(silh.c, ox, oy);
  fim.g.drawImage(pilha.c, 0, 0);
  return { img: fim.c, ax: pe.sx - x0, ay: pe.sy - y0 };
}

export function pilhaAssada(cam: Camera, p: Pilha, nome: string, x: number, y: number, tamanho: number, giro: number, atras: number, contorno = true): Figura | null {
  const pr = proj(cam, x, y, 0);
  if (pr.z < 6) return null;
  const visada = Math.atan2(y - cam.y, x - cam.x);
  const passo = (Math.PI * 2) / GIROS;
  const gi = ((Math.round((giro - visada) / passo) % GIROS) + GIROS) % GIROS;
  let di = 0;
  for (let i = 1; i < DISTANCIAS.length; i++) if (Math.abs(Math.log(DISTANCIAS[i] / pr.z)) < Math.abs(Math.log(DISTANCIAS[di] / pr.z))) di = i;
  const zRef = DISTANCIAS[di];
  const chave = `${nome}|${tamanho}|${gi}|${di}|${contorno ? 1 : 0}`;
  let a = assadas.get(chave);
  if (!a) {
    const t0 = performance.now();
    a = assar(p, tamanho, atras, gi * passo, zRef, contorno);
    cacheInfo.msMontando += performance.now() - t0;
    assadas.set(chave, a);
    cacheInfo.montadas++;
  }
  const k = zRef / pr.z;
  const w = a.img.width * k, h = a.img.height * k;
  const dx = pr.sx - a.ax * k, dy = pr.sy - a.ay * k;
  if (w < 1 || dx > W || dx + w < 0 || dy > H || dy + h < 0) return null;
  const img = a.img;
  return { z: pr.z, desenhar: (ctx) => { ctx.drawImage(img, Math.round(dx), Math.round(dy), Math.round(w), Math.round(h)); contagem.chamadas++; } };
}
