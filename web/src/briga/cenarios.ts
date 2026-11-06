/**
 * OS CENÁRIOS DAS FASES DA BRIGA (06/11/2026): cada fase tem o seu, em camadas que correm em velocidades diferentes (o
 * parallax dos jogos da época). A horta é a de sempre (desenho.ts, desenharFundo). A floresta usa as camadas do "Parallax
 * Forest" do ansimuz (CC0, web/public/briga/floresta/); o deserto, a neve e o castelo são por código, como a horta.
 *
 * Tudo pixel art: faixas de cor, sem gradiente, e cada camada presa a um múltiplo da câmera.
 */
import { FASES_DA_BRIGA } from './fases';
import { CHAO, desenharFundo, H, W } from './desenho';

type G = CanvasRenderingContext2D;

/** O ruído de sempre, para espalhar coisas "ao acaso" sempre no mesmo lugar do mundo. */
const acaso = (x: number, k = 0) => {
  const h = (Math.sin(x * 12.9898 + k * 78.233) * 43758.5453) % 1;
  return Math.abs(h);
};

function faixas(g: G, cores: string[], alto: number) {
  cores.forEach((c, k) => {
    g.fillStyle = c;
    g.fillRect(0, k * alto, W, alto);
  });
}

function morros(g: G, desloc: number, base: number, alto: number, cor: string, f: number, pico = false) {
  g.fillStyle = cor;
  for (let x = 0; x < W; x += 2) {
    const s = Math.sin((x + desloc) * f) * Math.sin((x + desloc) * f * 0.37 + 1);
    const h = alto * (0.55 + 0.45 * (pico ? Math.abs(s) * 1.4 - 0.2 : s));
    g.fillRect(x, Math.round(base - h), 2, Math.round(h) + 40);
  }
}

/** As coisas presas ao mundo numa camada: `passo` entre uma e outra, deslocadas pelo acaso, e `desenhar` em cada. */
function espalhar(g: G, camX: number, fator: number, passo: number, k: number, desenhar: (sx: number, a: number) => void) {
  const cx = camX * fator;
  const inicio = Math.floor((cx - 60) / passo) * passo;
  for (let x = inicio; x < cx + W + 60; x += passo) {
    const a = acaso(x, k);
    desenhar(Math.round(x - cx + (a - 0.5) * passo * 0.6), a);
  }
}

// ---------------- A FLORESTA (as camadas do ansimuz) ----------------
const CAMADAS_DA_FLORESTA = ['back-trees', 'lights', 'middle-trees', 'front-trees'] as const;
const VELOCIDADE_DA_FLORESTA = [0.15, 0.25, 0.4, 0.6];
const imagens = new Map<string, HTMLImageElement>();
function imagem(nome: string): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  let im = imagens.get(nome);
  if (!im) {
    im = new Image();
    im.src = `${import.meta.env.BASE_URL}briga/floresta/parallax-forest-${nome}.png`;
    imagens.set(nome, im);
  }
  return im.complete && im.naturalWidth ? im : null;
}

function floresta(g: G, camX: number, fim: number) {
  g.fillStyle = '#b5773b';
  g.fillRect(0, 0, W, H);
  // as camadas têm 272 × 160 e o chão delas na linha ~133: sobem 23 px para o chão cair na faixa de cima da briga
  CAMADAS_DA_FLORESTA.forEach((nome, k) => {
    const im = imagem(nome);
    if (!im) return;
    const larg = im.naturalWidth;
    const x0 = -Math.round((camX * VELOCIDADE_DA_FLORESTA[k]) % larg);
    for (let x = x0 - larg; x < W; x += larg) g.drawImage(im, x, -23);
  });
  // o chão: terra batida com a grama em tufos, presos ao mundo
  g.fillStyle = '#3a2a22';
  g.fillRect(0, CHAO - 2, W, H - CHAO + 2);
  g.fillStyle = '#4a3628';
  for (let k = 0; k < 4; k++) g.fillRect(0, CHAO + 6 + k * 16, W, 6);
  g.fillStyle = '#5a6a32';
  g.fillRect(0, CHAO - 3, W, 3);
  espalhar(g, camX, 1, 22, 3, (sx, a) => {
    const y = CHAO + 4 + Math.floor(a * 60);
    g.fillStyle = a > 0.5 ? '#6f8a3c' : '#56702e';
    g.fillRect(sx, y - 3, 1, 3);
    g.fillRect(sx + 2, y - 4, 1, 4);
    g.fillRect(sx + 4, y - 2, 1, 2);
    if (a > 0.82) {
      // um cogumelo pequeno, de enfeite
      g.fillStyle = '#c94c3c';
      g.fillRect(sx + 7, y - 5, 5, 2);
      g.fillStyle = '#efe2c4';
      g.fillRect(sx + 9, y - 3, 1, 3);
    }
  });
  portal(g, camX, fim, '#2a1c18', '#6f8a3c');
}

