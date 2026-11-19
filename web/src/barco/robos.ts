import { GIRO, novoBarco, PASSO, passo, pilotoAutomatico, VCRUZEIRO } from './fisica';
import { pontoNaLinha, RECUO_DA_LARGADA, type PistaDoBarco } from './pista';
import { sorteio } from '../jato/util';
import type { Dificuldade } from '../corrida/robos';

/**
 * OS BARCOS DO COMPUTADOR DA REGATA (19/11/2026, a auditoria: "robôs no Solo, copiando o jeito do Jato"). Só no Solo: cinco
 * barquinhos que andam pela linha do meio, cada um na sua faixa e no seu ritmo, freando antes das curvas pela curvatura da
 * pista (a mesma conta das naves do computador, jato/robos.ts). Não batem em ninguém, não são da rede e não mudam nada no
 * barco de quem joga: o tempo e o fantasma dele são os mesmos, e por isso a corrida com eles continua valendo recorde.
 *
 * O caminho inteiro é calculado na largada, passo a passo, a partir da pista e do número de cada robô. E depois ESTICADO no
 * tempo para a corrida inteira dele durar o que a dificuldade pede em relação ao piloto automático honesto da mesma pista
 * (RITMO_DA_CORRIDA): as pistas são muito diferentes (o lago é aberto, o riacho é cheio de curvas e de correnteza), e uma
 * velocidade só deixava os robôs rápidos demais numa e lentos demais na outra.
 */

/** Quanto a corrida do robô dura, em relação à do piloto automático: [o primeiro da grade, o último]. */
const RITMO_DA_CORRIDA: Record<Dificuldade, [number, number]> = {
  facil: [1.14, 1.28],
  medio: [1.02, 1.12],
  dificil: [0.93, 1.0],
};

const tempoDoPiloto = new Map<string, number>();
/** Quantos passos o piloto automático leva na pista (guardado por pista: é a régua dos robôs). */
export function passosDoPiloto(p: PistaDoBarco): number {
  let t = tempoDoPiloto.get(p.def.id);
  if (t === undefined) {
    const b = novoBarco(p);
    while (!b.terminou && b.passos < 60 * 60 * 5) passo(b, pilotoAutomatico(b, p), p);
    t = b.passos;
    tempoDoPiloto.set(p.def.id, t);
  }
  return t;
}

export const BARCOS_DO_COMPUTADOR = 5;

/** O teto (fração da velocidade de cruzeiro) e o quanto cada um aguenta na curva: [base, quanto sobe pela grade, sorte]. */
const RITMO: Record<Dificuldade, { teto: [number, number, number]; curvas: [number, number, number] }> = {
  facil: { teto: [0.64, 0.06, 0.03], curvas: [0.5, 0.08, 0.04] },
  medio: { teto: [0.72, 0.08, 0.03], curvas: [0.58, 0.1, 0.04] },
  dificil: { teto: [0.82, 0.08, 0.03], curvas: [0.68, 0.1, 0.04] },
};

export interface RoboDoBarco {
  i: number;
  /** O s da linha do meio em cada passo (desde a largada), e o passo da chegada. */
  s: Float32Array;
  chegada: number;
  recuo: number;
  faixa: number;
  fase: number;
}

export function criarRobosDoBarco(p: PistaDoBarco, quantos: number, dificuldade: Dificuldade = 'medio', passos = 60 * 60 * 5): RoboDoBarco[] {
  const robos: RoboDoBarco[] = [];
  const total = p.lx.length;
  const hw = p.def.meiaLargura;
  const ritmo = RITMO[dificuldade];
  for (let i = 0; i < quantos; i++) {
    const sorte = sorteio(p.def.semente * 97 + i * 11 + 5);
    // a grade: duas colunas, à frente de quem joga (que larga 60 antes da linha)
    const fila = Math.floor(i / 2);
    const recuo = Math.max(6, RECUO_DA_LARGADA - 16 - fila * 16);
    const faixa = (i % 2 ? 1 : -1) * 0.4 * hw;
    const frac = i / Math.max(1, quantos - 1);
    const teto = VCRUZEIRO * (ritmo.teto[0] + ritmo.teto[1] * frac + sorte() * ritmo.teto[2]);
    const curvas = ritmo.curvas[0] + ritmo.curvas[1] * frac + sorte() * ritmo.curvas[2];
    const s = new Float32Array(passos);
    const inicio = p.comprimento - recuo;
    const fim = recuo + p.def.voltas * p.comprimento;
    let pos = inicio, v = 0, chegada = 0;
    for (let n = 0; n < passos; n++) {
      const idx = pontoNaLinha(p, pos).indice;
      let kmax = 0;
      for (let k = 0; k < 14 + v / 5; k += 2) kmax = Math.max(kmax, p.curva[(idx + k) % total]);
      const alvo = Math.min(teto, kmax > 0 ? (GIRO / kmax) * curvas : teto);
      // o barco pega velocidade devagar (a água segura) e perde devagar também
      if (v < alvo) v += (alvo - v) * 0.9 * PASSO + (v < 30 ? 20 * PASSO : 0);
      else v = Math.max(alvo, v - 160 * PASSO);
      pos += v * PASSO;
      s[n] = pos;
      if (!chegada && pos - inicio >= fim) chegada = n + 1;
    }
    // ESTICA o caminho para a chegada cair no tempo da dificuldade (a forma de frear nas curvas fica a mesma)
    const duracao = RITMO_DA_CORRIDA[dificuldade];
    const alvo = Math.round(passosDoPiloto(p) * (duracao[1] - (duracao[1] - duracao[0]) * (quantos > 1 ? 1 - frac : 1) + sorte() * 0.02));
    const c0 = chegada || passos;
    const esticado = new Float32Array(passos);
    for (let n = 0; n < passos; n++) {
      const f = (n * c0) / alvo;
      const a = Math.min(passos - 1, Math.floor(f));
      const b = Math.min(passos - 1, a + 1);
      esticado[n] = s[a] + (s[b] - s[a]) * (f - a);
    }
    let nova = 0;
    for (let n = 0; n < passos && !nova; n++) if (esticado[n] - inicio >= fim) nova = n + 1;
    robos.push({ i, s: esticado, chegada: nova || passos, recuo, faixa, fase: sorte() * 6 });
  }
  return robos;
}

/** Onde está o barco do computador no passo `n` (antes da largada, parado na grade). */
export function roboDoBarcoEm(p: PistaDoBarco, r: RoboDoBarco, n: number) {
  const k = Math.max(0, Math.min(r.s.length - 1, n - 1));
  const s = n <= 0 ? p.comprimento - r.recuo : r.s[k];
  const q = pontoNaLinha(p, s);
  const balanco = n <= 0 ? 0 : Math.sin(s / 120 + r.fase) * p.def.meiaLargura * 0.25;
  const lado = r.faixa + balanco;
  const proximo = pontoNaLinha(p, s + 6);
  const v = n <= 1 ? 0 : (r.s[k] - r.s[Math.max(0, k - 1)]) / PASSO;
  return {
    x: q.x - q.dy * lado,
    y: q.y + q.dx * lado,
    angulo: Math.atan2(proximo.dy, proximo.dx),
    andou: (s - p.comprimento) / p.comprimento,
    v,
    banco: Math.max(-1, Math.min(1, Math.cos(s / 120 + r.fase) * 0.4)),
  };
}
