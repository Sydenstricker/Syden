import { ALTURA, Bloco, blocoEm, movelEm, T, type Fase } from './fases';

/**
 * A FÍSICA DO PULO DO COELHO (03/11/2026): plataforma no espírito dos jogos de 16 bits — corre e acelera, o pulo é mais
 * alto quanto mais tempo o botão fica apertado, e há a "folga do coiote" (dá para pular logo depois de sair da beirada) e
 * o pulo guardado (apertar um pouco antes de tocar o chão também vale).
 *
 * Como na corrida de kart (corrida/fisica.ts): o passo é FIXO (60 por segundo), os mesmos comandos dão sempre o mesmo
 * resultado, e o TEMPO É O NÚMERO DE PASSOS. As plataformas que andam dependem só do passo, então cada um as vê no mesmo
 * lugar no mesmo instante da própria corrida. Cair num buraco ou tocar um espinho volta ao último posto, e o relógio segue.
 */

export const PASSO = 1 / 60;
export const VMAX = 110;
const ACEL_CHAO = 900;
const ACEL_AR = 620;
const ATRITO_CHAO = 1100;
const ATRITO_AR = 250;
const GRAVIDADE = 980;
export const VPULO = 310;
/** Soltar o botão subindo corta o pulo a esta velocidade (o pulo curto). */
const VCORTE = 110;
export const VMOLA = 500;
export const VQUEDA = 430;
const COIOTE = 6;
const GUARDADO = 7;
/** Depois de cair: quantos passos parado no posto, piscando. */
export const ESPERA = 36;
/** Meia largura e altura do coelho (a caixa que bate). */
export const MEIA = 5;
export const ALTO = 22;
/** De quantos em quantos passos o fantasma guarda uma posição (15 por segundo). */
export const AMOSTRA = 4;

export interface Comandos {
  esquerda: boolean;
  direita: boolean;
  /** Segurando o botão de pular. */
  pula: boolean;
}

export interface Coelho {
  /** O pé do coelho, no meio. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  noChao: boolean;
  /** Em cima de qual plataforma que anda (-1: nenhuma). */
  sobre: number;
  coiote: number;
  guardado: number;
  pulaAntes: boolean;
  /** Subindo de um pulo com o botão ainda apertado (soltar corta o pulo). */
  segurando: boolean;
  /** Para onde olha: 1 direita, -1 esquerda. */
  lado: number;
  /** O quanto andou no chão (o desenho escolhe o quadro do passo por isto). */
  andado: number;
  posto: number;
  espera: number;
  quedas: number;
  passos: number;
  terminou: boolean;
  /** O passo em que cruzou a chegada. */
  chegouEm: number;
  /** Bateu numa mola neste passo (para o desenho). */
  molou: boolean;
}

export function novoCoelho(f: Fase): Coelho {
  return {
    x: f.largada.x, y: f.largada.y, vx: 0, vy: 0, noChao: true, sobre: -1, coiote: COIOTE, guardado: 0, pulaAntes: false,
    segurando: false, lado: 1, andado: 0, posto: 0, espera: 0, quedas: 0, passos: 0, terminou: false, chegouEm: 0, molou: false,
  };
}

const solido = (b: Bloco) => b === Bloco.Chao || b === Bloco.Mola;

/** Há bloco sólido em algum ponto da caixa [x0, x1) × [y0, y1)? */
function bateEm(f: Fase, x0: number, y0: number, x1: number, y1: number): boolean {
  for (let c = Math.floor(x0 / T); c <= Math.floor((x1 - 0.001) / T); c++) {
    for (let l = Math.floor(y0 / T); l <= Math.floor((y1 - 0.001) / T); l++) if (solido(blocoEm(f, c, l))) return true;
  }
  return false;
}

function tocaEspinho(f: Fase, k: Coelho): boolean {
  const x0 = k.x - MEIA + 2, x1 = k.x + MEIA - 2, y0 = k.y - ALTO + 3, y1 = k.y - 1;
  for (let c = Math.floor(x0 / T); c <= Math.floor(x1 / T); c++) {
    for (let l = Math.floor(y0 / T); l <= Math.floor(y1 / T); l++) {
      if (blocoEm(f, c, l) !== Bloco.Espinho) continue;
      // o espinho ocupa o meio da casa, não ela inteira: encostar no canto não fere
      // pendurado (embaixo de um bloco), a ponta é para baixo, na metade de cima da casa
      const pendurado = blocoEm(f, c, l - 1) === Bloco.Chao && blocoEm(f, c, l + 1) !== Bloco.Chao;
      const ex0 = c * T + 3, ex1 = c * T + T - 3, ey0 = pendurado ? l * T : l * T + 6, ey1 = pendurado ? l * T + 10 : l * T + T;
      if (x1 > ex0 && x0 < ex1 && y1 > ey0 && y0 < ey1) return true;
    }
  }
  return false;
}

