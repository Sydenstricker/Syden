/**
 * AS PISTAS DOS COELHOS A JATO (05/11/2026): faixas suspensas no ar, desenhadas POR CÓDIGO como as da Corrida dos coelhos
 * (web/src/corrida/pista.ts, de onde a forma foi copiada e adaptada: lá é dono outro jogo). Tudo sai de UMA linha do meio
 * (Catmull-Rom fechada pelos pontos de controle): a distância até ela diz se o chão é pista, borda ou o vazio, e o quanto
 * se andou ao longo dela pinta as faixas de luz e conta as voltas.
 *
 * Fora da pista NÃO há chão: é o vazio (a cidade lá embaixo, o espaço, o mar de nuvens), desenhado num SEGUNDO plano, mais
 * fundo, pela câmera (render.ts). Na maior parte da volta, a BORDA DE ENERGIA segura a nave (e cobra energia); nos trechos
 * ABERTOS não há borda, e quem sai da pista cai.
 *
 * O id leva a versão ("cidade-1"): mudar o traçado é pista nova, e os recordes e fantasmas da antiga não se misturam.
 * O servidor tem as medidas de cada pista (server/src/jato.ts, PISTAS_DO_JATO); web/test/jato.test.ts confere que batem.
 */
import { sorteio } from './util';

export const MUNDO = 1024;
export const RES = 2048;
const K = RES / MUNDO;

/** O que é cada ponto do mapa (só para o desenho e o mapa pequeno: a física usa a linha do meio). */
export const Chao = { Pista: 0, Borda: 1, Vazio: 2, Placa: 3, Recarga: 4, Aviso: 5 } as const;
export type Chao = (typeof Chao)[keyof typeof Chao];

export type Fundo = 'cidade' | 'espaco' | 'nuvens';

export interface TemaDoJato {
  /** O céu, de cima para baixo, e o que fica lá embaixo, fora da pista. */
  ceu: { topo: [number, number, number]; meio: [number, number, number]; baixo: [number, number, number] };
  fundo: Fundo;
  /** As placas do piso (três tons), a costura entre elas e as faixas de luz que atravessam a pista. */
  piso: [number, number, number];
  costura: number;
  luz: number;
  /** A borda de energia: duas cores que se alternam. */
  borda: [number, number];
  /** A névoa de longe (a cor do horizonte). */
  nevoa: [number, number, number];
}

export interface DefinicaoDoJato {
  id: string;
  /** Os pontos de controle da linha do meio, no sentido da corrida. A linha de chegada fica no primeiro. */
  pontos: [number, number][];
  meiaLargura: number;
  voltas: number;
  /** As placas de impulso: [fração da volta, de que lado do meio (−1 a 1, em meias larguras)]. */
  placas: [number, number][];
  /** A faixa de recarga (no meio da pista): [começo, fim] em fração da volta. */
  recargas: [number, number][];
  /** Os trechos SEM borda (quem sai da pista cai): [começo, fim] em fração da volta. */
  abertos: [number, number][];
  semente: number;
  tema: TemaDoJato;
}

