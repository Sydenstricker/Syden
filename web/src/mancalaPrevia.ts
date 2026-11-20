/**
 * A PRÉVIA DA SEMEADURA DA MANCALA (20/11/2026, a segunda auditoria): com o mouse por cima de uma cova (ou o primeiro toque), a
 * mesa acende a casa onde a última semente cai e diz, com um selo, se o lance JOGA DE NOVO ou CAPTURA. É a mesma conta do
 * servidor (`semear` e `semearOware` em server/src/minijogo-tabuleiro.ts), só lida: quem decide o lance continua sendo ele, e
 * `web/test/mesas-previa.test.ts` confere as duas contas lado a lado em partidas sorteadas.
 */

export type LadoDaMancala = 0 | 1;
export type VarianteDaMancala = 'kalah' | 'oware';

export interface PreviaDaSemeadura {
  /** A casa onde cai a última semente. */
  ultima: number;
  /** O lance dá outra vez a quem jogou (só no Kalah: a última no próprio depósito). */
  deNovo: boolean;
  /** Quantas sementes o lance leva (0: nenhuma captura). */
  captura: number;
}

const deposito = (lado: LadoDaMancala) => (lado === 0 ? 6 : 13);
const casasDe = (lado: LadoDaMancala) => (lado === 0 ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12]);

/** O que acontece se `lado` jogar a `casa`, sem mexer em `casas`. Casa vazia dá null. */
export function previaDaSemeadura(casas: readonly number[], lado: LadoDaMancala, casa: number, variante: VarianteDaMancala = 'kalah'): PreviaDaSemeadura | null {
  if (!(casas[casa] > 0)) return null;
  const c = casas.slice();
  const outro: LadoDaMancala = lado === 0 ? 1 : 0;
  let mao = c[casa];
  c[casa] = 0;
  let i = casa;
  while (mao > 0) {
    i = (i + 1) % 14;
    if (variante === 'oware' ? i === 6 || i === 13 || i === casa : i === deposito(outro)) continue;
    c[i]++;
    mao--;
  }
  if (variante === 'kalah') {
    if (i === deposito(lado)) return { ultima: i, deNovo: true, captura: 0 };
    if (casasDe(lado).includes(i) && c[i] === 1 && c[12 - i] > 0) return { ultima: i, deNovo: false, captura: c[12 - i] + 1 };
    return { ultima: i, deNovo: false, captura: 0 };
  }
  // o Oware: a última na casa do outro com 2 ou 3 leva essa e as anteriores com 2 ou 3, se o outro não ficar sem nada
  if (!casasDe(outro).includes(i)) return { ultima: i, deNovo: false, captura: 0 };
  const levar: number[] = [];
  for (let k = i; casasDe(outro).includes(k) && (c[k] === 2 || c[k] === 3); k--) levar.push(k);
  const sobra = casasDe(outro)
    .filter((k) => !levar.includes(k))
    .reduce((s, k) => s + c[k], 0);
  const captura = levar.length && sobra > 0 ? levar.reduce((s, k) => s + c[k], 0) : 0;
  return { ultima: i, deNovo: false, captura };
}
