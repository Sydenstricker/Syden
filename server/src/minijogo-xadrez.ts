import { readFileSync } from 'node:fs';
import { type Definicao, placar } from './minijogo-motor.js';

/**
 * OS PROBLEMAS DE XADREZ DO LICHESS (licença CC0), em corrida: todo mundo recebe o mesmo problema, cada um
 * resolve no próprio tabuleiro, e quem acerta mais rápido ganha o ponto extra. Cinco problemas, do mais
 * fácil ao mais difícil. A lista (server/assets/problemas-de-xadrez.json) sai de
 * server/scripts/problemas-de-xadrez.mjs; o navegador nunca fala com o Lichess.
 *
 * COMO O LICHESS ESCREVE UM PROBLEMA: a posição (FEN) é a de ANTES do lance do adversário, e o primeiro lance
 * da lista é o dele. Quem resolve joga os lances ímpares da lista, e a resposta do adversário vem sozinha.
 *
 * O SERVIDOR NÃO PRECISA SABER XADREZ INTEIRO: ele só compara o lance com o da solução e move as peças. Por
 * isso não há biblioteca de regras aqui — mover, rocar, comer en passant e promover bastam.
 */

type Problema = [id: string, fen: string, lances: string, nota: number];

export const PROBLEMAS: Problema[] = JSON.parse(readFileSync(new URL('../assets/problemas-de-xadrez.json', import.meta.url), 'utf8'));

export const RODADAS_XADREZ = 5;
export const RESOLVENDO_MS = 60_000;
export const SOLUCAO_MS = 7_000;
/** As faixas de dificuldade de cada rodada: a lista vem em quatro faixas iguais, da mais fácil à mais difícil. */
const FAIXA_DA_RODADA = [0, 1, 1, 2, 3];

/** "e2" → a casa no vetor de 64, com a8 em 0 e h1 em 63 (a ordem em que se desenha o tabuleiro). */
export const casa = (nome: string) => (8 - Number(nome[1])) * 8 + (nome.charCodeAt(0) - 97);

