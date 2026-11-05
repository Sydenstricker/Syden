/**
 * A NAVE-CENOURA, desenhada por código (05/11/2026). Um modelo 3D pequeno (o casco é a cenoura, as folhas são as asas e a
 * cauda, o coelho vai sentado com as orelhas de fora) projetado em 24 ângulos e 3 inclinações numa folha de sprites, uma vez
 * por jogo e por conjunto de cores. Depois, o contorno duro e o escuro em volta: o jeito de pixel art dos 16 bits.
 *
 * Por que assim, e não a folha do kart: o kart é o mascote 3D renderizado no Blender SENTADO NUM KART, e as rodas e o corpo
 * dele não viram nave; e uma nave precisa INCLINAR na curva, o que pediria mais três folhas no Blender. Por código, as 72
 * vistas saem em ~50 ms, e a TROCA DE PALETA do avatar é de graça: o pelo do coelho é a cor do pelo do avatar pronto da
 * pessoa, e a faixa do casco é a cor da roupa dele (as mesmas cores do kart, corrida/coresDosAvatares.ts).
 */
import { CORES_DOS_AVATARES } from '../corrida/coresDosAvatares';

export const LADO = 48;
/** O ponto da folha que fica sobre o chão (o meio da nave, onde vai a sombra). */
export const PE_X = 24, PE_Y = 32;
export const ANGULOS = 24;
/** As inclinações: −1 (para a esquerda), 0 e 1, nas linhas da folha. */
export const BANCOS = [-1, 0, 1];
/** A câmera olha de cima, um pouco: o mesmo ângulo da câmera da corrida (render.ts). */
const ELEVACAO = 0.42;

type RGB = [number, number, number];

export interface CoresDaNave {
  casco: RGB;
  faixa: RGB;
  folha: RGB;
  pelo: RGB;
}

export interface FolhaDaNave {
  canvas: HTMLCanvasElement;
  /** Onde está o motor em cada vista (para a chama), e se ele aparece (de trás) — índice banco * 24 + ângulo. */
  motores: { x: number; y: number; visivel: boolean }[];
}

const MASCOTE: CoresDaNave = { casco: [236, 128, 52], faixa: [61, 43, 54], folha: [96, 176, 84], pelo: [236, 226, 240] };

/** As cores da nave de quem tem o avatar `avatar` (o pelo e a roupa dele); sem avatar pronto, o mascote. */
export function coresDoAvatar(avatar: number | null | undefined): CoresDaNave {
  const c = avatar !== null && avatar !== undefined ? CORES_DOS_AVATARES[avatar] : undefined;
  return c ? { ...MASCOTE, pelo: c.pelo, faixa: c.roupa } : MASCOTE;
}

/** As naves do computador: coelhos de pelos diferentes, com cascos e faixas variados (nenhum é de ninguém). */
const CASCOS: RGB[] = [[236, 128, 52], [226, 92, 60], [244, 170, 60], [214, 110, 150], [150, 120, 220], [90, 170, 210]];
const FAIXAS: RGB[] = [[40, 50, 90], [120, 30, 40], [30, 90, 70], [70, 40, 100], [200, 200, 210], [40, 40, 48]];
export function coresDoRobo(i: number): CoresDaNave {
  const avatar = CORES_DOS_AVATARES[(i % 16) + 1];
  return { casco: CASCOS[i % CASCOS.length], faixa: FAIXAS[(i * 5 + 1) % FAIXAS.length], folha: i % 3 === 2 ? [70, 150, 120] : [96, 176, 84], pelo: avatar.pelo };
}

type V3 = [number, number, number];
interface Face {
  pts: V3[];
  cor: RGB;
  duasFaces?: boolean;
  brilho?: boolean;
}

