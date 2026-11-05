import { CORES_DOS_AVATARES, MOLETOM_DO_MASCOTE, PELO_DO_MASCOTE } from './coresDosAvatares';
import { MUNDO, RES, sorteio, type Pista, type Tema } from './pista';

/**
 * O DESENHO DA CORRIDA (03/11/2026): a câmera do "Mode 7" do Super Nintendo. O chão é a textura da pista deitada em
 * perspectiva, linha por linha da tela: cada linha abaixo do horizonte está a uma distância da câmera, e anda-se pela
 * textura em linha reta de um lado ao outro. Em cima, o céu e as montanhas, que correm de lado quando a câmera vira.
 * Os karts, as árvores e as cenouras são desenhos de frente (sprites), do tamanho que a distância pede.
 *
 * Tudo numa tela pequena (320 × 180) que o navegador amplia com os pixels nítidos: é o que dá o jeito de 16 bits, e
 * custa pouco ao processador (o chão inteiro são ~40 mil pontos por quadro).
 */

export const W = 320;
export const H = 180;
export const HORIZONTE = 58;
/** A câmera: altura, distância atrás do kart e a "lente" (quanto um ponto do mundo cresce na tela). */
const ALTURA = 22;
export const ATRAS = 38;
const FOCO = 172;
const K = RES / MUNDO;

export interface Camera {
  x: number;
  y: number;
  angulo: number;
}

/** A câmera vai atrás do kart, no ângulo dela (que segue o do kart com um atraso: é o que mostra o kart virando). */
export function cameraAtras(kx: number, ky: number, angulo: number): Camera {
  return { x: kx - Math.cos(angulo) * ATRAS, y: ky - Math.sin(angulo) * ATRAS, angulo };
}


export interface Desenho {
  ctx: CanvasRenderingContext2D;
  /** A cor do horizonte (a névoa de longe) e a do que fica fora do mapa, do tema da pista. */
  nevoa: [number, number, number];
  fora: number;
  imagem: ImageData;
  pontos: Uint32Array;
  ceu: Uint32Array;
  /** As figuras prontas (kart, árvore, cenoura, flor), como canvas. */
  figuras: Record<string, HTMLCanvasElement>;
  coelho: HTMLImageElement | null;
}

export function prepararDesenho(canvas: HTMLCanvasElement, tema: Tema): Desenho {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const imagem = ctx.createImageData(W, H);
  return {
    ctx,
    imagem,
    pontos: new Uint32Array(imagem.data.buffer),
    nevoa: tema.ceu.baixo,
    fora: tema.grama[1],
    ceu: desenharCeu(tema),
    figuras: {
      arvore: arvore(),
      laranjeira: laranjeira(),
      pinheiro: pinheiro(false),
      'pinheiro-neve': pinheiro(true),
      cacto: cacto(),
      coqueiro: coqueiro(),
      cenoura: cenoura(),
      flor: flor(),
      caixa: caixa(),
      repolho: repolho(),
      'repolho-roxo': repolhoRoxo(),
      lama: lama(),
      escudo: escudo(),
      toca: toca(),
      regador: regador(),
      nuvem: nuvem(),
    },
    coelho: null,
  };
}

