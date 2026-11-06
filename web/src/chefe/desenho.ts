/**
 * O DESENHO DO CHEFE DA TURMA (05/11/2026): tudo por código, numa tela de 480 × 270 ampliada com os pixels nítidos — a arena
 * da horta vista de cima (a cerca, os canteiros, as tocas), a TOUPEIRA-REI de capacete de minerador (com a coroa pintada no
 * capacete e a capa), os avisos no chão, os torrões, as pedras e as bombas de semente. Só o coelho é imagem: o mesmo da Briga
 * na horta (web/public/briga/coelho.png), com a troca de paleta do avatar.
 */
import { ARENA, H, TOCAS, W } from './conta';
import type { ChefeNaTela, Efeito, MarcaNaTela } from './regras';

const PELE = '#4b3d45';
const PELE_CLARA = '#6e5a63';
const PELE_ESCURA = '#33282f';
const FOCINHO = '#e89aa4';
const MAO = '#f0b0b4';
const UNHA = '#fbf3e4';
const CAPACETE = '#e9b949';
const CAPACETE_CLARO = '#f7d77c';
const CAPACETE_ESCURO = '#b88a2e';
const CAPA = '#b8434a';
const CAPA_ESCURA = '#8a2e36';
const LUZ = '#fff6c8';
const CONTORNO = '#1e1822';

