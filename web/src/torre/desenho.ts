import { H, QUADRO_H, QUADRO_W, W } from '../plataforma/desenho';
import { CORES_DOS_AVATARES } from '../corrida/coresDosAvatares';
import { altura, Bloco, blocoEm, COLUNAS, corvoEm, LARGURA, movelEm, quedaEm, T, type Ferramenta, type Tema, type Torre } from './fases';

/**
 * O DESENHO DA TORRE DO CELEIRO (05/11/2026): tudo por código, na mesma tela de 320 × 180 do Pulo do coelho, ampliada com
 * os pixels nítidos. A torre tem 288 de largura (18 casas) e fica entre as duas paredes do celeiro; a câmera só sobe e
 * desce. O fundo é a parede de tábuas de trás (que corre mais devagar), a torre inteira é pintada uma vez numa imagem alta,
 * e por cima vai o que se mexe: as vigas e as prateleiras, o que cai, os corvos, os fantasmas, os outros e o coelho.
 */

/** Onde a torre começa na tela (as paredes do celeiro ficam dos lados). */
export const OX = (W - LARGURA) / 2;

interface Cores {
  fundo: [string, string, string];
  fresta: string;
  parede: [string, string];
  viga: [string, string, string];
  tabua: [string, string];
  feno: [string, string, string];
  ceu: [string, string];
}

const CORES: Record<Tema, Cores> = {
  celeiro: {
    fundo: ['#9a4a3a', '#8a4032', '#a85a46'],
    fresta: '#f4d8a8',
    parede: ['#6a3026', '#4e2420'],
    viga: ['#6a4a36', '#54382a', '#7e5a42'],
    tabua: ['#c09060', '#8a6040'],
    feno: ['#e8c25a', '#c89a3a', '#f4dc8a'],
    ceu: ['#a8d0e8', '#e8ecd8'],
  },
  paiol: {
    fundo: ['#7a5a3e', '#6a4c34', '#8a6a4a'],
    fresta: '#f8b870',
    parede: ['#4e3624', '#3a281c'],
    viga: ['#5a3e2c', '#462e22', '#6e4e38'],
    tabua: ['#b88a5c', '#80583a'],
    feno: ['#e0b04e', '#b88634', '#f0cc7c'],
    ceu: ['#f0a070', '#f8d8a0'],
  },
  silo: {
    fundo: ['#3e4458', '#363c4e', '#4a5066'],
    fresta: '#9cb0d8',
    parede: ['#2a2e3c', '#20232e'],
    viga: ['#4a4048', '#3a3238', '#5a4e56'],
    tabua: ['#8e7458', '#665040'],
    feno: ['#b8a060', '#94803e', '#cab478'],
    ceu: ['#1e2442', '#3a4064'],
  },
};

export interface Pintura {
  ctx: CanvasRenderingContext2D;
  torre: Torre;
  cores: Cores;
  mapa: HTMLCanvasElement;
  fundo: HTMLCanvasElement;
  coelho: HTMLImageElement | null;
  /** Menos movimento: o que está para cair não treme e o corvo não bate as asas. */
  calmo: boolean;
}