const rgb = (r: number, g: number, b: number) => (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;

/**
 * O CÉU, numa faixa de 4 telas de largura que dá a volta inteira (360°): o degradê do fim da tarde, nuvens e duas
 * fileiras de morros, a de trás mais clara. Desenhado uma vez, ponto a ponto, como pixel art.
 */
const CEU_W = W * 4;
function desenharCeu(tema: Tema): Uint32Array {
  const ceu = new Uint32Array(CEU_W * HORIZONTE);
  const { topo, meio, baixo } = tema.ceu;
  const [fundoClaro, fundoCor, frenteCor, frenteFaixa] = tema.morros.map((c) => rgb(...c));
  for (let y = 0; y < HORIZONTE; y++) {
    const t = y / (HORIZONTE - 1);
    const a = t < 0.6 ? topo : meio, b = t < 0.6 ? meio : baixo, u = t < 0.6 ? t / 0.6 : (t - 0.6) / 0.4;
    // em faixas, como as paletas de 16 bits: o degradê em degraus de 3 linhas
    const uq = Math.floor(u * 6) / 6;
    const cor = rgb(...(a.map((c, i) => Math.round(c + (b[i] - c) * uq)) as [number, number, number]));
    ceu.fill(cor, y * CEU_W, (y + 1) * CEU_W);
  }
  const sorte = sorteio(11);
  // nuvens: elipses achatadas, de dois tons
  for (let i = 0; i < 14; i++) {
    const cx = sorte() * CEU_W, cy = 6 + sorte() * 22, rx = 10 + sorte() * 22, ry = 2 + sorte() * 3;
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++) {
      for (let x = Math.floor(cx - rx); x <= cx + rx; x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (d > 1 || y < 0 || y >= HORIZONTE) continue;
        const xx = ((x % CEU_W) + CEU_W) % CEU_W;
        ceu[y * CEU_W + xx] = y > cy + ry * 0.3 ? rgb(232, 196, 196) : rgb(250, 232, 222);
      }
    }
  }
  // os morros: duas fileiras, somando senos (o perfil dá a volta sem emenda)
  const morro = (x: number, fases: number[], amp: number) =>
    fases.reduce((s, f, i) => s + Math.sin((x / CEU_W) * Math.PI * 2 * (i + 2) + f) * (amp / (i + 1)), 0);
  const fundo = [sorte() * 6, sorte() * 6, sorte() * 6], frente = [sorte() * 6, sorte() * 6, sorte() * 6, sorte() * 6];
  for (let x = 0; x < CEU_W; x++) {
    const h1 = HORIZONTE - 16 - morro(x, fundo, 7);
    const h2 = HORIZONTE - 7 - morro(x, frente, 4);
    for (let y = 0; y < HORIZONTE; y++) {
      if (y >= h2) ceu[y * CEU_W + x] = (x >> 2) % 7 === 0 && y > h2 + 2 ? frenteFaixa : frenteCor;
      else if (y >= h1) ceu[y * CEU_W + x] = y < h1 + 1 ? fundoClaro : fundoCor;
    }
  }
  return ceu;
}

/** Uma figura pequena desenhada à mão em código: cada letra do mapa é uma cor. */
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

function arvore() {
  return figura(
    [
      '.......kkkkkk.......',
      '.....kkGGGGGGkk.....',
      '....kGGGGgGGGGGk....',
      '...kGGgGGGGGGgGGk...',
      '..kGGGGGGGGGGGGGGk..',
      '..kGgGGGGGGgGGGGdk..',
      '.kGGGGGGgGGGGGGGddk.',
      '.kGGGgGGGGGGGgGGddk.',
      '.kGGGGGGGGGGGGGdddk.',
      '.kdGGGGGgGGGGGGdddk.',
      '..kdGGGGGGGGGGdddk..',
      '..kddGGGGGGGGddddk..',
      '...kdddGGGdddddk....',
      '....kkdddddddkk.....',
      '......kkkTTkk.......',
      '........kTTk........',
      '........kTtk........',
      '........kTtk........',
      '.......kkTtkk.......',
      '.......kkkkkk.......',
    ],
    { k: '#1e2a1e', G: '#5e9a4c', g: '#86bc62', d: '#3e6e3a', T: '#8a5a36', t: '#6a4428' },
  );
}

/** A laranjeira do Pomar: a copa do outono, com as frutas. */
function laranjeira() {
  return figura(
    [
      '.......kkkkkk.......',
      '.....kkGGGGGGkk.....',
      '....kGGoGGgGGGGk....',
      '...kGGgGGGGGoGGGk...',
      '..kGoGGGGGGGGGGGGk..',
      '..kGgGGGGoGgGGGGdk..',
      '.kGGGGGGgGGGGGoGddk.',
      '.kGoGgGGGGGGGgGGddk.',
      '.kGGGGGGGoGGGGGdddk.',
      '.kdGGGGGgGGGGoGdddk.',
      '..kdGoGGGGGGGGdddk..',
      '..kddGGGGGoGGddddk..',
      '...kdddGGGdddddk....',
      '....kkdddddddkk.....',
      '......kkkTTkk.......',
      '........kTTk........',
      '........kTtk........',
      '........kTtk........',
      '.......kkTtkk.......',
      '.......kkkkkk.......',
    ],
    { k: '#2a1e14', G: '#6e8a3a', g: '#8eaa4a', d: '#4e6a2a', o: '#f08a3a', T: '#8a5a36', t: '#6a4428' },
  );
}