// ---------------- O DESERTO ----------------
function deserto(g: G, camX: number, fim: number) {
  faixas(g, ['#f6d8a0', '#f2c98c', '#eebb7c', '#e9ad6e'], 20);
  g.fillStyle = '#e6a565';
  g.fillRect(0, 80, W, 30);
  g.fillStyle = '#fff1c8';
  g.beginPath();
  g.arc(70 - camX * 0.04, 30, 14, 0, Math.PI * 2);
  g.fill();
  // as mesas de pedra lá longe, e as dunas
  espalhar(g, camX, 0.15, 150, 1, (sx, a) => {
    const w = 40 + a * 50, h = 22 + a * 22;
    g.fillStyle = '#c27a4e';
    g.fillRect(sx, 84 - h, w, h + 10);
    g.fillStyle = '#d68c5a';
    g.fillRect(sx, 84 - h, w, 3);
    g.fillStyle = '#a8653e';
    g.fillRect(sx + w - 6, 84 - h + 3, 6, h + 7);
  });
  morros(g, camX * 0.3, 96, 12, '#e2a060', 0.02);
  morros(g, camX * 0.5, 106, 9, '#d8924f', 0.03);
  // os cactos do meio
  espalhar(g, camX, 0.7, 70, 2, (sx, a) => {
    const h = 14 + Math.floor(a * 12);
    g.fillStyle = '#4f7a3a';
    g.fillRect(sx, CHAO - h, 4, h);
    g.fillRect(sx - 4, CHAO - h + 5, 3, 2);
    g.fillRect(sx - 4, CHAO - h + 1, 2, 5);
    g.fillRect(sx + 5, CHAO - h + 8, 3, 2);
    g.fillRect(sx + 6, CHAO - h + 3, 2, 6);
    g.fillStyle = '#6a9a4a';
    g.fillRect(sx + 1, CHAO - h, 1, h);
  });
  // o chão: areia, com as marcas do vento e as pedrinhas presas ao mundo
  g.fillStyle = '#e8b878';
  g.fillRect(0, CHAO - 2, W, H - CHAO + 2);
  g.fillStyle = '#dcaa6a';
  for (let k = 0; k < 4; k++) g.fillRect(0, CHAO + 8 + k * 16, W, 3);
  espalhar(g, camX, 1, 26, 4, (sx, a) => {
    const y = CHAO + 6 + Math.floor(a * 58);
    g.fillStyle = a > 0.5 ? '#b98a5a' : '#c99a66';
    g.fillRect(sx, y, 3, 2);
    if (a > 0.85) {
      g.fillStyle = '#f4ead8';
      g.fillRect(sx + 6, y - 1, 4, 1);
      g.fillRect(sx + 7, y - 2, 2, 1);
    }
  });
  portal(g, camX, fim, '#8a5a36', '#c27a4e');
}

// ---------------- A NEVE ----------------
function neve(g: G, camX: number, fim: number, tempo: number) {
  faixas(g, ['#c9dcef', '#d4e3f2', '#dfeaf5', '#e8f0f8'], 20);
  morros(g, camX * 0.12, 74, 34, '#9fb4cc', 0.012, true);
  morros(g, camX * 0.12 + 7, 78, 26, '#f4f8fc', 0.012, true);
  morros(g, camX * 0.3, 92, 18, '#b8cade', 0.02);
  // os pinheiros do meio, com neve nos galhos
  espalhar(g, camX, 0.6, 34, 5, (sx, a) => {
    const h = 22 + Math.floor(a * 14);
    g.fillStyle = '#3e5a5a';
    for (let k = 0; k < 4; k++) {
      const w = 4 + k * 3;
      g.fillRect(sx - w, CHAO - h + k * (h / 4), w * 2 + 1, Math.ceil(h / 4) + 1);
    }
    g.fillStyle = '#f4f8fc';
    for (let k = 0; k < 4; k++) g.fillRect(sx - 2 - k * 2, CHAO - h + k * (h / 4), 3 + k * 2, 1);
    g.fillStyle = '#5a4436';
    g.fillRect(sx - 1, CHAO - 3, 3, 3);
  });
  // o chão: neve, com placas de gelo e pegadas presas ao mundo
  g.fillStyle = '#eef4fa';
  g.fillRect(0, CHAO - 2, W, H - CHAO + 2);
  g.fillStyle = '#dde8f3';
  for (let k = 0; k < 4; k++) g.fillRect(0, CHAO + 10 + k * 16, W, 2);
  espalhar(g, camX, 1, 60, 6, (sx, a) => {
    const y = CHAO + 8 + Math.floor(a * 50);
    if (a > 0.55) {
      g.fillStyle = '#c4dcef';
      g.fillRect(sx, y, 22, 4);
      g.fillStyle = '#e6f2fb';
      g.fillRect(sx + 3, y + 1, 8, 1);
    } else {
      g.fillStyle = '#ccd9e6';
      g.fillRect(sx, y, 2, 1);
      g.fillRect(sx + 5, y + 2, 2, 1);
    }
  });
  // os flocos caindo (presos ao mundo, para não "andarem" com a câmera)
  g.fillStyle = '#ffffff';
  for (let k = 0; k < 40; k++) {
    const x = ((k * 53 + tempo * 0.012 * (1 + (k % 3))) - camX * 0.8) % W;
    const y = (k * 37 + tempo * 0.02 * (1 + (k % 2))) % H;
    g.fillRect(Math.round(x < 0 ? x + W : x), Math.round(y), k % 4 ? 1 : 2, k % 4 ? 1 : 2);
  }
  portal(g, camX, fim, '#5a6a7a', '#f4f8fc');
}

