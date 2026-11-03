/**
 * A CORRIDA DOS COELHOS AO VIVO, NA SALA (03/11/2026). O degrau 1 é o contra o relógio (corrida.ts); aqui a turma corre
 * junto (degrau 2), com os itens, as copas e os troféus (degrau 3).
 *
 * A REDE DECIDE O FORMATO (decidido com ele antes do código): o servidor está na Alemanha e a turma no Brasil, ~200 ms de
 * ida e volta. Por isso cada um DIRIGE O PRÓPRIO KART NO PRÓPRIO COMPUTADOR, e o servidor não simula nada:
 * - a largada é dele (a mesma contagem para todos, pelo relógio da partida);
 * - durante a corrida, cada um manda a posição pelo tempo real, e o servidor só repassa (carimbando quem mandou);
 * - os ITENS também passam pelo tempo real: o servidor confere os números, conta quantos cada um usou (não mais que as
 *   caixas da pista permitem) e carimba o dono; quem decide se foi atingido é o computador de quem leva (web/src/corrida/
 *   laco.ts);
 * - na chegada, cada um manda o FANTASMA da corrida inteira, que o servidor confere como o do contra o relógio
 *   (validarCorrida), e também contra o relógio de verdade desde o verde. A classificação é pelo TEMPO DE CADA UM, contado
 *   em passos desde o próprio sinal verde — e não pela ordem em que as chegadas chegam ao servidor.
 * Sem batida entre karts: com 200 ms, cada um veria a batida num lugar diferente.
 *
 * A COPA DA CENOURA: as três pistas seguidas, com pontos por posição (10, 8, 6, 5, 4, 3, 2, 1; quem não chega, zero) e 10 s
 * de placar entre uma e outra. OS TROFÉUS (decisão dele, 03/11/2026): o pódio de cada corrida avulsa e de cada copa, com 2
 * pessoas ou mais, vai para o quarto de quem ficou nele (corrida_trofeus); e cada copa corrida até o fim pela turma conta na
 * conquista coletiva do salão (corrida_copas). Com itens, a corrida da sala NÃO vira recorde: a cenoura turbo faria o
 * recorde de uma corrida com itens valer contra o contra o relógio, que não os tem.
 */
import * as db from './db.js';
import { PISTAS, validarCorrida } from './corrida.js';
import type { Definicao } from './minijogo-motor.js';

const VOLTAS = 3;
export const COPA = 'copa-da-cenoura';
export const PISTAS_DA_COPA = ['horta-1', 'pomar-1', 'praia-1'];
/** A contagem da largada: 3 s de semáforo, mais 1 s para todo mundo abrir a tela. */
export const LARGADA_MS = 4000;
/** Quanto os outros têm depois da primeira chegada. */
export const PRAZO_MS = 30_000;
/** O placar entre as corridas da copa. */
export const INTERVALO_MS = 10_000;
/** Uma corrida não passa disto (a de 3 voltas leva ~1 min). */
const CORRIDA_MS = 5 * 60_000;
export const PONTOS = [10, 8, 6, 5, 4, 3, 2, 1];
/**
 * A FOLGA DO RELÓGIO: a chegada não pode declarar um tempo maior do que o que de fato passou desde o verde do servidor,
 * mais isto (a contagem de cada um começa com o atraso da rede). Sem isso, um fantasma guardado, mandado pelo console um
 * segundo depois da largada, ganhava a corrida e fechava o prazo de 30 s para todo mundo (revisão de 03/11/2026). Pausar
 * não atrapalha: a janela sem foco para os passos, e o relógio de verdade só fica maior.
 */
export const FOLGA_MS = 3000;

interface Piloto {
  /** O tempo da chegada (em ms, pelos passos), quando chegou. */
  tempoMs: number | null;
  voltas: number[];
  /** O quanto andou (voltas + fração), pelo que a pessoa mandou por último: ordena quem não chegou. */
  andou: number;
  /** Os itens usados nesta corrida, e quando foi o último (relógio do servidor). */
  itens: number;
  ultimoItem: number;
  acertos: number;
  /** A última posição que a pessoa mandou: o item só sai de perto dela (revisão de 03/11/2026). */
  ultima: { x: number; y: number; n: number; andou: number } | null;
}