/** O pinheiro do Bosque (e o da Neve, com a neve nos galhos). */
function pinheiro(neve: boolean) {
  return figura(
    [
      '.........kk.........',
      '........kGGk........',
      '.......kGNGGk.......',
      '......kGGGGgGk......',
      '.....kNGGgGGGGk.....',
      '......kkGGGGkk......',
      '.....kGGGNGGGGk.....',
      '....kGGgGGGGgGGk....',
      '...kNGGGGgGGGGNGk...',
      '....kkkGGGGGGkkk....',
      '....kGGGGNGGGGGk....',
      '...kGGgGGGGGgGGGk...',
      '..kGNGGGGgGGGGGNGk..',
      '.kGGGGGgGGGGGgGGGGk.',
      '..kkkkkkkTTkkkkkkk..',
      '........kTtk........',
      '........kTtk........',
      '.......kkkkkk.......',
    ],
    neve
      ? { k: '#1e2a2e', G: '#3e6e5a', g: '#5a8a70', N: '#f4f8ff', T: '#7a5236', t: '#5a3c28' }
      : { k: '#1a261c', G: '#2e5e3e', g: '#4a7a50', N: '#2e5e3e', T: '#7a5236', t: '#5a3c28' },
  );
}

/** O cacto do Cânion. */
function cacto() {
  return figura(
    [
      '.......kkk.......',
      '......kGgGk......',
      '......kGgGk......',
      '.kk...kGgGk......',
      'kGgk..kGgGk...kk.',
      'kGgk..kGgGk..kGgk',
      'kGgk..kGgGk..kGgk',
      'kGgGkkkGgGk..kGgk',
      '.kGgGGGGgGkkkGgGk',
      '..kkkkkGgGGGGGgk.',
      '......kGgGkkkkk..',
      '......kGgGk......',
      '......kGgGk......',
      '.....kkkkkkk.....',
    ],
    { k: '#1e2a1e', G: '#5a8a4a', g: '#7aaa5e' },
  );
}

/** O coqueiro da Praia: o tronco curvo e as folhas abertas. */
function coqueiro() {
  return figura(
    [
      '....kk.......kk.....',
      '...kGGk.....kGGk....',
      '..kGGGGk...kGGGGk...',
      '.kGGkkGGkkkGGkkGGk..',
      'kGk...kGGgGGk...kGk.',
      'kk...kGGcGcGGk...kk.',
      '....kGGk.cc.kGGk....',
      '...kGk..kTTk..kGk...',
      '...kk...kTtk...kk...',
      '........kTtk........',
      '.........kTtk.......',
      '.........kTtk.......',
      '.........kTTk.......',
      '..........kTtk......',
      '..........kTtk......',
      '..........kTTk......',
      '..........kTtk......',
      '.........kTTtk......',
      '.........kTtk.......',
      '........kkTTkk......',
      '........kkkkkk......',
    ],
    { k: '#1e2a1e', G: '#4e9a58', g: '#7cc070', c: '#7a5432', T: '#a8784a', t: '#86603a' },
  );
}

/** A caixa de item (a corrida da sala): um caixote com a cenoura pintada. */
function caixa() {
  return figura(
    [
      'kkkkkkkkkkkk',
      'kMmmmmmmmmMk',
      'kmMk.gg.kMmk',
      'km.kg..gk.mk',
      'km..kOOk..mk',
      'km..kOok..mk',
      'km...kOk..mk',
      'km...kk...mk',
      'kmMk....kMmk',
      'kMmmmmmmmmMk',
      'kkkkkkkkkkkk',
    ],
    { k: '#2a1a14', M: '#c88a4a', m: '#a86c38', O: '#f08a3a', o: '#ffc07a', g: '#6aa848' },
  );
}

