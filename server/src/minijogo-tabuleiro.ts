import type { Definicao } from './minijogo-motor.js';
import { ehRobo, nomeDoRobo, PAUSA_DO_ROBO } from './minijogo-robos.js';

/**
 * OS JOGOS DE DUAS PESSOAS, COM A SALA ASSISTINDO: Cinco em linha (Gomoku) e Mancala. São clássicos de
 * regra pública, sem palavra nenhuma, e por isso servem nos 71 idiomas sem tradução de conteúdo.
 *
 * Quem começa senta à mesa e espera; o primeiro da sala que apertar "Jogar" senta do outro lado. O resto
 * assiste, com o tabuleiro na tela — e é aí que a conversa acontece ("não, ali não!"). Cada jogada tem
 * prazo: quem some no meio perde a partida em vez de prender a sala.
 *
 * NO SOLO, CONTRA O COMPUTADOR (pedido dele, 05/11/2026): o robô (id -1, minijogo-robos.ts) senta na hora e a partida
 * começa; na vez dele, ele joga depois de uma pausa curta, pela mesma `jogar` das regras (a jogada dele passa pela mesma
 * conferência). A pessoa não perde pelo prazo de 90 s: pensar sozinho não segura ninguém (só a mesa esquecida por meia hora
 * acaba).
 */

export const ESPERANDO_MS = 3 * 60_000;
export const JOGADA_MS = 90_000;
/** No Solo, a vez da pessoa: só a mesa esquecida acaba. */
export const JOGADA_SOLO_MS = 30 * 60_000;

export type Lado = 0 | 1;

export interface Regras<T> {
  inicio(): T;
  /** A jogada de `lado`. Devolve o erro, ou quem joga em seguida e, se acabou, quem venceu. */
  jogar(estado: T, lado: Lado, corpo: Record<string, unknown>): string | { proximo: Lado; vencedor?: Lado | 'empate' };
  /**
   * O que se vê da mesa. `lado` é o de quem pede (null: quem assiste). Na Batalha naval (04/11/2026) cada um vê só a
   * própria frota, e por isso a vista é por lado; os jogos de tabuleiro aberto ignoram o lado.
   */
  publico(estado: T, lado: Lado | null): Record<string, unknown>;
  /**
   * Uma ação FORA DA VEZ, de quem está sentado e com a partida em andamento (a Batalha naval: sortear a frota de novo
   * antes do primeiro tiro). Vem com `tipo: 'livre'`. Devolve o erro, ou null.
   */
  livre?(estado: T, lado: Lado, corpo: Record<string, unknown>): string | null;
  /** O segundo sentou e a vez foi sorteada: `primeiro` é quem abre (nas Damas, quem fica com as peças claras). */
  aoComecar?(estado: T, primeiro: Lado): void;
  /**
   * A jogada do COMPUTADOR no lado `lado` (o Solo, 05/11/2026): o corpo da 'jogada', escolhido só com o que esse lado vê (na
   * Batalha naval, sem olhar a frota escondida). O jogo sem `robo` não tem Solo contra o computador.
   */
  robo?(estado: T, lado: Lado, aleatorio: () => number): Record<string, unknown>;
}

