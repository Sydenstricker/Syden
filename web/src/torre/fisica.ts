import { Bloco, blocoEm, corvoEm, COLUNAS, movelEm, quedaEm, T, type Torre } from './fases';

/**
 * A FÍSICA DA TORRE DO CELEIRO (05/11/2026): a do Pulo do coelho (web/src/plataforma/fisica.ts, de onde foi copiada), com
 * as mesmas medidas de corrida e pulo, virada para cima. O que muda:
 * - a torre não tem buraco: cair é só descer (e perder a subida); o chão de baixo segura;
 * - o que cai (ferramentas, sacos) e os corvos, num roteiro pelo PASSO: encostar volta ao último posto, piscando;
 * - o posto é o andar mais alto em que já se pisou, e a chegada é passar do assoalho do topo.
 * Como lá, o passo é FIXO (60 por segundo), os mesmos comandos dão sempre o mesmo resultado, e o TEMPO É O NÚMERO DE PASSOS.
 */

export const PASSO = 1 / 60;
export const VMAX = 110;
const ACEL_CHAO = 900;
const ACEL_AR = 620;
const ATRITO_CHAO = 1100;
const ATRITO_AR = 250;
const GRAVIDADE = 980;
export const VPULO = 310;
const VCORTE = 110;
export const VQUEDA = 430;
const COIOTE = 6;
const GUARDADO = 7;
export const ESPERA = 36;
export const MEIA = 5;
export const ALTO = 22;
export const AMOSTRA = 4;

export interface Comandos {
  esquerda: boolean;
  direita: boolean;
  pula: boolean;
}

export interface Coelho {
  x: number;
  y: number;
  vx: number;
  vy: number;
  noChao: boolean;
  sobre: number;
  coiote: number;
  guardado: number;
  pulaAntes: boolean;
  segurando: boolean;
  lado: number;
  andado: number;
  posto: number;
  espera: number;
  quedas: number;
  passos: number;
  terminou: boolean;
  chegouEm: number;
  /** Levou uma pancada neste passo (para o som e o desenho). */
  atingido: boolean;
}

export function novoCoelho(f: Torre): Coelho {
  return {
    x: f.largada.x, y: f.largada.y, vx: 0, vy: 0, noChao: true, sobre: -1, coiote: COIOTE, guardado: 0, pulaAntes: false,
    segurando: false, lado: 1, andado: 0, posto: 0, espera: 0, quedas: 0, passos: 0, terminou: false, chegouEm: 0, atingido: false,
  };
}

const solido = (b: Bloco) => b === Bloco.Viga || b === Bloco.Feno;

function bateEm(f: Torre, x0: number, y0: number, x1: number, y1: number): boolean {
  for (let c = Math.floor(x0 / T); c <= Math.floor((x1 - 0.001) / T); c++) {
    for (let l = Math.floor(y0 / T); l <= Math.floor((y1 - 0.001) / T); l++) if (solido(blocoEm(f, c, l))) return true;
  }
  return false;
}

/** Meia caixa do que cai e do corvo (o desenho é um pouco maior: raspar não fere). */
export const MEIA_QUEDA = 5;
export const MEIA_CORVO_X = 6;
export const MEIA_CORVO_Y = 4;

/** Alguma ferramenta caindo, ou um corvo, encosta no coelho no passo n? */
export function atingidoEm(f: Torre, k: { x: number; y: number }, n: number): boolean {
  const x0 = k.x - MEIA + 1, x1 = k.x + MEIA - 1, y0 = k.y - ALTO + 4, y1 = k.y - 1;
  for (const q of f.quedas) {
    if (Math.abs(q.x - k.x) > 20) continue;
    const p = quedaEm(q, n);
    if (!p || p.estado !== 'caindo') continue;
    if (x1 > q.x - MEIA_QUEDA && x0 < q.x + MEIA_QUEDA && y1 > p.y - MEIA_QUEDA && y0 < p.y + MEIA_QUEDA) return true;
  }
  for (const c of f.corvos) {
    if (Math.abs(c.y - k.y) > 40) continue;
    const p = corvoEm(c, n);
    if (x1 > p.x - MEIA_CORVO_X && x0 < p.x + MEIA_CORVO_X && y1 > p.y - MEIA_CORVO_Y && y0 < p.y + MEIA_CORVO_Y) return true;
  }
  return false;
}