// ---------------- O CASTELO ASSOMBRADO ----------------
function castelo(g: G, camX: number, fim: number, tempo: number) {
  faixas(g, ['#231a33', '#2a1f3d', '#322447', '#3a2a50'], 20);
  g.fillStyle = '#e8e0c8';
  g.beginPath();
  g.arc(240 - camX * 0.04, 30, 12, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#2a1f3d';
  g.beginPath();
  g.arc(246 - camX * 0.04, 26, 10, 0, Math.PI * 2);
  g.fill();
  // as torres lá longe
  espalhar(g, camX, 0.15, 90, 7, (sx, a) => {
    const h = 40 + a * 30, w = 14 + a * 10;
    g.fillStyle = '#1b1428';
    g.fillRect(sx, 90 - h, w, h + 20);
    for (let k = 0; k < w; k += 4) g.fillRect(sx + k, 86 - h, 2, 4);
    if (a > 0.4) {
      g.fillStyle = '#d9b860';
      g.fillRect(sx + Math.floor(w / 2) - 1, 98 - h, 2, 3);
    }
  });
  // o muro de pedra, com as tochas
  g.fillStyle = '#4a4058';
  g.fillRect(0, 70, W, CHAO - 70);
  const mx = camX * 0.6;
  g.fillStyle = '#3c3448';
  for (let fila = 0; fila < 5; fila++) {
    const y = 72 + fila * 8;
    g.fillRect(0, y + 7, W, 1);
    for (let x = -(((mx + fila * 7) % 16) + 16); x < W; x += 16) g.fillRect(Math.round(x), y, 1, 7);
  }
  g.fillStyle = '#5a5068';
  g.fillRect(0, 70, W, 2);
  espalhar(g, camX, 0.6, 96, 8, (sx) => {
    g.fillStyle = '#2a2230';
    g.fillRect(sx, 84, 3, 8);
    const chama = Math.floor(tempo / 120) % 2;
    g.fillStyle = '#f0a040';
    g.fillRect(sx - 1, 79 - chama, 5, 5 + chama);
    g.fillStyle = '#ffe48a';
    g.fillRect(sx, 81, 3, 3);
    // a luz da tocha no muro
    g.fillStyle = 'rgba(240, 160, 64, 0.12)';
    g.fillRect(sx - 12, 72, 27, 30);
  });
  // o chão: lajotas
  g.fillStyle = '#3a3242';
  g.fillRect(0, CHAO - 2, W, H - CHAO + 2);
  g.fillStyle = '#2c2634';
  for (let k = 0; k < 5; k++) g.fillRect(0, CHAO + 4 + k * 14, W, 1);
  for (let k = 0; k < 5; k++) {
    const y = CHAO + 4 + k * 14;
    for (let x = -(((camX + k * 11) % 28) + 28); x < W; x += 28) g.fillRect(Math.round(x), y, 1, 14);
  }
  espalhar(g, camX, 1, 70, 9, (sx, a) => {
    if (a < 0.6) return;
    g.fillStyle = '#4a4252';
    g.fillRect(sx, CHAO + 10 + Math.floor(a * 40), 6, 2);
  });
  portal(g, camX, fim, '#1b1428', '#5a5068');
}

/** O fim da fase: um portal de duas colunas, nas cores do cenário. */
function portal(g: G, camX: number, fim: number, escura: string, clara: string) {
  if (fim - camX >= W + 30) return;
  const sx = Math.round(fim - camX);
  g.fillStyle = escura;
  g.fillRect(sx, 80, 6, CHAO - 76);
  g.fillRect(sx + 34, 80, 6, CHAO - 76);
  g.fillStyle = clara;
  g.fillRect(sx, 80, 40, 4);
}

/** O cenário da fase `indice` (o `fs` do quadro). */
export function desenharCenario(g: G, indice: number, camX: number, fim: number, tempo: number) {
  const id = FASES_DA_BRIGA[indice]?.id ?? 'horta';
  if (id === 'floresta') floresta(g, camX, fim);
  else if (id === 'deserto') deserto(g, camX, fim);
  else if (id === 'neve') neve(g, camX, fim, tempo);
  else if (id === 'castelo') castelo(g, camX, fim, tempo);
  else desenharFundo(g, camX, fim);
}
