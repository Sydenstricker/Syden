/**
 * HORTA EM CASCATA (03/11/2026): trocar e combinar com a pilha subindo, em versus — o item 4 do fliperama (CLAUDE.md, "O
 * FLIPERAMA COMO HUB"). SÓ A MECÂNICA dos jogos de versus de 16 bits: nada de nome, personagem, arte ou som de ninguém, e
 * NÃO é Tetris (nada cai do alto em forma de peça, e a grade é de 6 × 12, com a pilha subindo de baixo).
 *
 * A REDE DECIDE O FORMATO, como na corrida e na festa: cada um joga NA PRÓPRIA TELA, e nada depende de contato ao vivo.
 * O servidor dá a SEMENTE (a mesma sequência de legumes para todos) e a largada; o site manda as JOGADAS (o passo e a casa
 * da troca, ou o "subir a pilha") em lotes, e o servidor REFAZ a partida de cada um com a mesma simulação
 * (blocos-sim.ts, a cópia igual à do site). É dela, e não do site, que saem os pontos, as cadeias, os caixotes que vão
 * para os outros e o momento em que a pilha chegou ao topo.
 *
 * OS CAIXOTES (o "lixo"): uma cadeia ou um combo na simulação do SERVIDOR vira caixote para um adversário (um de cada vez,
 * em roda, entre quem ainda está vivo), marcado para cair num passo do futuro do adversário (uns 1,5 s adiante). Ele vai
 * pelo estado da partida (o aviso de sempre, e a resposta de cada lote): o servidor é quem o cria, então não há o que
 * repassar de um site para outro — mais seguro que carimbar um caixote que o site dissesse ter mandado. Se o caixote chega
 * atrasado (o passo dele já passou naquela tela), o site refaz a própria partida desde o começo com ele no lugar certo,
 * e a tela pula; é o preço de nunca acreditar no site.
 *
 * O RELÓGIO: o passo dito não pode passar do que o servidor viu passar desde a largada (mais 1 s), e no versus quem fica
 * mais de 5 s para trás (a internet caiu, a aba dormiu) é levado adiante pelo servidor, SEM jogadas: a pilha continua
 * subindo, e ninguém fica vivo parando de mandar. As jogadas de antes do ponto aonde o servidor já chegou são recusadas, e
 * o site se acerta com a lista que o servidor aceitou (`versao`). No Solo dá para pausar (a janela sem foco para o jogo),
 * então lá só vale o teto.
 *
 * O QUE AINDA É POSSÍVEL, e fica, porque é jogo entre amigos: um programa que jogue sozinho pelo console (o servidor só
 * sabe que as jogadas são possíveis e no ritmo de uma mão: até 20 por segundo, e uma troca a cada 4 passos no máximo); e, no
 * Solo, pausar para pensar.
 *
 * O FIM DO VERSUS espera os atrasados: quando sobra um vivo, a partida só acaba depois que a simulação dele (no servidor)
 * passou do passo da última eliminação — senão quem estava atrás ganharia mesmo chegando ao topo antes. A espera é curta,
 * porque o servidor leva adiante quem fica mais de 5 s para trás. No teto de 8 minutos, todos são levados ao mesmo passo
 * antes da comparação.
 *
 * OS TROFÉUS (versus, com 2 pessoas ou mais que ficaram até o fim): a POSIÇÃO é a ordem de eliminação (quem chegou ao topo
 * por último, no passo da própria partida, fica na frente; quem sobra vivo é o primeiro, e se o tempo acabar com mais de um
 * vivo, os pontos desempatam); `pontos` é o placar de cada um, e `tempoMs` o quanto a pilha aguentou.
 */
import * as db from './db.js';
import { avancar, cabeNoRitmo, DOIS_MINUTOS, jogadaValida, PASSOS_POR_SEGUNDO, retrato, simulacao, trocaNoIntervalo, type Ataque, type Jogada, type Simulacao } from './blocos-sim.js';
import type { Definicao } from './minijogo-motor.js';