const sorte = (c: number, l: number, k = 0) => {
  let h = (c * 73856093) ^ (l * 19349663) ^ (k * 83492791);
  h = (h ^ (h >>> 13)) * 1274126177;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

function tela(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

export function prepararPintura(canvas: HTMLCanvasElement, torre: Torre, calmo = false): Pintura {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const cores = CORES[torre.tema];
  return { ctx, torre, cores, mapa: pintarMapa(torre, cores), fundo: pintarFundo(cores), coelho: null, calmo };
}

/** A parede de trás: tábuas na vertical com frestas de luz, numa faixa de 320 × 512 que se repete na altura. */
function pintarFundo(cores: Cores): HTMLCanvasElement {
  const [c, ctx] = tela(W, 512);
  for (let x = 0; x < W; x += 12) {
    ctx.fillStyle = cores.fundo[(x / 12) % 2 ? 0 : 1];
    ctx.fillRect(x, 0, 12, 512);
    ctx.fillStyle = cores.fundo[2];
    ctx.fillRect(x + 1, 0, 1, 512);
    // a fresta entre duas tábuas, com a luz de fora
    ctx.fillStyle = '#00000030';
    ctx.fillRect(x + 11, 0, 1, 512);
    for (let k = 0; k < 4; k++) {
      if (sorte(x, k, 1) < 0.5) continue;
      ctx.fillStyle = cores.fresta;
      ctx.fillRect(x + 11, Math.floor(sorte(x, k, 2) * 480), 1, 6 + Math.floor(sorte(x, k, 3) * 20));
    }
    // os nós da madeira
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = '#00000022';
      ctx.fillRect(x + 3 + Math.floor(sorte(x, k, 4) * 6), Math.floor(sorte(x, k, 5) * 500), 3, 2);
    }
  }
  // uma janelinha redonda (as travessas de madeira na parede de trás pareciam assoalho: saíram, para a tela não enganar)
  const jx = 220, jy = 230;
  ctx.fillStyle = cores.viga[1];
  ctx.beginPath();
  ctx.arc(jx, jy, 19, 0, Math.PI * 2);
  ctx.fill();
  const ceu = ctx.createLinearGradient(0, jy - 16, 0, jy + 16);
  ceu.addColorStop(0, cores.ceu[0]);
  ceu.addColorStop(1, cores.ceu[1]);
  ctx.fillStyle = ceu;
  ctx.beginPath();
  ctx.arc(jx, jy, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = cores.viga[1];
  ctx.fillRect(jx - 1, jy - 15, 2, 30);
  ctx.fillRect(jx - 15, jy - 1, 30, 2);
  return c;
}

function pintarMapa(f: Torre, cores: Cores): HTMLCanvasElement {
  const [c, ctx] = tela(LARGURA, altura(f));
  for (let l = 0; l < f.linhas; l++) {
    for (let col = 0; col < COLUNAS; col++) {
      const b = blocoEm(f, col, l);
      const x = col * T, y = l * T;
      if (b === Bloco.Viga) {
        ctx.fillStyle = cores.viga[0];
        ctx.fillRect(x, y, T, T);
        // os veios da madeira, na horizontal
        ctx.fillStyle = cores.viga[1];
        ctx.fillRect(x, y + 5 + Math.floor(sorte(col, l) * 3), T, 1);
        ctx.fillRect(x + Math.floor(sorte(col, l, 1) * 10), y + 11, 6, 1);
        if (blocoEm(f, col, l - 1) !== Bloco.Viga) {
          ctx.fillStyle = cores.viga[2];
          ctx.fillRect(x, y, T, 2);
        }
        ctx.fillStyle = cores.viga[1];
        if (blocoEm(f, col, l + 1) !== Bloco.Viga) ctx.fillRect(x, y + T - 1, T, 1);
        // a cabeça do prego, de quatro em quatro
        if (col % 4 === 1) {
          ctx.fillStyle = '#2e2630';
          ctx.fillRect(x + 7, y + 3, 2, 2);
        }
      } else if (b === Bloco.Tabua) {
        tabua(ctx, x, y, T, cores, col);
      } else if (b === Bloco.Feno) {
        feno(ctx, f, col, l, cores);
      }
    }
  }
  // os andares de parede a parede ganham as mãos-francesas de baixo (de 6 em 6 casas)
  for (let l = 1; l < f.linhas; l++) {
    let cheia = true;
    for (let col = 0; col < COLUNAS && cheia; col++) if (blocoEm(f, col, l) !== Bloco.Tabua) cheia = false;
    if (!cheia) continue;
    for (const col of [0, 6, 12, 17]) {
      ctx.fillStyle = cores.tabua[1];
      const x = col * T + (col === 17 ? T - 3 : 0);
      ctx.fillRect(x, l * T + 6, 3, 6);
      ctx.fillRect(x + (col === 17 ? -3 : 0), l * T + 6, 6, 2);
    }
  }
  // os postos: a plaquinha com a cenoura
  f.postos.forEach((p, i) => {
    if (i === 0) return;
    ctx.fillStyle = '#6a4a36';
    ctx.fillRect(p.x - 1, p.y - 14, 2, 14);
    ctx.fillStyle = '#e8d8bc';
    ctx.fillRect(p.x - 6, p.y - 18, 12, 8);
    ctx.fillStyle = '#e07a2e';
    ctx.fillRect(p.x - 3, p.y - 16, 6, 2);
    ctx.fillRect(p.x - 2, p.y - 14, 4, 1);
    ctx.fillStyle = '#6fa356';
    ctx.fillRect(p.x + 3, p.y - 17, 2, 2);
  });
  // o chão de baixo: terra batida com palha
  const chao = f.largada.y;
  ctx.fillStyle = '#6a4e3a';
  ctx.fillRect(0, chao, LARGURA, altura(f) - chao);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = i % 2 ? '#e0c060' : '#584030';
    ctx.fillRect(Math.floor(sorte(i, 1, 7) * LARGURA), chao + 1 + Math.floor(sorte(i, 2, 7) * 12), 4, 1);
  }
  // O TOPO: o telhado de duas águas, aberto no meio para o céu, e o cata-vento na frente (o mastro, a seta e a cenoura)
  const cx = LARGURA / 2, topo = f.chegada;
  const ceu = ctx.createLinearGradient(0, 0, 0, topo);
  ceu.addColorStop(0, cores.ceu[0]);
  ceu.addColorStop(1, cores.ceu[1]);
  for (let y = 0; y < topo; y++) {
    const meia = Math.round(12 + (y / topo) * (LARGURA / 2 - 30));
    ctx.fillStyle = ceu;
    ctx.fillRect(cx - meia, y, meia * 2, 1);
    ctx.fillStyle = cores.viga[(y >> 2) % 2 ? 0 : 1];
    ctx.fillRect(0, y, cx - meia, 1);
    ctx.fillRect(cx + meia, y, LARGURA - cx - meia, 1);
    ctx.fillStyle = cores.viga[2];
    ctx.fillRect(cx - meia - 3, y, 3, 1);
    ctx.fillRect(cx + meia, y, 3, 1);
  }
  if (f.tema === 'silo') {
    for (let i = 0; i < 14; i++) {
      const y = 4 + Math.floor(sorte(i, 4, 9) * (topo - 30));
      const meia = 12 + (y / topo) * (LARGURA / 2 - 30) - 4;
      ctx.fillStyle = i % 3 ? '#c8d0f0' : '#f4ead8';
      ctx.fillRect(Math.round(cx + (sorte(i, 3, 9) * 2 - 1) * meia), y, 1, 1);
    }
  }
  ctx.fillStyle = '#4a3a40';
  ctx.fillRect(cx - 1, topo - 50, 3, 50);
  ctx.fillRect(cx - 14, topo - 30, 30, 2);
  ctx.fillStyle = '#e3b45a';
  ctx.fillRect(cx - 20, topo - 46, 34, 3);
  ctx.fillRect(cx - 22, topo - 49, 6, 9);
  ctx.fillStyle = '#e07a2e';
  for (let i = 0; i < 6; i++) ctx.fillRect(cx + 14 + i, topo - 47 + Math.floor(i / 2), 6 - i, 1 + (i < 3 ? 1 : 0));
  ctx.fillStyle = '#6fa356';
  ctx.fillRect(cx + 12, topo - 49, 3, 2);
  ctx.fillStyle = '#e3b45a';
  ctx.fillRect(cx - 2, topo - 54, 5, 5);
  return c;
}

function tabua(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, cores: Cores, semente = 0) {
  ctx.fillStyle = cores.tabua[1];
  ctx.fillRect(x, y, w, 6);
  ctx.fillStyle = cores.tabua[0];
  ctx.fillRect(x, y, w, 4);
  ctx.fillStyle = cores.tabua[1];
  for (let i = 4 + (semente % 3) * 3; i < w; i += 16) ctx.fillRect(x + i, y + 1, 1, 1);
}

/** O fardo de feno: amarelo, com os fios de palha e as duas cordas. Cada fardo tem 3 × 2 casas (ou menos). */
function feno(ctx: CanvasRenderingContext2D, f: Torre, col: number, l: number, cores: Cores) {
  const x = col * T, y = l * T;
  ctx.fillStyle = cores.feno[0];
  ctx.fillRect(x, y, T, T);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = i % 2 ? cores.feno[1] : cores.feno[2];
    ctx.fillRect(x + Math.floor(sorte(col, l, i) * 12), y + Math.floor(sorte(col, l, i + 7) * 15), 3 + (i % 3), 1);
  }
  ctx.fillStyle = cores.feno[1];
  if (blocoEm(f, col - 1, l) !== Bloco.Feno) ctx.fillRect(x, y, 1, T);
  if (blocoEm(f, col + 1, l) !== Bloco.Feno) ctx.fillRect(x + T - 1, y, 1, T);
  if (blocoEm(f, col, l + 1) !== Bloco.Feno) ctx.fillRect(x, y + T - 1, T, 1);
  if (blocoEm(f, col, l - 1) !== Bloco.Feno) {
    ctx.fillStyle = cores.feno[2];
    ctx.fillRect(x, y, T, 2);
  }
  // as cordas: duas faixas na vertical, a 5 e a 11 px de cada casa
  ctx.fillStyle = '#8a5a3a';
  ctx.fillRect(x + 5, y, 1, T);
  ctx.fillRect(x + 11, y, 1, T);
}

