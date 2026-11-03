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

interface Corredor {
  tempoMs: number | null;
  /** O quanto andou (0 a 1), pelo que a pessoa mandou por último: ordena quem não chegou. */
  andou: number;
}

interface Linha {
  userId: number;
  username: string;
  tempoMs: number | null;
  andou: number;
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

      const classificacao = (): Linha[] =>
        [...corredores.entries()]
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

      const placarDaCopa = () =>
        inscritos
          .map((userId) => ({ userId, username: ctx.nome(userId), pontos: pontos.get(userId) ?? 0, soma: somas.get(userId) ?? null }))
          .sort((a, b) => b.pontos - a.pontos || (a.soma ?? Infinity) - (b.soma ?? Infinity) || a.username.localeCompare(b.username));

      const largar = () => {
        const presentes = ctx.naSala().filter((id) => inscritos.includes(id));
        corredores = new Map(presentes.map((id) => [id, { tempoMs: null, andou: 0 }]));
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
       * O pódio (até 3), com 2 pessoas ou mais e só de quem tem resultado de verdade; empatados dividem a posição (o tempo
       * igual na fase; os pontos e a soma iguais na copa).
       */
      const darTrofeus = (pista: string, ordem: { userId: number; tempoMs: number | null; pontos: number | null; chegou: boolean }[]) => {
        if (ordem.length < 2) return;
        const todos = ordem.map((l) => l.userId);
        const tempo = (o: { tempoMs: number | null }) => o.tempoMs ?? Infinity;
        /** `o` ficou na frente de `l`: menos tempo; na copa, mais pontos, e no empate a soma menor. */
        const naFrente = (o: (typeof ordem)[number], l: (typeof ordem)[number]) =>
          o.pontos !== null && l.pontos !== null ? o.pontos > l.pontos || (o.pontos === l.pontos && tempo(o) < tempo(l)) : tempo(o) < tempo(l);
        ordem.forEach((l) => {
          if (!l.chegou) return;
          const posicao = 1 + ordem.filter((o) => o.chegou && naFrente(o, l)).length;
          if (posicao > 3) return;
          db.guardarTrofeu({
            userId: l.userId,
            evento,
            communityId: ctx.comunidade ?? 0,
            pista,
            posicao,
            tempoMs: l.tempoMs,
            pontos: l.pontos,
            rivais: todos.filter((id) => id !== l.userId),
          });
        });
      };

      const fecharFase = () => {
        if (fase !== 'correndo' && fase !== 'largada') return;
        const ordem = classificacao();
        ultima = ordem;
        const naSalaAgora = new Set(ctx.naSala());
        const ficaram = new Set(ordem.map((l) => l.userId).filter((id) => naSalaAgora.has(id)));
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
          darTrofeus(
            fases[0],
            ordem.filter((l) => ficaram.has(l.userId)).map((l) => ({ userId: l.userId, tempoMs: l.tempoMs, pontos: null, chegou: l.tempoMs !== null })),
          );
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
        const turma = correramTodas ?? new Set<number>();
        const placar = placarDaCopa().filter((l) => turma.has(l.userId));
        darTrofeus(pedida, placar.map((l) => ({ userId: l.userId, tempoMs: l.soma, pontos: l.pontos, chegou: l.pontos > 0 })));
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
          pilotos: classificacao().map(({ userId, username, tempoMs }) => ({ userId, username, tempoMs })),
          placarDaCopa: copa ? placarDaCopa().map(({ userId, username, pontos: p, soma }) => ({ userId, username, pontos: p, soma })) : null,
          ultima: ultima ? ultima.map(({ userId, username, tempoMs }) => ({ userId, username, tempoMs })) : null,
          prazo: prazoAberto,
        }),
        acao(quem, corpo) {
          const c = corredores.get(quem);
          if (!c) return 'Você não está nesta corrida.';
          if (corpo.tipo !== 'chegada') return 'Ação desconhecida.';
          if (fase !== 'correndo') return 'A corrida não está andando.';
          if (c.tempoMs !== null) return null;
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
        /** A posição de quem corre, conferida e carimbada: x e y dentro da fase, o passo, o jeito e o quanto andou. */
        tempoReal(quem, dados) {
          const c = corredores.get(quem);
          if (!c || fase !== 'correndo' || !dados || typeof dados !== 'object') return null;
          const { x, y, n, j, andou } = dados as Record<string, unknown>;
          const def = FASES_DO_PULO[fases[indice]];
          if (!numero(x) || !numero(y) || !numero(n) || !numero(j) || !numero(andou)) return null;
          if (x < 0 || x > def.largura || y < -64 || y > 260 || n < 0 || n > 60 * 60 * 10 || ![-2, -1, 1, 2].includes(j) || andou < 0 || andou > 1) return null;
          if (c.tempoMs === null) c.andou = andou;
          return { userId: quem, x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, n: Math.round(n), j, andou };
        },
        conferir,
      };
    },
  };
}
