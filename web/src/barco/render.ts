import { sorteio } from '../jato/util';
import { folhaGuardada, LADO, PE_X, PE_Y, vistaDoBarco, type CoresDoBarco } from './barquinho';
import { AGUA_RASA, CORRENTEZA, correntezaEm, MUNDO, RES, type Enfeite, type PistaDoBarco, type TemaDoBarco } from './pista';

/**
 * O DESENHO DA REGATA DA TOCA (05/11/2026): a mesma câmera do "Mode 7" da Corrida dos coelhos e dos Coelhos a jato (de onde a
 * forma foi copiada), numa tela de 320 × 180 que o navegador amplia com os pixels nítidos. O que é próprio da água:
 * - A ÁGUA MEXE. O mapa guarda só a profundidade; a cada quadro, duas ondulações que se repetem (64 × 64) andam em rumos
 *   diferentes, e a soma delas escolhe o tom (fundo, médio, claro, brilho) em degraus, como a paleta curta dos 16 bits. Na
 *   beira, a espuma vai e vem; na correnteza, riscos de espuma descem com a água, na velocidade dela.
 * - A ESTEIRA: cada barco deixa o "V" de espuma que abre e some; derrapando, a espuma espirra do lado de fora.
 * - As PONTES são de verdade em 3D (o tabuleiro, as vigas e os pilares, cortados no plano da câmera): passa-se por baixo.
 * - Na beira, os juncos, as pedras, as árvores, o mangue com as raízes, as boias da corda do lago, tudo desenhado por código.
 */

export const W = 320;
export const H = 180;
export const HORIZONTE = 58;
const ALTURA = 15;
export const ATRAS = 42;
export const FOCO = 150;
const K = RES / MUNDO;
const ONDA = 64;

export interface Camera {
  x: number;
  y: number;
  angulo: number;
  foco: number;
}

export function cameraAtras(x: number, y: number, angulo: number, foco = FOCO, atras = ATRAS): Camera {
  return { x: x - Math.cos(angulo) * atras, y: y - Math.sin(angulo) * atras, angulo, foco };
}

export interface Desenho {
  ctx: CanvasRenderingContext2D;
  imagem: ImageData;
  pontos: Uint32Array;
  ceu: Uint32Array;
  tema: TemaDoBarco;
  /** As cores da água: [profundidade 1–4][nível 0–4]. */
  paleta: Uint32Array;
  ondaA: Uint8Array;
  ondaB: Uint8Array;
  /** A correnteza por unidade de pista (para os riscos de espuma). */
  correnteza: Float32Array;
  longe: Uint32Array;
  sprites: Record<Enfeite, HTMLCanvasElement>;
}

const rgb = (r: number, g: number, b: number) => (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
type RGB = [number, number, number];
const mistura = (a: RGB, b: RGB, t: number): RGB => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];

export function prepararDesenho(canvas: HTMLCanvasElement, p: PistaDoBarco): Desenho {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const imagem = ctx.createImageData(W, H);
  const tema = p.def.tema;
  // a paleta da água: do fundo ao raso, e em cada um do escuro à espuma
  const paleta = new Uint32Array(5 * 5);
  const { funda, rasa, espuma } = tema.agua;
  for (let prof = 1; prof <= 4; prof++) {
    const base = mistura(funda, rasa, ((prof - 1) / 3) * 0.85);
    const tons: RGB[] = [mistura(base, [0, 0, 0], 0.16), base, mistura(base, espuma, 0.2), mistura(base, espuma, 0.5), espuma];
    tons.forEach((c, nivel) => (paleta[prof * 5 + nivel] = rgb(...c)));
  }
  const correnteza = new Float32Array(Math.ceil(p.comprimento) + 2);
  for (let s = 0; s < correnteza.length; s++) correnteza[s] = correntezaEm(p.def, s / p.comprimento);
  return {
    ctx,
    imagem,
    pontos: new Uint32Array(imagem.data.buffer),
    ceu: desenharCeu(tema),
    tema,
    paleta,
    ondaA: ondulacao(3, [[2, 1, 0.3], [1, 3, 1.7], [4, -1, 2.2]]),
    ondaB: ondulacao(9, [[-1, 2, 0.9], [3, 2, 0.1], [-3, 1, 2.9]]),
    correnteza,
    longe: desenharLonge(tema),
    sprites: desenharSprites(tema),
  };
}

/** Uma ondulação que se repete sem emenda (frequências inteiras), de 0 a 127. */
function ondulacao(semente: number, ondas: [number, number, number][]): Uint8Array {
  const o = new Uint8Array(ONDA * ONDA);
  const sorte = sorteio(semente);
  for (let y = 0; y < ONDA; y++) {
    for (let x = 0; x < ONDA; x++) {
      let v = 0;
      for (const [a, b, f] of ondas) v += Math.sin(((x * a + y * b) / ONDA) * Math.PI * 2 + f);
      v = v / ondas.length;
      // um pouco de grão, para não ficar liso demais
      v += (sorte() - 0.5) * 0.25;
      o[y * ONDA + x] = Math.max(0, Math.min(127, Math.round((v * 0.5 + 0.5) * 127)));
    }
  }
  return o;
}

