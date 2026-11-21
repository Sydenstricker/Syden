import { duelo, type Lado, type Nivel, type Regras } from './minijogo-tabuleiro.js';

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
/**
 * O LADO DO TABULEIRO (21/11/2026, o lote D da segunda auditoria): 8 nas brasileiras (as de fábrica) e 10 nas INTERNACIONAIS,
 * escolhidas na largada. As internacionais têm a MESMA regra das brasileiras (comer para trás, a lei da maioria, a dama voadora,
 * coroar só terminando na última fileira); muda só o tabuleiro, de 100 casas, com 20 peças de cada lado nas quatro primeiras
 * fileiras. As contas tiram o lado do próprio tabuleiro (`casas.length`): 64 ou 100.
 */
export const ladoDasDamas = (v: unknown): 8 | 10 => (v === 10 ? 10 : 8);
const ladoDe = (casas: number[]) => (casas.length === 100 ? 10 : 8);
/** Para onde a pedra de cada cor anda: as claras sobem (para a linha 0), as escuras descem. */
const frente = (cor: Cor) => (cor === 0 ? -1 : 1);
const ultimaLinha = (cor: Cor, n = 8) => (cor === 0 ? 0 : n - 1);
const DIRECOES = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const;

export function posicaoInicial(n: 8 | 10 = 8): number[] {
  // as fileiras de cada lado: 3 no de 8, 4 no de 10 (sobram duas fileiras vazias no meio)
  const fileiras = n === 10 ? 4 : 3;
  return Array.from({ length: n * n }, (_, i) => {
    const l = Math.floor(i / n);
    if ((l + (i % n)) % 2 === 0) return VAZIA;
    return l < fileiras ? PEDRA_ESCURA : l >= n - fileiras ? PEDRA_CLARA : VAZIA;
  });
}

/**
 * Todas as cadeias de captura da peça em `de` (cada uma até não dar para comer mais nada). `paraTras` falso: a PEDRA só come
 * para a frente (a variante de 20/11/2026); a dama come para todo lado do mesmo jeito.
 */
