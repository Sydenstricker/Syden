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
 *
 * A MESA COMUM (19/11/2026, a auditoria dos mini-games), para todos os jogos que rodam nela:
 * - o NÍVEL DO ROBÔ no Solo (`nivel`: fácil, normal, difícil), que cada jogo traduz em profundidade e ruído;
 * - VOLTAR O LANCE no Solo (`{ tipo: 'voltar' }`): desfaz o último lance da pessoa e o que o robô respondeu. Jogo de
 *   informação escondida (a Batalha naval) não volta: o tiro já revelou o mar;
 * - a OFERTA DE EMPATE na sala (`{ tipo: 'empate', acao: 'oferecer' | 'aceitar' | 'recusar' }`), que cai no lance seguinte;
 * - o RELÓGIO DE PARTIDA opcional (`relogio`: '3+2', '5+3', '10+0', '15+10'), que troca o prazo por lance pelo tempo de cada
 *   um, com o acréscimo por lance; acabou o tempo, perde;
 * - o HISTÓRICO dos lances (`historico`), escrito por cada jogo (`descrever`).
 * As escolhas da partida voltam no público (`escolhas`), para o "Jogar de novo" repetir as mesmas.
 */

export const ESPERANDO_MS = 3 * 60_000;
export const JOGADA_MS = 90_000;
/** No Solo, a vez da pessoa: só a mesa esquecida acaba. */
export const JOGADA_SOLO_MS = 30 * 60_000;

export type Lado = 0 | 1;
export type Nivel = 'facil' | 'normal' | 'dificil';
export const NIVEIS: readonly Nivel[] = ['facil', 'normal', 'dificil'];

/** Os relógios de partida que a mesa aceita: minutos + segundos de acréscimo por lance. */
export const RELOGIOS: Record<string, { baseMs: number; incMs: number }> = {
  '3+2': { baseMs: 3 * 60_000, incMs: 2_000 },
  '5+3': { baseMs: 5 * 60_000, incMs: 3_000 },
  '10+0': { baseMs: 10 * 60_000, incMs: 0 },
  '15+10': { baseMs: 15 * 60_000, incMs: 10_000 },
};

export interface Regras<T> {
  /** O começo da partida, com as escolhas do jogo (já conferidas por `escolhas`). */
  inicio(escolhas: Record<string, unknown>): T;
  /** As escolhas próprias do jogo, conferidas a partir do corpo de quem começou (o que não vale cai no padrão). */
  escolhas?(corpo: Record<string, unknown>): Record<string, unknown>;
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
   * Batalha naval, sem olhar a frota escondida), no `nivel` escolhido. O jogo sem `robo` não tem Solo contra o computador.
   */
  robo?(estado: T, lado: Lado, aleatorio: () => number, nivel: Nivel): Record<string, unknown>;
  /**
   * A jogada do computador que PENSA FORA DA THREAD do servidor (o xadrez, 20/11/2026: o worker de xadrez-robo.ts). A mesa
   * começa a conta na hora e joga quando a conta e a pausa acabam; se a partida mudou nesse meio (voltar, desistir), a resposta
   * é jogada fora. Com ela, `niveis` diz os níveis que o jogo aceita (os outros jogos ficam nos três de sempre).
   */
  roboAssincrono?(estado: T, lado: Lado, aleatorio: () => number, nivel: string): Promise<Record<string, unknown>>;
  /** Os níveis do robô que o jogo aceita (sem isto, os de `NIVEIS`). */
  niveis?: readonly string[];
  /** O lance que acabou de valer, escrito para o histórico (chamado DEPOIS de `jogar`, com o estado novo). */
  descrever?(estado: T, lado: Lado, corpo: Record<string, unknown>): string;
  /**
   * Para VOLTAR O LANCE: uma cópia do estado e a volta a ela. Sem isso, a mesa copia por `structuredClone` (serve aos
   * estados de dados puros). `semVoltar`: o jogo não deixa voltar (informação escondida).
   */
  copiar?(estado: T): unknown;
  restaurar?(estado: T, copia: unknown): void;
  semVoltar?: boolean;
  /**
   * Uma fase de MONTAGEM antes do primeiro lance (a Batalha naval, 05/11/2026: cada um põe os próprios navios). Com ela, o
   * segundo sentar leva a mesa à fase 'montando' em vez de 'jogando': cada lado manda ações `tipo: 'montar'` até ficar
   * pronto, e os lances começam quando os dois estão prontos. O lado do computador fica pronto na hora (`completar`), e quem
   * não ficar pronto em `ms` (no Solo, no prazo da mesa esquecida) é completado pelo servidor. Jogo sem ela não muda nada.
   */
  montagem?: {
    ms: number;
    /** Uma ação de montar de `lado`. Devolve o erro, ou null. */
    montar(estado: T, lado: Lado, corpo: Record<string, unknown>): string | null;
    pronto(estado: T, lado: Lado): boolean;
    /** O tempo acabou, ou o lado é do computador: completa o que falta e o dá por pronto. */
    completar(estado: T, lado: Lado): void;
  };
}

