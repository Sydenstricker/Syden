import { H, projetar, W, type Camera, type Desenho, type Figura } from '../corrida/render';
import { MUNDO } from '../corrida/pista';
import type { Arena } from './sim';

/**
 * O DESENHO DO ESTOURA-BALÃO, por cima do da corrida (corrida/render.ts: a câmera, o chão em perspectiva, o coelho no kart):
 * as figuras que a arena tem e a pista não (a pedra, o fardo de feno, o caixote, o poste da cerca), os BALÕES presos atrás
 * de cada kart, o estouro e o mapa pequeno da arena. Tudo à mão, em código.
 */

function figura(mapa: string[], cores: Record<string, string>): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = mapa[0].length;
  c.height = mapa.length;
  const g = c.getContext('2d')!;
  mapa.forEach((linha, y) => {
    [...linha].forEach((ch, x) => {
      if (cores[ch]) {
        g.fillStyle = cores[ch];
        g.fillRect(x, y, 1, 1);
      }
    });
  });
  return c;
}

/** Acrescenta as figuras da arena às do desenho da corrida. */
export function figurasDaArena(d: Desenho) {
  d.figuras.pedra = figura(
    [
      '....kkkkkk....',
      '..kkPPPpPPkk..',
      '.kPPpPPPPPpPk.',
      'kPPPPPPpPPPPdk',
      'kPpPPPPPPPpddk',
      'kPPPPpPPPPdddk',
      '.kdPPPPPPddddk',
      '..kkddddddkkk.',
    ],
    { k: '#2a2428', P: '#a49a96', p: '#c4bcb6', d: '#7a706e' },
  );
  d.figuras.feno = figura(
    [
      'kkkkkkkkkkkkkk',
      'kFfFFcFFfFcFFk',
      'kFFfFcFfFFcfFk',
      'kfFFFcFFFfcFFk',
      'kFFfFcfFFFcFfk',
      'kFfFFcFFfFcFFk',
      'kddddcdddddddk',
      'kkkkkkkkkkkkkk',
    ],
    { k: '#4a3018', F: '#e2be60', f: '#f4d888', c: '#96603a', d: '#b8924a' },
  );
  d.figuras.caixote = figura(
    [
      'kkkkkkkkkkkk',
      'kMmmmmmmmmMk',
      'kmMk....kMmk',
      'km.kM..Mk.mk',
      'km..kMMk..mk',
      'km..kMMk..mk',
      'km.kM..Mk.mk',
      'kmMk....kMmk',
      'kMmmmmmmmmMk',
      'kkkkkkkkkkkk',
    ],
    { k: '#2a1a14', M: '#b8844c', m: '#a06e3e', '.': '#c89a62' },
  );
  d.figuras.poste = figura(['kk', 'Tt', 'Tt', 'Tt', 'Tt', 'Tt', 'kk'], { k: '#3a2618', T: '#a87848', t: '#86603a' });
}

/** As cores dos balões: uma por lugar na largada (até oito), quentes e alegres, nunca o preto nem o branco puro. */
export const CORES_DOS_BALOES = ['#e85a5a', '#4aa8e8', '#f0c040', '#6cc46a', '#c46ad8', '#f08a3a', '#4ad0c8', '#ec7ab4'];
export const corDoBalao = (largada: number) => CORES_DOS_BALOES[((largada % 8) + 8) % 8];

/**
 * OS BALÕES DE UM KART, presos atrás dele, a uns 20 pontos de altura, balançando: `quantos` (0 a 3), da cor do lugar de
 * quem dirige. Cada balão é uma figura com o z do kart um pouco maior, para sair ATRÁS do kart.
 */
