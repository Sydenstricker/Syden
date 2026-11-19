import { sorteio } from './util';
import { GIRO_COM_FREIO, PASSO, VMAX } from './fisica';
import { pontoNaLinha, RECUO_DA_LARGADA, type PistaDoJato } from './pista';
import type { Dificuldade } from '../corrida/robos';

/**
 * AS NAVES DO COMPUTADOR (05/11/2026): uns 10 a 12 corredores na pista, também no Solo, para ela nunca parecer vazia. São
 * mais simples que a nave de quem joga: andam pela linha do meio, cada um na sua faixa e com o seu ritmo, freando antes das
 * curvas fechadas pela curvatura da pista. Não batem em ninguém nem são da rede.
 *
 * O CAMINHO INTEIRO É CALCULADO NA LARGADA, passo a passo, a partir da pista e do número de cada robô: o mesmo em todo
 * computador. Na sala, todos veem os mesmos robôs no mesmo passo da corrida, sem mandar nada pela internet; eles entram na
 * ordem ao vivo de cada um, mas a classificação (e o troféu) é só entre as pessoas.
 *
 * A DIFICULDADE (19/11/2026, a auditoria): no Solo a pessoa escolhe o quanto eles apertam; na sala é sempre o médio (o
 * caminho tem de ser o mesmo em todo computador). E O GOLPE DE LADO (só no Solo): a nave de quem joga gira e empurra o
 * robô que estiver encostado; ele perde velocidade, e o caminho dele é refeito dali em diante. A nave de quem joga não muda
 * nada (o tempo e o fantasma dela são os mesmos), e por isso a corrida com os robôs continua valendo recorde.
 */

export const ROBOS_NA_PISTA = 11;

/** O teto (fração da velocidade máxima) e o quanto cada um aguenta na curva, por dificuldade: [base, quanto sobe, sorte]. */
const RITMO: Record<Dificuldade, { teto: [number, number, number]; curvas: [number, number, number] }> = {
  facil: { teto: [0.8, 0.08, 0.02], curvas: [0.66, 0.1, 0.04] },
  medio: { teto: [0.88, 0.1, 0.02], curvas: [0.74, 0.14, 0.04] },
  dificil: { teto: [0.95, 0.06, 0.02], curvas: [0.84, 0.12, 0.04] },
};

/** O golpe: quanto da velocidade sobra, e por quantos passos o robô balança para o lado (só o desenho). */
export const SOBRA_DO_GOLPE = 0.4;
const PASSOS_DO_EMPURRAO = 50;

export interface Robo {
  i: number;
  /** O s da linha do meio em cada passo (desde a largada), e o passo da chegada. */
  s: Float32Array;
  chegada: number;
  /** O quanto ele estava antes da linha na largada (a grade), e a faixa e o balanço dele. */
  recuo: number;
  faixa: number;
  fase: number;
  /** O ritmo dele (a velocidade que busca e o quanto aguenta na curva). */
  teto: number;
  curvas: number;
  /** O último golpe que levou: o passo e o lado (só o desenho). */
  golpe: { n: number; lado: number } | null;
}

/** Anda o robô de `desde` até o fim do caminho, a partir do s `pos` e da velocidade `v` (e acerta a chegada). */
function simular(p: PistaDoJato, r: Robo, desde: number, pos: number, v: number) {
  const total = p.lx.length;
  const inicio = p.comprimento - r.recuo;
  const fim = r.recuo + p.def.voltas * p.comprimento;
  r.chegada = 0;
  for (let k = 0; k < desde; k++) if (!r.chegada && r.s[k] - inicio >= fim) r.chegada = k + 1;
  for (let n = desde; n < r.s.length; n++) {
    const idx = pontoNaLinha(p, pos).indice;
    let kmax = 0;
    for (let k = 0; k < 24 + v / 9; k += 2) kmax = Math.max(kmax, p.curva[(idx + k) % total]);
    const alvo = Math.min(r.teto, kmax > 0 ? (GIRO_COM_FREIO / kmax) * r.curvas : r.teto);
    if (v < alvo) v += (alvo - v) * 0.75 * PASSO + (v < 40 ? 40 * PASSO : 0);
    else v = Math.max(alvo, v - 300 * PASSO);
    pos += v * PASSO;
    r.s[n] = pos;
    if (!r.chegada && pos - inicio >= fim) r.chegada = n + 1;
  }
  if (!r.chegada) r.chegada = r.s.length;
}