/** A posição do FEN: a peça de cada casa ('' vazia; maiúscula branca, minúscula preta) e de quem é a vez. */
export function lerFen(fen: string): { casas: string[]; vez: 'w' | 'b' } {
  const [tabuleiro, vez] = fen.split(' ');
  const casas: string[] = [];
  for (const c of tabuleiro.replace(/\//g, '')) {
    if (/\d/.test(c)) casas.push(...Array<string>(Number(c)).fill(''));
    else casas.push(c);
  }
  return { casas, vez: vez === 'b' ? 'b' : 'w' };
}

/** Faz o lance (em UCI: "e2e4", "e7e8q") e devolve o tabuleiro novo. */
export function jogar(casas: string[], uci: string): string[] {
  const novo = [...casas];
  const de = casa(uci.slice(0, 2));
  const para = casa(uci.slice(2, 4));
  const peca = novo[de];
  const branca = peca === peca.toUpperCase();
  // Roque: o rei anda duas casas, e a torre do mesmo lado pula para o outro lado dele.
  if (peca.toLowerCase() === 'k' && Math.abs((de % 8) - (para % 8)) === 2) {
    const linha = de - (de % 8);
    const [torreDe, torrePara] = para % 8 === 6 ? [linha + 7, linha + 5] : [linha, linha + 3];
    novo[torrePara] = novo[torreDe];
    novo[torreDe] = '';
  }
  // En passant: o peão anda na diagonal para uma casa vazia, e come o peão que estava ao lado.
  if (peca.toLowerCase() === 'p' && de % 8 !== para % 8 && !novo[para]) {
    novo[(de - (de % 8)) + (para % 8)] = '';
  }
  novo[para] = uci.length === 5 ? (branca ? uci[4].toUpperCase() : uci[4].toLowerCase()) : peca;
  novo[de] = '';
  return novo;
}

/** O lance de quem joga confere com o da solução? (Sem a letra da promoção, vale a dama.) */
export const confere = (lance: string, esperado: string) =>
  lance === esperado || (lance.length === 4 && esperado === `${lance}q`);

interface Tentativa {
  casas: string[];
  /** Quantos lances da solução já foram (os de quem resolve e as respostas). */
  passo: number;
  estado: 'resolvendo' | 'acertou' | 'errou';
  tempoMs: number | null;
  ultimo: string | null;
  erro: string | null;
}

export const xadrez: Definicao = {
  comecar(ctx, { naSala }) {
    if (PROBLEMAS.length < 4) return 'Os problemas de xadrez não estão no servidor.';
    const porFaixa = PROBLEMAS.length / 4;
    const usados = new Set<number>();
    const sortear = (faixa: number) => {
      for (;;) {
        const i = Math.floor(faixa * porFaixa + Math.random() * porFaixa);
        if (!usados.has(i)) {
          usados.add(i);
          return PROBLEMAS[i];
        }
      }
    };

    let rodada = 1;
    let fase: 'resolvendo' | 'solucao' | 'fim' = 'resolvendo';
    let problema = sortear(FAIXA_DA_RODADA[0]);
    let inicio = Date.now();
    let posicao: string[] = [];
    let cor: 'w' | 'b' = 'w';
    let lances: string[] = [];
    let solucao: string[] = [];
    const tentativas = new Map<number, Tentativa>();
    const pontos = new Map(naSala.map((id) => [id, 0]));

    const nova = (): Tentativa => ({ casas: posicao, passo: 1, estado: 'resolvendo', tempoMs: null, ultimo: lances[0], erro: null });

    function novoProblema() {
      const [, fen, texto] = problema;
      lances = texto.split(' ');
      const inicial = lerFen(fen);
      // O primeiro lance é do adversário: quem resolve joga com a outra cor.
      cor = inicial.vez === 'w' ? 'b' : 'w';
      posicao = jogar(inicial.casas, lances[0]);
      solucao = lances.reduce((casas, l) => jogar(casas, l), inicial.casas);
      tentativas.clear();
      for (const id of pontos.keys()) tentativas.set(id, nova());
      fase = 'resolvendo';
      inicio = Date.now();
      ctx.agendar(RESOLVENDO_MS, mostrarSolucao);
      ctx.avisar();
    }

    function mostrarSolucao() {
      if (fase !== 'resolvendo') return;
      const acertaram = [...tentativas.entries()].filter(([, t]) => t.estado === 'acertou');
      for (const [id] of acertaram) pontos.set(id, (pontos.get(id) ?? 0) + 1);
      // O ponto extra é de quem acertou primeiro.
      const primeiro = acertaram.sort(([, a], [, b]) => (a.tempoMs ?? 0) - (b.tempoMs ?? 0))[0];
      if (primeiro) pontos.set(primeiro[0], (pontos.get(primeiro[0]) ?? 0) + 1);
      fase = 'solucao';
      ctx.agendar(SOLUCAO_MS, () => {
        if (rodada >= RODADAS_XADREZ) {
          fase = 'fim';
          return ctx.terminar();
        }
        rodada++;
        problema = sortear(FAIXA_DA_RODADA[rodada - 1]);
        novoProblema();
      });
      ctx.avisar();
    }

    novoProblema();
    return {
      publico(quem) {
        const minha = tentativas.get(quem) ?? nova();
        const resolvido = fase !== 'resolvendo';
        return {
          rodada,
          rodadas: RODADAS_XADREZ,
          fase,
          problema: problema[0],
          nota: problema[3],
          cor,
          // Na solução, todo mundo vê o fim do problema; antes, cada um vê o próprio tabuleiro.
          casas: resolvido ? solucao : minha.casas,
          ultimo: resolvido ? lances[lances.length - 1] : minha.ultimo,
          estado: minha.estado,
          erro: minha.erro,
          jogadores: [...tentativas.entries()].map(([userId, t]) => ({ userId, username: ctx.nome(userId), estado: t.estado, tempoMs: t.tempoMs })),
          placar: placar(pontos, ctx.nome),
        };
      },
      acao(quem, corpo) {
        if (corpo.tipo !== 'lance') return 'Ação desconhecida.';
        if (fase !== 'resolvendo') return 'Este problema já acabou.';
        const lance = String(corpo.lance ?? '').toLowerCase();
        if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(lance)) return 'Lance inválido.';
        let t = tentativas.get(quem);
        if (!t) {
          t = nova();
          tentativas.set(quem, t);
          if (!pontos.has(quem)) pontos.set(quem, 0);
        }
        if (t.estado !== 'resolvendo') return null;
        if (!confere(lance, lances[t.passo])) {
          t.estado = 'errou';
          t.erro = lance;
        } else {
          t.casas = jogar(t.casas, lances[t.passo]);
          t.ultimo = lances[t.passo];
          t.passo++;
          if (t.passo < lances.length) {
            // A resposta do adversário vem sozinha.
            t.casas = jogar(t.casas, lances[t.passo]);
            t.ultimo = lances[t.passo];
            t.passo++;
          }
          if (t.passo >= lances.length) {
            t.estado = 'acertou';
            t.tempoMs = Date.now() - inicio;
          }
        }
        // Todo mundo da sala já acertou ou errou: a solução aparece na hora.
        const naSalaAgora = ctx.naSala();
        if ([...tentativas.entries()].every(([id, x]) => x.estado !== 'resolvendo' || !naSalaAgora.includes(id))) mostrarSolucao();
        else ctx.avisar();
        return null;
      },
    };
  },
};