function voltarAoPosto(k: Coelho, f: Torre) {
  const p = f.postos[k.posto];
  k.x = p.x;
  k.y = p.y;
  k.vx = 0;
  k.vy = 0;
  k.noChao = true;
  k.sobre = -1;
  k.segurando = false;
  k.espera = ESPERA;
  k.quedas++;
  k.atingido = true;
}

export function passo(k: Coelho, c: Comandos, f: Torre): void {
  const dt = PASSO;
  k.passos++;
  k.atingido = false;
  if (k.terminou) c = { esquerda: false, direita: false, pula: false };
  if (k.espera > 0) {
    k.espera--;
    k.pulaAntes = c.pula;
    return;
  }
  const n = k.passos;

  // EM CIMA DE UMA PLATAFORMA QUE ANDA: ela leva o coelho junto
  if (k.sobre >= 0) {
    const m = f.moveis[k.sobre];
    const a = movelEm(m, n - 1), b = movelEm(m, n);
    const nx = k.x + (b.x - a.x);
    if (!bateEm(f, nx - MEIA, k.y - ALTO, nx + MEIA, k.y)) k.x = nx;
    k.y = b.y;
  }

  const dir = (c.direita ? 1 : 0) - (c.esquerda ? 1 : 0);
  if (dir !== 0) {
    k.vx += dir * (k.noChao ? ACEL_CHAO : ACEL_AR) * dt;
    if (Math.abs(k.vx) > VMAX) k.vx = Math.sign(k.vx) * VMAX;
    k.lado = dir;
  } else {
    const atrito = (k.noChao ? ATRITO_CHAO : ATRITO_AR) * dt;
    k.vx -= Math.sign(k.vx) * Math.min(Math.abs(k.vx), atrito);
  }

  if (c.pula && !k.pulaAntes) k.guardado = GUARDADO;
  else if (k.guardado > 0) k.guardado--;
  k.pulaAntes = c.pula;
  if (k.noChao) k.coiote = COIOTE;
  else if (k.coiote > 0) k.coiote--;
  if (k.guardado > 0 && k.coiote > 0) {
    k.vy = -VPULO;
    k.segurando = true;
    k.guardado = 0;
    k.coiote = 0;
    k.noChao = false;
    k.sobre = -1;
  }
  if (k.segurando && !c.pula) {
    k.segurando = false;
    if (k.vy < -VCORTE) k.vy = -VCORTE;
  }
  if (k.vy >= 0) k.segurando = false;

  k.vy = Math.min(VQUEDA, k.vy + GRAVIDADE * dt);

  // ANDAR NO X, parando na parede (e nos fardos)
  const x0 = k.x;
  const nx = k.x + k.vx * dt;
  if (bateEm(f, nx - MEIA, k.y - ALTO, nx + MEIA, k.y - 0.01)) {
    if (k.vx > 0) k.x = Math.floor((nx + MEIA) / T) * T - MEIA - 0.01;
    else if (k.vx < 0) k.x = Math.ceil((nx - MEIA) / T) * T + MEIA + 0.01;
    if (bateEm(f, k.x - MEIA, k.y - ALTO, k.x + MEIA, k.y - 0.01)) k.x = x0;
    k.vx = 0;
  } else {
    k.x = nx;
  }
  k.x = Math.max(MEIA, Math.min(COLUNAS * T - MEIA, k.x));
  if (k.noChao) k.andado += Math.abs(k.x - x0);

  // ANDAR NO Y: a viga e o feno são maciços; a tábua e o que anda só seguram quem desce por cima
  const yAntes = k.y;
  let ny = k.y + k.vy * dt;
  k.noChao = false;
  const sobreAntes = k.sobre;
  k.sobre = -1;
  if (k.vy < 0) {
    if (bateEm(f, k.x - MEIA, ny - ALTO, k.x + MEIA, ny - ALTO + 1)) {
      ny = (Math.floor((ny - ALTO) / T) + 1) * T + ALTO;
      k.vy = 0;
      k.segurando = false;
    }
    k.y = ny;
  } else {
    let chao = Infinity;
    for (let col = Math.floor((k.x - MEIA) / T); col <= Math.floor((k.x + MEIA - 0.001) / T); col++) {
      for (let l = Math.floor(yAntes / T); l <= Math.floor(ny / T); l++) {
        const b = blocoEm(f, col, l);
        const topo = l * T;
        if (topo < yAntes - 0.01 && !solido(b)) continue;
        if (solido(b) || (b === Bloco.Tabua && topo >= yAntes - 0.01)) {
          if (topo >= yAntes - 0.01 && topo <= ny && topo < chao) chao = topo;
        }
      }
    }
    let sobre = -1;
    f.moveis.forEach((m, i) => {
      const p = movelEm(m, k.passos);
      const antes = i === sobreAntes ? p.y : movelEm(m, k.passos - 1).y;
      if (k.x + MEIA > p.x && k.x - MEIA < p.x + m.w && yAntes <= antes + 0.5 && ny >= p.y - 0.01 && p.y < chao) {
        chao = p.y;
        sobre = i;
      }
    });
    if (chao !== Infinity) {
      k.y = chao;
      k.vy = 0;
      k.noChao = true;
      k.sobre = sobre;
    } else {
      k.y = ny;
    }
  }

  // A CHEGADA: passou do assoalho do topo (subindo por ele, ou já em cima)
  if (!k.terminou && k.y <= f.chegada) {
    k.terminou = true;
    k.chegouEm = k.passos;
    return;
  }
  // O QUE CAI E OS CORVOS: voltam ao posto
  if (atingidoEm(f, k, n)) {
    voltarAoPosto(k, f);
    return;
  }
  // O POSTO: o andar mais alto em que já pisou
  for (let i = k.posto + 1; i < f.postos.length; i++) if (k.noChao && k.sobre < 0 && k.y <= f.postos[i].y + 0.5) k.posto = i;
}