/** Os robôs de uma corrida: `quantos` (os primeiros da grade), com o caminho de até `passos` passos. */
export function criarRobos(p: PistaDoJato, quantos: number, passos = 60 * 60 * 4, dificuldade: Dificuldade = 'medio'): Robo[] {
  const robos: Robo[] = [];
  const hw = p.def.meiaLargura;
  const ritmo = RITMO[dificuldade];
  for (let i = 0; i < quantos; i++) {
    const sorte = sorteio(p.def.semente * 101 + i * 7 + 1);
    // a grade: duas colunas, de 12 em 12 à frente de quem joga (que larga 100 antes da linha)
    const fila = Math.floor(i / 2);
    const recuo = Math.max(8, RECUO_DA_LARGADA - 14 - fila * 14);
    const faixa = (i % 2 ? 1 : -1) * 0.42;
    // o ritmo: dos mais lentos aos mais rápidos, e uns melhores na curva que outros
    const frac = i / Math.max(1, quantos - 1);
    const teto = VMAX * (ritmo.teto[0] + ritmo.teto[1] * frac + sorte() * ritmo.teto[2]);
    const curvas = ritmo.curvas[0] + ritmo.curvas[1] * frac + sorte() * ritmo.curvas[2];
    const r: Robo = { i, s: new Float32Array(passos), chegada: 0, recuo, faixa: faixa * hw, fase: sorte() * 6, teto, curvas, golpe: null };
    simular(p, r, 0, p.comprimento - recuo, 0);
    robos.push(r);
  }
  return robos;
}

/**
 * O GOLPE DE LADO no robô, no passo `n` (só no Solo): ele perde velocidade e o caminho é refeito dali. `lado` é para onde
 * ele foi empurrado (só o desenho).
 */
export function golpear(p: PistaDoJato, r: Robo, n: number, lado: number) {
  if (n < 2 || n >= r.s.length || (r.chegada && n >= r.chegada)) return;
  const v = (r.s[n - 1] - r.s[n - 2]) / PASSO;
  r.golpe = { n, lado: Math.sign(lado) || 1 };
  simular(p, r, n, r.s[n - 1], v * SOBRA_DO_GOLPE);
}

/** Onde está o robô no passo `n` (antes da largada, parado na grade; depois do fim do caminho, no último ponto). */
export function roboEm(p: PistaDoJato, r: Robo, n: number) {
  const k = Math.max(0, Math.min(r.s.length - 1, n - 1));
  const s = n <= 0 ? p.comprimento - r.recuo : r.s[k];
  const q = pontoNaLinha(p, s);
  // o balanço de um lado para o outro da faixa, devagar (só o desenho: não decide nada)
  const balanco = n <= 0 ? 0 : Math.sin(s / 140 + r.fase) * p.def.meiaLargura * 0.22;
  // o empurrão do golpe: o robô vai para o lado e volta, girando (só o desenho)
  const desde = r.golpe ? n - r.golpe.n : -1;
  const empurrao = r.golpe && desde >= 0 && desde < PASSOS_DO_EMPURRAO ? r.golpe.lado * p.def.meiaLargura * 0.5 * Math.sin((Math.PI * desde) / PASSOS_DO_EMPURRAO) : 0;
  const giro = r.golpe && desde >= 0 && desde < 30 ? (r.golpe.lado * Math.PI * 2 * desde) / 30 : 0;
  const lado = r.faixa + balanco + empurrao;
  const proximo = pontoNaLinha(p, s + 6);
  const dLado = Math.cos(s / 140 + r.fase) * (p.def.meiaLargura * 0.22) / 140;
  return {
    x: q.x - q.dy * lado,
    y: q.y + q.dx * lado,
    angulo: Math.atan2(proximo.dy, proximo.dx) + Math.atan(dLado) + giro,
    /** Voltas desde a primeira passagem pela linha (negativo antes dela), como o progresso de quem joga. */
    andou: (s - p.comprimento) / p.comprimento,
    banco: Math.max(-1, Math.min(1, -dLado * 30 + curvaDoLado(p, q.indice) * 60)),
  };
}

/** Para que lado a pista vira ali (o sinal da curvatura), para a nave inclinar. */
function curvaDoLado(p: PistaDoJato, i: number) {
  const n = p.lx.length;
  const a = (i - 6 + n) % n, b = (i + 6) % n;
  const d1x = p.lx[i] - p.lx[a], d1y = p.ly[i] - p.ly[a], d2x = p.lx[b] - p.lx[i], d2y = p.ly[b] - p.ly[i];
  return Math.sign(d1x * d2y - d1y * d2x) * p.curva[i];
}
