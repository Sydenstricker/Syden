import { ALTURA, BICHO_MEIA, Bloco, blocoEm, bichoEm, LINHAS, movelEm, T, type Fase, type Tema } from './fases';

/**
 * O DESENHO DO PULO DO COELHO (03/11/2026): tudo por código, numa tela de 320 × 180 ampliada com os pixels nítidos, como
 * os jogos de 16 bits. O fundo em camadas que correm em velocidades diferentes (o céu parado, os morros devagar, o que está
 * perto mais depressa), a fase inteira pintada uma vez numa imagem grande (os blocos não mudam), e por cima o que se mexe:
 * as plataformas que andam, os fantasmas, os outros e o coelho.
 *
 * Desde 20/11/2026 o CENÁRIO (blocos, tábuas, molas, espinhos, placas, bandeira e fundo) é do Pixel Platformer da Kenney (CC0;
 * ver "O CENÁRIO DA KENNEY" mais abaixo). O desenho por código continua: é o que aparece enquanto as imagens carregam, e se
 * não carregarem. O coelho, os bichos e as cenouras são os nossos.
 */

export const W = 320;
export const H = 180;
/** Os quadros da folha do coelho (web/scripts/plataforma-coelho.py): 8 andando e o parado. */
export const QUADRO_W = 17;
export const QUADRO_H = 31;
const PARADO = 8;

interface Cores {
  ceu: [string, string, string];
  longe: string;
  perto: string;
  chao: [string, string, string];
  topo: [string, string];
  tabua: [string, string];
  espinho: [string, string];
}

const CORES: Record<Tema, Cores> = {
  prado: {
    ceu: ['#f2d6b4', '#ecc8a6', '#e4b896'],
    longe: '#b8a6b8',
    perto: '#8aa874',
    chao: ['#8c6248', '#7a543e', '#a07458'],
    topo: ['#78a85a', '#5e8c48'],
    tabua: ['#b88a5c', '#8a6040'],
    espinho: ['#d8d0c4', '#6a5a60'],
  },
  toca: {
    ceu: ['#3a2e34', '#44363a', '#4e3e40'],
    longe: '#584848',
    perto: '#665450',
    chao: ['#6e5a4e', '#5e4c42', '#80695a'],
    topo: ['#7e8a62', '#66704e'],
    tabua: ['#9c7650', '#74563a'],
    espinho: ['#d4c8b4', '#4a3a3a'],
  },
  copas: {
    ceu: ['#c8d8d8', '#d8dcc8', '#e8d8b8'],
    longe: '#9cb08c',
    perto: '#6e9660',
    chao: ['#7a5a40', '#684c36', '#8e6a4c'],
    topo: ['#6a9a52', '#4e7e40'],
    tabua: ['#8e6a4c', '#684c36'],
    espinho: ['#e0d6c4', '#5a4a40'],
  },
};

export interface Pintura {
  ctx: CanvasRenderingContext2D;
  fase: Fase;
  cores: Cores;
  /** A fase inteira (os blocos), pintada uma vez. */
  mapa: HTMLCanvasElement;
  /** As duas camadas do fundo, uma faixa que se repete. */
  longe: HTMLCanvasElement;
  perto: HTMLCanvasElement;
  coelho: HTMLImageElement | null;
  /** Se o mapa e o fundo já são os da Kenney (até as imagens chegarem, o desenho por código). */
  kenney: boolean;
}

/** Um número "aleatório" fixo por casa (o mesmo desenho toda vez). */
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

export function prepararPintura(canvas: HTMLCanvasElement, fase: Fase): Pintura {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const cores = CORES[fase.tema];
  carregarKenney();
  const p: Pintura = {
    ctx,
    fase,
    cores,
    mapa: pintarMapa(fase, cores),
    longe: camadaLonge(fase.tema, cores),
    perto: camadaPerto(fase.tema, cores),
    coelho: null,
    kenney: false,
  };
  trocarPelaKenney(p);
  return p;
}

/** Assim que as imagens da Kenney chegam, o mapa e o fundo são pintados de novo com elas (uma vez). */
function trocarPelaKenney(p: Pintura) {
  if (p.kenney || !kenney) return;
  p.mapa = pintarMapaKenney(p.fase, kenney);
  [p.longe, p.perto] = camadasKenney(p.fase, kenney);
  p.kenney = true;
}

