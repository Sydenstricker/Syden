import { coresDoJogador, type AvatarDoJogo } from '../coelho/cores';
import { CANION, HORTA, NEVE, sorteio, type DefinicaoDaPista } from '../corrida/pista';
import { prepararDesenho } from '../corrida/render';
import { MUNDO, type Desafio, type Voo } from './sim';

/**
 * O DESENHO DO PLANADOR (16/11/2026): o "Mode 7" da corrida (corrida/render.ts) com a câmera que SOBE e INCLINA. O chão é uma
 * textura pintada por código (um ponto por metro), lida linha a linha da tela: a câmera tem altura e um ângulo para baixo, e
 * cada linha abaixo do horizonte cai num lugar do chão, por onde se anda em linha reta de um lado ao outro. Na queda livre a
 * câmera olha quase para baixo; na asa, quase para a frente. O céu (as nuvens e os morros) e as árvores são os da corrida.
 * Os anéis, a plataforma, a asa e o paraquedas são pontos 3D projetados; o coelho de costas é desenhado aqui, com as cores
 * do avatar de cada um. Tudo numa tela de 320 × 180 que o navegador amplia com os pixels nítidos.
 */

export const W = 320;
export const H = 180;
/** A linha da tela por onde passa o eixo da lente (o horizonte, com a câmera reta). */
const C0 = 58;
const FOCO = 172;
/** Onde o coelho fica na tela (a câmera vai atrás e um pouco acima). */
const LINHA_DO_COELHO = 112;