/** O repolho que rola (o item que vai pela pista até o kart da frente). */
function repolho() {
  return figura(
    ['...kkkk...', '..kGgGGk..', '.kGgGGgGk.', 'kGGgGgGGgk', 'kgGGgGGgGk', 'kGgGGgGgGk', '.kGGgGGGk.', '..kgGGgk..', '...kkkk...'],
    { k: '#1e2a1e', G: '#86c06a', g: '#5e9a4c' },
  );
}

/** O repolho-roxo (o que segue o kart da frente): o mesmo desenho, em roxo, com o brilho. */
function repolhoRoxo() {
  return figura(
    ['...kkkk...', '..kPpPPk..', '.kPpPPpPk.', 'kPPpPwPPpk', 'kpPPpPPpPk', 'kPpPPpPpPk', '.kPPpPPPk.', '..kpPPpk..', '...kkkk...'],
    { k: '#22142a', P: '#a868c8', p: '#7a3e9a', w: '#f0d8ff' },
  );
}

/** O escudo de alface: as folhas em roda, abertas no meio (o kart aparece por dentro). */
function escudo() {
  return figura(
    [
      '.....kkkkkkkk.....',
      '...kkGgGGgGGgkk...',
      '..kGgGk....kGgGk..',
      '.kGgk........kgGk.',
      'kGgk..........kGgk',
      'kgGk..........kgGk',
      'kGgk..........kGgk',
      '.kGgk........kgGk.',
      '..kGgGk....kGgGk..',
      '...kkGgGGgGGgkk...',
      '.....kkkkkkkk.....',
    ],
    { k: '#2a4a1e', G: '#9ad070', g: '#c8ec98' },
  );
}

/** A toca: o monte de terra andando por baixo da pista, com as duas orelhas de fora. */
function toca() {
  return figura(
    [
      '.....kk..kk.......',
      '....kWWk.kWWk.....',
      '....kWpk.kWpk.....',
      '....kWpk.kWpk.....',
      '.....kWk.kWk......',
      '...kkkkkkkkkkkk...',
      '..kTTtTTTTtTTTTk..',
      '.kTtTTTTtTTTTtTTk.',
      'kTTTTtTTTTTtTTTTTk',
      'kkkkkkkkkkkkkkkkkk',
    ],
    { k: '#2a1a14', T: '#8a6038', t: '#a87a4a', W: '#f4ece8', p: '#e8a0b4' },
  );
}

/** O regador (o item que faz chover em quem está na frente). */
function regador() {
  return figura(
    [
      '......kkkk....',
      '.....k....k...',
      'k...kkkkkkkk..',
      'kk..kBBBBBBk..',
      '.kk.kBbBBBBkk.',
      '..kkkBBBBBBk.k',
      '...kBBBbBBBk.k',
      '....kBBBBBBkk.',
      '....kkkkkkkk..',
    ],
    { k: '#1e2a3a', B: '#5a9ad0', b: '#a8d0f0' },
  );
}

/** A nuvenzinha da chuva, em cima de quem está debaixo dela. */
function nuvem() {
  return figura(
    [
      '....kkkk......',
      '..kkNNNNkkk...',
      '.kNNnNNNNNNk..',
      'kNNNNNNnNNNNk.',
      'kNnNNNNNNNNNNk',
      '.kkkkkkkkkkkk.',
      '..b...b...b...',
      '.b...b...b....',
    ],
    { k: '#4a5a6a', N: '#d8e0ea', n: '#ffffff', b: '#7ab4ec' },
  );
}

/** A poça de lama (o item que fica para trás). */
function lama() {
  return figura(
    ['....kkkkkkkk....', '..kkLlLLLlLLkk..', '.kLLLlLLLLLlLLk.', 'kLlLLLLlLLLLLlLk', '.kLLLlLLLlLLLLk.', '..kkkkkkkkkkkk..'],
    { k: '#2a1a14', L: '#6a4628', l: '#8a6038' },
  );
}

