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
/** As copas: três pistas seguidas (o site tem a mesma lista: web/src/corrida/pista.ts, COPAS). */
export const COPAS: Record<string, string[]> = {
  [COPA]: ['horta-1', 'pomar-1', 'praia-1'],
  'copa-do-repolho': ['bosque-1', 'neve-1', 'canion-1'],
};
export const PISTAS_DA_COPA = COPAS[COPA];
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
/** O passo da posição ao vivo pode estar até isto à frente do relógio do servidor desde o verde (3 s). */
export const PASSOS_DE_FOLGA = 180;
/**
 * O QUANTO O KART ANDA POR PASSO, no máximo: o turbo (185 por segundo), com a folga da árvore que empurra. A posição ao vivo
 * não pode estar mais longe da anterior do que isto vezes os passos entre elas (revisão independente, 03/11/2026: pelo
 * console, a pessoa "aparecia" do lado do líder e soltava a lama ali, porque o item é conferido contra essa posição).
 */
const ANDA_POR_PASSO = (185 / 60) * 1.1;
/** Folga fixa da conferência da posição (o arredondamento do que o site manda, a largada três pontos antes da linha). */
const FOLGA_DA_POSICAO = 8;
/** Quem diz ter sido atingido pela lama estava a no máximo isto dela (o raio do acerto é 8, mais o kart andando 4 passos). */
const PERTO_DA_LAMA = 22;
/** O repolho: o quanto da linha do meio separa quem diz ter sido atingido do lugar onde ele estava naquele passo. */
const PERTO_DO_REPOLHO = 60;
/** O repolho anda 230 por segundo pela linha do meio, por 4 s (web/src/corrida/laco.ts). */
const VELOCIDADE_DO_REPOLHO = 230;
const VIDA_DO_REPOLHO = 4 * 60;
const VIDA_DA_LAMA = 30 * 60;
/** O repolho-roxo: 290 por segundo pela linha do meio, por 6 s, e só pega o alvo (web/src/corrida/laco.ts). */
const VELOCIDADE_DO_ROXO = 290;
const VIDA_DO_ROXO = 6 * 60;
/** Os itens que não andam nem ficam no chão: o escudo de alface, a toca e o regador (o servidor só carimba e conta). */
const ITENS_DO_KART = ['alface', 'toca', 'regador'] as const;
/** De quantos em quantos passos o site manda a posição (web/src/corrida/fisica.ts, AMOSTRA). */
const AMOSTRA_DA_POSICAO = 4;
/** A primeira posição sai da largada: perto da linha de chegada (o kart larga três pontos antes dela). */
const PERTO_DA_LINHA_NA_LARGADA = 60;

/** A distância entre dois pontos da linha do meio, dando a volta (o fim da volta encosta no começo). */
function distanciaNaVolta(a: number, b: number, comprimento: number) {
  const d = (((a - b) % comprimento) + comprimento) % comprimento;
  return Math.min(d, comprimento - d);
}

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
  /**
   * A última posição ACEITA (a que o servidor repassou): o item só sai de perto dela (revisão de 03/11/2026), e a próxima
   * só é aceita se o kart pudesse ter ido de uma à outra (revisão independente, 03/11/2026). `em` é o relógio do servidor
   * quando ela chegou.
   */
  ultima: { x: number; y: number; n: number; andou: number; em: number } | null;
  /** Passou pela metade da volta desde a última vez que cruzou a linha (como o kart do site: sem isso, não conta volta). */
  meio: boolean;
}

interface Linha {
  userId: number;
  username: string;
  tempoMs: number | null;
  voltas: number[];
  andou: number;
  /** A posição entre quem ficou até o fim (empatados dividem); null para quem saiu, que vem depois, sem posição nem medalha. */
  posicao: number | null;
}

/** Um item que o servidor carimbou: o que é preciso para conferir o "acertou" de quem diz ter sido atingido. */
type ItemCarimbado = { dono: number; n: number } & (
  | { tipo: 'repolho'; s: number }
  | { tipo: 'repolho-roxo'; s: number; alvo: number | null }
  | { tipo: 'lama'; x: number; y: number }
  | { tipo: (typeof ITENS_DO_KART)[number] }
);

