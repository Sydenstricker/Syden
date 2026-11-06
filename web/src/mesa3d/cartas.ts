import * as THREE from 'three';
import { BASE } from './base';

/**
 * AS CARTAS DO TRUCO COM TEXTURA (06/11/2026, pedido dele: "mais ênfase na textura das cartas, para ficar mais charmoso"),
 * tudo por código:
 * - a FRENTE é a arte do KayKit (CC0: as figuras, os índices dos cantos e os naipes) impressa num PAPEL creme com grão,
 *   as bordas um pouco amareladas e a tinta com o mesmo grão por cima (como tinta em papel, e não pixel limpo);
 * - o VERSO é NOSSO: o vinho com a treliça fina, o friso dourado e, no meio, o medalhão com o D4 (as orelhas, o balão e os três
 *   pontos), na margem do mesmo papel. Nenhuma marca de baralho;
 * - o grão é também o RELEVO (bumpMap) e o material tem um verniz leve (clearcoat): a luz do pendente corre pela carta.
 * O mapa UV do modelo vai de 0,006 a 0,994 nos dois sentidos, no tamanho das artes do KayKit (552 × 752), e sem inverter o y.
 */

const W = 552;
const H = 752;

function sorteador(semente: number) {
  let s = semente >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvas() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  return c;
}

let grao: HTMLCanvasElement | null = null;
/** O grão do papel: cinza em torno do meio, com umas fibras compridas. Serve de relevo e de textura da tinta. */
function graoDoPapel() {
  if (grao) return grao;
  grao = canvas();
  const c = grao.getContext('2d')!;
  const img = c.createImageData(W, H);
  const r = sorteador(7);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (r() - 0.5) * 70;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  c.lineWidth = 1;
  for (let k = 0; k < 900; k++) {
    const x = r() * W;
    const y = r() * H;
    const a = r() * Math.PI;
    const l = 4 + r() * 14;
    c.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.16)';
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    c.stroke();
  }
  return grao;
}

/** O papel creme, com o grão por cima e as bordas amareladas. */
function pintarPapel(c: CanvasRenderingContext2D) {
  c.fillStyle = '#f5ecd8';
  c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'soft-light';
  c.globalAlpha = 0.55;
  c.drawImage(graoDoPapel(), 0, 0);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  const v = c.createRadialGradient(W / 2, H / 2, W * 0.35, W / 2, H / 2, H * 0.62);
  v.addColorStop(0, 'rgba(150,110,50,0)');
  v.addColorStop(1, 'rgba(150,110,50,0.22)');
  c.fillStyle = v;
  c.fillRect(0, 0, W, H);
}

const imagens = new Map<string, Promise<HTMLImageElement>>();
function imagem(caminho: string) {
  let p = imagens.get(caminho);
  if (!p) {
    p = new Promise<HTMLImageElement>((ok, erro) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = erro;
      i.src = `${BASE}${caminho}`;
    });
    imagens.set(caminho, p);
    p.catch(() => imagens.delete(caminho));
  }
  return p;
}

const frentes = new Map<string, Promise<HTMLCanvasElement>>();
/** A frente de uma carta: a arte do KayKit impressa no papel. */
export function desenhoDaFrente(caminho: string): Promise<HTMLCanvasElement> {
  let p = frentes.get(caminho);
  if (!p) {
    p = imagem(caminho).then((img) => {
      const cv = canvas();
      const c = cv.getContext('2d')!;
      pintarPapel(c);
      // a tinta: o branco da arte vira o papel (multiply), e as cores ficam um tico mais quentes
      c.globalCompositeOperation = 'multiply';
      c.drawImage(img, 0, 0, W, H);
      // o grão também sobre a tinta, bem de leve
      c.globalCompositeOperation = 'soft-light';
      c.globalAlpha = 0.35;
      c.drawImage(graoDoPapel(), 0, 0);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
      return cv;
    });
    frentes.set(caminho, p);
    p.catch(() => frentes.delete(caminho));
  }
  return p;
}

