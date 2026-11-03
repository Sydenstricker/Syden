import { ALTURA, LARGURA, RAIO_BURACO, dentroDoPoligono, movelEm, type Buraco, type Tema } from './fisica';

/**
 * O DESENHO DO MINIGOLFE (03/11/2026): pixel a pixel, numa tela de 192 × 128 ampliada com os pixels nítidos, no jeito dos
 * jogos de 16 bits. A parte que não muda (a mesa, as paredes, a areia, o buraco) é pintada uma vez por buraco numa tela à
 * parte; a cada quadro vão por cima a água mexendo, a tábua da porteira, as bolas e a mira.
 *
 * As cores são as do quarto e do salão: quentes, pouco saturadas, sem preto nem branco puros.
 */

interface Paleta {
  grama: [string, string];
  fora: [string, string];
  parede: string;
  paredeSombra: string;
  enfeite: string;
  pino: string;
  pinoClaro: string;
}

const PALETAS: Record<Tema, Paleta> = {
  jardim: { grama: ['#7fae6a', '#76a462'], fora: ['#55804c', '#4b7444'], parede: '#d8c49a', paredeSombra: '#9c8462', enfeite: '#e3a3b4', pino: '#c4614e', pinoClaro: '#ead9c0' },
  horta: { grama: ['#88a95e', '#7f9f56'], fora: ['#8a6a4a', '#7c5e41'], parede: '#c99e6a', paredeSombra: '#8e6a44', enfeite: '#e07a2e', pino: '#c4614e', pinoClaro: '#ead9c0' },
  toca: { grama: ['#6f9468', '#678b60'], fora: ['#6b5040', '#5f4738'], parede: '#a89a8a', paredeSombra: '#6e6258', enfeite: '#8d7a68', pino: '#9a8070', pinoClaro: '#c9b8a4' },
  lago: { grama: ['#7aa874', '#71a06b'], fora: ['#5b8a62', '#517e58'], parede: '#d2c09c', paredeSombra: '#968262', enfeite: '#e8d27a', pino: '#c4614e', pinoClaro: '#ead9c0' },
  porteira: { grama: ['#8aab62', '#81a15a'], fora: ['#7a6a4a', '#6e5f42'], parede: '#c4945c', paredeSombra: '#875f38', enfeite: '#e3b45a', pino: '#c4614e', pinoClaro: '#ead9c0' },
  raizes: { grama: ['#709b5d', '#679055'], fora: ['#5a4434', '#4f3b2d'], parede: '#9c7a58', paredeSombra: '#634a34', enfeite: '#b8a4c8', pino: '#b06a8a', pinoClaro: '#e8cfd8' },
};

export const COR_DA_AREIA = '#dcc38e';
export const COR_DA_AGUA = '#6491b0';

/** As cores das bolas dos outros, pela ordem de quem joga. A minha é a creme. */
export const CORES_DAS_BOLAS = ['#e07a5f', '#7d93c4', '#e3b45a', '#b07fc4', '#5fb0a4', '#d98aa8', '#9cc46a', '#c49a6c'];
const MINHA = '#f4ecdc';

const hexParaRgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/** Um ruído fixo por pixel, para os pontinhos da textura (sempre o mesmo desenho). */
const ruido = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) % 1000;
};