/** O CÉU, numa faixa de 4 telas que dá a volta inteira: o degradê em degraus, as nuvens, o sol, os morros e a mata. */
const CEU_W = W * 4;
function desenharCeu(tema: TemaDoBarco): Uint32Array {
  const ceu = new Uint32Array(CEU_W * HORIZONTE);
  const { topo, baixo } = tema.ceu;
  for (let y = 0; y < HORIZONTE; y++) {
    const u = Math.floor((y / (HORIZONTE - 1)) * 7) / 7;
    ceu.fill(rgb(...mistura(topo, baixo, u)), y * CEU_W, (y + 1) * CEU_W);
  }
  const sorte = sorteio(17);
  const pinta = (x: number, y: number, cor: number) => {
    if (y < 0 || y >= HORIZONTE) return;
    ceu[Math.floor(y) * CEU_W + (((Math.round(x) % CEU_W) + CEU_W) % CEU_W)] = cor;
  };
  // o sol (no mangue, grande e baixo, do fim de tarde)
  const tarde = tema.tipo === 'mangue';
  const [sx, sy, sr] = tarde ? [700, HORIZONTE - 16, 13] : [420, 12, 7];
  for (let y = sy - sr; y <= sy + sr; y++) for (let x = sx - sr; x <= sx + sr; x++) if (Math.hypot(x - sx, y - sy) <= sr) pinta(x, y, tarde ? rgb(255, 214, 150) : rgb(255, 248, 214));
  // as nuvens: bolos achatados de bolinhas, em dois tons
  for (let i = 0; i < 16; i++) {
    const cx = sorte() * CEU_W, cy = 8 + sorte() * (HORIZONTE - 30), larg = 18 + sorte() * 30;
    for (let j = 0; j < 9; j++) {
      const bx = cx + (sorte() - 0.5) * larg, by = cy + (sorte() - 0.5) * 4, r = 3 + sorte() * 4;
      for (let y = -r; y <= r; y++) for (let x = -r * 1.5; x <= r * 1.5; x++) {
        if ((x / 1.5) ** 2 + y * y > r * r) continue;
        pinta(bx + x, by + y, y > r * 0.3 ? (tarde ? rgb(236, 170, 150) : rgb(220, 232, 244)) : tarde ? rgb(255, 214, 196) : rgb(250, 252, 255));
      }
    }
  }
  // os morros, longe e claros; a mata, perto e escura, com as copas redondas
  const morro = rgb(...tema.morros);
  for (let x = 0; x < CEU_W; x++) {
    const t = (x / CEU_W) * Math.PI * 2;
    const h = 10 + Math.sin(t * 3 + 1) * 5 + Math.sin(t * 7) * 2.5 + Math.sin(t * 13 + 2) * 1.2;
    for (let y = Math.floor(HORIZONTE - h); y < HORIZONTE; y++) pinta(x, y, morro);
  }
  const mata = tema.mata;
  const escura = rgb(...mistura(mata, [0, 0, 0], 0.25)), clara = rgb(...mistura(mata, [255, 255, 200], 0.15));
  let x = 0;
  while (x < CEU_W) {
    const r = 3 + Math.floor(sorte() * 4);
    const topoY = HORIZONTE - 4 - r - Math.floor(sorte() * 4);
    for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) if (xx * xx + yy * yy <= r * r) pinta(x + xx, topoY + yy, yy < -r / 3 && xx < 0 ? clara : rgb(...mata));
    for (let yy = topoY; yy < HORIZONTE; yy++) for (let xx = -r; xx <= r; xx++) pinta(x + xx, yy, yy > HORIZONTE - 4 ? escura : rgb(...mata));
    if (tema.tipo === 'mangue') for (let yy = HORIZONTE - 4; yy < HORIZONTE; yy++) pinta(x + ((yy * 3) % (2 * r)) - r, yy, rgb(90, 64, 50));
    x += r + 1 + Math.floor(sorte() * 3);
  }
  return ceu;
}

/** Fora do mapa: a mata vista de cima, num ladrilho de 64 × 64 que se repete. */
function desenharLonge(tema: TemaDoBarco): Uint32Array {
  const t = new Uint32Array(64 * 64);
  const sorte = sorteio(5);
  const [a, b] = tema.chao;
  const m = tema.mata;
  for (let i = 0; i < t.length; i++) t[i] = sorte() < 0.5 ? rgb(...a) : rgb(...b);
  for (let i = 0; i < 26; i++) {
    const cx = sorte() * 64, cy = sorte() * 64, r = 4 + sorte() * 5;
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r) continue;
      const px = ((Math.round(cx + x) % 64) + 64) % 64, py = ((Math.round(cy + y) % 64) + 64) % 64;
      t[py * 64 + px] = x + y < -r * 0.6 ? rgb(...mistura(m, [255, 255, 200], 0.18)) : x + y > r * 0.5 ? rgb(...mistura(m, [0, 0, 0], 0.25)) : rgb(...m);
    }
  }
  return t;
}