const rgb = (r: number, g: number, b: number) => (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;

export interface Camera {
  x: number;
  y: number;
  h: number;
  /** O ângulo do rumo (no chão) e o quanto olha para baixo (radianos). */
  ang: number;
  incl: number;
  // a base, calculada por `montarCamera`
  fx: number;
  fy: number;
  fz: number;
  ux: number;
  uy: number;
  uz: number;
  rx: number;
  ry: number;
}

/** A câmera atrás do ponto (x, y, h), a `dist` metros, olhando para o rumo `ang` e inclinada `incl` para baixo. */
export function montarCamera(x: number, y: number, h: number, ang: number, incl: number, dist: number): Camera {
  const ca = Math.cos(ang), sa = Math.sin(ang), cp = Math.cos(incl), sp = Math.sin(incl);
  const fx = ca * cp, fy = sa * cp, fz = -sp;
  const ux = ca * sp, uy = sa * sp, uz = cp;
  const lift = ((LINHA_DO_COELHO - C0) * dist) / FOCO;
  return {
    x: x - fx * dist + ux * lift,
    y: y - fy * dist + uy * lift,
    h: Math.max(0.6, h - fz * dist + uz * lift),
    ang,
    incl,
    fx,
    fy,
    fz,
    ux,
    uy,
    uz,
    rx: -sa,
    ry: ca,
  };
}

export interface Tela {
  ctx: CanvasRenderingContext2D;
  imagem: ImageData;
  pontos: Uint32Array;
  /** O céu da corrida: uma faixa de 4 telas de largura e HORIZONTE linhas. */
  ceu: Uint32Array;
  ceuW: number;
  ceuH: number;
  topo: number;
  arvore: HTMLCanvasElement;
  flor: HTMLCanvasElement;
}

/** O CENÁRIO de cada desafio (19/11/2026): os temas das pistas da corrida (o céu, os morros, a árvore e as cores do chão). */
const PISTA_DO_TEMA: Record<Desafio['tema'], DefinicaoDaPista> = { horta: HORTA, neve: NEVE, canion: CANION };

/** As roças (dois tons cada), a cerca viva, o rio e a margem, e o chão de fora do mapa, por tema. */
const CORES_DO_CHAO: Record<Desafio['tema'], { rocas: [number, number][]; cerca: number; agua: [number, number]; margem: number; fora: [number, number]; estrada: [number, number] }> = {
  horta: {
    rocas: [
      [rgb(98, 150, 70), rgb(90, 140, 64)],
      [rgb(122, 160, 74), rgb(112, 150, 68)],
      [rgb(176, 160, 92), rgb(164, 148, 84)],
      [rgb(84, 132, 66), rgb(76, 122, 58)],
      [rgb(150, 112, 74), rgb(138, 102, 66)],
      [rgb(136, 170, 88), rgb(126, 160, 80)],
    ],
    cerca: rgb(70, 108, 56),
    agua: [rgb(70, 128, 168), rgb(84, 144, 182)],
    margem: rgb(196, 182, 140),
    fora: [rgb(76, 122, 56), rgb(118, 150, 72)],
    estrada: [rgb(138, 104, 70), rgb(170, 132, 90)],
  },
  neve: {
    rocas: [
      [rgb(232, 236, 244), rgb(222, 228, 238)],
      [rgb(244, 246, 250), rgb(236, 240, 246)],
      [rgb(210, 218, 232), rgb(200, 208, 224)],
      [rgb(226, 232, 242), rgb(216, 224, 236)],
      [rgb(190, 200, 218), rgb(182, 192, 212)],
      [rgb(238, 242, 248), rgb(230, 234, 244)],
    ],
    cerca: rgb(150, 164, 190),
    agua: [rgb(150, 190, 220), rgb(170, 206, 230)],
    margem: rgb(200, 210, 226),
    fora: [rgb(214, 220, 236), rgb(190, 198, 220)],
    estrada: [rgb(150, 156, 176), rgb(176, 182, 200)],
  },
  canion: {
    rocas: [
      [rgb(214, 150, 96), rgb(204, 140, 88)],
      [rgb(196, 122, 80), rgb(186, 114, 74)],
      [rgb(226, 178, 120), rgb(216, 168, 112)],
      [rgb(176, 104, 70), rgb(166, 96, 64)],
      [rgb(232, 196, 140), rgb(222, 186, 132)],
      [rgb(204, 134, 90), rgb(194, 126, 84)],
    ],
    cerca: rgb(150, 86, 60),
    agua: [rgb(70, 128, 150), rgb(86, 144, 164)],
    margem: rgb(232, 204, 150),
    fora: [rgb(196, 128, 84), rgb(214, 150, 96)],
    estrada: [rgb(150, 100, 70), rgb(186, 136, 96)],
  },
};

export function prepararTela(canvas: HTMLCanvasElement, tema: Desafio['tema'] = 'horta'): Tela {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  const imagem = ctx.createImageData(W, H);
  // o céu, as árvores e as flores são os da corrida (desenhados por código lá)
  const corrida = prepararDesenho(document.createElement('canvas'), (PISTA_DO_TEMA[tema] ?? HORTA).tema, true);
  const ceuH = 58;
  return {
    ctx,
    imagem,
    pontos: new Uint32Array(imagem.data.buffer),
    ceu: corrida.ceu,
    ceuW: corrida.ceu.length / ceuH,
    ceuH,
    topo: corrida.ceu[0],
    arvore: corrida.figuras.arvore,
    flor: corrida.figuras.flor,
  };
}

// =====================================================================================================================
// O CHÃO, pintado por código (um por desafio, guardado)
// =====================================================================================================================

export interface Chao {
  pontos: Uint32Array;
  arvores: [number, number][];
  nevoa: [number, number, number];
  fora: number;
  fora2: number;
}

const chaos = new Map<string, Chao>();

export function chaoDe(d: Desafio): Chao {
  const pronto = chaos.get(d.id);
  if (pronto) return pronto;
  const N = MUNDO;
  const px = new Uint32Array(N * N);
  const sorte = sorteio(d.id.length * 977 + 13);
  // a colcha de roças: quadros de 64 m, cada um de uma cor, com as fileiras do plantio (as cores do tema)
  const tc = CORES_DO_CHAO[d.tema] ?? CORES_DO_CHAO.horta;
  const rocas = tc.rocas;
  const Q = 64;
  const cores: number[] = [];
  for (let i = 0; i < (N / Q) * (N / Q); i++) cores.push(Math.floor(sorte() * rocas.length));
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const q = Math.floor(y / Q) * (N / Q) + Math.floor(x / Q);
      const par = cores[q] % 2 === 0;
      const faixa = ((par ? x : y) >> 2) & 1;
      let cor = rocas[cores[q]][faixa];
      // as cercas vivas entre as roças
      if (x % Q < 2 || y % Q < 2) cor = tc.cerca;
      px[y * N + x] = cor;
    }
  }
  // o rio, que serpenteia de norte a sul, com a margem de areia
  for (let y = 0; y < N; y++) {
    const meio = 250 + Math.sin(y / 97) * 60 + Math.sin(y / 31) * 12;
    for (let x = Math.floor(meio - 20); x <= meio + 20; x++) {
      if (x < 0 || x >= N) continue;
      const dx = Math.abs(x - meio);
      px[y * N + x] = dx < 14 ? (((x + y) >> 3) & 1 ? tc.agua[0] : tc.agua[1]) : tc.margem;
    }
  }
  // as estradinhas de terra
  const estrada = (horizontal: boolean, onde: number) => {
    for (let i = 0; i < N; i++) {
      for (let k = -3; k <= 3; k++) {
        const x = horizontal ? i : onde + k, y = horizontal ? onde + k : i;
        if (x < 0 || y < 0 || x >= N || y >= N) continue;
        px[y * N + x] = Math.abs(k) === 3 ? tc.estrada[0] : tc.estrada[1];
      }
    }
  };
  estrada(true, 192);
  estrada(true, 704);
  estrada(false, 832);
  // o alvo no chão: os círculos de 4 em 4 metros, o creme e o vermelho, e a mosca amarela
  const disco = (cx: number, cy: number, r: number, cor: (dist: number) => number) => {
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        if (x < 0 || y < 0 || x >= N || y >= N) continue;
        const dd = Math.sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2);
        if (dd <= r) px[y * N + x] = cor(dd);
      }
    }
  };
  if (d.tipo === 'mochila') {
    // a plataforma de largada e a sombra da do alto (ela é desenhada de pé, por cima)
    disco(d.x, d.y, 6, (r) => (r > 5 ? rgb(84, 80, 88) : Math.abs(r - 3) < 0.6 ? rgb(232, 200, 90) : rgb(150, 146, 152)));
    disco(d.alvo.x, d.alvo.y, d.alvo.raio + 2, () => rgb(60, 82, 50));
  } else {
    const r = d.escala;
    disco(d.alvo.x, d.alvo.y, r + 1.5, (dd) =>
      dd > r ? rgb(60, 52, 48) : dd < 1.5 ? rgb(246, 210, 90) : Math.floor(dd / 4) % 2 === 0 ? rgb(214, 88, 72) : rgb(244, 232, 210),
    );
  }
  // as árvores, longe do alvo e do rio
  const arvores: [number, number][] = [];
  for (let i = 0; i < 420; i++) {
    const x = sorte() * N, y = sorte() * N;
    const meio = 250 + Math.sin(y / 97) * 60 + Math.sin(y / 31) * 12;
    if (Math.abs(x - meio) < 26) continue;
    if (Math.hypot(x - d.alvo.x, y - d.alvo.y) < d.escala + 30 || Math.hypot(x - d.x, y - d.y) < 30) continue;
    if (Math.abs(y - 192) < 8 || Math.abs(y - 704) < 8 || Math.abs(x - 832) < 8) continue;
    arvores.push([x, y]);
  }
  const chao: Chao = { pontos: px, arvores, nevoa: (PISTA_DO_TEMA[d.tema] ?? HORTA).tema.ceu.baixo, fora: tc.fora[0], fora2: tc.fora[1] };
  chaos.set(d.id, chao);
  return chao;
}

