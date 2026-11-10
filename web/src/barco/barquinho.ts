/**
 * O BARQUINHO, desenhado por código (05/11/2026), como a nave dos Coelhos a jato (jato/nave.ts, de onde a forma foi copiada):
 * um modelo 3D pequeno (o casco de madeira, a faixa pintada, o motorzinho de popa cor de cenoura e o coelho sentado, de
 * moletom, com as orelhas de fora) projetado em 24 ângulos e 3 balanços numa folha de sprites, uma vez por jogo e por
 * conjunto de cores. Depois, o contorno duro e o escuro em volta: o jeito de pixel art dos 16 bits.
 *
 * A TROCA DE PALETA do avatar é de graça: o pelo do coelho é a cor do pelo do avatar pronto da pessoa, e o moletom e a faixa
 * do casco são a cor da roupa dele (as mesmas cores do kart, corrida/coresDosAvatares.ts).
 */
import { coresDoJogador, type AvatarDoJogo } from '../coelho/cores';

export const LADO = 48;
/** O ponto da folha que fica sobre a água (o meio do casco, na linha d'água). */
export const PE_X = 24, PE_Y = 30;
export const ANGULOS = 24;
/** Os balanços: −1 (para a esquerda), 0 e 1, nas linhas da folha. */
export const BANCOS = [-1, 0, 1];
/** A câmera olha de cima, um pouco: o mesmo ângulo da câmera (render.ts). */
const ELEVACAO = 0.42;

type RGB = [number, number, number];

export interface CoresDoBarco {
  casco: RGB;
  faixa: RGB;
  roupa: RGB;
  pelo: RGB;
}

export interface FolhaDoBarco {
  canvas: HTMLCanvasElement;
  /** Onde fica a popa (o motor) em cada vista, para a esteira sair dali: índice banco * 24 + ângulo. */
  popas: { x: number; y: number }[];
}

const MASCOTE: CoresDoBarco = { casco: [198, 140, 86], faixa: [61, 43, 54], roupa: [61, 43, 54], pelo: [236, 226, 240] };

/** As cores do barco de quem tem o avatar `avatar` (o pelo e a roupa dele); sem avatar pronto, o mascote. */
export function coresDoAvatar(avatar: number | string | null | undefined): CoresDoBarco {
  const c = coresDoJogador(avatar);
  return c ? { ...MASCOTE, pelo: c.pelo, faixa: c.roupa, roupa: c.roupa } : MASCOTE;
}

type V3 = [number, number, number];
interface Face {
  pts: V3[];
  cor: RGB;
  duasFaces?: boolean;
}

