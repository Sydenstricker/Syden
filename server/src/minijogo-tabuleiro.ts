import type { Definicao } from './minijogo-motor.js';

/**
 * OS JOGOS DE DUAS PESSOAS, COM A SALA ASSISTINDO: Cinco em linha (Gomoku) e Mancala. São clássicos de
 * regra pública, sem palavra nenhuma, e por isso servem nos 71 idiomas sem tradução de conteúdo.
 *
 * Quem começa senta à mesa e espera; o primeiro da sala que apertar "Jogar" senta do outro lado. O resto
 * assiste, com o tabuleiro na tela — e é aí que a conversa acontece ("não, ali não!"). Cada jogada tem
 * prazo: quem some no meio perde a partida em vez de prender a sala.
 */

export const ESPERANDO_MS = 3 * 60_000;
export const JOGADA_MS = 90_000;

type Lado = 0 | 1;

interface Regras<T> {
  inicio(): T;
  /** A jogada de `lado`. Devolve o erro, ou quem joga em seguida e, se acabou, quem venceu. */
  jogar(estado: T, lado: Lado, corpo: Record<string, unknown>): string | { proximo: Lado; vencedor?: Lado | 'empate' };
  publico(estado: T): Record<string, unknown>;
}

/** A mesa de duas pessoas (sentar, a vez, o prazo, desistir) em volta das regras de um jogo. */
function duelo<T>(regras: Regras<T>, aleatorio = Math.random): Definicao {
  return {
    comecar(ctx, { criadaPor }) {
      let fase: 'esperando' | 'jogando' | 'fim' = 'esperando';
      const lugares: number[] = [criadaPor];
      let vez: Lado = 0;
      let vencedor: Lado | 'empate' | null = null;
      let motivo: 'jogo' | 'tempo' | 'desistiu' | null = null;
      const estado = regras.inicio();

      const acabar = (quem: Lado | 'empate' | null, porque: typeof motivo) => {
        fase = 'fim';
        vencedor = quem;
        motivo = porque;
        ctx.terminar();
      };
      // Ninguém sentou do outro lado: a mesa se desfaz sozinha, sem vencedor.
      ctx.agendar(ESPERANDO_MS, () => acabar(null, null));

      const prazo = () =>
        ctx.agendar(JOGADA_MS, () => {
          if (fase === 'jogando') acabar(vez === 0 ? 1 : 0, 'tempo');
        });

      return {
        publico() {
          return {
            fase,
            jogadores: lugares.map((userId) => ({ userId, username: ctx.nome(userId) })),
            vez,
            vencedor,
            motivo,
            ...regras.publico(estado),
          };
        },
        acao(quem, corpo) {
          if (corpo.tipo === 'sentar') {
            if (fase !== 'esperando') return 'A mesa já está cheia.';
            if (lugares.includes(quem)) return 'Você já está na mesa.';
            lugares.push(quem);
            fase = 'jogando';
            // Quem começa é sorteado: começar dá vantagem nos dois jogos.
            vez = aleatorio() < 0.5 ? 0 : 1;
            prazo();
            ctx.avisar();
            return null;
          }
          const lado = lugares.indexOf(quem);
          if (corpo.tipo === 'desistir') {
            if (fase !== 'jogando' || lado < 0) return 'Você não está jogando.';
            acabar(lado === 0 ? 1 : 0, 'desistiu');
            return null;
          }
          if (corpo.tipo === 'jogada') {
            if (fase !== 'jogando') return 'A partida não está em andamento.';
            if (lado < 0) return 'Você está assistindo esta partida.';
            if (lado !== vez) return 'Espere a sua vez.';
            const r = regras.jogar(estado, lado as Lado, corpo);
            if (typeof r === 'string') return r;
            if (r.vencedor !== undefined) {
              acabar(r.vencedor, 'jogo');
              return null;
            }
            vez = r.proximo;
            prazo();
            ctx.avisar();
            return null;
          }
          return 'Ação desconhecida.';
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------------------------------
// CINCO EM LINHA (Gomoku): tabuleiro de 15×15, cada um põe uma pedra por vez, e vence quem fizer cinco
// seguidas na horizontal, na vertical ou na diagonal.
// ---------------------------------------------------------------------------------------------------

export const LADO_DO_GOMOKU = 15;

/** As casas da linha de cinco (ou mais) que passa pela casa `i`, ou null se não há linha. */
export function linhaDeCinco(casas: number[], i: number, n = LADO_DO_GOMOKU): number[] | null {
  const cor = casas[i];
  if (!cor) return null;
  const l0 = Math.floor(i / n);
  const c0 = i % n;
  for (const [dl, dc] of [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ]) {
    const linha = [i];
    for (const sentido of [1, -1]) {
      let l = l0 + dl * sentido;
      let c = c0 + dc * sentido;
      while (l >= 0 && l < n && c >= 0 && c < n && casas[l * n + c] === cor) {
        linha.push(l * n + c);
        l += dl * sentido;
        c += dc * sentido;
      }
    }
    if (linha.length >= 5) return linha.sort((a, b) => a - b);
  }
  return null;
}

export const gomoku = duelo<{ casas: number[]; ultima: number | null; linha: number[] | null }>({
  inicio: () => ({ casas: new Array<number>(LADO_DO_GOMOKU * LADO_DO_GOMOKU).fill(0), ultima: null, linha: null }),
  jogar(estado, lado, corpo) {
    const casa = Number(corpo.casa);
    if (!Number.isInteger(casa) || casa < 0 || casa >= estado.casas.length || estado.casas[casa]) return 'Essa casa já está ocupada.';
    estado.casas[casa] = lado + 1;
    estado.ultima = casa;
    const linha = linhaDeCinco(estado.casas, casa);
    if (linha) {
      estado.linha = linha;
      return { proximo: lado, vencedor: lado };
    }
    if (estado.casas.every((x) => x)) return { proximo: lado, vencedor: 'empate' };
    return { proximo: lado === 0 ? 1 : 0 };
  },
  publico: (estado) => ({ lado: LADO_DO_GOMOKU, casas: estado.casas, ultima: estado.ultima, linha: estado.linha }),
});

// ---------------------------------------------------------------------------------------------------
// MANCALA (a regra Kalah, a mais jogada): seis casas de cada lado com quatro sementes e um depósito na
// ponta. Pega-se todas as sementes de uma casa sua e semeia-se uma em cada casa seguinte, no sentido
// anti-horário, pulando o depósito do outro. A última no seu depósito: joga de novo. A última numa casa
// sua vazia, com sementes na casa da frente: leva as duas para o depósito. Quando um lado esvazia, o
// outro guarda o que sobrou, e vence quem tiver mais no depósito.
//
// As casas: 0–5 são do primeiro jogador e 6 é o depósito dele; 7–12 são do segundo e 13 o depósito dele.
// ---------------------------------------------------------------------------------------------------

export const SEMENTES = 4;
const deposito = (lado: Lado) => (lado === 0 ? 6 : 13);
const casasDe = (lado: Lado) => (lado === 0 ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12]);

/** Semeia a partir de `casa`. Devolve o próximo a jogar e se o jogo acabou (já com as sobras guardadas). */
export function semear(casas: number[], lado: Lado, casa: number): { proximo: Lado; acabou: boolean } {
  const outro: Lado = lado === 0 ? 1 : 0;
  let mao = casas[casa];
  casas[casa] = 0;
  let i = casa;
  while (mao > 0) {
    i = (i + 1) % 14;
    if (i === deposito(outro)) continue;
    casas[i]++;
    mao--;
  }
  let proximo: Lado = outro;
  if (i === deposito(lado)) proximo = lado;
  else if (casasDe(lado).includes(i) && casas[i] === 1 && casas[12 - i] > 0) {
    casas[deposito(lado)] += casas[12 - i] + 1;
    casas[i] = 0;
    casas[12 - i] = 0;
  }
  const vazio = (l: Lado) => casasDe(l).every((c) => casas[c] === 0);
  if (vazio(0) || vazio(1)) {
    for (const l of [0, 1] as Lado[]) {
      for (const c of casasDe(l)) {
        casas[deposito(l)] += casas[c];
        casas[c] = 0;
      }
    }
    return { proximo, acabou: true };
  }
  return { proximo, acabou: false };
}

export const mancala = duelo<{ casas: number[]; ultima: number | null }>({
  inicio: () => ({ casas: Array.from({ length: 14 }, (_, i) => (i === 6 || i === 13 ? 0 : SEMENTES)), ultima: null }),
  jogar(estado, lado, corpo) {
    const casa = Number(corpo.casa);
    if (!casasDe(lado).includes(casa)) return 'Escolha uma casa do seu lado.';
    if (!estado.casas[casa]) return 'Essa casa está vazia.';
    estado.ultima = casa;
    const { proximo, acabou } = semear(estado.casas, lado, casa);
    if (acabou) {
      const a = estado.casas[6];
      const b = estado.casas[13];
      return { proximo, vencedor: a === b ? 'empate' : a > b ? 0 : 1 };
    }
    return { proximo };
  },
  publico: (estado) => ({ casas: estado.casas, ultima: estado.ultima }),
});