function misturar(cor: number, t: number, n: [number, number, number]) {
  const r = cor & 0xff, g = (cor >> 8) & 0xff, b = (cor >> 16) & 0xff;
  return rgb(Math.round(r + (n[0] - r) * t), Math.round(g + (n[1] - g) * t), Math.round(b + (n[2] - b) * t));
}

/** O chão e o céu da câmera. */
export function desenharChao(t: Tela, chao: Chao, cam: Camera) {
  const { pontos, ceu, ceuW, ceuH } = t;
  const sp = -cam.fz, cp = cam.uz;
  const horizonte = C0 - (sp * FOCO) / cp;
  const desloc = Math.floor((((cam.ang / (Math.PI * 2)) * ceuW) % ceuW + ceuW) % ceuW);
  const tex = chao.pontos;
  const N = MUNDO;
  for (let py = 0; py < H; py++) {
    const linha = py * W;
    const oy = py + 0.5 - C0;
    // a direção do raio do meio da linha: F·FOCO − U·oy
    const dz = cam.fz * FOCO - cam.uz * oy;
    if (dz >= -0.02 * FOCO || py < horizonte) {
      // o céu: a faixa da corrida, pendurada no horizonte
      const ly = Math.floor(ceuH - (horizonte - py));
      if (ly < 0) pontos.fill(t.topo, linha, linha + W);
      else {
        const base = Math.min(ceuH - 1, ly) * ceuW;
        for (let x = 0; x < W; x++) pontos[linha + x] = ceu[base + ((x + desloc) % ceuW)];
      }
      continue;
    }
    const k = cam.h / -dz;
    const mx = cam.fx * FOCO - cam.ux * oy, my = cam.fy * FOCO - cam.uy * oy;
    let wx = cam.x + k * (mx - cam.rx * (W / 2)), wy = cam.y + k * (my - cam.ry * (W / 2));
    const sx = k * cam.rx, sy = k * cam.ry;
    // a névoa pela distância (em degraus, como as paletas de 16 bits)
    const dist = k * Math.sqrt(mx * mx + my * my + dz * dz);
    const nev = Math.min(2, Math.max(0, Math.floor((dist - 450) / 260)));
    for (let x = 0; x < W; x++) {
      const tx = wx | 0, ty = wy | 0;
      // fora do mundo, roças de longe (quadros de 64 m em dois verdes): o horizonte não vira parede
      let cor = tx >= 0 && ty >= 0 && tx < N && ty < N ? tex[ty * N + tx] : ((tx >> 6) + (ty >> 6)) & 1 ? chao.fora : chao.fora2;
      if (nev > 0) cor = misturar(cor, nev / 5, chao.nevoa);
      pontos[linha + x] = cor;
      wx += sx;
      wy += sy;
    }
  }
  t.ctx.putImageData(t.imagem, 0, 0);
}

export interface Ponto {
  sx: number;
  sy: number;
  /** Pontos da tela por metro, ali. */
  k: number;
  z: number;
}