/** O modelo, em (frente, direita, cima), ~34 de comprimento. */
function modelo(c: CoresDaNave): { faces: Face[]; cabeca: V3; olhos: V3[]; motor: V3 } {
  const faces: Face[] = [];
  const nariz: V3 = [17, 0, 0.5];
  const anel = (f: number, r: number, u: number): V3[] =>
    Array.from({ length: 8 }, (_, j) => [f, r * Math.cos((j * Math.PI) / 4), u * Math.sin((j * Math.PI) / 4) + 0.5] as V3);
  const A = anel(-2, 6, 4.6), B = anel(-11, 4.8, 3.8), C = anel(-12, 3.4, 2.6);
  const escuro = (k: RGB, f: number): RGB => [k[0] * f, k[1] * f, k[2] * f];
  for (let j = 0; j < 8; j++) {
    const j2 = (j + 1) % 8;
    // o casco: a cenoura, com os gomos alternando o tom
    faces.push({ pts: [nariz, A[j], A[j2]], cor: j % 2 ? escuro(c.casco, 0.88) : c.casco });
    // a faixa do casco, na cor da roupa do coelho
    faces.push({ pts: [A[j], B[j], B[j2], A[j2]], cor: j % 2 ? escuro(c.faixa, 0.9) : c.faixa });
    faces.push({ pts: [B[j], C[j], C[j2], B[j2]], cor: [70, 64, 80] });
  }
  // o motor: o fundo da cenoura, aceso
  faces.push({ pts: [...C].reverse(), cor: [120, 236, 255], brilho: true });
  // as folhas: duas asas para trás e a cauda em pé
  const folha = c.folha;
  faces.push({ pts: [[-1, -5, 0.5], [-14, -18, -1.5], [-9, -5, 1]], cor: folha, duasFaces: true });
  faces.push({ pts: [[-1, 5, 0.5], [-14, 18, -1.5], [-9, 5, 1]], cor: folha, duasFaces: true });
  faces.push({ pts: [[-4, 0, 4], [-16, 0, 13], [-11, 0, 3.5]], cor: escuro(folha, 0.85), duasFaces: true });
  // as orelhas do coelho, de pé atrás da cabeça
  for (const l of [-1, 1]) {
    faces.push({ pts: [[1.5, l * 0.6, 8.2], [1.5, l * 2.0, 8.4], [-2.2, l * 2.6, 15.5], [-2.4, l * 1.0, 15.8]], cor: c.pelo, duasFaces: true });
  }
  return { faces, cabeca: [2.5, 0, 6.2], olhos: [[5.4, -1.3, 6.9], [5.4, 1.3, 6.9]], motor: [-12.5, 0, 0.5] };
}

const LUZ: V3 = (() => {
  const v: V3 = [-0.45, -0.5, 0.75];
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
})();

