import { ALTURA as ALTURA_DA_MESA, LARGURA as LARGURA_DA_MESA, type Buraco } from './fisica';

/**
 * O MINIGOLFE EM PERSPECTIVA (05/11/2026, pedido dele: "o minigolfe com aspecto de 3D, como temos na corrida dos coelhos"): o
 * mesmo Mode 7 da corrida (corrida/render.ts), com a câmera atrás da bola, olhando para onde se mira. O chão é a própria mesa
 * de cima (pintarMesa + desenhar, com a água mexendo e a tábua andando), lida pixel a pixel a cada quadro; a bandeira e as bolas
 * ficam DE PÉ por cima, do tamanho que a distância pede. A física não muda: é a mesma conta, em unidades da mesa.
 */

export const W3 = 320;
export const H3 = 180;
const HORIZONTE = 52;
/** A câmera: a altura, quanto fica atrás da bola e a lente. */
const ALTURA = 11;
export const ATRAS = 26;
const FOCO = 150;

export interface Camera3 {
  x: number;
  y: number;
  angulo: number;
}

export function cameraAtrasDaBola(bx: number, by: number, angulo: number): Camera3 {
  return { x: bx - Math.cos(angulo) * ATRAS, y: by - Math.sin(angulo) * ATRAS, angulo };
}

const rgba = (r: number, g: number, b: number) => (255 << 24) | (b << 16) | (g << 8) | r;

export interface Desenho3 {
  ctx: CanvasRenderingContext2D;
  imagem: ImageData;
  pontos: Uint32Array;
  ceu: Uint32Array;
}

export function prepararDesenho3(canvas: HTMLCanvasElement): Desenho3 {
  canvas.width = W3;
  canvas.height = H3;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const imagem = ctx.createImageData(W3, H3);
  // o céu de fim de tarde, em faixas (pixel art), com um morro verde no pé
  const ceu = new Uint32Array(W3 * HORIZONTE);
  const cima = [148, 196, 222], baixo = [236, 222, 190];
  for (let y = 0; y < HORIZONTE; y++) {
    const t = Math.floor((y / HORIZONTE) * 6) / 6;
    const cor = rgba(...(cima.map((c, i) => Math.round(c + (baixo[i] - c) * t)) as [number, number, number]));
    for (let x = 0; x < W3; x++) ceu[y * W3 + x] = cor;
  }
  return { ctx, imagem, pontos: new Uint32Array(imagem.data.buffer), ceu };
}

/** Onde um ponto da mesa aparece na tela: x, y (o pé) e a escala (1 = a 26 unidades, a distância da bola). */
export function projetar3(cam: Camera3, x: number, y: number): { sx: number; sy: number; escala: number; z: number } | null {
  const dx = x - cam.x, dy = y - cam.y;
  const fx = Math.cos(cam.angulo), fy = Math.sin(cam.angulo);
  const z = dx * fx + dy * fy;
  if (z < 3) return null;
  const lado = -dx * fy + dy * fx;
  return { sx: W3 / 2 + (lado * FOCO) / z, sy: HORIZONTE + (ALTURA * FOCO) / z, escala: ATRAS / z, z };
}

/** O chão em perspectiva, lido da mesa de cima (`mesa`: os pixels de LARGURA × ALTURA da mesa já desenhada). */
export function desenharChao3(d: Desenho3, mesa: Uint32Array, cam: Camera3) {
  const { pontos, ceu } = d;
  pontos.set(ceu, 0);
  // fora da mesa: a sebe escura, que some na névoa
  const fora = rgba(58, 92, 58);
  const fx = Math.cos(cam.angulo), fy = Math.sin(cam.angulo);
  const rx = -fy, ry = fx;
  for (let y = HORIZONTE; y < H3; y++) {
    const dy = y - HORIZONTE + 0.5;
    const z = (ALTURA * FOCO) / dy;
    const cx = cam.x + fx * z, cy = cam.y + fy * z;
    const sx = (rx * z) / FOCO, sy = (ry * z) / FOCO;
    let wx = cx - sx * (W3 / 2), wy = cy - sy * (W3 / 2);
    const linha = y * W3;
    for (let x = 0; x < W3; x++) {
      const tx = Math.floor(wx), ty = Math.floor(wy);
      pontos[linha + x] = tx >= 0 && ty >= 0 && tx < LARGURA_DA_MESA && ty < ALTURA_DA_MESA ? mesa[ty * LARGURA_DA_MESA + tx] : fora;
      wx += sx;
      wy += sy;
    }
  }
  d.ctx.putImageData(d.imagem, 0, 0);
}