function pintarMapa(f: Fase, cores: Cores): HTMLCanvasElement {
  const [c, ctx] = tela(f.colunas * T, ALTURA);
  for (let l = 0; l < LINHAS; l++) {
    for (let col = 0; col < f.colunas; col++) {
      const b = blocoEm(f, col, l);
      const x = col * T,
        y = l * T;
      if (b === Bloco.Vazio && l === LINHAS - 1) {
        fundoDoBuraco(ctx, x, y);
      } else if (b === Bloco.Chao) {
        ctx.fillStyle = cores.chao[0];
        ctx.fillRect(x, y, T, T);
        // pedrinhas e grãos de terra
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = i % 2 ? cores.chao[1] : cores.chao[2];
          ctx.fillRect(x + Math.floor(sorte(col, l, i) * 14), y + Math.floor(sorte(col, l, i + 9) * 14), 2, i % 2 ? 2 : 1);
        }
        const cima = blocoEm(f, col, l - 1);
        if (l > 0 && cima !== Bloco.Chao && cima !== Bloco.Mola) {
          // a grama (ou o musgo) em cima, com tufos
          ctx.fillStyle = cores.topo[1];
          ctx.fillRect(x, y, T, 5);
          ctx.fillStyle = cores.topo[0];
          ctx.fillRect(x, y, T, 3);
          for (let i = 0; i < 3; i++) ctx.fillRect(x + Math.floor(sorte(col, l, 20 + i) * 15), y - 1, 1, 1);
        }
        // a borda escura onde o chão acaba de lado
        ctx.fillStyle = cores.chao[1];
        if (blocoEm(f, col - 1, l) === Bloco.Vazio) ctx.fillRect(x, y, 1, T);
        if (blocoEm(f, col + 1, l) === Bloco.Vazio) ctx.fillRect(x + T - 1, y, 1, T);
        if (l < LINHAS - 1 && blocoEm(f, col, l + 1) === Bloco.Vazio) ctx.fillRect(x, y + T - 1, T, 1);
      } else if (b === Bloco.Tabua) {
        tabua(ctx, x, y, T, cores);
      } else if (b === Bloco.Espinho) {
        // pendurado (embaixo de um bloco) ou em pé
        const pendurado = blocoEm(f, col, l - 1) === Bloco.Chao && blocoEm(f, col, l + 1) !== Bloco.Chao;
        // três espinhos de 5 px de base e 10 de altura, linha a linha (sem meio-tom: borda dura de pixel art)
        const larguras = [1, 1, 1, 3, 3, 3, 3, 5, 5, 5];
        for (let i = 0; i < 3; i++) {
          const ex = x + 3 + i * 5;
          larguras.forEach((w, k) => {
            const yy = pendurado ? y + 9 - k : y + T - 10 + k;
            ctx.fillStyle = cores.espinho[1];
            ctx.fillRect(ex - (w - 1) / 2, yy, w, 1);
            if (w >= 3) {
              ctx.fillStyle = cores.espinho[0];
              ctx.fillRect(ex - (w - 1) / 2 + 1, yy, Math.max(1, w - 3), 1);
            }
          });
        }
      } else if (b === Bloco.Mola) {
        ctx.fillStyle = '#5a4a50';
        ctx.fillRect(x + 1, y + 13, 14, 3);
        ctx.fillStyle = '#c8bca8';
        for (let k = 0; k < 4; k++) ctx.fillRect(x + (k % 2 ? 4 : 3), y + 5 + k * 2, 9, 1);
        ctx.fillStyle = '#d46a4e';
        ctx.fillRect(x + 1, y + 2, 14, 3);
        ctx.fillStyle = '#f09a78';
        ctx.fillRect(x + 2, y + 2, 12, 1);
      }
    }
  }
  // os postos: uma plaquinha com a cenoura (o lugar para onde se volta)
  f.postos.forEach((p, i) => {
    if (i === 0) return;
    ctx.fillStyle = '#6a4a36';
    ctx.fillRect(p.x - 1, p.y - 18, 2, 18);
    ctx.fillStyle = '#e8d8bc';
    ctx.fillRect(p.x - 6, p.y - 22, 12, 8);
    ctx.fillStyle = '#e07a2e';
    ctx.fillRect(p.x - 3, p.y - 20, 6, 2);
    ctx.fillRect(p.x - 2, p.y - 18, 4, 1);
    ctx.fillStyle = '#6fa356';
    ctx.fillRect(p.x + 3, p.y - 21, 2, 2);
  });
  // a chegada: o mastro e a bandeira quadriculada
  const cx = f.chegada,
    chao = chaoDebaixo(f, cx);
  ctx.fillStyle = '#5a4a50';
  ctx.fillRect(cx - 1, chao - 70, 3, 70);
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 3; j++) {
      ctx.fillStyle = (i + j) % 2 ? '#2e2630' : '#f4ead8';
      ctx.fillRect(cx + 2 + i * 5, chao - 70 + j * 5, 5, 5);
    }
  ctx.fillStyle = '#e3b45a';
  ctx.fillRect(cx - 2, chao - 73, 5, 4);
  return c;
}

/** O fundo do buraco escurece: cair ali é voltar ao posto. */
function fundoDoBuraco(ctx: CanvasRenderingContext2D, x: number, y: number) {
  for (let k = 0; k < 8; k++) {
    ctx.fillStyle = `#2e2630${(['18', '30', '48', '60', '78', '90', 'a8', 'c0'] as const)[k]}`;
    ctx.fillRect(x, y + 8 + k, T, 1);
  }
}

/** Onde está o chão debaixo de x (para pôr a bandeira). */
function chaoDebaixo(f: Fase, x: number): number {
  const c = Math.floor(x / T);
  for (let l = 0; l < LINHAS; l++) if (blocoEm(f, c, l) === Bloco.Chao && blocoEm(f, c, l - 1) !== Bloco.Chao) return l * T;
  return ALTURA;
}