function cenoura() {
  return figura(
    [
      '...k.k.k...',
      '..kgkgkgk..',
      '..kgGgGgk..',
      '...kgGgk...',
      '..kkOOOkk..',
      '..kOoOOOk..',
      '..kOOOOOk..',
      '...kOoOk...',
      '...kOOOk...',
      '....kOk....',
      '....kkk....',
    ],
    { k: '#2a1a14', g: '#6aa848', G: '#9ad070', O: '#e8803a', o: '#f6b26a' },
  );
}

function flor() {
  return figura(
    ['..k.k..', '.kPkPk.', 'kPPyPPk', '.kPkPk.', '..kgk..', '...g...'],
    { k: '#3a2030', P: '#ec8aa6', y: '#f6d66a', g: '#5e9a4c' },
  );
}

/** Desenha o chão e o céu da câmera. */
export function desenharChao(d: Desenho, p: Pista, cam: Camera): void {
  const { pontos, ceu } = d;
  const tex = p.textura;
  // o céu: a faixa corre com o ângulo da câmera (uma volta inteira = a faixa inteira)
  const desloc = Math.floor((((cam.angulo / (Math.PI * 2)) * CEU_W) % CEU_W + CEU_W) % CEU_W);
  for (let y = 0; y < HORIZONTE; y++) {
    const base = y * CEU_W;
    for (let x = 0; x < W; x++) pontos[y * W + x] = ceu[base + ((x + desloc) % CEU_W)];
  }
  const fx = Math.cos(cam.angulo), fy = Math.sin(cam.angulo);
  const rx = -fy, ry = fx;
  for (let y = HORIZONTE; y < H; y++) {
    const dy = y - HORIZONTE + 0.5;
    const z = (ALTURA * FOCO) / dy;
    // o ponto do chão no meio da linha, e o passo de um ponto da tela para o lado
    const cx = cam.x + fx * z, cy = cam.y + fy * z;
    const sx = (rx * z) / FOCO, sy = (ry * z) / FOCO;
    let wx = (cx - sx * (W / 2)) * K, wy = (cy - sy * (W / 2)) * K;
    const px = sx * K, py = sy * K;
    // a névoa: só nas linhas de longe, em 4 degraus
    const nev = Math.min(4, Math.max(0, Math.floor((z - 220) / 110)));
    const linha = y * W;
    for (let x = 0; x < W; x++) {
      const tx = wx | 0, ty = wy | 0;
      let cor = tx >= 0 && ty >= 0 && tx < RES && ty < RES ? tex[ty * RES + tx] : d.fora;
      if (nev > 0) cor = misturar(cor, nev / 5, d.nevoa);
      pontos[linha + x] = cor;
      wx += px;
      wy += py;
    }
  }
  d.ctx.putImageData(d.imagem, 0, 0);
}

function misturar(cor: number, t: number, NEVOA: [number, number, number]) {
  const r = cor & 0xff, g = (cor >> 8) & 0xff, b = (cor >> 16) & 0xff;
  return rgb(Math.round(r + (NEVOA[0] - r) * t), Math.round(g + (NEVOA[1] - g) * t), Math.round(b + (NEVOA[2] - b) * t));
}

/** Onde um ponto do chão aparece na tela: x, y (o pé) e a escala (1 = do tamanho do kart de quem joga). */
export function projetar(cam: Camera, x: number, y: number): { sx: number; sy: number; escala: number; z: number } | null {
  const dx = x - cam.x, dy = y - cam.y;
  const fx = Math.cos(cam.angulo), fy = Math.sin(cam.angulo);
  const z = dx * fx + dy * fy;
  if (z < 6) return null;
  const lado = -dx * fy + dy * fx;
  return { sx: W / 2 + (lado * FOCO) / z, sy: HORIZONTE + (ALTURA * FOCO) / z, escala: ATRAS / z, z };
}

/** O desenho do kart (de 0 a 23) para um kart que aponta `angulo`, visto da câmera em (cx, cy). */
export function desenhoDoKart(angulo: number, cx: number, cy: number, kx: number, ky: number): number {
  const visada = Math.atan2(ky - cy, kx - cx);
  const rel = angulo - visada;
  return ((Math.round(rel / (Math.PI / 12)) % 24) + 24) % 24;
}

