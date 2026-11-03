import { Chao, chaoEm, pontoMaisPerto, type Pista } from './pista';

/**
 * A FÍSICA DO KART (03/11/2026): arcade, no espírito dos karts do Super Nintendo — acelera sozinho até o teto, a grama
 * segura, a derrapagem (pular numa curva e segurar) fecha a curva e carrega um turbo que sai ao soltar.
 *
 * O passo é FIXO (60 por segundo), e o mesmo passo com os mesmos comandos dá sempre o mesmo resultado: o tempo da
 * volta é o número de passos, e não o relógio do computador. O fantasma guarda as POSIÇÕES (amostradas), e não os
 * comandos, para um fantasma antigo continuar passando no mesmo lugar mesmo se a física mudar um pouco.
 */

export const PASSO = 1 / 60;
export const VMAX = 140;
export const VMAX_GRAMA = 58;
export const VTURBO = 185;
/** De quantos em quantos passos o fantasma guarda uma posição (15 por segundo). */
export const AMOSTRA = 4;
/** Quanto dura a rodada de quem foi atingido (s): uma volta inteira do kart. */
export const RODADA = 1;

/** O kart atingido por um item começa a rodar (a lama é mais curta). */
export function atingir(k: Kart, quanto = RODADA) {
  if (k.rodando > 0 || k.terminou) return;
  k.rodando = quanto;
}

export interface Comandos {
  acelera: boolean;
  freia: boolean;
  /** -1 esquerda, 0, 1 direita. */
  vira: number;
  /** Segurando o botão de derrapar. */
  derrapa: boolean;
  /** Usar o item (só na corrida da sala; quem lê é o laço, na hora em que a tecla desce). */
  usa?: boolean;
}

export interface Kart {
  x: number;
  y: number;
  /** Para onde o kart aponta (o desenho). */
  angulo: number;
  /** Para onde ele anda: na derrapagem, fica para trás do ângulo, e o kart escorrega de lado. */
  rumo: number;
  v: number;
  /** -1/1 derrapando para esse lado, 0 não. */
  deriva: number;
  /** Quanto tempo de derrapagem já carregou (s). */
  carga: number;
  /** Tempo de turbo que falta (s). */
  turbo: number;
  /** O pulinho do começo da derrapagem (altura, para o desenho). */
  pulo: number;
  vpulo: number;
  /** O ponto da linha do meio mais perto (para contar a volta). */
  indice: number;
  volta: number;
  /** Passou pela metade da pista nesta volta (sem isso, ir e voltar na linha contaria volta). */
  meio: boolean;
  /** Os passos em que cada volta terminou. */
  voltas: number[];
  passos: number;
  terminou: boolean;
  /** O chão debaixo dele (para o som e a poeira). */
  chao: Chao;
  /** Bateu neste passo (para tremer a tela). */
  bateu: boolean;
  /** Atingido por um item: quanto falta da rodada (s). Gira, perde velocidade e não obedece o direcional. */
  rodando: number;
}

export function novoKart(p: Pista): Kart {
  const { x, y, angulo } = p.largada;
  return {
    x, y, angulo, rumo: angulo, v: 0, deriva: 0, carga: 0, turbo: 0, pulo: 0, vpulo: 0,
    indice: p.lx.length - 3, volta: 0, meio: false, voltas: [], passos: 0, terminou: false, chao: Chao.Asfalto, bateu: false, rodando: 0,
  };
}

/** O nível do turbo que a derrapagem já carregou: 0 nenhum, 1 azul, 2 laranja. */
export const nivelDaCarga = (k: Kart) => (k.carga >= 2.0 ? 2 : k.carga >= 1.0 ? 1 : 0);

const giraPara = (a: number, b: number, max: number) => {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + Math.max(-max, Math.min(max, d));
};