/** A ferramenta (ou o saco), centrada em (x, y), por código. */
function ferramenta(ctx: CanvasRenderingContext2D, tipo: Ferramenta, x: number, y: number) {
  const r = (dx: number, dy: number, w: number, h: number, cor: string) => {
    ctx.fillStyle = cor;
    ctx.fillRect(x + dx, y + dy, w, h);
  };
  if (tipo === 'saco') {
    r(-5, -3, 10, 9, '#c8b08a');
    r(-4, -5, 8, 2, '#c8b08a');
    r(-2, -7, 4, 2, '#8a6a4a');
    r(-5, 5, 10, 1, '#9a8060');
    r(-3, -1, 6, 3, '#e0cca8');
  } else if (tipo === 'pa') {
    r(-1, -9, 2, 10, '#8a5a3a');
    r(-3, -10, 6, 2, '#5a3a2a');
    r(-4, 1, 8, 7, '#9aa4ac');
    r(-3, 7, 6, 2, '#9aa4ac');
    r(-4, 1, 8, 1, '#c8d0d8');
  } else if (tipo === 'regador') {
    r(-5, -3, 8, 8, '#5e9a5a');
    r(-5, -3, 8, 1, '#8ac080');
    r(3, -2, 5, 2, '#5e9a5a');
    r(7, -4, 2, 3, '#4a7a48');
    r(-4, -6, 6, 1, '#4a7a48');
    r(-4, -6, 1, 3, '#4a7a48');
    r(1, -6, 1, 3, '#4a7a48');
  } else {
    r(-1, -9, 2, 12, '#8a5a3a');
    r(-6, 3, 12, 2, '#7a848c');
    for (let i = 0; i < 6; i++) r(-6 + i * 2, 5, 1, 3, '#7a848c');
  }
}