export function baloesNaTela(
  cam: Camera,
  kx: number,
  ky: number,
  angulo: number,
  quantos: number,
  cor: string,
  tempo: number,
  piscando = false,
): Figura[] {
  const figuras: Figura[] = [];
  if (quantos <= 0) return figuras;
  if (piscando && Math.floor(tempo * 10) % 2 === 0) return figuras;
  const tx = kx - Math.cos(angulo) * 3, ty = ky - Math.sin(angulo) * 3;
  const pr = projetar(cam, tx, ty);
  if (!pr) return figuras;
  const lado = { x: -Math.sin(angulo), y: Math.cos(angulo) };
  for (let i = 0; i < quantos; i++) {
    const off = (i - (quantos - 1) / 2) * 3.2;
    const bp = projetar(cam, tx + lado.x * off, ty + lado.y * off);
    if (!bp) continue;
    const e = bp.escala;
    const balanco = Math.sin(tempo * 2.4 + i * 1.7) * 2;
    const alto = (34 + (i % 2) * 5) * e;
    const r = Math.max(1.5, 4 * e);
    const bx = bp.sx + balanco * e, by = bp.sy - alto;
    figuras.push({
      z: bp.z + 0.5 + i * 0.01,
      desenhar: (ctx) => {
        // o barbante, do kart ao balão
        ctx.strokeStyle = '#3a3040';
        ctx.lineWidth = Math.max(0.5, 0.6 * e);
        ctx.beginPath();
        ctx.moveTo(pr.sx, pr.sy - 8 * pr.escala);
        ctx.lineTo(bx, by + r);
        ctx.stroke();
        ctx.fillStyle = '#1e1822';
        ctx.beginPath();
        ctx.ellipse(bx, by, r + 0.8, r * 1.18 + 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = cor;
        ctx.beginPath();
        ctx.ellipse(bx, by, r, r * 1.18, 0, 0, Math.PI * 2);
        ctx.fill();
        // o brilho
        ctx.fillStyle = '#fff8ec';
        ctx.fillRect(Math.round(bx - r * 0.45), Math.round(by - r * 0.6), Math.max(1, Math.round(r * 0.35)), Math.max(1, Math.round(r * 0.45)));
      },
    });
  }
  return figuras;
}

/** O estouro: os pedacinhos do balão voando, por ~0,5 s, onde o kart estava (t de 0 a 1). */
export function estouroNaTela(cam: Camera, x: number, y: number, cor: string, t: number): Figura | null {
  const pr = projetar(cam, x, y);
  if (!pr || t < 0 || t > 1) return null;
  const e = pr.escala;
  return {
    z: pr.z - 0.05,
    desenhar: (ctx) => {
      ctx.fillStyle = cor;
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * Math.PI * 2;
        const r = (6 + 22 * t) * e;
        ctx.fillRect(Math.round(pr.sx + Math.cos(ang) * r), Math.round(pr.sy - 26 * e + Math.sin(ang) * r - 10 * t * t * e), Math.max(1, Math.round(2 * e)), Math.max(1, Math.round(2 * e)));
      }
      if (t < 0.35) {
        ctx.fillStyle = '#fff8ec';
        const r = (4 + 14 * t) * e;
        ctx.fillRect(Math.round(pr.sx - r), Math.round(pr.sy - 26 * e), Math.round(2 * r), Math.max(1, Math.round(e)));
        ctx.fillRect(Math.round(pr.sx), Math.round(pr.sy - 26 * e - r), Math.max(1, Math.round(e)), Math.round(2 * r));
      }
    },
  };
}