/** A contagem antes de começar (o site mostra 3, 2, 1). */
export const LARGADA_MS = 3000;
/** Um versus não passa disto (a pilha acelera, e lá pelos 4 minutos ninguém aguenta). */
export const VERSUS_MS = 8 * 60_000;
/** O Solo pode pausar: o teto é largo. */
export const SOLO_MS = 40 * 60_000;
/** O passo dito pode estar até isto à frente do relógio do servidor. */
export const FOLGA_FRENTE = PASSOS_POR_SEGUNDO;
/** No versus, quem fica mais que isto para trás é levado adiante pelo servidor. */
export const ATRASO_MAX = 5 * PASSOS_POR_SEGUNDO;
/** O caixote cai este tanto de passos depois do passo em que o adversário estava. */
export const ATRASO_DO_LIXO = 90;
export const MAX_POR_LOTE = 240;
export const MAX_JOGADORES = 8;
/** Sem novidade forte, o aviso à sala (para quem assiste ver as pilhas andarem) sai no máximo a cada tanto. */
const AVISO_MS = 2000;

export type Modo = 'versus' | 'sem-fim' | 'dois-minutos';

interface Jogador {
  userId: number;
  s: Simulacao;
  /** Quantas jogadas do site já foram lidas (aceitas ou recusadas): o lote seguinte começa daí. */
  recebidas: number;
  /** Sobe quando uma jogada é recusada: o site refaz a partida com a lista aceita. */
  versao: number;
  /** A versão que o site disse ter no último lote: a lista aceita só vai no estado enquanto as duas diferem. */
  versaoDoSite: number;
  /** O passo em que a pilha chegou ao topo (ou em que a pessoa saiu da sala). */
  eliminadoEm: number | null;
  saiu: boolean;
  /** A roda dos caixotes: o próximo adversário. */
  alvo: number;
  /** Fez ao menos uma troca: um resultado de verdade (quem só deixou a pilha subir não sobe ao pódio). */
  jogou: boolean;
}

export const blocos: Definicao = criarBlocos();

export interface OpcoesDosBlocos {
  agora?: () => number;
  aleatorio?: () => number;
}

