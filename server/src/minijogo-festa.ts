/**
 * A FESTA DOS COELHOS (03/11/2026): um pacote de microjogos rápidos, no espírito dos jogos de festa de console — SÓ A
 * MECÂNICA, nada de nome, personagem, arte ou som de ninguém. Tudo é desenhado por código no site (JogoFesta.tsx).
 *
 * Uma partida tem 5 rodadas, e cada rodada sorteia um microjogo (sem repetir na partida): ~3 s de "prepare-se" com o nome e
 * a instrução, o jogo, e ~5 s de revelação com o resultado de cada um e os pontos (10, 8, 6, 5, 4, 3, 2, 1 pela posição;
 * quem foi desclassificado ou não respondeu, zero). No fim, o placar somado, e as medalhas só aí.
 *
 * A REDE DECIDE O FORMATO, como na corrida: o servidor está na Alemanha e a turma no Brasil (~200 ms). Por isso cada um
 * joga NA PRÓPRIA TELA, ao mesmo tempo, e nada depende de interação em tempo real entre as pessoas. O servidor é dono da
 * semente de cada rodada, do relógio e das respostas certas (onde está a cenoura, a sequência das setas, quando cada alvo
 * aparece, quando sai o sinal); o site manda o resultado, e o servidor confere se ele é possível pelo relógio DELE
 * (a reação não tem menos de 100 ms nem menos do que passou desde o sinal, menos uma folga; o copo é o certo; as setas
 * batem com a sequência; os alvos já tinham aparecido). É jogo entre amigos: conferência razoável, não perfeita.
 *
 * Os dados de cada microjogo vão PRONTOS ao site (as trocas dos copos, as setas, os alvos), e não uma semente: assim o site
 * não precisa do mesmo sorteador, e todo mundo vê a mesma coisa. O sinal do saque é a exceção: ele só vai quando sai, e a
 * reação é medida na tela de cada um, a partir do momento em que o sinal apareceu ali — quem tem internet pior não perde.
 *
 * OS TROFÉUS: o pódio de uma partida com 2 pessoas ou mais vai para o quarto de quem ficou nele, como o da corrida
 * (corrida_trofeus, com a "pista" 'festa' e os pontos; o site dá o nome).
 */
import * as db from './db.js';
import { embaralhar, placar, type Definicao } from './minijogo-motor.js';

export const MICROJOGOS = ['saque', 'forca', 'relogio', 'copos', 'siga', 'alvo'] as const;
export type Microjogo = (typeof MICROJOGOS)[number];

export const RODADAS_FESTA = 5;
export const PONTOS_FESTA = [10, 8, 6, 5, 4, 3, 2, 1];
/** O "prepare-se": o nome e a instrução na tela. */
export const PREPARO_MS = 3500;
/** A revelação de cada rodada. */
export const REVELACAO_MS = 5000;

/** O saque: o sinal sai entre 2 e 5 s depois do começo, e depois dele cada um tem 3 s. */
export const SAQUE_ESPERA_MIN = 2000;
export const SAQUE_ESPERA_MAX = 5000;
export const SAQUE_DEPOIS_MS = 3000;
/** Menos que isto não é reação, é chute: conta como antes do sinal. */
export const REACAO_MINIMA = 100;
/**
 * O que a reação declarada pode ficar abaixo do que o SERVIDOR viu passar desde o sinal: o sinal chega pelo socket, o
 * site busca o estado e desenha (~2 idas e voltas), e o aperto volta (~1). Com menos que isso, o servidor sobe a reação.
 */
export const FOLGA_SAQUE = 1500;
/** Folga do relógio para os outros: o site não pode dizer que passou mais tempo do que o servidor viu, mais isto. */
export const FOLGA_MS = 500;

