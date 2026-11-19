import { Chess, type Move } from 'chess.js';
import { duelo, type Lado, type Nivel } from './minijogo-tabuleiro.js';

/**
 * A PARTIDA DE XADREZ (05/11/2026, pedido dele: "adicione xadrez também, com os assets que estão na pasta"). A mesa de duas
 * pessoas (duelo), com a sala assistindo, e no Solo contra o computador. As regras inteiras são as do chess.js (BSD-2, a
 * licença que o CLAUDE.md já tinha conferido): roque, en passant, promoção, xeque-mate, afogamento, as três repetições, os
 * 50 lances e o material que não dá mate.
 *
 * O SERVIDOR GERA OS LANCES e manda a lista a quem tem a vez (como nas Damas): o site só escolhe um. Na PROMOÇÃO, a pessoa
 * escolhe a peça (pedido dele, 05/11/2026: "o jogador pode querer um cavalo ou alguma peça pior para brincar"): o lance vem
 * marcado com `promocao`, e o site mostra as quatro peças; sem escolha (o robô), é a dama.
 *
 * As casas: `linha * 8 + coluna`, com a linha 0 no alto (a fileira 8, das pretas) e a coluna 0 na coluna a.
 */

export interface LanceDoXadrez {
  de: number;
  para: number;
  /** O peão chega à última fileira: a pessoa escolhe a peça (dama, torre, bispo ou cavalo). */
  promocao?: true;
}

export interface EstadoDaPartida {
  jogo: Chess;
  /** O lado da mesa que joga de brancas. */
  brancas: Lado;
  ultimo: LanceDoXadrez | null;
  fimPor: 'mate' | 'afogado' | 'repeticao' | 'cinquenta' | 'material' | null;
}

const COLUNAS = 'abcdefgh';
export const casaDe = (nome: string) => (8 - Number(nome[1])) * 8 + COLUNAS.indexOf(nome[0]);
export const nomeDe = (i: number) => `${COLUNAS[i % 8]}${8 - Math.floor(i / 8)}`;

/** O tabuleiro em 64 letras ('' vazia; maiúscula branca, minúscula preta), linha 0 no alto. */
export function casasDe(jogo: Chess): string[] {
  const casas: string[] = [];
  for (const fileira of jogo.board()) for (const c of fileira) casas.push(c ? (c.color === 'w' ? c.type.toUpperCase() : c.type) : '');
  return casas;
}

/** Os lances de quem tem a vez, de-para, sem repetir (as promoções viram uma só: a dama). */
export function lancesDe(jogo: Chess): LanceDoXadrez[] {
  const vistos = new Set<string>();
  const lista: LanceDoXadrez[] = [];
  for (const m of jogo.moves({ verbose: true }) as Move[]) {
    const chave = m.from + m.to;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    lista.push(m.promotion ? { de: casaDe(m.from), para: casaDe(m.to), promocao: true } : { de: casaDe(m.from), para: casaDe(m.to) });
  }
  return lista;
}