function tabua(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, cores: Cores) {
  ctx.fillStyle = cores.tabua[1];
  ctx.fillRect(x, y, w, 6);
  ctx.fillStyle = cores.tabua[0];
  ctx.fillRect(x, y, w, 4);
  ctx.fillStyle = cores.tabua[1];
  for (let i = 4; i < w; i += 16) ctx.fillRect(x + i, y + 1, 1, 1);
}

/** O fundo de longe: morros (prado), pedras (toca), copas de árvore (copas). Uma faixa de 640 px que se repete. */
function camadaLonge(tema: Tema, cores: Cores): HTMLCanvasElement {
  const [c, ctx] = tela(640, H);
  ctx.fillStyle = cores.longe;
  for (let x = 0; x < 640; x++) {
    const a = (x / 640) * Math.PI * 2;
    const alto =
      tema === 'toca'
        ? 40 + 18 * Math.sin(a * 3) + 10 * Math.sin(a * 7 + 1)
        : tema === 'copas'
          ? 70 + 16 * Math.abs(Math.sin(a * 5)) + 8 * Math.sin(a * 11)
          : 60 + 22 * Math.sin(a * 2) + 9 * Math.sin(a * 5 + 2);
    if (tema === 'toca') {
      // a toca tem rocha em cima e embaixo
      ctx.fillRect(x, 0, 1, Math.round(alto * 0.6));
      ctx.fillRect(x, H - Math.round(alto), 1, Math.round(alto));
    } else {
      ctx.fillRect(x, H - Math.round(alto), 1, Math.round(alto));
    }
  }
  return c;
}

