import { Chess, type Move } from 'chess.js';
import { duelo, type Lado, type Regras } from './minijogo-tabuleiro.js';
import type { Definicao, Jogo } from './minijogo-motor.js';
import { guardarRecordeDoSolo, lerRecordeDoSolo } from './recorde-solo-tardio.js';
import { lanceDoMotor, NIVEIS_DO_MOTOR } from './xadrez-motor.js';
import { pensarNoWorker } from './xadrez-robo.js';

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
  /** A posição de onde a partida começou (o FEN): a de sempre, ou a de um final de treino. */
  inicial?: string;
  /** O FINAL DE TREINO desta partida (21/11/2026), só no Solo; null na partida inteira. */
  final?: IdDoFinal | null;
  /** O resultado do final: em quantos lances a pessoa deu o mate, e o recorde (o de antes e se virou o novo). */
  resultadoDoFinal?: { lances: number; antes: number | null; novo: boolean | null; voltou?: boolean } | null;
  /** Voltou o lance no final de treino (21/11/2026, decisão dele): o mate vale, o recorde não. */
  voltou?: boolean;
  /** O recorde deste final antes da partida (para a tela mostrar enquanto se joga). */
  recordeDoFinal?: number | null;
}

/**
 * OS FINAIS DE TREINO (21/11/2026, o lote D da segunda auditoria), só no Solo: a pessoa joga de brancas, a partir de uma posição
 * clássica de final, contra o motor no Difícil (que se defende o melhor que sabe), e a meta é o MATE. O recorde é em quantos
 * lances (os da pessoa) ele saiu, na tabela comum (`partida-de-xadrez`, variante `final-<id>`), contado pelo servidor; menos é
 * melhor. Empatar (afogar o rei, as três repetições, os 50 lances) não vale recorde. Medido com o motor no Difícil dos dois
 * lados: todos acabam em mate, de 11 a 20 lances.
 */
export const FINAIS_DE_TREINO = {
  dama: '8/8/8/4k3/8/8/8/3QK3 w - - 0 1',
  torre: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1',
  bispos: '8/8/8/4k3/8/8/8/2B1KB2 w - - 0 1',
  peao: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1',
} as const;
export type IdDoFinal = keyof typeof FINAIS_DE_TREINO;
const finalDe = (v: unknown): IdDoFinal | null => (typeof v === 'string' && Object.hasOwn(FINAIS_DE_TREINO, v) ? (v as IdDoFinal) : null);
/** O nível em que o motor defende o final, qualquer que seja o escolhido na largada. */
export const NIVEL_DO_FINAL = 'dificil';
const novoJogo = (fen?: string) => (fen ? new Chess(fen) : new Chess());

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

// ---- O ROBÔ (20/11/2026, pedido dele: "adicione dificuldade no xadrez"): o motor próprio (xadrez-motor.ts, alfa-beta com
// aprofundamento iterativo, quiescência e tabelas de casa), num worker (xadrez-robo.ts), para a conta nunca segurar o servidor. Os
// cinco NÍVEIS saem do motor (NIVEIS_DO_MOTOR): o Iniciante e o Fácil olham pouco e erram de propósito; o Mestre pensa ~1,6 s
// e vê vários lances à frente. Antes, o robô olhava um lance só com o chess.js (3 mil posições por segundo), e o difícil
// segurava o servidor ~0,8 s.
export const NIVEIS_DO_XADREZ = ['iniciante', 'facil', 'normal', 'dificil', 'mestre'] as const;
export type NivelDoXadrez = (typeof NIVEIS_DO_XADREZ)[number];
export const NIVEL_DO_XADREZ = NIVEIS_DO_MOTOR;
const nivelDe = (nivel: string): NivelDoXadrez => ((NIVEIS_DO_XADREZ as readonly string[]).includes(nivel) ? (nivel as NivelDoXadrez) : 'normal');
const semente = (aleatorio: () => number) => Math.floor(aleatorio() * 0x7fffffff) + 1;
/** Os FEN das posições de antes da atual (a repetição de três vezes conta as da partida). */
const historicoDe = (jogo: Chess) => (jogo.history({ verbose: true }) as Move[]).map((m) => m.before);

/** O lance do robô NA PRÓPRIA THREAD (os testes e a medida dos níveis; a mesa usa o worker). */
export function lanceDoRobo(fen: string, aleatorio: () => number, nivel: string = 'normal', historico: string[] = []): LanceDoXadrez | null {
  const l = lanceDoMotor(fen, nivelDe(nivel), historico, semente(aleatorio)).lance;
  return l ? { de: l.de, para: l.para } : null;
}

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

/**
 * As regras da mesa do xadrez. `solo` e `criadaPor` servem aos finais de treino: o final só existe no Solo, e o recorde é de
 * quem começou.
 */