/** Gera a folha (24 ângulos × 3 inclinações). */
export function folhaDaNave(cores: CoresDaNave): FolhaDaNave {
  const canvas = document.createElement('canvas');
  canvas.width = LADO * ANGULOS;
  canvas.height = LADO * BANCOS.length;
  const g = canvas.getContext('2d')!;
  const { faces, cabeca, olhos, motor } = modelo(cores);
  const motores: FolhaDaNave['motores'] = [];
  const ce = Math.cos(ELEVACAO), se = Math.sin(ELEVACAO);
  const corCss = (k: RGB, luz: number) => `rgb(${Math.min(255, Math.round(k[0] * luz))}, ${Math.min(255, Math.round(k[1] * luz))}, ${Math.min(255, Math.round(k[2] * luz))})`;
  BANCOS.forEach((banco, linha) => {
    const b = banco * 0.42, cb = Math.cos(b), sb = Math.sin(b);
    for (let k = 0; k < ANGULOS; k++) {
      const rel = (k * 2 * Math.PI) / ANGULOS;
      const cr = Math.cos(rel), sr = Math.sin(rel);
      const ox = k * LADO + PE_X, oy = linha * LADO + PE_Y;
      /** O ponto do modelo na vista: (profundidade, direita, cima) já com a elevação, e na tela. */
      const ver = ([f, r, u]: V3) => {
        const r1 = r * cb + u * sb, u1 = u * cb - r * sb;
        const X = f * cr - r1 * sr, Y = f * sr + r1 * cr, Z = u1;
        return { X, Y, Z, sx: ox + Y, sy: oy - (Z * ce + X * se), prof: X * ce - Z * se };
      };
      const centro = ver([2, 0, 0.5]);
      const desenhadas = faces
        .map((face) => {
          const vs = face.pts.map(ver);
          // a normal, pela vista (a ordem dos pontos não importa: ela é virada para fora do centro do casco)
          const a = vs[0], bb = vs[1], cc = vs[2];
          const ux = bb.X - a.X, uy = bb.Y - a.Y, uz = bb.Z - a.Z, wx = cc.X - a.X, wy = cc.Y - a.Y, wz = cc.Z - a.Z;
          let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
          const nl = Math.hypot(nx, ny, nz) || 1;
          nx /= nl;
          ny /= nl;
          nz /= nl;
          const mx = vs.reduce((s, v) => s + v.X, 0) / vs.length, my = vs.reduce((s, v) => s + v.Y, 0) / vs.length, mz = vs.reduce((s, v) => s + v.Z, 0) / vs.length;
          if (!face.duasFaces && (mx - centro.X) * nx + (my - centro.Y) * ny + (mz - centro.Z) * nz < 0) {
            nx = -nx;
            ny = -ny;
            nz = -nz;
          }
          // a câmera olha para a frente e para baixo: a face de costas para ela não aparece
          const paraCamera = nx * ce - nz * se;
          if (!face.duasFaces && paraCamera > 0.02) return null;
          let d = nx * LUZ[0] + ny * LUZ[1] + nz * LUZ[2];
          if (face.duasFaces) d = Math.abs(d);
          // a luz em três degraus, como a paleta curta dos 16 bits
          const luz = face.brilho ? 1 : 0.5 + Math.round(Math.max(0, d) * 3) * 0.2;
          return { vs, cor: corCss(face.cor, luz), prof: vs.reduce((s, v) => s + v.prof, 0) / vs.length };
        })
        .filter((f): f is NonNullable<typeof f> => f !== null);
      // a cabeça entra como uma bola entre as faces, na profundidade dela
      const cab = ver(cabeca);
      const itens: { prof: number; desenhar: () => void }[] = desenhadas.map((f) => ({
        prof: f.prof,
        desenhar: () => {
          g.fillStyle = f.cor;
          g.beginPath();
          f.vs.forEach((v, i) => (i ? g.lineTo(v.sx, v.sy) : g.moveTo(v.sx, v.sy)));
          g.closePath();
          g.fill();
        },
      }));
      itens.push({
        prof: cab.prof,
        desenhar: () => {
          g.fillStyle = corCss(cores.pelo, 0.82);
          g.beginPath();
          g.arc(cab.sx, cab.sy, 3.5, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = corCss(cores.pelo, 1.02);
          g.beginPath();
          g.arc(cab.sx - 0.8, cab.sy - 0.9, 2.3, 0, Math.PI * 2);
          g.fill();
          for (const o of olhos.map(ver)) {
            if (o.prof < cab.prof - 0.5) {
              g.fillStyle = '#1e1622';
              g.fillRect(Math.round(o.sx - 0.5), Math.round(o.sy - 0.5), 1, 1);
            }
          }
        },
      });
      itens.sort((a, b2) => b2.prof - a.prof);
      for (const it of itens) it.desenhar();
      const m = ver(motor);
      motores.push({ x: m.sx - k * LADO, y: m.sy - linha * LADO, visivel: Math.cos(rel) > 0.2 });
    }
  });
  contornar(g, canvas.width, canvas.height);
  return { canvas, motores };
}

/** O contorno duro: sem meio-transparente, e uma borda escura de um ponto em volta de tudo. */
function contornar(g: CanvasRenderingContext2D, w: number, h: number) {
  const img = g.getImageData(0, 0, w, h);
  const px = img.data;
  const cheio = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (px[i * 4 + 3] >= 110) {
      cheio[i] = 1;
      const a = px[i * 4 + 3] / 255;
      px[i * 4] = Math.round(px[i * 4] / a);
      px[i * 4 + 1] = Math.round(px[i * 4 + 1] / a);
      px[i * 4 + 2] = Math.round(px[i * 4 + 2] / a);
      px[i * 4 + 3] = 255;
    } else px[i * 4 + 3] = 0;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (cheio[i]) continue;
      // não passa de um quadro para o outro
      const viz = (xx: number, yy: number) => xx >= 0 && yy >= 0 && xx < w && yy < h && Math.floor(xx / LADO) === Math.floor(x / LADO) && Math.floor(yy / LADO) === Math.floor(y / LADO) && cheio[yy * w + xx];
      if (viz(x - 1, y) || viz(x + 1, y) || viz(x, y - 1) || viz(x, y + 1)) {
        px[i * 4] = 22;
        px[i * 4 + 1] = 14;
        px[i * 4 + 2] = 28;
        px[i * 4 + 3] = 255;
      }
    }
  }
  g.putImageData(img, 0, 0);
}

/** A vista certa para uma nave que aponta `angulo`, vista da câmera em (cx, cy): o ângulo relativo, como o do kart. */
export function vistaDaNave(angulo: number, cx: number, cy: number, x: number, y: number): number {
  const rel = angulo - Math.atan2(y - cy, x - cx);
  return ((Math.round(rel / ((2 * Math.PI) / ANGULOS)) % ANGULOS) + ANGULOS) % ANGULOS;
}

const folhas = new Map<string, FolhaDaNave>();
/** A folha pronta (guardada por conjunto de cores: o StrictMode e o "Jogar de novo" não refazem). */
export function folhaGuardada(cores: CoresDaNave): FolhaDaNave {
  const chave = JSON.stringify(cores);
  let f = folhas.get(chave);
  if (!f) {
    f = folhaDaNave(cores);
    folhas.set(chave, f);
  }
  return f;
}