/** As coisas de pé na beira, desenhadas ponto a ponto num canvas pequeno cada uma. */
function desenharSprites(tema: TemaDoBarco): Record<Enfeite, HTMLCanvasElement> {
  const css = (c: RGB) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  const novo = (w: number, h: number, f: (g: CanvasRenderingContext2D) => void) => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d')!;
    f(g);
    return c;
  };
  const px = (g: CanvasRenderingContext2D, cor: string, x: number, y: number, w = 1, h = 1) => {
    g.fillStyle = cor;
    g.fillRect(x, y, w, h);
  };
  const bola = (g: CanvasRenderingContext2D, cx: number, cy: number, r: number, base: RGB, sombra: RGB, luz: RGB) => {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const d = x * x + y * y;
      if (d > r * r) continue;
      const cor = d > (r - 1) * (r - 1) ? [22, 14, 28] as RGB : x + y < -r * 0.5 ? luz : x + y > r * 0.4 ? sombra : base;
      px(g, css(cor), cx + x, cy + y);
    }
  };
  const mata = tema.mata;
  const mataE = mistura(mata, [0, 0, 0], 0.3), mataC = mistura(mata, [255, 255, 190], 0.25);
  return {
    junco: novo(11, 20, (g) => {
      const folhas = [[1, 9, -1], [3, 4, 0], [5, 0, 1], [7, 5, 0], [9, 10, 1]] as const;
      for (const [x, topo, inclina] of folhas) {
        for (let y = topo; y < 20; y++) px(g, y < topo + 3 ? css([120, 170, 80]) : css([70, 120, 56]), x + (y < topo + 5 ? inclina : 0), y);
      }
      // as taboas: o charuto marrom no alto de duas hastes
      px(g, '#5a3420', 2, 3, 2, 3);
      px(g, '#8a5634', 2, 3, 1, 2);
      px(g, '#5a3420', 7, 1, 2, 3);
      px(g, '#8a5634', 7, 1, 1, 2);
    }),
    pedra: novo(15, 10, (g) => {
      for (let y = 0; y < 10; y++) for (let x = 0; x < 15; x++) {
        const d = ((x - 7) / 7.2) ** 2 + ((y - 7) / 6.5) ** 2;
        if (d > 1 || y > 9) continue;
        const borda = d > 0.75;
        px(g, borda ? '#2a2630' : x < 6 && y < 5 ? '#c4c0c8' : x > 9 || y > 7 ? '#6e6a76' : '#9a96a2', x, y);
      }
      px(g, '#6a8a50', 3, 8, 3, 1);
    }),
    arvore: novo(26, 36, (g) => {
      px(g, '#1a1018', 11, 18, 5, 18);
      px(g, '#6a4630', 12, 18, 3, 18);
      px(g, '#8a6040', 12, 18, 1, 18);
      bola(g, 13, 13, 11, mata, mataE, mataC);
      bola(g, 7, 17, 6, mata, mataE, mataC);
      bola(g, 19, 17, 6, mata, mataE, mataC);
      px(g, css(mataC), 9, 8, 2, 1);
      px(g, '#e85a4a', 16, 12, 2, 2);
      px(g, '#e85a4a', 9, 18, 2, 2);
    }),
    arbusto: novo(16, 11, (g) => {
      bola(g, 5, 6, 5, mata, mataE, mataC);
      bola(g, 10, 5, 5, mata, mataE, mataC);
      px(g, '#f0e0f8', 7, 3, 1, 1);
      px(g, '#f0e0f8', 11, 6, 1, 1);
    }),
    mangue: novo(28, 34, (g) => {
      // as raízes em arco, de pé na lama
      g.strokeStyle = '#4a3226';
      g.lineWidth = 1;
      for (const [x0, x1] of [[3, 11], [7, 13], [24, 16], [20, 14], [12, 14]]) {
        g.beginPath();
        g.moveTo(x0 + 0.5, 34);
        g.quadraticCurveTo(x0 + 0.5, 22, x1 + 0.5, 20);
        g.stroke();
      }
      px(g, '#5a3c2c', 12, 10, 4, 12);
      bola(g, 14, 10, 10, mata, mataE, mataC);
      bola(g, 6, 13, 6, mata, mataE, mataC);
      bola(g, 22, 12, 6, mata, mataE, mataC);
    }),
    boia: novo(6, 5, (g) => {
      px(g, '#1a1018', 0, 1, 6, 3);
      px(g, '#1a1018', 1, 0, 4, 5);
      px(g, '#e84a4a', 1, 1, 2, 3);
      px(g, '#f4f0f0', 3, 1, 2, 3);
      px(g, '#ffffff', 1, 1, 1, 1);
    }),
    estaca: novo(5, 24, (g) => {
      px(g, '#1a1018', 0, 0, 5, 24);
      px(g, '#7a5236', 1, 1, 3, 22);
      px(g, '#a07048', 1, 1, 1, 22);
      px(g, '#5a3a26', 1, 1, 3, 1);
    }),
    flor: novo(7, 8, (g) => {
      px(g, '#4a8a3a', 3, 3, 1, 5);
      px(g, '#4a8a3a', 1, 5, 2, 1);
      for (const [x, y] of [[3, 0], [2, 1], [4, 1], [3, 2]]) px(g, '#f4d040', x, y);
      px(g, '#e85a7a', 3, 1, 1, 1);
    }),
    couve: novo(10, 8, (g) => {
      bola(g, 5, 4, 4, [96, 168, 80], [60, 120, 56], [160, 210, 120]);
      px(g, '#2c5a2a', 5, 2, 1, 4);
    }),
  };
}

