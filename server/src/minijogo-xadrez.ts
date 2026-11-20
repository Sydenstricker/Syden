import { readFileSync } from 'node:fs';
import { Chess, type Move } from 'chess.js';
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

/** O quinto campo, os temas do Lichess separados por espaço, só existe no arquivo gerado depois de 19/11/2026. */
type Problema = [id: string, fen: string, lances: string, nota: number, temas?: string];

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
  /** A posição de verdade (o chess.js), só para dizer à tela quais casas cada peça alcança: quem decide é a solução. */
  jogo: Chess | null;
  /** A DICA pedida neste passo: a casa da peça que move (o servidor a tira da solução). */
  dica: number | null;
}

/**
 * O MODO CORRIDA (19/11/2026, só no Solo): 3 minutos de problemas em sequência, do mais fácil ao mais difícil (a faixa sobe a
 * cada três), e o erro tira 10 segundos e passa ao próximo. Vale quantos a pessoa resolveu, e o melhor fica na tabela comum
 * de recordes (`xadrez`, variante `corrida`), contado pelo servidor.
 */
export const CORRIDA_MS = 3 * 60_000;
export const PENALIDADE_MS = 10_000;
export const PROBLEMAS_POR_FAIXA_NA_CORRIDA = 3;

/**
 * O MODO SEQUÊNCIA (20/11/2026, só no Solo): um problema atrás do outro, cada acerto um pouco mais difícil (a nota sobe pela
 * lista ordenada, do mais fácil ao mais difícil em PASSOS_DA_SEQUENCIA acertos), e o PRIMEIRO ERRO acaba (o tempo de um problema
 * passar também). Vale quantos a pessoa acertou SEM dica, na tabela comum (`xadrez`, variante `sequencia`), contado pelo servidor.
 *
 * A DICA (20/11/2026, todos os modos): acende a peça que move no passo de agora, tirada da solução pelo servidor. Custa: nas
 * rodadas, o problema não dá ponto; na sequência, o acerto passa mas não conta; na corrida, -10 s (PENALIDADE_MS) a cada dica.
 */
export const PASSOS_DA_SEQUENCIA = 40;
export const SEQUENCIA_MS = 2 * 60_000;

/**
 * OS TEMAS (19/11/2026): o arquivo do Lichess traz os temas de cada problema ("mateIn1", "fork", "pin"…), e o script os
 * guarda como quinto campo. Escolhendo um tema, só os problemas dele entram; o arquivo antigo, sem temas, não tem nenhum.
 */
export const TEMAS_DOS_PROBLEMAS = ['mateIn1', 'mateIn2', 'fork', 'pin', 'skewer', 'discoveredAttack', 'hangingPiece', 'endgame', 'sacrifice', 'promotion'] as const;
export const temasDe = (p: Problema) => (p[4] ?? '').split(' ').filter(Boolean);

/** A posição do problema no chess.js, com o lance do adversário já feito (null se o FEN não abrir). */
function posicaoDe(fen: string, primeiro: string): Chess | null {
  try {
    const jogo = new Chess(fen);
    jogo.move({ from: primeiro.slice(0, 2), to: primeiro.slice(2, 4), promotion: primeiro[4] });
    return jogo;
  } catch {
    return null;
  }
}

/** As casas que as peças de quem tem a vez alcançam, de-para (o destaque da tela). */
function lancesDaTentativa(t: Tentativa): { de: number; para: number }[] {
  if (!t.jogo || t.estado !== 'resolvendo') return [];
  const vistos = new Set<string>();
  const lista: { de: number; para: number }[] = [];
  for (const m of t.jogo.moves({ verbose: true }) as Move[]) {
    if (vistos.has(m.from + m.to)) continue;
    vistos.add(m.from + m.to);
    lista.push({ de: casa(m.from), para: casa(m.to) });
  }
  return lista;
}

const andar = (t: Tentativa, uci: string) => {
  t.casas = jogar(t.casas, uci);
  t.ultimo = uci;
  try {
    t.jogo?.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  } catch {
    t.jogo = null;
  }
};