function distanciaAoSegmento(x: number, y: number, ax: number, ay: number, bx: number, by: number) {
  const sx = bx - ax;
  const sy = by - ay;
  const l2 = sx * sx + sy * sy;
  let t = l2 > 0 ? ((x - ax) * sx + (y - ay) * sy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = x - (ax + sx * t);
  const dy = y - (ay + sy * t);
  return Math.sqrt(dx * dx + dy * dy);
}

/** A mesa pintada, uma vez por buraco. */
export function pintarMesa(b: Buraco): HTMLCanvasElement {
  const tela = document.createElement('canvas');
  tela.width = LARGURA;
  tela.height = ALTURA;
  const ctx = tela.getContext('2d')!;
  const img = ctx.createImageData(LARGURA, ALTURA);
  const p = PALETAS[b.tema];
  const cor = (h: string) => hexParaRgb(h);
  const grama = p.grama.map(cor);
  const gramaSombra = p.grama.map((c) => cor(c).map((v) => Math.round(v * 0.82)) as [number, number, number]);
  const fora = p.fora.map(cor);
  const parede = cor(p.parede);
  const paredeSombra = cor(p.paredeSombra);
  const enfeite = cor(p.enfeite);
  const areia = cor(COR_DA_AREIA);
  const areiaPonto = cor('#c4a872');
  const agua = cor(COR_DA_AGUA);
  const aguaClara = cor('#8fb6cc');
  const pino = cor(p.pino);
  const pinoClaro = cor(p.pinoClaro);
  const segmentos: number[][] = [];
  for (const poligono of [b.contorno, ...b.blocos]) {
    const n = poligono.length / 2;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      segmentos.push([poligono[i * 2], poligono[i * 2 + 1], poligono[j * 2], poligono[j * 2 + 1]]);
    }
  }
  const noRetangulo = (r: number[], x: number, y: number) => x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3];
  for (let y = 0; y < ALTURA; y++) {
    for (let x = 0; x < LARGURA; x++) {
      const cx = x + 0.5;
      const cy = y + 0.5;
      let d = Infinity;
      for (const s of segmentos) d = Math.min(d, distanciaAoSegmento(cx, cy, s[0], s[1], s[2], s[3]));
      const dentro = dentroDoPoligono(b.contorno, cx, cy) && !b.blocos.some((bl) => dentroDoPoligono(bl, cx, cy));
      const r = ruido(x, y);
      let c: [number, number, number];
      if (!dentro && d < 3) c = d < 1.5 ? parede : paredeSombra;
      else if (!dentro) c = r < 25 ? enfeite : fora[((x >> 2) + (y >> 2)) & 1];
      else if (d < 0.9) c = parede;
      else if (b.agua.some((a) => noRetangulo(a, cx, cy))) c = (y + (x >> 3)) % 7 === 0 && r < 600 ? aguaClara : agua;
      else if (b.areia.some((a) => noRetangulo(a, cx, cy))) c = r < 90 ? areiaPonto : areia;
      else {
        // as faixas da grama cortada, e a sombra junto da parede
        const faixa = Math.floor((x + y) / 12) & 1;
        c = d < 2.5 ? gramaSombra[faixa] : grama[faixa];
        if (r < 6) c = gramaSombra[faixa];
      }
      for (const [px, py, raio] of b.pinos) {
        const dx = cx - px;
        const dy = cy - py;
        const d2 = dx * dx + dy * dy;
        if (d2 < raio * raio) {
          // o cogumelo: chapéu com pintas, iluminado de cima à esquerda
          c = (dx + dy < -raio * 0.6 && d2 > raio * raio * 0.3) || ruido(Math.floor(cx / 2), Math.floor(cy / 2)) < 160 ? pinoClaro : pino;
        } else if (d2 < (raio + 1.2) * (raio + 1.2) && dx + dy > 0) {
          c = gramaSombra[0];
        }
      }
      const i = (y * LARGURA + x) * 4;
      img.data[i] = c[0];
      img.data[i + 1] = c[1];
      img.data[i + 2] = c[2];
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // o tapetinho da saída
  const [ix, iy] = b.inicio;
  ctx.fillStyle = '#5e8a52';
  ctx.fillRect(Math.round(ix) - 4, Math.round(iy) - 4, 9, 9);
  ctx.fillStyle = '#6e9c60';
  ctx.fillRect(Math.round(ix) - 3, Math.round(iy) - 3, 7, 7);
  // o buraco: a borda e o fundo
  const [hx, hy] = b.buraco;
  disco(ctx, hx, hy, RAIO_BURACO + 0.6, '#4a3e34');
  disco(ctx, hx, hy, RAIO_BURACO - 0.4, '#2a2420');
  return tela;
}

/** Um disco de pixels inteiros (sem o borrão do arco do canvas). */
function disco(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, cor: string) {
  ctx.fillStyle = cor;
  const r2 = r * r;
  for (let dy = Math.floor(-r); dy <= Math.ceil(r); dy++) {
    for (let dx = Math.floor(-r); dx <= Math.ceil(r); dx++) {
      const ox = Math.floor(x) + dx + 0.5 - x;
      const oy = Math.floor(y) + dy + 0.5 - y;
      if (ox * ox + oy * oy <= r2) ctx.fillRect(Math.floor(x) + dx, Math.floor(y) + dy, 1, 1);
    }
  }
}

/** A bola: um disco de raio 2 com o brilho e a sombra. */
function bola(ctx: CanvasRenderingContext2D, x: number, y: number, cor: string, minha: boolean) {
  const px = Math.round(x);
  const py = Math.round(y);
  ctx.fillStyle = '#00000033';
  ctx.fillRect(px - 1, py + 2, 4, 1);
  ctx.fillStyle = cor;
  ctx.fillRect(px - 1, py - 2, 3, 5);
  ctx.fillRect(px - 2, py - 1, 5, 3);
  ctx.fillStyle = minha ? '#fffaf0' : '#ffffff66';
  ctx.fillRect(px - 1, py - 1, 1, 1);
  if (minha) {
    ctx.fillStyle = '#b8ae9c';
    ctx.fillRect(px + 1, py + 1, 1, 1);
  }
}

export interface Quadro {
  buraco: Buraco;
  mesa: HTMLCanvasElement;
  /** O passo do relógio do buraco (a tábua e a água andam por ele). */
  passo: number;
  minha: { x: number; y: number; dentro: boolean } | null;
  outros: { x: number; y: number; cor: string; dentro: boolean }[];
  /** A mira: a direção (unitária) e a força (0 a 1). */
  mira: { ux: number; uy: number; forca: number } | null;
}

export function desenhar(ctx: CanvasRenderingContext2D, q: Quadro) {
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(q.mesa, 0, 0);
  const b = q.buraco;
  // a água mexendo: uns brilhos que andam
  ctx.fillStyle = '#a9c8d8';
  for (const [ax, ay, aw, ah] of b.agua) {
    for (let k = 0; k < Math.max(2, Math.floor((aw * ah) / 120)); k++) {
      const x = ax + 2 + ((k * 37 + Math.floor(q.passo / 6)) % Math.max(1, aw - 6));
      const y = ay + 2 + ((k * 23) % Math.max(1, ah - 4));
      ctx.fillRect(x, y, 3, 1);
    }
  }
  // a tábua da porteira
  if (b.movel) {
    const { x, y } = movelEm(b.movel, q.passo);
    const rx = Math.round(x);
    const ry = Math.round(y);
    ctx.fillStyle = '#00000033';
    ctx.fillRect(rx + 1, ry + 1, b.movel.w, b.movel.h);
    ctx.fillStyle = '#b07a46';
    ctx.fillRect(rx, ry, b.movel.w, b.movel.h);
    ctx.fillStyle = '#c99462';
    for (let k = 0; k < b.movel.h; k += 4) ctx.fillRect(rx, ry + k, b.movel.w, 1);
    ctx.fillStyle = '#7e5430';
    ctx.fillRect(rx, ry + b.movel.h - 1, b.movel.w, 1);
    ctx.fillRect(rx + b.movel.w - 1, ry, 1, b.movel.h);
  }
  // a bandeira (some quando a bola está no buraco)
  const [hx, hy] = b.buraco;
  const alguemDentro = (q.minha?.dentro ?? false) || q.outros.some((o) => o.dentro);
  ctx.fillStyle = '#e8e0d0';
  ctx.fillRect(Math.round(hx), Math.round(hy) - 15, 1, 15);
  ctx.fillStyle = alguemDentro ? '#e3b45a' : '#d9774f';
  for (let k = 0; k < 5; k++) ctx.fillRect(Math.round(hx) + 1, Math.round(hy) - 15 + k, 6 - k, 1);
  for (let k = 0; k < 4; k++) ctx.fillRect(Math.round(hx) + 1, Math.round(hy) - 10 + k, 2 + k, 1);
  for (const o of q.outros) if (!o.dentro) bola(ctx, o.x, o.y, o.cor, false);
  if (q.minha && !q.minha.dentro) {
    if (q.mira && q.mira.forca > 0) {
      // a mira: pontinhos na direção da tacada, mais longos e mais quentes com a força
      const passos = Math.round(6 + q.mira.forca * 34);
      for (let k = 4; k < passos; k += 3) {
        const quente = k / 40;
        ctx.fillStyle = quente < 0.45 ? '#f4ecdc' : quente < 0.75 ? '#e3b45a' : '#d9774f';
        ctx.fillRect(Math.round(q.minha.x + q.mira.ux * k), Math.round(q.minha.y + q.mira.uy * k), 1, 1);
      }
    }
    bola(ctx, q.minha.x, q.minha.y, MINHA, true);
  }
  // a barra da força, no canto
  if (q.mira && q.mira.forca > 0) {
    ctx.fillStyle = '#2a242088';
    ctx.fillRect(LARGURA - 8, ALTURA - 36, 5, 32);
    const h = Math.round(q.mira.forca * 30);
    ctx.fillStyle = q.mira.forca < 0.45 ? '#f4ecdc' : q.mira.forca < 0.75 ? '#e3b45a' : '#d9774f';
    ctx.fillRect(LARGURA - 7, ALTURA - 5 - h, 3, h);
  }
}
