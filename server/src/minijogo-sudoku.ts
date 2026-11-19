import { embaralhar, type Definicao } from './minijogo-motor.js';
import { guardarRecordeDoSolo, lerRecordeDoSolo } from './recorde-solo-tardio.js';

/**
 * O SUDOKU EM CORRIDA: todo mundo recebe o MESMO tabuleiro, cada um resolve no seu, e a sala vê a barra de
 * progresso de cada um subindo. Sudoku não tem palavra, então sai pronto nos 71 idiomas.
 *
 * O servidor gera o tabuleiro (com uma solução só, senão a corrida não é justa) e guarda a solução; o site
 * nunca a recebe. Cada número posto é conferido na hora: o errado fica vermelho e conta como erro no placar,
 * para quem chuta não andar mais rápido do que quem pensa.
 */

export const VAZIAS = 45;
export const SUDOKU_MS = 20 * 60_000;

const linha = (i: number) => Math.floor(i / 9);
const coluna = (i: number) => i % 9;
const bloco = (i: number) => Math.floor(linha(i) / 3) * 3 + Math.floor(coluna(i) / 3);

/** Os números que cabem na casa `i`, como máscara de bits (o bit d ligado = o número d cabe). */
function livres(grade: number[], i: number): number {
  let usados = 0;
  for (let j = 0; j < 81; j++) {
    if (grade[j] && (linha(j) === linha(i) || coluna(j) === coluna(i) || bloco(j) === bloco(i))) usados |= 1 << grade[j];
  }
  return ~usados & 0b1111111110;
}

const quantos = (mascara: number) => {
  let n = 0;
  for (let m = mascara; m; m &= m - 1) n++;
  return n;
};

/** A casa vazia com menos opções (resolve muito mais rápido do que ir em ordem), ou -1 se não há vazia. */
function maisApertada(grade: number[]): { casa: number; mascara: number } {
  let casa = -1;
  let mascara = 0;
  let menor = 10;
  for (let i = 0; i < 81; i++) {
    if (grade[i]) continue;
    const m = livres(grade, i);
    const n = quantos(m);
    if (n < menor) {
      casa = i;
      mascara = m;
      menor = n;
      if (n <= 1) break;
    }
  }
  return { casa, mascara };
}

/** Quantas soluções o tabuleiro tem, contando até `limite` (2 basta para saber se é única). */
export function contarSolucoes(grade: number[], limite = 2): number {
  const { casa, mascara } = maisApertada(grade);
  if (casa === -1) return 1;
  let total = 0;
  for (let d = 1; d <= 9 && total < limite; d++) {
    if (!(mascara & (1 << d))) continue;
    grade[casa] = d;
    total += contarSolucoes(grade, limite - total);
  }
  grade[casa] = 0;
  return total;
}

function preencher(grade: number[], aleatorio: () => number): boolean {
  const { casa, mascara } = maisApertada(grade);
  if (casa === -1) return true;
  for (const d of embaralhar([1, 2, 3, 4, 5, 6, 7, 8, 9], aleatorio)) {
    if (!(mascara & (1 << d))) continue;
    grade[casa] = d;
    if (preencher(grade, aleatorio)) return true;
  }
  grade[casa] = 0;
  return false;
}

/**
 * Um tabuleiro com solução única e `vazias` casas a preencher. Tirar casas ao acaso nem sempre chega às 58 do "Muito
 * difícil" (a solução deixa de ser única antes): tenta de novo até chegar, e fica com o mais vazio se não chegar.
 */
export function gerarSudoku(aleatorio = Math.random, vazias = VAZIAS): { enigma: number[]; solucao: number[] } {
  let melhor = umaTentativa(aleatorio, vazias);
  for (let i = 0; i < 40 && melhor.enigma.filter((n) => n === 0).length < vazias; i++) {
    const outra = umaTentativa(aleatorio, vazias);
    if (outra.enigma.filter((n) => n === 0).length > melhor.enigma.filter((n) => n === 0).length) melhor = outra;
  }
  return melhor;
}