/** O modelo, em (frente, direita, cima), ~30 de comprimento; a linha d'água é o cima = 0. */
function modelo(c: CoresDoBarco): { faces: Face[]; bolas: { centro: V3; raio: number; cor: RGB }[]; olhos: V3[]; popa: V3 } {
  const faces: Face[] = [];
  const escuro = (k: RGB, f: number): RGB => [k[0] * f, k[1] * f, k[2] * f];
  // as seções do casco, da proa à popa: [frente, meia largura, altura da borda]
  const secoes: [number, number, number][] = [[15, 0, 4.2], [10, 4.6, 3.4], [2, 6.6, 3], [-7, 6.4, 3], [-12, 5.4, 3.2]];
  const borda = (i: number, l: number): V3 => [secoes[i][0], l * secoes[i][1], secoes[i][2]];
  const quilha = (i: number, l: number): V3 => [secoes[i][0] - (i === 0 ? 2 : 0), l * secoes[i][1] * 0.45, -2.2];
  const madeira = c.casco;
  for (let i = 0; i < secoes.length - 1; i++) {
    for (const l of [-1, 1]) {
      // o costado: a faixa pintada em cima, a madeira embaixo
      const meio = (a: V3, b: V3): V3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, a[2] * 0.62 + b[2] * 0.38];
      const b0 = borda(i, l), b1 = borda(i + 1, l), q0 = quilha(i, l), q1 = quilha(i + 1, l);
      const m0 = meio(b0, q0), m1 = meio(b1, q1);
      faces.push({ pts: [b0, b1, m1, m0], cor: i % 2 ? escuro(c.faixa, 0.92) : c.faixa });
      faces.push({ pts: [m0, m1, q1, q0], cor: i % 2 ? escuro(madeira, 0.9) : madeira });
    }
    // o fundo
    faces.push({ pts: [quilha(i, -1), quilha(i + 1, -1), quilha(i + 1, 1), quilha(i, 1)], cor: escuro(madeira, 0.6) });
  }
  // o espelho de popa
  const u = secoes.length - 1;
  faces.push({ pts: [borda(u, -1), borda(u, 1), quilha(u, 1), quilha(u, -1)], cor: escuro(madeira, 0.8) });
  // o piso de dentro (as tábuas, mais escuras), um pouco abaixo da borda, e o banco do meio
  const piso: V3[] = [];
  for (let i = 0; i < secoes.length; i++) piso.push([secoes[i][0] - (i === 0 ? 3 : 0), secoes[i][1] * 0.82, 1.2]);
  for (let i = secoes.length - 1; i >= 0; i--) piso.push([secoes[i][0] - (i === 0 ? 3 : 0), -secoes[i][1] * 0.82, 1.2]);
  faces.push({ pts: piso, cor: escuro(madeira, 0.68), duasFaces: true });
  faces.push({ pts: [[6, -5.4, 2.6], [6, 5.4, 2.6], [3.6, 5.6, 2.6], [3.6, -5.6, 2.6]], cor: escuro(madeira, 1.1), duasFaces: true });
  // o motorzinho de popa, cor de cenoura, com a hélice embaixo
  const mot = (f: number, r: number, uu: number): V3 => [f, r, uu];
  faces.push({ pts: [mot(-12.5, -1.6, 7), mot(-12.5, 1.6, 7), mot(-12.5, 1.6, 3), mot(-12.5, -1.6, 3)], cor: [236, 128, 52], duasFaces: true });
  faces.push({ pts: [mot(-16, -1.6, 7), mot(-16, 1.6, 7), mot(-16, 1.6, 3), mot(-16, -1.6, 3)], cor: [200, 100, 40], duasFaces: true });
  faces.push({ pts: [mot(-12.5, -1.6, 7), mot(-16, -1.6, 7), mot(-16, -1.6, 3), mot(-12.5, -1.6, 3)], cor: [220, 112, 44], duasFaces: true });
  faces.push({ pts: [mot(-12.5, 1.6, 7), mot(-16, 1.6, 7), mot(-16, 1.6, 3), mot(-12.5, 1.6, 3)], cor: [220, 112, 44], duasFaces: true });
  faces.push({ pts: [mot(-12.5, -1.6, 7), mot(-12.5, 1.6, 7), mot(-16, 1.6, 7), mot(-16, -1.6, 7)], cor: [250, 160, 80], duasFaces: true });
  faces.push({ pts: [mot(-15.5, -0.6, 3), mot(-15.5, 0.6, 3), mot(-15.5, 0.6, -2), mot(-15.5, -0.6, -2)], cor: [70, 64, 80], duasFaces: true });
  // a folhinha verde em cima do motor (é uma cenoura)
  faces.push({ pts: [[-14, 0, 7], [-15.5, -1.5, 10], [-13, 0.5, 9.5]], cor: [96, 176, 84], duasFaces: true });
  // as orelhas do coelho, de pé atrás da cabeça
  for (const l of [-1, 1]) {
    faces.push({ pts: [[-4, l * 0.7, 10.6], [-4, l * 2.1, 10.8], [-7.2, l * 2.8, 17.2], [-7.6, l * 1.1, 17.4]], cor: c.pelo, duasFaces: true });
  }
  return {
    faces,
    // o corpo de moletom (sentado no banco de trás), os braços no leme, e a cabeça
    bolas: [
      { centro: [-6, 0, 5.4], raio: 3.6, cor: c.roupa },
      { centro: [-4.4, 0, 9.4], raio: 3.1, cor: c.pelo },
    ],
    olhos: [[-1.5, -1.2, 9.9], [-1.5, 1.2, 9.9]],
    popa: [-14, 0, 0],
  };
}

const LUZ: V3 = (() => {
  const v: V3 = [-0.45, -0.5, 0.75];
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
})();