export const FORCA_MS = 8000;
export const RELOGIO_MS = 15000;
export const RELOGIO_ALVO = 10000;
/** Os copos: a cenoura aparece, os copos descem, e as trocas vão ficando mais rápidas. */
export const COPOS_MOSTRA_MS = 2000;
export const COPOS_RESPOSTA_MS = 6000;
export const SIGA_MS = 40000;
export const SIGA_SETAS = 12;
/** Cada seta mostrada fica isto na tela (com o intervalo): o mínimo que uma sequência leva para ser vista. */
export const SIGA_PASSO_MS = 600;
export const ALVO_MS = 20000;
export const ALVO_VIDA_MS = 1100;

/** Quanto dura o "jogando" de cada um (o saque é contado à parte, porque o sinal é sorteado). */
export function duracaoDe(m: Microjogo, dados: Dados): number {
  switch (m) {
    case 'saque':
      return SAQUE_ESPERA_MAX + SAQUE_DEPOIS_MS;
    case 'forca':
      return FORCA_MS;
    case 'relogio':
      return RELOGIO_MS;
    case 'copos':
      return animacaoDosCopos(dados as DadosCopos) + COPOS_RESPOSTA_MS;
    case 'siga':
      return SIGA_MS + 1500;
    case 'alvo':
      return ALVO_MS + 1500;
  }
}

export interface DadosForca {
  /** Uma ida e volta da barra (0 → 100 → 0), em ms. */
  periodoMs: number;
}
export interface DadosCopos {
  /** Onde a cenoura começa (0, 1 ou 2, da esquerda para a direita). */
  inicial: number;
  /** As trocas, de LUGARES: os copos dos lugares a e b trocam. */
  trocas: [number, number][];
  /** A duração de cada troca. */
  passos: number[];
}
export interface DadosSiga {
  /** 0 cima, 1 direita, 2 baixo, 3 esquerda. */
  setas: number[];
}
export interface DadosAlvo {
  /** Cada alvo: quando aparece (ms), e a casa numa grade 3 × 3 (0 em cima à esquerda). */
  alvos: { t: number; casa: number }[];
}
export type Dados = Record<string, never> | DadosForca | DadosCopos | DadosSiga | DadosAlvo;

/** O valor da barra de força no tempo t (ms desde o começo): uma onda triangular de 0 a 100. */
export function valorDaForca(periodoMs: number, t: number): number {
  const fase = (((t % periodoMs) + periodoMs) % periodoMs) / periodoMs;
  return 100 * (1 - Math.abs(fase * 2 - 1));
}

export const animacaoDosCopos = (d: DadosCopos) => COPOS_MOSTRA_MS + d.passos.reduce((a, b) => a + b, 0);

/** Onde a cenoura termina: segue as trocas. */
export function copoFinal(d: DadosCopos): number {
  let p = d.inicial;
  for (const [a, b] of d.trocas) p = p === a ? b : p === b ? a : p;
  return p;
}

/** O mínimo que leva ver as sequências de 1 a n setas (sem contar o tempo de repetir). */
export const minimoDaSiga = (n: number) => ((n * (n + 1)) / 2) * SIGA_PASSO_MS;

/** Sorteia os dados de um microjogo. `aleatorio` é trocável para o teste. */
export function gerarDados(m: Microjogo, aleatorio: () => number): Dados {
  const inteiro = (n: number) => Math.floor(aleatorio() * n);
  switch (m) {
    case 'forca':
      return { periodoMs: 1100 + inteiro(600) };
    case 'copos': {
      const trocas: [number, number][] = [];
      const passos: number[] = [];
      const n = 8 + inteiro(4);
      for (let i = 0; i < n; i++) {
        const a = inteiro(3);
        const b = (a + 1 + inteiro(2)) % 3;
        trocas.push([Math.min(a, b), Math.max(a, b)]);
        // começa devagar e acelera
        passos.push(Math.round(650 - (i / Math.max(1, n - 1)) * 330));
      }
      return { inicial: inteiro(3), trocas, passos };
    }
    case 'siga':
      return { setas: Array.from({ length: SIGA_SETAS }, () => inteiro(4)) };
    case 'alvo': {
      const alvos: { t: number; casa: number }[] = [];
      let t = 600;
      while (t < ALVO_MS - ALVO_VIDA_MS) {
        // nunca na mesma casa de um alvo que ainda está na tela
        const ocupadas = new Set(alvos.filter((a) => a.t + ALVO_VIDA_MS > t).map((a) => a.casa));
        let casa = inteiro(9);
        while (ocupadas.has(casa)) casa = (casa + 1) % 9;
        alvos.push({ t, casa });
        t += 380 + inteiro(420);
      }
      return { alvos };
    }
    default:
      return {};
  }
}