/** Quanto cada coisa da beira cresce em relação ao desenho (as árvores são bem maiores que o barco). */
const TAMANHO: Record<Enfeite, number> = { junco: 1.6, pedra: 1.3, arvore: 3.2, arbusto: 1.8, mangue: 3, boia: 1.2, estaca: 1.8, flor: 1.2, couve: 1.3 };
/** O quanto a coisa fica abaixo da linha d'água (as boias flutuam meio afundadas). */
const AFUNDA: Partial<Record<Enfeite, number>> = { boia: 1 };

function misturar(cor: number, t: number, n: RGB) {
  const r = cor & 0xff, g = (cor >> 8) & 0xff, b = (cor >> 16) & 0xff;
  return rgb(Math.round(r + (n[0] - r) * t), Math.round(g + (n[1] - g) * t), Math.round(b + (n[2] - b) * t));
}

/** O céu e o chão (a água mexendo e a terra), para a câmera e o instante `tempo` (s). */
export function desenharChao(d: Desenho, p: PistaDoBarco, cam: Camera, tempo: number): void {
  const { pontos, ceu, paleta, ondaA, ondaB, longe, correnteza } = d;
  const tex = p.textura, agua = p.agua, aoS = p.aoS;
  const desloc = Math.floor((((cam.angulo / (Math.PI * 2)) * CEU_W) % CEU_W + CEU_W) % CEU_W);
  for (let y = 0; y < HORIZONTE; y++) {
    const base = y * CEU_W;
    for (let x = 0; x < W; x++) pontos[y * W + x] = ceu[base + ((x + desloc) % CEU_W)];
  }
  const fx = Math.cos(cam.angulo), fy = Math.sin(cam.angulo);
  const rx = -fy, ry = fx;
  const nevoa = d.tema.nevoa;
  // as ondulações andam em rumos diferentes (em pontos do mapa); a espuma da beira vai e vem
  const ax = Math.floor(tempo * 7), ay = Math.floor(tempo * 3);
  const bx = Math.floor(-tempo * 4), by = Math.floor(tempo * 6);
  const vaiVem = Math.round(Math.sin(tempo * 2.2) * 22);
  const comp = correnteza.length - 2;
  for (let y = HORIZONTE; y < H; y++) {
    const dy = y - HORIZONTE + 0.5;
    const z = (ALTURA * cam.foco) / dy;
    const sx = (rx * z) / cam.foco, sy = (ry * z) / cam.foco;
    let wx = (cam.x + fx * z - sx * (W / 2)) * K, wy = (cam.y + fy * z - sy * (W / 2)) * K;
    const px = sx * K, py = sy * K;
    const nev = Math.min(5, Math.max(0, Math.floor((z - 220) / 100)));
    // longe, a ondulação vira chiado: a água fica no tom do meio
    const liso = z > 520;
    const linha = y * W;
    for (let x = 0; x < W; x++) {
      const tx = wx | 0, ty = wy | 0;
      let cor: number;
      if (tx >= 0 && ty >= 0 && tx < RES && ty < RES) {
        const k = ty * RES + tx;
        const a = agua[k];
        if (a !== 0) {
          const prof = a & 7;
          let nivel = 1;
          if (!liso) {
            const ux = tx >> 1, uy = ty >> 1;
            const v = ondaA[((uy + ay) & 63) * ONDA + ((ux + ax) & 63)] + ondaB[((uy + by) & 63) * ONDA + ((ux + bx) & 63)];
            const vv = prof === AGUA_RASA ? v + 40 + vaiVem : v;
            nivel = vv < 82 ? 0 : vv < 150 ? 1 : vv < 196 ? 2 : vv < 232 ? 3 : prof === AGUA_RASA ? 4 : 3;
            // a correnteza: riscos de espuma que descem com a água
            if (a & CORRENTEZA) {
              const s = aoS[k] / 2;
              const c = correnteza[Math.min(comp, s | 0)];
              const fase = (((s - tempo * c) % 28) + 28) % 28;
              if (fase < 2.2 && v > 96) nivel = 3;
            }
          }
          cor = paleta[prof * 5 + nivel];
        } else cor = tex[k];
      } else cor = longe[((((wy / K) | 0) & 63) << 6) | (((wx / K) | 0) & 63)];
      if (nev > 0) cor = misturar(cor, nev / 6.5, nevoa);
      pontos[linha + x] = cor;
      wx += px;
      wy += py;
    }
  }
  d.ctx.putImageData(d.imagem, 0, 0);
}

/** Onde um ponto do mundo aparece na tela, à altura `h` acima da água: x, y e a escala (1 = do tamanho do barco de quem joga). */
export function projetar(cam: Camera, x: number, y: number, h = 0): { sx: number; sy: number; escala: number; z: number } | null {
  const dx = x - cam.x, dy = y - cam.y;
  const fx = Math.cos(cam.angulo), fy = Math.sin(cam.angulo);
  const z = dx * fx + dy * fy;
  if (z < 6) return null;
  const lado = -dx * fy + dy * fx;
  return { sx: W / 2 + (lado * cam.foco) / z, sy: HORIZONTE + ((ALTURA - h) * cam.foco) / z, escala: (ATRAS * cam.foco) / (FOCO * z), z };
}