/** A mesa de duas pessoas (sentar, a vez, o prazo, desistir) em volta das regras de um jogo. */
export function duelo<T>(regras: Regras<T>, aleatorio = Math.random): Definicao {
  return {
    mesa: true,
    comecar(ctx, { criadaPor }) {
      let fase: 'esperando' | 'jogando' | 'fim' = 'esperando';
      const lugares: number[] = [criadaPor];
      let vez: Lado = 0;
      let vencedor: Lado | 'empate' | null = null;
      let motivo: 'jogo' | 'tempo' | 'desistiu' | null = null;
      const estado = regras.inicio();
      // no Solo, contra o computador: ele senta do outro lado na hora
      const contraORobo = ctx.solo === true && regras.robo !== undefined;
      const nome = (id: number) => (ehRobo(id) ? nomeDoRobo(id) : ctx.nome(id));

      const acabar = (quem: Lado | 'empate' | null, porque: typeof motivo) => {
        fase = 'fim';
        vencedor = quem;
        motivo = porque;
        ctx.terminar();
      };

      /** A vez de agora: o robô joga depois da pausa; gente tem o prazo (no Solo, só o da mesa esquecida). */
      const prazo = () => {
        if (ehRobo(lugares[vez] ?? 0)) return ctx.agendar(PAUSA_DO_ROBO, jogarORobo);
        ctx.agendar(contraORobo ? JOGADA_SOLO_MS : JOGADA_MS, () => {
          if (fase === 'jogando') acabar(vez === 0 ? 1 : 0, 'tempo');
        });
      };

      const sentar = (quem: number) => {
        lugares.push(quem);
        fase = 'jogando';
        // Quem começa é sorteado: começar dá vantagem nos dois jogos.
        vez = aleatorio() < 0.5 ? 0 : 1;
        regras.aoComecar?.(estado, vez);
        prazo();
      };

      const jogada = (lado: Lado, corpo: Record<string, unknown>): string | null => {
        const r = regras.jogar(estado, lado, corpo);
        if (typeof r === 'string') return r;
        if (r.vencedor !== undefined) {
          acabar(r.vencedor, 'jogo');
          return null;
        }
        vez = r.proximo;
        prazo();
        ctx.avisar();
        return null;
      };

      function jogarORobo() {
        if (fase !== 'jogando' || !ehRobo(lugares[vez])) return;
        const lado = vez;
        // a jogada do robô passa pela mesma conferência; se as regras a recusassem (não deveria), ele desiste em vez de
        // prender a mesa
        if (jogada(lado, { ...regras.robo!(estado, lado, aleatorio), tipo: 'jogada' }) !== null) acabar(lado === 0 ? 1 : 0, 'desistiu');
      }

      if (contraORobo) sentar(-1);
      // Ninguém sentou do outro lado: a mesa se desfaz sozinha, sem vencedor.
      else ctx.agendar(ESPERANDO_MS, () => acabar(null, null));

      return {
        publico(quem) {
          const lado = lugares.indexOf(quem);
          return {
            fase,
            jogadores: lugares.map((userId) => ({ userId, username: nome(userId) })),
            vez,
            vencedor,
            motivo,
            ...regras.publico(estado, lado === 0 || lado === 1 ? lado : null),
          };
        },
        acao(quem, corpo) {
          if (corpo.tipo === 'sentar') {
            if (fase !== 'esperando') return 'A mesa já está cheia.';
            if (lugares.includes(quem)) return 'Você já está na mesa.';
            sentar(quem);
            ctx.avisar();
            return null;
          }
          const lado = lugares.indexOf(quem);
          if (corpo.tipo === 'desistir') {
            if (fase !== 'jogando' || lado < 0) return 'Você não está jogando.';
            acabar(lado === 0 ? 1 : 0, 'desistiu');
            return null;
          }
          if (corpo.tipo === 'livre' && regras.livre) {
            if (fase !== 'jogando') return 'A partida não está em andamento.';
            if (lado < 0) return 'Você está assistindo esta partida.';
            const erro = regras.livre(estado, lado as Lado, corpo);
            if (erro) return erro;
            ctx.avisar();
            return null;
          }
          if (corpo.tipo === 'jogada') {
            if (fase !== 'jogando') return 'A partida não está em andamento.';
            if (lado < 0) return 'Você está assistindo esta partida.';
            if (lado !== vez) return 'Espere a sua vez.';
            return jogada(lado as Lado, corpo);
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
  robo: (estado, lado, aleatorio) => ({ casa: jogadaDoGomoku(estado.casas, lado + 1, aleatorio) }),
});

/**
 * O que uma casa vale para a cor `cor`: por direção, quantas pedras dela ficam seguidas com a casa, e quantas pontas abertas
 * sobram. Cinco ganha; quatro aberta (duas pontas) já é vitória na jogada seguinte; e assim por diante.
 */
function valorDaCasa(casas: number[], casa: number, cor: number, n = LADO_DO_GOMOKU): number {
  const l0 = Math.floor(casa / n);
  const c0 = casa % n;
  let total = 0;
  for (const [dl, dc] of [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ]) {
    let seguidas = 1;
    let abertas = 0;
    for (const sentido of [1, -1]) {
      let l = l0 + dl * sentido;
      let c = c0 + dc * sentido;
      while (l >= 0 && l < n && c >= 0 && c < n && casas[l * n + c] === cor) {
        seguidas++;
        l += dl * sentido;
        c += dc * sentido;
      }
      if (l >= 0 && l < n && c >= 0 && c < n && casas[l * n + c] === 0) abertas++;
    }
    if (seguidas >= 5) total += 1_000_000;
    else if (abertas === 0) continue;
    else if (seguidas === 4) total += abertas === 2 ? 50_000 : 6_000;
    else if (seguidas === 3) total += abertas === 2 ? 3_000 : 300;
    else if (seguidas === 2) total += abertas === 2 ? 120 : 25;
    else total += abertas === 2 ? 8 : 2;
  }
  return total;
}

/**
 * O ROBÔ DO CINCO EM LINHA: olha as casas vazias perto das pedras e soma o que cada uma vale para ele (atacar) e para a
 * pessoa (bloquear, um pouco menos). Assim: fecha o cinco dele antes de tudo, bloqueia o cinco dela, faz a quatro aberta,
 * bloqueia a três aberta… Um tantinho de sorte desempata e deixa o jogo menos previsível. Joga bem, mas dá para ganhar dele.
 */
export function jogadaDoGomoku(casas: number[], cor: number, aleatorio: () => number = Math.random, n = LADO_DO_GOMOKU): number {
  const outra = cor === 1 ? 2 : 1;
  const ocupadas = casas.some((x) => x);
  const centro = Math.floor(n / 2) * n + Math.floor(n / 2);
  if (!ocupadas) return centro;
  let melhor = -1;
  let melhorValor = -Infinity;
  for (let i = 0; i < casas.length; i++) {
    if (casas[i]) continue;
    const l = Math.floor(i / n);
    const c = i % n;
    // só as casas a até 2 de alguma pedra
    let perto = false;
    for (let dl = -2; dl <= 2 && !perto; dl++) {
      for (let dc = -2; dc <= 2 && !perto; dc++) {
        const ll = l + dl;
        const cc = c + dc;
        if (ll >= 0 && ll < n && cc >= 0 && cc < n && casas[ll * n + cc]) perto = true;
      }
    }
    if (!perto) continue;
    const valor = valorDaCasa(casas, i, cor, n) + 0.9 * valorDaCasa(casas, i, outra, n) + aleatorio() * 6;
    if (valor > melhorValor) {
      melhorValor = valor;
      melhor = i;
    }
  }
  return melhor >= 0 ? melhor : casas.findIndex((x) => !x);
}

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
  robo: (estado, lado, aleatorio) => ({ casa: jogadaDaMancala(estado.casas, lado, aleatorio) }),
});

/** Quantas jogadas à frente o robô da Mancala olha (as jogadas de novo contam como uma a mais). */
export const PROFUNDIDADE_DA_MANCALA = 5;

/**
 * O ROBÔ DA MANCALA: minimax curto (PROFUNDIDADE_DA_MANCALA jogadas, com poda), contando a diferença dos depósitos. Ele vê
 * o mesmo tabuleiro aberto que a pessoa. A jogada que dá a vez de novo continua do mesmo lado, como na regra. Empatando,
 * sorteia: o mesmo tabuleiro nem sempre dá a mesma jogada.
 */
export function jogadaDaMancala(casas: number[], lado: Lado, aleatorio: () => number = Math.random, profundidade = PROFUNDIDADE_DA_MANCALA): number {
  const avaliar = (c: number[]) => c[deposito(lado)] - c[deposito(lado === 0 ? 1 : 0)];
  const busca = (c: number[], quem: Lado, falta: number, alfa: number, beta: number): number => {
    const opcoes = casasDe(quem).filter((k) => c[k] > 0);
    if (falta === 0 || !opcoes.length) return avaliar(c);
    let melhor = quem === lado ? -Infinity : Infinity;
    for (const k of opcoes) {
      const copia = c.slice();
      const { proximo, acabou } = semear(copia, quem, k);
      const v = acabou ? avaliar(copia) * 100 : busca(copia, proximo, falta - 1, alfa, beta);
      if (quem === lado) {
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
  let escolha = -1;
  let melhorValor = -Infinity;
  for (const k of casasDe(lado)) {
    if (!casas[k]) continue;
    const copia = casas.slice();
    const { proximo, acabou } = semear(copia, lado, k);
    const v = (acabou ? avaliar(copia) * 100 : busca(copia, proximo, profundidade - 1, -Infinity, Infinity)) + aleatorio() * 0.5;
    if (v > melhorValor) {
      melhorValor = v;
      escolha = k;
    }
  }
  return escolha;
}