interface Linha {
  userId: number;
  username: string;
  tempoMs: number | null;
  voltas: number[];
  andou: number;
}

export const corrida: Definicao = criarCorrida();

/** `agora` é trocável para o teste. */
export function criarCorrida(agora: () => number = Date.now): Definicao {
  return {
    minimo: 2,
    comecar(ctx, { naSala, corpo }) {
      // a pista (ou a copa); "categoria" é o nome que o "Jogar de novo" do painel manda de volta
      const pedida = typeof corpo.pista === 'string' ? corpo.pista : typeof corpo.categoria === 'string' ? corpo.categoria : 'horta-1';
      const copa = pedida === COPA;
      const corridas = copa ? PISTAS_DA_COPA : [PISTAS[pedida] ? pedida : 'horta-1'];
      const evento = `${ctx.comunidade ?? 0}-${agora()}`;
      let indice = 0;
      let fase: 'largada' | 'correndo' | 'intervalo' | 'fim' = 'largada';
      let verdeEm = 0;
      let prazoAberto = false;
      /** Quem começou a partida: só eles correm (a copa inteira), e quem sai da sala fica sem pontos dali em diante. */
      const inscritos = [...naSala];
      let pilotos = new Map<number, Piloto>();
      /** Os itens desta corrida que o servidor carimbou, e os que já acertaram alguém: "acertou" só vale para um item de
       * verdade, uma vez (revisão de 03/11/2026: um "acertou" inventado sumia com o item dos outros). */
      let itensDaCorrida = new Set<string>();
      let itensQueAcertaram = new Set<string>();
      /** Quem correu cada corrida da copa até o fim dela, presente: só eles contam como "a turma" no troféu e na copa. */
      let correramTodas: Set<number> | null = null;
      const pontos = new Map<number, number>(inscritos.map((id) => [id, 0]));
      /** A soma dos tempos na copa: desempata os pontos (quem não chegou numa corrida não tem soma). */
      const somas = new Map<number, number | null>(inscritos.map((id) => [id, 0]));
      const resultados: { pista: string; pilotos: Linha[] }[] = [];

      const classificacao = (): Linha[] =>
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

      const placarDaCopa = () =>
        inscritos
          .map((userId) => ({ userId, username: ctx.nome(userId), pontos: pontos.get(userId) ?? 0, soma: somas.get(userId) ?? null }))
          .sort((a, b) => b.pontos - a.pontos || (a.soma ?? Infinity) - (b.soma ?? Infinity) || a.username.localeCompare(b.username));

      const largar = () => {
        const presentes = ctx.naSala().filter((id) => inscritos.includes(id));
        pilotos = new Map(presentes.map((id) => [id, { tempoMs: null, voltas: [], andou: 0, itens: 0, ultimoItem: 0, acertos: 0, ultima: null }]));
        itensDaCorrida = new Set();
        itensQueAcertaram = new Set();
        fase = 'largada';
        prazoAberto = false;
        ctx.agendar(LARGADA_MS, () => {
          fase = 'correndo';
          verdeEm = agora();
          ctx.agendar(CORRIDA_MS, fecharCorrida);
          ctx.avisar();
        });
      };

      /**
       * OS TROFÉUS: o pódio (até 3), com 2 pessoas ou mais, para quem chegou ao pódio de verdade. `ordem` já vem só com quem
       * correu até o fim, presente (revisão de 03/11/2026: quem ficava sozinho na sala ganhava o troféu "com a turma").
       */
      const darTrofeus = (pista: string, ordem: { userId: number; tempoMs: number | null; pontos: number | null; chegou: boolean }[]) => {
        if (ordem.length < 2) return;
        const todos = ordem.map((l) => l.userId);
        ordem.slice(0, 3).forEach((l, posicao) => {
          if (!l.chegou) return;
          db.guardarTrofeu({
            userId: l.userId,
            evento,
            communityId: ctx.comunidade ?? 0,
            pista,
            posicao: posicao + 1,
            tempoMs: l.tempoMs,
            pontos: l.pontos,
            rivais: todos.filter((id) => id !== l.userId),
          });
        });
      };

      const fecharCorrida = () => {
        if (fase !== 'correndo' && fase !== 'largada') return;
        const ordem = classificacao();
        resultados.push({ pista: corridas[indice], pilotos: ordem });
        // quem correu esta corrida e ainda está na sala no fim dela
        const naSalaAgora = new Set(ctx.naSala());
        const ficaram = new Set(ordem.map((l) => l.userId).filter((id) => naSalaAgora.has(id)));
        correramTodas = correramTodas === null ? ficaram : new Set([...correramTodas].filter((id) => ficaram.has(id)));
        ordem.forEach((l, i) => {
          if (l.tempoMs === null) {
            somas.set(l.userId, null);
            return;
          }
          pontos.set(l.userId, (pontos.get(l.userId) ?? 0) + (PONTOS[i] ?? 0));
          const s = somas.get(l.userId);
          if (s !== null && s !== undefined) somas.set(l.userId, s + l.tempoMs);
        });
        // quem não correu esta (saiu da sala) também fica sem soma
        for (const id of inscritos) if (!pilotos.has(id)) somas.set(id, null);
        if (!copa) {
          darTrofeus(
            corridas[0],
            ordem.filter((l) => ficaram.has(l.userId)).map((l) => ({ userId: l.userId, tempoMs: l.tempoMs, pontos: null, chegou: l.tempoMs !== null })),
          );
          fase = 'fim';
          ctx.terminar();
          return;
        }
        if (indice < corridas.length - 1) {
          fase = 'intervalo';
          ctx.agendar(INTERVALO_MS, () => {
            indice++;
            largar();
            ctx.avisar();
          });
          ctx.avisar();
          return;
        }
        // o fim da copa: o pódio pelos pontos, e a copa da turma
        const turma = correramTodas ?? new Set<number>();
        const placar = placarDaCopa().filter((l) => turma.has(l.userId));
        darTrofeus(COPA, placar.map((l) => ({ userId: l.userId, tempoMs: l.soma, pontos: l.pontos, chegou: l.pontos > 0 })));
        if (turma.size >= 2) db.registrarCopa(ctx.comunidade ?? 0, turma.size);
        fase = 'fim';
        ctx.terminar();
      };

      const conferir = () => {
        if (fase !== 'correndo') return;
        const presentes = ctx.naSala();
        // todo mundo que está na sala chegou (quem saiu não segura a corrida)
        if (presentes.length === 0 || presentes.every((id) => !pilotos.has(id) || pilotos.get(id)!.tempoMs !== null)) fecharCorrida();
      };

      largar();

      const numero = (v: unknown) => typeof v === 'number' && Number.isFinite(v);

      return {
        publico: () => ({
          fase,
          categoria: copa ? COPA : corridas[0],
          pista: corridas[indice],
          copa,
          corrida: indice + 1,
          corridas: corridas.length,
          voltasDaCorrida: VOLTAS,
          itens: true,
          pilotos: classificacao().map(({ userId, username, tempoMs, voltas }) => ({ userId, username, tempoMs, voltas })),
          placarDaCopa: copa ? placarDaCopa().map(({ userId, username, pontos: p }) => ({ userId, username, pontos: p })) : null,
          ultima: resultados.length ? resultados[resultados.length - 1].pilotos.map(({ userId, username, tempoMs }) => ({ userId, username, tempoMs })) : null,
          prazo: prazoAberto,
        }),
        acao(quem, corpo) {
          const p = pilotos.get(quem);
          if (!p) return 'Você não está nesta corrida.';
          if (corpo.tipo !== 'chegada') return 'Ação desconhecida.';
          if (fase !== 'correndo') return 'A corrida não está andando.';
          if (p.tempoMs !== null) return null;
          const v = validarCorrida(corridas[indice], corpo);
          if ('erro' in v) return v.erro;
          if (v.ok.tempoMs > agora() - verdeEm + FOLGA_MS) return 'Corrida inválida.';
          p.tempoMs = v.ok.tempoMs;
          p.voltas = v.ok.voltas.map((passos) => Math.round((passos * 1000) / 60));
          p.andou = VOLTAS;
          if (!prazoAberto) {
            prazoAberto = true;
            ctx.agendar(PRAZO_MS, fecharCorrida);
          }
          conferir();
          ctx.avisar();
          return null;
        },
        /**
         * O que vai aos outros NA HORA: a posição de quem dirige e os itens. Só números conferidos, e carimbados com quem
         * mandou (o `dono` do item é o servidor que diz).
         */
        tempoReal(quem, dados) {
          const p = pilotos.get(quem);
          if (!p || fase !== 'correndo' || !dados || typeof dados !== 'object') return null;
          const d = dados as Record<string, unknown>;
          if (d.tipo === 'repolho' || d.tipo === 'lama') {
            if (p.tempoMs !== null || !numero(d.n) || (d.n as number) < 0) return null;
            // não mais itens que as caixas da pista dão (uma fileira por volta, cada uma), nem dois no mesmo segundo
            const maximo = (PISTAS[corridas[indice]]?.caixas ?? 2) * VOLTAS + 1;
            if (p.itens >= maximo || agora() - p.ultimoItem < 1000) return null;
            // O ITEM SAI DE PERTO DE QUEM O USA (revisão de 03/11/2026: pelo console, a lama caía na frente do líder): perto da
            // última posição que a pessoa mandou, e no mesmo segundo dela
            const u = p.ultima;
            if (!u || Math.abs((d.n as number) - u.n) > 60) return null;
            const id = `${quem}-${Math.round(d.n as number)}`;
            if (d.tipo === 'repolho') {
              if (!numero(d.s) || !numero(d.lado) || Math.abs(d.lado as number) > 60 || (d.s as number) < 0 || (d.s as number) > 20000) return null;
              const comprimento = PISTAS[corridas[indice]]?.comprimento ?? 3000;
              const onde = (u.andou % 1) * comprimento;
              const dist = Math.abs((((d.s as number) - onde) % comprimento + comprimento * 1.5) % comprimento - comprimento / 2);
              if (dist > 80) return null;
              p.itens++;
              p.ultimoItem = agora();
              itensDaCorrida.add(id);
              return { tipo: 'repolho', id, dono: quem, n: Math.round(d.n as number), s: d.s, lado: d.lado };
            }
            if (!numero(d.x) || !numero(d.y) || (d.x as number) < 0 || (d.y as number) < 0 || (d.x as number) > 1024 || (d.y as number) > 1024) return null;
            if (Math.hypot((d.x as number) - u.x, (d.y as number) - u.y) > 30) return null;
            p.itens++;
            p.ultimoItem = agora();
            itensDaCorrida.add(id);
            return { tipo: 'lama', id, dono: quem, n: Math.round(d.n as number), x: d.x, y: d.y };
          }
          if (d.tipo === 'acertou') {
            // quem foi atingido avisa, para o item sumir para todos
            if (typeof d.id !== 'string' || !itensDaCorrida.has(d.id) || itensQueAcertaram.has(d.id) || p.acertos >= 40) return null;
            p.acertos++;
            itensQueAcertaram.add(d.id);
            return { tipo: 'acertou', id: d.id };
          }
          const { x, y, a, n, andou } = d;
          if (![x, y, a, n, andou].every(numero)) return null;
          if ((x as number) < 0 || (y as number) < 0 || (x as number) > 1024 || (y as number) > 1024) return null;
          if ((andou as number) < 0 || (andou as number) > VOLTAS) return null;
          if (p.tempoMs === null) p.andou = andou as number;
          p.ultima = { x: x as number, y: y as number, n: n as number, andou: andou as number };
          return { userId: quem, x, y, a, n, andou };
        },
        conferir,
      };
    },
  };
}
