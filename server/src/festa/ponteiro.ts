/**
 * PULA O PONTEIRO (05/11/2026; do levantamento em docs/mario-party-3.md, só a mecânica): no meio da horta, um ponteiro de
 * madeira gira rente ao chão, e o coelho tem de pular quando ele passa. Cada volta é mais rápida; quem é atingido sai. A
 * posição é por quantas passagens aguentou.
 *
 * O SERVIDOR CONFERE CADA PULO: o pulo vai na hora (ação 'acerto', com o instante dele na tela), e só vale se couber no
 * relógio do servidor. O coelho fica PULO_MS no ar e depois precisa de RECARGA_MS no chão: pular sem parar não cobre as
 * passagens (a mesma regra roda na tela). As contas são só + − e comparação, iguais nos dois lados.
 */
import { microjogo, numero, type Resultado } from './comum.js';

/** Quanto o coelho fica no ar. */
export const PULO_MS = 520;
/** Quanto ele fica no chão antes de poder pular de novo. */
export const RECARGA_MS = 180;
export const PASSAGENS = 20;
/** A primeira volta e a mais rápida. */
export const VOLTA_INICIAL_MS = 1900;
export const VOLTA_MINIMA_MS = 760;

export interface DadosPonteiro {
  /** Quando o ponteiro passa pelo coelho (ms desde o começo). Começa do lado oposto, meia volta antes da primeira. */
  passagens: number[];
}

/** Um pulo novo vale se o coelho já voltou ao chão e descansou. */
export const podePular = (ultimo: number | undefined, t: number) => ultimo === undefined || t >= ultimo + PULO_MS + RECARGA_MS;
/** O coelho está no ar no instante `t`. */
export const noAr = (pulo: number, t: number) => pulo <= t && t < pulo + PULO_MS;

/** Quantas passagens seguidas, desde a primeira, os pulos cobriram (só as que já aconteceram até `ate`). */
export function passagensAguentadas(passagens: number[], pulos: number[], ate = Infinity): number {
  let n = 0;
  for (const p of passagens) {
    if (p > ate) break;
    if (!pulos.some((pulo) => noAr(pulo, p))) break;
    n++;
  }
  return n;
}

const peloQueAguentou = (n: number): Resultado => (n === 0 ? { motivo: 'errou', valor: 0, chave: [] } : { motivo: null, valor: n, chave: [-n] });

export default microjogo<DadosPonteiro, Map<number, number[]>>({
  id: 'ponteiro',
  gerar(aleatorio) {
    const passagens: number[] = [];
    let volta = VOLTA_INICIAL_MS;
    let t = Math.round(volta / 2);
    for (let k = 0; k < PASSAGENS; k++) {
      passagens.push(t);
      // cada volta mais rápida, com um pouco de surpresa (nunca abaixo da mínima)
      volta = Math.max(VOLTA_MINIMA_MS, volta - 50 - Math.floor(aleatorio() * 50));
      t += volta;
    }
    return { passagens };
  },
  duracao: (d) => d.passagens[d.passagens.length - 1] + 1500,
  memoria: () => new Map(),
  acerto({ dados, mem, quem, corpo, cabe }) {
    const t = corpo.t;
    // o pulo tem de ser o de agora (com a folga da rede): não vale mandar a lista dos pulos perfeitos depois
    if (!numero(t) || t < 0 || t > dados.passagens[dados.passagens.length - 1] || !cabe(t)) return;
    const meus = mem.get(quem) ?? [];
    if (!podePular(meus[meus.length - 1], t)) return;
    meus.push(t);
    mem.set(quem, meus);
  },
  // conta só as passagens que o servidor já viu acontecer (o pulo de cada uma chegou antes deste fim)
  avaliar: ({ dados, mem, quem, passou, abaixo }) => peloQueAguentou(passagensAguentadas(dados.passagens, mem.get(quem) ?? [], passou + abaixo)),
  *noFim({ dados, mem }) {
    for (const [quem, pulos] of mem) yield [quem, peloQueAguentou(passagensAguentadas(dados.passagens, pulos))] as [number, Resultado];
  },
  robo(dados, aleatorio, passouMs) {
    const cabem = dados.passagens.filter((p) => p <= passouMs).length;
    const n = Math.min(cabem, 5 + Math.floor(aleatorio() * 12));
    return peloQueAguentou(n);
  },
});