function camadaPerto(tema: Tema, cores: Cores, largura = 640, cristal: string | null = '#8a7ea0'): HTMLCanvasElement {
  const [c, ctx] = tela(largura, H);
  ctx.fillStyle = cores.perto;
  if (tema === 'copas') {
    // troncos e folhagem
    for (let i = 0; i < 8; i++) {
      const x = i * 80 + Math.floor(sorte(i, 1) * 30);
      ctx.fillRect(x, 20, 10, H - 20);
      for (let k = 0; k < 14; k++) ctx.fillRect(x - 20 + Math.floor(sorte(i, k, 2) * 50), 4 + Math.floor(sorte(i, k, 3) * 50), 14, 10);
    }
  } else if (tema === 'toca') {
    // estalactites e cristais
    for (let i = 0; i < Math.floor(largura / 32); i++) {
      const x = i * 32 + Math.floor(sorte(i, 2) * 20),
        comp = 8 + Math.floor(sorte(i, 3) * 26);
      for (let k = 0; k < comp; k += 2) ctx.fillRect(x + Math.floor(k / 6), k, Math.max(1, 6 - Math.floor(k / 4)), 2);
      if (cristal && i % 3 === 0) {
        ctx.fillStyle = cristal;
        ctx.fillRect(x + 4, H - 30 - Math.floor(sorte(i, 4) * 30), 3, 6);
      }
      ctx.fillStyle = cores.perto;
    }
  } else {
    // moitas e árvores redondas
    for (let x = 0; x < 640; x++) {
      const a = (x / 640) * Math.PI * 2;
      const alto = 30 + 10 * Math.sin(a * 6) + 6 * Math.sin(a * 13 + 1);
      ctx.fillRect(x, H - Math.round(alto), 1, Math.round(alto));
    }
    for (let i = 0; i < 5; i++) {
      const x = i * 128 + 40;
      ctx.fillRect(x, H - 80, 6, 60);
      ctx.beginPath();
      ctx.arc(x + 3, H - 88, 20, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return c;
}

/**
 * O CENÁRIO DA KENNEY (20/11/2026): os blocos, as tábuas, as molas, os espinhos, a placa do posto, a bandeira e o fundo vêm do
 * Pixel Platformer da Kenney (CC0, web/public/plataforma/LICENCA-Kenney-Pixel-Platformer.txt). O coelho, os bichos e as
 * cenouras continuam os nossos. As casas do pacote são de 18 px e as da fase de 16: cada figura perde as DUAS colunas (e as
 * duas linhas) do meio, e não é encolhida — a borda e o contorno ficam inteiros, os pixels continuam do tamanho de um, e a
 * colisão não muda (é a grade de sempre). Enquanto as imagens não chegam (ou se não chegarem), vale o desenho por código acima.
 */
const K = 18;
const COLUNAS_DO_PACOTE = 20;
/** Qual linha do pacote é o "topo" de cada tema: grama no prado e nas copas, terra batida na toca. */
const TOPO_DO_TEMA: Record<Tema, number> = { prado: 1, copas: 1, toca: 3 };

interface Kenney {
  blocos: HTMLImageElement;
  fundos: HTMLImageElement;
  /** As figuras já cortadas para 16 px, pela chave "índice:modo". */
  cortes: Map<string, HTMLCanvasElement>;
}

let kenney: Kenney | null = null;
let carregando: Promise<void> | null = null;

function imagem(nome: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = `${import.meta.env.BASE_URL}plataforma/${nome}`;
  return img.decode().then(() => img);
}

function carregarKenney() {
  carregando ??= Promise.all([imagem('kenney-blocos.png'), imagem('kenney-fundos.png')])
    .then(([blocos, fundos]) => {
      kenney = { blocos, fundos, cortes: new Map() };
    })
    .catch(() => undefined);
}

/**
 * Uma figura do pacote cortada para 16 × 16: fora as colunas 8 e 9; e, nas linhas, as do meio ('meio'), as duas de cima
 * ('cima', para o que fica em pé no chão) ou as duas de baixo ('baixo', para o que fica no alto da casa).
 */
function corte(k: Kenney, i: number, modo: 'meio' | 'cima' | 'baixo' = 'meio'): HTMLCanvasElement {
  const chave = `${i}:${modo}`;
  let c = k.cortes.get(chave);
  if (c) return c;
  const [tc, ctx] = tela(T, T);
  const sx = (i % COLUNAS_DO_PACOTE) * K,
    sy = Math.floor(i / COLUNAS_DO_PACOTE) * K;
  const linhas: [number, number, number][] =
    modo === 'meio'
      ? [
          [0, 0, 8],
          [10, 8, 8],
        ]
      : [[modo === 'cima' ? 2 : 0, 0, 16]];
  for (const [de, para, quantas] of linhas) {
    ctx.drawImage(k.blocos, sx, sy + de, 8, quantas, 0, para, 8, quantas);
    ctx.drawImage(k.blocos, sx + 10, sy + de, 8, quantas, 8, para, 8, quantas);
  }
  c = tc;
  k.cortes.set(chave, c);
  return c;
}

/** Uma figura inteira do pacote (18 × 18), com o canto de cima à esquerda em (x, y). */
function inteira(ctx: CanvasRenderingContext2D, k: Kenney, i: number, x: number, y: number) {
  ctx.drawImage(k.blocos, (i % COLUNAS_DO_PACOTE) * K, Math.floor(i / COLUNAS_DO_PACOTE) * K, K, K, x, y, K, K);
}

/**
 * Uma prancha de largura qualquer feita da figura `i` (a tábua de madeira 146, a de pedra 147): a ponta da esquerda (8 px), a
 * coluna do meio repetida e a ponta da direita, sem as pontas onde a prancha continua na casa vizinha.
 */
function prancha(ctx: CanvasRenderingContext2D, k: Kenney, i: number, x: number, y: number, w: number, pontaE = true, pontaD = true) {
  const sx = (i % COLUNAS_DO_PACOTE) * K,
    sy = Math.floor(i / COLUNAS_DO_PACOTE) * K;
  const alt = 10;
  let de = x,
    ate = x + w;
  if (pontaE) {
    ctx.drawImage(k.blocos, sx, sy, 8, alt, x, y, 8, alt);
    de += 8;
  }
  if (pontaD) {
    ctx.drawImage(k.blocos, sx + 10, sy, 8, alt, x + w - 8, y, 8, alt);
    ate -= 8;
  }
  for (let xx = de; xx < ate; xx++) ctx.drawImage(k.blocos, sx + 8, sy, 1, alt, xx, y, 1, alt);
}

const solidoParaOAzulejo = (f: Fase, c: number, l: number) => l >= LINHAS || blocoEm(f, c, l) === Bloco.Chao;

/** A figura de um bloco de chão pelos vizinhos: o topo (grama), os lados, o fundo e as quinas de dentro. */
function figuraDoChao(f: Fase, c: number, l: number): number {
  const s = (dc: number, dl: number) => solidoParaOAzulejo(f, c + dc, l + dl);
  const cima = !s(0, -1),
    esq = !s(-1, 0),
    dir = !s(1, 0),
    baixo = !s(0, 1);
  const col = esq && dir ? 0 : esq ? 1 : dir ? 3 : 2;
  if (cima) return (baixo ? TOPO_DO_TEMA[f.tema] - 1 : TOPO_DO_TEMA[f.tema]) * COLUNAS_DO_PACOTE + col;
  if (col === 2 && !baixo) {
    // as quinas de dentro: o vizinho em diagonal vazio, com os dois do lado cheios
    if (!s(-1, -1)) return 25;
    if (!s(1, -1)) return 24;
    if (!s(-1, 1)) return 5;
    if (!s(1, 1)) return 4;
  }
  return (baixo ? 7 : 6) * COLUNAS_DO_PACOTE + col;
}

function pintarMapaKenney(f: Fase, k: Kenney): HTMLCanvasElement {
  const [c, ctx] = tela(f.colunas * T, ALTURA);
  const plantas = f.tema !== 'toca';
  for (let l = 0; l < LINHAS; l++) {
    for (let col = 0; col < f.colunas; col++) {
      const b = blocoEm(f, col, l);
      const x = col * T,
        y = l * T;
      if (b === Bloco.Vazio && l === LINHAS - 1) {
        if (f.tema === 'prado') agua(ctx, k, x, y);
        else fundoDoBuraco(ctx, x, y);
      } else if (b === Bloco.Chao) {
        ctx.drawImage(corte(k, figuraDoChao(f, col, l)), x, y);
      } else if (b === Bloco.Tabua) {
        prancha(ctx, k, 146, x, y, T, blocoEm(f, col - 1, l) !== Bloco.Tabua, blocoEm(f, col + 1, l) !== Bloco.Tabua);
      } else if (b === Bloco.Espinho) {
        const pendurado = blocoEm(f, col, l - 1) === Bloco.Chao && blocoEm(f, col, l + 1) !== Bloco.Chao;
        const fig = corte(k, 68, 'cima');
        if (pendurado) {
          ctx.save();
          ctx.translate(x, y + T);
          ctx.scale(1, -1);
          ctx.drawImage(fig, 0, 0);
          ctx.restore();
        } else ctx.drawImage(fig, x, y);
      } else if (b === Bloco.Mola) {
        ctx.drawImage(corte(k, 108, 'cima'), x, y);
      }
    }
  }
  // um ou outro broto na grama (só enfeite, longe dos postos e da chegada)
  if (plantas) {
    const perto = (x: number) => f.postos.some((p) => Math.abs(p.x - x) < 24) || Math.abs(f.chegada - x) < 32;
    for (let col = 1; col < f.colunas - 1; col++)
      for (let l = 1; l < LINHAS; l++) {
        if (blocoEm(f, col, l) !== Bloco.Chao || blocoEm(f, col, l - 1) !== Bloco.Vazio) continue;
        const s = sorte(col, l, 77);
        if (s > 0.06 || perto(col * T + T / 2)) continue;
        inteira(ctx, k, 124, col * T - 1, l * T - K + 3);
      }
  }
  // os postos: a placa com a seta
  f.postos.forEach((p, i) => {
    if (i === 0) return;
    inteira(ctx, k, 88, p.x - 9, p.y - K);
  });
  // o mastro da chegada (a bandeira, que tremula, vai a cada quadro)
  const cx = f.chegada,
    chao = chaoDebaixo(f, cx);
  const sx = (131 % COLUNAS_DO_PACOTE) * K,
    sy = Math.floor(131 / COLUNAS_DO_PACOTE) * K;
  for (let yy = chao - 54; yy < chao; yy += 9) ctx.drawImage(k.blocos, sx, sy, 6, 9, cx - 3, yy, 6, 9);
  return c;
}

/**
 * No prado e no córrego, o fundo do buraco é o rio (a água do pacote, 33): as ondas seguem a grade de 18 px do mundo, para
 * continuarem de uma casa para a outra sem emenda.
 */
function agua(ctx: CanvasRenderingContext2D, k: Kenney, x: number, y: number) {
  const sx = (33 % COLUNAS_DO_PACOTE) * K,
    sy = Math.floor(33 / COLUNAS_DO_PACOTE) * K;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, T, T);
  ctx.clip();
  for (let xx = Math.floor(x / K) * K; xx < x + T; xx += K) ctx.drawImage(k.blocos, sx, sy, K, 12, xx, y + 4, K, 12);
  ctx.restore();
}

/** A bandeira da chegada, em dois quadros. */
function bandeira(ctx: CanvasRenderingContext2D, k: Kenney, f: Fase, camX: number, camY: number, n: number) {
  const cx = f.chegada;
  if (cx < camX - 24 || cx > camX + W + 24) return;
  inteira(ctx, k, Math.floor(n / 20) % 2 ? 112 : 111, Math.round(cx - 3 - camX), Math.round(chaoDebaixo(f, cx) - 54 - K - camY));
}

/** A largura das faixas do fundo da Kenney: 27 figuras de 24 px (a de 640 do desenho por código não fecha em 24). */
const LARGURA_DO_FUNDO = 27 * 24;
const ALTURA_DO_FUNDO = H + 24;

/**
 * O fundo de cada fase, das figuras de 24 px do pacote (8 por linha: o céu, o horizonte e o chão de cada paisagem). Prado e
 * Córrego com as nuvens longe e as árvores perto, Galhos e Ninho com a mata verde desbotada (para a grama da fase se destacar), e a Toca e a Mina na parede de terra do
 * próprio bloco, escurecida, com as estalactites por código na frente.
 */
const FUNDOS: Record<string, { longe: number[]; perto: number[]; chao: number; desbotar: number }> = {
  prado: { longe: [8, 10], perto: [9, 9, 11], chao: 16, desbotar: 0 },
  corrego: { longe: [10, 8], perto: [11, 11, 9], chao: 16, desbotar: 0 },
  copas: { longe: [8, 10], perto: [15, 15, 14], chao: 22, desbotar: 0.45 },
  ninho: { longe: [10, 8], perto: [14, 15, 15], chao: 22, desbotar: 0.45 },
};
/** O céu é sempre o azul do pacote (o verde das copas ficava da cor da grama e escondia o chão). */
const CEU_DO_FUNDO = 0;

function figuraDoFundo(ctx: CanvasRenderingContext2D, k: Kenney, i: number, x: number, y: number) {
  ctx.drawImage(k.fundos, (i % 8) * 24, Math.floor(i / 8) * 24, 24, 24, x, y, 24, 24);
}

function camadasKenney(f: Fase, k: Kenney): [HTMLCanvasElement, HTMLCanvasElement] {
  const [longe, cl] = tela(LARGURA_DO_FUNDO, ALTURA_DO_FUNDO);
  const [perto, cp] = tela(LARGURA_DO_FUNDO, ALTURA_DO_FUNDO);
  if (f.tema === 'toca') {
    const mina = f.id.startsWith('mina');
    const terra = corte(k, 122);
    for (let y = 0; y < ALTURA_DO_FUNDO; y += T) for (let x = 0; x < LARGURA_DO_FUNDO; x += T) cl.drawImage(terra, x, y);
    cl.globalCompositeOperation = 'multiply';
    cl.fillStyle = mina ? '#5c6480' : '#7a5c5c';
    cl.fillRect(0, 0, LARGURA_DO_FUNDO, ALTURA_DO_FUNDO);
    cl.globalCompositeOperation = 'source-over';
    const p = camadaPerto('toca', { ...CORES.toca, perto: mina ? '#2e3044' : '#3a2a2a' }, LARGURA_DO_FUNDO, null);
    cp.drawImage(p, 0, 0);
    return [longe, perto];
  }
  const fundo = FUNDOS[f.id.split('-')[0]] ?? FUNDOS[f.tema];
  const yLonge = 88,
    yPerto = 92;
  // longe: o céu, a faixa do horizonte e, embaixo, a cor do chão
  for (let x = 0; x < LARGURA_DO_FUNDO; x += 24) {
    for (let y = 0; y < yLonge; y += 24) figuraDoFundo(cl, k, CEU_DO_FUNDO, x, y - ((24 - (yLonge % 24)) % 24));
    figuraDoFundo(cl, k, fundo.longe[Math.floor(sorte(x, 1) * fundo.longe.length)], x, yLonge);
    for (let y = yLonge + 24; y < ALTURA_DO_FUNDO; y += 24) figuraDoFundo(cl, k, fundo.chao, x, y);
  }
  // perto: só as árvores (o céu delas sai), e o chão embaixo
  const [faixa, cf] = tela(24, 24);
  for (let x = 0; x < LARGURA_DO_FUNDO; x += 24) {
    cf.clearRect(0, 0, 24, 24);
    figuraDoFundo(cf, k, fundo.perto[Math.floor(sorte(x, 2) * fundo.perto.length)], 0, 0);
    const d = cf.getImageData(0, 0, 24, 24);
    // fica só a cor das árvores, que é a da última linha (o chão): o céu e as nuvens saem
    const chao = d.data.slice((23 * 24) * 4, (23 * 24) * 4 + 4);
    for (let i = 0; i < d.data.length; i += 4) {
      const igualAoChao = d.data[i] === chao[0] && d.data[i + 1] === chao[1] && d.data[i + 2] === chao[2];
      if (!igualAoChao) d.data[i + 3] = 0;
    }
    cf.putImageData(d, 0, 0);
    cp.drawImage(faixa, x, yPerto);
    for (let y = yPerto + 24; y < ALTURA_DO_FUNDO; y += 24) figuraDoFundo(cp, k, fundo.chao, x, y);
  }
  if (fundo.desbotar > 0) {
    // a mata vai para trás: misturada com o céu, só onde há desenho
    const ceu = cl.getImageData(0, 0, 1, 1).data;
    cp.globalCompositeOperation = 'source-atop';
    cp.globalAlpha = fundo.desbotar;
    cp.fillStyle = `rgb(${ceu[0]}, ${ceu[1]}, ${ceu[2]})`;
    cp.fillRect(0, 0, LARGURA_DO_FUNDO, ALTURA_DO_FUNDO);
    cp.globalAlpha = 1;
    cp.globalCompositeOperation = 'source-over';
  }
  return [longe, perto];
}

export interface Figura {
  x: number;
  y: number;
  /** -2, -1, 1, 2: o lado, e 2 se no ar. */
  jeito: number;
  /** Quanto andou (escolhe o quadro do passo); null = parado. */
  andado: number | null;
  alpha?: number;
  nome?: string;
  piscando?: boolean;
  /** O amassa-e-estica (só desenho): a largura e a altura, com o pé parado no lugar. */
  escala?: [number, number];
}

/** O que a fase tem de vivo para quem corre (19/11/2026): as cenouras pegas, a dourada e os bichos pisados (bits). */
export interface Vivos {
  cenouras: number;
  dourada: boolean;
  pisados: number;
}

/** Uma partícula só de desenho: a poeira do pulo e do pouso, o estouro do espinho, o brilho da cenoura. */
export interface Particula {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vida: number;
  total: number;
  cor: string;
  tam: number;
  /** Cai com a gravidade (o estouro), ou só some (a poeira). */
  pesa?: boolean;
}

/** Anda as partículas `dt` segundos e tira as que acabaram. */
export function andarParticulas(ps: Particula[], dt: number) {
  for (let i = ps.length - 1; i >= 0; i--) {
    const q = ps[i];
    q.vida -= dt;
    if (q.vida <= 0) {
      ps.splice(i, 1);
      continue;
    }
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    if (q.pesa) q.vy += 500 * dt;
    else q.vx *= 0.9;
  }
}

export function desenharParticulas(ctx: CanvasRenderingContext2D, ps: Particula[], camX: number, camY: number) {
  for (const q of ps) {
    ctx.globalAlpha = Math.max(0, Math.min(1, q.vida / q.total));
    ctx.fillStyle = q.cor;
    const t = Math.max(1, Math.round(q.tam * (q.pesa ? 1 : 0.5 + q.vida / q.total)));
    ctx.fillRect(Math.round(q.x - camX - t / 2), Math.round(q.y - camY - t / 2), t, t);
  }
  ctx.globalAlpha = 1;
}

/** A cenoura de juntar (ou a dourada), balançando um pouco pelo passo. */
function cenoura(ctx: CanvasRenderingContext2D, x: number, y: number, n: number, dourada: boolean) {
  const b = Math.floor(((n + x) % 60) / 30);
  const yy = y - b;
  ctx.fillStyle = dourada ? '#a8781e' : '#b04e1e';
  ctx.fillRect(x - 2, yy - 3, 5, 5);
  ctx.fillRect(x - 1, yy + 2, 3, 2);
  ctx.fillRect(x, yy + 4, 1, 1);
  ctx.fillStyle = dourada ? '#f4d060' : '#ec8a3a';
  ctx.fillRect(x - 1, yy - 3, 3, 5);
  ctx.fillRect(x, yy + 2, 1, 2);
  ctx.fillStyle = dourada ? '#fff4c0' : '#f8b878';
  ctx.fillRect(x - 1, yy - 2, 1, 2);
  ctx.fillStyle = '#5e9a40';
  ctx.fillRect(x - 2, yy - 6, 1, 3);
  ctx.fillRect(x, yy - 7, 1, 4);
  ctx.fillRect(x + 2, yy - 6, 1, 3);
  if (dourada && Math.floor(n / 12) % 4 === 0) {
    ctx.fillStyle = '#fffbe8';
    ctx.fillRect(x + 4, yy - 6, 1, 3);
    ctx.fillRect(x + 3, yy - 5, 3, 1);
  }
}

/** O besouro (anda no chão) e a abelha (voa), por código. */
function bicho(ctx: CanvasRenderingContext2D, tipo: 'besouro' | 'abelha', x: number, y: number, lado: number, n: number) {
  const [mw, mh] = BICHO_MEIA[tipo];
  if (tipo === 'besouro') {
    const pe = Math.floor(n / 6) % 2;
    const yb = y + mh;
    ctx.fillStyle = '#2a2026';
    for (let i = 0; i < 3; i++) ctx.fillRect(x - 5 + i * 4 + (i % 2 === pe ? 1 : 0), yb - 2, 1, 2);
    ctx.fillStyle = '#3c5a3a';
    ctx.fillRect(x - mw, yb - 11, mw * 2, 8);
    ctx.fillRect(x - mw + 2, yb - 14, mw * 2 - 4, 3);
    ctx.fillStyle = '#5e8a4e';
    ctx.fillRect(x - mw + 2, yb - 12, 4, 2);
    ctx.fillStyle = '#1e2a1e';
    ctx.fillRect(x - 0, yb - 14, 1, 11);
    ctx.fillStyle = '#2a2026';
    const cx = x + lado * (mw - 1);
    ctx.fillRect(cx - 2, yb - 9, 4, 5);
    ctx.fillStyle = '#f4ead8';
    ctx.fillRect(cx + (lado > 0 ? 1 : -2), yb - 8, 1, 1);
    return;
  }
  const asa = Math.floor(n / 3) % 2;
  ctx.fillStyle = '#e8eef4b0';
  ctx.fillRect(x - 4, y - mh - 3 + asa * 2, 4, 3);
  ctx.fillRect(x + 1, y - mh - 3 + asa * 2, 4, 3);
  ctx.fillStyle = '#e8b830';
  ctx.fillRect(x - mw, y - 3, mw * 2, 7);
  ctx.fillStyle = '#2a2026';
  ctx.fillRect(x - 2, y - 3, 2, 7);
  ctx.fillRect(x + 2, y - 3, 1, 7);
  ctx.fillRect(x - lado * (mw + 1), y, 2, 1);
  ctx.fillStyle = '#f4ead8';
  ctx.fillRect(x + lado * (mw - 2), y - 2, 1, 1);
}

export function pintar(p: Pintura, camX: number, camY: number, n: number, figuras: Figura[], vivos?: Vivos) {
  trocarPelaKenney(p);
  const { ctx, cores, fase } = p;
  const ceu = ctx.createLinearGradient(0, 0, 0, H);
  ceu.addColorStop(0, cores.ceu[0]);
  ceu.addColorStop(0.6, cores.ceu[1]);
  ceu.addColorStop(1, cores.ceu[2]);
  ctx.fillStyle = ceu;
  ctx.fillRect(0, 0, W, H);
  // o fundo corre mais devagar que a fase (o de longe, bem mais)
  for (const [camada, fator] of [
    [p.longe, 0.18],
    [p.perto, 0.42],
  ] as const) {
    const larg = camada.width;
    const dx = -Math.floor((camX * fator) % larg);
    const dy = -Math.floor(camY * fator * 0.5);
    ctx.drawImage(camada, dx, dy);
    ctx.drawImage(camada, dx + larg, dy);
  }
  ctx.drawImage(p.mapa, Math.floor(camX), Math.floor(camY), W, H, 0, 0, W, H);
  if (p.kenney && kenney) bandeira(ctx, kenney, fase, camX, camY, n);
  for (const m of fase.moveis) {
    const q = movelEm(m, n);
    if (p.kenney && kenney) {
      prancha(ctx, kenney, 147, Math.round(q.x - camX), Math.round(q.y - camY), m.w);
      continue;
    }
    tabua(ctx, Math.round(q.x - camX), Math.round(q.y - camY), m.w, cores);
    ctx.fillStyle = cores.tabua[1];
    ctx.fillRect(Math.round(q.x - camX) + 2, Math.round(q.y - camY) + 6, m.w - 4, 1);
  }
  // as cenouras, a dourada e os bichos (quem assiste vê todos: as cenouras de cada um são dele)
  fase.cenouras.forEach((c, i) => {
    if (vivos && vivos.cenouras & (1 << i)) return;
    if (c.x < camX - 8 || c.x > camX + W + 8) return;
    cenoura(ctx, Math.round(c.x - camX), Math.round(c.y - camY), n, false);
  });
  if (fase.dourada && !vivos?.dourada) cenoura(ctx, Math.round(fase.dourada.x - camX), Math.round(fase.dourada.y - camY), n, true);
  fase.bichos.forEach((b, i) => {
    if (vivos && vivos.pisados & (1 << i)) return;
    const q = bichoEm(b, n);
    if (q.x < camX - 16 || q.x > camX + W + 16) return;
    bicho(ctx, b.tipo, Math.round(q.x - camX), Math.round(q.y - camY), q.lado, n);
  });
  for (const f of figuras) desenharCoelho(p, f, camX, camY);
}

function desenharCoelho(p: Pintura, f: Figura, camX: number, camY: number) {
  const { ctx } = p;
  if (!p.coelho || f.piscando) return;
  const quadro = Math.abs(f.jeito) === 2 ? 2 : f.andado === null ? PARADO : Math.floor(f.andado / 6) % 8;
  const x = Math.round(f.x - camX),
    y = Math.round(f.y - camY);
  ctx.save();
  ctx.globalAlpha = f.alpha ?? 1;
  ctx.translate(x, y);
  if (f.jeito < 0) ctx.scale(-1, 1);
  if (f.escala) ctx.scale(f.escala[0], f.escala[1]);
  ctx.drawImage(p.coelho, quadro * QUADRO_W, 0, QUADRO_W, QUADRO_H, -Math.floor(QUADRO_W / 2), -QUADRO_H + 1, QUADRO_W, QUADRO_H);
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

/** O semáforo da largada (o mesmo jeito do da corrida de kart): três luzes vermelhas, e as três verdes ao sair. */
export function semaforo(ctx: CanvasRenderingContext2D, contagem: number) {
  const acesas = contagem > 0 ? Math.min(3, Math.max(0, 3 - Math.floor((contagem - 1) / 60))) : 3;
  const verde = contagem === 0;
  const x0 = W / 2 - 27,
    y0 = 14;
  ctx.fillStyle = '#1e1822';
  ctx.fillRect(x0 - 4, y0 - 4, 62, 22);
  ctx.fillStyle = '#3a3040';
  ctx.fillRect(x0 - 3, y0 - 3, 60, 20);
  for (let i = 0; i < 3; i++) {
    const cx = x0 + 7 + i * 20;
    ctx.fillStyle = verde ? '#7ed060' : i < acesas ? '#e85a4a' : '#5a2a2a';
    ctx.fillRect(cx - 6, y0 + 1, 12, 12);
  }
}

/** A barra do quanto se andou da fase, no alto: os fantasmas e os outros em pontinhos, você em laranja. */
export function barraDoCaminho(ctx: CanvasRenderingContext2D, pontos: { andou: number; cor: string }[]) {
  const x0 = 60,
    x1 = W - 60,
    y = 6;
  ctx.fillStyle = '#1e1822a0';
  ctx.fillRect(x0 - 2, y - 2, x1 - x0 + 4, 6);
  ctx.fillStyle = '#f4ead860';
  ctx.fillRect(x0, y, x1 - x0, 2);
  for (const p of pontos) {
    ctx.fillStyle = p.cor;
    ctx.fillRect(Math.round(x0 + (x1 - x0) * Math.max(0, Math.min(1, p.andou))) - 1, y - 1, 3, 4);
  }
}
