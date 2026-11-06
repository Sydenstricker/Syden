/**
 * AS PISTAS DA REGATA DA TOCA (05/11/2026): o lago da horta, o riacho e o mangue, desenhados POR CÓDIGO como as da Corrida
 * dos coelhos e dos Coelhos a jato (de onde a forma foi copiada: a linha do meio é uma Catmull-Rom fechada, e a distância
 * até ela diz o que é cada ponto do mapa). A linha do meio, os marcos e a largada vêm prontos de jato/pista.ts (só leitura).
 *
 * Aqui a pista é ÁGUA, e a beira é a MARGEM: barranco de terra, juncos, pedras, árvores. No lago, o lado de fora da volta é
 * lago aberto, e o que segura o barco é a CORDA DE BOIAS (o mesmo efeito da margem, outro desenho). A água não fica pintada na
 * textura: o mapa guarda só a PROFUNDIDADE de cada ponto (e se ali corre a correnteza), e o desenho (render.ts) pinta as
 * ondas a cada quadro, mexendo.
 *
 * O id leva a versão ("lago-1"): mudar o traçado é pista nova, e os recordes e fantasmas da antiga não se misturam.
 * O servidor tem as medidas de cada pista (server/src/barco.ts, PISTAS_DO_BARCO); web/test/barco.test.ts confere que batem.
 */
import { linhaDoJato, pontoMaisPerto, pontoNaLinha, marcosDoJato } from '../jato/pista';
import { sorteio } from '../jato/util';

export { pontoMaisPerto, pontoNaLinha };

export const MUNDO = 1024;
export const RES = 2048;
const K = RES / MUNDO;

/** O que é cada ponto da água (no mapa `agua`): 0 é terra; 1 a 4 a profundidade (1 o fundo, 4 a beirinha). */
export const AGUA_FUNDA = 1;
export const AGUA_RASA = 4;
/** O bit da correnteza, junto da profundidade. */
export const CORRENTEZA = 0x10;
/** O bit do lago aberto (fora da volta, além da corda de boias). */
export const LAGO = 0x20;

export type Tipo = 'lago' | 'riacho' | 'mangue';

export interface TemaDoBarco {
  tipo: Tipo;
  ceu: { topo: [number, number, number]; baixo: [number, number, number] };
  /** Os morros e as árvores do horizonte. */
  morros: [number, number, number];
  mata: [number, number, number];
  /** A água: do fundo (escuro) à espuma, em cinco tons por profundidade (render.ts mistura). */
  agua: { funda: [number, number, number]; rasa: [number, number, number]; espuma: [number, number, number] };
  /** A terra: o barranco (perto da água) e o chão (grama, lama). */
  barranco: [number, number, number];
  chao: [[number, number, number], [number, number, number]];
  nevoa: [number, number, number];
}

export interface DefinicaoDoBarco {
  id: string;
  /** Os pontos de controle da linha do meio, no sentido da corrida. A linha de chegada fica no primeiro. */
  pontos: [number, number][];
  meiaLargura: number;
  voltas: number;
  /** As boias de turbo (argolas na água): [fração da volta, de que lado do meio (−1 a 1, em meias larguras)]. */
  boias: [number, number][];
  /** Os trechos de correnteza: [começo, fim, força]; força positiva empurra a favor da corrida, negativa contra. */
  correntezas: [number, number, number][];
  /** As pontes: a fração da volta em que cada uma atravessa. */
  pontes: number[];
  semente: number;
  tema: TemaDoBarco;
}