export function passo(k: Kart, c: Comandos, p: Pista): void {
  const dt = PASSO;
  k.bateu = false;
  if (k.terminou) {
    // depois da chegada, ele desacelera sozinho
    c = { acelera: false, freia: false, vira: 0, derrapa: false };
  }
  k.passos++;
  const chao = chaoEm(p, k.x, k.y);
  k.chao = chao;
  if (chao === Chao.Turbo && k.turbo < 0.9) k.turbo = 0.9;
  const naGrama = chao === Chao.Grama || chao === Chao.Terra;
  // ATINGIDO (o repolho, a lama): a rodada de um segundo, sem direção nem acelerador, e a volta inteira no desenho
  if (k.rodando > 0) {
    k.rodando = Math.max(0, k.rodando - dt);
    c = { acelera: false, freia: false, vira: 0, derrapa: false };
    k.v *= 1 - 2.2 * dt;
    k.angulo += (Math.PI * 2 * dt) / RODADA;
    k.deriva = 0;
    k.carga = 0;
    k.turbo = 0;
  }

  // A VELOCIDADE: o teto depende do chão e do turbo; acelerar aproxima do teto, frear desce, soltar perde um pouco.
  const teto = k.turbo > 0 ? (naGrama ? VMAX_GRAMA + 50 : VTURBO) : naGrama ? VMAX_GRAMA : VMAX;
  if (k.turbo > 0) k.turbo = Math.max(0, k.turbo - dt);
  if (c.acelera && !c.freia) {
    if (k.v < teto) k.v += (teto - k.v) * (k.turbo > 0 ? 3.5 : 1.15) * dt + (k.v < 20 ? 30 * dt : 0);
    else k.v -= Math.min(k.v - teto, 170 * dt);
  } else if (c.freia) {
    k.v -= (k.v > 0 ? 220 : 60) * dt;
    if (k.v < -32) k.v = -32;
  } else {
    k.v -= Math.sign(k.v) * Math.min(Math.abs(k.v), 45 * dt);
  }
  if (k.v > teto && !c.acelera) k.v -= Math.min(k.v - teto, 170 * dt);

  // A DERRAPAGEM: começa com o botão apertado, virando, e em velocidade; dura enquanto ele estiver apertado.
  if (k.deriva === 0 && c.derrapa && c.vira !== 0 && k.v > 70 && k.pulo === 0) {
    k.deriva = Math.sign(c.vira);
    k.carga = 0;
    k.vpulo = 34;
  }
  if (k.deriva !== 0 && (!c.derrapa || k.v < 45)) {
    const nivel = nivelDaCarga(k);
    if (nivel > 0 && c.derrapa === false) k.turbo = Math.max(k.turbo, nivel === 2 ? 1.25 : 0.7);
    k.deriva = 0;
    k.carga = 0;
  }
  // o pulinho: sobe e cai
  if (k.vpulo !== 0 || k.pulo > 0) {
    k.pulo += k.vpulo * dt;
    k.vpulo -= 260 * dt;
    if (k.pulo <= 0) {
      k.pulo = 0;
      k.vpulo = 0;
    }
  }

  // A DIREÇÃO: parado não vira; na ré, vira ao contrário. Derrapando, a curva é sempre para o lado dela, mais fechada
  // ou mais aberta conforme o direcional.
  const forca = Math.min(1, Math.abs(k.v) / 55) * Math.sign(k.v);
  let giro: number;
  if (k.deriva !== 0) {
    giro = k.deriva * (1.55 + 0.95 * c.vira * k.deriva) * forca;
    k.carga += dt * (0.6 + 0.4 * Math.max(0, c.vira * k.deriva));
  } else {
    giro = c.vira * 2.35 * forca;
  }
  k.angulo += giro * dt;
  // o rumo segue o ângulo: rápido no asfalto, devagar na derrapagem (o kart escorrega)
  k.rumo = giraPara(k.rumo, k.angulo, (k.deriva !== 0 ? 2.6 : naGrama ? 7 : 13) * dt);

  // ANDAR, com as batidas: na parede, não passa e volta um pouco; na árvore, é empurrado para fora dela
  const nx = k.x + Math.cos(k.rumo) * k.v * dt;
  const ny = k.y + Math.sin(k.rumo) * k.v * dt;
  if (chaoEm(p, nx, ny) === Chao.Parede) {
    if (chaoEm(p, nx, k.y) !== Chao.Parede) k.x = nx;
    else if (chaoEm(p, k.x, ny) !== Chao.Parede) k.y = ny;
    k.v *= Math.abs(k.v) > 40 ? -0.3 : 0.5;
    k.deriva = 0;
    k.carga = 0;
    k.bateu = true;
  } else {
    k.x = nx;
    k.y = ny;
  }
  for (const o of p.objetos) {
    if (!o.raio) continue;
    const dx = k.x - o.x, dy = k.y - o.y, d = Math.hypot(dx, dy), min = o.raio + 4;
    if (d < min && d > 0) {
      k.x = o.x + (dx / d) * min;
      k.y = o.y + (dy / d) * min;
      k.v *= 0.45;
      k.deriva = 0;
      k.bateu = true;
    }
  }

  // A VOLTA: a linha de chegada é o ponto 0 da linha do meio. Conta quando o kart passa por ela para a frente, tendo
  // passado pela metade da pista (sem isso, dar ré na linha contaria volta).
  const n = p.lx.length;
  const antes = k.indice;
  k.indice = pontoMaisPerto(p, k.x, k.y, k.indice);
  if (k.indice > n * 0.4 && k.indice < n * 0.6) k.meio = true;
  if (antes > n * 0.8 && k.indice < n * 0.2 && k.meio && !k.terminou) {
    k.volta++;
    k.meio = false;
    k.voltas.push(k.passos);
    if (k.volta >= p.def.voltas) k.terminou = true;
  } else if (antes < n * 0.2 && k.indice > n * 0.8 && k.volta > 0 && k.voltas.length === k.volta) {
    // voltou para trás da linha (de ré): a volta só conta de novo depois de passar pela metade outra vez
    k.meio = false;
  }
}