function capturasDaPeca(casas: number[], de: number, saida: Lance[], paraTras = true) {
  const peca = casas[de];
  const cor = corDa(peca)!;
  const dama = eDama(peca);
  const n = ladoDe(casas);
  const dentro = (l: number, c: number) => l >= 0 && l < n && c >= 0 && c < n;
  // A casa de onde a peça saiu fica vazia durante o lance (a dama pode passar por ela, ou pousar nela).
  const tab = casas.slice();
  tab[de] = VAZIA;
  const caminho: number[] = [];
  const comidas: number[] = [];

  const buscar = (pos: number) => {
    let continuou = false;
    for (const [dl, dc] of DIRECOES) {
      if (!dama && !paraTras && dl !== frente(cor)) continue;
      let l = Math.floor(pos / n) + dl;
      let c = (pos % n) + dc;
      if (dama) {
        while (dentro(l, c) && tab[l * n + c] === VAZIA) {
          l += dl;
          c += dc;
        }
      }
      if (!dentro(l, c)) continue;
      const alvo = l * n + c;
      // Só se come peça do outro, e uma vez só: a já comida continua ali, e bloqueia.
      if (corDa(tab[alvo]) !== 1 - cor || comidas.includes(alvo)) continue;
      let l2 = l + dl;
      let c2 = c + dc;
      while (dentro(l2, c2) && tab[l2 * n + c2] === VAZIA) {
        continuou = true;
        comidas.push(alvo);
        caminho.push(l2 * n + c2);
        buscar(l2 * n + c2);
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

/**
 * Os lances que valem para `cor`: se dá para comer, só os que comem mais; senão, os simples. `paraTras` falso é a variante
 * em que a pedra não come para trás (20/11/2026).
 */
export function lancesDe(casas: number[], cor: Cor, paraTras = true): Lance[] {
  const n = ladoDe(casas);
  const dentro = (l: number, c: number) => l >= 0 && l < n && c >= 0 && c < n;
  const capturas: Lance[] = [];
  for (let i = 0; i < casas.length; i++) if (corDa(casas[i]) === cor) capturasDaPeca(casas, i, capturas, paraTras);
  if (capturas.length) {
    const maximo = Math.max(...capturas.map((x) => x.comidas.length));
    return capturas.filter((x) => x.comidas.length === maximo);
  }
  const simples: Lance[] = [];
  for (let i = 0; i < casas.length; i++) {
    if (corDa(casas[i]) !== cor) continue;
    const dama = eDama(casas[i]);
    for (const [dl, dc] of DIRECOES) {
      if (!dama && dl !== frente(cor)) continue;
      let l = Math.floor(i / n) + dl;
      let c = (i % n) + dc;
      while (dentro(l, c) && casas[l * n + c] === VAZIA) {
        simples.push({ de: i, caminho: [l * n + c], comidas: [] });
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
  const n = ladoDe(casas);
  if (!eDama(peca) && Math.floor(fim / n) === ultimaLinha(cor, n)) peca = cor === 0 ? DAMA_CLARA : DAMA_ESCURA;
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
  /** Quantas vezes cada posição (o tabuleiro e a cor da vez) já apareceu: a terceira empata (19/11/2026). */
  vistas: Record<string, number>;
  /**
   * A VARIANTE "PEDRA NÃO COME PARA TRÁS" (20/11/2026, o lote C da segunda auditoria), escolhida na largada: falso só nela. A
   * regra de fábrica continua a brasileira, em que a pedra come também para trás.
   */
  paraTras: boolean;
  /** O lado do tabuleiro (21/11/2026): 8 as brasileiras, 10 as internacionais. Sem ele (partida de antes), 8. */
  n?: 8 | 10;
}

/** A REPETIÇÃO TRIPLA (19/11/2026): a mesma posição, com a mesma cor na vez, pela terceira vez empata a partida. */
export const REPETICOES_PARA_EMPATE = 3;
const chaveDaPosicao = (casas: number[], vez: Cor) => `${casas.join('')}${vez}`;

/** As casas escuras numeradas de 1 a 32, de cima para baixo e da esquerda para a direita (a notação do papel). */
export const numeroDaCasa = (i: number) => Math.floor(i / 2) + 1;

/** O lance escrito: "22-18" o simples, "22x15x6" o que come (as casas por onde a peça passa). */
export const notacaoDoLance = (l: Lance) => [l.de, ...l.caminho].map(numeroDaCasa).join(l.comidas.length ? 'x' : '-');

const ladoDaCor = (e: EstadoDasDamas, cor: Cor): Lado => (cor === 0 ? e.claras : e.claras === 0 ? 1 : 0);
const contar = (casas: number[], cor: Cor) => casas.filter((p) => corDa(p) === cor).length;

export const regrasDasDamas: Regras<EstadoDasDamas> = {
  escolhas: (corpo) => ({ paraTras: corpo.paraTras !== false, tamanho: ladoDasDamas(corpo.tamanho) }),
  inicio(escolhas) {
    const n = ladoDasDamas(escolhas.tamanho);
    const casas = posicaoInicial(n);
    const paraTras = escolhas.paraTras !== false;
    return {
      casas,
      claras: 0,
      vezDaCor: 0,
      comecou: false,
      lances: lancesDe(casas, 0, paraTras),
      ultimo: null,
      semCaptura: 0,
      vistas: { [chaveDaPosicao(casas, 0)]: 1 },
      paraTras,
      n,
    };
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
    estado.lances = lancesDe(estado.casas, estado.vezDaCor, estado.paraTras !== false);
    const outro: Lado = lado === 0 ? 1 : 0;
    if (estado.lances.length === 0) return { proximo: outro, vencedor: lado };
    if (estado.semCaptura >= LANCES_PARA_EMPATE) return { proximo: outro, vencedor: 'empate' };
    const chave = chaveDaPosicao(estado.casas, estado.vezDaCor);
    estado.vistas ??= {};
    estado.vistas[chave] = (estado.vistas[chave] ?? 0) + 1;
    if (estado.vistas[chave] >= REPETICOES_PARA_EMPATE) return { proximo: outro, vencedor: 'empate' };
    return { proximo: outro };
  },
  descrever: (estado) => (estado.ultimo ? notacaoDoLance(estado.ultimo) : ''),
  publico(estado, lado) {
    const daVez = estado.comecou && lado !== null && ladoDaCor(estado, estado.vezDaCor) === lado;
    return {
      casas: estado.casas,
      claras: estado.claras,
      ultimo: estado.ultimo,
      restam: [contar(estado.casas, 0), contar(estado.casas, 1)],
      semCaptura: estado.semCaptura,
      // o empate pela regra: a mesma posição pela terceira vez
      repetida: Object.values(estado.vistas ?? {}).some((n) => n >= REPETICOES_PARA_EMPATE),
      paraTras: estado.paraTras !== false,
      tamanho: estado.n ?? 8,
      lances: daVez ? estado.lances : [],
    };
  },
};

/** Quantos lances (somando os dois lados) o robô das Damas olha à frente. */
export const PROFUNDIDADE_DAS_DAMAS = 4;

/**
 * O que a posição vale para `cor`: a pedra vale 1, a dama 3, e a pedra que avançou ganha um pouco (ela está mais perto de
 * virar dama).
 */
function valorDaPosicao(casas: number[], cor: Cor): number {
  const n = ladoDe(casas);
  let v = 0;
  for (let i = 0; i < casas.length; i++) {
    const p = casas[i];
    const dona = corDa(p);
    if (dona === null) continue;
    const avanco = dona === 0 ? n - 1 - Math.floor(i / n) : Math.floor(i / n);
    const pedaco = eDama(p) ? 3 : 1 + avanco * 0.04;
    v += dona === cor ? pedaco : -pedaco;
  }
  return v;
}

/**
 * O ROBÔ DAS DAMAS: minimax com poda, PROFUNDIDADE_DAS_DAMAS lances à frente, sobre os mesmos lances que o servidor gera
 * para a pessoa (comer obrigatório, lei da maioria: ele não tem regra própria). Conta o material; quem fica sem lance perde.
 * Um tantinho de sorte desempata os lances iguais. Devolve o índice do lance na lista de quem tem a vez.
 */
export function lanceDoRobo(casas: number[], cor: Cor, aleatorio: () => number = Math.random, profundidade = PROFUNDIDADE_DAS_DAMAS, ruido = 0.05, paraTras = true): number {
  const gerar = (tab: number[], c: Cor) => lancesDe(tab, c, paraTras);
  const lances = gerar(casas, cor);
  const outra: Cor = cor === 0 ? 1 : 0;
  const busca = (tab: number[], vezDe: Cor, falta: number, alfa: number, beta: number): number => {
    const opcoes = gerar(tab, vezDe);
    // sem lance, quem tem a vez perde (quanto mais cedo, pior ou melhor)
    if (!opcoes.length) return vezDe === cor ? -1000 - falta : 1000 + falta;
    if (falta === 0) return valorDaPosicao(tab, cor);
    let melhor = vezDe === cor ? -Infinity : Infinity;
    for (const l of opcoes) {
      const copia = tab.slice();
      aplicar(copia, l);
      const v = busca(copia, vezDe === 0 ? 1 : 0, falta - 1, alfa, beta);
      if (vezDe === cor) {
        melhor = Math.max(melhor, v);
        alfa = Math.max(alfa, v);
      } else {
        melhor = Math.min(melhor, v);
        beta = Math.min(beta, v);
      }
      if (beta <= alfa) break;
    }
    return melhor;
  };
  let escolha = 0;
  let melhorValor = -Infinity;
  lances.forEach((l, k) => {
    const copia = casas.slice();
    aplicar(copia, l);
    const v = busca(copia, outra, profundidade - 1, -Infinity, Infinity) + aleatorio() * ruido;
    if (v > melhorValor) {
      melhorValor = v;
      escolha = k;
    }
  });
  return escolha;
}

/** Os NÍVEIS do robô das Damas (19/11/2026): quantos lances ele olha e quanto sorteia entre os parecidos. */
export const NIVEL_DAS_DAMAS: Record<Nivel, { profundidade: number; ruido: number }> = {
  facil: { profundidade: 2, ruido: 0.9 },
  normal: { profundidade: PROFUNDIDADE_DAS_DAMAS, ruido: 0.05 },
  dificil: { profundidade: 6, ruido: 0.01 },
};

/**
 * No tabuleiro de 10 (21/11/2026) há mais lances por vez, e a conta roda na thread do servidor: medido, o difícil de 6 lances
 * levava até ~1 s por jogada, e o de 5, ~0,7 s. Lá cada nível olha um pouco menos (o difícil, 4: até ~0,1 s).
 */
export const NIVEL_DAS_DAMAS_10: Record<Nivel, { profundidade: number; ruido: number }> = {
  facil: { profundidade: 2, ruido: 0.9 },
  normal: { profundidade: 3, ruido: 0.05 },
  dificil: { profundidade: 4, ruido: 0.01 },
};

export const damas = duelo<EstadoDasDamas>({
  ...regrasDasDamas,
  // o tabuleiro das damas é aberto: o robô vê o mesmo que a pessoa
  robo: (estado, _lado, aleatorio, nivel) => {
    const { profundidade, ruido } = (estado.n === 10 ? NIVEL_DAS_DAMAS_10 : NIVEL_DAS_DAMAS)[nivel];
    return { lance: lanceDoRobo(estado.casas, estado.vezDaCor, aleatorio, profundidade, ruido, estado.paraTras !== false) };
  },
});