const px = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cor: string) => {
  g.fillStyle = cor;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

/** Um disco cheio, em pixels (sem o borrado do arco). */
function disco(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, cor: string) {
  g.fillStyle = cor;
  const x0 = Math.round(cx), y0 = Math.round(cy);
  for (let dy = -ry; dy <= ry; dy++) {
    const k = 1 - (dy * dy) / (ry * ry || 1);
    const w = Math.round(rx * Math.sqrt(Math.max(0, k)));
    g.fillRect(x0 - w, y0 + dy, w * 2 + 1, 1);
  }
}

/** Um anel (contorno de elipse) em pixels. */
function anel(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, cor: string, tracejado = 0, fase = 0) {
  g.fillStyle = cor;
  const n = Math.max(24, Math.round((rx + ry) * 2));
  for (let k = 0; k < n; k++) {
    if (tracejado && Math.floor((k + fase) / tracejado) % 2) continue;
    const a = (k / n) * Math.PI * 2;
    g.fillRect(Math.round(cx + Math.cos(a) * rx), Math.round(cy + Math.sin(a) * ry), 1, 1);
  }
}

// ---------------- A ARENA (desenhada uma vez) ----------------
let arenaPronta: HTMLCanvasElement | null = null;

function ruido(x: number, y: number) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

function desenharArenaUmaVez(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  // a grama em volta
  px(g, 0, 0, W, H, '#7f9a5a');
  for (let y = 0; y < H; y += 3) for (let x = (y / 3) % 2 ? 1 : 0; x < W; x += 5) if (ruido(x, y) > 0.72) px(g, x, y, 1, 2, '#93ad69');
  // a sebe e a cerca do fundo
  px(g, 0, 22, W, 30, '#5f7d47');
  for (let x = 0; x < W; x += 6) disco(g, x + 3, 24 + (x % 12 ? 0 : 2), 5, 4, '#6d8c50');
  px(g, 0, 50, W, 3, '#9a7652');
  px(g, 0, 58, W, 3, '#9a7652');
  for (let x = 4; x < W; x += 16) {
    px(g, x, 44, 4, 22, '#8a6a4c');
    px(g, x, 44, 1, 22, '#b08a62');
  }
  // os canteiros de cima, atrás da cerca baixa (cenoura e repolho)
  for (let x = 10; x < W; x += 22) {
    px(g, x, 66, 3, 8, '#6f9a4e');
    px(g, x + 4, 64, 2, 9, '#7fae58');
    px(g, x + 1, 72, 4, 3, '#d98a3e');
  }
  // o chão de terra da arena, com as borda irregular
  const { x0, x1, y0, y1 } = ARENA;
  px(g, x0 - 14, y0 - 10, x1 - x0 + 28, y1 - y0 + 22, '#8a6a4c');
  for (let x = x0 - 14; x < x1 + 14; x += 3) {
    px(g, x, y0 - 12 - Math.round(ruido(x, 1) * 3), 3, 3, '#8a6a4c');
    px(g, x, y1 + 10 + Math.round(ruido(x, 2) * 3), 3, 3, '#8a6a4c');
  }
  // os sulcos da terra arada (faixas suaves) e os torrõezinhos
  for (let y = y0 - 6; y < y1 + 10; y += 12) px(g, x0 - 12, y, x1 - x0 + 24, 5, '#94735a');
  for (let k = 0; k < 520; k++) {
    const x = x0 - 10 + ruido(k, 3) * (x1 - x0 + 20);
    const y = y0 - 8 + ruido(k, 4) * (y1 - y0 + 16);
    px(g, x, y, ruido(k, 5) > 0.6 ? 2 : 1, 1, ruido(k, 6) > 0.5 ? '#7a5a40' : '#a3805f');
  }
  // umas pedrinhas e uma cenoura esquecida
  for (let k = 0; k < 14; k++) {
    const x = x0 + ruido(k, 7) * (x1 - x0);
    const y = y0 + ruido(k, 8) * (y1 - y0);
    px(g, x, y, 3, 2, '#b8a48c');
    px(g, x, y + 2, 3, 1, '#6e5440');
  }
  // as tocas: o buraco e a terra em volta
  for (const [tx, ty] of TOCAS) {
    disco(g, tx, ty + 2, 22, 9, '#6e5038');
    disco(g, tx, ty + 1, 18, 7, '#a3805f');
    disco(g, tx, ty + 2, 15, 6, '#3a2a26');
    disco(g, tx, ty + 3, 11, 4, '#241a1a');
    for (let k = 0; k < 6; k++) px(g, tx - 20 + ruido(k, tx) * 40, ty - 6 + ruido(k, ty) * 3, 3, 2, '#7a5a40');
  }
  // a cerca baixa da frente (só os mourões, para não esconder ninguém)
  for (let x = 6; x < W; x += 30) {
    px(g, x, H - 12, 4, 12, '#8a6a4c');
    px(g, x, H - 12, 1, 12, '#b08a62');
  }
  return c;
}

export function desenharArena(g: CanvasRenderingContext2D) {
  if (!arenaPronta) arenaPronta = desenharArenaUmaVez();
  g.drawImage(arenaPronta, 0, 0);
}

// ---------------- AS SOMBRAS E OS AVISOS ----------------
export function sombra(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  g.globalAlpha = 0.35;
  disco(g, x, y, rx, ry, '#2a1e1a');
  g.globalAlpha = 1;
}

/** As marcas no chão vão por baixo de tudo; o que voa (pedra, torrão) vai depois, em `desenharNoAr`. */
export function desenharMarcaNoChao(g: CanvasRenderingContext2D, m: MarcaNaTela, tempo: number) {
  const pisca = Math.floor(tempo / 110) % 2 === 0;
  const s = m.total > 0 ? Math.max(0, Math.min(1, 1 - m.resta / m.total)) : 1;
  if (m.resta < 0) {
    // depois do impacto: a onda do anel, a poeira da pedra e do torrão
    const k = Math.min(1, -m.resta / 400);
    if (m.tipo === 'anel') {
      g.globalAlpha = 1 - k;
      anel(g, m.x, m.y, m.r * (0.4 + k * 0.7), m.r * (0.4 + k * 0.7) * 0.62, '#fbf3e4');
      anel(g, m.x, m.y, m.r * (0.4 + k * 0.7) - 2, (m.r * (0.4 + k * 0.7) - 2) * 0.62, '#c4a888');
      g.globalAlpha = 1;
    } else if (m.tipo === 'pedra') {
      g.globalAlpha = 1 - k;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        px(g, m.x + Math.cos(a) * (6 + k * 14), m.y + Math.sin(a) * (3 + k * 7), 3, 2, '#9c8c7a');
      }
      g.globalAlpha = 1;
      disco(g, m.x, m.y, 7, 4, '#8e8070');
      disco(g, m.x - 1, m.y - 2, 5, 3, '#b2a28e');
    }
    return;
  }
  if (m.tipo === 'anel') {
    // o círculo do terremoto: enche de vermelho conforme chega a hora
    g.globalAlpha = 0.12 + 0.28 * s;
    disco(g, m.x, m.y, m.r, Math.round(m.r * 0.62), '#e2574a');
    g.globalAlpha = 1;
    anel(g, m.x, m.y, m.r, m.r * 0.62, pisca ? '#e2574a' : '#ffd36a', 4, Math.floor(tempo / 60));
    anel(g, m.x, m.y, m.r * s, m.r * s * 0.62, '#fbf3e4');
  } else if (m.tipo === 'pedra') {
    g.globalAlpha = 0.5;
    disco(g, m.x, m.y, Math.round(m.r * (0.4 + 0.6 * s)), Math.round(m.r * (0.4 + 0.6 * s) * 0.6), '#2a1e1a');
    g.globalAlpha = 1;
    anel(g, m.x, m.y, m.r, m.r * 0.6, pisca ? '#e2574a' : '#ffd36a');
  } else if (m.tipo === 'torrao') {
    const r = m.r;
    g.globalAlpha = 0.45;
    disco(g, m.x2, m.y2, Math.round(r * (0.3 + 0.7 * s)), Math.round(r * (0.3 + 0.7 * s) * 0.6), '#2a1e1a');
    g.globalAlpha = 1;
    anel(g, m.x2, m.y2, r, r * 0.6, m.frio ? (pisca ? '#7ec8e3' : '#d6f0fa') : pisca ? '#e2574a' : '#ffd36a');
  } else if (m.tipo === 'investida') {
    // o corredor da investida: as duas bordas tracejadas e as setas
    const dx = m.x2 - m.x, dy = m.y2 - m.y;
    const L = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / L, uy = dy / L;
    const nx = -uy * m.r, ny = ux * m.r;
    g.globalAlpha = 0.16 + 0.2 * s;
    g.fillStyle = '#e2574a';
    g.beginPath();
    g.moveTo(m.x + nx, m.y + ny);
    g.lineTo(m.x2 + nx, m.y2 + ny);
    g.lineTo(m.x2 - nx, m.y2 - ny);
    g.lineTo(m.x - nx, m.y - ny);
    g.closePath();
    g.fill();
    g.globalAlpha = 1;
    const fase = (tempo / 40) % 12;
    for (let d = fase; d < L; d += 12) {
      px(g, m.x + ux * d + nx, m.y + uy * d + ny, 2, 1, pisca ? '#e2574a' : '#ffd36a');
      px(g, m.x + ux * d - nx, m.y + uy * d - ny, 2, 1, pisca ? '#e2574a' : '#ffd36a');
    }
    for (let d = 30 + ((tempo / 25) % 30); d < L; d += 30) {
      const cx = m.x + ux * d, cy = m.y + uy * d;
      for (let k = 0; k < 6; k++) {
        px(g, cx - ux * k + (-uy) * k, cy - uy * k + ux * k, 2, 2, '#fbf3e4');
        px(g, cx - ux * k - (-uy) * k, cy - uy * k - ux * k, 2, 2, '#fbf3e4');
      }
    }
  }
}