const rgb = (r: number, g: number, b: number) => (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;

/** A CIDADE À NOITE: a pista passa por cima das ruas acesas, com os prédios no horizonte. */
export const CIDADE: DefinicaoDoJato = {
  id: 'cidade-1',
  pontos: [
    [200, 190], [460, 140], [720, 150], [880, 260], [910, 470], [860, 680], [700, 720], [560, 640], [420, 720],
    [400, 880], [220, 900], [120, 700], [120, 420],
  ],
  meiaLargura: 38,
  voltas: 4,
  placas: [[0.14, -0.45], [0.36, 0.4], [0.72, 0], [0.88, -0.4]],
  recargas: [[0.025, 0.1]],
  abertos: [[0.19, 0.25]],
  semente: 3,
  tema: {
    ceu: { topo: [14, 12, 36], meio: [44, 30, 76], baixo: [118, 64, 104] },
    fundo: 'cidade',
    piso: [rgb(58, 60, 84), rgb(64, 66, 90), rgb(54, 56, 78)],
    costura: rgb(40, 40, 60),
    luz: rgb(120, 220, 255),
    borda: [rgb(90, 230, 255), rgb(255, 120, 210)],
    nevoa: [86, 52, 96],
  },
};

/** A ÓRBITA: no espaço, com as estrelas lá embaixo também, e o planeta no horizonte. */
export const ORBITA: DefinicaoDoJato = {
  id: 'orbita-1',
  pontos: [
    [170, 300], [360, 160], [620, 130], [850, 220], [910, 420], [800, 580], [860, 760], [720, 910], [470, 900],
    [330, 760], [180, 680], [110, 480],
  ],
  meiaLargura: 38,
  voltas: 4,
  placas: [[0.12, 0.4], [0.3, -0.4], [0.68, 0.4], [0.86, 0]],
  recargas: [[0.03, 0.1]],
  abertos: [[0.6, 0.66], [0.9, 0.95]],
  semente: 17,
  tema: {
    ceu: { topo: [6, 6, 18], meio: [16, 14, 40], baixo: [40, 30, 74] },
    fundo: 'espaco',
    piso: [rgb(70, 64, 96), rgb(76, 70, 102), rgb(64, 58, 90)],
    costura: rgb(44, 40, 66),
    luz: rgb(255, 200, 120),
    borda: [rgb(255, 196, 90), rgb(150, 120, 255)],
    nevoa: [34, 28, 64],
  },
};

/** O MAR DE NUVENS: o fim de tarde por cima das nuvens, uma volta mais curta e mais rápida. */
export const NUVENS: DefinicaoDoJato = {
  id: 'nuvens-1',
  pontos: [
    [240, 220], [500, 170], [740, 220], [850, 400], [760, 560], [780, 740], [600, 860], [360, 820], [220, 640],
    [160, 420],
  ],
  meiaLargura: 36,
  voltas: 5,
  placas: [[0.15, 0.4], [0.56, -0.4], [0.8, 0.3]],
  recargas: [[0.03, 0.11]],
  abertos: [[0.62, 0.68]],
  semente: 29,
  tema: {
    ceu: { topo: [70, 84, 160], meio: [214, 140, 160], baixo: [250, 200, 170] },
    fundo: 'nuvens',
    piso: [rgb(96, 92, 120), rgb(102, 98, 126), rgb(90, 86, 114)],
    costura: rgb(70, 66, 92),
    luz: rgb(255, 236, 170),
    borda: [rgb(255, 160, 110), rgb(120, 220, 255)],
    nevoa: [246, 196, 176],
  },
};

export const PISTAS_DO_JATO = [CIDADE, ORBITA, NUVENS];
export const pistaDoJatoPorId = (id: string) => PISTAS_DO_JATO.find((p) => p.id === id) ?? CIDADE;

export interface PistaDoJato {
  def: DefinicaoDoJato;
  lx: Float32Array;
  ly: Float32Array;
  /** O comprimento acumulado até cada ponto (la[n] é a volta inteira). */
  la: Float32Array;
  comprimento: number;
  /** A curvatura de cada ponto (1/raio), olhando um pouco à frente: o piloto automático e os robôs freiam por ela. */
  curva: Float32Array;
  /** Cada ponto: está num trecho aberto (sem borda)? */
  aberto: Uint8Array;
  chao: Uint8Array;
  textura: Uint32Array;
  /** Os postes da borda de energia, para o desenho (de pé, dos dois lados). */
  postes: { x: number; y: number }[];
  /** De onde se larga: 100 unidades antes da linha, no meio, olhando o sentido da corrida. */
  largada: { x: number; y: number; angulo: number; indice: number };
}

/** Catmull-Rom fechada: `porTrecho` pontos entre cada par de pontos de controle. */
function linhaDoMeio(pontos: [number, number][], porTrecho: number) {
  const n = pontos.length;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = pontos[(i - 1 + n) % n], p1 = pontos[i], p2 = pontos[(i + 1) % n], p3 = pontos[(i + 2) % n];
    for (let k = 0; k < porTrecho; k++) {
      const t = k / porTrecho, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      xs.push(f(p0[0], p1[0], p2[0], p3[0]));
      ys.push(f(p0[1], p1[1], p2[1], p3[1]));
    }
  }
  return { xs, ys };
}

/** Só a linha do meio, sem o chão nem a textura (o mapa da escolha, os marcos do servidor). */
export function linhaDoJato(def: Pick<DefinicaoDoJato, 'pontos'>) {
  const { xs, ys } = linhaDoMeio(def.pontos, 24);
  const n = xs.length;
  const lx = Float32Array.from(xs), ly = Float32Array.from(ys);
  const la = new Float32Array(n + 1);
  for (let i = 0; i < n; i++) la[i + 1] = la[i] + Math.hypot(lx[(i + 1) % n] - lx[i], ly[(i + 1) % n] - ly[i]);
  return { lx, ly, la, comprimento: la[n] };
}