function umaTentativa(aleatorio: () => number, vazias: number): { enigma: number[]; solucao: number[] } {
  const solucao = new Array<number>(81).fill(0);
  preencher(solucao, aleatorio);
  const enigma = [...solucao];
  let tiradas = 0;
  for (const i of embaralhar([...Array(81).keys()], aleatorio)) {
    if (tiradas >= vazias) break;
    const guardado = enigma[i];
    enigma[i] = 0;
    if (contarSolucoes([...enigma]) === 1) tiradas++;
    else enigma[i] = guardado;
  }
  return { enigma, solucao };
}

/**
 * AS DIFICULDADES (19/11/2026, a auditoria dos mini-games): quantas casas vazias. "Médio" é o de sempre (45); o gerador garante
 * a solução única em todas.
 */
export const DIFICULDADES = { facil: 35, medio: 45, dificil: 52, extremo: 58 } as const;
export type Dificuldade = keyof typeof DIFICULDADES;
/**
 * CONFERIR SÓ NO FIM (19/11/2026): o número errado não fica vermelho na hora. Com o tabuleiro cheio, "Conferir" mostra as
 * erradas e soma PENALIDADE_MS por casa errada ao tempo; acerta-se e confere-se de novo.
 */
export const PENALIDADE_MS = 30_000;
/** No "conferir na hora", cada erro custa isto no RECORDE do Solo: sem ele, chutar os 9 números depressa valia recorde. */
export const PENALIDADE_NA_HORA_MS = 10_000;

interface Jogador {
  tabuleiro: number[];
  erros: number;
  terminouEm: number | null;
  /** O tempo somado pelas conferências erradas (só no "conferir no fim"). */
  penalidadeMs: number;
  /** As casas que a última conferência achou erradas: ficam vermelhas até a pessoa mexer nelas. */
  marcadas: Set<number>;
}