function corvo(ctx: CanvasRenderingContext2D, x: number, y: number, lado: number, batida: boolean) {
  ctx.save();
  ctx.translate(x, y);
  if (lado < 0) ctx.scale(-1, 1);
  const r = (dx: number, dy: number, w: number, h: number, cor: string) => {
    ctx.fillStyle = cor;
    ctx.fillRect(dx, dy, w, h);
  };
  r(-6, -2, 10, 5, '#241e2a');
  r(3, -4, 4, 4, '#241e2a');
  r(7, -2, 3, 1, '#e3a53a');
  r(5, -3, 1, 1, '#f4ead8');
  r(-9, -1, 4, 2, '#241e2a');
  if (batida) r(-4, -7, 6, 5, '#3a3242');
  else r(-4, 2, 6, 4, '#3a3242');
  ctx.restore();
}

export interface Figura {
  x: number;
  y: number;
  jeito: number;
  andado: number | null;
  alpha?: number;
  nome?: string;
  piscando?: boolean;
  avatar?: number | null;
}

/** Desenha a cena com a câmera em camY (o alto da tela, no mundo), no passo n da subida de quem se vê. */
export function pintar(p: Pintura, camY: number, n: number, figuras: Figura[]) {
  const { ctx, cores, torre: f } = p;
  // a parede de trás corre a 60%
  const dy = -Math.floor((camY * 0.6) % 512);
  ctx.drawImage(p.fundo, 0, dy);
  ctx.drawImage(p.fundo, 0, dy + 512);
  const cy = Math.floor(camY);
  ctx.drawImage(p.mapa, 0, cy, LARGURA, H, OX, 0, LARGURA, H);
  // AS VIGAS E AS PRATELEIRAS QUE ANDAM
  for (const m of f.moveis) {
    const q = movelEm(m, n);
    const x = Math.round(q.x + OX), y = Math.round(q.y - camY);
    if (y < -40 || y > H + 10) continue;
    if (m.tipo === 'viga') {
      // as cordas que a seguram, até o alto da tela
      ctx.fillStyle = '#c8b08a';
      ctx.fillRect(x + 2, 0, 1, Math.max(0, y));
      ctx.fillRect(x + m.w - 3, 0, 1, Math.max(0, y));
      ctx.fillStyle = cores.viga[0];
      ctx.fillRect(x, y, m.w, 8);
      ctx.fillStyle = cores.viga[2];
      ctx.fillRect(x, y, m.w, 2);
      ctx.fillStyle = cores.viga[1];
      ctx.fillRect(x, y + 7, m.w, 1);
    } else {
      tabua(ctx, x, y, m.w, cores);
      ctx.fillStyle = '#5a4a50';
      ctx.fillRect(x + 3, y + 6, 2, 4);
      ctx.fillRect(x + m.w - 5, y + 6, 2, 4);
    }
  }
  // O QUE CAI: tremendo lá em cima (com a marca de onde vai bater), caindo, e a poeira embaixo
  for (const q of f.quedas) {
    const e = quedaEm(q, n);
    if (!e) continue;
    const x = q.x + OX;
    if (e.estado === 'aviso') {
      const treme = p.calmo ? 0 : (e.t >> 2) % 2 ? 1 : -1;
      ctx.fillStyle = '#c8b08a';
      ctx.fillRect(x, Math.round(q.y0 - camY) - 10, 1, 3);
      ferramenta(ctx, q.tipo, x + treme, Math.round(q.y0 - camY));
      // a marca no degrau, piscando
      if ((e.t >> 3) % 2 === 0) {
        ctx.fillStyle = '#1e182260';
        ctx.fillRect(x - 6, Math.round(q.y1 - camY) + 5, 12, 2);
      }
    } else if (e.estado === 'caindo') {
      const y = Math.round(e.y - camY);
      if (y > -20 && y < H + 20) ferramenta(ctx, q.tipo, x, y);
    } else {
      const y = Math.round(q.y1 - camY) + 4;
      ctx.fillStyle = '#e8dcc0a0';
      for (let i = 0; i < 5; i++) ctx.fillRect(x - 8 + i * 4 - (e.t >> 1), y - 2 - ((i * 3 + e.t) % 4), 3, 2);
    }
  }
  for (const k of f.corvos) {
    const c = corvoEm(k, n);
    const y = Math.round(c.y - camY);
    if (y < -12 || y > H + 12) continue;
    corvo(ctx, Math.round(c.x + OX), y, c.lado, !p.calmo && (n >> 3) % 2 === 0);
  }
  for (const fi of figuras) desenharCoelho(p, fi, camY);
  // as paredes do celeiro, dos dois lados
  for (const x0 of [0, W - OX]) {
    ctx.fillStyle = cores.parede[0];
    ctx.fillRect(x0, 0, OX, H);
    ctx.fillStyle = cores.parede[1];
    ctx.fillRect(x0 + (x0 ? 0 : OX - 2), 0, 2, H);
    for (let k = -1; k < 8; k++) {
      const y = k * 32 - (cy % 32);
      ctx.fillRect(x0, y, OX, 2);
    }
  }
}

