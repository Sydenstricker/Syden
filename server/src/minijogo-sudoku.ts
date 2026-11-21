import { embaralhar, type Definicao } from './minijogo-motor.js';
import { guardarRecordeDoSolo, lerRecordeDoSolo } from './recorde-solo-tardio.js';
import { contarSolucoes, daReserva, encherReserva, gerarPelaTecnica, PEDIDO, preencher } from './sudoku-logica.js';

/**
 * O SUDOKU EM CORRIDA: todo mundo recebe o MESMO tabuleiro, cada um resolve no seu, e a sala vê a barra de
 * progresso de cada um subindo (desde 21/11/2026, também o COOPERATIVO: a turma no mesmo tabuleiro, ver acaoJuntos). Sudoku não tem palavra, então sai pronto nos 71 idiomas.
 *
 * O servidor gera o tabuleiro (com uma solução só, senão a corrida não é justa) e guarda a solução; o site
 * nunca a recebe. Cada número posto é conferido na hora: o errado fica vermelho e conta como erro no placar,
 * para quem chuta não andar mais rápido do que quem pensa.
 */

// A reserva dos tabuleiros difíceis começa a encher meio minuto depois de o servidor subir (sudoku-logica.ts), sem segurar a subida.
setTimeout(() => encherReserva(), 30_000).unref();

export const VAZIAS = 45;
export const SUDOKU_MS = 20 * 60_000;

export { contarSolucoes } from './sudoku-logica.js';

/**
 * Um tabuleiro com solução única e `vazias` casas a preencher, só pelo número de casas (o de antes de 20/11/2026; a partida
 * agora gera pela TÉCNICA, gerarPelaTecnica em sudoku-logica.ts). Tirar casas ao acaso nem sempre chega às 58 do "Muito
 * difícil" (a solução deixa de ser única antes): tenta de novo até chegar, e fica com o mais vazio se não chegar.
 */
export function gerarSudoku(aleatorio = Math.random, vazias = VAZIAS, x = false): { enigma: number[]; solucao: number[] } {
  let melhor = umaTentativa(aleatorio, vazias, x);
  for (let i = 0; i < 40 && melhor.enigma.filter((n) => n === 0).length < vazias; i++) {
    const outra = umaTentativa(aleatorio, vazias, x);
    if (outra.enigma.filter((n) => n === 0).length > melhor.enigma.filter((n) => n === 0).length) melhor = outra;
  }
  return melhor;
}

function umaTentativa(aleatorio: () => number, vazias: number, x: boolean): { enigma: number[]; solucao: number[] } {
  const solucao = new Array<number>(81).fill(0);
  preencher(solucao, aleatorio, x);
  const enigma = [...solucao];
  let tiradas = 0;
  for (const i of embaralhar([...Array(81).keys()], aleatorio)) {
    if (tiradas >= vazias) break;
    const guardado = enigma[i];
    enigma[i] = 0;
    if (contarSolucoes([...enigma], 2, x) === 1) tiradas++;
    else enigma[i] = guardado;
  }
  return { enigma, solucao };
}