export function criarBlocos({ agora = Date.now, aleatorio = Math.random }: OpcoesDosBlocos = {}): Definicao {
  return {
    minimo: 2,
    comecar(ctx, { naSala, corpo }) {
      const inscritos = naSala.slice(0, MAX_JOGADORES);
      const pedido = corpo.modo ?? corpo.categoria;
      const versus = inscritos.length >= 2;
      const modo: Modo = versus ? 'versus' : pedido === 'dois-minutos' ? 'dois-minutos' : 'sem-fim';
      const semente = Math.floor(aleatorio() * 0x7fffffff);
      const evento = `blocos-${ctx.comunidade ?? 0}-${agora()}`;
      const jogadores = new Map<number, Jogador>(
        inscritos.map((userId) => [
          userId,
          { userId, s: simulacao(semente, modo === 'dois-minutos' ? DOIS_MINUTOS : 0), recebidas: 0, versao: 0, versaoDoSite: 0, eliminadoEm: null, saiu: false, alvo: 0, jogou: false },
        ]),
      );
      let fase: 'largada' | 'jogando' | 'fim' = 'largada';
      let inicioEm = 0;
      let lixoId = 0;
      let ultimoAviso = 0;
      let resultado: { userId: number; username: string; lugar: number | null; pontos: number; tempoMs: number }[] | null = null;

      const decorrido = () => (fase === 'largada' ? 0 : Math.floor(((agora() - inicioEm) * PASSOS_POR_SEGUNDO) / 1000));
      const vivos = () => [...jogadores.values()].filter((j) => j.eliminadoEm === null);

      /** Um caixote para o próximo adversário vivo, na roda. */
      const mandar = (de: Jogador, ataque: Ataque) => {
        if (!versus) return;
        const alvos = inscritos.map((id) => jogadores.get(id)!).filter((j) => j !== de && j.eliminadoEm === null);
        if (alvos.length === 0) return;
        const alvo = alvos[de.alvo++ % alvos.length];
        const ultimo = alvo.s.lixos[alvo.s.lixos.length - 1];
        const n = Math.max(alvo.s.e.passo, decorrido(), ultimo?.n ?? 0) + ATRASO_DO_LIXO;
        alvo.s.lixos.push({ id: ++lixoId, n, largura: ataque.largura, altura: ataque.altura });
      };

      /** Anda a partida de alguém até `ate`; devolve se algo que os outros precisam saber aconteceu. */
      const andar = (j: Jogador, ate: number) => {
        let forte = false;
        avancar(j.s, ate, (r) => {
          for (const a of r.ataques) {
            mandar(j, a);
            if (versus) forte = true;
          }
        });
        if (j.s.e.fim && j.eliminadoEm === null && (j.s.e.fim === 'topo' || !versus)) {
          j.eliminadoEm = j.s.e.passo;
          forte = true;
        }
        return forte;
      };

      /** Quem saiu da sala, e (no versus) quem ficou para trás demais. */
      const arrumar = () => {
        let forte = false;
        if (fase !== 'jogando') return false;
        const naSala = new Set(ctx.naSala());
        for (const j of jogadores.values()) {
          if (j.saiu || naSala.has(j.userId)) continue;
          j.saiu = true;
          if (j.eliminadoEm === null) j.eliminadoEm = j.s.e.passo;
          forte = true;
        }
        if (versus) {
          const limite = decorrido() - ATRASO_MAX;
          for (const j of vivos()) if (j.s.e.passo < limite && andar(j, limite)) forte = true;
        }
        return forte;
      };

      const ordenar = (lista: Jogador[]) => {
        // vivo na frente (pelos pontos); depois, quem chegou ao topo mais tarde
        const chave = (j: Jogador) => (j.eliminadoEm === null ? [0, -j.s.e.pontos] : [1, -j.eliminadoEm]);
        const melhor = (a: number[], b: number[]) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);
        return lista
          .map((j) => ({ j, lugar: 1 + lista.filter((o) => melhor(chave(o), chave(j))).length }))
          .sort((a, b) => a.lugar - b.lugar || ctx.nome(a.j.userId).localeCompare(ctx.nome(b.j.userId)));
      };
      const tempoDe = (j: Jogador) => Math.round(((j.eliminadoEm ?? j.s.e.passo) * 1000) / PASSOS_POR_SEGUNDO);

      const terminar = () => {
        if (fase === 'fim') return;
        fase = 'fim';
        const todos = inscritos.map((id) => jogadores.get(id)!);
        const naSala = new Set(ctx.naSala());
        // A POSIÇÃO é só entre quem ficou até o fim (a mesma conta do troféu; empatados dividem); quem saiu vem embaixo, sem
        // posição. No Solo, a pessoa é a turma.
        const turma = versus ? todos.filter((j) => !j.saiu && naSala.has(j.userId)) : todos;
        const linha = (j: Jogador, lugar: number | null) => ({ userId: j.userId, username: ctx.nome(j.userId), lugar, pontos: j.s.e.pontos, tempoMs: tempoDe(j) });
        resultado = [
          ...ordenar(turma).map(({ j, lugar }) => linha(j, lugar)),
          ...todos
            .filter((j) => !turma.includes(j))
            .sort((a, b) => ctx.nome(a.userId).localeCompare(ctx.nome(b.userId)))
            .map((j) => linha(j, null)),
        ];
        // O PÓDIO: só no versus, só entre quem ficou até o fim (2 ou mais), e só quem jogou de verdade
        if (versus) {
          if (turma.length >= 2) {
            for (const { j, lugar } of ordenar(turma)) {
              if (lugar > 3 || !j.jogou) continue;
              db.guardarTrofeu({
                userId: j.userId,
                evento,
                communityId: ctx.comunidade ?? 0,
                pista: 'blocos',
                posicao: lugar,
                tempoMs: tempoDe(j),
                pontos: j.s.e.pontos,
                rivais: turma.filter((o) => o !== j).map((o) => o.userId),
              });
            }
          }
        }
        ctx.terminar();
      };

      /**
       * Acabou? No Solo, quando a partida da pessoa acaba. No versus, quando sobra um (ou nenhum) E a simulação de quem sobrou
       * já chegou ao passo da última eliminação: quem estava atrás ainda pode chegar ao topo antes dele, e aí perde.
       */
      const conferirFim = () => {
        if (fase !== 'jogando') return;
        if (!versus) {
          if (vivos().length === 0) terminar();
          return;
        }
        const restam = vivos();
        if (restam.length > 1) return;
        const ultima = Math.max(0, ...[...jogadores.values()].filter((j) => !j.saiu && j.eliminadoEm !== null).map((j) => j.eliminadoEm!));
        if (restam.every((j) => j.s.e.passo >= ultima)) terminar();
      };

      /** O teto de 8 minutos: os vivos que estão atrás são levados ao passo do mais adiantado, e a comparação é no mesmo passo. */
      const noTeto = () => {
        if (fase !== 'jogando') return;
        if (versus) {
          arrumar();
          const ate = Math.max(0, ...vivos().map((j) => j.s.e.passo));
          for (const j of vivos()) if (j.s.e.passo < ate) andar(j, ate);
        }
        terminar();
      };

      const avisar = (forte: boolean) => {
        if (fase === 'fim') return;
        if (forte || agora() - ultimoAviso >= AVISO_MS) {
          ultimoAviso = agora();
          ctx.avisar();
        }
      };

      ctx.agendar(LARGADA_MS, () => {
        fase = 'jogando';
        inicioEm = agora();
        ctx.agendar(versus ? VERSUS_MS : SOLO_MS, noTeto);
        ctx.avisar();
      });

      const inteiro = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

      return {
        publico(quem) {
          const meu = jogadores.get(quem);
          return {
            fase,
            modo,
            categoria: modo,
            partidaId: evento,
            semente,
            /** Quanto a partida já andou no servidor: quem abre no meio acerta o relógio por ele. */
            decorridoMs: fase === 'jogando' ? agora() - inicioEm : 0,
            jogadores: inscritos.map((userId) => {
              const j = jogadores.get(userId)!;
              return { userId, username: ctx.nome(userId), pontos: j.s.e.pontos, vivo: j.eliminadoEm === null, saiu: j.saiu, grade: retrato(j.s.e) };
            }),
            meu: meu
              ? {
                  recebidas: meu.recebidas,
                  versao: meu.versao,
                  passo: meu.s.e.passo,
                  pontos: meu.s.e.pontos,
                  lixos: meu.s.lixos,
                  // a lista aceita só vai quando o site precisa se acertar com ela (a versão dele é outra), e não para sempre
                  jogadas: meu.versao !== meu.versaoDoSite ? meu.s.jogadas : null,
                  fim: meu.eliminadoEm !== null,
                }
              : null,
            resultado,
          };
        },
        acao(quem, corpo) {
          if (corpo.tipo !== 'jogadas' && corpo.tipo !== 'sincronizar') return 'Ação desconhecida.';
          const j = jogadores.get(quem);
          if (!j) return 'Você está assistindo esta partida.';
          // o painel aberto de novo no meio: a lista aceita passa a ir no estado, e o site refaz a partida com ela
          if (corpo.tipo === 'sincronizar') {
            j.versao++;
            return null;
          }
          if (fase !== 'jogando') return 'Esta rodada já acabou.';
          // a versão que o site tem (o lote foi montado com ela): igual à daqui, a lista aceita deixa de ir no estado
          if (inteiro(corpo.versao) && corpo.versao <= j.versao) j.versaoDoSite = corpo.versao;
          if (j.eliminadoEm !== null) return null;
          const { de, passo: dito, jogadas } = corpo;
          if (!inteiro(de) || !inteiro(dito) || !Array.isArray(jogadas) || jogadas.length > MAX_POR_LOTE) return 'Ação desconhecida.';
          // um lote que chega depois de um que se perdeu: o site manda de novo a partir de `recebidas`
          if (de > j.recebidas) return null;
          const teto = decorrido() + FOLGA_FRENTE;
          const ate = Math.min(dito, teto);
          for (const x of jogadas.slice(j.recebidas - de) as unknown[]) {
            j.recebidas++;
            const ultima = j.s.jogadas[j.s.jogadas.length - 1];
            const ok =
              jogadaValida(x) &&
              x[0] >= j.s.e.passo &&
              x[0] <= ate &&
              (!ultima || x[0] >= ultima[0]) &&
              cabeNoRitmo(j.s.jogadas, x[0]) &&
              (x[1] !== 0 || trocaNoIntervalo(j.s.jogadas, x[0]));
            if (!ok) {
              j.versao++;
              continue;
            }
            j.s.jogadas.push(x as Jogada);
            if ((x as Jogada)[1] === 0) j.jogou = true;
          }
          let forte = j.s.e.passo < ate && andar(j, ate);
          if (arrumar()) forte = true;
          conferirFim();
          avisar(forte);
          return null;
        },
        conferir() {
          const forte = arrumar();
          conferirFim();
          if (forte) avisar(true);
        },
      };
    },
  };
}