/** Voltar ao último posto. */
function cair(k: Coelho, f: Fase) {
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
}

export function passo(k: Coelho, c: Comandos, f: Fase): void {
  const dt = PASSO;
  k.passos++;
  k.molou = false;
  if (k.terminou) c = { esquerda: false, direita: true, pula: false };
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

  // CORRER
  const dir = (c.direita ? 1 : 0) - (c.esquerda ? 1 : 0);
  if (dir !== 0) {
    k.vx += dir * (k.noChao ? ACEL_CHAO : ACEL_AR) * dt;
    if (Math.abs(k.vx) > VMAX) k.vx = Math.sign(k.vx) * VMAX;
    k.lado = dir;
  } else {
    const atrito = (k.noChao ? ATRITO_CHAO : ATRITO_AR) * dt;
    k.vx -= Math.sign(k.vx) * Math.min(Math.abs(k.vx), atrito);
  }

  // PULAR: o pulo guardado (apertou um pouco antes de tocar o chão) e a folga do coiote (saiu da beirada agorinha)
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
  // soltou subindo: o pulo fica curto
  if (k.segurando && !c.pula) {
    k.segurando = false;
    if (k.vy < -VCORTE) k.vy = -VCORTE;
  }
  if (k.vy >= 0) k.segurando = false;

  k.vy = Math.min(VQUEDA, k.vy + GRAVIDADE * dt);

  // ANDAR NO X, parando na parede
  const x0 = k.x;
  const nx = k.x + k.vx * dt;
  if (bateEm(f, nx - MEIA, k.y - ALTO, nx + MEIA, k.y - 0.01)) {
    // encosta na parede
    if (k.vx > 0) k.x = Math.floor((nx + MEIA) / T) * T - MEIA - 0.01;
    else if (k.vx < 0) k.x = Math.ceil((nx - MEIA) / T) * T + MEIA + 0.01;
    if (bateEm(f, k.x - MEIA, k.y - ALTO, k.x + MEIA, k.y - 0.01)) k.x = x0;
    k.vx = 0;
  } else {
    k.x = nx;
  }
  k.x = Math.max(MEIA, Math.min(f.colunas * T - MEIA, k.x));
  if (k.noChao) k.andado += Math.abs(k.x - x0);

  // ANDAR NO Y: o chão e o teto sólidos; a tábua e a plataforma que anda só seguram quem desce por cima
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
    let mola = false;
    for (let col = Math.floor((k.x - MEIA) / T); col <= Math.floor((k.x + MEIA - 0.001) / T); col++) {
      for (let l = Math.floor(yAntes / T); l <= Math.floor(ny / T); l++) {
        const b = blocoEm(f, col, l);
        const topo = l * T;
        if (topo < yAntes - 0.01 && !solido(b)) continue;
        if (solido(b) || (b === Bloco.Tabua && topo >= yAntes - 0.01)) {
          if (topo >= yAntes - 0.01 && topo <= ny && topo < chao) {
            chao = topo;
            mola = b === Bloco.Mola;
          }
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
        mola = false;
      }
    });
    if (chao !== Infinity) {
      k.y = chao;
      if (mola) {
        k.vy = -VMOLA;
        k.segurando = false;
        k.molou = true;
      } else {
        k.vy = 0;
        k.noChao = true;
        k.sobre = sobre;
      }
    } else {
      k.y = ny;
    }
  }

  // OS PERIGOS: o buraco e o espinho voltam ao posto
  if (k.y > ALTURA + 24 || tocaEspinho(f, k)) {
    cair(k, f);
    return;
  }
  // O POSTO: o mais à direita que já passou, pisando
  for (let i = k.posto + 1; i < f.postos.length; i++) if (k.noChao && k.x >= f.postos[i].x - 4) k.posto = i;
  // A CHEGADA
  if (!k.terminou && k.x >= f.chegada) {
    k.terminou = true;
    k.chegouEm = k.passos;
  }
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
  // uma volta ao posto não se interpola (o fantasma não atravessa a fase voando)
  if (Math.abs(amostras[b] - amostras[a]) > 400) return { x: amostras[a] / 10, y: amostras[a + 1] / 10, jeito: amostras[a + 2] };
  return {
    x: (amostras[a] + (amostras[b] - amostras[a]) * t) / 10,
    y: (amostras[a + 1] + (amostras[b + 1] - amostras[a + 1]) * t) / 10,
    jeito: amostras[a + 2],
  };
}

/** Quanto da fase já andou (0 na largada, 1 na chegada): ordena quem está na frente. */
export const progresso = (k: Coelho, f: Fase) => Math.max(0, Math.min(1, (k.x - f.largada.x) / (f.chegada - f.largada.x)));

export const passosEmMs = (passos: number) => Math.round((passos * 1000) / 60);