function regrasDoXadrez(solo: boolean, criadaPor: number, avisar: () => void): Regras<EstadoDaPartida> {
  return {
    escolhas: (corpo) => (solo && finalDe(corpo.final) ? { final: finalDe(corpo.final) } : {}),
    inicio: (escolhas) => {
      const final = solo ? finalDe(escolhas.final) : null;
      const inicial = final ? FINAIS_DE_TREINO[final] : new Chess().fen();
      const estado: EstadoDaPartida = { jogo: novoJogo(inicial), brancas: 0, ultimo: null, fimPor: null, inicial, final, resultadoDoFinal: null, recordeDoFinal: null };
      if (final && criadaPor > 0) {
        lerRecordeDoSolo(criadaPor, 'partida-de-xadrez', `final-${final}`, (r) => {
          estado.recordeDoFinal = r?.valor ?? null;
          avisar();
        });
      }
      return estado;
    },
    // no final de treino a pessoa (o lado 0: o robô senta depois) abre, de brancas
    quemAbre: (estado) => (estado.final ? 0 : null),
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
        // o mate do final de treino, dado pela pessoa: os lances dela, contados aqui, vão ao recorde
        if (estado.final && lado === estado.brancas && criadaPor > 0 && estado.voltou) {
          const lances = (jogo.history({ verbose: true }) as Move[]).filter((m) => m.color === 'w').length;
          estado.resultadoDoFinal = { lances, antes: estado.recordeDoFinal ?? null, novo: false, voltou: true };
        } else if (estado.final && lado === estado.brancas && criadaPor > 0) {
          const lances = (jogo.history({ verbose: true }) as Move[]).filter((m) => m.color === 'w').length;
          estado.resultadoDoFinal = { lances, antes: estado.recordeDoFinal ?? null, novo: null };
          guardarRecordeDoSolo(criadaPor, 'partida-de-xadrez', `final-${estado.final}`, lances, true, null, (r) => {
            estado.resultadoDoFinal = { lances, antes: r.antes, novo: r.novo };
            avisar();
          });
        }
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
        final: estado.final ?? null,
        recordeDoFinal: estado.recordeDoFinal ?? null,
        resultadoDoFinal: estado.resultadoDoFinal ?? null,
      };
    },
    // o histórico em notação algébrica (a do chess.js: "Nf3", "exd5", "O-O", "e8=Q+")
    descrever: (estado) => estado.jogo.history().at(-1) ?? '',
    // voltar o lance: refaz a partida até ali (o chess.js guarda o histórico, que conta para as três repetições)
    copiar: (estado) => ({ lances: estado.jogo.history(), brancas: estado.brancas, ultimo: estado.ultimo, fimPor: estado.fimPor }),
    restaurar(estado, copia) {
      const c = copia as { lances: string[]; brancas: Lado; ultimo: LanceDoXadrez | null; fimPor: EstadoDaPartida['fimPor'] };
      const jogo = novoJogo(estado.inicial);
      for (const san of c.lances) jogo.move(san);
      Object.assign(estado, { jogo, brancas: c.brancas, ultimo: c.ultimo, fimPor: c.fimPor });
      if (estado.final) estado.voltou = true;
    },
    // o tabuleiro é aberto: o robô vê o mesmo que a pessoa. A posição é copiada AGORA (a conta volta depois, no worker).
    niveis: NIVEIS_DO_XADREZ,
    roboAssincrono: async (estado, _lado, aleatorio, nivel) => {
      const l = await pensarNoWorker({
        fen: estado.jogo.fen(),
        historico: historicoDe(estado.jogo),
        // no final de treino, o motor defende sempre no Difícil
        nivel: estado.final ? NIVEL_DO_FINAL : nivelDe(nivel),
        semente: semente(aleatorio),
      });
      // a peça da promoção que o motor escolheu (quase sempre a dama)
      return l ? { de: l.de, para: l.para, promocao: l.promocao } : {};
    },
  };
}

/**
 * A REVISÃO DA PARTIDA (21/11/2026): no fim, o público leva as posições depois de cada lance (os FEN, a partir da inicial) e o
 * de-para de cada um, para a tela andar lance a lance para trás e para a frente. Só no fim: durante a partida, seria mandar a
 * partida inteira a cada lance.
 */
export function revisaoDe(estado: EstadoDaPartida) {
  const lances = estado.jogo.history({ verbose: true }) as Move[];
  return {
    fens: [estado.inicial ?? new Chess().fen(), ...lances.map((m) => m.after)],
    lances: lances.map((m) => ({ de: casaDe(m.from), para: casaDe(m.to) })),
  };
}

export const partidaDeXadrez: Definicao = {
  mesa: true,
  comecar(ctx, opcoes) {
    let estado: EstadoDaPartida | null = null;
    const regras = regrasDoXadrez(ctx.solo === true, opcoes.criadaPor, () => ctx.avisar());
    const inicio = regras.inicio;
    regras.inicio = (escolhas) => (estado = inicio(escolhas));
    const jogo = duelo(regras).comecar(ctx, opcoes);
    if (typeof jogo === 'string') return jogo;
    const comRevisao: Jogo = {
      ...jogo,
      publico(quem) {
        const vista = jogo.publico(quem);
        return vista.fase === 'fim' && estado ? { ...vista, revisao: revisaoDe(estado) } : vista;
      },
    };
    return comRevisao;
  },
};
