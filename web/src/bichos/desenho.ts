/**
 * O DESENHO DOS BICHOS DA TOCA (16/11/2026): o campo visto de cima, feito por código casa a casa (a grama com tufos, o mato
 * alto, o caminho, a lagoa, as árvores, as duas casas), e a luta de lado. Nada de arte nova: os bichos são as folhas da Briga
 * (os monstros da Quaternius, CC0, renderizados pelo Blender: web/public/briga/<fase>/<bicho>.png) e o coelho é o da Briga,
 * com as cores do avatar de cada um.
 */
import { FOLHAS_DOS_BICHOS } from '../briga/folhasDosBichos';
import { chave } from '../i18n';
import { ESPECIES, LARGURA_DO_MAPA, ALTURA_DO_MAPA, mapaDe, type Elemento } from './regras';

export const CASA_PX = 16;
export const LARGURA_PX = LARGURA_DO_MAPA * CASA_PX;
export const ALTURA_PX = ALTURA_DO_MAPA * CASA_PX;

/** A cor de cada elemento: o selo do golpe e do bicho. */
export const COR_DO_ELEMENTO: Record<Elemento, string> = {
  folha: '#4f9a4a',
  brasa: '#d8642f',
  gota: '#3f86c8',
  pedra: '#8d7a63',
  vento: '#7fb8b0',
  faisca: '#d8b02a',
  nenhum: '#8b8790',
};
/** O nome de cada elemento (a chave da tradução). */
export const NOME_DO_ELEMENTO: Record<Exclude<Elemento, 'nenhum'>, string> = {
  folha: chave('Folha'),
  brasa: chave('Brasa'),
  gota: chave('Gota'),
  pedra: chave('Pedra'),
  vento: chave('Vento'),
  faisca: chave('Faísca'),
};

/** Um ruído fixo por casa, para a grama não ser um tapete liso (o mesmo desenho a cada vez). */
const ruido = (x: number, y: number, k = 0) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453;
  return s - Math.floor(s);
};

function grama(g: CanvasRenderingContext2D, px: number, py: number, x: number, y: number) {
  g.fillStyle = (x + y) % 2 ? '#8cc46a' : '#88c066';
  g.fillRect(px, py, CASA_PX, CASA_PX);
  g.fillStyle = '#76ad57';
  for (let k = 0; k < 3; k++) {
    const tx = px + Math.floor(ruido(x, y, k) * 14);
    const ty = py + Math.floor(ruido(x, y, k + 3) * 14);
    g.fillRect(tx, ty, 1, 2);
    g.fillRect(tx + 2, ty + 1, 1, 1);
  }
}

function mato(g: CanvasRenderingContext2D, px: number, py: number, alto: boolean) {
  g.fillStyle = alto ? '#3f7d3c' : '#5c9c48';
  g.fillRect(px, py, CASA_PX, CASA_PX);
  // as folhas do mato, em fileiras de "v"
  for (let fy = 0; fy < 4; fy++) {
    for (let fx = 0; fx < 4; fx++) {
      const bx = px + fx * 4 + (fy % 2) * 2;
      const by = py + fy * 4 + 1;
      g.fillStyle = alto ? '#2c5e2c' : '#3f7d3c';
      g.fillRect(bx, by + 1, 1, 2);
      g.fillRect(bx + 2, by + 1, 1, 2);
      g.fillStyle = alto ? '#6fb15a' : '#8ccb6a';
      g.fillRect(bx + 1, by, 1, 2);
    }
  }
}