/** O quanto o desenho do barco cresce sobre a escala do mundo. */
const ESCALA_DO_BARCO = 1.45;

export interface Figura {
  z: number;
  desenhar: (ctx: CanvasRenderingContext2D) => void;
}

/** As coisas da beira, de pé (só as da frente da câmera, e não longe demais). */
export function enfeitesNaTela(d: Desenho, p: PistaDoBarco, cam: Camera, tempo: number, figuras: Figura[]) {
  for (const o of p.enfeites) {
    const dx = o.x - cam.x, dy = o.y - cam.y;
    if (dx * dx + dy * dy > 560 * 560) continue;
    const pr = projetar(cam, o.x, o.y);
    if (!pr) continue;
    const img = d.sprites[o.tipo];
    const k = pr.escala * TAMANHO[o.tipo] * o.tam;
    const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
    if (pr.sx + w < 0 || pr.sx - w > W || w < 2) continue;
    const balanca = o.tipo === 'boia' ? Math.round(Math.sin(tempo * 3 + o.x) * k) : 0;
    const afunda = (AFUNDA[o.tipo] ?? 0) * k;
    figuras.push({ z: pr.z, desenhar: (ctx) => ctx.drawImage(img, Math.round(pr.sx - w / 2), Math.round(pr.sy - h + afunda + balanca), w, h) });
  }
}