/** O que está no ar: a pedra caindo e o torrão em arco (desenhados por cima dos bichos). */
export function desenharNoAr(g: CanvasRenderingContext2D, m: MarcaNaTela, tempo: number) {
  if (m.resta < 0) return;
  const s = m.total > 0 ? Math.max(0, Math.min(1, 1 - m.resta / m.total)) : 1;
  if (m.tipo === 'pedra') {
    if (m.resta > 700) return;
    const alto = (m.resta / 700) * 150;
    pedra(g, m.x, m.y - alto - 4);
  } else if (m.tipo === 'torrao') {
    const x = m.x + (m.x2 - m.x) * s;
    const y = m.y + (m.y2 - m.y) * s - 22;
    const alto = 4 * 70 * s * (1 - s);
    torrao(g, x, y - alto, m.frio, tempo);
  }
}

function pedra(g: CanvasRenderingContext2D, x: number, y: number) {
  disco(g, x, y, 7, 6, CONTORNO);
  disco(g, x, y, 6, 5, '#8e8070');
  disco(g, x - 1, y - 2, 4, 2, '#b2a28e');
  px(g, x + 2, y + 1, 2, 2, '#6e6252');
}

export function torrao(g: CanvasRenderingContext2D, x: number, y: number, frio: boolean, tempo: number) {
  disco(g, x, y, 5, 4, CONTORNO);
  disco(g, x, y, 4, 3, frio ? '#8cb7c8' : '#7a5a40');
  px(g, x - 2, y - 2, 3, 1, frio ? '#d6f0fa' : '#a3805f');
  px(g, x + 1, y, 2, 2, frio ? '#5f8fa3' : '#5c4434');
  if (frio && Math.floor(tempo / 160) % 3 === 0) {
    px(g, x + 4, y - 5, 1, 3, '#ffffff');
    px(g, x + 3, y - 4, 3, 1, '#ffffff');
  }
}