/**
 * A posição de cada linha, só entre `contam` (quem ficou): 1 + quantos dos que contam ficaram na frente dela, então
 * empatados dividem. As linhas voltam com quem conta primeiro, na ordem dada, e quem saiu depois, com a posição null.
 * É a MESMA conta da tela e do troféu (revisão independente, 03/11/2026: a tela dava a medalha pela ordem da lista, com
 * quem saiu dentro dela, e o troféu era outro; a conta é a mesma do Pulo do coelho, copiada e não importada, para um jogo
 * não depender do outro).
 */
export function comPosicoes<L extends { userId: number }>(linhas: L[], contam: Set<number>, naFrente: (o: L, l: L) => boolean): (L & { posicao: number | null })[] {
  const ficou = linhas.filter((l) => contam.has(l.userId));
  return [
    ...ficou.map((l) => ({ ...l, posicao: 1 + ficou.filter((o) => naFrente(o, l)).length })),
    ...linhas.filter((l) => !contam.has(l.userId)).map((l) => ({ ...l, posicao: null })),
  ];
}

export const corrida: Definicao = criarCorrida();

/** `agora` é trocável para o teste. */
export function criarCorrida(agora: () => number = Date.now): Definicao {
  return {
    minimo: 2,
    comecar(ctx, { naSala, corpo }) {
      // a pista (ou a copa); "categoria" é o nome que o "Jogar de novo" do painel manda de volta
      const pedida = typeof corpo.pista === 'string' ? corpo.pista : typeof corpo.categoria === 'string' ? corpo.categoria : 'horta-1';
      const copa = COPAS[pedida] !== undefined;
      const corridas = copa ? COPAS[pedida] : [PISTAS[pedida] ? pedida : 'horta-1'];
      const evento = `${ctx.comunidade ?? 0}-${agora()}`;
      let indice = 0;
      let fase: 'largada' | 'correndo' | 'intervalo' | 'fim' = 'largada';
      let verdeEm = 0;
      let prazoAberto = false;
      /** Quem começou a partida: só eles correm (a copa inteira), e quem sai da sala fica sem pontos dali em diante. */
      const inscritos = [...naSala];
      /** O coelho de cada um (o avatar pronto), lido uma vez: cada kart corre com as cores do seu. */
      const avatares = new Map(inscritos.map((id) => [id, db.avatarDoJogo(id)]));
      let pilotos = new Map<number, Piloto>();
      /** Os itens desta corrida que o servidor carimbou, e os que já acertaram alguém: "acertou" só vale para um item de
       * verdade, uma vez (revisão de 03/11/2026: um "acertou" inventado sumia com o item dos outros). */
      let itensDaCorrida = new Map<string, ItemCarimbado>();
      let itensQueAcertaram = new Set<string>();
      /** Quem correu cada corrida da copa até o fim dela, presente: só eles contam como "a turma" no troféu e na copa. */
      let correramTodas: Set<number> | null = null;
      const pontos = new Map<number, number>(inscritos.map((id) => [id, 0]));
      /** A soma dos tempos na copa: desempata os pontos (quem não chegou numa corrida não tem soma). */
      const somas = new Map<number, number | null>(inscritos.map((id) => [id, 0]));
      const resultados: { pista: string; pilotos: Linha[] }[] = [];
      /** Quem estava na sala ao fechar a corrida atual (null enquanto ela corre: aí contam os presentes). */
      let ficaramNaCorrida: Set<number> | null = null;

      /** `o` ficou na frente de `l`: chegou com menos tempo; quem chegou fica na frente de quem não chegou; senão, andou mais. */
      const naFrenteNaCorrida = (o: { tempoMs: number | null; andou: number }, l: { tempoMs: number | null; andou: number }) =>
        o.tempoMs !== null && l.tempoMs !== null ? o.tempoMs < l.tempoMs : o.tempoMs !== null ? true : l.tempoMs === null && o.andou > l.andou;

      const classificacao = (): Linha[] => {
        const linhas = [...pilotos.entries()]
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
        return comPosicoes(linhas, ficaramNaCorrida ?? new Set(ctx.naSala()), naFrenteNaCorrida);
      };

      /** Na copa: mais pontos na frente, e no empate a soma menor dos tempos (quem não chegou numa corrida não tem soma). */
      const naFrenteNaCopa = (o: { pontos: number; soma: number | null }, l: { pontos: number; soma: number | null }) =>
        o.pontos > l.pontos || (o.pontos === l.pontos && (o.soma ?? Infinity) < (l.soma ?? Infinity));

      /** A posição é só de quem correu todas as corridas até aqui, presente (antes da primeira fechar, quem está na sala). */
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
        pilotos = new Map(presentes.map((id) => [id, { tempoMs: null, voltas: [], andou: 0, itens: 0, ultimoItem: 0, acertos: 0, ultima: null, meio: false }]));
        itensDaCorrida = new Map();
        itensQueAcertaram = new Set();
        ficaramNaCorrida = null;
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
       * OS TROFÉUS: o pódio (até 3), com 2 pessoas ou mais que ficaram até o fim, e só de quem tem resultado de verdade. A
       * posição é a que a tela mostra (comPosicoes: empatados dividem, quem saiu não tem): a tela e o troféu não discordam
       * (revisão independente, 03/11/2026; a revisão anterior, do mesmo dia, já tinha tirado quem ficava sozinho na sala).
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

      const fecharCorrida = () => {
        if (fase !== 'correndo' && fase !== 'largada') return;
        // quem correu esta corrida e ainda está na sala no fim dela: só eles têm posição, pontos e troféu
        const naSalaAgora = new Set(ctx.naSala());
        const ficaram = new Set([...pilotos.keys()].filter((id) => naSalaAgora.has(id)));
        ficaramNaCorrida = ficaram;
        const ordem = classificacao();
        resultados.push({ pista: corridas[indice], pilotos: ordem });
        correramTodas = correramTodas === null ? ficaram : new Set([...correramTodas].filter((id) => ficaram.has(id)));
        for (const l of ordem) {
          // quem saiu não soma pontos nem tempo; empatados no tempo ganham os mesmos pontos (os do lugar que dividem)
          if (l.tempoMs === null || l.posicao === null) {
            somas.set(l.userId, null);
            continue;
          }
          pontos.set(l.userId, (pontos.get(l.userId) ?? 0) + (PONTOS[l.posicao - 1] ?? 0));
          const s = somas.get(l.userId);
          if (s !== null && s !== undefined) somas.set(l.userId, s + l.tempoMs);
        }
        // quem não correu esta (saiu da sala) também fica sem soma
        for (const id of inscritos) if (!pilotos.has(id)) somas.set(id, null);
        if (!copa) {
          darTrofeus(corridas[0], ordem.map((l) => ({ userId: l.userId, posicao: l.posicao, tempoMs: l.tempoMs, pontos: null, chegou: l.tempoMs !== null })));
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
        // o fim da copa: o pódio pelos pontos, entre quem correu todas, e a copa da turma
        const turma = correramTodas ?? new Set<number>();
        darTrofeus(pedida, placarDaCopa().map((l) => ({ userId: l.userId, posicao: l.posicao, tempoMs: l.soma, pontos: l.pontos, chegou: l.pontos > 0 })));
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

      /**
       * A POSIÇÃO AO VIVO TEM DE SER UMA QUE O KART ALCANÇA (revisão independente, 03/11/2026). O servidor não conhece o chão,
       * mas sabe o quanto o kart anda por passo, no máximo:
       * - o passo `n` só cresce, e não passa do relógio do servidor desde o verde (mais a folga da largada de cada um);
       * - a primeira sai da largada, perto da linha de chegada; as outras, no máximo ANDA_POR_PASSO por passo desde a anterior,
       *   e os passos contados são também no máximo os do relógio do servidor desde que a anterior chegou, mais 1 s (sem isso,
       *   quem mandasse `n` atrasado juntaria passos para "pular" depois);
       * - o quanto andou na volta (`andou`) acompanha o caminho: a fração da volta não anda mais que o dobro do que o kart
       *   andou (por dentro da curva a linha do meio é mais longa), e a volta inteira só sobe de um em um, cruzando a linha
       *   para a frente, depois de ter passado pela metade (a mesma regra do kart do site).
       * A posição recusada não é repassada nem vira a "última": a próxima é conferida contra a última aceita.
       */
      const posicaoPossivel = (p: Piloto, x: number, y: number, n: number, andou: number) => {
        const def = PISTAS[corridas[indice]];
        if (!def || !Number.isInteger(n) || n < 1) return false;
        if (n > ((agora() - verdeEm) * 60) / 1000 + PASSOS_DE_FOLGA) return false;
        const u = p.ultima;
        if (!u) {
          if (Math.floor(andou) !== 0) return false;
          return Math.hypot(x - def.linha[0], y - def.linha[1]) <= PERTO_DA_LINHA_NA_LARGADA + n * ANDA_POR_PASSO;
        }
        if (n <= u.n) return false;
        const passos = Math.min(n - u.n, ((agora() - u.em) * 60) / 1000 + 60);
        const alcance = passos * ANDA_POR_PASSO + FOLGA_DA_POSICAO;
        if (Math.hypot(x - u.x, y - u.y) > alcance) return false;
        if (distanciaNaVolta((andou % 1) * def.comprimento, (u.andou % 1) * def.comprimento, def.comprimento) > 2 * alcance + 40) return false;
        const volta = Math.floor(andou) - Math.floor(u.andou);
        const fracao = andou % 1;
        if (volta !== 0) {
          if (volta !== 1 || !p.meio || u.andou % 1 < 0.5 || fracao >= 0.5) return false;
          p.meio = false;
        }
        if (fracao >= 0.3 && fracao <= 0.7) p.meio = true;
        return true;
      };

      return {
        publico: () => ({
          fase,
          categoria: copa ? pedida : corridas[0],
          pista: corridas[indice],
          copa,
          corrida: indice + 1,
          corridas: corridas.length,
          voltasDaCorrida: VOLTAS,
          itens: true,
          pilotos: classificacao().map(({ userId, username, tempoMs, voltas, posicao }) => ({ userId, username, tempoMs, voltas, posicao, avatar: avatares.get(userId) ?? null })),
          placarDaCopa: copa ? placarDaCopa().map(({ userId, username, pontos: p, posicao }) => ({ userId, username, pontos: p, posicao })) : null,
          ultima: resultados.length ? resultados[resultados.length - 1].pilotos.map(({ userId, username, tempoMs, posicao }) => ({ userId, username, tempoMs, posicao })) : null,
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
          const ehItem = d.tipo === 'repolho' || d.tipo === 'repolho-roxo' || d.tipo === 'lama' || (ITENS_DO_KART as readonly unknown[]).includes(d.tipo);
          if (ehItem) {
            if (p.tempoMs !== null || !numero(d.n) || (d.n as number) < 0) return null;
            // não mais itens que as caixas da pista dão (uma fileira por volta, cada uma), nem dois no mesmo segundo
            const maximo = (PISTAS[corridas[indice]]?.caixas ?? 2) * VOLTAS + 1;
            if (p.itens >= maximo || agora() - p.ultimoItem < 1000) return null;
            // O ITEM SAI DE PERTO DE QUEM O USA (revisão de 03/11/2026: pelo console, a lama caía na frente do líder): perto da
            // última posição que a pessoa mandou, e no mesmo segundo dela
            const u = p.ultima;
            if (!u || Math.abs((d.n as number) - u.n) > 60) return null;
            const id = `${quem}-${Math.round(d.n as number)}`;
            const n = Math.round(d.n as number);
            if (d.tipo === 'repolho' || d.tipo === 'repolho-roxo') {
              if (!numero(d.s) || !numero(d.lado) || Math.abs(d.lado as number) > 60 || (d.s as number) < 0 || (d.s as number) > 20000) return null;
              const comprimento = PISTAS[corridas[indice]]?.comprimento ?? 3000;
              if (distanciaNaVolta(d.s as number, (u.andou % 1) * comprimento, comprimento) > 80) return null;
              // o alvo do roxo é alguém desta corrida, que não quem o soltou (ou ninguém)
              const alvo = d.tipo === 'repolho-roxo' && typeof d.alvo === 'number' && d.alvo !== quem && pilotos.has(d.alvo) ? d.alvo : null;
              p.itens++;
              p.ultimoItem = agora();
              if (d.tipo === 'repolho') {
                itensDaCorrida.set(id, { tipo: 'repolho', dono: quem, n, s: d.s as number });
                return { tipo: 'repolho', id, dono: quem, n, s: d.s, lado: d.lado };
              }
              itensDaCorrida.set(id, { tipo: 'repolho-roxo', dono: quem, n, s: d.s as number, alvo });
              return { tipo: 'repolho-roxo', id, dono: quem, n, s: d.s, lado: d.lado, alvo };
            }
            if (d.tipo !== 'lama') {
              // a alface, a toca e o regador: o servidor só carimba o dono e conta (o efeito é em quem usa, ou quem leva decide)
              const tipo = d.tipo as (typeof ITENS_DO_KART)[number];
              p.itens++;
              p.ultimoItem = agora();
              itensDaCorrida.set(id, { tipo, dono: quem, n });
              return { tipo, id, dono: quem, n };
            }
            if (!numero(d.x) || !numero(d.y) || (d.x as number) < 0 || (d.y as number) < 0 || (d.x as number) > 1024 || (d.y as number) > 1024) return null;
            if (Math.hypot((d.x as number) - u.x, (d.y as number) - u.y) > 30) return null;
            p.itens++;
            p.ultimoItem = agora();
            itensDaCorrida.set(id, { tipo: 'lama', dono: quem, n, x: d.x as number, y: d.y as number });
            return { tipo: 'lama', id, dono: quem, n, x: d.x, y: d.y };
          }
          if (d.tipo === 'gastou') {
            // o escudo de alface segurou um item e acabou: só o dono do escudo diz isso, uma vez
            if (typeof d.id !== 'string') return null;
            const escudo = itensDaCorrida.get(d.id);
            if (!escudo || escudo.tipo !== 'alface' || escudo.dono !== quem || itensQueAcertaram.has(d.id)) return null;
            itensQueAcertaram.add(d.id);
            return { tipo: 'gastou', id: d.id };
          }
          if (d.tipo === 'acertou') {
            // quem foi atingido avisa, para o item sumir para todos
            if (typeof d.id !== 'string' || itensQueAcertaram.has(d.id) || p.acertos >= 40) return null;
            const item = itensDaCorrida.get(d.id);
            if (!item || (item.tipo !== 'repolho' && item.tipo !== 'repolho-roxo' && item.tipo !== 'lama')) return null;
            // E SÓ QUEM PODIA TER SIDO ATINGIDO (revisão independente, 03/11/2026: um script que respondia "acertou" a todo
            // item sumia com todos): não o dono, e só quem estava perto do item, pela última posição aceita dele. O site
            // manda a posição a cada 4 passos, antes de conferir os itens, então ela é de no máximo 3 passos antes do acerto.
            const u = p.ultima;
            if (item.dono === quem || !u) return null;
            if (item.tipo === 'lama') {
              if (u.n < item.n - AMOSTRA_DA_POSICAO || u.n - item.n > VIDA_DA_LAMA + AMOSTRA_DA_POSICAO) return null;
              if (Math.hypot(u.x - item.x, u.y - item.y) > PERTO_DA_LAMA) return null;
            } else {
              // o roxo com alvo só pega o alvo
              if (item.tipo === 'repolho-roxo' && item.alvo !== null && item.alvo !== quem) return null;
              const roxo = item.tipo === 'repolho-roxo';
              if (u.n < item.n - AMOSTRA_DA_POSICAO || u.n - item.n > (roxo ? VIDA_DO_ROXO : VIDA_DO_REPOLHO) + AMOSTRA_DA_POSICAO) return null;
              const comprimento = PISTAS[corridas[indice]]?.comprimento ?? 3000;
              const onde = item.s + ((roxo ? VELOCIDADE_DO_ROXO : VELOCIDADE_DO_REPOLHO) * Math.max(0, u.n - item.n)) / 60;
              if (distanciaNaVolta(onde, (u.andou % 1) * comprimento, comprimento) > PERTO_DO_REPOLHO) return null;
            }
            p.acertos++;
            itensQueAcertaram.add(d.id);
            return { tipo: 'acertou', id: d.id };
          }
          const { x, y, a, n, andou } = d;
          if (![x, y, a, n, andou].every(numero)) return null;
          if ((x as number) < 0 || (y as number) < 0 || (x as number) > 1024 || (y as number) > 1024) return null;
          if ((andou as number) < 0 || (andou as number) > VOLTAS) return null;
          if (!posicaoPossivel(p, x as number, y as number, n as number, andou as number)) return null;
          if (p.tempoMs === null) p.andou = andou as number;
          p.ultima = { x: x as number, y: y as number, n: n as number, andou: andou as number, em: agora() };
          return { userId: quem, x, y, a, n, andou };
        },
        conferir,
      };
    },
  };
}