export function projetar(cam: Camera, x: number, y: number, h: number): Ponto | null {
  const vx = x - cam.x, vy = y - cam.y, vz = h - cam.h;
  const z = vx * cam.fx + vy * cam.fy + vz * cam.fz;
  if (z < 0.8) return null;
  const lado = vx * cam.rx + vy * cam.ry;
  const cima = vx * cam.ux + vy * cam.uy + vz * cam.uz;
  const k = FOCO / z;
  return { sx: W / 2 + lado * k, sy: C0 - cima * k, k, z };
}

export interface Figura {
  z: number;
  desenhar: (ctx: CanvasRenderingContext2D) => void;
}

// =====================================================================================================================
// AS FIGURAS: árvores, anéis, a plataforma, os coelhos voando
// =====================================================================================================================

export function figurasDoChao(t: Tela, chao: Chao, cam: Camera): Figura[] {
  const lista: Figura[] = [];
  for (const [x, y] of chao.arvores) {
    const p = projetar(cam, x, y, 0);
    if (!p || p.z > 900) continue;
    const alto = 9 * p.k;
    if (alto < 1.5) continue;
    const larg = (alto * t.arvore.width) / t.arvore.height;
    if (p.sx + larg < 0 || p.sx - larg > W || p.sy - alto > H) continue;
    lista.push({ z: p.z, desenhar: (ctx) => ctx.drawImage(t.arvore, Math.round(p.sx - larg / 2), Math.round(p.sy - alto), Math.round(larg), Math.round(alto)) });
  }
  return lista;
}

/** Os anéis que faltam: um círculo de pontos 3D (em pé, olhando o caminho; ou deitado, no salto). O próximo brilha. */
export function figurasDosAneis(cam: Camera, d: Desafio, pegos: number[], proximo: number, tempo: number): Figura[] {
  const lista: Figura[] = [];
  d.aneis.forEach((a, i) => {
    if (pegos[i] >= 0) return;
    const c = projetar(cam, a.x, a.y, a.h);
    if (!c) return;
    const pts: (Ponto | null)[] = [];
    const ax = a.deitado ? 1 : -a.ny, ay = a.deitado ? 0 : a.nx;
    for (let k = 0; k <= 24; k++) {
      const th = (k / 24) * Math.PI * 2;
      const cs = Math.cos(th) * a.raio, sn = Math.sin(th) * a.raio;
      pts.push(a.deitado ? projetar(cam, a.x + cs, a.y + sn, a.h) : projetar(cam, a.x + ax * cs, a.y + ay * cs, a.h + sn));
    }
    const brilha = i === proximo;
    lista.push({
      z: c.z,
      desenhar: (ctx) => {
        const grosso = Math.max(1, 0.9 * c.k);
        for (const [cor, larg] of [
          ['#3a2a14', grosso + 2],
          [brilha ? (Math.floor(tempo * 6) % 2 ? '#fff1a8' : '#f6c94a') : '#d9a43a', grosso],
        ] as const) {
          ctx.strokeStyle = cor;
          ctx.lineWidth = larg;
          ctx.beginPath();
          let aberto = false;
          for (const p of pts) {
            if (!p) {
              aberto = false;
              continue;
            }
            if (!aberto) ctx.moveTo(p.sx, p.sy);
            else ctx.lineTo(p.sx, p.sy);
            aberto = true;
          }
          ctx.stroke();
        }
      },
    });
  });
  return lista;
}

/**
 * AS TÉRMICAS (19/11/2026): o ar que sobe, desenhado como fiapos claros subindo em espiral dentro da coluna (só desenho; a
 * conta é a de sim.ts). Com "menos movimento", parados.
 */
export function figurasDasTermicas(cam: Camera, d: Desafio, tempo: number, calmo: boolean): Figura[] {
  const lista: Figura[] = [];
  d.termicas.forEach((t, i) => {
    for (let k = 0; k < 14; k++) {
      const fase = (k * 0.618 + i * 0.3) % 1;
      const sobe = calmo ? fase : (fase + tempo * 0.12) % 1;
      const ang = k * 2.39 + (calmo ? 0 : tempo * 0.8);
      const r = t.raio * (0.25 + 0.6 * ((k * 0.37) % 1));
      const p = projetar(cam, t.x + Math.cos(ang) * r, t.y + Math.sin(ang) * r, 4 + sobe * 110);
      if (!p || p.z > 700) continue;
      const tam = Math.max(1, Math.min(4, p.k * 1.4));
      const alfa = 0.55 * Math.sin(sobe * Math.PI);
      lista.push({
        z: p.z,
        desenhar: (ctx) => {
          ctx.fillStyle = `rgba(255, 252, 236, ${alfa.toFixed(2)})`;
          ctx.fillRect(Math.round(p.sx - tam / 2), Math.round(p.sy - tam * 1.5), Math.max(1, Math.round(tam)), Math.max(2, Math.round(tam * 3)));
        },
      });
    }
  });
  return lista;
}