/** O fantasma: x, y (em décimos) e o jeito (o lado, e 2 se no ar), um trio a cada AMOSTRA passos. */
export function amostrar(k: Coelho, fantasma: number[]) {
  if ((k.passos - 1) % AMOSTRA === 0) fantasma.push(Math.round(k.x * 10), Math.round(k.y * 10), k.lado * (k.noChao || k.espera > 0 ? 1 : 2));
}

/** Onde o fantasma estava no passo `n` (entre duas amostras). Null depois do fim. */
export function fantasmaEm(amostras: number[], n: number): { x: number; y: number; jeito: number } | null {
  const total = amostras.length / 3;
  const f = (n - 1) / AMOSTRA;
  const i = Math.max(0, Math.floor(f));
  if (i >= total - 1) return null;
  const t = Math.max(0, f - i);
  const a = i * 3, b = a + 3;
  // a volta ao posto não se interpola
  if (Math.abs(amostras[b + 1] - amostras[a + 1]) > 400 || Math.abs(amostras[b] - amostras[a]) > 400) return { x: amostras[a] / 10, y: amostras[a + 1] / 10, jeito: amostras[a + 2] };
  return {
    x: (amostras[a] + (amostras[b] - amostras[a]) * t) / 10,
    y: (amostras[a + 1] + (amostras[b + 1] - amostras[a + 1]) * t) / 10,
    jeito: amostras[a + 2],
  };
}

/** Quanto da torre já subiu (0 na largada, 1 no topo). */
export const progresso = (k: { y: number }, f: Torre) => Math.max(0, Math.min(1, (f.largada.y - k.y) / (f.largada.y - f.chegada)));

export const passosEmMs = (passos: number) => Math.round((passos * 1000) / 60);