/** O resultado de alguém numa rodada. */
interface Resultado {
  /** Desclassificado (antes do sinal), errou (o copo) ou nada que conte: zero ponto. */
  motivo: 'cedo' | 'errou' | 'invalido' | null;
  /** O que aparece na revelação: a reação, a força, o tempo, quanto levou, as setas, os alvos. */
  valor: number | null;
  /** Para ordenar: menor é melhor. */
  chave: number[];
}

/** O que alguém viu numa rodada, para a tela: a ordem e os pontos. */
interface LinhaDaRodada {
  userId: number;
  username: string;
  valor: number | null;
  motivo: 'cedo' | 'errou' | 'invalido' | 'nada' | null;
  posicao: number | null;
  pontos: number;
}

export const festa: Definicao = criarFesta();

export interface OpcoesDaFesta {
  agora?: () => number;
  aleatorio?: () => number;
  /** Para o teste: a ordem dos microjogos. */
  ordem?: Microjogo[];
}

export function criarFesta({ agora = Date.now, aleatorio = Math.random, ordem: ordemDoTeste }: OpcoesDaFesta = {}): Definicao {
  return {
    minimo: 2,
    comecar(ctx, { naSala }) {
      const inscritos = [...naSala];
      const ordem = ordemDoTeste ?? embaralhar([...MICROJOGOS], aleatorio).slice(0, RODADAS_FESTA);
      const evento = `festa-${ctx.comunidade ?? 0}-${agora()}`;
      const pontos = new Map<number, number>(inscritos.map((id) => [id, 0]));
      let rodada = 1;
      let fase: 'preparando' | 'jogando' | 'revelando' | 'fim' = 'preparando';
      let dados: Dados = {};
      let inicio = 0;
      /** O saque: quando o sinal saiu (relógio do servidor), ou null. */
      let sinalEm: number | null = null;
      const resultados = new Map<number, Resultado>();
      let linhas: LinhaDaRodada[] | null = null;
      const micro = () => ordem[rodada - 1];

      const preparar = () => {
        fase = 'preparando';
        dados = gerarDados(micro(), aleatorio);
        resultados.clear();
        linhas = null;
        sinalEm = null;
        ctx.agendar(PREPARO_MS, jogar);
        ctx.avisar();
      };

      const jogar = () => {
        fase = 'jogando';
        inicio = agora();
        if (micro() === 'saque') {
          const espera = SAQUE_ESPERA_MIN + Math.floor(aleatorio() * (SAQUE_ESPERA_MAX - SAQUE_ESPERA_MIN));
          ctx.agendar(espera, () => {
            sinalEm = agora();
            ctx.agendar(SAQUE_DEPOIS_MS, revelar);
            ctx.avisar();
          });
        } else {
          ctx.agendar(duracaoDe(micro(), dados), revelar);
        }
        ctx.avisar();
      };

      const revelar = () => {
        if (fase !== 'jogando') return;
        const presentes = new Set(ctx.naSala());
        const validos = [...resultados.entries()].filter(([, r]) => r.motivo === null);
        const menor = (a: number[], b: number[]) => {
          for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
          return 0;
        };
        validos.sort(([, a], [, b]) => menor(a.chave, b.chave));
        const nova: LinhaDaRodada[] = validos.map(([userId, r]) => {
          // empatados dividem a posição (e os pontos dela)
          const posicao = 1 + validos.filter(([, o]) => menor(o.chave, r.chave) < 0).length;
          const p = PONTOS_FESTA[posicao - 1] ?? 0;
          pontos.set(userId, (pontos.get(userId) ?? 0) + p);
          return { userId, username: ctx.nome(userId), valor: r.valor, motivo: null, posicao, pontos: p };
        });
        for (const [userId, r] of resultados) {
          if (r.motivo !== null) nova.push({ userId, username: ctx.nome(userId), valor: r.valor, motivo: r.motivo, posicao: null, pontos: 0 });
        }
        for (const userId of inscritos) {
          if (!resultados.has(userId) && presentes.has(userId)) nova.push({ userId, username: ctx.nome(userId), valor: null, motivo: 'nada', posicao: null, pontos: 0 });
        }
        linhas = nova;
        fase = 'revelando';
        ctx.agendar(REVELACAO_MS, () => {
          if (rodada >= ordem.length) return terminar();
          rodada++;
          preparar();
        });
        ctx.avisar();
      };

      const terminar = () => {
        fase = 'fim';
        // O PÓDIO, com 2 pessoas ou mais: até o 3º lugar (empatados dividem), e só quem fez algum ponto.
        if (inscritos.length >= 2) {
          const ordemFinal = placar(pontos, ctx.nome);
          for (const l of ordemFinal) {
            const posicao = 1 + ordemFinal.filter((o) => o.pontos > l.pontos).length;
            if (posicao > 3 || l.pontos <= 0) continue;
            db.guardarTrofeu({
              userId: l.userId,
              evento,
              communityId: ctx.comunidade ?? 0,
              pista: 'festa',
              posicao,
              tempoMs: null,
              pontos: l.pontos,
              rivais: inscritos.filter((id) => id !== l.userId),
            });
          }
        }
        ctx.terminar();
      };

      const todosResponderam = () => {
        const presentes = ctx.naSala().filter((id) => inscritos.includes(id));
        return presentes.every((id) => resultados.has(id));
      };

      const conferir = () => {
        if (fase === 'jogando' && todosResponderam()) revelar();
      };

      preparar();

      const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

      /** Confere o resultado mandado e o transforma no que conta. */
      const avaliar = (corpo: Record<string, unknown>): Resultado => {
        const agoraMs = agora();
        const passou = agoraMs - inicio;
        const invalido: Resultado = { motivo: 'invalido', valor: null, chave: [] };
        switch (micro()) {
          case 'saque': {
            if (corpo.cedo === true || sinalEm === null) return { motivo: 'cedo', valor: null, chave: [] };
            if (!numero(corpo.reacaoMs)) return invalido;
            if (corpo.reacaoMs < REACAO_MINIMA) return { motivo: 'cedo', valor: null, chave: [] };
            // a reação não fica muito abaixo do que o servidor viu passar desde o sinal
            const reacao = Math.round(Math.max(corpo.reacaoMs, agoraMs - sinalEm - FOLGA_SAQUE));
            return { motivo: null, valor: reacao, chave: [reacao] };
          }
          case 'forca': {
            const t = corpo.t;
            if (!numero(t) || t < 0 || t > FORCA_MS || t > passou + FOLGA_MS) return invalido;
            const v = Math.round(valorDaForca((dados as DadosForca).periodoMs, t) * 10) / 10;
            return { motivo: null, valor: v, chave: [100 - v] };
          }
          case 'relogio': {
            const t = corpo.t;
            if (!numero(t) || t < 0 || t > RELOGIO_MS || t > passou + FOLGA_MS) return invalido;
            const ms = Math.round(t);
            return { motivo: null, valor: ms, chave: [Math.abs(ms - RELOGIO_ALVO)] };
          }
          case 'copos': {
            const d = dados as DadosCopos;
            const anim = animacaoDosCopos(d);
            if (!numero(corpo.copo) || !numero(corpo.ms) || corpo.ms < 0) return invalido;
            // não se escolhe antes de os copos pararem
            if (passou < anim - FOLGA_MS) return invalido;
            if (corpo.copo !== copoFinal(d)) return { motivo: 'errou', valor: null, chave: [] };
            const ms = Math.round(Math.max(corpo.ms, REACAO_MINIMA, passou - anim - FOLGA_SAQUE));
            return { motivo: null, valor: ms, chave: [ms] };
          }
          case 'siga': {
            const setas = (dados as DadosSiga).setas;
            const n = corpo.acertos;
            const digitadas = corpo.setas;
            if (!numero(n) || !Number.isInteger(n) || n < 0 || n > setas.length || !Array.isArray(digitadas)) return invalido;
            if (digitadas.length < n || digitadas.length > n + 1) return invalido;
            // a última sequência completa bate com a do servidor
            for (let i = 0; i < n; i++) if (digitadas[i] !== setas[i]) return invalido;
            // e houve tempo de ver todas as sequências até ela
            if (passou + FOLGA_MS < minimoDaSiga(n)) return invalido;
            if (n === 0) return { motivo: 'errou', valor: 0, chave: [] };
            const ms = numero(corpo.ms) ? Math.max(0, Math.round(Math.min(corpo.ms, passou + FOLGA_MS))) : passou;
            return { motivo: null, valor: n, chave: [-n, ms] };
          }
          case 'alvo': {
            const alvos = (dados as DadosAlvo).alvos;
            const lista = corpo.acertos;
            if (!Array.isArray(lista) || lista.length > alvos.length) return invalido;
            const vistos = new Set<number>();
            for (const i of lista) {
              if (!numero(i) || !Number.isInteger(i) || i < 0 || i >= alvos.length || vistos.has(i)) return invalido;
              // não se acerta um alvo que ainda não tinha aparecido
              if (alvos[i].t > passou + FOLGA_MS) return invalido;
              vistos.add(i);
            }
            if (vistos.size === 0) return { motivo: 'errou', valor: 0, chave: [] };
            return { motivo: null, valor: vistos.size, chave: [-vistos.size] };
          }
        }
      };

      return {
        publico(quem) {
          const m = micro();
          const meu = resultados.get(quem);
          // a resposta certa dos copos só na revelação (as trocas, todo mundo vê)
          const resposta = fase === 'revelando' && m === 'copos' ? copoFinal(dados as DadosCopos) : null;
          return {
            fase,
            rodada,
            rodadas: ordem.length,
            microjogo: m,
            dados: fase === 'fim' ? null : dados,
            duracaoMs: duracaoDe(m, dados),
            sinal: sinalEm !== null,
            meu: meu ? { motivo: meu.motivo, valor: meu.valor } : null,
            prontos: [...resultados.keys()],
            jogadores: inscritos.map((userId) => ({ userId, username: ctx.nome(userId) })),
            resposta,
            linhas: fase === 'revelando' || fase === 'fim' ? linhas : null,
            placar: placar(pontos, ctx.nome),
          };
        },
        acao(quem, corpo) {
          if (corpo.tipo !== 'resultado') return 'Ação desconhecida.';
          if (!inscritos.includes(quem)) return 'Você está assistindo esta partida.';
          if (fase !== 'jogando') return 'Esta rodada já acabou.';
          // o primeiro resultado é o que vale (o Enter apertado duas vezes não troca nada)
          if (resultados.has(quem)) return null;
          resultados.set(quem, avaliar(corpo));
          if (todosResponderam()) revelar();
          else ctx.avisar();
          return null;
        },
        conferir,
      };
    },
  };
}