// ---- O ROBÔ: dois lances à frente (o dele e a resposta), mais as capturas que sobram na mesa, contando o material, com um tico de posição e de sorte. Joga com sentido e perde para
// quem joga bem; o custo fica em poucos milissegundos, porque roda dentro do servidor.
const VALOR: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
/** O material e a posição. `fim`: conferir o mate e o empate (caro: gera os lances; nas capturas, fica de fora). */
function avaliar(jogo: Chess, cor: 'w' | 'b', fim = true): number {
  if (fim && jogo.isCheckmate()) return jogo.turn() === cor ? -100_000 : 100_000;
  if (fim && (jogo.isDraw() || jogo.isStalemate())) return 0;
  let s = 0;
  const tab = jogo.board();
  for (let l = 0; l < 8; l++)
    for (let c = 0; c < 8; c++) {
      const p = tab[l][c];
      if (!p) continue;
      // o centro vale um pouco, e o peão que avança também
      const centro = 3.5 - Math.max(Math.abs(3.5 - l), Math.abs(3.5 - c));
      const avanco = p.type === 'p' ? (p.color === 'w' ? 7 - l : l) * 4 : 0;
      const v = VALOR[p.type] + (p.type === 'k' ? 0 : centro * 6) + avanco;
      s += p.color === cor ? v : -v;
    }
  return s;
}
function ordenar(moves: Move[]): Move[] {
  return moves.sort((a, b) => (b.captured ? VALOR[b.captured] - VALOR[a.piece] / 10 : 0) - (a.captured ? VALOR[a.captured] - VALOR[b.piece] / 10 : 0));
}
/** No fim da busca, as capturas que estão na mesa (só as que ganham material): a troca não fica pela metade. */
function capturas(jogo: Chess, cor: 'w' | 'b', alfa: number, beta: number, resto: number): number {
  const parado = avaliar(jogo, cor, false);
  if (resto === 0) return parado;
  const meu = jogo.turn() === cor;
  let melhor = parado;
  for (const m of ordenar((jogo.moves({ verbose: true }) as Move[]).filter((x) => x.captured))) {
    jogo.move(m);
    const v = capturas(jogo, cor, alfa, beta, resto - 1);
    jogo.undo();
    if (meu ? v > melhor : v < melhor) melhor = v;
    if (meu) alfa = Math.max(alfa, v);
    else beta = Math.min(beta, v);
    if (beta <= alfa) break;
  }
  return melhor;
}
/** A hora em que a busca funda do difícil desiste (ela roda no servidor: nunca pode segurar a mesa). */
let limite = Infinity;
/** Até quantas capturas seguidas a busca segue no fim (o nível difícil vai mais longe). */
let restoDasTrocas = 1;
class Estourou extends Error {}
function minimax(jogo: Chess, prof: number, alfa: number, beta: number, cor: 'w' | 'b'): number {
  if (performance.now() > limite) throw new Estourou();
  if (prof === 0) return capturas(jogo, cor, alfa, beta, restoDasTrocas);
  // os lances uma vez só: sem nenhum, é mate ou afogamento (o isGameOver geraria os lances de novo)
  const lances = jogo.moves({ verbose: true }) as Move[];
  if (!lances.length) return jogo.inCheck() ? (jogo.turn() === cor ? -100_000 : 100_000) : 0;
  const meu = jogo.turn() === cor;
  let melhor = meu ? -Infinity : Infinity;
  for (const m of ordenar(lances)) {
    jogo.move(m);
    const v = minimax(jogo, prof - 1, alfa, beta, cor);
    jogo.undo();
    if (meu) {
      melhor = Math.max(melhor, v);
      alfa = Math.max(alfa, v);
    } else {
      melhor = Math.min(melhor, v);
      beta = Math.min(beta, v);
    }
    if (beta <= alfa) break;
  }
  return melhor;
}
/**
 * Os NÍVEIS do robô (19/11/2026): quantos lances ele olha depois do dele (0: só as capturas que sobram), até onde segue as
 * trocas no fim da busca, e quanto sorteia entre os lances parecidos (em centésimos de peão). Olhar mais um lance inteiro (o
 * dele, a resposta e o seguinte) custava segundos com o chess.js, dentro do servidor; o difícil segue as trocas até o fim e
 * quase não sorteia. Ainda assim, ele tem um teto de tempo (PENSAR_MS): passou, joga o lance do fácil sem o sorteio.
 */
export const NIVEL_DO_XADREZ: Record<Nivel, { profundidade: number; ruido: number; trocas: number }> = {
  facil: { profundidade: 0, ruido: 160, trocas: 1 },
  normal: { profundidade: 1, ruido: 18, trocas: 1 },
  dificil: { profundidade: 1, ruido: 2, trocas: 2 },
};
export const PENSAR_MS = 1_200;

export function lanceDoRobo(fen: string, aleatorio: () => number, nivel: Nivel = 'normal'): LanceDoXadrez | null {
  const { profundidade, ruido, trocas } = NIVEL_DO_XADREZ[nivel];
  const jogo = new Chess(fen);
  const cor = jogo.turn();
  const moves = ordenar(jogo.moves({ verbose: true }) as Move[]);
  if (!moves.length) return null;
  const buscar = (prof: number, comRuido: number) => {
    let melhor: Move = moves[0];
    let melhorV = -Infinity;
    for (const m of moves) {
      jogo.move(m);
      try {
        // a janela da raiz: o que não supera o melhor até aqui (com a folga da sorte) é cortado cedo
        const v = minimax(jogo, prof, melhorV - comRuido, Infinity, cor) + aleatorio() * comRuido;
        if (v > melhorV) {
          melhorV = v;
          melhor = m;
        }
      } finally {
        jogo.undo();
      }
    }
    return melhor;
  };
  restoDasTrocas = trocas;
  // só o difícil tem teto: o normal e o fácil são os de sempre
  limite = nivel === 'dificil' ? performance.now() + PENSAR_MS : Infinity;
  try {
    return paraLance(buscar(profundidade, ruido));
  } catch (e) {
    if (!(e instanceof Estourou)) throw e;
    // a busca interrompida deixou lances feitos no tabuleiro: ele volta à posição de antes, e joga o lance curto
    limite = Infinity;
    restoDasTrocas = 1;
    jogo.load(fen);
    return paraLance(buscar(0, 0));
  } finally {
    limite = Infinity;
    restoDasTrocas = 1;
  }
}
const paraLance = (m: Move): LanceDoXadrez => ({ de: casaDe(m.from), para: casaDe(m.to) });


