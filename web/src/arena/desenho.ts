/**
 * O DESENHO DA ARENA DOS COELHOS (17/11/2026). Tudo por código, menos o coelho (o do criador, coelhos.ts): o chão de cada
 * cenário (a grama com tufos e flores, a praia com a areia, as conchas e a água na beira), a cerca, as árvores, as pedras e os
 * coqueiros, as balas de cada elemento, as zonas marcadas, os suprimentos e os efeitos (a faísca, a roda, as estrelinhas e a
 * fumaça de quem cai: ninguém se machuca, como na luta por turnos).
 *
 * O mundo é visto de cima, em três quartos: as balas andam no chão (a sombra é onde elas estão) e são desenhadas à altura da mão.
 */
import { BORDA, MUNDO_H, MUNDO_W, OBSTACULOS, PONTOS_DE_SUPRIMENTO, RAIO, W, H, type Cenario, type Suprimento } from './conta';
import { COR_DO_ELEMENTO } from '../bichos/desenho';
import type { Efeito, ZonaNaTela } from './regras';

/** A altura da mão (as balas e o efeito do golpe saem dela). */
export const MAO = 34;

const ruido = (x: number, y: number, k = 0) => {
  const s = Math.sin(x * 12.9898 + y * 78.233 + k * 37.719) * 43758.5453;
  return s - Math.floor(s);
};

export const corDo = (elemento: string | null | undefined) => (elemento ? (COR_DO_ELEMENTO as Record<string, string>)[elemento] ?? '#e0563a' : '#e0563a');

const chaos = new Map<Cenario, HTMLCanvasElement>();

/** O chão inteiro do cenário, pintado uma vez (o mundo todo: a câmera recorta). */
export function chaoDo(cenario: Cenario): HTMLCanvasElement {
  let c = chaos.get(cenario);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = MUNDO_W;
  c.height = MUNDO_H;
  const g = c.getContext('2d')!;
  const CASA = 16;
  for (let y = 0; y < MUNDO_H; y += CASA) {
    for (let x = 0; x < MUNDO_W; x += CASA) {
      const r = ruido(x, y);
      if (cenario === 'grama') {
        g.fillStyle = r < 0.33 ? '#7fb35a' : r < 0.66 ? '#86ba5f' : '#79ad55';
        g.fillRect(x, y, CASA, CASA);
        if (r > 0.82) {
          g.fillStyle = '#679a48';
          g.fillRect(x + 4, y + 9, 2, 4);
          g.fillRect(x + 7, y + 7, 2, 6);
          g.fillRect(x + 10, y + 9, 2, 4);
        } else if (r < 0.04) {
          g.fillStyle = ruido(x, y, 2) < 0.5 ? '#f3e7a4' : '#f2b9c8';
          g.fillRect(x + 6, y + 6, 3, 3);
          g.fillStyle = '#e6b53f';
          g.fillRect(x + 7, y + 7, 1, 1);
        }
      } else {
        g.fillStyle = r < 0.33 ? '#e9d49c' : r < 0.66 ? '#e4cd93' : '#eddaa6';
        g.fillRect(x, y, CASA, CASA);
        if (r > 0.9) {
          g.fillStyle = '#d6bd82';
          g.fillRect(x + 3, y + 5, 3, 2);
          g.fillRect(x + 9, y + 10, 2, 2);
        } else if (r < 0.025) {
          g.fillStyle = ruido(x, y, 3) < 0.5 ? '#f4c7b8' : '#fbf1e2';
          g.fillRect(x + 6, y + 6, 4, 3);
          g.fillRect(x + 7, y + 5, 2, 1);
        }
      }
    }
  }
  if (cenario === 'praia') {
    // a água na beira de cima, com as ondinhas
    for (let y = 0; y < BORDA + 10; y++) {
      for (let x = 0; x < MUNDO_W; x += 4) {
        const borda = BORDA + 6 + Math.round(Math.sin(x / 40) * 4);
        if (y > borda) continue;
        g.fillStyle = y > borda - 3 ? '#f6fbfb' : y > borda - 8 ? '#7cc6d6' : '#5aaec4';
        g.fillRect(x, y, 4, 1);
      }
    }
  }
  // a cerca em volta: tábuas e postes
  const tabua = cenario === 'grama' ? ['#9b6b43', '#7d5434', '#b3804f'] : ['#b48a5e', '#8f6a45', '#c9a274'];
  const cerca = (x: number, y: number, w: number, h: number) => {
    g.fillStyle = tabua[1];
    g.fillRect(x, y, w, h);
    g.fillStyle = tabua[0];
    g.fillRect(x + 2, y + 2, w - 4, h - 4);
    g.fillStyle = tabua[2];
    if (w > h) for (let k = x; k < x + w; k += 48) g.fillRect(k, y + 2, 6, h - 4);
    else for (let k = y; k < y + h; k += 48) g.fillRect(x + 2, k, w - 4, 6);
  };
  if (cenario === 'grama') cerca(0, 0, MUNDO_W, BORDA);
  cerca(0, MUNDO_H - BORDA, MUNDO_W, BORDA);
  cerca(0, 0, BORDA, MUNDO_H);
  cerca(MUNDO_W - BORDA, 0, BORDA, MUNDO_H);
  // os quatro pontos dos suprimentos: um círculo de pedrinhas no chão
  for (const [px, py] of PONTOS_DE_SUPRIMENTO) {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      g.fillStyle = cenario === 'grama' ? '#b9b4a2' : '#c7b48c';
      g.fillRect(Math.round(px + Math.cos(a) * 18) - 2, Math.round(py + Math.sin(a) * 12) - 1, 4, 3);
    }
  }
  chaos.set(cenario, c);
  return c;
}