/** O mapa pequeno da arena, de cima: o piso claro, os obstáculos escuros, a água azul. */
export function mapaDaArena(a: Arena, lado: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = lado;
  const g = c.getContext('2d')!;
  const k = lado / MUNDO;
  // o mapa mostra só a arena, ampliada: o quadrado em volta dela
  const [x0, y0, x1, y1] = caixaDaArena(a);
  const z = MUNDO / Math.max(x1 - x0, y1 - y0);
  g.save();
  g.scale(k * z, k * z);
  g.translate(-x0, -y0);
  g.fillStyle = 'rgb(236, 228, 214)';
  if (a.circulo) {
    g.beginPath();
    g.arc(a.circulo[0], a.circulo[1], a.circulo[2], 0, Math.PI * 2);
    g.fill();
  } else {
    const r = a.retangulo!;
    g.fillRect(r[0], r[1], r[2] - r[0], r[3] - r[1]);
  }
  for (const [cx, cy, r, qual] of a.circulos) {
    g.fillStyle = qual === 'agua' ? 'rgb(92, 150, 190)' : 'rgb(120, 96, 84)';
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = 'rgb(150, 110, 70)';
  for (const [mx0, my0, mx1, my1] of a.muros) g.fillRect(mx0, my0, mx1 - mx0, my1 - my0);
  g.restore();
  return c;
}

/** O quadrado que contém a arena (com uma margem): é o que o mapa pequeno mostra. */
export function caixaDaArena(a: Arena): [number, number, number, number] {
  if (a.circulo) {
    const [cx, cy, r] = a.circulo;
    return [cx - r - 10, cy - r - 10, cx + r + 10, cy + r + 10];
  }
  const [x0, y0, x1, y1] = a.retangulo!;
  const m = Math.max(x1 - x0, y1 - y0) / 2 + 10;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  return [cx - m, cy - m, cx + m, cy + m];
}

/** Um ponto no mapa pequeno da arena. */
export function pontoNoMapaDaArena(ctx: CanvasRenderingContext2D, a: Arena, x0: number, y0: number, lado: number, x: number, y: number, cor: string) {
  const [bx0, by0, bx1] = caixaDaArena(a);
  const z = lado / (bx1 - bx0);
  const px = Math.round(x0 + (x - bx0) * z), py = Math.round(y0 + (y - by0) * z);
  ctx.fillStyle = '#1e1822';
  ctx.fillRect(px - 2, py - 2, 5, 5);
  ctx.fillStyle = cor;
  ctx.fillRect(px - 1, py - 1, 3, 3);
}

/** O quadro do item na mão, no alto e no meio (como o da corrida). */
export function quadroDoItem(d: Desenho, item: string | null) {
  const ctx = d.ctx;
  const x = W / 2 - 13, y = 6;
  ctx.fillStyle = '#1e1822';
  ctx.fillRect(x - 1, y - 1, 28, 24);
  ctx.fillStyle = '#3a3040';
  ctx.fillRect(x, y, 26, 22);
  ctx.fillStyle = '#fbf3e4';
  ctx.fillRect(x + 1, y + 1, 24, 1);
  if (!item) return;
  const nome = item === 'alface' ? 'escudo' : item;
  const fig = d.figuras[nome];
  if (!fig) return;
  const escala = item === 'lama' ? 1.2 : item === 'alface' ? 0.9 : 1.6;
  const w = Math.round(fig.width * escala), h = Math.round(fig.height * escala);
  ctx.drawImage(fig, Math.round(x + 13 - w / 2), Math.round(y + 11 - h / 2), w, h);
}

/** Os meus balões, no canto de cima à esquerda: os que sobram cheios, os perdidos vazios. */
export function meusBaloes(ctx: CanvasRenderingContext2D, quantos: number, total: number, cor: string) {
  for (let i = 0; i < total; i++) {
    const x = 12 + i * 13, y = 13;
    ctx.fillStyle = '#1e1822';
    ctx.beginPath();
    ctx.ellipse(x, y, 5.5, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = i < quantos ? cor : '#5a5060';
    ctx.beginPath();
    ctx.ellipse(x, y, 4.5, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
    if (i < quantos) {
      ctx.fillStyle = '#fff8ec';
      ctx.fillRect(x - 2, y - 3, 1, 2);
    }
    ctx.fillStyle = '#1e1822';
    ctx.fillRect(x, y + 6, 1, 4);
  }
}

/** A moldura do retrovisor (olhando para trás), como a da corrida. */
export function retrovisor(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#1e1822';
  ctx.fillRect(0, 0, W, 3);
  ctx.fillRect(0, H - 3, W, 3);
  ctx.fillRect(0, 0, 3, H);
  ctx.fillRect(W - 3, 0, 3, H);
  ctx.fillStyle = '#c8c0cc';
  ctx.fillRect(3, 3, W - 6, 1);
}

/** O semáforo da largada (três luzes vermelhas que acendem, e as verdes na saída). */
export function semaforo(ctx: CanvasRenderingContext2D, contagem: number) {
  const acesas = contagem > 0 ? Math.min(3, Math.max(0, 3 - Math.floor((contagem - 1) / 60))) : 3;
  const verde = contagem <= 0;
  const x0 = W / 2 - 27, y0 = 34;
  ctx.fillStyle = '#1e1822';
  ctx.fillRect(x0 - 4, y0 - 4, 62, 22);
  ctx.fillStyle = '#3a3040';
  ctx.fillRect(x0 - 3, y0 - 3, 60, 20);
  for (let i = 0; i < 3; i++) {
    const cx = x0 + 7 + i * 20;
    ctx.fillStyle = verde ? '#7ed060' : i < acesas ? '#e85a4a' : '#5a2a2a';
    ctx.fillRect(cx - 6, y0 + 1, 12, 12);
    ctx.fillStyle = verde ? '#c8f4a8' : i < acesas ? '#ffb0a0' : '#6a3434';
    ctx.fillRect(cx - 4, y0 + 3, 4, 4);
  }
}
