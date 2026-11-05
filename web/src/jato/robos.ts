import { sorteio } from './util';
import { GIRO_COM_FREIO, PASSO, VMAX } from './fisica';
import { pontoNaLinha, RECUO_DA_LARGADA, type PistaDoJato } from './pista';

/**
 * AS NAVES DO COMPUTADOR (05/11/2026): uns 10 a 12 corredores na pista, também no Solo, para ela nunca parecer vazia. São
 * mais simples que a nave de quem joga: andam pela linha do meio, cada um na sua faixa e com o seu ritmo, freando antes das
 * curvas fechadas pela curvatura da pista. Não batem em ninguém nem são da rede.
 *
 * O CAMINHO INTEIRO É CALCULADO NA LARGADA, passo a passo, a partir da pista e do número de cada robô: o mesmo em todo
 * computador. Na sala, todos veem os mesmos robôs no mesmo passo da corrida, sem mandar nada pela internet; eles entram na
 * ordem ao vivo de cada um, mas a classificação (e o troféu) é só entre as pessoas.
 */

export const ROBOS_NA_PISTA = 11;

export interface Robo {
  i: number;
  /** O s da linha do meio em cada passo (desde a largada), e o passo da chegada. */
  s: Float32Array;
  chegada: number;
  /** O quanto ele estava antes da linha na largada (a grade), e a faixa e o balanço dele. */
  recuo: number;
  faixa: number;
  fase: number;
}

/** Os robôs de uma corrida: `quantos` (os primeiros da grade), com o caminho de até `passos` passos. */
export function criarRobos(p: PistaDoJato, quantos: number, passos = 60 * 60 * 4): Robo[] {
  const robos: Robo[] = [];
  const total = p.lx.length;
  const hw = p.def.meiaLargura;
  for (let i = 0; i < quantos; i++) {
    const sorte = sorteio(p.def.semente * 101 + i * 7 + 1);
    // a grade: duas colunas, de 12 em 12 à frente de quem joga (que larga 100 antes da linha)
    const fila = Math.floor(i / 2);
    const recuo = Math.max(8, RECUO_DA_LARGADA - 14 - fila * 14);
    const faixa = (i % 2 ? 1 : -1) * 0.42;
    // o ritmo: dos mais lentos aos mais rápidos, e uns melhores na curva que outros
    const teto = VMAX * (0.88 + 0.1 * (i / Math.max(1, quantos - 1)) + sorte() * 0.02);
    const curvas = 0.74 + 0.14 * (i / Math.max(1, quantos - 1)) + sorte() * 0.04;
    const s = new Float32Array(passos);
    let pos = p.comprimento - recuo, v = 0, chegada = 0;
    const fim = recuo + p.def.voltas * p.comprimento;
    let andou = 0;
    for (let n = 0; n < passos; n++) {
      const idx = pontoNaLinha(p, pos).indice;
      let kmax = 0;
      for (let k = 0; k < 24 + v / 9; k += 2) kmax = Math.max(kmax, p.curva[(idx + k) % total]);
      const alvo = Math.min(teto, kmax > 0 ? (GIRO_COM_FREIO / kmax) * curvas : teto);
      if (v < alvo) v += (alvo - v) * 0.75 * PASSO + (v < 40 ? 40 * PASSO : 0);
      else v = Math.max(alvo, v - 300 * PASSO);
      pos += v * PASSO;
      andou += v * PASSO;
      s[n] = pos;
      if (!chegada && andou >= fim) chegada = n + 1;
    }
    robos.push({ i, s, chegada: chegada || passos, recuo, faixa: faixa * hw, fase: sorte() * 6 });
  }
  return robos;
}

/** Onde está o robô no passo `n` (antes da largada, parado na grade; depois do fim do caminho, no último ponto). */
export function roboEm(p: PistaDoJato, r: Robo, n: number) {
  const k = Math.max(0, Math.min(r.s.length - 1, n - 1));
  const s = n <= 0 ? p.comprimento - r.recuo : r.s[k];
  const q = pontoNaLinha(p, s);
  // o balanço de um lado para o outro da faixa, devagar (só o desenho: não decide nada)
  const balanco = n <= 0 ? 0 : Math.sin(s / 140 + r.fase) * p.def.meiaLargura * 0.22;
  const lado = r.faixa + balanco;
  const proximo = pontoNaLinha(p, s + 6);
  const dLado = Math.cos(s / 140 + r.fase) * (p.def.meiaLargura * 0.22) / 140;
  return {
    x: q.x - q.dy * lado,
    y: q.y + q.dx * lado,
    angulo: Math.atan2(proximo.dy, proximo.dx) + Math.atan(dLado),
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