/** As escolhas comuns da mesa (o nível do robô e o relógio), conferidas. */
export function escolhasDaMesa(corpo: Record<string, unknown>, niveis: readonly string[] = NIVEIS): { nivel: Nivel; relogio: string | null } {
  // o xadrez aceita mais níveis (`Regras.niveis`): o tipo continua Nivel para os jogos de três
  const nivel = typeof corpo.nivel === 'string' && niveis.includes(corpo.nivel) ? (corpo.nivel as Nivel) : 'normal';
  const relogio = typeof corpo.relogio === 'string' && RELOGIOS[corpo.relogio] ? corpo.relogio : null;
  return { nivel, relogio };
}

/** A mesa de duas pessoas (sentar, a vez, o prazo, desistir) em volta das regras de um jogo. */
export function duelo<T>(regras: Regras<T>, aleatorio = Math.random, agora: () => number = Date.now): Definicao {
  return {
    mesa: true,
    comecar(ctx, { criadaPor, corpo }) {
      let fase: 'esperando' | 'montando' | 'jogando' | 'fim' = 'esperando';
      const lugares: number[] = [criadaPor];
      let vez: Lado = 0;
      let vencedor: Lado | 'empate' | null = null;
      let motivo: 'jogo' | 'tempo' | 'desistiu' | 'acordo' | null = null;
      const comuns = escolhasDaMesa(corpo ?? {}, regras.niveis);
      const proprias = regras.escolhas?.(corpo ?? {}) ?? {};
      const escolhas = { ...proprias, nivel: comuns.nivel, relogio: comuns.relogio };
      const estado = regras.inicio(proprias);
      // no Solo, contra o computador: ele senta na hora
      const contraORobo = ctx.solo === true && (regras.robo !== undefined || regras.roboAssincrono !== undefined);
      /** Muda a cada lance, volta ou fim: a conta do robô que voltar depois de uma mudança não vale mais. */
      let geracao = 0;
      const nome = (id: number) => (ehRobo(id) ? nomeDoRobo(id) : ctx.nome(id));
      const historico: { lado: Lado; texto: string }[] = [];
      /** As cópias de antes de cada lance da pessoa (só no Solo), para voltar. */
      const pilha: { estado: unknown; historico: number; vez: Lado }[] = [];
      let oferta: Lado | null = null;
      const tempo = comuns.relogio ? RELOGIOS[comuns.relogio] : null;
      const restam: [number, number] = tempo ? [tempo.baseMs, tempo.baseMs] : [0, 0];
      let desde = 0;

      const copiar = () => (regras.copiar ? regras.copiar(estado) : structuredClone(estado));
      const restaurar = (copia: unknown) => {
        if (regras.restaurar) regras.restaurar(estado, copia);
        else Object.assign(estado as object, structuredClone(copia));
      };

      const acabar = (quem: Lado | 'empate' | null, porque: typeof motivo) => {
        fase = 'fim';
        geracao++;
        vencedor = quem;
        motivo = porque;
        if (tempo) restam[vez] = Math.max(0, restam[vez] - (agora() - desde));
        ctx.terminar();
      };

      /** A vez de agora: o robô joga depois da pausa; gente tem o prazo (o relógio da partida, ou o prazo por lance). */
      const prazo = () => {
        if (ehRobo(lugares[vez] ?? 0)) {
          // o robô que pensa fora da thread começa a conta já, e joga quando a conta e a pausa acabam
          if (regras.roboAssincrono) return pensarORobo();
          return ctx.agendar(PAUSA_DO_ROBO, jogarORobo);
        }
        const ms = tempo ? Math.max(0, restam[vez] - (agora() - desde)) : contraORobo ? JOGADA_SOLO_MS : JOGADA_MS;
        ctx.agendar(ms, () => {
          if (fase === 'jogando') acabar(vez === 0 ? 1 : 0, 'tempo');
        });
      };

      const comecarOsLances = () => {
        fase = 'jogando';
        desde = agora();
        regras.aoComecar?.(estado, vez);
        prazo();
      };

      const sentar = (quem: number) => {
        lugares.push(quem);
        // Quem começa é sorteado: começar dá vantagem nos dois jogos.
        vez = aleatorio() < 0.5 ? 0 : 1;
        const montagem = regras.montagem;
        if (!montagem) return comecarOsLances();
        fase = 'montando';
        for (const l of [0, 1] as Lado[]) if (ehRobo(lugares[l])) montagem.completar(estado, l);
        if (montagem.pronto(estado, 0) && montagem.pronto(estado, 1)) return comecarOsLances();
        // quem não ficou pronto a tempo: o servidor completa o que falta, e os lances começam
        ctx.agendar(contraORobo ? JOGADA_SOLO_MS : montagem.ms, () => {
          if (fase !== 'montando') return;
          for (const l of [0, 1] as Lado[]) if (!montagem.pronto(estado, l)) montagem.completar(estado, l);
          comecarOsLances();
          ctx.avisar();
        });
      };

      const jogada = (lado: Lado, corpo: Record<string, unknown>): string | null => {
        const antes = contraORobo && !ehRobo(lugares[lado]) && !regras.semVoltar ? { estado: copiar(), historico: historico.length, vez } : null;
        const r = regras.jogar(estado, lado, corpo);
        if (typeof r === 'string') return r;
        if (antes) pilha.push(antes);
        geracao++;
        oferta = null;
        const texto = regras.descrever?.(estado, lado, corpo);
        if (texto) historico.push({ lado, texto });
        if (tempo) {
          const t = agora();
          restam[lado] = Math.max(0, restam[lado] - (t - desde)) + tempo.incMs;
          desde = t;
        }
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
        if (jogada(lado, { ...regras.robo!(estado, lado, aleatorio, comuns.nivel), tipo: 'jogada' }) !== null) acabar(lado === 0 ? 1 : 0, 'desistiu');
      }

      /** O robô de conta longa (o xadrez): a conta e a pausa correm juntas; a resposta só vale se nada mudou na mesa. */
      function pensarORobo() {
        const lado = vez;
        const minha = geracao;
        let corpo: Record<string, unknown> | null = null;
        let pausou = false;
        const tentar = () => {
          if (!corpo || !pausou) return;
          if (fase !== 'jogando' || geracao !== minha || vez !== lado || !ehRobo(lugares[lado])) return;
          try {
            if (jogada(lado, { ...corpo, tipo: 'jogada' }) !== null) acabar(lado === 0 ? 1 : 0, 'desistiu');
          } catch {
            acabar(lado === 0 ? 1 : 0, 'desistiu');
          }
        };
        ctx.agendar(PAUSA_DO_ROBO, () => {
          pausou = true;
          tentar();
        });
        regras
          .roboAssincrono!(estado, lado, aleatorio, comuns.nivel)
          .catch(() => (regras.robo ? regras.robo(estado, lado, aleatorio, comuns.nivel) : {}))
          .then((c) => {
            corpo = c;
            tentar();
          });
      }

      if (contraORobo) sentar(-1);
      // Ninguém sentou do outro lado: a mesa se desfaz sozinha, sem vencedor.
      else ctx.agendar(ESPERANDO_MS, () => acabar(null, null));

      return {
        publico(quem) {
          const lado = lugares.indexOf(quem);
          const correndo = fase === 'jogando' && tempo !== null;
          return {
            fase,
            jogadores: lugares.map((userId) => ({ userId, username: nome(userId) })),
            vez,
            vencedor,
            motivo,
            escolhas,
            historico,
            podeVoltar: contraORobo && !regras.semVoltar && fase === 'jogando' && pilha.length > 0,
            oferta,
            // o relógio da partida: o que resta a cada um AGORA (o de quem tem a vez já descontado)
            relogio: tempo
              ? {
                  nome: comuns.relogio,
                  restam: restam.map((ms, l) => (correndo && l === vez ? Math.max(0, ms - (agora() - desde)) : ms)),
                  correndo,
                }
              : null,
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
            if ((fase !== 'jogando' && fase !== 'montando') || lado < 0) return 'Você não está jogando.';
            acabar(lado === 0 ? 1 : 0, 'desistiu');
            return null;
          }
          if (corpo.tipo === 'voltar') {
            if (!contraORobo || regras.semVoltar) return 'Só dá para voltar o lance contra o computador.';
            if (fase !== 'jogando' || lado < 0) return 'A partida não está em andamento.';
            const copia = pilha.pop();
            if (!copia) return 'Não há lance para voltar.';
            restaurar(copia.estado);
            geracao++;
            historico.length = copia.historico;
            vez = copia.vez;
            if (tempo) desde = agora();
            prazo();
            ctx.avisar();
            return null;
          }
          if (corpo.tipo === 'empate') {
            if (fase !== 'jogando' || lado < 0) return 'A partida não está em andamento.';
            if (ehRobo(lugares[0] ?? 0) || ehRobo(lugares[1] ?? 0)) return 'O computador não aceita empate.';
            const outro: Lado = lado === 0 ? 1 : 0;
            if (corpo.acao === 'oferecer') {
              if (oferta === lado) return 'Você já ofereceu o empate.';
              // os dois ofereceram: é o acordo
              if (oferta === outro) {
                acabar('empate', 'acordo');
                return null;
              }
              oferta = lado as Lado;
            } else if (corpo.acao === 'aceitar') {
              if (oferta !== outro) return 'Ninguém ofereceu empate.';
              acabar('empate', 'acordo');
              return null;
            } else if (corpo.acao === 'recusar') {
              if (oferta !== outro) return 'Ninguém ofereceu empate.';
              oferta = null;
            } else return 'Ação desconhecida.';
            ctx.avisar();
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
          if (corpo.tipo === 'montar' && regras.montagem) {
            if (fase !== 'montando') return 'A partida não está em andamento.';
            if (lado < 0) return 'Você está assistindo esta partida.';
            const erro = regras.montagem.montar(estado, lado as Lado, corpo);
            if (erro) return erro;
            if (regras.montagem.pronto(estado, 0) && regras.montagem.pronto(estado, 1)) comecarOsLances();
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
//
// AS VARIANTES (19/11/2026): "exatamente 5" (`exato`: seis ou mais seguidas não ganham, a regra do Gomoku clássico) e a
// REGRA DE TROCA na abertura (`troca`, o "swap"): quem abre põe três pedras (escura, clara, escura) e quem responde ESCOLHE a
// cor — fica com as claras e joga, ou troca e fica com as escuras. Tira a vantagem de quem abre sem pedir regra difícil.
// As cores: 1 escura (a que abre), 2 clara; `cores[lado]` diz a cor de cada lado da mesa.
// ---------------------------------------------------------------------------------------------------

export const LADO_DO_GOMOKU = 15;

/** As casas da linha de cinco (ou mais; com `exato`, só cinco) que passa pela casa `i`, ou null se não há linha. */
export function linhaDeCinco(casas: number[], i: number, n = LADO_DO_GOMOKU, exato = false): number[] | null {
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
    if (exato ? linha.length === 5 : linha.length >= 5) return linha.sort((a, b) => a - b);
  }
  return null;
}

export interface EstadoDoGomoku {
  casas: number[];
  ultima: number | null;
  linha: number[] | null;
  exato: boolean;
  troca: boolean;
  /** A cor de cada lado da mesa (1 escura, 2 clara). */
  cores: [number, number];
  /** Na troca: quantas pedras da abertura já foram postas (0 a 3), e se quem responde está escolhendo a cor. */
  abertura: number;
  decidindo: boolean;
}

/** A coluna e a linha da casa, como no papel: "H8". */
export const nomeDaCasaDoGomoku = (i: number, n = LADO_DO_GOMOKU) => `${'ABCDEFGHIJKLMNO'[i % n]}${n - Math.floor(i / n)}`;

const outroLado = (l: Lado): Lado => (l === 0 ? 1 : 0);

export const gomoku = duelo<EstadoDoGomoku>({
  escolhas: (corpo) => ({ exato: corpo.exato === true, troca: corpo.troca === true }),
  inicio: (e) => ({
    casas: new Array<number>(LADO_DO_GOMOKU * LADO_DO_GOMOKU).fill(0),
    ultima: null,
    linha: null,
    exato: e.exato === true,
    troca: e.troca === true,
    cores: [1, 2],
    abertura: 0,
    decidindo: false,
  }),
  // quem abre fica com as escuras
  aoComecar(estado, primeiro) {
    estado.cores = primeiro === 0 ? [1, 2] : [2, 1];
  },
  jogar(estado, lado, corpo) {
    if (estado.decidindo) {
      if (typeof corpo.trocar !== 'boolean') return 'Escolha a sua cor.';
      estado.decidindo = false;
      // trocou: fica com as escuras, e quem abriu joga as claras agora; senão, joga as claras já
      if (corpo.trocar) {
        estado.cores = [estado.cores[1], estado.cores[0]];
        return { proximo: outroLado(lado) };
      }
      return { proximo: lado };
    }
    const casa = Number(corpo.casa);
    if (!Number.isInteger(casa) || casa < 0 || casa >= estado.casas.length || estado.casas[casa]) return 'Essa casa já está ocupada.';
    // a abertura da troca: escura, clara, escura, todas de quem abre
    const naAbertura = estado.troca && estado.abertura < 3;
    const cor = naAbertura ? (estado.abertura === 1 ? 2 : 1) : estado.cores[lado];
    estado.casas[casa] = cor;
    estado.ultima = casa;
    if (naAbertura) {
      estado.abertura++;
      if (estado.abertura < 3) return { proximo: lado };
      estado.decidindo = true;
      return { proximo: outroLado(lado) };
    }
    const linha = linhaDeCinco(estado.casas, casa, LADO_DO_GOMOKU, estado.exato);
    if (linha) {
      estado.linha = linha;
      return { proximo: lado, vencedor: lado };
    }
    if (estado.casas.every((x) => x)) return { proximo: lado, vencedor: 'empate' };
    return { proximo: outroLado(lado) };
  },
  descrever: (estado, _lado, corpo) =>
    typeof corpo.trocar === 'boolean' && corpo.casa === undefined ? (corpo.trocar ? '⇄' : '=') : estado.ultima === null ? '' : nomeDaCasaDoGomoku(estado.ultima),
  publico: (estado) => ({
    lado: LADO_DO_GOMOKU,
    casas: estado.casas,
    ultima: estado.ultima,
    linha: estado.linha,
    cores: estado.cores,
    exato: estado.exato,
    troca: estado.troca,
    abertura: estado.troca ? estado.abertura : 3,
    decidindo: estado.decidindo,
  }),
  robo: (estado, lado, aleatorio, nivel) => {
    if (estado.decidindo) return { trocar: trocarNaAbertura(estado.casas) };
    const naAbertura = estado.troca && estado.abertura < 3;
    const cor = naAbertura ? (estado.abertura === 1 ? 2 : 1) : estado.cores[lado];
    // a abertura do robô: pedras soltas perto do meio (pensar a abertura toda seria jogar contra si mesmo)
    if (naAbertura) return { casa: aberturaDoGomoku(estado.casas, aleatorio) };
    return { casa: jogadaDoGomoku(estado.casas, cor, aleatorio, LADO_DO_GOMOKU, nivel, estado.exato) };
  },
});

/** Uma casa livre perto do meio (a abertura da troca, quando quem abre é o robô). */
function aberturaDoGomoku(casas: number[], aleatorio: () => number, n = LADO_DO_GOMOKU): number {
  const meio = Math.floor(n / 2);
  for (let k = 0; k < 100; k++) {
    const l = meio - 2 + Math.floor(aleatorio() * 5);
    const c = meio - 2 + Math.floor(aleatorio() * 5);
    if (!casas[l * n + c]) return l * n + c;
  }
  return casas.findIndex((x) => !x);
}

/** A escolha do robô depois da abertura: fica com a cor que tem a melhor casa para jogar. */
export function trocarNaAbertura(casas: number[]): boolean {
  let escura = 0;
  let clara = 0;
  for (const i of candidatasDoGomoku(casas)) {
    escura = Math.max(escura, valorDaCasa(casas, i, 1));
    clara = Math.max(clara, valorDaCasa(casas, i, 2));
  }
  // trocar = ficar com as escuras; as claras jogam agora, e por isso pesam um pouco mais
  return escura > clara * 1.3;
}

/**
 * O que uma casa vale para a cor `cor`: por direção, quantas pedras dela ficam seguidas com a casa, e quantas pontas abertas
 * sobram. Cinco ganha; quatro aberta (duas pontas) já é vitória na jogada seguinte; e assim por diante.
 */
function valorDaCasa(casas: number[], casa: number, cor: number, n = LADO_DO_GOMOKU, exato = false): number {
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
    if (seguidas === 5 || (seguidas > 5 && !exato)) total += 1_000_000;
    else if (seguidas > 5 || abertas === 0) continue;
    else if (seguidas === 4) total += abertas === 2 ? 50_000 : 6_000;
    else if (seguidas === 3) total += abertas === 2 ? 3_000 : 300;
    else if (seguidas === 2) total += abertas === 2 ? 120 : 25;
    else total += abertas === 2 ? 8 : 2;
  }
  return total;
}

/** As casas vazias a até 2 de alguma pedra (onde vale a pena pensar). */
function candidatasDoGomoku(casas: number[], n = LADO_DO_GOMOKU): number[] {
  const lista: number[] = [];
  for (let i = 0; i < casas.length; i++) {
    if (casas[i]) continue;
    const l = Math.floor(i / n);
    const c = i % n;
    let perto = false;
    for (let dl = -2; dl <= 2 && !perto; dl++) {
      for (let dc = -2; dc <= 2 && !perto; dc++) {
        const ll = l + dl;
        const cc = c + dc;
        if (ll >= 0 && ll < n && cc >= 0 && cc < n && casas[ll * n + cc]) perto = true;
      }
    }
    if (perto) lista.push(i);
  }
  return lista;
}

/** Os NÍVEIS do robô do Cinco em linha: quanto ele pesa a defesa, quanto sorteia e quantos lances olha. */
const NIVEL_DO_GOMOKU: Record<Nivel, { defesa: number; sorte: number; busca: number }> = {
  facil: { defesa: 0.35, sorte: 2_500, busca: 0 },
  normal: { defesa: 0.9, sorte: 6, busca: 0 },
  dificil: { defesa: 0.95, sorte: 1, busca: 3 },
};

/**
 * O ROBÔ DO CINCO EM LINHA: olha as casas vazias perto das pedras e soma o que cada uma vale para ele (atacar) e para a
 * pessoa (bloquear, um pouco menos). Assim: fecha o cinco dele antes de tudo, bloqueia o cinco dela, faz a quatro aberta,
 * bloqueia a três aberta… Um tantinho de sorte desempata e deixa o jogo menos previsível. Joga bem, mas dá para ganhar dele.
 *
 * No FÁCIL ele quase não defende e sorteia muito; no DIFÍCIL, além disso, OLHA 2–3 LANCES À FRENTE entre as casas de ameaça
 * (as 8 melhores pela soma acima), com o mesmo valor das casas como nota das posições.
 */
export function jogadaDoGomoku(
  casas: number[],
  cor: number,
  aleatorio: () => number = Math.random,
  n = LADO_DO_GOMOKU,
  nivel: Nivel = 'normal',
  exato = false,
): number {
  const outra = cor === 1 ? 2 : 1;
  const centro = Math.floor(n / 2) * n + Math.floor(n / 2);
  if (!casas.some((x) => x)) return centro;
  const { defesa, sorte, busca } = NIVEL_DO_GOMOKU[nivel];
  const candidatas = candidatasDoGomoku(casas, n);
  if (!candidatas.length) return casas.findIndex((x) => !x);
  const nota = (tab: number[], i: number, minha: number, dele: number, peso = defesa) =>
    valorDaCasa(tab, i, minha, n, exato) + peso * valorDaCasa(tab, i, dele, n, exato);
  if (busca > 0) {
    const escolha = buscaDoGomoku(casas, cor, outra, busca, n, exato);
    if (escolha >= 0) return escolha;
  }
  let melhor = -1;
  let melhorValor = -Infinity;
  for (const i of candidatas) {
    const valor = nota(casas, i, cor, outra) + aleatorio() * sorte;
    if (valor > melhorValor) {
      melhorValor = valor;
      melhor = i;
    }
  }
  return melhor;
}

/** As `k` melhores casas para quem joga com `cor`, pela soma de atacar e bloquear. */
function melhoresCasas(casas: number[], cor: number, outra: number, k: number, n: number, exato: boolean): number[] {
  return candidatasDoGomoku(casas, n)
    .map((i) => [i, valorDaCasa(casas, i, cor, n, exato) + 0.9 * valorDaCasa(casas, i, outra, n, exato)] as const)
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([i]) => i);
}

/** Minimax curto sobre as melhores casas: a nota da folha é a melhor ameaça de quem joga menos a do outro. */
function buscaDoGomoku(casas: number[], cor: number, outra: number, profundidade: number, n: number, exato: boolean): number {
  const LARGURA = 8;
  const VITORIA = 10_000_000;
  const tab = casas.slice();
  const folha = (vez: number, outro: number) => {
    let minha = 0;
    let dele = 0;
    for (const i of candidatasDoGomoku(tab, n)) {
      minha = Math.max(minha, valorDaCasa(tab, i, vez, n, exato));
      dele = Math.max(dele, valorDaCasa(tab, i, outro, n, exato));
    }
    return minha - 0.8 * dele;
  };
  // negamax: o valor para quem tem a vez (`vez`)
  const buscar = (vez: number, outro: number, falta: number, alfa: number, beta: number): number => {
    if (falta === 0) return folha(vez, outro);
    const opcoes = melhoresCasas(tab, vez, outro, LARGURA, n, exato);
    if (!opcoes.length) return 0;
    let melhor = -Infinity;
    for (const i of opcoes) {
      tab[i] = vez;
      const v = linhaDeCinco(tab, i, n, exato) ? VITORIA + falta : -buscar(outro, vez, falta - 1, -beta, -alfa);
      tab[i] = 0;
      if (v > melhor) melhor = v;
      if (v > alfa) alfa = v;
      if (alfa >= beta) break;
    }
    return melhor;
  };
  let escolha = -1;
  let melhorValor = -Infinity;
  for (const i of melhoresCasas(tab, cor, outra, LARGURA, n, exato)) {
    tab[i] = cor;
    const v = linhaDeCinco(tab, i, n, exato) ? VITORIA * 2 : -buscar(outra, cor, profundidade - 1, -Infinity, -melhorValor);
    tab[i] = 0;
    if (v > melhorValor) {
      melhorValor = v;
      escolha = i;
    }
  }
  return escolha;
}

// ---------------------------------------------------------------------------------------------------
// MANCALA (a regra Kalah, a mais jogada): seis casas de cada lado com quatro sementes e um depósito na
// ponta. Pega-se todas as sementes de uma casa sua e semeia-se uma em cada casa seguinte, no sentido
// anti-horário, pulando o depósito do outro. A última no seu depósito: joga de novo. A última numa casa
// sua vazia, com sementes na casa da frente: leva as duas para o depósito. Quando um lado esvazia, o
// outro guarda o que sobrou, e vence quem tiver mais no depósito.
//
// As casas: 0–5 são do primeiro jogador e 6 é o depósito dele; 7–12 são do segundo e 13 o depósito dele.
//
// AS ESCOLHAS (19/11/2026): de 3 a 6 sementes por casa (`sementes`), e a variante OWARE (`variante: 'oware'`, a da África
// Ocidental): a semeadura pula os dois depósitos (e a casa de onde saiu, com 12 ou mais), não há jogada de novo, e a última
// semente na casa do OUTRO que fica com 2 ou 3 leva essa casa e as anteriores dele com 2 ou 3. Quem levaria TODAS as casas do
// outro não leva nada (o "grande golpe"); quem pode deixar sementes para o outro tem de deixar ("alimentar"); vence quem
// passar da metade. Os depósitos continuam nas casas 6 e 13: o desenho é o mesmo.
// ---------------------------------------------------------------------------------------------------

export const SEMENTES = 4;
export type VarianteDaMancala = 'kalah' | 'oware';
const deposito = (lado: Lado) => (lado === 0 ? 6 : 13);
const casasDe = (lado: Lado) => (lado === 0 ? [0, 1, 2, 3, 4, 5] : [7, 8, 9, 10, 11, 12]);
/** No Oware, lances seguidos sem captura que encerram a partida (as sementes que sobram ficam com quem as tem). */
export const OWARE_SEM_CAPTURA = 100;

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

/** O caminho das sementes do Oware (sem os depósitos, e sem a casa de onde saiu). Devolve a última casa. */
function semearSemCapturaOware(casas: number[], casa: number): number {
  let mao = casas[casa];
  casas[casa] = 0;
  let i = casa;
  while (mao > 0) {
    i = (i + 1) % 14;
    if (i === 6 || i === 13 || i === casa) continue;
    casas[i]++;
    mao--;
  }
  return i;
}

/** As casas que `lado` pode jogar no Oware: com sementes, e (se der) deixando sementes ao outro. */
export function lancesDoOware(casas: number[], lado: Lado): number[] {
  const outro: Lado = lado === 0 ? 1 : 0;
  const cheias = casasDe(lado).filter((c) => casas[c] > 0);
  const alimentam = cheias.filter((c) => {
    const copia = casas.slice();
    capturarOware(copia, lado, semearSemCapturaOware(copia, c));
    return casasDe(outro).some((k) => copia[k] > 0);
  });
  return alimentam.length ? alimentam : cheias;
}

/** A captura do Oware a partir da última casa (o grande golpe não captura). Devolve quantas sementes levou. */
function capturarOware(casas: number[], lado: Lado, ultima: number): number {
  const outro: Lado = lado === 0 ? 1 : 0;
  if (!casasDe(outro).includes(ultima)) return 0;
  const levar: number[] = [];
  for (let i = ultima; casasDe(outro).includes(i) && (casas[i] === 2 || casas[i] === 3); i--) levar.push(i);
  if (!levar.length) return 0;
  const sobra = casasDe(outro).filter((c) => !levar.includes(c)).reduce((s, c) => s + casas[c], 0);
  if (sobra === 0) return 0;
  let total = 0;
  for (const i of levar) {
    total += casas[i];
    casas[i] = 0;
  }
  casas[deposito(lado)] += total;
  return total;
}

/**
 * Um lance do Oware, já conferido (`casa` está em `lancesDoOware`). `semCaptura` conta os lances sem levar nada. Devolve o
 * próximo, se acabou (com as sobras guardadas) e quantas levou.
 */
export function semearOware(casas: number[], lado: Lado, casa: number, semCaptura = 0): { proximo: Lado; acabou: boolean; levou: number } {
  const outro: Lado = lado === 0 ? 1 : 0;
  const total = casas.reduce((s, x) => s + x, 0);
  const levou = capturarOware(casas, lado, semearSemCapturaOware(casas, casa));
  const sobras = () => {
    for (const l of [0, 1] as Lado[]) {
      for (const c of casasDe(l)) {
        casas[deposito(l)] += casas[c];
        casas[c] = 0;
      }
    }
  };
  if (casas[deposito(lado)] * 2 > total) return { proximo: outro, acabou: true, levou };
  // o outro ficou sem sementes (ninguém pôde alimentá-lo), ou a partida ficou rodando sem captura: cada um guarda o seu
  if (casasDe(outro).every((c) => casas[c] === 0) || (levou === 0 && semCaptura + 1 >= OWARE_SEM_CAPTURA)) {
    sobras();
    return { proximo: outro, acabou: true, levou };
  }
  return { proximo: outro, acabou: false, levou };
}

export interface EstadoDaMancala {
  casas: number[];
  ultima: number | null;
  /** As casas de antes do último lance, e quem o fez: o site anima a semeadura semente a semente. */
  antes: number[] | null;
  quem: Lado | null;
  variante: VarianteDaMancala;
  sementes: number;
  semCaptura: number;
}

/** Os lances de `lado` na variante. */
const lancesDaMancala = (casas: number[], lado: Lado, variante: VarianteDaMancala) =>
  variante === 'oware' ? lancesDoOware(casas, lado) : casasDe(lado).filter((c) => casas[c] > 0);

export const mancala = duelo<EstadoDaMancala>({
  escolhas: (corpo) => {
    const n = Math.floor(Number(corpo.sementes));
    return { sementes: n >= 3 && n <= 6 ? n : SEMENTES, variante: corpo.variante === 'oware' ? 'oware' : 'kalah' };
  },
  inicio: (e) => {
    const sementes = typeof e.sementes === 'number' ? e.sementes : SEMENTES;
    return {
      casas: Array.from({ length: 14 }, (_, i) => (i === 6 || i === 13 ? 0 : sementes)),
      ultima: null,
      antes: null,
      quem: null,
      variante: e.variante === 'oware' ? 'oware' : 'kalah',
      sementes,
      semCaptura: 0,
    };
  },
  jogar(estado, lado, corpo) {
    const casa = Number(corpo.casa);
    if (!casasDe(lado).includes(casa)) return 'Escolha uma casa do seu lado.';
    if (!estado.casas[casa]) return 'Essa casa está vazia.';
    if (estado.variante === 'oware' && !lancesDoOware(estado.casas, lado).includes(casa)) return 'Deixe sementes para o outro lado.';
    estado.antes = estado.casas.slice();
    estado.quem = lado;
    estado.ultima = casa;
    const fim = (proximo: Lado) => {
      const a = estado.casas[6];
      const b = estado.casas[13];
      return { proximo, vencedor: a === b ? ('empate' as const) : a > b ? (0 as const) : (1 as const) };
    };
    if (estado.variante === 'oware') {
      const r = semearOware(estado.casas, lado, casa, estado.semCaptura);
      estado.semCaptura = r.levou ? 0 : estado.semCaptura + 1;
      return r.acabou ? fim(r.proximo) : { proximo: r.proximo };
    }
    const { proximo, acabou } = semear(estado.casas, lado, casa);
    return acabou ? fim(proximo) : { proximo };
  },
  // a casa contada do lado de quem joga: 1 a 6, da esquerda para a direita
  descrever: (estado, lado) => (estado.ultima === null ? '' : String(casasDe(lado).indexOf(estado.ultima) + 1)),
  publico: (estado) => ({
    casas: estado.casas,
    ultima: estado.ultima,
    antes: estado.antes,
    quem: estado.quem,
    variante: estado.variante,
    sementes: estado.sementes,
  }),
  robo: (estado, lado, aleatorio, nivel) => ({ casa: jogadaDaMancala(estado.casas, lado, aleatorio, PROFUNDIDADE_DA_MANCALA_NO[nivel], estado.variante, RUIDO_DA_MANCALA[nivel]) }),
});

/** Quantas jogadas à frente o robô da Mancala olha (as jogadas de novo contam como uma a mais). */
export const PROFUNDIDADE_DA_MANCALA = 5;
export const PROFUNDIDADE_DA_MANCALA_NO: Record<Nivel, number> = { facil: 3, normal: 5, dificil: 7 };
/** O sorteio que desempata: no fácil, ele chega a escolher pior; no difícil, quase nunca. */
const RUIDO_DA_MANCALA: Record<Nivel, number> = { facil: 3, normal: 0.5, dificil: 0.1 };

/**
 * O ROBÔ DA MANCALA: minimax curto (PROFUNDIDADE_DA_MANCALA jogadas, com poda), contando a diferença dos depósitos. Ele vê
 * o mesmo tabuleiro aberto que a pessoa. A jogada que dá a vez de novo continua do mesmo lado, como na regra. Empatando,
 * sorteia: o mesmo tabuleiro nem sempre dá a mesma jogada. Serve às duas variantes.
 */
export function jogadaDaMancala(
  casas: number[],
  lado: Lado,
  aleatorio: () => number = Math.random,
  profundidade = PROFUNDIDADE_DA_MANCALA,
  variante: VarianteDaMancala = 'kalah',
  ruido = 0.5,
): number {
  const avaliar = (c: number[]) => c[deposito(lado)] - c[deposito(lado === 0 ? 1 : 0)];
  const fazer = (c: number[], quem: Lado, k: number) => (variante === 'oware' ? semearOware(c, quem, k) : semear(c, quem, k));
  const busca = (c: number[], quem: Lado, falta: number, alfa: number, beta: number): number => {
    const opcoes = lancesDaMancala(c, quem, variante);
    if (falta === 0 || !opcoes.length) return avaliar(c);
    let melhor = quem === lado ? -Infinity : Infinity;
    for (const k of opcoes) {
      const copia = c.slice();
      const { proximo, acabou } = fazer(copia, quem, k);
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
  for (const k of lancesDaMancala(casas, lado, variante)) {
    const copia = casas.slice();
    const { proximo, acabou } = fazer(copia, lado, k);
    const v = (acabou ? avaliar(copia) * 100 : busca(copia, proximo, profundidade - 1, -Infinity, Infinity)) + aleatorio() * ruido;
    if (v > melhorValor) {
      melhorValor = v;
      escolha = k;
    }
  }
  return escolha;
}