/** O torrão frio esperando no chão: brilha, e pisca quando vai sumir. */
export function desenharTorraoNoChao(g: CanvasRenderingContext2D, x: number, y: number, resta: number, tempo: number) {
  if (resta < 1500 && Math.floor(tempo / 120) % 2) return;
  g.globalAlpha = 0.25 + 0.15 * Math.abs(Math.sin(tempo / 300));
  disco(g, x, y + 1, 10, 5, '#d6f0fa');
  g.globalAlpha = 1;
  torrao(g, x, y - 3, true, tempo);
}

/** A bomba de semente em voo: uma bola verde com uma folhinha. */
export function desenharBomba(g: CanvasRenderingContext2D, x0: number, y0: number, x: number, y: number, s: number) {
  const bx = x0 + (x - x0) * s;
  const by = y0 + (y - y0) * s - 18 - 4 * 40 * s * (1 - s);
  sombra(g, x0 + (x - x0) * s, y0 + (y - y0) * s, 4, 2);
  disco(g, bx, by, 5, 5, CONTORNO);
  disco(g, bx, by, 4, 4, '#5f8f3e');
  px(g, bx - 2, by - 2, 2, 2, '#9cc072');
  px(g, bx, by - 7, 2, 3, '#6f9a4e');
  px(g, bx + 2, by - 8, 3, 2, '#9cc072');
}

// ---------------- A TOUPEIRA-REI ----------------
/** O capacete de minerador, com a coroa pintada na frente e a lanterna acesa. */
function capacete(g: CanvasRenderingContext2D, x: number, y: number, lado: number, inclina = 0) {
  disco(g, x + inclina, y, 15, 9, CONTORNO);
  disco(g, x + inclina, y, 14, 8, CAPACETE);
  disco(g, x + inclina - 4, y - 4, 6, 3, CAPACETE_CLARO);
  px(g, x - 17 + inclina, y + 5, 34, 3, CONTORNO);
  px(g, x - 16 + inclina, y + 5, 32, 2, CAPACETE_ESCURO);
  // a coroa pequena, em cima do capacete (é ela que diz "rei")
  const cx = x + inclina - lado * 3;
  const cy = y - 9;
  px(g, cx - 7, cy - 1, 15, 5, CONTORNO);
  px(g, cx - 7, cy - 6, 3, 5, CONTORNO);
  px(g, cx - 1, cy - 8, 3, 7, CONTORNO);
  px(g, cx + 5, cy - 6, 3, 5, CONTORNO);
  px(g, cx - 6, cy, 13, 3, '#ffd36a');
  px(g, cx - 6, cy - 5, 1, 5, '#ffd36a');
  px(g, cx, cy - 7, 1, 7, '#ffd36a');
  px(g, cx + 6, cy - 5, 1, 5, '#ffd36a');
  px(g, cx - 6, cy + 2, 13, 1, '#c98a2a');
  px(g, cx, cy, 1, 2, CAPA);
  px(g, cx - 4, cy + 1, 1, 1, '#7ec8e3');
  px(g, cx + 4, cy + 1, 1, 1, '#7ec8e3');
  // a lanterna, do lado para onde ela olha
  const lx = x + inclina + lado * 9;
  disco(g, lx, y - 5, 4, 4, CONTORNO);
  disco(g, lx, y - 5, 3, 3, LUZ);
  px(g, lx - 1, y - 6, 1, 1, '#ffffff');
}

