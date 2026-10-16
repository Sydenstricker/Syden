import { embaralhar, type Definicao } from './minijogo-motor.js';

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

/** Um tabuleiro com solução única e `vazias` casas a preencher. */
export function gerarSudoku(aleatorio = Math.random, vazias = VAZIAS): { enigma: number[]; solucao: number[] } {
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

interface Jogador {
  tabuleiro: number[];
  erros: number;
  terminouEm: number | null;
}

export const sudoku: Definicao = {
  comecar(ctx, { naSala }) {
    const { enigma, solucao } = gerarSudoku();
    const inicio = Date.now();
    let fase: 'jogando' | 'fim' = 'jogando';
    const jogadores = new Map<number, Jogador>(naSala.map((id) => [id, { tabuleiro: [...enigma], erros: 0, terminouEm: null }]));
    const aPreencher = enigma.filter((n) => n === 0).length;
    const certas = (j: Jogador) => j.tabuleiro.filter((n, i) => enigma[i] === 0 && n === solucao[i]).length;

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

    return {
      publico(quem) {
        const meu = jogadores.get(quem);
        return {
          fase,
          enigma,
          // O tabuleiro de cada um é só dele; dos outros, a sala vê o quanto já foi.
          meu: meu?.tabuleiro ?? null,
          errados: meu ? meu.tabuleiro.map((n, i) => (n && n !== solucao[i] ? i : -1)).filter((i) => i >= 0) : [],
          total: aPreencher,
          corrida: [...jogadores.entries()]
            .map(([userId, j]) => ({ userId, username: ctx.nome(userId), certas: certas(j), erros: j.erros, tempoMs: j.terminouEm }))
            .sort(
              (a, b) =>
                (a.tempoMs ?? Infinity) - (b.tempoMs ?? Infinity) || b.certas - a.certas || a.erros - b.erros || a.username.localeCompare(b.username),
            ),
        };
      },
      acao(quem, corpo) {
        if (corpo.tipo !== 'jogada') return 'Ação desconhecida.';
        if (fase !== 'jogando') return 'A partida acabou.';
        const casa = Number(corpo.casa);
        const valor = Number(corpo.valor);
        if (!Number.isInteger(casa) || casa < 0 || casa > 80 || enigma[casa] !== 0) return 'Essa casa não está livre.';
        if (!Number.isInteger(valor) || valor < 0 || valor > 9) return 'Escolha um número de 1 a 9.';
        let j = jogadores.get(quem);
        if (!j) {
          j = { tabuleiro: [...enigma], erros: 0, terminouEm: null };
          jogadores.set(quem, j);
        }
        if (j.terminouEm !== null) return null;
        j.tabuleiro[casa] = valor;
        if (valor && valor !== solucao[casa]) j.erros++;
        if (certas(j) === aPreencher) j.terminouEm = Date.now() - inicio;
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
