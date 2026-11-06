/**
 * O FOGUETE DE CENOURA (05/11/2026; Pump, Pump and Away no levantamento em docs/mario-party-3.md, só a mecânica): o coelho
 * bombeia ar no foguete, e cada bombada vale pelo RITMO: um anel se fecha sobre a bomba e acende na batida, e quem bombeia
 * na batida enche mais. Bombada fora do ritmo (ou duas na mesma batida) engasga e perde ar. No fim, o foguete sobe pelo ar que
 * juntou; ganha quem foi mais alto.
 *
 * Cada bombada vai na hora (a ação 'acerto', com o instante dela na tela) e só vale se couber no relógio do servidor. A conta
 * (`bombar`) é só + − × ÷, Math.round e Math.abs, e a tela roda a mesma.
 */
import { microjogo, numero, type Resultado } from './comum.js';

/** A primeira batida, e quantas são. */
export const FOGUETE_PRIMEIRA_MS = 900;
export const FOGUETE_BATIDAS = 16;
/** Os degraus do ritmo (ms de erro para cada lado) e o que cada um vale. */
export const FOGUETE_NA_MOSCA = 70;
export const FOGUETE_PERTO = 150;
export const FOGUETE_LONGE = 250;
/** Quantos metros cada ponto de ar vale (só para a revelação). */
export const METROS_POR_PONTO = 10;

export interface DadosFoguete {
  /** Entre duas batidas, em ms. */
  periodoMs: number;
}

export const ultimaBatida = (d: DadosFoguete) => FOGUETE_PRIMEIRA_MS + (FOGUETE_BATIDAS - 1) * d.periodoMs;
/** Até quando se bombeia: a última batida, e a folga do "longe" depois dela. */
export const fimDoFoguete = (d: DadosFoguete) => ultimaBatida(d) + FOGUETE_LONGE;

export interface Bomba {
  ar: number;
  /** As batidas já usadas. */
  usadas: number[];
  /** Quantas bombadas contaram, e quantas engasgaram (para a tela). */
  boas: number;
  engasgos: number;
}

export const bombaNova = (): Bomba => ({ ar: 0, usadas: [], boas: 0, engasgos: 0 });

/** O que a bombada no instante t vale: 3, 2 ou 1 no ritmo, −1 engasgando. */
export function valorDaBombada(d: DadosFoguete, b: Bomba, t: number): { k: number; vale: number } {
  const k = Math.min(FOGUETE_BATIDAS - 1, Math.max(0, Math.round((t - FOGUETE_PRIMEIRA_MS) / d.periodoMs)));
  const erro = Math.abs(t - (FOGUETE_PRIMEIRA_MS + k * d.periodoMs));
  if (b.usadas.includes(k) || erro > FOGUETE_LONGE) return { k, vale: -1 };
  return { k, vale: erro <= FOGUETE_NA_MOSCA ? 3 : erro <= FOGUETE_PERTO ? 2 : 1 };
}

/** Uma bombada no instante t: a mesma conta na tela e no servidor. Muda a bomba no lugar, e devolve o que valeu. */
export function bombar(d: DadosFoguete, b: Bomba, t: number): number {
  const { k, vale } = valorDaBombada(d, b, t);
  if (vale > 0) {
    b.usadas.push(k);
    b.boas++;
  } else b.engasgos++;
  b.ar = Math.max(0, b.ar + vale);
  return vale;
}

const peloAr = (ar: number): Resultado => (ar === 0 ? { motivo: 'errou', valor: 0, chave: [] } : { motivo: null, valor: ar * METROS_POR_PONTO, chave: [-ar] });

type Mem = Map<number, Bomba>;

export default microjogo<DadosFoguete, Mem>({
  id: 'foguete',
  gerar: (aleatorio) => ({ periodoMs: 560 + Math.floor(aleatorio() * 140) }),
  duracao: (d) => fimDoFoguete(d) + 1500,
  memoria: () => new Map(),
  acerto({ dados, mem, quem, corpo, cabe }) {
    const t = corpo.t;
    // a bombada é a de agora (com a folga da rede): mandar a lista das perfeitas depois não vale
    if (!numero(t) || t < 0 || t > fimDoFoguete(dados) || !cabe(t)) return;
    const b = mem.get(quem) ?? bombaNova();
    // um teto de gente: o triplo das batidas (quem martela engasga e perde ar, mas não enche a memória)
    if (b.boas + b.engasgos >= FOGUETE_BATIDAS * 3) return;
    bombar(dados, b, Math.round(t));
    mem.set(quem, b);
  },
  avaliar: ({ mem, quem }) => peloAr(mem.get(quem)?.ar ?? 0),
  *noFim({ mem }) {
    for (const [quem, b] of mem) yield [quem, peloAr(b.ar)] as [number, Resultado];
  },
  robo(dados, aleatorio, passouMs) {
    // quem tem ritmo: quase todas as batidas, em média uns 2,3 pontos cada
    const cabem = Math.max(0, Math.min(FOGUETE_BATIDAS, Math.floor((passouMs - FOGUETE_PRIMEIRA_MS) / dados.periodoMs) + 1));
    const ar = Math.round(cabem * (1.8 + aleatorio() * 0.9));
    return peloAr(ar);
  },
});