/** O ponto da linha do meio a `s` unidades da linha de chegada (dá a volta). */
export function pontoNaLinha(l: { lx: Float32Array; ly: Float32Array; la: Float32Array; comprimento: number }, s: number) {
  const n = l.lx.length;
  const sv = ((s % l.comprimento) + l.comprimento) % l.comprimento;
  let lo = 0, hi = n - 1;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (l.la[m] <= sv) lo = m;
    else hi = m - 1;
  }
  const a = lo, b = (lo + 1) % n;
  const seg = l.la[lo + 1] - l.la[lo] || 1;
  const t = (sv - l.la[lo]) / seg;
  const dx = l.lx[b] - l.lx[a], dy = l.ly[b] - l.ly[a], len = Math.hypot(dx, dy) || 1;
  return { x: l.lx[a] + dx * t, y: l.ly[a] + dy * t, dx: dx / len, dy: dy / len, indice: a };
}

/** Os marcos da volta: `quantos` pontos igualmente espaçados da linha do meio (o servidor exige passar por todos, em ordem). */
export function marcosDoJato(def: Pick<DefinicaoDoJato, 'pontos'>, quantos: number): [number, number][] {
  const l = linhaDoJato(def);
  const marcos: [number, number][] = [];
  for (let k = 1; k <= quantos; k++) {
    const q = pontoNaLinha(l, (k / (quantos + 1)) * l.comprimento);
    marcos.push([q.x, q.y]);
  }
  return marcos;
}

/** Quanto antes da linha de chegada fica a largada (os robôs fazem a grade entre ela e a linha). */
export const RECUO_DA_LARGADA = 100;

/** A largada, sem montar a pista inteira (o servidor tem o mesmo ponto: server/src/jato.ts). */
export function largadaDoJato(def: Pick<DefinicaoDoJato, 'pontos'>) {
  const l = linhaDoJato(def);
  const q = pontoNaLinha(l, l.comprimento - RECUO_DA_LARGADA);
  return { x: q.x, y: q.y, angulo: Math.atan2(q.dy, q.dx), indice: q.indice };
}

const dentro = (f: number, trechos: [number, number][]) => trechos.some(([a, b]) => f >= a && f <= b);

