/**
 * O PULO DO COELHO NA SALA (03/11/2026): a turma corre a mesma fase de plataforma ao vivo, ou as três seguidas (a Copa do
 * Pulo). A arquitetura é a da Corrida dos coelhos na sala (minijogo-corrida.ts), e pelo mesmo motivo: o servidor está na
 * Alemanha e a turma no Brasil (~200 ms), então CADA UM CORRE NO PRÓPRIO COMPUTADOR, e o servidor não simula nada:
 * - a largada é dele (a mesma contagem para todos, pelo relógio da partida);
 * - durante a fase, cada um manda a posição pelo tempo real, e o servidor só confere os números e repassa, carimbando
 *   quem mandou (os outros aparecem como coelhos translúcidos, sem batida: com 200 ms, cada um veria a batida num lugar);
 * - na chegada, cada um manda o FANTASMA da fase inteira, conferido como o do contra o relógio (validarPulo, em
 *   plataforma.ts) e também contra o relógio de verdade: ninguém declara mais tempo do que passou desde o verde do
 *   servidor (+ a folga da rede). A classificação é pelo TEMPO DE CADA UM, em passos desde o próprio verde.
 *
 * A primeira chegada abre 30 s para os outros; quem não chega fica atrás, pelo quanto andou. Na copa, pontos por posição
 * (10, 8, 6…) e o placar entre uma fase e outra; empate nos pontos desempata pela soma dos tempos.
 *
 * OS TROFÉUS: o pódio de uma fase avulsa ou da copa, com 2 pessoas ou mais, vai para a estante do quarto de quem ficou
 * nele (corrida_trofeus, com a "pista" = a fase ou a copa). Só conta quem correu até o fim, presente: quem fica sozinho
 * na sala não ganha troféu "com a turma", e quem saiu também não. Sem itens, a fase da sala que bate o recorde da pessoa
 * vira o recorde dela, como no contra o relógio.
 */
import * as db from './db.js';
import type { Definicao } from './minijogo-motor.js';
import { COPAS_DO_PULO, FASES_DO_PULO, validarPulo } from './plataforma.js';

/** A contagem da largada: 3 s, mais 1 s para todo mundo abrir a tela. */
export const LARGADA_MS = 4000;
export const PRAZO_MS = 30_000;
export const INTERVALO_MS = 10_000;
/** Uma fase não passa disto (a boa leva ~35 s). */
const FASE_MS = 4 * 60_000;
export const PONTOS = [10, 8, 6, 5, 4, 3, 2, 1];
/** A folga do relógio de verdade contra o tempo declarado (o atraso da rede na largada de cada um). */
export const FOLGA_MS = 3000;
/** O passo da posição ao vivo pode estar até isto à frente do relógio do servidor (3 s). */
export const PASSOS_DE_FOLGA = 180;

/**
 * O mais rápido que um coelho anda por passo, levado pela plataforma mais rápida (a corrida, 110/s, mais a plataforma,
 * 145/s: as mesmas medidas de plataforma.ts), e um tanto para o arredondamento.
 */
const PX_POR_PASSO = (110 + 145) / 60;
const FOLGA_PX = 2;
/** O passo que cai mais que isto (1 s) de uma posição para a outra é uma corrida nova: a página recarregada. */
export const RECOMECO_PASSOS = 60;

interface Corredor {
  tempoMs: number | null;
  /** O quanto andou (0 a 1), pelo que a pessoa mandou por último (limitado: ver o tempo real): ordena quem não chegou. */
  andou: number;
  /** O maior passo que chegou dela nesta fase. */
  maiorN: number;
  /** O x (já limitado) e o passo da última posição que contou para o quanto andou. */
  refX: number;
  refN: number;
  /** Recomeçou no meio da fase (o passo voltou muito): a chegada dela nesta fase não vale. */
  recomecou: boolean;
}

interface Linha {
  userId: number;
  username: string;
  tempoMs: number | null;
  andou: number;
  /** A posição entre quem ficou até o fim (empatados dividem); null para quem saiu, que vem depois, sem posição nem medalha. */
  posicao: number | null;
}

/**
 * A posição de cada linha, só entre `contam` (quem ficou): 1 + quantos dos que contam ficaram na frente dela, então
 * empatados dividem. As linhas voltam com quem conta primeiro, na ordem dada, e quem saiu depois, com a posição null.
 * É a MESMA conta da tela e do troféu.
 */