function desenharCoelho(p: Pintura, f: Figura, camY: number) {
  const { ctx } = p;
  if (!p.coelho || f.piscando) return;
  const quadro = Math.abs(f.jeito) === 2 ? 2 : f.andado === null ? 8 : Math.floor(f.andado / 6) % 8;
  const x = Math.round(f.x + OX), y = Math.round(f.y - camY);
  if (y < -10 || y > H + QUADRO_H) return;
  ctx.save();
  ctx.globalAlpha = f.alpha ?? 1;
  ctx.translate(x, y);
  if (f.jeito < 0) ctx.scale(-1, 1);
  ctx.drawImage(folhaDaTorre(p.coelho, f.avatar ?? null), quadro * QUADRO_W, 0, QUADRO_W, QUADRO_H, -Math.floor(QUADRO_W / 2), -QUADRO_H + 1, QUADRO_W, QUADRO_H);
  ctx.restore();
  if (f.nome) {
    ctx.font = '7px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#140e18';
    ctx.fillText(f.nome, x + 1, y - QUADRO_H - 1);
    ctx.fillStyle = '#f4ead8';
    ctx.fillText(f.nome, x, y - QUADRO_H - 2);
    ctx.textAlign = 'start';
  }
}

/** A barra do quanto se subiu, na parede da direita: os fantasmas e os outros em pontinhos, você em laranja. */
export function barraDaSubida(ctx: CanvasRenderingContext2D, pontos: { andou: number; cor: string }[]) {
  const x = W - OX / 2 - 1, y0 = 22, y1 = H - 14;
  ctx.fillStyle = '#1e1822a0';
  ctx.fillRect(x - 2, y0 - 2, 6, y1 - y0 + 4);
  ctx.fillStyle = '#f4ead860';
  ctx.fillRect(x, y0, 2, y1 - y0);
  ctx.fillStyle = '#e3b45a';
  ctx.fillRect(x - 1, y0 - 4, 4, 3);
  for (const p of pontos) {
    ctx.fillStyle = p.cor;
    ctx.fillRect(x - 1, Math.round(y1 - (y1 - y0) * Math.max(0, Math.min(1, p.andou))) - 1, 4, 3);
  }
}