/** A posição na corrida, para ordenar quem está na frente: voltas completas mais a fração da volta atual. */
export const progresso = (k: Kart, p: Pista) => k.volta + p.la[k.indice] / p.comprimento;

/** O fantasma: x, y (em décimos) e o ângulo (em milésimos de radiano), um trio a cada AMOSTRA passos. */
export function amostrar(k: Kart, fantasma: number[]) {
  if ((k.passos - 1) % AMOSTRA === 0) fantasma.push(Math.round(k.x * 10), Math.round(k.y * 10), Math.round(k.angulo * 1000));
}

/** Onde o fantasma estava no passo `n` (entre duas amostras, no meio do caminho). Null depois do fim. */
export function fantasmaEm(amostras: number[], n: number): { x: number; y: number; angulo: number } | null {
  const total = amostras.length / 3;
  const f = n / AMOSTRA;
  const i = Math.floor(f);
  if (i >= total - 1) return null;
  const t = f - i;
  const a = i * 3, b = a + 3;
  return {
    x: (amostras[a] + (amostras[b] - amostras[a]) * t) / 10,
    y: (amostras[a + 1] + (amostras[b + 1] - amostras[a + 1]) * t) / 10,
    angulo: (amostras[a + 2] + (amostras[b + 2] - amostras[a + 2]) * t) / 1000,
  };
}

/** Passos em milissegundos, e o tempo como se lê: 1:05.43. */
export const passosEmMs = (passos: number) => Math.round((passos * 1000) / 60);
export function tempoLegivel(ms: number): string {
  const min = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${min}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/**
 * O PILOTO AUTOMÁTICO: mira um ponto da linha do meio um pouco à frente e acelera. Serve aos testes (web/test/corrida.test.ts
 * e o e2e/corrida.mjs, que o liga pelo `window.corridaPilotoAutomatico` no site de desenvolvimento), nunca a quem joga.
 */
export function pilotoAutomatico(k: Kart, p: Pista, derrapar = false): Comandos {
  const n = p.lx.length;
  const alvo = (k.indice + 10) % n;
  let dif = Math.atan2(p.ly[alvo] - k.y, p.lx[alvo] - k.x) - k.angulo;
  while (dif > Math.PI) dif -= 2 * Math.PI;
  while (dif < -Math.PI) dif += 2 * Math.PI;
  return { acelera: true, freia: false, vira: Math.abs(dif) < 0.04 ? 0 : Math.sign(dif), derrapa: derrapar && Math.abs(dif) > 0.25 };
}