/** Gera a folha (24 ângulos × 3 balanços). */
export function folhaDoBarco(cores: CoresDoBarco): FolhaDoBarco {
  const canvas = document.createElement('canvas');
  canvas.width = LADO * ANGULOS;
  canvas.height = LADO * BANCOS.length;
  const g = canvas.getContext('2d')!;
  const { faces, bolas, olhos, popa } = modelo(cores);
  const popas: FolhaDoBarco['popas'] = [];
  const ce = Math.cos(ELEVACAO), se = Math.sin(ELEVACAO);
  const corCss = (k: RGB, luz: number) => `rgb(${Math.min(255, Math.round(k[0] * luz))}, ${Math.min(255, Math.round(k[1] * luz))}, ${Math.min(255, Math.round(k[2] * luz))})`;
  BANCOS.forEach((banco, linha) => {
    const b = banco * 0.22, cb = Math.cos(b), sb = Math.sin(b);
    for (let k = 0; k < ANGULOS; k++) {
      const rel = (k * 2 * Math.PI) / ANGULOS;
      const cr = Math.cos(rel), sr = Math.sin(rel);
      const ox = k * LADO + PE_X, oy = linha * LADO + PE_Y;
      const ver = ([f, r, u]: V3) => {
        const r1 = r * cb + u * sb, u1 = u * cb - r * sb;
        const X = f * cr - r1 * sr, Y = f * sr + r1 * cr, Z = u1;
        return { X, Y, Z, sx: ox + Y, sy: oy - (Z * ce + X * se), prof: X * ce - Z * se };
      };
      const centro = ver([0, 0, 0.5]);
      const itens: { prof: number; desenhar: () => void }[] = [];
      for (const face of faces) {
        const vs = face.pts.map(ver);
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
        const paraCamera = nx * ce - nz * se;
        if (!face.duasFaces && paraCamera > 0.02) continue;
        let d = nx * LUZ[0] + ny * LUZ[1] + nz * LUZ[2];
        if (face.duasFaces) d = Math.abs(d);
        const luz = 0.5 + Math.round(Math.max(0, d) * 3) * 0.2;
        const cor = corCss(face.cor, luz);
        itens.push({
          prof: vs.reduce((s, v) => s + v.prof, 0) / vs.length,
          desenhar: () => {
            g.fillStyle = cor;
            g.beginPath();
            vs.forEach((v, i) => (i ? g.lineTo(v.sx, v.sy) : g.moveTo(v.sx, v.sy)));
            g.closePath();
            g.fill();
          },
        });
      }
      bolas.forEach((bola, i) => {
        const c = ver(bola.centro);
        itens.push({
          prof: c.prof,
          desenhar: () => {
            g.fillStyle = corCss(bola.cor, 0.8);
            g.beginPath();
            g.arc(c.sx, c.sy, bola.raio, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = corCss(bola.cor, 1.04);
            g.beginPath();
            g.arc(c.sx - bola.raio * 0.25, c.sy - bola.raio * 0.28, bola.raio * 0.66, 0, Math.PI * 2);
            g.fill();
            if (i === 1) {
              for (const o of olhos.map(ver)) {
                if (o.prof < c.prof - 0.5) {
                  g.fillStyle = '#1e1622';
                  g.fillRect(Math.round(o.sx - 0.5), Math.round(o.sy - 0.5), 1, 1);
                }
              }
            }
          },
        });
      });
      itens.sort((a, b2) => b2.prof - a.prof);
      for (const it of itens) it.desenhar();
      const m = ver(popa);
      popas.push({ x: m.sx - k * LADO, y: m.sy - linha * LADO });
    }
  });
  contornar(g, canvas.width, canvas.height);
  return { canvas, popas };
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

/** A vista certa para um barco que aponta `angulo`, visto da câmera em (cx, cy). */
export function vistaDoBarco(angulo: number, cx: number, cy: number, x: number, y: number): number {
  const rel = angulo - Math.atan2(y - cy, x - cx);
  return ((Math.round(rel / ((2 * Math.PI) / ANGULOS)) % ANGULOS) + ANGULOS) % ANGULOS;
}

const folhas = new Map<string, FolhaDoBarco>();
/** A folha pronta (guardada por conjunto de cores: o StrictMode e o "Jogar de novo" não refazem). */
export function folhaGuardada(cores: CoresDoBarco): FolhaDoBarco {
  const chave = JSON.stringify(cores);
  let f = folhas.get(chave);
  if (!f) {
    f = folhaDoBarco(cores);
    folhas.set(chave, f);
  }
  return f;
}
