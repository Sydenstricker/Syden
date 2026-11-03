import { ALTURA, Bloco, blocoEm, LINHAS, movelEm, T, type Fase, type Tema } from './fases';

/**
 * O DESENHO DO PULO DO COELHO (03/11/2026): tudo por código, numa tela de 320 × 180 ampliada com os pixels nítidos, como
 * os jogos de 16 bits. O fundo em camadas que correm em velocidades diferentes (o céu parado, os morros devagar, o que está
 * perto mais depressa), a fase inteira pintada uma vez numa imagem grande (os blocos não mudam), e por cima o que se mexe:
 * as plataformas que andam, os fantasmas, os outros e o coelho.
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
  return { ctx, fase, cores, mapa: pintarMapa(fase, cores), longe: camadaLonge(fase.tema, cores), perto: camadaPerto(fase.tema, cores), coelho: null };
}

function pintarMapa(f: Fase, cores: Cores): HTMLCanvasElement {
  const [c, ctx] = tela(f.colunas * T, ALTURA);
  for (let l = 0; l < LINHAS; l++) {
    for (let col = 0; col < f.colunas; col++) {
      const b = blocoEm(f, col, l);
      const x = col * T, y = l * T;
      if (b === Bloco.Vazio && l === LINHAS - 1) {
        // o fundo do buraco escurece: cair ali é voltar ao posto
        for (let k = 0; k < 8; k++) {
          ctx.fillStyle = `#2e2630${(['18', '30', '48', '60', '78', '90', 'a8', 'c0'] as const)[k]}`;
          ctx.fillRect(x, y + 8 + k, T, 1);
        }
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
  const cx = f.chegada, chao = chaoDebaixo(f, cx);
  ctx.fillStyle = '#5a4a50';
  ctx.fillRect(cx - 1, chao - 70, 3, 70);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
    ctx.fillStyle = (i + j) % 2 ? '#2e2630' : '#f4ead8';
    ctx.fillRect(cx + 2 + i * 5, chao - 70 + j * 5, 5, 5);
  }
  ctx.fillStyle = '#e3b45a';
  ctx.fillRect(cx - 2, chao - 73, 5, 4);
  return c;
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

function camadaPerto(tema: Tema, cores: Cores): HTMLCanvasElement {
  const [c, ctx] = tela(640, H);
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
    for (let i = 0; i < 20; i++) {
      const x = i * 32 + Math.floor(sorte(i, 2) * 20), comp = 8 + Math.floor(sorte(i, 3) * 26);
      for (let k = 0; k < comp; k += 2) ctx.fillRect(x + Math.floor(k / 6), k, Math.max(1, 6 - Math.floor(k / 4)), 2);
      ctx.fillStyle = '#8a7ea0';
      if (i % 3 === 0) ctx.fillRect(x + 4, H - 30 - Math.floor(sorte(i, 4) * 30), 3, 6);
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
}

export function pintar(p: Pintura, camX: number, camY: number, n: number, figuras: Figura[]) {
  const { ctx, cores, fase } = p;
  const ceu = ctx.createLinearGradient(0, 0, 0, H);
  ceu.addColorStop(0, cores.ceu[0]);
  ceu.addColorStop(0.6, cores.ceu[1]);
  ceu.addColorStop(1, cores.ceu[2]);
  ctx.fillStyle = ceu;
  ctx.fillRect(0, 0, W, H);
  // o fundo corre mais devagar que a fase (o de longe, bem mais)
  for (const [camada, fator] of [[p.longe, 0.18], [p.perto, 0.42]] as const) {
    const dx = -Math.floor((camX * fator) % 640);
    const dy = -Math.floor(camY * fator * 0.5);
    ctx.drawImage(camada, dx, dy);
    ctx.drawImage(camada, dx + 640, dy);
  }
  ctx.drawImage(p.mapa, Math.floor(camX), Math.floor(camY), W, H, 0, 0, W, H);
  for (const m of fase.moveis) {
    const q = movelEm(m, n);
    tabua(ctx, Math.round(q.x - camX), Math.round(q.y - camY), m.w, cores);
    ctx.fillStyle = cores.tabua[1];
    ctx.fillRect(Math.round(q.x - camX) + 2, Math.round(q.y - camY) + 6, m.w - 4, 1);
  }
  for (const f of figuras) desenharCoelho(p, f, camX, camY);
}

function desenharCoelho(p: Pintura, f: Figura, camX: number, camY: number) {
  const { ctx } = p;
  if (!p.coelho || f.piscando) return;
  const quadro = Math.abs(f.jeito) === 2 ? 2 : f.andado === null ? PARADO : Math.floor(f.andado / 6) % 8;
  const x = Math.round(f.x - camX), y = Math.round(f.y - camY);
  ctx.save();
  ctx.globalAlpha = f.alpha ?? 1;
  ctx.translate(x, y);
  if (f.jeito < 0) ctx.scale(-1, 1);
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
  const x0 = W / 2 - 27, y0 = 14;
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
  const x0 = 60, x1 = W - 60, y = 6;
  ctx.fillStyle = '#1e1822a0';
  ctx.fillRect(x0 - 2, y - 2, x1 - x0 + 4, 6);
  ctx.fillStyle = '#f4ead860';
  ctx.fillRect(x0, y, x1 - x0, 2);
  for (const p of pontos) {
    ctx.fillStyle = p.cor;
    ctx.fillRect(Math.round(x0 + (x1 - x0) * Math.max(0, Math.min(1, p.andou))) - 1, y - 1, 3, 4);
  }
}