function mao(g: CanvasRenderingContext2D, x: number, y: number, lado: number) {
  disco(g, x, y, 7, 5, CONTORNO);
  disco(g, x, y, 6, 4, MAO);
  for (let k = -1; k <= 1; k++) px(g, x + lado * 6, y + k * 3 - 1, 3, 2, UNHA);
}

function corpo(g: CanvasRenderingContext2D, x: number, y: number, achata: number) {
  const ry = Math.round(18 * achata);
  disco(g, x, y - ry, 23, ry + 1, CONTORNO);
  disco(g, x, y - ry, 22, ry, PELE);
  disco(g, x - 6, y - ry - 6, 10, Math.max(2, ry - 10), PELE_CLARA);
  disco(g, x, y - 4, 16, 4, PELE_ESCURA);
}

function rosto(g: CanvasRenderingContext2D, x: number, y: number, lado: number, olhos: 'normal' | 'tonta' | 'brava' | 'x') {
  // a cara mais clara, o focinho cor-de-rosa para o lado em que olha
  disco(g, x + lado * 3, y + 2, 13, 7, PELE_CLARA);
  disco(g, x + lado * 3, y + 3, 11, 5, '#8a7680');
  const fx = x + lado * 6;
  disco(g, fx, y + 4, 7, 4, CONTORNO);
  disco(g, fx, y + 4, 6, 3, FOCINHO);
  px(g, fx + lado * 4 - 1, y + 2, 3, 2, '#c0606e');
  px(g, fx - lado * 2, y + 7, 4, 1, '#c0606e');
  // os olhinhos pequenos
  for (const ox of [x - 5 + lado * 1, x + 5 + lado * 1]) {
    if (olhos === 'tonta') {
      px(g, ox - 1, y - 2, 3, 1, CONTORNO);
      px(g, ox + 1, y - 1, 1, 2, CONTORNO);
      px(g, ox - 1, y + 1, 3, 1, CONTORNO);
    } else if (olhos === 'x') {
      px(g, ox - 1, y - 2, 1, 1, CONTORNO);
      px(g, ox + 1, y - 2, 1, 1, CONTORNO);
      px(g, ox, y - 1, 1, 1, CONTORNO);
      px(g, ox - 1, y, 1, 1, CONTORNO);
      px(g, ox + 1, y, 1, 1, CONTORNO);
    } else {
      px(g, ox - 1, y - 2, 3, 3, CONTORNO);
      px(g, ox, y - 2, 1, 1, '#ffffff');
      if (olhos === 'brava') px(g, ox - 2, y - 4, 5, 1, CONTORNO);
    }
  }
}

function capa(g: CanvasRenderingContext2D, x: number, y: number, vento: number) {
  g.fillStyle = CAPA_ESCURA;
  g.beginPath();
  g.moveTo(x - 18, y - 30);
  g.lineTo(x + 18, y - 30);
  g.lineTo(x + 24 + vento, y - 2);
  g.lineTo(x - 24 + vento, y - 2);
  g.closePath();
  g.fill();
  g.fillStyle = CAPA;
  g.fillRect(Math.round(x - 20 + vento / 2), y - 26, 40, 20);
  px(g, x - 22 + vento, y - 4, 44, 2, '#e2c27a');
}