export function comPosicoes<L extends { userId: number }>(linhas: L[], contam: Set<number>, naFrente: (o: L, l: L) => boolean): (L & { posicao: number | null })[] {
  const ficou = linhas.filter((l) => contam.has(l.userId));
  return [
    ...ficou.map((l) => ({ ...l, posicao: 1 + ficou.filter((o) => naFrente(o, l)).length })),
    ...linhas.filter((l) => !contam.has(l.userId)).map((l) => ({ ...l, posicao: null })),
  ];
}

export const plataforma: Definicao = criarPlataforma();

/** `agora` é trocável para o teste. */
export function criarPlataforma(agora: () => number = Date.now): Definicao {
  return {
    minimo: 2,
    comecar(ctx, { naSala, corpo }) {
      // a fase (ou a copa); "categoria" é o que o "Jogar de novo" do painel manda de volta
      const pedida = typeof corpo.pista === 'string' ? corpo.pista : typeof corpo.categoria === 'string' ? corpo.categoria : 'prado-1';
      const copa = COPAS_DO_PULO[pedida] !== undefined;
      const fases = copa ? COPAS_DO_PULO[pedida] : [FASES_DO_PULO[pedida] ? pedida : 'prado-1'];
      const evento = `pulo-${ctx.comunidade ?? 0}-${agora()}`;
      let indice = 0;
      let fase: 'largada' | 'correndo' | 'intervalo' | 'fim' = 'largada';
      let verdeEm = 0;
      let prazoAberto = false;
      const inscritos = [...naSala];
      let corredores = new Map<number, Corredor>();
      /** Quem correu todas as fases até o fim delas, presente: só eles contam no troféu. */
      let correramTodas: Set<number> | null = null;
      const pontos = new Map<number, number>(inscritos.map((id) => [id, 0]));
      const somas = new Map<number, number | null>(inscritos.map((id) => [id, 0]));
      let ultima: Linha[] | null = null;
      /** Quem estava na sala ao fechar a fase atual (null enquanto ela corre: aí contam os presentes). */
      let ficaramNaFase: Set<number> | null = null;

      /** `o` ficou na frente de `l` numa fase: chegou com menos tempo; quem chegou fica na frente de quem não chegou; senão, andou mais. */
      const naFrenteNaFase = (o: { tempoMs: number | null; andou: number }, l: { tempoMs: number | null; andou: number }) =>
        o.tempoMs !== null && l.tempoMs !== null ? o.tempoMs < l.tempoMs : o.tempoMs !== null ? true : l.tempoMs === null && o.andou > l.andou;

      const classificacao = (): Linha[] => {
        const linhas = [...corredores.entries()]
          .map(([userId, c]) => ({ userId, username: ctx.nome(userId), tempoMs: c.tempoMs, andou: c.andou }))
          .sort((a, b) =>
            a.tempoMs !== null && b.tempoMs !== null
              ? a.tempoMs - b.tempoMs
              : a.tempoMs !== null
                ? -1
                : b.tempoMs !== null
                  ? 1
                  : b.andou - a.andou,
          );
        return comPosicoes(linhas, ficaramNaFase ?? new Set(ctx.naSala()), naFrenteNaFase);
      };

      /** Na copa: mais pontos na frente, e no empate a soma menor dos tempos (quem não chegou numa fase não tem soma). */
      const naFrenteNaCopa = (o: { pontos: number; soma: number | null }, l: { pontos: number; soma: number | null }) =>
        o.pontos > l.pontos || (o.pontos === l.pontos && (o.soma ?? Infinity) < (l.soma ?? Infinity));

      /** A posição é só de quem correu todas as fases até aqui, presente (antes da primeira fechar, quem está na sala). */
      const placarDaCopa = () =>
        comPosicoes(
          inscritos
            .map((userId) => ({ userId, username: ctx.nome(userId), pontos: pontos.get(userId) ?? 0, soma: somas.get(userId) ?? null }))
            .sort((a, b) => b.pontos - a.pontos || (a.soma ?? Infinity) - (b.soma ?? Infinity) || a.username.localeCompare(b.username)),
          correramTodas ?? new Set(ctx.naSala()),
          naFrenteNaCopa,
        );

      const largar = () => {
        const presentes = ctx.naSala().filter((id) => inscritos.includes(id));
        const largadaX = FASES_DO_PULO[fases[indice]].largada[0];
        corredores = new Map(presentes.map((id) => [id, { tempoMs: null, andou: 0, maiorN: 0, refX: largadaX, refN: 0, recomecou: false }]));
        ficaramNaFase = null;
        fase = 'largada';
        prazoAberto = false;
        ctx.agendar(LARGADA_MS, () => {
          fase = 'correndo';
          verdeEm = agora();
          ctx.agendar(FASE_MS, fecharFase);
          ctx.avisar();
        });
      };

      /**
       * O pódio (até 3), com 2 pessoas ou mais que ficaram até o fim e só de quem tem resultado de verdade. A posição é a
       * que a tela mostra (comPosicoes: empatados dividem, quem saiu não tem): a tela e o troféu não discordam.
       */
      const darTrofeus = (pista: string, linhas: { userId: number; posicao: number | null; tempoMs: number | null; pontos: number | null; chegou: boolean }[]) => {
        const ficou = linhas.filter((l) => l.posicao !== null);
        if (ficou.length < 2) return;
        const todos = ficou.map((l) => l.userId);
        for (const l of ficou) {
          if (!l.chegou || l.posicao === null || l.posicao > 3) continue;
          db.guardarTrofeu({
            userId: l.userId,
            evento,
            communityId: ctx.comunidade ?? 0,
            pista,
            posicao: l.posicao,
            tempoMs: l.tempoMs,
            pontos: l.pontos,
            rivais: todos.filter((id) => id !== l.userId),
          });
        }
      };

      const fecharFase = () => {
        if (fase !== 'correndo' && fase !== 'largada') return;
        const naSalaAgora = new Set(ctx.naSala());
        const ficaram = new Set([...corredores.keys()].filter((id) => naSalaAgora.has(id)));
        ficaramNaFase = ficaram;
        const ordem = classificacao();
        ultima = ordem;
        correramTodas = correramTodas === null ? ficaram : new Set([...correramTodas].filter((id) => ficaram.has(id)));
        ordem.forEach((l, i) => {
          if (l.tempoMs === null) {
            somas.set(l.userId, null);
            return;
          }
          // empatados no tempo ganham os mesmos pontos (os do melhor lugar entre eles)
          const lugar = ordem.findIndex((o) => o.tempoMs === l.tempoMs);
          pontos.set(l.userId, (pontos.get(l.userId) ?? 0) + (PONTOS[lugar >= 0 ? lugar : i] ?? 0));
          const s = somas.get(l.userId);
          if (s !== null && s !== undefined) somas.set(l.userId, s + l.tempoMs);
        });
        for (const id of inscritos) if (!corredores.has(id)) somas.set(id, null);
        if (!copa) {
          darTrofeus(fases[0], ordem.map((l) => ({ userId: l.userId, posicao: l.posicao, tempoMs: l.tempoMs, pontos: null, chegou: l.tempoMs !== null })));
          fase = 'fim';
          ctx.terminar();
          return;
        }
        if (indice < fases.length - 1) {
          fase = 'intervalo';
          ctx.agendar(INTERVALO_MS, () => {
            indice++;
            largar();
            ctx.avisar();
          });
          ctx.avisar();
          return;
        }
        darTrofeus(pedida, placarDaCopa().map((l) => ({ userId: l.userId, posicao: l.posicao, tempoMs: l.soma, pontos: l.pontos, chegou: l.pontos > 0 })));
        fase = 'fim';
        ctx.terminar();
      };

      const conferir = () => {
        if (fase !== 'correndo') return;
        const presentes = ctx.naSala();
        if (presentes.length === 0 || presentes.every((id) => !corredores.has(id) || corredores.get(id)!.tempoMs !== null)) fecharFase();
      };

      largar();

      const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

      return {
        publico: () => ({
          fase,
          categoria: copa ? pedida : fases[0],
          pista: fases[indice],
          copa,
          corrida: indice + 1,
          corridas: fases.length,
          // a posição vem daqui (só entre quem ficou; empatados dividem), e a tela só a mostra: a mesma do troféu
          pilotos: classificacao().map(({ userId, username, tempoMs, posicao }) => ({ userId, username, tempoMs, posicao })),
          placarDaCopa: copa ? placarDaCopa().map(({ userId, username, pontos: p, soma, posicao }) => ({ userId, username, pontos: p, soma, posicao })) : null,
          ultima: ultima ? ultima.map(({ userId, username, tempoMs, posicao }) => ({ userId, username, tempoMs, posicao })) : null,
          prazo: prazoAberto,
        }),
        acao(quem, corpo) {
          const c = corredores.get(quem);
          if (!c) return 'Você não está nesta corrida.';
          if (corpo.tipo !== 'chegada') return 'Ação desconhecida.';
          if (fase !== 'correndo') return 'A corrida não está andando.';
          if (c.tempoMs !== null) return null;
          // QUEM RECOMEÇOU NO MEIO (revisão independente, 03/11/2026): a página recarregada corria de novo do passo 0, com o
          // relógio limpo, e o tempo dela só era conferido contra o verde, que fica bem antes; uma corrida nova valia como a
          // primeira. O site, aberto no meio da fase, assiste; e aqui a chegada de quem recomeçou não vale.
          if (c.recomecou) return 'Corrida inválida.';
          const v = validarPulo(fases[indice], corpo);
          if ('erro' in v) return v.erro;
          if (v.ok.tempoMs > agora() - verdeEm + FOLGA_MS) return 'Corrida inválida.';
          c.tempoMs = v.ok.tempoMs;
          c.andou = 1;
          // sem itens, a fase da sala vale como a do contra o relógio: se for o melhor da pessoa, vira o recorde
          db.guardarPulo(quem, fases[indice], v.ok.tempoMs, JSON.stringify(v.ok.amostras));
          if (!prazoAberto) {
            prazoAberto = true;
            ctx.agendar(PRAZO_MS, fecharFase);
          }
          conferir();
          ctx.avisar();
          return null;
        },
        /**
         * A posição de quem corre, conferida e carimbada: x e y dentro da fase, o passo e o jeito. O quanto andou sai do x,
         * aqui (o que a pessoa diz não conta: ele ordena quem não chegou). O passo não passa do que o relógio do servidor viu
         * correr desde o verde, mais 3 s de folga (a rede e a contagem de cada um): a tela dos outros descarta a posição com
         * passo menor que o da última, e um passo enorme congelaria para eles o coelho de quem mandou.
         */
        tempoReal(quem, dados) {
          const c = corredores.get(quem);
          if (!c || fase !== 'correndo' || !dados || typeof dados !== 'object') return null;
          const { x, y, n, j } = dados as Record<string, unknown>;
          const def = FASES_DO_PULO[fases[indice]];
          if (!numero(x) || !numero(y) || !numero(n) || !numero(j)) return null;
          const passoMaximo = ((agora() - verdeEm) * 60) / 1000 + PASSOS_DE_FOLGA;
          if (x < 0 || x > def.largura || y < -64 || y > 260 || n < 0 || n > passoMaximo || ![-2, -1, 1, 2].includes(j)) return null;
          const progresso = (px: number) => Math.round(Math.max(0, Math.min(1, (px - def.largada[0]) / (def.chegada - def.largada[0]))) * 1000) / 1000;
          // o passo que volta muito é uma corrida nova (ver a chegada)
          if (n < c.maiorN - RECOMECO_PASSOS) c.recomecou = true;
          c.maiorN = Math.max(c.maiorN, n);
          // O QUANTO ANDOU, PARA A ORDEM DE QUEM NÃO CHEGA, não pula mais que o coelho corre desde a posição anterior (revisão
          // independente, 03/11/2026: o console mandava o x da chegada e ficava na frente de todos os que não chegaram). Para
          // trás pode (a volta ao posto). O que vai aos outros é o x de verdade: é onde o coelho deles é desenhado.
          if (c.tempoMs === null && !c.recomecou) {
            c.refX = Math.min(x, c.refX + Math.max(0, n - c.refN) * PX_POR_PASSO + FOLGA_PX);
            c.refN = Math.max(c.refN, n);
            c.andou = progresso(c.refX);
          }
          const andou = progresso(x);
          return { userId: quem, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, n: Math.round(n), j, andou };
        },
        conferir,
      };
    },
  };
}