const rgb = (r: number, g: number, b: number) => (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;

/** O LAGO DA HORTA: largo, uma volta em torno da ilha da horta, com o lago aberto do lado de fora. */
export const LAGO_DA_HORTA: DefinicaoDoBarco = {
  id: 'lago-1',
  pontos: [
    [230, 250], [470, 175], [720, 200], [870, 360], [820, 540], [880, 740], [700, 870], [470, 820], [320, 700], [170, 580],
    [150, 400],
  ],
  meiaLargura: 52,
  voltas: 3,
  boias: [[0.15, -0.3], [0.42, 0.35], [0.66, -0.2], [0.88, 0.3]],
  correntezas: [],
  pontes: [],
  semente: 7,
  tema: {
    tipo: 'lago',
    ceu: { topo: [96, 160, 226], baixo: [200, 228, 244] },
    morros: [120, 160, 150],
    mata: [62, 112, 70],
    agua: { funda: [36, 92, 132], rasa: [86, 168, 186], espuma: [232, 246, 246] },
    barranco: [150, 112, 72],
    chao: [[104, 160, 74], [92, 146, 66]],
    nevoa: [190, 216, 226],
  },
};

/** O RIACHO: mais estreito, cheio de curvas, com correnteza que ajuda e que atrapalha, e duas pontes de madeira. */
export const RIACHO: DefinicaoDoBarco = {
  id: 'riacho-1',
  pontos: [
    [170, 210], [380, 130], [560, 230], [740, 140], [890, 260], [870, 450], [700, 520], [820, 690], [740, 880], [520, 880],
    [420, 720], [250, 830], [120, 660], [200, 470], [110, 340],
  ],
  meiaLargura: 40,
  voltas: 2,
  boias: [[0.1, 0.3], [0.37, -0.3], [0.6, 0.3], [0.84, -0.3]],
  correntezas: [[0.18, 0.3, 60], [0.46, 0.53, -32], [0.7, 0.8, 55]],
  pontes: [0.33, 0.9],
  semente: 23,
  tema: {
    tipo: 'riacho',
    ceu: { topo: [110, 170, 230], baixo: [222, 236, 236] },
    morros: [110, 140, 120],
    mata: [50, 98, 60],
    agua: { funda: [40, 96, 104], rasa: [96, 170, 160], espuma: [236, 248, 240] },
    barranco: [132, 100, 70],
    chao: [[88, 148, 66], [78, 134, 60]],
    nevoa: [200, 222, 220],
  },
};

/** O MANGUE: a água escura entre as raízes, o fim de tarde, a lama, e a passarela de tábuas. */
export const MANGUE: DefinicaoDoBarco = {
  id: 'mangue-1',
  pontos: [
    [200, 300], [400, 170], [640, 210], [840, 150], [900, 360], [750, 480], [880, 650], [820, 870], [600, 820], [430, 900],
    [250, 830], [300, 630], [140, 520],
  ],
  meiaLargura: 44,
  voltas: 2,
  boias: [[0.12, -0.3], [0.4, 0.3], [0.62, -0.3], [0.86, 0.25]],
  correntezas: [[0.26, 0.36, 45], [0.74, 0.8, -28]],
  pontes: [0.55],
  semente: 41,
  tema: {
    tipo: 'mangue',
    ceu: { topo: [92, 96, 150], baixo: [246, 184, 132] },
    morros: [96, 92, 104],
    mata: [44, 76, 52],
    agua: { funda: [44, 64, 52], rasa: [104, 112, 76], espuma: [214, 220, 190] },
    barranco: [96, 74, 56],
    chao: [[84, 70, 54], [74, 62, 48]],
    nevoa: [226, 170, 136],
  },
};

export const PISTAS_DO_BARCO = [LAGO_DA_HORTA, RIACHO, MANGUE];
export const pistaDoBarcoPorId = (id: string) => PISTAS_DO_BARCO.find((p) => p.id === id) ?? LAGO_DA_HORTA;

/** Só a linha do meio (o mapa da escolha, os marcos do servidor): a mesma conta dos Coelhos a jato. */
export const linhaDoBarco = (def: Pick<DefinicaoDoBarco, 'pontos'>) => linhaDoJato(def);
export const marcosDoBarco = (def: Pick<DefinicaoDoBarco, 'pontos'>, quantos: number) => marcosDoJato(def, quantos);

/** Quanto antes da linha de chegada fica a largada. */
export const RECUO_DA_LARGADA = 60;

/** A largada, sem montar a pista inteira (o servidor tem o mesmo ponto: server/src/barco.ts). */
export function largadaDoBarco(def: Pick<DefinicaoDoBarco, 'pontos'>) {
  const l = linhaDoJato(def);
  const q = pontoNaLinha(l, l.comprimento - RECUO_DA_LARGADA);
  return { x: q.x, y: q.y, angulo: Math.atan2(q.dy, q.dx), indice: q.indice };
}

/** As coisas de pé na beira (o desenho põe cada uma de frente para a câmera). */
export type Enfeite = 'junco' | 'pedra' | 'arvore' | 'arbusto' | 'mangue' | 'boia' | 'estaca' | 'flor' | 'couve';

export interface PistaDoBarco {
  def: DefinicaoDoBarco;
  lx: Float32Array;
  ly: Float32Array;
  la: Float32Array;
  comprimento: number;
  /** A curvatura de cada ponto (1/raio): o piloto automático freia por ela. */
  curva: Float32Array;
  /** A correnteza em cada ponto da linha do meio (unidades por segundo, ao longo da pista). */
  correnteza: Float32Array;
  /** A cor de cada ponto de terra; 0 na água. */
  textura: Uint32Array;
  /** A água de cada ponto (profundidade e bits: CORRENTEZA, LAGO); 0 na terra. */
  agua: Uint8Array;
  /** O quanto se andou na linha do meio, em cada ponto de água (×2), para a correnteza correr no desenho. */
  aoS: Uint16Array;
  enfeites: { x: number; y: number; tipo: Enfeite; tam: number }[];
  /** As boias de turbo, no mundo. */
  argolas: { x: number; y: number; angulo: number }[];
  /** As pontes: as duas cabeceiras e o rumo da pista ali. */
  pontes: { ax: number; ay: number; bx: number; by: number; dx: number; dy: number }[];
  largada: { x: number; y: number; angulo: number; indice: number };
}

const dentro = (f: number, a: number, b: number) => f >= a && f <= b;

/** A correnteza numa fração da volta, com a entrada e a saída suaves (2% da volta para cada lado). */
export function correntezaEm(def: DefinicaoDoBarco, f: number): number {
  let total = 0;
  for (const [a, b, forca] of def.correntezas) {
    const rampa = 0.02;
    if (f < a - rampa || f > b + rampa) continue;
    const t = f < a ? (f - (a - rampa)) / rampa : f > b ? (b + rampa - f) / rampa : 1;
    total += forca * t * t * (3 - 2 * t);
  }
  return total;
}

export function montarPistaDoBarco(def: DefinicaoDoBarco = LAGO_DA_HORTA): PistaDoBarco {
  const { lx, ly, la, comprimento } = linhaDoJato(def);
  const n = lx.length;

  const curva = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i - 6 + n) % n, b = (i + 6) % n;
    const d1x = lx[i] - lx[a], d1y = ly[i] - ly[a], d2x = lx[b] - lx[i], d2y = ly[b] - ly[i];
    const ang = Math.abs(Math.atan2(d1x * d2y - d1y * d2x, d1x * d2x + d1y * d2y));
    const dist = Math.hypot(d1x, d1y) + Math.hypot(d2x, d2y);
    curva[i] = ang / (dist / 2 || 1);
  }
  const correnteza = new Float32Array(n);
  for (let i = 0; i < n; i++) correnteza[i] = correntezaEm(def, la[i] / comprimento);

  // A DISTÂNCIA até a linha do meio e o quanto se andou nela, ponto a ponto (cada trecho pinta só a caixa em volta dele)
  const hw = def.meiaLargura;
  const MAX = hw + 34;
  const dist = new Float32Array(RES * RES).fill(1e9);
  const ao = new Float32Array(RES * RES);
  const lado = new Float32Array(RES * RES);
  for (let i = 0; i < n; i++) {
    const ax = lx[i], ay = ly[i], bx = lx[(i + 1) % n], by = ly[(i + 1) % n];
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1, seg = Math.sqrt(l2);
    const x0 = Math.max(0, Math.floor((Math.min(ax, bx) - MAX) * K)), x1 = Math.min(RES - 1, Math.ceil((Math.max(ax, bx) + MAX) * K));
    const y0 = Math.max(0, Math.floor((Math.min(ay, by) - MAX) * K)), y1 = Math.min(RES - 1, Math.ceil((Math.max(ay, by) + MAX) * K));
    for (let ty = y0; ty <= y1; ty++) {
      const py = (ty + 0.5) / K;
      for (let tx = x0; tx <= x1; tx++) {
        const px = (tx + 0.5) / K;
        let t = ((px - ax) * dx + (py - ay) * dy) / l2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = ax + t * dx - px, qy = ay + t * dy - py;
        const d = qx * qx + qy * qy;
        const k = ty * RES + tx;
        if (d < dist[k]) {
          dist[k] = d;
          ao[k] = la[i] + t * seg;
          lado[k] = (-(px - ax) * dy + (py - ay) * dx) / seg;
        }
      }
    }
  }

  // QUEM É DE FORA DA VOLTA: tudo o que não é água da pista e se alcança da borda do mapa (o resto é a ilha do meio)
  const fora = new Uint8Array(RES * RES);
  {
    const pilha: number[] = [];
    const agua2 = hw * hw;
    const pode = (k: number) => !fora[k] && dist[k] >= agua2;
    for (let i = 0; i < RES; i++) for (const k of [i, (RES - 1) * RES + i, i * RES, i * RES + RES - 1]) if (pode(k)) (fora[k] = 1), pilha.push(k);
    while (pilha.length) {
      const k = pilha.pop()!;
      const x = k % RES, y = (k / RES) | 0;
      if (x > 0 && pode(k - 1)) (fora[k - 1] = 1), pilha.push(k - 1);
      if (x < RES - 1 && pode(k + 1)) (fora[k + 1] = 1), pilha.push(k + 1);
      if (y > 0 && pode(k - RES)) (fora[k - RES] = 1), pilha.push(k - RES);
      if (y < RES - 1 && pode(k + RES)) (fora[k + RES] = 1), pilha.push(k + RES);
    }
  }

  const T = def.tema;
  const textura = new Uint32Array(RES * RES);
  const agua = new Uint8Array(RES * RES);
  const aoS = new Uint16Array(RES * RES);
  const lago = T.tipo === 'lago';
  const ruido = (x: number, y: number) => (((x * 73856093) ^ (y * 19349663)) >>> 9) & 7;
  /** A beira do lago aberto: uma forma redonda, torta, quase do tamanho do mapa. */
  const formaDoLago = (x: number, y: number) => {
    const dx = (x - 512) / 500, dy = (y - 512) / 500;
    const ang = Math.atan2(dy, dx);
    const r = 1 + Math.sin(ang * 3 + 1) * 0.05 + Math.sin(ang * 7) * 0.025;
    return dx * dx * dx * dx + dy * dy * dy * dy < r * r * r * r * 0.92;
  };
  // a forma, guardada numa grade de 2 em 2 unidades (a conta por ponto do mapa levava quase um segundo)
  const GRADE = 512;
  const gradeDoLago = new Uint8Array(lago ? GRADE * GRADE : 0);
  for (let y = 0; lago && y < GRADE; y++) for (let x = 0; x < GRADE; x++) gradeDoLago[y * GRADE + x] = formaDoLago(x * 2 + 1, y * 2 + 1) ? 1 : 0;
  const noLago = (x: number, y: number) => {
    const gx = Math.floor(x / 2), gy = Math.floor(y / 2);
    return gx >= 0 && gy >= 0 && gx < GRADE && gy < GRADE && gradeDoLago[gy * GRADE + gx] === 1;
  };
  // de que lado do meio fica o lado de fora da volta (o mesmo em toda a volta: a pista não se cruza)
  const sinalDeFora = (() => {
    const q = pontoNaLinha({ lx, ly, la, comprimento }, 0);
    const x = Math.floor((q.x - q.dy * (hw + 20)) * K), y = Math.floor((q.y + q.dx * (hw + 20)) * K);
    return fora[y * RES + x] ? 1 : -1;
  })();
  const [c1, c2] = T.chao;
  for (let k = 0; k < RES * RES; k++) {
    const tx = k % RES, ty = (k / RES) | 0;
    const wx = (tx + 0.5) / K, wy = (ty + 0.5) / K;
    const d = dist[k] < 1e8 ? Math.sqrt(dist[k]) : 1e9;
    const s = ao[k];
    if (d < hw) {
      // a água da pista: mais funda no meio, mais rasa perto da margem
      const prof = d < hw * 0.45 ? 1 : d < hw * 0.75 ? 2 : d < hw - 4 ? 3 : 4;
      let bits = prof;
      // no lago, a beira de fora (a corda de boias) não fica rasa: é o mesmo lago dos dois lados
      if (lago && prof >= 3 && Math.sign(lado[k]) === sinalDeFora) bits = 2 | LAGO;
      if (def.correntezas.length && Math.abs(correntezaEm(def, s / comprimento)) > 8) bits |= CORRENTEZA;
      agua[k] = bits;
      aoS[k] = Math.min(65535, Math.round(s * 2));
      continue;
    }
    if (lago && fora[k] && noLago(wx, wy)) {
      // o lago aberto: fundo, e raso só perto da beira de terra
      const beira = !noLago(wx + 10, wy) || !noLago(wx - 10, wy) || !noLago(wx, wy + 10) || !noLago(wx, wy - 10);
      agua[k] = (beira ? 4 : d < hw + 20 ? 2 : 1) | LAGO;
      aoS[k] = Math.min(65535, Math.round(s * 2));
      continue;
    }
    // A TERRA: o barranco perto da água, o chão em duas cores com pontinhos, e na ilha do lago os canteiros da horta
    const r = ruido(tx, ty);
    let cor = (Math.floor(wx / 7) + Math.floor(wy / 7)) & 1 ? rgb(...c1) : rgb(...c2);
    if (r === 0) cor = rgb(...(c1.map((v) => Math.min(255, v + 18)) as [number, number, number]));
    if (r === 1) cor = rgb(...(c2.map((v) => Math.max(0, v - 14)) as [number, number, number]));
    if (d < hw + 9) {
      const b = T.barranco;
      cor = d < hw + 3 ? rgb(...(b.map((v) => Math.round(v * 0.72)) as [number, number, number])) : r < 2 ? rgb(...(b.map((v) => Math.min(255, v + 16)) as [number, number, number])) : rgb(...b);
    } else if (lago && !fora[k] && d > hw + 22) {
      // os canteiros da horta, em fileiras, no meio da ilha
      const fileira = Math.floor(wy / 9);
      cor = wy % 9 < 4 ? (fileira % 3 === 0 ? rgb(70, 132, 56) : rgb(122, 86, 58)) : rgb(138, 100, 66);
      if (wy % 9 < 4 && (wx % 6) < 2 && fileira % 3 === 0) cor = rgb(232, 128, 48);
    } else if (T.tipo === 'mangue' && r < 2 && (Math.floor(wx / 3) + Math.floor(wy / 5)) % 7 === 0) {
      // as poças e os caranguejos da lama (pontinhos)
      cor = r === 0 && ((tx + ty) & 3) === 0 ? rgb(176, 72, 52) : rgb(62, 74, 62);
    } else if (T.tipo !== 'mangue' && r === 2 && ((tx * 31 + ty * 17) & 15) === 0) {
      cor = (tx & 1) ? rgb(250, 236, 140) : rgb(240, 240, 250);
    }
    textura[k] = cor;
  }

  // AS COISAS DE PÉ NA BEIRA: juncos na beirinha, pedras, árvores mais para trás (nunca dentro da água de outro trecho)
  const sorte = sorteio(def.semente);
  const enfeites: PistaDoBarco['enfeites'] = [];
  const naAgua = (x: number, y: number) => {
    const tx = Math.floor(x * K), ty = Math.floor(y * K);
    return tx < 0 || ty < 0 || tx >= RES || ty >= RES ? false : agua[ty * RES + tx] !== 0;
  };
  const longeDaAgua = (x: number, y: number, r: number) => !naAgua(x, y) && !naAgua(x + r, y) && !naAgua(x - r, y) && !naAgua(x, y + r) && !naAgua(x, y - r);
  const l = { lx, ly, la, comprimento };
  for (let s = 6; s < comprimento; s += 9) {
    const q = pontoNaLinha(l, s);
    for (const lado of [-1, 1]) {
      const sorteado = sorte();
      const longe = sorte();
      const em = (dl: number) => ({ x: q.x - q.dy * lado * dl, y: q.y + q.dx * lado * dl });
      if (lago && naAgua(em(hw + 6).x, em(hw + 6).y)) {
        // a corda de boias do lado do lago aberto
        if (Math.floor(s / 9) % 2 === 0) enfeites.push({ ...em(hw + 1.5), tipo: 'boia', tam: 1 });
        continue;
      }
      if (sorteado < (T.tipo === 'mangue' ? 0.35 : 0.55)) {
        const p = em(hw + 3 + longe * 4);
        if (!naAgua(p.x, p.y)) enfeites.push({ ...p, tipo: 'junco', tam: 0.8 + sorte() * 0.5 });
      } else if (sorteado < 0.62) {
        const p = em(hw + 4 + longe * 6);
        if (!naAgua(p.x, p.y)) enfeites.push({ ...p, tipo: 'pedra', tam: 0.7 + sorte() * 0.8 });
      } else if (sorteado < 0.7 && T.tipo === 'mangue') {
        const p = em(hw + 10 + longe * 12);
        if (longeDaAgua(p.x, p.y, 6)) enfeites.push({ ...p, tipo: 'mangue', tam: 0.9 + sorte() * 0.4 });
      }
      if (sorte() < (T.tipo === 'riacho' ? 0.2 : 0.12)) {
        const p = em(hw + 18 + sorte() * 30);
        const tipo: Enfeite = T.tipo === 'mangue' ? 'mangue' : sorte() < 0.6 ? 'arvore' : 'arbusto';
        if (longeDaAgua(p.x, p.y, 10)) enfeites.push({ ...p, tipo, tam: 0.85 + sorte() * 0.5 });
      }
    }
  }
  if (lago) {
    // na ilha: couves e flores nos canteiros, umas árvores na beira
    for (let i = 0; i < 260; i++) {
      const x = 150 + sorte() * 720, y = 150 + sorte() * 720;
      const tx = Math.floor(x * K), ty = Math.floor(y * K);
      if (fora[ty * RES + tx] || !longeDaAgua(x, y, 14)) continue;
      const d = Math.sqrt(dist[ty * RES + tx]);
      enfeites.push({ x, y, tipo: d < hw + 24 ? (sorte() < 0.5 ? 'arvore' : 'flor') : sorte() < 0.7 ? 'couve' : 'flor', tam: 0.8 + sorte() * 0.4 });
    }
  }

  const argolas = def.boias.map(([f, lado]) => {
    const q = pontoNaLinha(l, f * comprimento);
    return { x: q.x - q.dy * lado * hw, y: q.y + q.dx * lado * hw, angulo: Math.atan2(q.dy, q.dx) };
  });
  const pontes = def.pontes.map((f) => {
    const q = pontoNaLinha(l, f * comprimento);
    const m = hw + 8;
    return { ax: q.x + q.dy * m, ay: q.y - q.dx * m, bx: q.x - q.dy * m, by: q.y + q.dx * m, dx: q.dx, dy: q.dy };
  });
  // na ponte, as estacas: duas de cada lado, na beira
  for (const pt of pontes) for (const t of [0.04, 0.96]) enfeites.push({ x: pt.ax + (pt.bx - pt.ax) * t, y: pt.ay + (pt.by - pt.ay) * t, tipo: 'estaca', tam: 1 });

  return { def, lx, ly, la, comprimento, curva, correnteza, textura, agua, aoS, enfeites, argolas, pontes, largada: largadaDoBarco(def) };
}