/** A plataforma da mochila: uma torre redonda de pedra com o topo marcado. */

export function figuraDaPlataforma(cam: Camera, d: Desafio): Figura | null {
  if (d.tipo !== 'mochila') return null;
  const { x, y, h, raio } = d.alvo;
  const c = projetar(cam, x, y, h);
  if (!c) return null;
  const n = 20;
  const topo: (Ponto | null)[] = [], pe: (Ponto | null)[] = [];
  for (let i = 0; i < n; i++) {
    const th = (i / n) * Math.PI * 2;
    topo.push(projetar(cam, x + Math.cos(th) * raio, y + Math.sin(th) * raio, h));
    pe.push(projetar(cam, x + Math.cos(th) * raio, y + Math.sin(th) * raio, 0));
  }
  return {
    z: c.z,
    desenhar: (ctx) => {
      // as faces do lado, das de trás para as da frente
      const faces = [...Array(n).keys()]
        .map((i) => ({ i, z: (topo[i]?.z ?? 0) + (topo[(i + 1) % n]?.z ?? 0) }))
        .sort((a, b) => b.z - a.z);
      for (const { i } of faces) {
        const a = topo[i], b = topo[(i + 1) % n], c2 = pe[(i + 1) % n], e = pe[i];
        if (!a || !b || !c2 || !e) continue;
        ctx.fillStyle = i % 2 ? '#8a8290' : '#7a7280';
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.lineTo(c2.sx, c2.sy);
        ctx.lineTo(e.sx, e.sy);
        ctx.fill();
      }
      if (topo.some((p) => !p)) return;
      ctx.fillStyle = '#b8b0bc';
      ctx.beginPath();
      topo.forEach((p, i) => (i ? ctx.lineTo(p!.sx, p!.sy) : ctx.moveTo(p!.sx, p!.sy)));
      ctx.fill();
      // o círculo amarelo do pouso e a mosca
      for (const [r, cor] of [
        [raio * 0.6, '#e8c85a'],
        [raio * 0.45, '#b8b0bc'],
        [raio * 0.15, '#d65848'],
      ] as const) {
        ctx.fillStyle = cor;
        ctx.beginPath();
        for (let i = 0; i <= n; i++) {
          const th = (i / n) * Math.PI * 2;
          const p = projetar(cam, x + Math.cos(th) * r, y + Math.sin(th) * r, h);
          if (!p) continue;
          if (i) ctx.lineTo(p.sx, p.sy);
          else ctx.moveTo(p.sx, p.sy);
        }
        ctx.fill();
      }
    },
  };
}

/** O coelho de costas, desenhado por código (cada letra uma cor; P e p o pelo, R e r a roupa). 10 × 14. */
const COELHO = [
  '.kk....kk.',
  'kPPk..kPPk',
  'kPik..kiPk',
  'kPik..kiPk',
  '.kPkkkkPk.',
  '.kPPPPPPk.',
  'kPPPPPPPpk',
  'kpPPPPPppk',
  '.kRRRRRRk.',
  'kRRRRRRrRk',
  'kRrRRRRrRk',
  'kRrRRRRrRk',
  '.kRRrrRRk.',
  '.kpk..kpk.',
];
const coelhos = new Map<string, HTMLCanvasElement>();
function coelhoDe(avatar: AvatarDoJogo): HTMLCanvasElement {
  const chave = String(avatar ?? '');
  const pronto = coelhos.get(chave);
  if (pronto) return pronto;
  const cores = coresDoJogador(avatar);
  const pelo = cores?.pelo ?? [236, 226, 232], roupa = cores?.roupa ?? [92, 66, 82];
  const css = (c: number[], f: number) => `rgb(${Math.round(c[0] * f)},${Math.round(c[1] * f)},${Math.round(c[2] * f)})`;
  const mapa: Record<string, string> = { k: '#2a1e26', P: css(pelo, 1), p: css(pelo, 0.8), i: '#e8a0b4', R: css(roupa, 1), r: css(roupa, 0.75) };
  const c = document.createElement('canvas');
  c.width = COELHO[0].length;
  c.height = COELHO.length;
  const g = c.getContext('2d')!;
  COELHO.forEach((linha, y) =>
    [...linha].forEach((ch, x) => {
      if (!mapa[ch]) return;
      g.fillStyle = mapa[ch];
      g.fillRect(x, y, 1, 1);
    }),
  );
  coelhos.set(chave, c);
  return c;
}

export interface Voador {
  x: number;
  y: number;
  h: number;
  hx: number;
  hy: number;
  inclina: number;
  aberto: boolean;
  jato: number;
  tipo: Desafio['tipo'];
  avatar: AvatarDoJogo;
  fantasma?: boolean;
  nome?: string;
}