/**
 * O COELHO DE CADA UM: a troca de paleta da corrida (folhaDoAvatar, em corrida/render.ts), com TOLERÂNCIA. A folha do Pulo
 * (plataforma/coelho.png) foi reduzida com as cores suavizadas, e a troca exata da corrida só achava uns poucos pixels.
 * Aqui o pelo é o tom claro e frio (o azul não fica abaixo do vermelho) e o moletom o escuro quente (o vermelho acima do
 * azul); o resto (os olhos, o nariz, o contorno quase preto) fica como está. Sem avatar pronto, o mascote.
 */
const folhasDaTorre = new Map<number, HTMLCanvasElement>();
const luz = (r: number, g: number, b: number) => 0.3 * r + 0.59 * g + 0.11 * b;
export function folhaDaTorre(base: HTMLImageElement, avatar: number | null): CanvasImageSource {
  const cores = avatar !== null ? CORES_DOS_AVATARES[avatar] : undefined;
  if (!cores || !base.complete || !base.naturalWidth) return base;
  const pronta = folhasDaTorre.get(avatar!);
  if (pronta) return pronta;
  const c = document.createElement('canvas');
  c.width = base.naturalWidth;
  c.height = base.naturalHeight;
  const g = c.getContext('2d')!;
  g.drawImage(base, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height);
  const px = img.data;
  const peloBase = luz(224, 210, 237), moletomBase = luz(61, 43, 54);
  for (let i = 0; i < px.length; i += 4) {
    if (!px[i + 3]) continue;
    const [r, gg, b] = [px[i], px[i + 1], px[i + 2]];
    const l = luz(r, gg, b);
    let alvo: [number, number, number] | null = null, f = 1;
    if (b >= r - 4 && l >= 70) {
      alvo = cores.pelo;
      f = l / peloBase;
    } else if (r > b && l >= 22 && l < 90) {
      alvo = cores.roupa;
      f = 0.72 + (0.28 * l) / moletomBase;
    }
    if (!alvo) continue;
    px[i] = Math.min(255, Math.round(alvo[0] * f));
    px[i + 1] = Math.min(255, Math.round(alvo[1] * f));
    px[i + 2] = Math.min(255, Math.round(alvo[2] * f));
  }
  g.putImageData(img, 0, 0);
  folhasDaTorre.set(avatar!, c);
  return c;
}