/**
 * AS DIFICULDADES (19/11/2026, a auditoria dos mini-games): quantas casas vazias, no mínimo. "Médio" é o de sempre (45); o
 * gerador garante a solução única em todas. DESDE 20/11/2026 quem decide é a TÉCNICA (PEDIDO em sudoku-logica.ts): o Fácil sai só
 * com singles nus, o Médio pede os escondidos, o Difícil pares ou casas travadas, o Muito difícil o X-wing.
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
    // O SUDOKU COOPERATIVO (21/11/2026): só na sala; no Solo é sempre a corrida (sozinho, dá no mesmo)
    const juntos = corpo.modo === 'juntos' && !ctx.solo;
    // O SUDOKU X (20/11/2026): as duas diagonais também valem (cada uma com os nove números)
    const x = corpo.x === true;
    const pedido = PEDIDO[dificuldade];
    const gerado = daReserva(pedido, x) ?? gerarPelaTecnica(pedido, { x, prazoMs: 150 });
    encherReserva();
    const { enigma, solucao } = gerado;
    const inicio = Date.now();
    let fase: 'jogando' | 'fim' = 'jogando';
    const novo = (): Jogador => ({ tabuleiro: [...enigma], erros: 0, terminouEm: null, penalidadeMs: 0, marcadas: new Set() });
    const jogadores = new Map<number, Jogador>(naSala.map((id) => [id, novo()]));
    const aPreencher = enigma.filter((n) => n === 0).length;
    const certas = (j: Jogador) => j.tabuleiro.filter((n, i) => enigma[i] === 0 && n === solucao[i]).length;
    const preenchidas = (j: Jogador) => j.tabuleiro.filter((n, i) => enigma[i] === 0 && n !== 0).length;
    // O RECORDE DO SOLO, por dificuldade e modo: o tempo que o SERVIDOR mediu, com as penalidades.
    // o Sudoku X tem o recorde à parte (':x' no fim; as variantes de antes não mudam)
    const variante = `${dificuldade}${noFim ? ':fim' : ''}${x ? ':x' : ''}`;
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

    /**
     * O SUDOKU COOPERATIVO (21/11/2026, o lote D da segunda auditoria), escolhido na largada ao lado da corrida: a turma resolve
     * O MESMO TABULEIRO, junto. Cada casa preenchida aparece para todos, com quem a preencheu (`autores`). No "conferir na hora",
     * a casa certa TRAVA (ninguém apaga o acerto de ninguém) e a errada fica vermelha para todos, contando o erro de quem a pôs;
     * no "conferir no fim", qualquer um confere com o tabuleiro cheio, e a penalidade é da turma. O tempo é da turma: acaba
     * quando o tabuleiro fecha. Sem recorde (o recorde é do Solo, e no Solo não há cooperativo).
     */
    const comum = [...enigma];
    const autores: (number | null)[] = enigma.map(() => null);
    const contribuicao = new Map<number, { erros: number }>(naSala.map((id) => [id, { erros: 0 }]));
    let marcadasDaTurma = new Set<number>();
    let penalidadeDaTurma = 0;
    let terminouATurmaEm: number | null = null;
    const certasDaTurma = () => comum.filter((n, i) => enigma[i] === 0 && n === solucao[i]).length;
    const preenchidasDaTurma = () => comum.filter((n, i) => enigma[i] === 0 && n !== 0).length;
    const terminarATurma = () => {
      terminouATurmaEm = Date.now() - inicio + penalidadeDaTurma;
      acabar();
    };
    const acaoJuntos = (quem: number, corpo: Record<string, unknown>): string | null => {
      let c = contribuicao.get(quem);
      if (!c) {
        c = { erros: 0 };
        contribuicao.set(quem, c);
      }
      if (corpo.tipo === 'conferir') {
        if (!noFim) return 'Nesta partida cada número é conferido na hora.';
        if (preenchidasDaTurma() < aPreencher) return 'Preencha todas as casas antes de conferir.';
        const erradas = comum.map((n, i) => (enigma[i] === 0 && n !== solucao[i] ? i : -1)).filter((i) => i >= 0);
        marcadasDaTurma = new Set(erradas);
        // o erro conta para quem pôs o número errado
        for (const i of erradas) {
          const autor = autores[i];
          if (autor !== null) contribuicao.get(autor)!.erros++;
        }
        penalidadeDaTurma += erradas.length * PENALIDADE_MS;
        if (erradas.length === 0) {
          terminarATurma();
          return null;
        }
        ctx.avisar();
        return null;
      }
      const casa = Number(corpo.casa);
      const valor = Number(corpo.valor);
      if (!Number.isInteger(casa) || casa < 0 || casa > 80 || enigma[casa] !== 0) return 'Essa casa não está livre.';
      if (!Number.isInteger(valor) || valor < 0 || valor > 9) return 'Escolha um número de 1 a 9.';
      if (!noFim && comum[casa] !== 0 && comum[casa] === solucao[casa]) return 'Essa casa já está certa.';
      comum[casa] = valor;
      autores[casa] = valor ? quem : null;
      marcadasDaTurma.delete(casa);
      if (!noFim && valor && valor !== solucao[casa]) c.erros++;
      if (!noFim && certasDaTurma() === aPreencher) {
          terminarATurma();
          return null;
        }
      ctx.avisar();
      return null;
    };
    const publicoJuntos = () => {
      const certasPor = new Map<number, number>();
      comum.forEach((n, i) => {
        const autor = autores[i];
        if (autor === null || enigma[i] !== 0) return;
        // no "conferir no fim" conta o que cada um PREENCHEU (a certa contaria o que está errado)
        if (noFim || n === solucao[i]) certasPor.set(autor, (certasPor.get(autor) ?? 0) + 1);
      });
      return {
        fase,
        enigma,
        dificuldade,
        conferencia: noFim ? 'fim' : 'hora',
        x,
        juntos: true,
        largada: { dificuldade, conferencia: noFim ? 'fim' : 'hora', x, modo: 'juntos' },
        meu: comum,
        autores,
        errados: noFim ? [...marcadasDaTurma].filter((i) => comum[i] !== solucao[i]) : comum.map((n, i) => (n && n !== solucao[i] ? i : -1)).filter((i) => i >= 0),
        penalidadeMs: penalidadeDaTurma,
        total: aPreencher,
        recorde: null,
        turma: { certas: noFim ? preenchidasDaTurma() : certasDaTurma(), tempoMs: terminouATurmaEm },
        // a "corrida" do cooperativo é a parte de cada um: quantas casas pôs (e os erros), na ordem de quem pôs mais
        corrida: [...contribuicao.entries()]
          .map(([userId, k]) => ({ userId, username: ctx.nome(userId), certas: certasPor.get(userId) ?? 0, erros: k.erros, tempoMs: terminouATurmaEm }))
          .sort((a, b) => b.certas - a.certas || a.erros - b.erros || a.username.localeCompare(b.username)),
      };
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
        if (juntos) return publicoJuntos();
        const meu = jogadores.get(quem);
        return {
          fase,
          enigma,
          dificuldade,
          conferencia: noFim ? 'fim' : 'hora',
          x,
          // As escolhas da largada, para o "Jogar de novo".
          largada: { dificuldade, conferencia: noFim ? 'fim' : 'hora', x },
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
        if (juntos) return acaoJuntos(quem, corpo);
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
        // no cooperativo, quem sai não segura nem acaba: a turma que fica continua
        if (juntos) return;
        if (fase === 'jogando' && todosProntos()) acabar();
      },
    };
  },
};