function arvore(g: CanvasRenderingContext2D, px: number, py: number, x: number, y: number) {
  grama(g, px, py, x, y);
  g.fillStyle = '#5b3d24';
  g.fillRect(px + 6, py + 10, 4, 5);
  g.fillStyle = '#2f6b33';
  g.beginPath();
  g.arc(px + 8, py + 7, 7, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#4c9446';
  g.beginPath();
  g.arc(px + 6, py + 5, 4, 0, Math.PI * 2);
  g.fill();
}

function agua(g: CanvasRenderingContext2D, px: number, py: number, x: number, y: number) {
  g.fillStyle = '#4f9fd0';
  g.fillRect(px, py, CASA_PX, CASA_PX);
  g.fillStyle = '#9fd4f0';
  g.fillRect(px + 2 + Math.floor(ruido(x, y) * 6), py + 4, 4, 1);
  g.fillRect(px + 7 + Math.floor(ruido(x, y, 2) * 4), py + 11, 4, 1);
}

/** A casa (de quem joga, telhado vermelho; a do desafio, azul com a bandeira), desenhada inteira pelo canto de cima. */
function casa(g: CanvasRenderingContext2D, px: number, py: number, largura: number, altura: number, telhado: string, desafio: boolean) {
  const w = largura * CASA_PX;
  const h = altura * CASA_PX;
  g.fillStyle = '#f0e2c4';
  g.fillRect(px + 1, py + h * 0.45, w - 2, h * 0.55);
  g.fillStyle = '#c8b28a';
  g.fillRect(px + 1, py + h - 2, w - 2, 2);
  g.fillStyle = telhado;
  g.beginPath();
  g.moveTo(px - 2, py + h * 0.5);
  g.lineTo(px + w / 2, py + 2);
  g.lineTo(px + w + 2, py + h * 0.5);
  g.closePath();
  g.fill();
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(px - 2, py + h * 0.5 - 2, w + 4, 2);
  // janelas
  g.fillStyle = '#7fb8e0';
  g.fillRect(px + 5, py + h * 0.6, 7, 6);
  g.fillRect(px + w - 12, py + h * 0.6, 7, 6);
  if (desafio) {
    g.fillStyle = '#5b3d24';
    g.fillRect(px + w / 2 - 1, py - 8, 2, 12);
    g.fillStyle = '#f2c84b';
    g.fillRect(px + w / 2 + 1, py - 8, 8, 5);
  }
}

function porta(g: CanvasRenderingContext2D, px: number, py: number) {
  g.fillStyle = '#f0e2c4';
  g.fillRect(px, py, CASA_PX, CASA_PX);
  g.fillStyle = '#7a4f2c';
  g.fillRect(px + 4, py + 4, 8, 12);
  g.fillStyle = '#f2c84b';
  g.fillRect(px + 10, py + 10, 1, 1);
}

/** As cores das casas: a de descansar (telhado vermelho), a do desafio (azul, com a bandeira) e a lojinha (verde, com a placa). */
const TELHADOS: Record<string, [string, 'casa' | 'desafio' | 'loja']> = { H: ['#c4523f', 'casa'], C: ['#3f6fb0', 'desafio'], L: ['#4f8f4a', 'loja'] };

/** Cada tela do mapa, desenhada uma vez numa imagem (ela não muda). */
const campos = new Map<string, HTMLCanvasElement>();
export function desenharCampo(mapa = 'campo'): HTMLCanvasElement {
  const pronto = campos.get(mapa);
  if (pronto) return pronto;
  const linhas = mapaDe(mapa).linhas;
  const c = document.createElement('canvas');
  c.width = LARGURA_PX;
  c.height = ALTURA_PX;
  const g = c.getContext('2d')!;
  for (let y = 0; y < ALTURA_DO_MAPA; y++) {
    for (let x = 0; x < LARGURA_DO_MAPA; x++) {
      const k = linhas[y][x];
      const px = x * CASA_PX;
      const py = y * CASA_PX;
      if (k === '"' || k === ';') mato(g, px, py, k === ';');
      else if (k === 'T') arvore(g, px, py, x, y);
      else if (k === '~') agua(g, px, py, x, y);
      else if (k === '=') {
        g.fillStyle = '#d8bf8a';
        g.fillRect(px, py, CASA_PX, CASA_PX);
        g.fillStyle = '#c4a874';
        g.fillRect(px + Math.floor(ruido(x, y) * 12), py + Math.floor(ruido(x, y, 1) * 12), 2, 1);
      } else {
        grama(g, px, py, x, y);
        if (k === 'f') {
          for (let i = 0; i < 3; i++) {
            g.fillStyle = ['#f2c84b', '#e88ab5', '#fff3d8'][i];
            g.fillRect(px + 3 + i * 4, py + 4 + ((i * 5) % 7), 2, 2);
          }
        } else if (k === 'r') {
          g.fillStyle = '#7d756c';
          g.fillRect(px + 2, py + 5, 12, 9);
          g.fillStyle = '#a39a8e';
          g.fillRect(px + 4, py + 5, 7, 3);
        }
      }
    }
  }
  // as casas por cima: cada pedaço ligado das paredes de uma letra (com a porta dela, em minúscula) é uma casa
  const visto = new Set<string>();
  for (let y = 0; y < ALTURA_DO_MAPA; y++) {
    for (let x = 0; x < LARGURA_DO_MAPA; x++) {
      const letra = linhas[y][x].toUpperCase();
      if (!TELHADOS[letra] || visto.has(`${x},${y}`)) continue;
      let x0 = x, y0 = y, x1 = x, y1 = y;
      const fila = [[x, y]];
      visto.add(`${x},${y}`);
      while (fila.length) {
        const [cx, cy] = fila.pop()!;
        x0 = Math.min(x0, cx); y0 = Math.min(y0, cy); x1 = Math.max(x1, cx); y1 = Math.max(y1, cy);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (ny < 0 || ny >= ALTURA_DO_MAPA || nx < 0 || nx >= LARGURA_DO_MAPA || visto.has(`${nx},${ny}`)) continue;
          if (linhas[ny][nx].toUpperCase() !== letra) continue;
          visto.add(`${nx},${ny}`);
          fila.push([nx, ny]);
        }
      }
      const [telhado, tipo] = TELHADOS[letra];
      casa(g, x0 * CASA_PX, y0 * CASA_PX, x1 - x0 + 1, y1 - y0 + 1, telhado, tipo === 'desafio');
      if (tipo === 'loja') {
        // a placa da lojinha: uma cenoura e uma xícara, sem texto
        const px = x0 * CASA_PX + ((x1 - x0 + 1) * CASA_PX) / 2 - 10;
        const py = y0 * CASA_PX + (y1 - y0 + 1) * CASA_PX * 0.45 - 4;
        g.fillStyle = '#7a4f2c';
        g.fillRect(px - 1, py - 1, 22, 9);
        g.fillStyle = '#f0e2c4';
        g.fillRect(px, py, 20, 7);
        desenharAchado(g, 'cenoura', px + 5, py + 6, 0.6);
        desenharAchado(g, 'cha', px + 15, py + 6, 0.6);
      }
    }
  }
  linhas.forEach((linha, y) => [...linha].forEach((k, x) => 'hcl'.includes(k) && porta(g, x * CASA_PX, y * CASA_PX)));
  campos.set(mapa, c);
  return c;
}