export interface Figura {
  z: number;
  desenhar: (ctx: CanvasRenderingContext2D) => void;
}

/** Uma figura de pé no chão (árvore, cenoura), com o pé no ponto projetado. */
export function figuraNoChao(
  d: Desenho,
  cam: Camera,
  nome: string,
  x: number,
  y: number,
  tamanho: number,
): Figura | null {
  const pr = projetar(cam, x, y);
  if (!pr || pr.sy > H + 40) return null;
  const img = d.figuras[nome];
  const w = Math.round(img.width * tamanho * pr.escala), h = Math.round(img.height * tamanho * pr.escala);
  if (w < 1 || h < 1 || pr.sx + w < 0 || pr.sx - w > W) return null;
  return {
    z: pr.z,
    desenhar: (ctx) => ctx.drawImage(img, Math.round(pr.sx - w / 2), Math.round(pr.sy - h), w, h),
  };
}

/** O lado do desenho do coelho no kart (a folha coelho-kart.png: 24 de 60 × 60, o pé em 30, 48). */
export const LADO_DO_KART = 60;
const PE_X = 30, PE_Y = 48;

export function kartNaTela(
  d: Desenho,
  cam: Camera,
  kx: number,
  ky: number,
  angulo: number,
  pulo: number,
  opcoes: { fantasma?: boolean; sombra?: boolean; tremor?: number; nome?: string; avatar?: number | null } = {},
): Figura | null {
  const pr = projetar(cam, kx, ky);
  if (!pr || !d.coelho) return null;
  const n = desenhoDoKart(angulo, cam.x, cam.y, kx, ky);
  const e = pr.escala;
  const w = LADO_DO_KART * e;
  if (w < 2 || pr.sx + w < 0 || pr.sx - w > W) return null;
  const x = pr.sx - PE_X * e, y = pr.sy - PE_Y * e - pulo * e * 2.2 + (opcoes.tremor ?? 0);
  const img = folhaDoAvatar(d.coelho, opcoes.avatar ?? null);
  return {
    z: pr.z,
    desenhar: (ctx) => {
      // a sombra no chão, achatada
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = '#1a1420';
      ctx.beginPath();
      ctx.ellipse(pr.sx, pr.sy - 1 * e, 22 * e, 6 * e, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      if (opcoes.fantasma) ctx.globalAlpha = 0.5;
      ctx.drawImage(img, n * LADO_DO_KART, 0, LADO_DO_KART, LADO_DO_KART, Math.round(x), Math.round(y), Math.round(w), Math.round(w));
      ctx.globalAlpha = 1;
      // o nome de quem dirige, em cima do kart (só perto o bastante para caber)
      if (opcoes.nome && e > 0.25) {
        ctx.font = '7px sans-serif';
        ctx.textAlign = 'center';
        const tx = Math.round(pr.sx), ty = Math.round(y + 2 * e);
        ctx.fillStyle = '#1e1822';
        ctx.fillText(opcoes.nome, tx + 1, ty + 1);
        ctx.fillStyle = '#fbf3e4';
        ctx.fillText(opcoes.nome, tx, ty);
      }
    },
  };
}

/**
 * O COELHO DE CADA UM NO KART (03/11/2026): a mesma folha (o mascote 3D), com o pelo e o moletom trocados pelas cores do
 * avatar pronto da pessoa — a troca de paleta dos jogos do Super Nintendo. As cores de cada avatar saem de
 * web/scripts/cores-dos-avatares.py (coresDosAvatares.ts). Sem avatar pronto (foto, ou nenhum), o mascote como é.
 */
const folhas = new Map<number, HTMLCanvasElement>();
const lum = (r: number, g: number, b: number) => 0.3 * r + 0.59 * g + 0.11 * b;
export function folhaDoAvatar(base: HTMLImageElement, avatar: number | null): CanvasImageSource {
  const cores = avatar !== null ? CORES_DOS_AVATARES[avatar] : undefined;
  if (!cores || !base.complete || !base.naturalWidth) return base;
  const pronta = folhas.get(avatar!);
  if (pronta) return pronta;
  const c = document.createElement('canvas');
  c.width = base.naturalWidth;
  c.height = base.naturalHeight;
  const g = c.getContext('2d')!;
  g.drawImage(base, 0, 0);
  const img = g.getImageData(0, 0, c.width, c.height);
  const px = img.data;
  const chave = (r: number, gg: number, b: number) => (r << 16) | (gg << 8) | b;
  const pelo = new Set(PELO_DO_MASCOTE.map(([r, gg, b]) => chave(r, gg, b)));
  const moletom = new Set(MOLETOM_DO_MASCOTE.map(([r, gg, b]) => chave(r, gg, b)));
  const peloBase = lum(227, 205, 227), moletomBase = lum(61, 43, 54);
  for (let i = 0; i < px.length; i += 4) {
    if (!px[i + 3]) continue;
    const k = chave(px[i], px[i + 1], px[i + 2]);
    let alvo: [number, number, number] | null = null, f = 1;
    if (pelo.has(k)) {
      alvo = cores.pelo;
      f = lum(px[i], px[i + 1], px[i + 2]) / peloBase;
    } else if (moletom.has(k)) {
      alvo = cores.roupa;
      f = 0.72 + (0.28 * lum(px[i], px[i + 1], px[i + 2])) / moletomBase;
    }
    if (!alvo) continue;
    px[i] = Math.min(255, Math.round(alvo[0] * f));
    px[i + 1] = Math.min(255, Math.round(alvo[1] * f));
    px[i + 2] = Math.min(255, Math.round(alvo[2] * f));
  }
  g.putImageData(img, 0, 0);
  folhas.set(avatar!, c);
  return c;
}

/** As faíscas da derrapagem, atrás das rodas: azuis no primeiro nível, laranja no segundo, brancas carregando. */
export function faiscas(ctx: CanvasRenderingContext2D, x: number, y: number, nivel: number, tempo: number, lado: number) {
  const cor = nivel === 2 ? ['#ffb04a', '#ffe08a'] : nivel === 1 ? ['#5ab4ff', '#c8ecff'] : ['#d8d0c8', '#ffffff'];
  for (let i = 0; i < 6; i++) {
    const s = Math.sin(tempo * 37 + i * 2.1);
    const r = (i % 2 ? -1 : 1);
    ctx.fillStyle = cor[i % 2];
    const px = x + r * (16 + ((i * 3) % 5)) + s * 2 - lado * 2;
    const py = y - 2 - ((tempo * 60 + i * 7) % 6);
    ctx.fillRect(Math.round(px), Math.round(py), 2, 2);
  }
}

/**
 * O MAPA PEQUENO: a pista vista de cima, num quadrado de `lado` pontos (no canto da corrida e na largada). O asfalto
 * claro, a água azul, o resto transparente; os karts vão por cima, como pontos (pontoNoMapa).
 */
export function mapaDaPista(p: Pista, lado: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = lado;
  const g = c.getContext('2d')!;
  const img = g.createImageData(lado, lado);
  const px = new Uint32Array(img.data.buffer);
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const tx = Math.floor(((x + 0.5) / lado) * RES), ty = Math.floor(((y + 0.5) / lado) * RES);
      const tipo = p.chao[ty * RES + tx];
      px[y * lado + x] =
        tipo === 0 || tipo === 3 ? rgb(236, 228, 214) : tipo === 1 ? rgb(214, 104, 92) : tipo === 4 && x > 1 && y > 1 && x < lado - 2 && y < lado - 2 ? rgb(92, 150, 190) : 0;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function pontoNoMapa(ctx: CanvasRenderingContext2D, x0: number, y0: number, lado: number, x: number, y: number, cor: string) {
  const px = Math.round(x0 + (x / MUNDO) * lado), py = Math.round(y0 + (y / MUNDO) * lado);
  ctx.fillStyle = '#1e1822';
  ctx.fillRect(px - 2, py - 2, 5, 5);
  ctx.fillStyle = cor;
  ctx.fillRect(px - 1, py - 1, 3, 3);
}
