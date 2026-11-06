/**
 * TRINCA DA HORTA (05/11/2026; do levantamento em docs/mario-party-3.md, só a mecânica do "pare as figuras iguais"): três
 * rolos com as figuras da horta giram sem parar, cada um no seu ritmo. Aperta-se três vezes, um rolo de cada vez, da esquerda
 * para a direita, para parar a figura de cada um na janela: três iguais é uma trinca. Depois de um instante, os rolos voltam a
 * girar e se tenta de novo. Vale quantas trincas, e no empate, quantos pares. SEM APOSTA NENHUMA: não há ficha, moeda, prêmio
 * nem nada que se perca (cassino está fora do Syden); é um jogo de tempo.
 *
 * O SERVIDOR REFAZ A CONTA DE CADA PARADA: cada aperto vai na hora (ação 'acerto', com o instante na tela), e a figura na janela
 * naquele instante sai da mesma conta nos dois lados (só + × ÷, Math.floor e %). O instante precisa caber no relógio do servidor.
 */
import { microjogo, numero, REACAO_MINIMA, type Resultado } from './comum.js';

export const ROLOS = 3;
/** As figuras (a tela desenha cada uma, no mesmo índice) e quantas há em cada rolo. */
export const FIGURAS_DA_TRINCA = 6;
export const TRINCA_MS = 20000;
/** Entre um aperto e o próximo. */
export const ENTRE_PARADAS_MS = 120;
/** Depois da terceira parada, os rolos ficam parados isto (a pessoa vê se deu trinca) antes de voltar a girar. */
export const PAUSA_MS = 700;

export interface DadosTrinca {
  /** Cada rolo: a ordem das figuras nele e quanto cada figura leva para passar pela janela (ms). */
  rolos: { figuras: number[]; passo: number }[];
}

/** A figura (o índice em `figuras`) que está na janela do rolo no instante `t`: a que passa mais perto do meio. */
export const posicaoNoRolo = (rolo: { figuras: number[]; passo: number }, t: number) =>
  Math.floor((t + rolo.passo / 2) / rolo.passo) % rolo.figuras.length;
export const figuraNaJanela = (rolo: { figuras: number[]; passo: number }, t: number) => rolo.figuras[posicaoNoRolo(rolo, t)];

/** Uma parada nova (de quem já parou em `paradas`) vale no instante `t`? A mesma regra na tela. */
export function podeParar(paradas: number[], t: number): boolean {
  if (t < REACAO_MINIMA || t > TRINCA_MS) return false;
  const ultima = paradas[paradas.length - 1];
  if (ultima === undefined) return true;
  return t >= ultima + (paradas.length % ROLOS === 0 ? PAUSA_MS : ENTRE_PARADAS_MS);
}

/** As trincas e os pares de quem parou nestes instantes (só as tentativas completas contam). */
export function contarTrincas(d: DadosTrinca, paradas: number[]) {
  let trincas = 0;
  let pares = 0;
  for (let k = 0; k + ROLOS <= paradas.length; k += ROLOS) {
    const [a, b, c] = [0, 1, 2].map((r) => figuraNaJanela(d.rolos[r], paradas[k + r]));
    if (a === b && b === c) trincas++;
    else if (a === b || b === c || a === c) pares++;
  }
  return { trincas, pares };
}

/** As paradas que valem, dos instantes recebidos em qualquer ordem (a rede pode trocar dois apertos seguidos): pela regra da
 * tela, `podeParar`, da primeira em diante. */
export function paradasQueValem(recebidas: number[]): number[] {
  const valem: number[] = [];
  for (const t of [...recebidas].sort((a, b) => a - b)) if (podeParar(valem, t)) valem.push(t);
  return valem;
}

const pelasParadas = (d: DadosTrinca, recebidas: number[] | undefined): Resultado => {
  const { trincas, pares } = contarTrincas(d, paradasQueValem(recebidas ?? []));
  if (trincas === 0 && pares === 0) return { motivo: 'errou', valor: 0, chave: [] };
  return { motivo: null, valor: trincas, chave: [-trincas, -pares] };
};

export default microjogo<DadosTrinca, Map<number, number[]>>({
  id: 'trinca',
  gerar(aleatorio) {
    const rolos = [];
    for (let r = 0; r < ROLOS; r++) {
      const figuras = Array.from({ length: FIGURAS_DA_TRINCA }, (_, i) => i);
      for (let i = figuras.length - 1; i > 0; i--) {
        const j = Math.floor(aleatorio() * (i + 1));
        [figuras[i], figuras[j]] = [figuras[j], figuras[i]];
      }
      // cada rolo num ritmo: o da direita, o mais rápido
      rolos.push({ figuras, passo: 230 - r * 25 + Math.floor(aleatorio() * 4) * 5 });
    }
    return { rolos };
  },
  duracao: () => TRINCA_MS + 1500,
  memoria: () => new Map(),
  acerto({ mem, quem, corpo, cabe }) {
    const t = corpo.t;
    if (!numero(t) || !cabe(t)) return;
    const minhas = mem.get(quem) ?? [];
    // a regra entre uma parada e outra se confere no fim (paradasQueValem); aqui, só um teto (mais de 100 em 20 s não é mão)
    if (minhas.length >= 100) return;
    minhas.push(Math.round(t));
    mem.set(quem, minhas);
  },
  avaliar: ({ dados, mem, quem }) => pelasParadas(dados, mem.get(quem)),
  *noFim({ dados, mem }) {
    for (const [quem, paradas] of mem) yield [quem, pelasParadas(dados, paradas)] as [number, Resultado];
  },
  robo(_d, aleatorio, passouMs) {
    // uma tentativa a cada uns 2,5 s, e um terço delas dá trinca
    const tentativas = Math.floor(Math.min(passouMs, TRINCA_MS) / (2200 + aleatorio() * 800));
    let trincas = 0;
    let pares = 0;
    for (let k = 0; k < tentativas; k++) {
      const s = aleatorio();
      if (s < 0.33) trincas++;
      else if (s < 0.85) pares++;
    }
    if (trincas === 0 && pares === 0) return { motivo: 'errou', valor: 0, chave: [] };
    return { motivo: null, valor: trincas, chave: [-trincas, -pares] };
  },
});
