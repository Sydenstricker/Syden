/**
 * O DESENHO DA ARENA DOS COELHOS (17/11/2026). Tudo por código, menos o coelho (o do criador, coelhos.ts): o chão de cada
 * cenário (a grama com tufos e flores, a praia com a areia, as conchas e a água na beira), a cerca, as árvores, as pedras e os
 * coqueiros, as balas de cada elemento, as zonas marcadas, os suprimentos e os efeitos (a faísca, a roda, as estrelinhas e a
 * fumaça de quem cai: ninguém se machuca, como na luta por turnos).
 *
 * O mundo é visto de cima, em três quartos: as balas andam no chão (a sombra é onde elas estão) e são desenhadas à altura da mão.
 */
import { BORDA, MATO, MUNDO_H, MUNDO_W, OBSTACULOS, POCAS_DE_LAMA, PONTOS_DE_SUPRIMENTO, RAIO, W, H, ZONA_DO_OBJETIVO, type Cenario, type Suprimento } from './conta';
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
      } else if (cenario === 'gelo') {
        // o lago congelado: o gelo azulado, com riscos e manchas de neve
        g.fillStyle = r < 0.33 ? '#cfe6f2' : r < 0.66 ? '#c6e0ee' : '#d8ecf6';
        g.fillRect(x, y, CASA, CASA);
        if (r > 0.86) {
          g.fillStyle = '#eef8fd';
          g.fillRect(x + 2, y + 5, 9, 1);
          g.fillRect(x + 6, y + 9, 7, 1);
        } else if (r < 0.05) {
          g.fillStyle = '#ffffff';
          g.fillRect(x + 4, y + 4, 6, 5);
        }
      } else if (cenario === 'lama') {
        // o brejo: a terra úmida, com tufos
        g.fillStyle = r < 0.33 ? '#8d9a5a' : r < 0.66 ? '#86935a' : '#93a062';
        g.fillRect(x, y, CASA, CASA);
        if (r > 0.85) {
          g.fillStyle = '#6f7d42';
          g.fillRect(x + 5, y + 8, 2, 5);
          g.fillRect(x + 9, y + 7, 2, 6);
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
  if (cenario === 'lama') {
    // as poças de lama (a regra: dentro delas, o coelho anda mais devagar)
    for (const [px, py, pr] of POCAS_DE_LAMA) {
      for (let y = -pr; y <= pr; y += 4) {
        for (let x = -pr; x <= pr; x += 4) {
          if (x * x + y * y > pr * pr) continue;
          const borda = x * x + y * y > (pr - 8) * (pr - 8);
          g.fillStyle = borda ? '#6a5236' : ruido(px + x, py + y, 5) < 0.15 ? '#8a6c48' : '#5c4630';
          g.fillRect(px + x, py + y, 4, 4);
        }
      }
    }
  }
  // a cerca em volta: tábuas e postes
  const tabua = cenario === 'grama' || cenario === 'lama' ? ['#9b6b43', '#7d5434', '#b3804f'] : cenario === 'gelo' ? ['#8a7a6c', '#6c5e52', '#a89888'] : ['#b48a5e', '#8f6a45', '#c9a274'];
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
  // o chão do mato: a terra escura embaixo das folhas (as folhas são de pé: desenharFolhasDoMato)
  const [base, escura] = CORES_DO_MATO[cenario];
  for (const [mx, my, mr] of MATO[cenario]) {
    for (let y = -mr; y <= mr; y += 4) {
      for (let x = -mr; x <= mr; x += 4) {
        const d2 = x * x + y * y;
        if (d2 > mr * mr) continue;
        g.fillStyle = d2 > (mr - 6) * (mr - 6) || ruido(mx + x, my + y, 7) < 0.25 ? escura : base;
        g.fillRect(mx + x, my + y, 4, 4);
      }
    }
  }
  // os quatro pontos dos suprimentos: um círculo de pedrinhas no chão
  for (const [px, py] of PONTOS_DE_SUPRIMENTO) {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      g.fillStyle = cenario === 'praia' ? '#c7b48c' : cenario === 'gelo' ? '#9fb6c4' : '#b9b4a2';
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
  if (cenario === 'gelo') {
    // o monte de neve: três bolas brancas com a sombra azul
    for (const [dx, dy, k, cor] of [
      [0, -r * 0.45, 1, '#a9c8dc'],
      [-r * 0.15, -r * 0.62, 0.78, '#e6f2f8'],
      [-r * 0.3, -r * 0.8, 0.4, '#ffffff'],
    ] as const) {
      g.fillStyle = cor;
      g.beginPath();
      g.ellipse(x + dx, y + dy, r * k, r * 0.72 * k, 0, 0, Math.PI * 2);
      g.fill();
    }
    return;
  }
  if (cenario === 'lama') {
    // o toco: o tronco cortado com os anéis em cima
    g.fillStyle = '#6e4a2d';
    g.fillRect(x - r * 0.8, y - r * 1.1, r * 1.6, r * 1.1);
    g.fillStyle = '#58391f';
    g.fillRect(x - r * 0.8, y - r * 1.1, r * 0.4, r * 1.1);
    g.fillStyle = '#c59a62';
    g.beginPath();
    g.ellipse(x, y - r * 1.1, r * 0.8, r * 0.35, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#9b7444';
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(x, y - r * 1.1, r * 0.45, r * 0.18, 0, 0, Math.PI * 2);
    g.stroke();
    return;
  }
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

/** O contorno escuro por baixo dos anéis e dos efeitos claros, para não sumirem na areia e na neve. */
const CONTORNO_ESCURO = 'rgba(40, 26, 16, 0.5)';

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
  g.setLineDash([6, 4]);
  g.beginPath();
  g.arc(x, y, z.raio, 0, Math.PI * 2);
  // o contorno escuro por baixo: na areia clara da praia, o anel sozinho sumia (a auditoria de 25/11/2026)
  g.strokeStyle = CONTORNO_ESCURO;
  g.lineWidth = 4;
  g.stroke();
  g.strokeStyle = cor;
  g.lineWidth = 2;
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
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.strokeStyle = CONTORNO_ESCURO;
    g.lineWidth = 6;
    g.stroke();
    g.strokeStyle = cor;
    g.lineWidth = 4;
    g.stroke();
    g.globalAlpha = 1;
    return true;
  }
  if (e.tipo === 'numero') {
    // O NÚMERO DO DANO (25/11/2026): era 10 px cinza sem contorno, ilegível na areia. Agora maior, com contorno escuro, e o
    // golpe que vale mais cresce num pulo no começo; o que vale menos continua menor e mais apagado, mas legível.
    if (t > 800) return false;
    const base = e.forca === 1 ? 17 : e.forca === 2 ? 12 : 14;
    const pulo = e.forca === 1 && t < 120 ? 1 + 0.35 * (1 - t / 120) : 1;
    g.font = `bold ${Math.round(base * pulo)}px sans-serif`;
    g.textAlign = 'center';
    g.lineJoin = 'round';
    g.globalAlpha = t < 500 ? 1 : 1 - (t - 500) / 300;
    // nasce acima da etiqueta do nome (a 92 px, cobria o nome no começo)
    const ny = Math.round(y - 106 - t / 25);
    g.strokeStyle = '#1e140c';
    g.lineWidth = 4;
    g.strokeText(e.texto ?? '', x, ny);
    g.fillStyle = e.forca === 1 ? '#ffd84a' : e.forca === 2 ? '#d6dde4' : '#ffffff';
    g.fillText(e.texto ?? '', x, ny);
    g.globalAlpha = 1;
    g.textAlign = 'start';
    g.lineJoin = 'miter';
    return true;
  }
  if (e.tipo === 'pegou') {
    if (t > 400) return false;
    g.globalAlpha = 1 - t / 400;
    g.beginPath();
    g.arc(x, y - 14, 8 + t / 20, 0, Math.PI * 2);
    g.strokeStyle = CONTORNO_ESCURO;
    g.lineWidth = 4;
    g.stroke();
    g.strokeStyle = '#fff6c8';
    g.lineWidth = 2;
    g.stroke();
    g.globalAlpha = 1;
    return true;
  }
  if (e.tipo === 'caiu') {
    // as estrelinhas rodando e a fumaça subindo: quem cai sai de cena, sem machucado. A fumaça em dois tons, o de fora
    // acinzentado: a creme sozinha sumia na areia da praia (a auditoria de 25/11/2026)
    if (t > 1100) return false;
    const some = Math.max(0, 1 - t / 1100);
    for (let k = 0; k < 6; k++) {
      const r = 8 + k * 2 + t / 60;
      const fx = x + Math.cos(k * 1.7) * 10, fy = y - 20 - k * 6 - t / 25;
      g.globalAlpha = 0.6 * some;
      g.fillStyle = '#8a7e74';
      g.beginPath();
      g.arc(fx, fy, r + 2, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 0.75 * some;
      g.fillStyle = '#e8e4dc';
      g.beginPath();
      g.arc(fx - 1, fy - 1, r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + t / 180;
      const sx = Math.round(x + Math.cos(a) * 16), sy = Math.round(y - 60 + Math.sin(a) * 6);
      g.fillStyle = '#3a2614';
      g.fillRect(sx - 2, sy - 2, 5, 5);
      g.fillStyle = '#ffe680';
      g.fillRect(sx - 1, sy - 1, 3, 3);
    }
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

/**
 * SEGURAR A ZONA (19/11/2026): o círculo do meio, no chão. Com a cor do time que está sozinho nele (`cor`), ou pontilhado
 * (ninguém, ou disputado). `tempo` faz a borda andar devagar.
 */
export function desenharZonaDoObjetivo(g: CanvasRenderingContext2D, cx: number, cy: number, cor: string | null, tempo: number) {
  const x = Math.round(ZONA_DO_OBJETIVO.x - cx), y = Math.round(ZONA_DO_OBJETIVO.y - cy);
  const r = ZONA_DO_OBJETIVO.raio;
  g.globalAlpha = cor ? 0.22 : 0.1;
  g.fillStyle = cor ?? '#ffffff';
  g.beginPath();
  g.ellipse(x, y, r, r, 0, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 0.85;
  g.strokeStyle = cor ?? '#fff6c8';
  g.lineWidth = 3;
  g.setLineDash([10, 8]);
  g.lineDashOffset = -Math.floor(tempo / 60) % 18;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  g.lineDashOffset = 0;
  g.globalAlpha = 1;
}

// ---------------- O MATO ----------------
/** O mato de cada cenário: [chão, chão escuro, folha escura, folha, ponta clara]. A grama alta, o capim da duna, o junco do gelo e a taboa do brejo. */
const CORES_DO_MATO: Record<Cenario, readonly [string, string, string, string, string]> = {
  grama: ['#4c8338', '#3e6f2e', '#3a6b2a', '#5a9a41', '#86c25c'],
  praia: ['#b9ac6c', '#a39758', '#8c8a46', '#a9a85a', '#d6cf86'],
  gelo: ['#9fbfb4', '#86a89c', '#5f8a7c', '#7fa898', '#d8eee6'],
  lama: ['#5f6a35', '#4c5629', '#4f5c28', '#6d7c3a', '#a5824e'],
};

/** As folhas de cada moita, em fileiras: [y da fileira, [dx, altura, tom][]]. As mesmas sempre (pelo ruído). */
const folhasDasMoitas = new Map<string, [number, [number, number, number][]][]>();
function folhasDa(cenario: Cenario, i: number) {
  const chave = cenario + i;
  let f = folhasDasMoitas.get(chave);
  if (f) return f;
  const [mx, my, mr] = MATO[cenario][i];
  f = [];
  for (let y = -mr + 4; y <= mr; y += 6) {
    const linha: [number, number, number][] = [];
    for (let x = -mr; x <= mr; x += 4) {
      const r = ruido(mx + x, my + y, 9);
      if (x * x + y * y > (mr - 2) * (mr - 2) || r < 0.3) continue;
      linha.push([x + Math.floor(r * 3), 10 + Math.floor(ruido(mx + x, my + y, 11) * 10), r < 0.55 ? 2 : r < 0.85 ? 3 : 4]);
    }
    if (linha.length) f.push([my + y, linha]);
  }
  folhasDasMoitas.set(chave, f);
  return f;
}

/**
 * As folhas do mato, DE PÉ: uma entrada por fileira, para a tela as desenhar na ordem do y junto com os coelhos (quem está dentro
 * fica com as pernas atrás das folhas da frente). Balançam devagar com o tempo (parado com "menos movimento").
 */
export function fileirasDoMato(g: CanvasRenderingContext2D, cenario: Cenario, cx: number, cy: number, tempo: number): { y: number; desenhar: () => void }[] {
  const saida: { y: number; desenhar: () => void }[] = [];
  const cores = CORES_DO_MATO[cenario];
  MATO[cenario].forEach(([mx, my, mr], i) => {
    if (mx + mr < cx - 10 || mx - mr > cx + W + 10 || my + mr < cy - 10 || my - mr > cy + H + 30) return;
    for (const [fy, linha] of folhasDa(cenario, i)) {
      saida.push({
        y: fy,
        desenhar: () => {
          const y = Math.round(fy - cy);
          for (const [dx, alt, tom] of linha) {
            const x = Math.round(mx + dx - cx);
            const balanca = Math.round(Math.sin(tempo / 700 + (mx + dx) * 0.13) * 1.4);
            g.fillStyle = cores[tom];
            g.fillRect(x, y - alt, 2, alt);
            g.fillRect(x + balanca, y - alt - 3, 2, 4);
            if (tom === 4) continue;
            g.fillStyle = cores[4];
            g.fillRect(x + balanca, y - alt - 3, 1, 2);
          }
        },
      });
    }
  });
  return saida;
}
