/**
 * A CORRIDA DOS COELHOS AO VIVO, NA SALA (03/11/2026, degrau 2, sem itens). O degrau 1 é o contra o relógio (corrida.ts);
 * aqui a turma corre junto.
 *
 * A REDE DECIDE O FORMATO (decidido com ele antes do código): o servidor está na Alemanha e a turma no Brasil, ~200 ms de
 * ida e volta. Por isso cada um DIRIGE O PRÓPRIO KART NO PRÓPRIO COMPUTADOR, e o servidor não simula nada:
 * - a largada é dele (a mesma contagem para todos, pelo relógio da partida);
 * - durante a corrida, cada um manda a posição pelo tempo real (4 vezes a cada 16 passos), e o servidor só repassa;
 * - na chegada, cada um manda o FANTASMA da corrida inteira, que o servidor confere como o do contra o relógio
 *   (validarCorrida). A classificação é pelo TEMPO DE CADA UM, contado em passos desde o próprio sinal verde — e não
 *   pela ordem em que as chegadas chegam ao servidor. Assim, quem tem internet pior não perde por isso.
 * Sem batida entre karts: com 200 ms, cada um veria a batida num lugar diferente.
 *
 * Quem chega primeiro abre um prazo de 30 s para os outros; quem não chega fica atrás, na ordem de quanto andou.
 * Uma corrida da sala que bate o recorde da pessoa vira o recorde (e o fantasma) dela.
 */
import * as db from './db.js';
import { validarCorrida } from './corrida.js';
import type { Definicao } from './minijogo-motor.js';

const PISTA = 'horta-1';
const VOLTAS = 3;
/** A contagem da largada: 3 s de semáforo, mais 1 s para todo mundo abrir a tela. */
export const LARGADA_MS = 4000;
/** Quanto os outros têm depois da primeira chegada. */
export const PRAZO_MS = 30_000;
/** Uma corrida não passa disto (a de 3 voltas leva ~1 min). */
const CORRIDA_MS = 5 * 60_000;

interface Piloto {
  /** O tempo da chegada (em ms, pelos passos), quando chegou. */
  tempoMs: number | null;
  voltas: number[];
  /** O quanto andou (voltas + fração), pelo que a pessoa mandou por último: ordena quem não chegou. */
  andou: number;
}

export const corrida: Definicao = {
  minimo: 2,
  comecar(ctx, { naSala }) {
    let fase: 'largada' | 'correndo' | 'fim' = 'largada';
    const pilotos = new Map<number, Piloto>(naSala.map((id) => [id, { tempoMs: null, voltas: [], andou: 0 }]));
    let prazoAberto = false;

    const classificacao = () =>
      [...pilotos.entries()]
        .map(([userId, p]) => ({ userId, username: ctx.nome(userId), tempoMs: p.tempoMs, voltas: p.voltas, andou: p.andou }))
        .sort((a, b) =>
          a.tempoMs !== null && b.tempoMs !== null
            ? a.tempoMs - b.tempoMs
            : a.tempoMs !== null
              ? -1
              : b.tempoMs !== null
                ? 1
                : b.andou - a.andou,
        );

    const fechar = () => {
      if (fase === 'fim') return;
      fase = 'fim';
      ctx.terminar();
    };

    const conferir = () => {
      if (fase !== 'correndo') return;
      const presentes = ctx.naSala();
      // todo mundo que está na sala chegou (quem saiu não segura a corrida)
      if (presentes.length === 0 || presentes.every((id) => !pilotos.has(id) || pilotos.get(id)!.tempoMs !== null)) fechar();
    };

    ctx.agendar(LARGADA_MS, () => {
      fase = 'correndo';
      ctx.agendar(CORRIDA_MS, fechar);
      ctx.avisar();
    });

    return {
      publico: () => ({
        fase,
        pista: PISTA,
        voltasDaCorrida: VOLTAS,
        pilotos: classificacao().map(({ userId, username, tempoMs, voltas }) => ({ userId, username, tempoMs, voltas })),
        prazo: prazoAberto,
      }),
      acao(quem, corpo) {
        const p = pilotos.get(quem);
        if (!p) return 'Você não está nesta corrida.';
        if (corpo.tipo !== 'chegada') return 'Ação desconhecida.';
        if (fase !== 'correndo') return 'A corrida não está andando.';
        if (p.tempoMs !== null) return null;
        const v = validarCorrida(PISTA, corpo);
        if ('erro' in v) return v.erro;
        p.tempoMs = v.ok.tempoMs;
        p.voltas = v.ok.voltas.map((passos) => Math.round((passos * 1000) / 60));
        p.andou = VOLTAS;
        db.guardarCorrida(quem, PISTA, v.ok.tempoMs, v.ok.voltas, JSON.stringify(v.ok.amostras));
        if (!prazoAberto) {
          prazoAberto = true;
          ctx.agendar(PRAZO_MS, fechar);
        }
        conferir();
        ctx.avisar();
        return null;
      },
      /** A posição de quem dirige, para os outros desenharem o kart: só números, conferidos, e com quem mandou. */
      tempoReal(quem, dados) {
        const p = pilotos.get(quem);
        if (!p || fase !== 'correndo' || !dados || typeof dados !== 'object') return null;
        const { x, y, a, n, andou } = dados as Record<string, unknown>;
        const numeros = [x, y, a, n, andou];
        if (!numeros.every((k) => typeof k === 'number' && Number.isFinite(k))) return null;
        if ((x as number) < 0 || (y as number) < 0 || (x as number) > 1024 || (y as number) > 1024) return null;
        if ((andou as number) < 0 || (andou as number) > VOLTAS + 1) return null;
        if (p.tempoMs === null) p.andou = andou as number;
        return { userId: quem, x, y, a, n, andou };
      },
      conferir,
    };
  },
};