/** As peças que saíram do tabuleiro, por cor de quem as perdeu (letras como em `casasDe`). */
export function capturadasDe(jogo: Chess): { brancas: string[]; pretas: string[] } {
  const brancas: string[] = [];
  const pretas: string[] = [];
  for (const m of jogo.history({ verbose: true }) as Move[]) {
    if (!m.captured) continue;
    if (m.color === 'w') pretas.push(m.captured);
    else brancas.push(m.captured.toUpperCase());
  }
  return { brancas, pretas };
}

const corDoLado = (e: EstadoDaPartida, lado: Lado): 'w' | 'b' => (lado === e.brancas ? 'w' : 'b');

export const partidaDeXadrez = duelo<EstadoDaPartida>({
  inicio: () => ({ jogo: new Chess(), brancas: 0, ultimo: null, fimPor: null }),
  aoComecar(estado, primeiro) {
    // quem abre fica com as brancas
    estado.brancas = primeiro;
  },
  jogar(estado, lado, corpo) {
    const de = Number(corpo.de);
    const para = Number(corpo.para);
    if (!Number.isInteger(de) || !Number.isInteger(para) || de < 0 || de > 63 || para < 0 || para > 63) return 'Lance inválido.';
    const jogo = estado.jogo;
    if (jogo.turn() !== corDoLado(estado, lado)) return 'Espere a sua vez.';
    const legal = (jogo.moves({ verbose: true }) as Move[]).find((m) => m.from === nomeDe(de) && m.to === nomeDe(para));
    if (!legal) return 'Esse lance não vale.';
    const escolha = typeof corpo.promocao === 'string' && ['q', 'r', 'b', 'n'].includes(corpo.promocao) ? corpo.promocao : 'q';
    jogo.move({ from: legal.from, to: legal.to, promotion: legal.promotion ? escolha : undefined });
    estado.ultimo = { de, para };
    const outro: Lado = lado === 0 ? 1 : 0;
    if (jogo.isCheckmate()) {
      estado.fimPor = 'mate';
      return { proximo: outro, vencedor: lado };
    }
    if (jogo.isDraw() || jogo.isStalemate()) {
      estado.fimPor = jogo.isStalemate() ? 'afogado' : jogo.isThreefoldRepetition() ? 'repeticao' : jogo.isInsufficientMaterial() ? 'material' : 'cinquenta';
      return { proximo: outro, vencedor: 'empate' };
    }
    return { proximo: outro };
  },
  publico(estado, lado) {
    const jogo = estado.jogo;
    const daVez = lado !== null && jogo.turn() === corDoLado(estado, lado);
    return {
      casas: casasDe(jogo),
      brancas: estado.brancas,
      ultimo: estado.ultimo,
      xeque: jogo.inCheck(),
      fimPor: estado.fimPor,
      lances: daVez && !jogo.isGameOver() ? lancesDe(jogo) : [],
      capturadas: capturadasDe(jogo),
    };
  },
  // o histórico em notação algébrica (a do chess.js: "Nf3", "exd5", "O-O", "e8=Q+")
  descrever: (estado) => estado.jogo.history().at(-1) ?? '',
  // voltar o lance: refaz a partida até ali (o chess.js guarda o histórico, que conta para as três repetições)
  copiar: (estado) => ({ lances: estado.jogo.history(), brancas: estado.brancas, ultimo: estado.ultimo, fimPor: estado.fimPor }),
  restaurar(estado, copia) {
    const c = copia as { lances: string[]; brancas: Lado; ultimo: LanceDoXadrez | null; fimPor: EstadoDaPartida['fimPor'] };
    const jogo = new Chess();
    for (const san of c.lances) jogo.move(san);
    Object.assign(estado, { jogo, brancas: c.brancas, ultimo: c.ultimo, fimPor: c.fimPor });
  },
  // o tabuleiro é aberto: o robô vê o mesmo que a pessoa
  robo: (estado, _lado, aleatorio, nivel) => {
    const l = lanceDoRobo(estado.jogo.fen(), aleatorio, nivel);
    return l ? { de: l.de, para: l.para } : {};
  },
});