/** As argolas de turbo: um anel listrado de laranja e creme boiando, de pé, que brilha e balança. */
export function argolasNaTela(p: PistaDoBarco, cam: Camera, tempo: number, figuras: Figura[]) {
  p.argolas.forEach((a, i) => {
    const pr = projetar(cam, a.x, a.y, 5);
    if (!pr) return;
    const r = 9 * pr.escala * 3.75;
    if (r < 1.5 || pr.sx + r < 0 || pr.sx - r > W) return;
    // o anel é visto de frente quando a pista vai na direção da câmera, e de lado quando cruza
    const rel = a.angulo - cam.angulo;
    const largura = Math.max(0.25, Math.abs(Math.cos(rel)));
    const sobe = Math.sin(tempo * 2.6 + i) * 0.8 * pr.escala;
    figuras.push({
      z: pr.z,
      desenhar: (ctx) => {
        const cx = pr.sx, cy = pr.sy + sobe;
        const grossura = Math.max(1, r * 0.3);
        const pedacos = 12;
        for (let j = 0; j < pedacos; j++) {
          ctx.beginPath();
          ctx.ellipse(cx, cy, r * largura, r, 0, (j / pedacos) * Math.PI * 2, ((j + 1) / pedacos) * Math.PI * 2);
          ctx.strokeStyle = '#1a1018';
          ctx.lineWidth = grossura + 2;
          ctx.stroke();
          ctx.strokeStyle = j % 2 ? '#fff0d0' : '#f07a2a';
          ctx.lineWidth = grossura;
          ctx.stroke();
        }
        // o brilho que pisca dentro: é por ali que se passa
        if (Math.floor(tempo * 4 + i) % 2 === 0) {
          ctx.fillStyle = '#ffe8a0';
          ctx.fillRect(Math.round(cx - 1), Math.round(cy - r * 0.6), 2, 2);
        }
        // a marola em volta, onde o anel encosta na água
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = '#f4fcff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(cx, cy + r, Math.max(1, r * largura * 0.9), Math.max(1, r * 0.16), 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      },
    });
  });
}

type P3 = [number, number, number];
/** Um polígono no mundo (x, y, altura), cortado no plano da frente da câmera e pintado. */
function poligono(ctx: CanvasRenderingContext2D, cam: Camera, pts: P3[], cor: string) {
  const fx = Math.cos(cam.angulo), fy = Math.sin(cam.angulo);
  const perto = 2;
  const cs = pts.map(([x, y, h]) => {
    const dx = x - cam.x, dy = y - cam.y;
    return { z: dx * fx + dy * fy, l: -dx * fy + dy * fx, h };
  });
  const cortado: typeof cs = [];
  for (let i = 0; i < cs.length; i++) {
    const a = cs[i], b = cs[(i + 1) % cs.length];
    if (a.z >= perto) cortado.push(a);
    if ((a.z >= perto) !== (b.z >= perto)) {
      const t = (perto - a.z) / (b.z - a.z);
      cortado.push({ z: perto, l: a.l + (b.l - a.l) * t, h: a.h + (b.h - a.h) * t });
    }
  }
  if (cortado.length < 3) return;
  ctx.fillStyle = cor;
  ctx.beginPath();
  cortado.forEach((c, i) => {
    const sx = W / 2 + (c.l * cam.foco) / c.z, sy = HORIZONTE + ((ALTURA - c.h) * cam.foco) / c.z;
    if (i) ctx.lineTo(sx, sy);
    else ctx.moveTo(sx, sy);
  });
  ctx.closePath();
  ctx.fill();
}

/** As pontes de madeira: o tabuleiro por cima da água (passa-se por baixo), as vigas e os dois pilares de cada lado. */
export function pontesNaTela(p: PistaDoBarco, cam: Camera, figuras: Figura[]) {
  const fx = Math.cos(cam.angulo), fy = Math.sin(cam.angulo);
  for (const pt of p.pontes) {
    const mx = (pt.ax + pt.bx) / 2, my = (pt.ay + pt.by) / 2;
    const z = (mx - cam.x) * fx + (my - cam.y) * fy;
    if (z < -30 || z > 640) continue;
    const meia = 6;
    const ox = pt.dx * meia, oy = pt.dy * meia;
    const BAIXO = 19, ALTO = 23, CORRIMAO = 28;
    // a frente é o lado do tabuleiro que dá para a câmera
    const lado = (mx - cam.x) * pt.dx + (my - cam.y) * pt.dy > 0 ? -1 : 1;
    const frente = (x: number, y: number) => [x + ox * lado, y + oy * lado] as const;
    const tras = (x: number, y: number) => [x - ox * lado, y - oy * lado] as const;
    const [fax, fay] = frente(pt.ax, pt.ay), [fbx, fby] = frente(pt.bx, pt.by);
    const [tax, tay] = tras(pt.ax, pt.ay), [tbx, tby] = tras(pt.bx, pt.by);
    figuras.push({
      z: Math.max(3, z - meia),
      desenhar: (ctx) => {
        // os pilares, de pedra, nas duas cabeceiras
        for (const [x, y] of [[pt.ax, pt.ay], [pt.bx, pt.by]] as const) {
          const px = -pt.dy * 2, py = pt.dx * 2;
          poligono(ctx, cam, [[x - px, y - py, -2], [x + px, y + py, -2], [x + px, y + py, BAIXO], [x - px, y - py, BAIXO]], '#7a7480');
          poligono(ctx, cam, [[x - px * 0.4, y - py * 0.4, -2], [x + px, y + py, -2], [x + px, y + py, BAIXO], [x - px * 0.4, y - py * 0.4, BAIXO]], '#9a94a0');
        }
        // a barriga do tabuleiro (vista de baixo), as vigas, e a face da frente com as tábuas
        poligono(ctx, cam, [[fax, fay, BAIXO], [fbx, fby, BAIXO], [tbx, tby, BAIXO], [tax, tay, BAIXO]], '#4a3020');
        for (let i = 1; i < 6; i++) {
          const t = i / 6, e = 0.012;
          const x0 = pt.ax + (pt.bx - pt.ax) * (t - e), y0 = pt.ay + (pt.by - pt.ay) * (t - e);
          const x1 = pt.ax + (pt.bx - pt.ax) * (t + e), y1 = pt.ay + (pt.by - pt.ay) * (t + e);
          poligono(ctx, cam, [[x0 + ox, y0 + oy, BAIXO], [x1 + ox, y1 + oy, BAIXO], [x1 - ox, y1 - oy, BAIXO], [x0 - ox, y0 - oy, BAIXO]], '#2e1c14');
        }
        poligono(ctx, cam, [[fax, fay, BAIXO], [fbx, fby, BAIXO], [fbx, fby, ALTO], [fax, fay, ALTO]], '#9a6a42');
        poligono(ctx, cam, [[fax, fay, ALTO - 1], [fbx, fby, ALTO - 1], [fbx, fby, ALTO], [fax, fay, ALTO]], '#c08a58');
        poligono(ctx, cam, [[fax, fay, BAIXO], [fbx, fby, BAIXO], [fbx, fby, BAIXO + 0.7], [fax, fay, BAIXO + 0.7]], '#3a2418');
        // o corrimão: os balaústres e a barra de cima
        for (let i = 0; i <= 10; i++) {
          const t = i / 10;
          const x = fax + (fbx - fax) * t, y = fay + (fby - fay) * t;
          const px = (fbx - fax) * 0.008, py = (fby - fay) * 0.008;
          poligono(ctx, cam, [[x - px, y - py, ALTO], [x + px, y + py, ALTO], [x + px, y + py, CORRIMAO], [x - px, y - py, CORRIMAO]], '#6a4630');
        }
        poligono(ctx, cam, [[fax, fay, CORRIMAO - 1], [fbx, fby, CORRIMAO - 1], [fbx, fby, CORRIMAO], [fax, fay, CORRIMAO]], '#a07048');
      },
    });
  }
}

/** A ESTEIRA de um barco: as posições de onde ele passou, as mais novas por último. */
export interface Esteira {
  pontos: { x: number; y: number; a: number; v: number }[];
}

export const novaEsteira = (): Esteira => ({ pontos: [] });
export function marcarEsteira(e: Esteira, x: number, y: number, a: number, v: number) {
  e.pontos.push({ x, y, a, v });
  if (e.pontos.length > 50) e.pontos.shift();
}

/** O "V" de espuma: cada ponto da esteira solta dois risquinhos que se abrem para os lados e somem. */
export function esteiraNaTela(cam: Camera, e: Esteira, figuras: Figura[], forte = 1) {
  const n = e.pontos.length;
  for (let i = 0; i < n; i += 2) {
    const q = e.pontos[i];
    if (q.v < 25) continue;
    const idade = (n - 1 - i) / 50;
    const abre = 2.5 + idade * 16;
    const nx = -Math.sin(q.a), ny = Math.cos(q.a);
    const tras = 4 + idade * 4;
    for (const l of [-1, 1]) {
      const x = q.x - Math.cos(q.a) * tras + nx * abre * l, y = q.y - Math.sin(q.a) * tras + ny * abre * l;
      const pr = projetar(cam, x, y);
      if (!pr) continue;
      // a espuma: pontinhos que se espalham e ficam mais ralos com a idade, nunca um traço reto
      const tam = Math.max(1, Math.round(pr.escala * 1.6 * (1 - idade * 0.4)));
      const alfa = Math.min(0.8, (1 - idade) * (q.v / 150)) * forte;
      if (alfa < 0.06) continue;
      const semente = (i * 7 + (l > 0 ? 3 : 0)) % 5;
      figuras.push({
        z: pr.z + 0.5,
        desenhar: (ctx) => {
          ctx.globalAlpha = alfa;
          ctx.fillStyle = idade < 0.3 ? '#ffffff' : '#dcecf0';
          ctx.fillRect(Math.round(pr.sx - tam), Math.round(pr.sy), tam * 2, tam);
          if (idade < 0.6) ctx.fillRect(Math.round(pr.sx + (semente - 2) * tam), Math.round(pr.sy - tam), tam, tam);
          ctx.globalAlpha = 1;
        },
      });
    }
  }
}

/**
 * Um barco na tela: a sombra na água, o barco balançando nas ondas e inclinado pelo `banco`, a espuma da proa e, derrapando,
 * o borrifo do lado de fora; e o nome em cima (os da turma).
 */
export function barcoNaTela(
  cam: Camera,
  x: number,
  y: number,
  angulo: number,
  cores: CoresDoBarco,
  o: { banco?: number; fantasma?: boolean; nome?: string; tremor?: number; tempo: number; v?: number; derrapa?: number; calmo?: boolean },
): Figura | null {
  const pr = projetar(cam, x, y);
  if (!pr) return null;
  // o barco é desenhado maior que a escala do mundo (como o kart): é ele que se olha a corrida inteira
  const e = pr.escala * ESCALA_DO_BARCO;
  const w = LADO * e;
  if (w < 2 || pr.sx + w < 0 || pr.sx - w > W) return null;
  const folha = folhaGuardada(cores);
  const k = vistaDoBarco(angulo, cam.x, cam.y, x, y);
  // o balanço das ondas, somado à inclinação da curva
  const ondas = o.calmo ? 0 : Math.sin(o.tempo * 2.3 + x * 0.07) * 0.45;
  const banco = (o.banco ?? 0) + ondas;
  const linha = banco < -0.5 ? 0 : banco > 0.5 ? 2 : 1;
  const sobe = o.calmo ? 0 : Math.sin(o.tempo * 3.1 + y * 0.05) * 0.9 * e;
  const nx = pr.sx - PE_X * e, ny = pr.sy - PE_Y * e + sobe + (o.tremor ?? 0);
  const v = o.v ?? 0;
  return {
    z: pr.z,
    desenhar: (ctx) => {
      // a sombra na água
      ctx.save();
      ctx.globalAlpha = o.fantasma ? 0.12 : 0.28;
      ctx.fillStyle = '#0a1420';
      ctx.beginPath();
      ctx.ellipse(pr.sx, pr.sy + e, 14 * e, 4 * e, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (o.fantasma) ctx.globalAlpha = 0.45;
      ctx.drawImage(folha.canvas, k * LADO, linha * LADO, LADO, LADO, Math.round(nx), Math.round(ny), Math.round(w), Math.round(w));
      ctx.globalAlpha = 1;
      // a espuma em volta do casco, na linha d'água, quando anda
      if (!o.fantasma && v > 40) {
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = Math.min(0.9, v / 200);
        const larg = 13 * e;
        for (let i = 0; i < 6; i++) {
          const t = (i / 5) * 2 - 1;
          const bx = pr.sx + t * larg, by = pr.sy + e * (1.5 + Math.abs(Math.sin(o.tempo * 17 + i)) * 1.5);
          ctx.fillRect(Math.round(bx), Math.round(by), Math.max(1, Math.round(e * 2.2)), Math.max(1, Math.round(e * 1.2)));
        }
        ctx.globalAlpha = 1;
      }
      // derrapando: o borrifo do lado de fora da curva
      if (!o.fantasma && o.derrapa && Math.abs(o.derrapa) > 0.2) {
        const lado = Math.sign(o.derrapa);
        ctx.fillStyle = '#f4fcff';
        for (let i = 0; i < 9; i++) {
          const s = Math.abs(Math.sin(o.tempo * 41 + i * 1.9)), c = Math.abs(Math.cos(o.tempo * 29 + i * 2.7));
          ctx.globalAlpha = 0.5 + 0.4 * s;
          ctx.fillRect(Math.round(pr.sx + lado * (8 + s * 12) * e), Math.round(pr.sy - c * 10 * e * Math.min(1, Math.abs(o.derrapa))), Math.max(1, Math.round(2 * e)), Math.max(1, Math.round(2 * e)));
        }
        ctx.globalAlpha = 1;
      }
      if (o.nome && e > 0.28) {
        ctx.font = '7px sans-serif';
        ctx.textAlign = 'center';
        const tx = Math.round(pr.sx), ty = Math.round(ny + 8 * e);
        ctx.fillStyle = '#140e1c';
        ctx.fillText(o.nome, tx + 1, ty + 1);
        ctx.fillStyle = '#f6f0ff';
        ctx.fillText(o.nome, tx, ty);
      }
    },
  };
}

/** O respingo da batida na margem, do lado em que bateu. */
export function respingo(ctx: CanvasRenderingContext2D, lado: number, tempo: number, t: number) {
  const x = W / 2 + lado * 22, y = 150;
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 12; i++) {
    const s = Math.sin(tempo * 53 + i * 1.7), c = Math.abs(Math.cos(tempo * 31 + i * 2.3));
    ctx.globalAlpha = Math.max(0, t);
    ctx.fillRect(Math.round(x + lado * Math.abs(s) * 14), Math.round(y - c * 18 * t), 2, 2);
  }
  ctx.globalAlpha = 1;
}

/**
 * O PAINEL: a posição no canto direito ("2/4"), a velocidade numa barra embaixo e, no turbo, a barrinha laranja que acaba.
 * Tudo desenho e número: nenhuma palavra.
 */
export function painel(ctx: CanvasRenderingContext2D, o: { posicao: number; total: number; v: number; vmax: number; turbo: number }) {
  if (o.total > 1) {
    ctx.textAlign = 'right';
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = '#140e1c';
    ctx.fillText(String(o.posicao), W - 30, 46);
    ctx.fillStyle = o.posicao === 1 ? '#ffd860' : '#f6f0ff';
    ctx.fillText(String(o.posicao), W - 31, 45);
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#140e1c';
    ctx.fillText(`/${o.total}`, W - 28, 46);
    ctx.fillStyle = '#e8f0ff';
    ctx.fillText(`/${o.total}`, W - 29, 45);
  }
  const vx = 8, vy = H - 12, vw = 60;
  ctx.fillStyle = '#140e1c';
  ctx.fillRect(vx - 1, vy - 1, vw + 2, 5);
  const fv = Math.max(0, Math.min(1, o.v / o.vmax));
  for (let i = 0; i < vw; i += 3) {
    if (i / vw > fv) break;
    ctx.fillStyle = i / vw > 0.7 ? '#ff9a4a' : '#8ad8ff';
    ctx.fillRect(vx + i, vy, 2, 3);
  }
  if (o.turbo > 0) {
    ctx.fillStyle = '#140e1c';
    ctx.fillRect(vx - 1, vy - 7, vw + 2, 4);
    ctx.fillStyle = '#f07a2a';
    ctx.fillRect(vx, vy - 6, Math.round(vw * Math.min(1, o.turbo)), 2);
  }
}

/** O semáforo: três luzes vermelhas, uma a uma, e as três verdes na saída. */
export function semaforo(ctx: CanvasRenderingContext2D, contagem: number) {
  const acesas = contagem > 0 ? Math.min(3, Math.max(0, 3 - Math.floor((contagem - 1) / 60))) : 3;
  const verde = contagem === 0;
  const x0 = W / 2 - 27, y0 = 14;
  ctx.fillStyle = '#140e1c';
  ctx.fillRect(x0 - 4, y0 - 4, 62, 22);
  ctx.fillStyle = '#2e2640';
  ctx.fillRect(x0 - 3, y0 - 3, 60, 20);
  for (let i = 0; i < 3; i++) {
    const cx = x0 + 7 + i * 20;
    ctx.fillStyle = verde ? '#7ee070' : i < acesas ? '#ff5a6a' : '#4a2232';
    ctx.fillRect(cx - 6, y0 + 1, 12, 12);
    ctx.fillStyle = verde ? '#d0ffc0' : i < acesas ? '#ffc0c8' : '#5a3040';
    ctx.fillRect(cx - 4, y0 + 3, 4, 4);
  }
}

/** O mapa pequeno: a água vista de cima (a pista clara, o lago aberto mais escuro), sem a terra. */
export function mapaDaPista(p: PistaDoBarco, lado: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = lado;
  const g = c.getContext('2d')!;
  const img = g.createImageData(lado, lado);
  const px = new Uint32Array(img.data.buffer);
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const tx = Math.floor(((x + 0.5) / lado) * RES), ty = Math.floor(((y + 0.5) / lado) * RES);
      const a = p.agua[ty * RES + tx];
      px[y * lado + x] = a === 0 ? 0 : a & 0x20 ? rgb(60, 110, 150) : a & CORRENTEZA ? rgb(150, 220, 236) : rgb(206, 236, 246);
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function pontoNoMapa(ctx: CanvasRenderingContext2D, x0: number, y0: number, lado: number, x: number, y: number, cor: string, tam = 3) {
  const px = Math.round(x0 + (x / MUNDO) * lado), py = Math.round(y0 + (y / MUNDO) * lado);
  ctx.fillStyle = '#140e1c';
  ctx.fillRect(px - (tam >> 1) - 1, py - (tam >> 1) - 1, tam + 2, tam + 2);
  ctx.fillStyle = cor;
  ctx.fillRect(px - (tam >> 1), py - (tam >> 1), tam, tam);
}