/** Um achado no chão (a cenoura, o chá, as moedas), com o pé em (x, y). */
export function desenharAchado(g: CanvasRenderingContext2D, item: string, x: number, y: number, escala = 1) {
  g.save();
  g.translate(Math.round(x), Math.round(y));
  g.scale(escala, escala);
  if (item === 'cenoura') {
    g.fillStyle = '#e8792b';
    g.beginPath();
    g.moveTo(-3, -9);
    g.lineTo(3, -9);
    g.lineTo(0, 0);
    g.closePath();
    g.fill();
    g.fillStyle = '#4f9a4a';
    g.fillRect(-2, -12, 1, 3);
    g.fillRect(0, -13, 1, 4);
    g.fillRect(2, -12, 1, 3);
  } else if (item === 'cha') {
    g.fillStyle = '#fff3d8';
    g.fillRect(-4, -7, 7, 6);
    g.fillRect(3, -6, 2, 3);
    g.fillStyle = '#b8743a';
    g.fillRect(-3, -6, 5, 2);
    g.fillStyle = '#c8b28a';
    g.fillRect(-5, -1, 9, 1);
  } else {
    g.fillStyle = '#b8862a';
    g.beginPath();
    g.arc(0, -4, 4, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f2c84b';
    g.beginPath();
    g.arc(0, -4, 3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff3a8';
    g.fillRect(-1, -6, 1, 2);
  }
  g.restore();
}

/**
 * Os nomes dos golpes (as chaves de GOLPES, em regras.ts) marcados para a tradução: regras.ts é a cópia do servidor e não pode
 * importar o i18n. O teste do servidor confere que as duas listas batem.
 */
export const NOMES_DOS_GOLPES = [
  chave('Investida'), chave('Semente'), chave('Cipó'), chave('Fogo'), chave('Vulcão'), chave('Chuva'), chave('Onda'),
  chave('Pedrada'), chave('Avalanche'), chave('Sopro'), chave('Tornado'), chave('Choque'), chave('Raio'),
  // os de 19/11/2026
  chave('Espinho'), chave('Pólen'), chave('Raiz'), chave('Calor'), chave('Labareda'), chave('Neblina'), chave('Orvalho'),
  chave('Casca'), chave('Tremor'), chave('Rajada'), chave('Assobio'), chave('Estalo'), chave('Carga'),
];

// ---------------- OS BICHOS ----------------
/** A ordem dos desenhos na folha (a mesma da Briga: web/src/briga/sprites.ts). */
const INICIO = { parado: 0, andando: 4, prep: 10, golpe: 12, dor: 14, caido: 16 };
const imagens = new Map<string, HTMLImageElement>();

function folha(desenho: string): HTMLImageElement | null {
  const f = FOLHAS_DOS_BICHOS[desenho];
  if (!f || typeof Image === 'undefined') return null;
  let img = imagens.get(desenho);
  if (!img) {
    img = new Image();
    img.src = `${import.meta.env.BASE_URL}briga/${f.fase}/${desenho}.png`;
    imagens.set(desenho, img);
  }
  return img.complete && img.naturalWidth ? img : null;
}

/**
 * A FORMA CRESCIDA QUE USA A MESMA FOLHA (19/11/2026): a folha com as cores giradas no círculo (`matiz`, em graus), feita uma vez
 * por código, pixel a pixel, e guardada. Sem arte nova: é a mesma folha da Briga, de outra cor.
 */
const recoloridas = new Map<string, HTMLCanvasElement | null>();
function folhaRecolorida(desenho: string, matiz: number): HTMLCanvasElement | HTMLImageElement | null {
  const img = folha(desenho);
  if (!img || !matiz) return img;
  const chaveDaCor = desenho + '@' + matiz;
  if (recoloridas.has(chaveDaCor)) return recoloridas.get(chaveDaCor) ?? img;
  let saida: HTMLCanvasElement | null = null;
  try {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d', { willReadFrequently: true })!;
    g.drawImage(img, 0, 0);
    const dados = g.getImageData(0, 0, c.width, c.height);
    const p = dados.data;
    // a rotação da cor em volta do eixo do cinza (a mesma do hue-rotate do CSS): o claro e o escuro ficam
    const a = (matiz * Math.PI) / 180;
    const cos = Math.cos(a), sen = Math.sin(a);
    const m = [
      0.213 + cos * 0.787 - sen * 0.213, 0.715 - cos * 0.715 - sen * 0.715, 0.072 - cos * 0.072 + sen * 0.928,
      0.213 - cos * 0.213 + sen * 0.143, 0.715 + cos * 0.285 + sen * 0.14, 0.072 - cos * 0.072 - sen * 0.283,
      0.213 - cos * 0.213 - sen * 0.787, 0.715 - cos * 0.715 + sen * 0.715, 0.072 + cos * 0.928 + sen * 0.072,
    ];
    for (let i = 0; i < p.length; i += 4) {
      if (!p[i + 3]) continue;
      const r = p[i], gg = p[i + 1], b = p[i + 2];
      p[i] = m[0] * r + m[1] * gg + m[2] * b;
      p[i + 1] = m[3] * r + m[4] * gg + m[5] * b;
      p[i + 2] = m[6] * r + m[7] * gg + m[8] * b;
    }
    g.putImageData(dados, 0, 0);
    saida = c;
  } catch {
    saida = null;
  }
  recoloridas.set(chaveDaCor, saida);
  return saida ?? img;
}

/** Pede de antemão as folhas destes bichos (a escolha do primeiro, a equipe). */
export function carregarBichos(especies: string[]) {
  for (const e of especies) if (ESPECIES[e]) folha(ESPECIES[e].desenho);
}

export type PoseDoBicho = 'parado' | 'golpe' | 'dor' | 'dormindo';

/**
 * Um bicho com o pé em (sx, sy), virado para `lado` (1 a direita, -1 a esquerda), na `escala`. Dormindo, deitado e com o "z"
 * subindo (cansado, nunca machucado).
 */
export function desenharBicho(g: CanvasRenderingContext2D, especie: string, sx: number, sy: number, lado: number, escala: number, pose: PoseDoBicho, tempo: number) {
  const desenho = ESPECIES[especie]?.desenho;
  const f = desenho ? FOLHAS_DOS_BICHOS[desenho] : undefined;
  const especieDados = ESPECIES[especie];
  const img = desenho ? folhaRecolorida(desenho, especieDados?.matiz ?? 0) : null;
  escala *= especieDados?.escala ?? 1;
  // a sombra no chão
  g.fillStyle = 'rgba(30,40,20,0.25)';
  g.beginPath();
  g.ellipse(sx, sy, 14 * escala, 4 * escala, 0, 0, Math.PI * 2);
  g.fill();
  if (!f || !img) return;
  const quadro =
    pose === 'golpe' ? INICIO.golpe + 1 : pose === 'dor' ? INICIO.dor : pose === 'dormindo' ? INICIO.caido + 2 : INICIO.parado + (Math.floor(tempo / 160) % 4);
  const L = f.lado;
  g.save();
  g.translate(Math.round(sx), Math.round(sy));
  g.scale(lado * escala, escala);
  g.drawImage(img, quadro * L, 0, L, L, -f.peX, -f.peY, L, L);
  g.restore();
  if (pose === 'dormindo') {
    g.fillStyle = '#ffffff';
    g.font = `${Math.round(9 * escala)}px sans-serif`;
    const sobe = (tempo / 40) % 18;
    g.globalAlpha = 1 - sobe / 18;
    g.fillText('z', sx + 10 * escala, sy - 14 * escala - sobe);
    g.fillText('z', sx + 16 * escala, sy - 22 * escala - sobe * 0.7);
    g.globalAlpha = 1;
  }
}

/** A altura do bicho na folha, para pôr o nome e a vida em cima. */
export const alturaDoBicho = (especie: string) => (FOLHAS_DOS_BICHOS[ESPECIES[especie]?.desenho ?? '']?.alto ?? 40) * (ESPECIES[especie]?.escala ?? 1);

/** O fundo da luta: o céu, os morros, e os dois tablados de grama onde os bichos ficam. */
export function desenharFundoDaLuta(g: CanvasRenderingContext2D, w: number, h: number, desafio: boolean) {
  const ceu = g.createLinearGradient(0, 0, 0, h);
  ceu.addColorStop(0, desafio ? '#c9b8e8' : '#bfe3f2');
  ceu.addColorStop(1, desafio ? '#efe4f6' : '#eaf6ea');
  g.fillStyle = ceu;
  g.fillRect(0, 0, w, h);
  g.fillStyle = desafio ? '#9d8cc0' : '#9cc98a';
  g.beginPath();
  g.moveTo(0, h * 0.55);
  g.quadraticCurveTo(w * 0.3, h * 0.38, w * 0.6, h * 0.5);
  g.quadraticCurveTo(w * 0.85, h * 0.6, w, h * 0.46);
  g.lineTo(w, h);
  g.lineTo(0, h);
  g.fill();
  g.fillStyle = desafio ? '#b6a6d4' : '#8cc46a';
  g.fillRect(0, h * 0.62, w, h * 0.38);
  for (const [cx, cy, rx] of [[w * 0.72, h * 0.58, 50], [w * 0.28, h * 0.88, 62]] as const) {
    g.fillStyle = desafio ? '#8f7db4' : '#6fa955';
    g.beginPath();
    g.ellipse(cx, cy, rx, 11, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = desafio ? '#a796c8' : '#7fbb62';
    g.beginPath();
    g.ellipse(cx, cy - 2, rx - 4, 8, 0, 0, Math.PI * 2);
    g.fill();
  }
}