/** Os obstáculos de pé (desenhados na ordem do y, junto com os coelhos). */
export function desenharObstaculo(g: CanvasRenderingContext2D, cenario: Cenario, i: number, cx: number, cy: number) {
  const [ox, oy, r] = OBSTACULOS[cenario][i];
  const x = Math.round(ox - cx), y = Math.round(oy - cy);
  if (x < -120 || x > W + 120 || y < -40 || y > H + 160) return;
  g.fillStyle = 'rgba(30,40,20,0.28)';
  g.beginPath();
  g.ellipse(x, y + 2, r + 4, (r + 4) * 0.45, 0, 0, Math.PI * 2);
  g.fill();
  if (cenario === 'grama' && r >= 24) {
    // a árvore: o tronco e a copa redonda em três tons
    g.fillStyle = '#6e4a2d';
    g.fillRect(x - 6, y - 26, 12, 28);
    g.fillStyle = '#58391f';
    g.fillRect(x - 6, y - 26, 4, 28);
    for (const [dx, dy, rr, cor] of [
      [0, -50, r + 10, '#3f7a3a'],
      [-6, -56, r + 4, '#4f9145'],
      [-10, -62, r - 8, '#68ab55'],
    ] as const) {
      g.fillStyle = cor;
      g.beginPath();
      g.arc(x + dx, y + dy, rr, 0, Math.PI * 2);
      g.fill();
    }
  } else if (cenario === 'praia' && r < 30 && i % 2 === 0) {
    // o coqueiro: o tronco curvo e as folhas
    g.fillStyle = '#9a7247';
    for (let k = 0; k < 9; k++) g.fillRect(x - 4 + Math.round(Math.sin(k / 3) * 3), y - 8 - k * 8, 8, 9);
    g.fillStyle = '#7f5d38';
    for (let k = 0; k < 9; k += 2) g.fillRect(x - 4 + Math.round(Math.sin(k / 3) * 3), y - 8 - k * 8, 8, 2);
    const topo = y - 80;
    g.fillStyle = '#3f8a45';
    for (const [dx, dy] of [[-30, 8], [30, 8], [-22, -10], [22, -10], [0, -16]] as const) {
      g.beginPath();
      g.moveTo(x, topo);
      g.quadraticCurveTo(x + dx * 0.6, topo + dy - 12, x + dx, topo + dy + 6);
      g.lineTo(x + dx * 0.8, topo + dy + 10);
      g.quadraticCurveTo(x + dx * 0.4, topo + dy - 2, x, topo + 4);
      g.fill();
    }
    g.fillStyle = '#6b4a2b';
    g.fillRect(x - 5, topo, 4, 4);
    g.fillRect(x + 1, topo + 1, 4, 4);
  } else {
    // a pedra: um monte em três tons
    const cor = cenario === 'grama' ? ['#7e8086', '#999ba1', '#b6b8bd'] : ['#a08e78', '#b8a68e', '#cfbea4'];
    g.fillStyle = cor[0];
    g.beginPath();
    g.ellipse(x, y - r * 0.45, r, r * 0.75, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = cor[1];
    g.beginPath();
    g.ellipse(x - r * 0.15, y - r * 0.6, r * 0.8, r * 0.55, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = cor[2];
    g.fillRect(x - r * 0.45, y - r * 0.95, r * 0.4, 4);
  }
}

/** A marca no chão debaixo de cada coelho: a cor do time (o meu, azul; os outros, vermelho; o do meu time, verde). */
export function desenharMarca(g: CanvasRenderingContext2D, x: number, y: number, tipo: 'eu' | 'amigo' | 'outro') {
  g.strokeStyle = tipo === 'eu' ? '#4aa3ff' : tipo === 'amigo' ? '#6fd47a' : '#ff5a5a';
  g.lineWidth = 2;
  g.beginPath();
  g.ellipse(Math.round(x), Math.round(y), RAIO + 3, (RAIO + 3) * 0.5, 0, 0, Math.PI * 2);
  g.stroke();
}

/** A sombra do coelho. */
export function desenharSombra(g: CanvasRenderingContext2D, x: number, y: number) {
  g.fillStyle = 'rgba(30,40,20,0.3)';
  g.beginPath();
  g.ellipse(Math.round(x), Math.round(y), RAIO + 2, (RAIO + 2) * 0.45, 0, 0, Math.PI * 2);
  g.fill();
}

/** O nome e a vida em cima do coelho. */
export function desenharEtiqueta(g: CanvasRenderingContext2D, x: number, topo: number, nome: string, pv: number, cor: string) {
  g.font = '9px sans-serif';
  g.textAlign = 'center';
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.fillText(nome, Math.round(x) + 1, topo - 7);
  g.fillStyle = '#ffffff';
  g.fillText(nome, Math.round(x), topo - 8);
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.fillRect(Math.round(x) - 15, topo - 4, 30, 4);
  g.fillStyle = pv > 50 ? cor : pv > 25 ? '#e6b53f' : '#e0563a';
  g.fillRect(Math.round(x) - 14, topo - 3, Math.round((28 * Math.max(0, pv)) / 100), 2);
  g.textAlign = 'start';
}

/** Uma bala de um elemento, com a sombra no chão (onde ela está) e o desenho à altura da mão. */
export function desenharBala(g: CanvasRenderingContext2D, elemento: string, x: number, y: number, dx: number, dy: number, raio: number, tempo: number) {
  const sx = Math.round(x), sy = Math.round(y);
  g.fillStyle = 'rgba(30,40,20,0.25)';
  g.beginPath();
  g.ellipse(sx, sy, raio, raio * 0.45, 0, 0, Math.PI * 2);
  g.fill();
  const bx = sx, by = sy - MAO + 10;
  const cor = corDo(elemento);
  // o rastro
  g.fillStyle = cor;
  g.globalAlpha = 0.35;
  g.beginPath();
  g.arc(bx - dx * raio * 1.6, by - dy * raio * 1.6, raio * 0.7, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
  g.beginPath();
  if (elemento === 'folha') {
    g.ellipse(bx, by, raio + 1, raio * 0.6, Math.atan2(dy, dx), 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#a6d98a';
    g.fillRect(bx - 1, by - 1, 2, 2);
  } else if (elemento === 'brasa') {
    g.arc(bx, by, raio, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffd36a';
    g.beginPath();
    g.arc(bx, by, raio * 0.5 + Math.sin(tempo / 60) * 0.8, 0, Math.PI * 2);
    g.fill();
  } else if (elemento === 'gota') {
    g.arc(bx, by, raio, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#d5efff';
    g.fillRect(bx - 2, by - 2, 2, 2);
  } else if (elemento === 'pedra') {
    g.fillRect(bx - raio, by - raio + 1, raio * 2, raio * 2 - 2);
    g.fillStyle = '#b2a28c';
    g.fillRect(bx - raio + 2, by - raio + 2, raio - 1, 3);
  } else if (elemento === 'vento') {
    g.strokeStyle = cor;
    g.lineWidth = 2;
    g.arc(bx, by, raio, tempo / 80, tempo / 80 + Math.PI * 1.4);
    g.stroke();
    g.beginPath();
    g.arc(bx, by, raio * 0.5, tempo / 60, tempo / 60 + Math.PI);
    g.stroke();
  } else {
    // a faísca: um zigue-zague
    g.strokeStyle = cor;
    g.lineWidth = 2;
    g.moveTo(bx - dx * raio * 2, by - dy * raio * 2);
    g.lineTo(bx - dy * 3, by + dx * 3);
    g.lineTo(bx + dy * 3, by - dx * 3);
    g.lineTo(bx + dx * raio * 2, by + dy * raio * 2);
    g.stroke();
    g.fillStyle = '#fff6c8';
    g.fillRect(bx - 1, by - 1, 3, 3);
  }
}

/** Uma zona marcada: o círculo pisca, e o miolo enche até bater. */
export function desenharZona(g: CanvasRenderingContext2D, z: ZonaNaTela, cx: number, cy: number, tempo: number, total: number) {
  const x = Math.round(z.x - cx), y = Math.round(z.y - cy);
  const cor = z.elemento ? corDo(z.elemento) : '#e0563a';
  const k = Math.max(0, Math.min(1, 1 - z.resta / total));
  if (z.resta < 0) {
    // bateu: o estouro, rápido
    const t = Math.min(1, -z.resta / 260);
    g.globalAlpha = 1 - t;
    g.fillStyle = cor;
    g.beginPath();
    g.arc(x, y, z.raio * (0.8 + t * 0.3), 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    return;
  }
  g.globalAlpha = 0.18 + 0.12 * k;
  g.fillStyle = cor;
  g.beginPath();
  g.arc(x, y, z.raio * k, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = Math.floor(tempo / (k > 0.6 ? 90 : 180)) % 2 ? 0.95 : 0.55;
  g.strokeStyle = cor;
  g.lineWidth = 2;
  g.setLineDash([6, 4]);
  g.beginPath();
  g.arc(x, y, z.raio, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  g.globalAlpha = 1;
}

/** Um suprimento no chão, flutuando: a cura (folha com a cruz), a energia (a estrela) e a velocidade (a pena). */
export function desenharSuprimento(g: CanvasRenderingContext2D, tipo: Suprimento, x: number, y: number, tempo: number) {
  const sx = Math.round(x), sy = Math.round(y);
  g.fillStyle = 'rgba(30,40,20,0.25)';
  g.beginPath();
  g.ellipse(sx, sy, 9, 4, 0, 0, Math.PI * 2);
  g.fill();
  const by = sy - 16 - Math.round(Math.sin(tempo / 260) * 3);
  desenharIconeDoSuprimento(g, tipo, sx, by);
}

/** O ícone do suprimento (também na seta da borda), com o meio em (x, y). */
export function desenharIconeDoSuprimento(g: CanvasRenderingContext2D, tipo: Suprimento, x: number, y: number) {
  if (tipo === 'cura') {
    g.fillStyle = '#2f7a3d';
    g.fillRect(x - 7, y - 7, 14, 14);
    g.fillStyle = '#5cbf6a';
    g.fillRect(x - 6, y - 6, 12, 12);
    g.fillStyle = '#ffffff';
    g.fillRect(x - 1, y - 4, 3, 9);
    g.fillRect(x - 4, y - 1, 9, 3);
  } else if (tipo === 'energia') {
    g.fillStyle = '#b8860b';
    g.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const r = k % 2 ? 4 : 9;
      g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    g.fill();
    g.fillStyle = '#ffd84a';
    g.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const r = k % 2 ? 3 : 7;
      g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    g.fill();
  } else {
    // a pena azul (a velocidade)
    g.fillStyle = '#2d6aa8';
    g.beginPath();
    g.ellipse(x, y, 4, 9, 0.6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#7cc0f2';
    g.beginPath();
    g.ellipse(x - 1, y - 1, 2.5, 7, 0.6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f2f6fa';
    g.fillRect(x + 3, y + 5, 2, 4);
  }
}

/** Um efeito; devolve false quando acabou. */
export function desenharEfeito(g: CanvasRenderingContext2D, e: Efeito, cx: number, cy: number, agora: number): boolean {
  const t = agora - e.em;
  if (t < 0) return true;
  const x = Math.round(e.x - cx), y = Math.round(e.y - cy);
  const cor = corDo(e.elemento);
  if (e.tipo === 'faisca') {
    if (t > 220) return false;
    g.fillStyle = cor;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const r = 3 + t / 25;
      g.fillRect(Math.round(x + Math.cos(a) * r) - 1, Math.round(y - MAO + 10 + Math.sin(a) * r) - 1, 3, 3);
    }
    return true;
  }
  if (e.tipo === 'roda') {
    if (t > 320) return false;
    const r = (e.raio ?? 50) * Math.min(1, 0.4 + t / 160);
    g.globalAlpha = 1 - t / 320;
    g.strokeStyle = cor;
    g.lineWidth = 4;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;
    return true;
  }
  if (e.tipo === 'numero') {
    if (t > 700) return false;
    g.font = e.forca === 1 ? 'bold 13px sans-serif' : '10px sans-serif';
    g.textAlign = 'center';
    g.globalAlpha = 1 - t / 700;
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillText(e.texto ?? '', x + 1, y - 92 - t / 30 + 1);
    g.fillStyle = e.forca === 1 ? '#ffd84a' : e.forca === 2 ? '#b8c0c8' : '#ffffff';
    g.fillText(e.texto ?? '', x, y - 92 - t / 30);
    g.globalAlpha = 1;
    g.textAlign = 'start';
    return true;
  }
  if (e.tipo === 'pegou') {
    if (t > 400) return false;
    g.globalAlpha = 1 - t / 400;
    g.strokeStyle = '#fff6c8';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(x, y - 14, 8 + t / 20, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;
    return true;
  }
  if (e.tipo === 'caiu') {
    // as estrelinhas rodando e a fumaça subindo: quem cai sai de cena, sem machucado
    if (t > 1100) return false;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + t / 180;
      g.fillStyle = '#ffe680';
      g.fillRect(Math.round(x + Math.cos(a) * 16) - 1, Math.round(y - 60 + Math.sin(a) * 6) - 1, 3, 3);
    }
    for (let k = 0; k < 6; k++) {
      const r = 8 + k * 2 + t / 60;
      g.globalAlpha = Math.max(0, 0.55 - t / 1100);
      g.fillStyle = '#e8e4dc';
      g.beginPath();
      g.arc(x + Math.cos(k * 1.7) * 10, y - 20 - k * 6 - t / 25, r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    return true;
  }
  return false;
}

/** Uma seta na borda da tela, apontando para (x, y) fora dela, com o ícone. */
export function desenharSetaNaBorda(g: CanvasRenderingContext2D, x: number, y: number, cor: string, icone?: Suprimento) {
  const mx = W / 2, my = H / 2;
  const dx = x - mx, dy = y - my;
  const k = Math.min((W / 2 - 16) / Math.max(1, Math.abs(dx)), (H / 2 - 16) / Math.max(1, Math.abs(dy)));
  const px = mx + dx * k, py = my + dy * k;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d;
  g.fillStyle = cor;
  g.beginPath();
  g.moveTo(px + ux * 8, py + uy * 8);
  g.lineTo(px - uy * 6 - ux * 4, py + ux * 6 - uy * 4);
  g.lineTo(px + uy * 6 - ux * 4, py - ux * 6 - uy * 4);
  g.fill();
  if (icone) desenharIconeDoSuprimento(g, icone, Math.round(px - ux * 14), Math.round(py - uy * 14));
}