export interface Bola3 {
  x: number;
  y: number;
  cor: string;
  minha: boolean;
}

/** A bandeira e as bolas de pé, da mais longe à mais perto, e a mira (os pontinhos no chão) da bola de quem joga. */
export function desenharFiguras3(
  d: Desenho3,
  cam: Camera3,
  buraco: Buraco,
  bolas: Bola3[],
  mira: { x: number; y: number; ux: number; uy: number; forca: number } | null,
  alguemDentro: boolean,
) {
  const ctx = d.ctx;
  const figuras: { z: number; f: () => void }[] = [];
  const [hx, hy] = buraco.buraco;
  const pb = projetar3(cam, hx, hy);
  if (pb) {
    figuras.push({
      z: pb.z,
      f: () => {
        const e = Math.max(0.25, pb.escala * 2.2);
        const alto = Math.round(26 * e);
        const x = Math.round(pb.sx);
        const y = Math.round(pb.sy);
        ctx.fillStyle = '#2a2420aa';
        ctx.fillRect(x - Math.round(3 * e), y - 1, Math.max(2, Math.round(6 * e)), Math.max(1, Math.round(2 * e)));
        ctx.fillStyle = '#e8e0d0';
        ctx.fillRect(x, y - alto, Math.max(1, Math.round(e)), alto);
        ctx.fillStyle = alguemDentro ? '#e3b45a' : '#d9774f';
        const pano = Math.round(11 * e);
        for (let k = 0; k < Math.round(7 * e); k++) ctx.fillRect(x + 1, y - alto + k, Math.max(1, pano - Math.round(k * 1.4)), 1);
      },
    });
  }
  for (const b of bolas) {
    const p = projetar3(cam, b.x, b.y);
    if (!p) continue;
    figuras.push({
      z: p.z,
      f: () => {
        const r = Math.max(1, 4.2 * p.escala);
        ctx.fillStyle = '#1e1a1677';
        ctx.beginPath();
        ctx.ellipse(p.sx, p.sy, r * 1.1, r * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = b.cor;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy - r, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff99';
        ctx.fillRect(Math.round(p.sx - r * 0.45), Math.round(p.sy - r * 1.55), Math.max(1, Math.round(r * 0.5)), Math.max(1, Math.round(r * 0.4)));
        if (b.minha) {
          ctx.strokeStyle = '#2a2420';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(p.sx, p.sy - r, r + 0.5, 0, Math.PI * 2);
          ctx.stroke();
        }
      },
    });
  }
  figuras.sort((a, b) => b.z - a.z);
  // a mira: pontinhos no chão, na direção da tacada, mais longos e mais quentes com a força
  if (mira && mira.forca > 0) {
    const passos = Math.round(6 + mira.forca * 34);
    for (let k = 4; k < passos; k += 3) {
      const p = projetar3(cam, mira.x + mira.ux * k, mira.y + mira.uy * k);
      if (!p) continue;
      const quente = k / 40;
      ctx.fillStyle = quente < 0.45 ? '#f4ecdc' : quente < 0.75 ? '#e3b45a' : '#d9774f';
      const s = Math.max(1, Math.round(2 * p.escala));
      ctx.fillRect(Math.round(p.sx - s / 2), Math.round(p.sy - s / 2), s, s);
    }
  }
  for (const f of figuras) f.f();
  if (mira && mira.forca > 0) {
    ctx.fillStyle = '#2a242088';
    ctx.fillRect(W3 - 12, H3 - 50, 7, 44);
    const h = Math.round(mira.forca * 42);
    ctx.fillStyle = mira.forca < 0.45 ? '#f4ecdc' : mira.forca < 0.75 ? '#e3b45a' : '#d9774f';
    ctx.fillRect(W3 - 11, H3 - 7 - h, 5, h);
  }
}
