import { duelo, type Lado, type Regras } from './minijogo-tabuleiro.js';

/**
 * AS DAMAS BRASILEIRAS (04/11/2026): o tabuleiro de 64 casas, pela regra da Confederação Brasileira de Damas. Só a
 * regra, que é pública; o tabuleiro e as peças são desenhados por código no site.
 *
 * - Joga-se nas casas escuras; 12 peças de cada lado, nas três primeiras fileiras. Quem abre fica com as CLARAS.
 * - A pedra anda uma casa na diagonal, para a frente. COMER É OBRIGATÓRIO, para a frente e para trás, e em cadeia.
 * - LEI DA MAIORIA: entre os lances que comem, vale só o que come MAIS peças (a dama conta como uma pedra); empatando,
 *   qualquer um deles.
 * - A dama VOA: anda a diagonal inteira, come à distância e pousa em qualquer casa vazia depois da peça comida.
 * - As peças comidas saem só NO FIM do lance, e a mesma peça não é comida duas vezes: enquanto o lance anda, elas
 *   continuam no tabuleiro, bloqueando o caminho.
 * - A pedra só vira dama se TERMINAR o lance na última fileira; passando por ela no meio de uma cadeia, continua pedra.
 * - Quem não tem lance (sem peças, ou todas presas) perde.
 * - EMPATE: 20 lances seguidos (somando os dois) só de dama e sem comer nada. As regras de final da CBD (2 damas contra
 *   1, 5 lances etc.) ficaram de fora, de propósito: a regra dos 20 cobre o final de damas, e é a que dá para explicar.
 *
 * O SERVIDOR GERA OS LANCES e manda a lista a quem tem a vez: o site nunca refaz a regra, só escolhe um da lista.
 *
 * As casas: `linha * 8 + coluna`, com a linha 0 no alto (o lado das escuras) e a coluna 0 à esquerda de quem joga de
 * claras. A casa escura é a de (linha + coluna) ímpar: a7 (linha 7, coluna 0) é escura, como manda o tabuleiro.
 */

export const VAZIA = 0;
export const PEDRA_CLARA = 1;
export const DAMA_CLARA = 2;
export const PEDRA_ESCURA = 3;
export const DAMA_ESCURA = 4;

/** 0: as claras; 1: as escuras. */
export type Cor = 0 | 1;

export interface Lance {
  de: number;
  /** As casas por onde a peça passa, em ordem; a última é onde ela fica. */
  caminho: number[];
  /** As casas das peças comidas, na ordem em que foram comidas. */
  comidas: number[];
}

/** Lances seguidos só de dama, sem comer nada, que empatam a partida. */
export const LANCES_PARA_EMPATE = 20;

export const corDa = (peca: number): Cor | null => (peca === VAZIA ? null : peca <= DAMA_CLARA ? 0 : 1);
export const eDama = (peca: number) => peca === DAMA_CLARA || peca === DAMA_ESCURA;
const linhaDe = (i: number) => Math.floor(i / 8);
const colunaDe = (i: number) => i % 8;
const dentro = (l: number, c: number) => l >= 0 && l < 8 && c >= 0 && c < 8;
/** Para onde a pedra de cada cor anda: as claras sobem (para a linha 0), as escuras descem. */
const frente = (cor: Cor) => (cor === 0 ? -1 : 1);
const ultimaLinha = (cor: Cor) => (cor === 0 ? 0 : 7);
const DIRECOES = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const;

export function posicaoInicial(): number[] {
  return Array.from({ length: 64 }, (_, i) => {
    const l = linhaDe(i);
    if ((l + colunaDe(i)) % 2 === 0) return VAZIA;
    return l <= 2 ? PEDRA_ESCURA : l >= 5 ? PEDRA_CLARA : VAZIA;
  });
}

/** Todas as cadeias de captura da peça em `de` (cada uma até não dar para comer mais nada). */
function capturasDaPeca(casas: number[], de: number, saida: Lance[]) {
  const peca = casas[de];
  const cor = corDa(peca)!;
  const dama = eDama(peca);
  // A casa de onde a peça saiu fica vazia durante o lance (a dama pode passar por ela, ou pousar nela).
  const tab = casas.slice();
  tab[de] = VAZIA;
  const caminho: number[] = [];
  const comidas: number[] = [];

  const buscar = (pos: number) => {
    let continuou = false;
    for (const [dl, dc] of DIRECOES) {
      let l = linhaDe(pos) + dl;
      let c = colunaDe(pos) + dc;
      if (dama) {
        while (dentro(l, c) && tab[l * 8 + c] === VAZIA) {
          l += dl;
          c += dc;
        }
      }
      if (!dentro(l, c)) continue;
      const alvo = l * 8 + c;
      // Só se come peça do outro, e uma vez só: a já comida continua ali, e bloqueia.
      if (corDa(tab[alvo]) !== 1 - cor || comidas.includes(alvo)) continue;
      let l2 = l + dl;
      let c2 = c + dc;
      while (dentro(l2, c2) && tab[l2 * 8 + c2] === VAZIA) {
        continuou = true;
        comidas.push(alvo);
        caminho.push(l2 * 8 + c2);
        buscar(l2 * 8 + c2);
        comidas.pop();
        caminho.pop();
        if (!dama) break;
        l2 += dl;
        c2 += dc;
      }
    }
    if (!continuou && comidas.length > 0) saida.push({ de, caminho: [...caminho], comidas: [...comidas] });
  };
  buscar(de);
}