/**
 * Onde a corrida guarda o recorde (a tabela comum de db.ts). Vem de fora, das rotas: importar o banco aqui o abriria antes de o
 * teste escolher o dele. Sem ela, a corrida roda e o recorde não se grava.
 */
export interface RecordesDoXadrez {
  recordeDoSolo(userId: number, jogo: string, variante?: string): { valor: number } | null;
  guardarRecordeDoSolo(userId: number, jogo: string, variante: string, valor: number, menorMelhor: boolean, extra?: unknown): { antes: number | null; novo: boolean };
}

export function criarXadrez({ agora = Date.now, aleatorio = Math.random, recordes = null as RecordesDoXadrez | null } = {}): Definicao {
  return {
    comecar(ctx, { naSala, criadaPor, corpo }) {
      const tema = typeof corpo?.tema === 'string' && (TEMAS_DOS_PROBLEMAS as readonly string[]).includes(corpo.tema) ? corpo.tema : null;
      const lista = tema ? PROBLEMAS.filter((p) => temasDe(p).includes(tema)) : PROBLEMAS;
      if (lista.length < 4) return tema ? 'Ainda não há problemas desse tema.' : 'Os problemas de xadrez não estão no servidor.';
      const corrida = ctx.solo === true && corpo?.modo === 'corrida';
      const sequencia = ctx.solo === true && !corrida && corpo?.modo === 'sequencia';
      // a lista vem em ordem de nota (o script guarda as faixas em ordem): quatro faixas iguais
      const ordenada = [...lista].sort((a, b) => a[3] - b[3]);
      const porFaixa = ordenada.length / 4;
      const usados = new Set<number>();
      const sortear = (faixa: number) => {
        for (let k = 0; ; k++) {
          const i = Math.floor(faixa * porFaixa + aleatorio() * porFaixa);
          if (!usados.has(i) || k > 200) {
            usados.add(i);
            return ordenada[Math.min(ordenada.length - 1, i)];
          }
        }
      };

      let rodada = 1;
      let fase: 'resolvendo' | 'solucao' | 'fim' = 'resolvendo';
      let problema = sortear(FAIXA_DA_RODADA[0]);
      let inicio = agora();
      let fen = '';
      let posicao: string[] = [];
      let cor: 'w' | 'b' = 'w';
      let lances: string[] = [];
      let solucao: string[] = [];
      const tentativas = new Map<number, Tentativa>();
      const pontos = new Map(naSala.map((id) => [id, 0]));
      // a corrida
      let fimDaCorrida = inicio + CORRIDA_MS;
      let resolvidos = 0;
      let erros = 0;
      let recorde: { antes: number | null; novo: boolean } | null = null;
      const varianteDoRecorde = corrida ? 'corrida' : sequencia ? 'sequencia' : null;
      const recordeAntes = varianteDoRecorde ? (recordes?.recordeDoSolo(criadaPor, 'xadrez', varianteDoRecorde)?.valor ?? null) : null;
      // a sequência
      let acertos = 0;
      let comDicaNaSequencia = 0;
      /** Quem pediu dica no problema de agora (o "de novo" do Solo não apaga). */
      const pediuDica = new Set<number>();
      let dicas = 0;

      const nova = (): Tentativa => ({ casas: posicao, passo: 1, estado: 'resolvendo', tempoMs: null, ultimo: lances[0], erro: null, jogo: posicaoDe(fen, lances[0]), dica: null });

      function montar() {
        const [, f, texto] = problema;
        fen = f;
        lances = texto.split(' ');
        const inicial = lerFen(fen);
        // O primeiro lance é do adversário: quem resolve joga com a outra cor.
        cor = inicial.vez === 'w' ? 'b' : 'w';
        posicao = jogar(inicial.casas, lances[0]);
        solucao = lances.reduce((casas, l) => jogar(casas, l), inicial.casas);
        tentativas.clear();
        pediuDica.clear();
        for (const id of pontos.keys()) tentativas.set(id, nova());
      }

      function novoProblema() {
        montar();
        fase = 'resolvendo';
        inicio = agora();
        ctx.agendar(RESOLVENDO_MS, mostrarSolucao);
        ctx.avisar();
      }

      function mostrarSolucao() {
        if (fase !== 'resolvendo') return;
        // quem acertou com dica não leva ponto (nem o extra)
        const acertaram = [...tentativas.entries()].filter(([id, t]) => t.estado === 'acertou' && !pediuDica.has(id));
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

      // ---- a corrida: o relógio é um só, e cada problema vem na hora
      const faixaDaCorrida = () => Math.min(3, Math.floor((resolvidos + erros) / PROBLEMAS_POR_FAIXA_NA_CORRIDA));
      const acabarCorrida = () => {
        if (fase === 'fim') return;
        fase = 'fim';
        pontos.set(criadaPor, resolvidos);
        // o número é do servidor: ele conferiu cada lance contra a solução
        recorde = resolvidos > 0 && recordes ? recordes.guardarRecordeDoSolo(criadaPor, 'xadrez', 'corrida', resolvidos, false, { erros }) : { antes: recordeAntes, novo: false };
        ctx.terminar();
      };
      const proximoDaCorrida = () => {
        const falta = fimDaCorrida - agora();
        if (falta <= 0) return acabarCorrida();
        problema = sortear(faixaDaCorrida());
        montar();
        rodada = resolvidos + erros + 1;
        ctx.agendar(falta, acabarCorrida);
        ctx.avisar();
      };

      // ---- a sequência: a nota sobe a cada acerto, e o primeiro erro acaba
      const sortearDaSequencia = () => {
        const passo = ordenada.length / PASSOS_DA_SEQUENCIA;
        for (let k = 0; ; k++) {
          const i = Math.min(ordenada.length - 1, Math.floor((acertos + comDicaNaSequencia) * passo + aleatorio() * passo));
          if (!usados.has(i) || k > 200) {
            usados.add(i);
            return ordenada[i];
          }
        }
      };
      const acabarSequencia = () => {
        if (fase === 'fim') return;
        fase = 'fim';
        pontos.set(criadaPor, acertos);
        // o número é do servidor: ele conferiu cada lance contra a solução, e o acerto com dica não conta
        recorde = acertos > 0 && recordes ? recordes.guardarRecordeDoSolo(criadaPor, 'xadrez', 'sequencia', acertos, false, { comDica: comDicaNaSequencia }) : { antes: recordeAntes, novo: false };
        ctx.terminar();
      };
      const proximoDaSequencia = () => {
        problema = sortearDaSequencia();
        montar();
        rodada = acertos + comDicaNaSequencia + 1;
        inicio = agora();
        ctx.agendar(SEQUENCIA_MS, acabarSequencia);
        ctx.avisar();
      };

      if (corrida) {
        montar();
        ctx.agendar(CORRIDA_MS, acabarCorrida);
      } else if (sequencia) {
        problema = sortearDaSequencia();
        montar();
        ctx.agendar(SEQUENCIA_MS, acabarSequencia);
      } else novoProblema();

      return {
        publico(quem) {
          const minha = tentativas.get(quem) ?? nova();
          const resolvido = fase !== 'resolvendo';
          return {
            modo: corrida ? 'corrida' : sequencia ? 'sequencia' : 'rodadas',
            tema,
            rodada,
            rodadas: corrida || sequencia ? null : RODADAS_XADREZ,
            fase,
            problema: problema[0],
            nota: problema[3],
            cor,
            // Na solução, todo mundo vê o fim do problema; antes, cada um vê o próprio tabuleiro.
            casas: resolvido && !corrida ? solucao : minha.casas,
            ultimo: resolvido && !corrida ? lances[lances.length - 1] : minha.ultimo,
            estado: minha.estado,
            erro: minha.erro,
            // as casas que cada peça alcança (o destaque da tela, como na partida)
            lances: fase === 'resolvendo' ? lancesDaTentativa(minha) : [],
            // no Solo, quem errou pode tentar o mesmo problema de novo
            podeTentarDeNovo: ctx.solo === true && !corrida && !sequencia && fase === 'resolvendo' && minha.estado === 'errou',
            // a dica: a casa da peça que move no passo de agora (só depois de pedida), e se este problema já a custou
            dica: fase === 'resolvendo' && minha.estado === 'resolvendo' ? minha.dica : null,
            comDica: pediuDica.has(quem),
            sequencia: sequencia ? { acertos, comDica: comDicaNaSequencia, recordeAntes, recorde } : null,
            corrida: corrida
              ? { restanteMs: Math.max(0, fimDaCorrida - agora()), resolvidos, erros, dicas, recordeAntes, recorde }
              : null,
            jogadores: [...tentativas.entries()].map(([userId, t]) => ({ userId, username: ctx.nome(userId), estado: t.estado, tempoMs: t.tempoMs })),
            placar: placar(pontos, ctx.nome),
          };
        },
        acao(quem, corpo) {
          if (corpo.tipo === 'de-novo') {
            if (!ctx.solo || corrida) return 'Só no Solo dá para tentar de novo.';
            if (fase !== 'resolvendo') return 'Este problema já acabou.';
            const t = tentativas.get(quem);
            if (!t || t.estado !== 'errou') return 'Você ainda está resolvendo.';
            tentativas.set(quem, nova());
            ctx.avisar();
            return null;
          }
          if (corpo.tipo === 'dica') {
            if (fase !== 'resolvendo') return 'Este problema já acabou.';
            const t = tentativas.get(quem);
            if (!t || t.estado !== 'resolvendo') return 'Você não está resolvendo este problema.';
            // a mesma dica de novo não custa de novo
            if (t.dica !== null) return null;
            t.dica = casa(lances[t.passo].slice(0, 2));
            pediuDica.add(quem);
            if (corrida) {
              dicas++;
              fimDaCorrida -= PENALIDADE_MS;
              const falta = fimDaCorrida - agora();
              if (falta <= 0) {
                acabarCorrida();
                return null;
              }
              ctx.agendar(falta, acabarCorrida);
            }
            ctx.avisar();
            return null;
          }
          if (corpo.tipo !== 'lance') return 'Ação desconhecida.';
          if (fase !== 'resolvendo') return 'Este problema já acabou.';
          const lance = String(corpo.lance ?? '').toLowerCase();
          if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(lance)) return 'Lance inválido.';
          let t = tentativas.get(quem);
          if (!t) {
            if (corrida) return 'Esta corrida não é sua.';
            t = nova();
            tentativas.set(quem, t);
            if (!pontos.has(quem)) pontos.set(quem, 0);
          }
          if (t.estado !== 'resolvendo') return null;
          if (!confere(lance, lances[t.passo])) {
            t.estado = 'errou';
            t.erro = lance;
          } else {
            // o passo andou: a dica era deste passo
            t.dica = null;
            andar(t, lances[t.passo]);
            t.passo++;
            // A resposta do adversário vem sozinha.
            if (t.passo < lances.length) {
              andar(t, lances[t.passo]);
              t.passo++;
            }
            if (t.passo >= lances.length) {
              t.estado = 'acertou';
              t.tempoMs = agora() - inicio;
            }
          }
          if (sequencia) {
            if (t.estado === 'errou') acabarSequencia();
            else if (t.estado === 'acertou') {
              if (pediuDica.has(quem)) comDicaNaSequencia++;
              else acertos++;
              proximoDaSequencia();
            } else ctx.avisar();
            return null;
          }
          if (corrida) {
            if (t.estado === 'errou') {
              erros++;
              fimDaCorrida -= PENALIDADE_MS;
              proximoDaCorrida();
            } else if (t.estado === 'acertou') {
              resolvidos++;
              proximoDaCorrida();
            } else ctx.avisar();
            return null;
          }
          // Todo mundo da sala já acertou ou errou: a solução aparece na hora. No Solo, quem errou ainda pode tentar de novo.
          const naSalaAgora = ctx.naSala();
          const todos = [...tentativas.entries()].every(([id, x]) => x.estado !== 'resolvendo' || !naSalaAgora.includes(id));
          if (todos && !(ctx.solo && t.estado === 'errou')) mostrarSolucao();
          else ctx.avisar();
          return null;
        },
      };
    },
  };
}

export const xadrez: Definicao = criarXadrez();