/** Onde está um ponto em relação à linha do meio, perto do ponto `i`: o quanto se andou (s), o lado e a direção ali. */
export function naLinha(p: PistaDoBarco, x: number, y: number, i: number) {
  const n = p.lx.length;
  const trecho = (a: number) => {
    const b = (a + 1) % n;
    const dx = p.lx[b] - p.lx[a], dy = p.ly[b] - p.ly[a], l2 = dx * dx + dy * dy || 1, l = Math.sqrt(l2);
    const t = ((x - p.lx[a]) * dx + (y - p.ly[a]) * dy) / l2;
    return { a, t, dx: dx / l, dy: dy / l, l };
  };
  let q = trecho(i);
  if (q.t < 0) q = trecho((i - 1 + n) % n);
  const t = Math.max(0, Math.min(1, q.t));
  const px = p.lx[q.a] + q.dx * q.l * t, py = p.ly[q.a] + q.dy * q.l * t;
  return { s: p.la[q.a] + q.l * t, lado: -(x - px) * q.dy + (y - py) * q.dx, dx: q.dx, dy: q.dy, indice: q.a };
}

/** A água de um ponto do mundo (0 é terra). */
export function aguaEm(p: PistaDoBarco, x: number, y: number): number {
  const tx = Math.floor(x * K), ty = Math.floor(y * K);
  if (tx < 0 || ty < 0 || tx >= RES || ty >= RES) return 0;
  return p.agua[ty * RES + tx];
}