/** Os lances que valem para `cor`: se dá para comer, só os que comem mais; senão, os simples. */
export function lancesDe(casas: number[], cor: Cor): Lance[] {
  const capturas: Lance[] = [];
  for (let i = 0; i < 64; i++) if (corDa(casas[i]) === cor) capturasDaPeca(casas, i, capturas);
  if (capturas.length) {
    const maximo = Math.max(...capturas.map((x) => x.comidas.length));
    return capturas.filter((x) => x.comidas.length === maximo);
  }
  const simples: Lance[] = [];
  for (let i = 0; i < 64; i++) {
    if (corDa(casas[i]) !== cor) continue;
    const dama = eDama(casas[i]);
    for (const [dl, dc] of DIRECOES) {
      if (!dama && dl !== frente(cor)) continue;
      let l = linhaDe(i) + dl;
      let c = colunaDe(i) + dc;
      while (dentro(l, c) && casas[l * 8 + c] === VAZIA) {
        simples.push({ de: i, caminho: [l * 8 + c], comidas: [] });
        if (!dama) break;
        l += dl;
        c += dc;
      }
    }
  }
  return simples;
}

/** Faz o lance no tabuleiro: tira as comidas, leva a peça e a coroa se ela TERMINOU na última fileira. */
export function aplicar(casas: number[], lance: Lance) {
  let peca = casas[lance.de];
  const cor = corDa(peca)!;
  casas[lance.de] = VAZIA;
  for (const i of lance.comidas) casas[i] = VAZIA;
  const fim = lance.caminho[lance.caminho.length - 1];
  if (!eDama(peca) && linhaDe(fim) === ultimaLinha(cor)) peca = cor === 0 ? DAMA_CLARA : DAMA_ESCURA;
  casas[fim] = peca;
}

export interface EstadoDasDamas {
  casas: number[];
  /** O lado da mesa que joga com as claras (quem abre). */
  claras: Lado;
  /** A cor que tem a vez. */
  vezDaCor: Cor;
  comecou: boolean;
  /** Os lances de quem tem a vez (calculados uma vez por lance). */
  lances: Lance[];
  ultimo: Lance | null;
  /** Lances seguidos só de dama e sem comer. */
  semCaptura: number;
}

const ladoDaCor = (e: EstadoDasDamas, cor: Cor): Lado => (cor === 0 ? e.claras : e.claras === 0 ? 1 : 0);
const contar = (casas: number[], cor: Cor) => casas.filter((p) => corDa(p) === cor).length;

export const regrasDasDamas: Regras<EstadoDasDamas> = {
  inicio() {
    const casas = posicaoInicial();
    return { casas, claras: 0, vezDaCor: 0, comecou: false, lances: lancesDe(casas, 0), ultimo: null, semCaptura: 0 };
  },
  aoComecar(estado, primeiro) {
    estado.claras = primeiro;
    estado.comecou = true;
  },
  jogar(estado, lado, corpo) {
    if (ladoDaCor(estado, estado.vezDaCor) !== lado) return 'Espere a sua vez.';
    const n = Number(corpo.lance);
    if (!Number.isInteger(n) || n < 0 || n >= estado.lances.length) return 'Esse lance não vale.';
    const lance = estado.lances[n];
    // O site manda também o lance que viu: se a lista mudou nesse meio-tempo, o número aponta para outro.
    if (corpo.de !== undefined || corpo.caminho !== undefined) {
      const caminho = Array.isArray(corpo.caminho) ? corpo.caminho : [];
      if (corpo.de !== lance.de || caminho.length !== lance.caminho.length || caminho.some((x, k) => x !== lance.caminho[k])) {
        return 'Esse lance não vale mais.';
      }
    }
    const deDama = eDama(estado.casas[lance.de]);
    aplicar(estado.casas, lance);
    estado.ultimo = lance;
    estado.semCaptura = deDama && lance.comidas.length === 0 ? estado.semCaptura + 1 : 0;
    estado.vezDaCor = estado.vezDaCor === 0 ? 1 : 0;
    estado.lances = lancesDe(estado.casas, estado.vezDaCor);
    const outro: Lado = lado === 0 ? 1 : 0;
    if (estado.lances.length === 0) return { proximo: outro, vencedor: lado };
    if (estado.semCaptura >= LANCES_PARA_EMPATE) return { proximo: outro, vencedor: 'empate' };
    return { proximo: outro };
  },
  publico(estado, lado) {
    const daVez = estado.comecou && lado !== null && ladoDaCor(estado, estado.vezDaCor) === lado;
    return {
      casas: estado.casas,
      claras: estado.claras,
      ultimo: estado.ultimo,
      restam: [contar(estado.casas, 0), contar(estado.casas, 1)],
      semCaptura: estado.semCaptura,
      lances: daVez ? estado.lances : [],
    };
  },
};

export const damas = duelo<EstadoDasDamas>(regrasDasDamas);