/** Um coelho voando: a sombra no chão, e a asa, a mochila ou o paraquedas com ele. */
export function figuraDoVoador(cam: Camera, f: Voador, tempo: number): Figura[] {
  const p = projetar(cam, f.x, f.y, f.h);
  if (!p) return [];
  const lista: Figura[] = [];
  // a sombra no chão (só perto dele: de longe ela some)
  const s = projetar(cam, f.x, f.y, 0);
  if (s && f.h < 120) {
    const r = Math.max(1, 1.2 * s.k);
    lista.push({
      z: s.z + 1000,
      desenhar: (ctx) => {
        ctx.fillStyle = 'rgba(26,20,32,0.3)';
        ctx.beginPath();
        ctx.ellipse(s.sx, s.sy, r * 1.4, r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();
      },
    });
  }
  const lx = -f.hy, ly = f.hx;
  const ponto = (frente: number, lado: number, cima: number) =>
    projetar(cam, f.x + f.hx * frente + lx * lado, f.y + f.hy * frente + ly * lado, f.h + cima);
  const img = coelhoDe(f.avatar);
  lista.push({
    z: p.z,
    desenhar: (ctx) => {
      if (f.fantasma) ctx.globalAlpha = 0.5;
      const poligono = (pts: (Ponto | null)[], cor: string) => {
        if (pts.some((q) => !q)) return;
        ctx.fillStyle = cor;
        ctx.beginPath();
        pts.forEach((q, i) => (i ? ctx.lineTo(q!.sx, q!.sy) : ctx.moveTo(q!.sx, q!.sy)));
        ctx.closePath();
        ctx.fill();
      };
      const alto = 1.3 * p.k;
      const larg = (alto * img.width) / img.height;
      const cx = p.sx, pe = p.sy;
      if (f.tipo === 'asa') {
        // a asa-delta: o nariz na frente, as pontas inclinadas pela curva, listras creme e laranja
        const inc = f.inclina * 1.3;
        const nariz = ponto(1.8, 0, 2.2), esq = ponto(-0.9, -4.6, 1.6 - inc), dir = ponto(-0.9, 4.6, 1.6 + inc), meio = ponto(-0.3, 0, 1.9);
        poligono([nariz, esq, meio], '#e8834a');
        poligono([nariz, meio, dir], '#f2e2c4');
        const me = ponto(-0.6, -2.3, 1.75 - inc / 2), md = ponto(-0.6, 2.3, 1.75 + inc / 2);
        poligono([nariz, me, meio], '#f2e2c4');
        poligono([nariz, meio, md], '#e8834a');
        if (nariz && meio) {
          ctx.strokeStyle = '#3a2a24';
          ctx.lineWidth = Math.max(1, 0.12 * p.k);
          ctx.beginPath();
          ctx.moveTo(meio.sx, meio.sy);
          ctx.lineTo(cx, pe - alto * 0.7);
          ctx.stroke();
        }
      }
      if (f.tipo === 'queda' && f.aberto) {
        // o paraquedas: a cúpula de gomos em cima, as cordas até o coelho
        const gomos: (Ponto | null)[] = [];
        for (let i = 0; i <= 8; i++) {
          const a = (i / 8) * Math.PI;
          gomos.push(ponto(0, -Math.cos(a) * 4, 5 + Math.sin(a) * 1.4));
        }
        for (let i = 0; i < 8; i++) {
          const a = gomos[i], b = gomos[i + 1], base = ponto(0, -Math.cos(((i + 0.5) / 8) * Math.PI) * 3.6, 4.4);
          poligono([a, b, base], i % 2 ? '#f2e2c4' : '#d65848');
        }
        ctx.strokeStyle = 'rgba(58,42,36,0.8)';
        ctx.lineWidth = 1;
        for (const q of [gomos[0], gomos[4], gomos[8]]) {
          if (!q) continue;
          ctx.beginPath();
          ctx.moveTo(q.sx, q.sy);
          ctx.lineTo(cx, pe - alto * 0.8);
          ctx.stroke();
        }
      }
      if (f.tipo === 'mochila') {
        // a mochila nas costas, e o fogo embaixo quando o jato está ligado
        ctx.fillStyle = '#7a8290';
        ctx.fillRect(Math.round(cx - larg * 0.35), Math.round(pe - alto * 0.62), Math.max(2, Math.round(larg * 0.7)), Math.max(2, Math.round(alto * 0.4)));
        if (f.jato & 1) {
          const tremor = Math.floor(tempo * 30) % 2;
          ctx.fillStyle = '#f6b24a';
          const fl = alto * (0.35 + tremor * 0.15);
          for (const lado of [-0.22, 0.22]) {
            ctx.beginPath();
            ctx.moveTo(cx + larg * lado - larg * 0.12, pe - alto * 0.22);
            ctx.lineTo(cx + larg * lado + larg * 0.12, pe - alto * 0.22);
            ctx.lineTo(cx + larg * lado, pe - alto * 0.22 + fl);
            ctx.fill();
          }
          ctx.fillStyle = '#fff1a8';
          for (const lado of [-0.22, 0.22]) ctx.fillRect(Math.round(cx + larg * lado - 0.5), Math.round(pe - alto * 0.22), 1, Math.max(1, Math.round(fl * 0.5)));
        }
      }
      // o coelho (na queda livre, de braços abertos: um pouco mais largo)
      const abre = f.tipo === 'queda' && !f.aberto ? 1.25 : 1;
      if (alto >= 2) ctx.drawImage(img, Math.round(cx - (larg * abre) / 2), Math.round(pe - alto), Math.max(1, Math.round(larg * abre)), Math.max(1, Math.round(alto)));
      else {
        ctx.fillStyle = '#f2e2c4';
        ctx.fillRect(Math.round(cx) - 1, Math.round(pe) - 2, 2, 2);
      }
      ctx.globalAlpha = 1;
      if (f.nome && p.k > 3) {
        ctx.font = '7px sans-serif';
        ctx.textAlign = 'center';
        const ty = Math.round(pe - alto - (f.tipo === 'queda' && f.aberto ? 6.6 * p.k : f.tipo === 'asa' ? 1.4 * p.k : 2));
        ctx.fillStyle = '#1e1822';
        ctx.fillText(f.nome, Math.round(cx) + 1, ty + 1);
        ctx.fillStyle = '#fbf3e4';
        ctx.fillText(f.nome, Math.round(cx), ty);
      }
    },
  });
  return lista;
}

/** A seta no alto da tela: para onde fica o próximo anel (ou o alvo), em relação ao rumo da câmera. */
export function setaDoRumo(ctx: CanvasRenderingContext2D, cam: Camera, v: Voo, alvo: { x: number; y: number }) {
  const dx = alvo.x - v.x, dy = alvo.y - v.y;
  if (dx * dx + dy * dy < 36) return;
  const rel = Math.atan2(dy, dx) - cam.ang;
  const cx = W / 2, cy = 14;
  ctx.save();
  ctx.translate(cx, cy);
  // a seta desenhada aponta para a direita (+x); "em frente" é para cima na tela
  ctx.rotate(rel - Math.PI / 2);
  ctx.fillStyle = '#2a1e26';
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.lineTo(-5, -6);
  ctx.lineTo(-2, 0);
  ctx.lineTo(-5, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f6c94a';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-3.5, -4);
  ctx.lineTo(-1, 0);
  ctx.lineTo(-3.5, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// =====================================================================================================================
// A SEGUNDA AUDITORIA (20/11/2026): o anel do pouso e o mapa (só desenho; a conta é a de sim.ts)
// =====================================================================================================================

/** A cor do anel do pouso: verde (folga), amarelo (perto do limite) ou vermelho (assim, é batida). */
export type CorDoPouso = 'verde' | 'amarelo' | 'vermelho';
const CORES_DO_POUSO: Record<CorDoPouso, string> = { verde: '#7ed36a', amarelo: '#f6c94a', vermelho: '#e2574a' };

/**
 * Como o pouso sairia agora, pela descida e pela velocidade de lado contra os limites do desafio (`limiteVs`, `limiteVh`): a
 * mesma régua do toque em sim.ts. No salto, sem o paraquedas aberto é sempre vermelho.
 */
export function corDoPouso(v: Voo): CorDoPouso {
  const d = v.d;
  if (d.tipo === 'queda' && !v.aberto) return 'vermelho';
  const vs = Math.max(0, -v.vz);
  const vh = d.tipo === 'mochila' ? Math.sqrt(v.vx * v.vx + v.vy * v.vy) : v.v;
  const r = Math.max(vs / d.limiteVs, vh / d.limiteVh);
  return r >= 1 ? 'vermelho' : r >= 0.7 ? 'amarelo' : 'verde';
}

/** A altura do chão debaixo do voo: o topo da plataforma, se a mochila está em cima dela; senão o chão. */
export function chaoDebaixo(v: Voo): number {
  const a = v.d.alvo;
  if (v.d.tipo !== 'mochila') return 0;
  const dx = v.x - a.x, dy = v.y - a.y;
  return dx * dx + dy * dy < a.raio * a.raio ? a.h : 0;
}

/** O anel no chão debaixo do coelho, perto do pouso, na cor do pouso que sairia agora (pisca no vermelho). */
export function figuraDoPouso(cam: Camera, v: Voo, tempo: number, calmo: boolean): Figura | null {
  const h0 = chaoDebaixo(v);
  const c = projetar(cam, v.x, v.y, h0);
  if (!c) return null;
  const cor = corDoPouso(v);
  if (cor === 'vermelho' && !calmo && Math.floor(tempo * 6) % 2) return null;
  const n = 18;
  const pts: (Ponto | null)[] = [];
  for (let i = 0; i <= n; i++) {
    const th = (i / n) * Math.PI * 2;
    pts.push(projetar(cam, v.x + Math.cos(th) * 2.2, v.y + Math.sin(th) * 2.2, h0));
  }
  return {
    z: c.z + 0.5,
    desenhar: (ctx) => {
      for (const [tinta, larg] of [
        ['#2a1e26', 3],
        [CORES_DO_POUSO[cor], 1.5],
      ] as const) {
        ctx.strokeStyle = tinta;
        ctx.lineWidth = larg;
        ctx.beginPath();
        let aberto = false;
        for (const p of pts) {
          if (!p) {
            aberto = false;
            continue;
          }
          if (!aberto) ctx.moveTo(p.sx, p.sy);
          else ctx.lineTo(p.sx, p.sy);
          aberto = true;
        }
        ctx.stroke();
      }
    },
  };
}

/** O que o mapa mostra: o meu voo, o rumo de cada fantasma (o caminho inteiro) e onde ele está agora. */
export interface Mapa {
  eu: Voo | null;
  /** Os caminhos dos fantasmas, em pontos [x, y] (um a cada alguns passos), e a posição deles agora. */
  rumos: { caminho: [number, number][]; agora: { x: number; y: number } | null }[];
  /** Os anéis que ficaram para trás sem passar (piscam). */
  perdidos: Set<number>;
  /** O próximo anel (brilha). */
  proximo: number;
  tempo: number;
}

/**
 * O MAPA DO CANTO (20/11/2026): o desafio visto de cima, com o norte para cima. O alvo, os anéis (o próximo em amarelo; o
 * PERDIDO, que ficou para trás sem passar, piscando em vermelho; os pegos somem), a LINHA DE RUMO de cada fantasma (o caminho
 * inteiro dele, para ver por onde ele foi) e os pontos de agora.
 */
export function desenharMapa(ctx: CanvasRenderingContext2D, d: Desafio, m: Mapa) {
  const L = ctx.canvas.width;
  const A = ctx.canvas.height;
  ctx.clearRect(0, 0, L, A);
  // a caixa: o começo, os anéis, o alvo e os caminhos dos fantasmas
  let x0 = Math.min(d.x, d.alvo.x), x1 = Math.max(d.x, d.alvo.x), y0 = Math.min(d.y, d.alvo.y), y1 = Math.max(d.y, d.alvo.y);
  const caber = (x: number, y: number) => {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  };
  for (const a of d.aneis) caber(a.x, a.y);
  for (const r of m.rumos) for (const [x, y] of r.caminho) caber(x, y);
  const lado = Math.max(40, x1 - x0, y1 - y0) * 1.15;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const k = (L - 8) / lado;
  const px = (x: number) => L / 2 + (x - cx) * k;
  const py = (y: number) => A / 2 + (y - cy) * k;
  const dentro = (x: number, y: number) => ({ x: Math.max(3, Math.min(L - 3, px(x))), y: Math.max(3, Math.min(A - 3, py(y))) });

  ctx.fillStyle = 'rgba(42, 30, 38, 0.55)';
  ctx.fillRect(0, 0, L, A);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, L - 1, A - 1);

  // a linha de rumo dos fantasmas
  ctx.strokeStyle = 'rgba(220, 230, 255, 0.55)';
  ctx.lineWidth = 1;
  for (const r of m.rumos) {
    ctx.beginPath();
    r.caminho.forEach(([x, y], i) => (i ? ctx.lineTo(px(x), py(y)) : ctx.moveTo(px(x), py(y))));
    ctx.stroke();
  }
  // o alvo
  const al = dentro(d.alvo.x, d.alvo.y);
  ctx.fillStyle = '#d65848';
  ctx.beginPath();
  ctx.arc(al.x, al.y, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff3c4';
  ctx.beginPath();
  ctx.arc(al.x, al.y, 5, 0, Math.PI * 2);
  ctx.stroke();
  // os anéis
  const pisca = Math.floor(m.tempo * 4) % 2 === 0;
  d.aneis.forEach((a, i) => {
    if (m.eu && m.eu.aneis[i] >= 0) return;
    const p = dentro(a.x, a.y);
    const perdido = m.perdidos.has(i);
    if (perdido && !pisca) return;
    ctx.strokeStyle = perdido ? '#ff6b5a' : i === m.proximo ? '#f6c94a' : 'rgba(255, 243, 196, 0.7)';
    ctx.lineWidth = perdido || i === m.proximo ? 2 : 1;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
    ctx.stroke();
  });
  // os fantasmas agora
  ctx.fillStyle = 'rgba(220, 230, 255, 0.85)';
  for (const r of m.rumos) {
    if (!r.agora) continue;
    const p = dentro(r.agora.x, r.agora.y);
    ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 3, 3);
  }
  // eu: o ponto e o risco do rumo
  if (m.eu) {
    const p = dentro(m.eu.x, m.eu.y);
    ctx.strokeStyle = '#2a1e26';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + m.eu.hx * 7, p.y + m.eu.hy * 7);
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}
