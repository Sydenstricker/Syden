/**
 * DESTAMPE OS POTES (05/11/2026; do levantamento em docs/mario-party-3.md, só a mecânica do "gire os parafusos para o lado
 * certo"): na mesa, uma fila de potes de conserva, cada tampa com a seta do lado em que abre e as voltas que faltam. Gira-se
 * para o lado da seta, depressa: girar para o lado errado aperta de novo. Destampado um, vem o próximo. Vale quantos potes se
 * abriram, e no empate, quem abriu o último antes.
 *
 * CADA POTE ABERTO VAI NA HORA (ação 'acerto', com o instante na tela), e o servidor confere que ele cabe no relógio dele e que
 * houve tempo de mão para as voltas daquele pote (nenhum programa abre vinte potes num segundo). Cada giro não vai à rede: seriam
 * dez mensagens por segundo, por pessoa, para nada que o servidor pudesse conferir melhor.
 */
import { inteiro, microjogo, numero, REACAO_MINIMA, type Resultado } from './comum.js';

export const POTES_MS = 15000;
export const POTES_NA_FILA = 30;
/** Um giro leva pelo menos isto: mais rápido que isto não é mão. */
export const GIRO_MINIMO_MS = 60;

export interface DadosPotes {
  /** Cada pote: o lado em que a tampa abre (−1 para a esquerda, 1 para a direita) e quantas voltas pede. */
  potes: { lado: number; voltas: number }[];
}

/** Quando cada pote foi aberto, pelo índice dele (as mensagens podem chegar trocadas pela rede). */
type Abertos = Map<number, number>;

/**
 * Os potes abertos que valem: do primeiro em diante, sem pular nenhum, e cada um com tempo de mão para as voltas dele depois do
 * anterior. Devolve os instantes, na ordem.
 */
export function potesQueValem(d: DadosPotes, abertos: Abertos): number[] {
  const valem: number[] = [];
  for (let i = 0; i < d.potes.length; i++) {
    const t = abertos.get(i);
    const antes = valem[i - 1] ?? REACAO_MINIMA;
    if (t === undefined || t < antes + d.potes[i].voltas * GIRO_MINIMO_MS) break;
    valem.push(t);
  }
  return valem;
}

const pelosPotes = (d: DadosPotes, abertos: Abertos | undefined): Resultado => {
  const valem = potesQueValem(d, abertos ?? new Map());
  const n = valem.length;
  if (n === 0) return { motivo: 'errou', valor: 0, chave: [] };
  return { motivo: null, valor: n, chave: [-n, valem[n - 1]] };
};

export default microjogo<DadosPotes, Map<number, Abertos>>({
  id: 'potes',
  gerar(aleatorio) {
    const potes = [];
    for (let i = 0; i < POTES_NA_FILA; i++) {
      // os primeiros pedem menos voltas; o lado é sorteado, sem repetir mais de três vezes seguidas
      const voltas = 3 + Math.floor(aleatorio() * (i < 3 ? 2 : 4));
      let lado = aleatorio() < 0.5 ? -1 : 1;
      if (i >= 3 && potes.slice(-3).every((p) => p.lado === lado)) lado = -lado;
      potes.push({ lado, voltas });
    }
    return { potes };
  },
  duracao: () => POTES_MS + 1500,
  memoria: () => new Map(),
  acerto({ dados, mem, quem, corpo, cabe }) {
    const { i, t } = corpo;
    const abertos = mem.get(quem) ?? new Map<number, number>();
    // um pote da fila, no instante de agora (com a rede da pessoa); a ordem e o tempo de mão se conferem no fim (potesQueValem)
    if (!inteiro(i) || i < 0 || i >= dados.potes.length || abertos.has(i) || !numero(t) || t > POTES_MS || !cabe(t)) return;
    abertos.set(i, Math.round(t));
    mem.set(quem, abertos);
  },
  avaliar: ({ dados, mem, quem }) => pelosPotes(dados, mem.get(quem)),
  *noFim({ dados, mem }) {
    for (const [quem, abertos] of mem) if (abertos.size) yield [quem, pelosPotes(dados, abertos)] as [number, Resultado];
  },
  robo(dados, aleatorio, passouMs) {
    // uns 7 giros por segundo, com um erro de lado de vez em quando
    const porGiro = 130 + aleatorio() * 50;
    const abertos: Abertos = new Map();
    let t = 400;
    for (const [i, pote] of dados.potes.entries()) {
      t += pote.voltas * porGiro + (aleatorio() < 0.2 ? 2 * porGiro : 0) + 120;
      if (t > Math.min(passouMs, POTES_MS)) break;
      abertos.set(i, Math.round(t));
    }
    return pelosPotes(dados, abertos);
  },
});