/** Quantos px do corpo estão para fora da terra (saindo e entrando). */
function fora(c: ChefeNaTela): number {
  const t = c.passos * 50;
  if (c.estado === 'saindo') return Math.min(1, t / 650);
  if (c.estado === 'entrando') return Math.max(0, 1 - t / 500);
  return 1;
}

export function desenharChefe(g: CanvasRenderingContext2D, c: ChefeNaTela, tempo: number, piscando: boolean) {
  const x = Math.round(c.x);
  const y = Math.round(c.y);
  const lado = c.lado >= 0 ? 1 : -1;
  const t = c.passos * 50;
  if (c.estado === 'embaixo') {
    // o montinho de terra que anda, e a lanterna do capacete espiando
    sombra(g, x, y + 1, 14, 4);
    disco(g, x, y - 3, 13, 6, '#6e5038');
    disco(g, x - 2, y - 5, 9, 4, '#8a6a4c');
    for (let k = 0; k < 4; k++) px(g, x - 12 + ((k * 7 + Math.floor(tempo / 90)) % 24), y - 2 - (k % 2) * 4, 3, 2, '#a3805f');
    if (Math.floor(tempo / 400) % 2) {
      disco(g, x + lado * 3, y - 9, 3, 2, CAPACETE);
      px(g, x + lado * 5, y - 11, 2, 2, LUZ);
    }
    return;
  }
  if (piscando && Math.floor(tempo / 70) % 2 === 0) g.globalAlpha = 0.45;
  if (c.estado === 'caida') {
    // de costas no chão, com o capacete caído do lado
    sombra(g, x, y, 28, 6);
    disco(g, x, y - 10, 24, 11, CONTORNO);
    disco(g, x, y - 10, 23, 10, PELE);
    disco(g, x - 4, y - 14, 12, 4, PELE_CLARA);
    mao(g, x - 22, y - 20, -1);
    mao(g, x + 22, y - 20, 1);
    rosto(g, x + lado * 14, y - 12, lado, 'x');
    capacete(g, x - lado * 36, y - 6, lado, 0);
    for (let k = 0; k < 3; k++) {
      const a = tempo / 300 + (k * Math.PI * 2) / 3;
      estrela(g, x + Math.cos(a) * 16, y - 30 + Math.sin(a) * 4);
    }
    g.globalAlpha = 1;
    return;
  }
  const quanto = fora(c);
  const recorte = c.estado === 'saindo' || c.estado === 'entrando';
  if (recorte) {
    g.save();
    g.beginPath();
    g.rect(x - 40, y - 80, 80, 80);
    g.clip();
  }
  const dy = Math.round((1 - quanto) * 46);
  const by = y + dy;
  // a pose de cada estado: quanto ela achata, onde ficam as mãos, os olhos
  let achata = 1;
  let maoE: [number, number] = [-22, -14];
  let maoD: [number, number] = [22, -14];
  let olhos: 'normal' | 'tonta' | 'brava' = 'normal';
  let treme = 0;
  let inclina = 0;
  let vento = 0;
  const respira = Math.floor(tempo / 300) % 2;
  switch (c.estado) {
    case 'parada':
    case 'saindo':
    case 'entrando':
      achata = 1 - respira * 0.04;
      break;
    case 'prep-terremoto':
    case 'prep-pedras':
      maoE = [-20, -44];
      maoD = [20, -44];
      olhos = 'brava';
      treme = Math.floor(tempo / 50) % 2 ? 1 : -1;
      achata = 1.06;
      break;
    case 'terremoto':
    case 'pedras':
      maoE = [-26, -4];
      maoD = [26, -4];
      achata = 0.82;
      olhos = 'brava';
      break;
    case 'prep-investida':
      maoE = [-lado * 18, -6];
      maoD = [lado * 24, -6];
      achata = 0.9;
      inclina = lado * 4;
      olhos = 'brava';
      treme = Math.floor(tempo / 70) % 2 ? 1 : 0;
      break;
    case 'investida':
      maoE = [lado * 18, -20];
      maoD = [lado * 26, -12];
      achata = 0.88;
      inclina = lado * 6;
      vento = -lado * 6;
      olhos = 'brava';
      break;
    case 'tonta':
      olhos = 'tonta';
      inclina = Math.floor(tempo / 250) % 2 ? 3 : -3;
      maoE = [-22, -8];
      maoD = [22, -8];
      break;
    case 'prep-torroes':
      maoE = [-lado * 22, -14];
      maoD = [-lado * 18, -40];
      olhos = 'brava';
      break;
    case 'jogando': {
      const vai = Math.floor(t / 160) % 2;
      maoE = [-lado * 22, -14];
      maoD = vai ? [lado * 26, -28] : [-lado * 18, -40];
      olhos = 'brava';
      break;
    }
    case 'fase':
      maoE = [-26, -40];
      maoD = [26, -40];
      olhos = 'brava';
      treme = Math.floor(tempo / 40) % 2 ? 2 : -2;
      achata = 1.08;
      break;
  }
  const cx = x + treme + inclina;
  if (!recorte) sombra(g, x, y + 1, 26, 6);
  capa(g, cx, by, vento);
  corpo(g, cx, by, achata);
  const topo = by - Math.round(36 * achata);
  rosto(g, cx + lado * 4, topo + 14, lado, olhos);
  capacete(g, cx, topo, lado, c.estado === 'tonta' ? inclina : 0);
  // o torrão na mão que vai jogar
  if (c.estado === 'prep-torroes' || (c.estado === 'jogando' && maoD[1] < -30)) torrao(g, cx + maoD[0], by + maoD[1] - 6, false, tempo);
  mao(g, cx + maoE[0], by + maoE[1], maoE[0] >= 0 ? 1 : -1);
  mao(g, cx + maoD[0], by + maoD[1], maoD[0] >= 0 ? 1 : -1);
  if (c.estado === 'prep-investida' || c.estado === 'investida') {
    // a poeira atrás dos pés
    for (let k = 0; k < 4; k++) px(g, x - lado * (24 + k * 6 + ((tempo / 40) % 6)), y - 2 - (k % 2) * 3, 3, 2, '#c4a888');
  }
  if (c.estado === 'fase') {
    // o rugido: as linhas saindo
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + tempo / 400;
      const r = 36 + ((tempo / 30) % 10);
      px(g, cx + Math.cos(a) * r, topo + 10 + Math.sin(a) * r * 0.6, 3, 2, '#fbf3e4');
    }
  }
  if (c.estado === 'tonta') {
    for (let k = 0; k < 3; k++) {
      const a = tempo / 220 + (k * Math.PI * 2) / 3;
      estrela(g, cx + Math.cos(a) * 18, topo - 10 + Math.sin(a) * 5);
    }
  }
  if (recorte) {
    g.restore();
    // a terra revirada em volta da toca
    disco(g, x, y + 1, 26, 6, '#6e5038');
    disco(g, x, y, 22, 4, '#8a6a4c');
    for (let k = 0; k < 6; k++) px(g, x - 24 + k * 9, y - 3 - ((k + Math.floor(tempo / 100)) % 3), 3, 2, '#a3805f');
  }
  g.globalAlpha = 1;
}