export function montarPistaDoJato(def: DefinicaoDoJato = CIDADE): PistaDoJato {
  const { lx, ly, la, comprimento } = linhaDoJato(def);
  const n = lx.length;

  // A CURVATURA de cada ponto: o quanto a direção vira entre 6 pontos antes e 6 depois, pela distância entre eles
  const curva = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i - 6 + n) % n, b = (i + 6) % n;
    const d1x = lx[i] - lx[a], d1y = ly[i] - ly[a], d2x = lx[b] - lx[i], d2y = ly[b] - ly[i];
    const ang = Math.abs(Math.atan2(d1x * d2y - d1y * d2x, d1x * d2x + d1y * d2y));
    const dist = Math.hypot(d1x, d1y) + Math.hypot(d2x, d2y);
    curva[i] = ang / (dist / 2 || 1);
  }
  const aberto = new Uint8Array(n);
  for (let i = 0; i < n; i++) aberto[i] = dentro(la[i] / comprimento, def.abertos) ? 1 : 0;

  // A DISTÂNCIA até a linha do meio e o quanto se andou nela, ponto a ponto (cada trecho pinta só a caixa em volta dele)
  const hw = def.meiaLargura;
  const MAX = hw + 12;
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
          // de que lado do meio: o mesmo sinal da física (a normal é (−dy, dx))
          lado[k] = (-(px - ax) * dy + (py - ay) * dx) / seg;
        }
      }
    }
  }

  const T = def.tema;
  const chao = new Uint8Array(RES * RES).fill(Chao.Vazio);
  const textura = new Uint32Array(RES * RES);
  const BORDA = 3;
  for (let k = 0; k < RES * RES; k++) {
    if (dist[k] > (hw + BORDA + 1) * (hw + BORDA + 1)) continue;
    const tx = k % RES, ty = (k / RES) | 0;
    const d = Math.sqrt(dist[k]);
    const s = ao[k];
    const f = s / comprimento;
    const ab = dentro(f, def.abertos);
    let tipo: Chao, cor: number;
    if (d < hw) {
      tipo = Chao.Pista;
      // as placas do piso, 16 × 16 unidades ao longo da pista, com a costura escura entre elas
      const u = s % 16, v = (lado[k] + 64) % 16;
      const placa = ((Math.floor(s / 16) + Math.floor((lado[k] + 64) / 16)) & 1) + (((tx * 7 + ty * 13) >> 4) & 1);
      cor = u < 0.6 || v < 0.6 ? T.costura : T.piso[placa % 3];
      // AS FAIXAS DE LUZ que atravessam a pista a cada 48 unidades: é o que faz a velocidade se ver
      if (s % 48 < 1.6) cor = T.luz;
      // as linhas das três faixas, tracejadas
      if (Math.abs(Math.abs(lado[k]) - hw / 3) < 0.5 && Math.floor(s / 12) % 2 === 0) cor = rgb(200, 204, 230);
      // perto da borda aberta, o aviso: as listras amarelas e pretas na beirada
      if (ab && d > hw - 5) {
        tipo = Chao.Aviso;
        cor = Math.floor((s + lado[k]) / 4) % 2 === 0 ? rgb(250, 200, 60) : rgb(30, 26, 34);
      }
      // a recarga: a faixa do meio, cor-de-rosa, com as cruzes que brilham
      if (dentro(f, def.recargas) && Math.abs(lado[k]) < hw * 0.4) {
        tipo = Chao.Recarga;
        const cx = s % 14, cy = (lado[k] + 64) % 14;
        cor = (Math.abs(cx - 7) < 1 && Math.abs(cy - 7) < 4) || (Math.abs(cy - 7) < 1 && Math.abs(cx - 7) < 4) ? rgb(255, 236, 250) : (Math.floor(s / 7) & 1 ? rgb(232, 96, 168) : rgb(206, 74, 148));
      }
      // as placas de impulso: chevrons amarelos apontando para a frente
      for (const [pf, pl] of def.placas) {
        const ds = s - pf * comprimento, dl = lado[k] - pl * hw;
        if (ds >= 0 && ds < 22 && Math.abs(dl) < 11) {
          tipo = Chao.Placa;
          const uu = ds % 8;
          cor = Math.abs(uu - 4 - Math.abs(dl) * 0.45) < 1.4 ? rgb(255, 236, 120) : rgb(200, 110, 30);
        }
      }
      // a linha de chegada: quadriculada de lado a lado
      if (s < 6 || s > comprimento - 1) cor = ((Math.floor(s / 3) + Math.floor((lado[k] + 64) / 3)) & 1) ? rgb(240, 236, 246) : rgb(26, 22, 34);
    } else if (!ab) {
      // a borda de energia, nos dois tons que se alternam
      tipo = Chao.Borda;
      cor = Math.floor(s / 10) % 2 === 0 ? T.borda[0] : T.borda[1];
      if (d > hw + BORDA - 1) cor = rgb(30, 26, 40);
    } else continue;
    chao[k] = tipo;
    textura[k] = cor;
  }

  // os postes da borda: um a cada 40 unidades, dos dois lados, só onde há borda
  const postes: { x: number; y: number }[] = [];
  for (let s = 20; s < comprimento; s += 40) {
    if (dentro(s / comprimento, def.abertos)) continue;
    const q = pontoNaLinha({ lx, ly, la, comprimento }, s);
    for (const l of [-1, 1]) postes.push({ x: q.x - q.dy * (hw + 2) * l, y: q.y + q.dx * (hw + 2) * l });
  }

  return { def, lx, ly, la, comprimento, curva, aberto, chao, textura, postes, largada: largadaDoJato(def) };
}

/** O chão do mapa num ponto do mundo (fora do mapa é o vazio). */
export function chaoEm(p: PistaDoJato, x: number, y: number): Chao {
  const tx = Math.floor(x * K), ty = Math.floor(y * K);
  if (tx < 0 || ty < 0 || tx >= RES || ty >= RES) return Chao.Vazio;
  return p.chao[ty * RES + tx] as Chao;
}

/** O ponto da linha do meio mais perto, procurando perto do último (a nave não pula de um lado da pista ao outro). */
export function pontoMaisPerto(p: { lx: Float32Array; ly: Float32Array }, x: number, y: number, ultimo: number, janela = 16): number {
  const n = p.lx.length;
  let melhor = ultimo, md = Infinity;
  for (let k = -janela; k <= janela; k++) {
    const i = (((ultimo + k) % n) + n) % n;
    const d = (p.lx[i] - x) ** 2 + (p.ly[i] - y) ** 2;
    if (d < md) {
      md = d;
      melhor = i;
    }
  }
  return melhor;
}

/** Onde está um ponto em relação à linha do meio, perto do ponto `i`: o quanto se andou (s), o lado e a direção ali. */
export function naLinha(p: PistaDoJato, x: number, y: number, i: number) {
  const n = p.lx.length;
  // o trecho que começa em i, ou o que termina nele: o que tiver a projeção dentro
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
  return { s: p.la[q.a] + q.l * t, lado: -(x - px) * q.dy + (y - py) * q.dx, dx: q.dx, dy: q.dy, aberto: p.aberto[q.a] === 1 };
}

export { sorteio };