function retanguloRedondo(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** O D4 (as orelhas, o balão e os três pontos), centrado em (x, y), com `t` de altura. */
function d4(c: CanvasRenderingContext2D, x: number, y: number, t: number, cor: string, fundo: string) {
  c.save();
  c.translate(x, y);
  c.scale(t / 100, t / 100);
  c.fillStyle = cor;
  // as orelhas
  for (const lado of [-1, 1]) {
    c.save();
    c.translate(lado * 16, -22);
    c.rotate(lado * 0.18);
    c.beginPath();
    c.ellipse(0, -16, 9, 22, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = fundo;
    c.beginPath();
    c.ellipse(0, -14, 4, 14, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
  // o balão, com o rabinho
  retanguloRedondo(c, -38, -26, 76, 52, 22);
  c.fill();
  c.beginPath();
  c.moveTo(-14, 22);
  c.lineTo(-26, 42);
  c.lineTo(2, 24);
  c.closePath();
  c.fill();
  // os três pontos
  c.fillStyle = fundo;
  for (const dx of [-17, 0, 17]) {
    c.beginPath();
    c.arc(dx, 0, 6, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

let verso: HTMLCanvasElement | null = null;
/** O verso do Syden. Simétrico, para valer de qualquer lado (o UV do verso é espelhado). */
export function desenhoDoVerso(): HTMLCanvasElement {
  if (verso) return verso;
  verso = canvas();
  const c = verso.getContext('2d')!;
  pintarPapel(c);
  const m = 30;
  const VINHO = '#7d2532';
  const OURO = '#d9a441';
  const CREME = '#f2e3c2';
  retanguloRedondo(c, m, m, W - m * 2, H - m * 2, 26);
  const g = c.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, H * 0.6);
  g.addColorStop(0, '#93303e');
  g.addColorStop(1, '#5e1823');
  c.fillStyle = g;
  c.fill();
  c.save();
  c.clip();
  // a treliça fina, com um pontinho em cada cruzamento
  c.strokeStyle = 'rgba(242,227,194,0.22)';
  c.lineWidth = 1.6;
  const passo = 34;
  for (let k = -H; k < W + H; k += passo) {
    c.beginPath();
    c.moveTo(k, 0);
    c.lineTo(k + H, H);
    c.moveTo(k, H);
    c.lineTo(k + H, 0);
    c.stroke();
  }
  c.fillStyle = 'rgba(242,227,194,0.35)';
  for (let y = H / 2 - Math.ceil(H / passo) * (passo / 2); y < H; y += passo / 2)
    for (let x = W / 2 - Math.ceil(W / passo) * passo + ((Math.round((y - H / 2) / (passo / 2)) & 1) * passo) / 2; x < W; x += passo) {
      c.beginPath();
      c.arc(x, y, 2, 0, Math.PI * 2);
      c.fill();
    }
  c.restore();
  // o friso dourado, duplo
  c.strokeStyle = OURO;
  c.lineWidth = 5;
  retanguloRedondo(c, m + 16, m + 16, W - (m + 16) * 2, H - (m + 16) * 2, 16);
  c.stroke();
  c.lineWidth = 1.6;
  retanguloRedondo(c, m + 26, m + 26, W - (m + 26) * 2, H - (m + 26) * 2, 10);
  c.stroke();
  // os cantinhos: um losango em cada
  for (const [x, y] of [
    [m + 52, m + 52],
    [W - m - 52, m + 52],
    [m + 52, H - m - 52],
    [W - m - 52, H - m - 52],
  ]) {
    c.fillStyle = OURO;
    c.beginPath();
    c.moveTo(x, y - 12);
    c.lineTo(x + 12, y);
    c.lineTo(x, y + 12);
    c.lineTo(x - 12, y);
    c.closePath();
    c.fill();
  }
  // o medalhão do meio, com o D4
  c.fillStyle = CREME;
  c.beginPath();
  c.ellipse(W / 2, H / 2, 118, 150, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = OURO;
  c.lineWidth = 7;
  c.stroke();
  c.lineWidth = 2;
  c.beginPath();
  c.ellipse(W / 2, H / 2, 102, 134, 0, 0, Math.PI * 2);
  c.stroke();
  d4(c, W / 2, H / 2 + 16, 150, VINHO, CREME);
  // o grão por cima de tudo
  c.globalCompositeOperation = 'soft-light';
  c.globalAlpha = 0.4;
  c.drawImage(graoDoPapel(), 0, 0);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  return verso;
}

/** Uma textura de canvas no jeito do glTF (sem inverter o y, em sRGB). */
export function texturaDaCarta(cv: HTMLCanvasElement, cor = true): THREE.Texture {
  const t = new THREE.CanvasTexture(cv);
  t.flipY = false;
  if (cor) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export const desenhoDoGrao = graoDoPapel;

/** O material de um lado da carta: papel fosco com um verniz leve, e o grão como relevo. */
export function materialDaCarta(map: THREE.Texture | null, relevo: THREE.Texture): THREE.MeshPhysicalMaterial {
  return new THREE.MeshPhysicalMaterial({
    map,
    color: '#ffffff',
    roughness: 0.62,
    metalness: 0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.45,
    bumpMap: relevo,
    bumpScale: 0.6,
    side: THREE.DoubleSide,
  });
}