function estrela(g: CanvasRenderingContext2D, x: number, y: number) {
  px(g, x - 1, y - 3, 2, 6, '#ffd36a');
  px(g, x - 3, y - 1, 6, 2, '#ffd36a');
  px(g, x, y - 1, 1, 1, '#fff6c8');
}

// ---------------- O HUD NA TELA E OS EFEITOS ----------------
/** A vida da toupeira em cima: três pedaços, um por fase; o rosto dela do lado. */
export function desenharVidaDoChefe(g: CanvasRenderingContext2D, fase: number, pct: number, total: number) {
  const L = 200, x0 = Math.round(W / 2 - L / 2) + 8, y0 = 6;
  disco(g, x0 - 12, y0 + 4, 7, 6, CONTORNO);
  disco(g, x0 - 12, y0 + 4, 6, 5, PELE);
  disco(g, x0 - 12, y0, 6, 3, CAPACETE);
  px(g, x0 - 11, y0 + 6, 3, 2, FOCINHO);
  const pedaco = (L - (total - 1) * 3) / total;
  for (let k = 0; k < total; k++) {
    const x = x0 + k * (pedaco + 3);
    px(g, x, y0, pedaco, 8, CONTORNO);
    px(g, x + 1, y0 + 1, pedaco - 2, 6, '#5c3a36');
    const cheio = k > fase ? 1 : k < fase ? 0 : Math.max(0, Math.min(1, pct / 100));
    px(g, x + 1, y0 + 1, (pedaco - 2) * cheio, 6, '#e2574a');
    px(g, x + 1, y0 + 1, (pedaco - 2) * cheio, 2, '#f08a78');
  }
}