export const sudoku: Definicao = {
  comecar(ctx, { naSala, criadaPor, corpo }) {
    const dificuldade: Dificuldade = String(corpo.dificuldade) in DIFICULDADES ? (String(corpo.dificuldade) as Dificuldade) : 'medio';
    const noFim = corpo.conferencia === 'fim';
    const { enigma, solucao } = gerarSudoku(Math.random, DIFICULDADES[dificuldade]);
    const inicio = Date.now();
    let fase: 'jogando' | 'fim' = 'jogando';
    const novo = (): Jogador => ({ tabuleiro: [...enigma], erros: 0, terminouEm: null, penalidadeMs: 0, marcadas: new Set() });
    const jogadores = new Map<number, Jogador>(naSala.map((id) => [id, novo()]));
    const aPreencher = enigma.filter((n) => n === 0).length;
    const certas = (j: Jogador) => j.tabuleiro.filter((n, i) => enigma[i] === 0 && n === solucao[i]).length;
    const preenchidas = (j: Jogador) => j.tabuleiro.filter((n, i) => enigma[i] === 0 && n !== 0).length;
    // O RECORDE DO SOLO, por dificuldade e modo: o tempo que o SERVIDOR mediu, com as penalidades.
    const variante = `${dificuldade}${noFim ? ':fim' : ''}`;
    let recorde: { antes: number | null; novo: boolean; valor: number | null } | null = null;
    if (ctx.solo) {
      lerRecordeDoSolo(criadaPor, 'sudoku', variante, (r) => {
        recorde = { antes: r?.valor ?? null, novo: false, valor: null };
        ctx.avisar();
      });
    }

    const acabar = () => {
      if (fase === 'fim') return;
      fase = 'fim';
      ctx.terminar();
    };
    ctx.agendar(SUDOKU_MS, acabar);
    // Acaba quando todo mundo da sala terminou; quem saiu da sala não segura os outros.
    const todosProntos = () => {
      const naSalaAgora = ctx.naSala();
      return [...jogadores.entries()].every(([id, x]) => x.terminouEm !== null || !naSalaAgora.includes(id));
    };
    const terminar = (quem: number, j: Jogador) => {
      j.terminouEm = Date.now() - inicio + j.penalidadeMs;
      if (ctx.solo && quem === criadaPor) {
        const valor = j.terminouEm + (noFim ? 0 : j.erros * PENALIDADE_NA_HORA_MS);
        guardarRecordeDoSolo(quem, 'sudoku', variante, valor, true, { erros: j.erros }, (r) => {
          recorde = { antes: r.antes, novo: r.novo, valor };
          ctx.avisar();
        });
      }
    };

    return {
      publico(quem) {
        const meu = jogadores.get(quem);
        return {
          fase,
          enigma,
          dificuldade,
          conferencia: noFim ? 'fim' : 'hora',
          // As escolhas da largada, para o "Jogar de novo".
          largada: { dificuldade, conferencia: noFim ? 'fim' : 'hora' },
          // O tabuleiro de cada um é só dele; dos outros, a sala vê o quanto já foi.
          meu: meu?.tabuleiro ?? null,
          errados: meu
            ? noFim
              ? [...meu.marcadas].filter((i) => meu.tabuleiro[i] !== solucao[i])
              : meu.tabuleiro.map((n, i) => (n && n !== solucao[i] ? i : -1)).filter((i) => i >= 0)
            : [],
          penalidadeMs: meu?.penalidadeMs ?? 0,
          total: aPreencher,
          recorde,
          corrida: [...jogadores.entries()]
            // No "conferir no fim", a barra é das casas PREENCHIDAS: a das certas contaria a cada um o que está errado.
            .map(([userId, j]) => ({ userId, username: ctx.nome(userId), certas: noFim ? preenchidas(j) : certas(j), erros: j.erros, tempoMs: j.terminouEm }))
            .sort(
              (a, b) =>
                (a.tempoMs ?? Infinity) - (b.tempoMs ?? Infinity) || b.certas - a.certas || a.erros - b.erros || a.username.localeCompare(b.username),
            ),
        };
      },
      acao(quem, corpo) {
        if (corpo.tipo !== 'jogada' && corpo.tipo !== 'conferir') return 'Ação desconhecida.';
        if (fase !== 'jogando') return 'A partida acabou.';
        let j = jogadores.get(quem);
        if (!j) {
          j = novo();
          jogadores.set(quem, j);
        }
        if (j.terminouEm !== null) return null;
        if (corpo.tipo === 'conferir') {
          if (!noFim) return 'Nesta partida cada número é conferido na hora.';
          if (preenchidas(j) < aPreencher) return 'Preencha todas as casas antes de conferir.';
          const erradas = j.tabuleiro.map((n, i) => (enigma[i] === 0 && n !== solucao[i] ? i : -1)).filter((i) => i >= 0);
          j.marcadas = new Set(erradas);
          j.erros += erradas.length;
          j.penalidadeMs += erradas.length * PENALIDADE_MS;
          if (erradas.length === 0) terminar(quem, j);
        } else {
          const casa = Number(corpo.casa);
          const valor = Number(corpo.valor);
          if (!Number.isInteger(casa) || casa < 0 || casa > 80 || enigma[casa] !== 0) return 'Essa casa não está livre.';
          if (!Number.isInteger(valor) || valor < 0 || valor > 9) return 'Escolha um número de 1 a 9.';
          j.tabuleiro[casa] = valor;
          j.marcadas.delete(casa);
          if (!noFim && valor && valor !== solucao[casa]) j.erros++;
          if (!noFim && certas(j) === aPreencher) terminar(quem, j);
        }
        if (todosProntos()) acabar();
        else ctx.avisar();
        return null;
      },
      conferir() {
        if (fase === 'jogando' && todosProntos()) acabar();
      },
    };
  },
};