/** Um efeito; devolve false quando acabou. */
export function desenharEfeito(g: CanvasRenderingContext2D, e: Efeito, tempo: number): boolean {
  const idade = tempo - e.em;
  if (idade < 0) return true;
  if (e.tipo === 'acerto') {
    if (idade > 800) return false;
    if (idade < 120) for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      px(g, e.x + Math.cos(a) * (6 + idade / 15), e.y - 24 + Math.sin(a) * (6 + idade / 15), 2, 2, '#fff6c8');
    }
    if (e.texto) {
      g.font = 'bold 9px monospace';
      g.textAlign = 'center';
      g.fillStyle = CONTORNO;
      g.fillText(`-${e.texto}`, Math.round(e.x) + 1, Math.round(e.y - 46 - idade / 25) + 1);
      g.fillStyle = '#ffd36a';
      g.fillText(`-${e.texto}`, Math.round(e.x), Math.round(e.y - 46 - idade / 25));
    }
    return true;
  }
  if (e.tipo === 'explosao') {
    if (idade > 600) return false;
    const r = 8 + idade / 12;
    g.globalAlpha = 1 - idade / 600;
    disco(g, e.x, e.y, Math.round(r), Math.round(r * 0.6), '#9cc072');
    disco(g, e.x, e.y, Math.round(r * 0.6), Math.round(r * 0.35), '#e6f2c8');
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      px(g, e.x + Math.cos(a) * r * 1.2, e.y - 6 + Math.sin(a) * r * 0.7, 2, 3, '#6f9a4e');
    }
    g.globalAlpha = 1;
    return true;
  }
  if (e.tipo === 'poeira') {
    if (idade > 450) return false;
    const r = 4 + idade / 25;
    g.globalAlpha = 1 - idade / 450;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      px(g, e.x + Math.cos(a) * r, e.y + Math.sin(a) * r * 0.5 - 2, 3, 2, '#c4a888');
    }
    g.globalAlpha = 1;
    return true;
  }
  if (e.tipo === 'pancada') {
    if (idade > 600) return false;
    for (let k = 0; k < 3; k++) {
      const a = idade / 120 + (k * Math.PI * 2) / 3;
      estrela(g, e.x + Math.cos(a) * 12, e.y - 54 + Math.sin(a) * 4);
    }
    return true;
  }
  if (e.tipo === 'pegou') {
    if (idade > 350) return false;
    anel(g, e.x, e.y - 50, 4 + idade / 30, 4 + idade / 30, '#d6f0fa');
    return true;
  }
  if (e.tipo === 'fase') {
    if (idade > 700) return false;
    g.globalAlpha = 0.35 * (1 - idade / 700);
    px(g, 0, 0, W, H, '#e2574a');
    g.globalAlpha = 1;
    return true;
  }
  return false;
}
