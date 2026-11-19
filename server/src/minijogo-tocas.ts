/**
 * TOCAS E TORRES (05/11/2026; o servidor que refaz e a sala em 19/11/2026): estratégia em tempo real, SÓ A MECÂNICA do gênero.
 *
 * A SIMULAÇÃO É UMA SÓ, EM DUAS CÓPIAS IGUAIS BYTE A BYTE (server/src/tocas/sim.ts ↔ web/src/tocas/sim.ts, e o computador
 * adversário, tocas/ia.ts ↔ web/src/tocas/ia.ts; o teste confere): determinística, em passos fixos de 1/10 s, só + − × ÷ e raiz.
 *
 * NO SOLO, o computador de quem joga anda a partida (sem esperar a rede), e manda os SEUS comandos ao servidor em TRECHOS, cada
 * um com o passo em que entrou; o servidor REFAZ a partida com a mesma semente e o mesmo computador adversário (o nível
 * escolhido), e o fim é o dele. Um trecho sai sempre do último passo que o servidor confirmou (`confirmado`), então um trecho
 * perdido é só mandado de novo. De tempos em tempos vem junto a assinatura do estado da tela; se ela não bate com a do servidor,
 * a partida segue, mas não vale recorde. O RECORDE (a tabela comum do Solo, variante = o nível) é o tempo da vitória, e só com a
 * partida refeita aqui: o número do navegador nunca entra.
 *
 * NA SALA (1×1), "LOCKSTEP": a partida anda nos dois computadores, e só os COMANDOS passam pela rede. O tempo é cortado em TURNOS
 * de 2 passos (200 ms); o que alguém manda no turno k vale no turno k + 3 (600 ms depois), o que esconde os ~200 ms de ida e
 * volta até a Alemanha. Cada um manda a sua parte de cada turno (mesmo vazia); o servidor junta as duas, anda a SUA cópia da
 * partida e difunde o turno a quem está na sala, que só anda o turno quando o tem. Por isso ninguém fica à frente: se alguém some
 * (a janela escondida, a internet que cai), a partida PARA para os dois, e o servidor avisa de quem é a espera. Quem saiu da sala
 * por 1 minuto perde; parada por 5 minutos, a partida acaba sem troféu.
 * A cada 25 turnos (5 s), cada computador manda a assinatura do estado; diferente da do servidor é DESSINCRONIA: na primeira, ele
 * manda aquele computador refazer a partida a partir dos turnos guardados; na segunda, a partida acaba sem troféu. Quem ganhou é
 * sempre o que a cópia do servidor diz, e o pódio vai à estante de troféus (pista 'tocas').
 * O que sobra possível no lockstep: um programa que mostre o mapa todo (a névoa é da tela; a partida inteira está no computador
 * de cada um), e um programa que jogue sozinho.
 */
import * as db from './db.js';
import type { Contexto, Definicao } from './minijogo-motor.js';
import { criarIA, NIVEIS, PERFIS, type IA, type Nivel } from './tocas/ia.js';
import { assinatura, comandar, limparComando, MAPAS, novaPartida, passo, pontos, type Amostra, type Comando, type Dono, type Motivo, type Sim, type TipoDoMapa } from './tocas/sim.js';

/** Os números da simulação (tocas/sim.ts). */
export const PASSOS_POR_SEGUNDO = 10;
export const PASSOS_MAX = 20 * 60 * PASSOS_POR_SEGUNDO;
/** Menos que isto (4 minutos) não dá para derrubar o centro de ninguém (o fim declarado pela tela, quando não bate com o servidor). */
export const VITORIA_MIN_PASSOS = 4 * 60 * PASSOS_POR_SEGUNDO;
/** A rede e a largada: os passos podem chegar um tico à frente do relógio do servidor. */
export const FOLGA_DO_RELOGIO_MS = 3000;
/** Ninguém volta: a partida fecha sozinha depois disto (a pausa da janela sem foco tem esse tanto). */
export const PRAZO_MS = 90 * 60_000;
/** O maior trecho do Solo (2 minutos de jogo): o servidor anda isso de uma vez, no máximo. */
export const MAIOR_TRECHO = 1200;

/** A sala: o turno, o atraso dos comandos, de quanto em quanto se confere a assinatura. */
export const PASSOS_POR_TURNO = 2;
export const ATRASO_TURNOS = 3;
export const HASH_CADA_TURNOS = 25;
export const MAX_COMANDOS_POR_TURNO = 30;
/** Fora da sala por tanto tempo, perde. */
export const AUSENCIA_MS = 60_000;
/** Turno nenhum por tanto tempo: a partida acaba, sem troféu. */
export const PARADA_MS = 5 * 60_000;
/** Turno nenhum por tanto tempo: o servidor diz de quem é a espera. */
export const ESPERA_MS = 2500;

export type MotivoDoFim = Motivo | 'desistiu' | 'saiu' | 'desencontro' | 'parou';

export interface Resultado {
  venceu: boolean;
  motivo: MotivoDoFim;
  passos: number;
  /** A partida refeita pelo servidor bateu com a tela do começo ao fim (só assim vale recorde). */
  conferido: boolean;
  historico: Amostra[];
  recorde?: { antes: number | null; novo: boolean } | null;
}

export const tocas: Definicao = criarTocas();

const ehNivel = (v: unknown): v is Nivel => typeof v === 'string' && (NIVEIS as string[]).includes(v);
const ehMapa = (v: unknown): v is TipoDoMapa => typeof v === 'string' && (MAPAS as string[]).includes(v);

export function criarTocas({ agora = Date.now, sorteio = Math.random }: { agora?: () => number; sorteio?: () => number } = {}): Definicao {
  return {
    minimo: 2,
    maximo: 2,
    comecar(ctx, { naSala, corpo }) {
      if (ctx.solo) {
        if (naSala.length !== 1) return 'Este jogo não se joga na sala.';
        return solo(ctx, naSala[0], agora, sorteio);
      }
      if (naSala.length !== 2) return 'Tocas e Torres na sala é de duas pessoas.';
      return sala(ctx, naSala as [number, number], ehMapa(corpo.mapa) ? corpo.mapa : null, agora, sorteio);
    },
  };
}

// =====================================================================================================================
// O SOLO
// =====================================================================================================================

function solo(ctx: Contexto, quem: number, agora: () => number, sorteio: () => number) {
  const semente = Math.floor(sorteio() * 0x7fffffff) + 1;
  const partidaId = `tocas-${quem}-${agora()}`;
  let fase: 'escolha' | 'jogando' | 'fim' = 'escolha';
  let resultado: Resultado | null = null;
  let nivel: Nivel = 'normal';
  let mapa: TipoDoMapa = 'campo';
  let tutorial = false;
  let inicio = 0;
  let sim: Sim | null = null;
  let ia: IA | null = null;
  /** Alguma assinatura da tela não bateu (ou um fim declarado que o servidor não viu): sem recorde. */
  let desencontro = false;

  ctx.agendar(PRAZO_MS, () => {
    if (fase === 'fim') return;
    fase = 'fim';
    ctx.terminar(false);
  });

  const fechar = (r: Omit<Resultado, 'historico' | 'recorde'>) => {
    let recorde: Resultado['recorde'] = null;
    if (r.conferido && r.venceu && !tutorial) recorde = db.guardarRecordeDoSolo(quem, 'tocas', nivel, r.passos * 100, true, { mapa });
    resultado = { ...r, historico: sim?.historico ?? [], recorde };
    fase = 'fim';
    ctx.avisar();
    ctx.terminar(true);
  };

  return {
    publico() {
      const recordes: Record<string, number> = {};
      for (const r of db.recordesDoSolo(quem, 'tocas')) recordes[r.variante] = r.valor;
      return {
        fase,
        sala: false,
        semente,
        mapa,
        nivel,
        tutorial,
        partidaId,
        resultado,
        passosMax: PASSOS_MAX,
        confirmado: sim?.passo ?? 0,
        recordes,
      };
    },
    acao(autor: number, corpo: Record<string, unknown>) {
      if (autor !== quem) return 'Você está assistindo esta partida.';
      if (fase === 'fim') return 'Esta rodada já acabou.';
      if (corpo.tipo === 'comecar') {
        if (fase !== 'escolha') return null;
        tutorial = corpo.tutorial === true;
        nivel = tutorial ? 'facil' : ehNivel(corpo.nivel) ? corpo.nivel : 'normal';
        mapa = tutorial ? 'campo' : ehMapa(corpo.mapa) ? corpo.mapa : MAPAS[Math.floor(sorteio() * MAPAS.length)];
        sim = novaPartida(semente, { mapa });
        ia = criarIA(1, tutorial ? PERFIS.tutorial : PERFIS[nivel]);
        inicio = agora();
        fase = 'jogando';
        ctx.avisar();
        return null;
      }
      if (fase !== 'jogando' || !sim || !ia) return 'A partida ainda não começou.';
      const passos = corpo.passos;
      if (corpo.tipo === 'desistir') {
        if (typeof passos !== 'number' || !Number.isInteger(passos) || passos < 0 || passos > PASSOS_MAX) return 'Sessão inválida.';
        fechar({ venceu: false, motivo: 'desistiu', passos, conferido: false });
        return null;
      }
      if (corpo.tipo !== 'trecho') return 'Ação desconhecida.';
      const { de, ate, lote } = corpo;
      if (!Number.isInteger(de) || !Number.isInteger(ate) || !Array.isArray(lote)) return 'Sessão inválida.';
      // um trecho que não começa onde o servidor parou (repetido, ou depois de um perdido): o site manda de novo do confirmado
      if (de !== sim.passo) return null;
      if ((ate as number) <= (de as number) || (ate as number) > (de as number) + MAIOR_TRECHO || (ate as number) > PASSOS_MAX + 1) return 'Sessão inválida.';
      // a janela sem foco pausa a partida (mais tempo), mas ninguém anda mais passos do que o relógio deixou
      if (((ate as number) / PASSOS_POR_SEGUNDO) * 1000 > agora() - inicio + FOLGA_DO_RELOGIO_MS) return 'Sessão inválida.';
      if (lote.length > 4000) return 'Sessão inválida.';
      const cmds: { p: number; c: Comando }[] = [];
      let ultimo = de as number;
      for (const item of lote) {
        if (!Array.isArray(item) || item.length !== 2 || !Number.isInteger(item[0])) return 'Sessão inválida.';
        const p = item[0] as number;
        if (p < ultimo || p >= (ate as number)) return 'Sessão inválida.';
        ultimo = p;
        const c = limparComando(item[1]);
        if (c) cmds.push({ p, c });
      }
      let k = 0;
      while (sim.passo < (ate as number) && sim.vencedor === null) {
        while (k < cmds.length && cmds[k].p === sim.passo) comandar(sim, 0, cmds[k++].c);
        // o que ficou para depois do fim não entra
        ia(sim);
        passo(sim);
      }
      if (typeof corpo.h === 'string' && sim.passo === ate && assinatura(sim) !== corpo.h) desencontro = true;
      if (sim.vencedor !== null) {
        fechar({ venceu: sim.vencedor === 0, motivo: sim.motivo!, passos: sim.passo, conferido: !desencontro });
        return null;
      }
      // a tela diz que acabou, e o servidor não viu o fim: vale o que ela diz com o bom senso de antes, sem recorde
      const fim = corpo.fim as Record<string, unknown> | undefined;
      if (fim && typeof fim === 'object' && sim.passo === ate) {
        const motivo = fim.motivo;
        if (motivo !== 'centro' && motivo !== 'maravilha' && motivo !== 'tempo') return 'Sessão inválida.';
        if (typeof fim.venceu !== 'boolean') return 'Sessão inválida.';
        if (fim.venceu && sim.passo < VITORIA_MIN_PASSOS) return 'Sessão inválida.';
        if (motivo === 'tempo' && sim.passo < PASSOS_MAX - 1) return 'Sessão inválida.';
        desencontro = true;
        fechar({ venceu: fim.venceu, motivo, passos: sim.passo, conferido: false });
      }
      return null;
    },
  };
}

// =====================================================================================================================
// A SALA (lockstep)
// =====================================================================================================================

function sala(ctx: Contexto, jogadores: [number, number], mapaPedido: TipoDoMapa | null, agora: () => number, sorteio: () => number) {
  const semente = Math.floor(sorteio() * 0x7fffffff) + 1;
  const mapa: TipoDoMapa = mapaPedido ?? MAPAS[Math.floor(sorteio() * MAPAS.length)];
  const inicio = agora();
  const partidaId = `tocas-sala-${ctx.comunidade ?? 0}-${inicio}`;
  const sim = novaPartida(semente, { mapa });
  let fase: 'jogando' | 'fim' = 'jogando';
  let fim: { vencedor: Dono | null; motivo: MotivoDoFim } | null = null;
  /** O próximo turno que o servidor resolve, e o próximo que cada um deve mandar. */
  let resolvido = 0;
  const proximo: [number, number] = [ATRASO_TURNOS, ATRASO_TURNOS];
  const entradas = new Map<number, [Comando[] | null, Comando[] | null]>();
  /** Os turnos com algum comando (para quem recarrega a página refazer a partida): [turno, os do 0, os do 1]. */
  const turnos: [number, Comando[], Comando[]][] = [];
  const hashes = new Map<number, string>();
  const falhas: [number, number] = [0, 0];
  const ausente: [number | null, number | null] = [null, null];
  let ultimoTurnoEm = inicio;
  let espera: Dono[] = [];

  const anda = (k: number, c0: Comando[], c1: Comando[]) => {
    for (const c of c0) comandar(sim, 0, c);
    for (const c of c1) comandar(sim, 1, c);
    for (let i = 0; i < PASSOS_POR_TURNO && sim.vencedor === null; i++) passo(sim);
    if (c0.length || c1.length) turnos.push([k, c0, c1]);
  };
  // os primeiros turnos (o atraso) são vazios para todo mundo: ninguém mandou nada ainda
  for (; resolvido < ATRASO_TURNOS; resolvido++) {
    if (resolvido % HASH_CADA_TURNOS === 0) hashes.set(resolvido, assinatura(sim));
    anda(resolvido, [], []);
  }

  const terminar = (vencedor: Dono | null, motivo: MotivoDoFim) => {
    if (fase === 'fim') return;
    fase = 'fim';
    fim = { vencedor, motivo };
    const aqui = new Set(ctx.naSala());
    const ficaram = jogadores.every((id) => aqui.has(id));
    // O PÓDIO: com os dois até o fim, e uma partida que acabou de verdade (nem abandono, nem dessincronia, nem parada)
    if (vencedor !== null && ficaram && motivo !== 'saiu' && motivo !== 'desencontro' && motivo !== 'parou') {
      for (const d of [0, 1] as Dono[]) {
        db.guardarTrofeu({
          userId: jogadores[d],
          evento: partidaId,
          communityId: ctx.comunidade ?? 0,
          pista: 'tocas',
          posicao: d === vencedor ? 1 : 2,
          tempoMs: sim.passo * 100,
          pontos: pontos(sim, d),
          rivais: [jogadores[1 - d]],
        });
      }
    }
    ctx.difundir?.({ tocas: 'fim' });
    ctx.avisar();
    ctx.terminar(true);
  };

  const resolver = () => {
    for (;;) {
      const e = entradas.get(resolvido);
      if (!e || !e[0] || !e[1] || fase !== 'jogando') return;
      entradas.delete(resolvido);
      anda(resolvido, e[0], e[1]);
      ctx.difundir?.({ tocas: 'turno', k: resolvido, c: [e[0], e[1]] });
      resolvido++;
      ultimoTurnoEm = agora();
      if (resolvido % HASH_CADA_TURNOS === 0) {
        hashes.set(resolvido, assinatura(sim));
        hashes.delete(resolvido - HASH_CADA_TURNOS * 20);
      }
      if (sim.vencedor !== null) return terminar(sim.vencedor, sim.motivo!);
    }
  };

  // o teto de tudo: nenhuma sala fica presa na memória (a partida tem 20 minutos de jogo; a espera, 5 de cada vez)
  ctx.agendar(PRAZO_MS, () => terminar(null, 'parou'));

  const donoDe = (quem: number): Dono | null => (quem === jogadores[0] ? 0 : quem === jogadores[1] ? 1 : null);

  return {
    publico(quem: number) {
      const d = donoDe(quem);
      const resultado: (Resultado & { vencedor: Dono | null }) | null = fim
        ? {
            venceu: d !== null && fim.vencedor === d,
            vencedor: fim.vencedor,
            motivo: fim.motivo,
            passos: sim.passo,
            conferido: true,
            historico: sim.historico,
          }
        : null;
      return {
        fase,
        sala: true,
        semente,
        mapa,
        partidaId,
        resultado,
        passosMax: PASSOS_MAX,
        eu: d,
        jogadores: jogadores.map((id) => ({ userId: id, username: ctx.nome(id) })),
        passosPorTurno: PASSOS_POR_TURNO,
        atraso: ATRASO_TURNOS,
        hashCada: HASH_CADA_TURNOS,
        resolvido,
        meuProximo: d === null ? null : proximo[d],
        turnos: fase === 'jogando' && d !== null ? turnos : [],
        espera,
      };
    },
    acao(quem: number, corpo: Record<string, unknown>) {
      const d = donoDe(quem);
      if (d === null) return 'Você está assistindo esta partida.';
      if (fase !== 'jogando') return 'Esta rodada já acabou.';
      // recarregou ou se perdeu: o estado (com os turnos) vai na resposta
      if (corpo.tipo === 'turnos') return null;
      if (corpo.tipo === 'desistir') {
        terminar((1 - d) as Dono, 'desistiu');
        return null;
      }
      return 'Ação desconhecida.';
    },
    /** A parte de alguém num turno: { k, c: os comandos, h e hk: a assinatura do começo do turno hk }. */
    tempoReal(quem: number, dados: unknown) {
      const d = donoDe(quem);
      if (d === null || fase !== 'jogando' || !dados || typeof dados !== 'object') return null;
      const { k, c, h, hk } = dados as Record<string, unknown>;
      if (!Number.isInteger(k) || k !== proximo[d] || !Array.isArray(c) || c.length > MAX_COMANDOS_POR_TURNO) return null;
      // ninguém manda turnos mais depressa que o relógio (a partida anda no ritmo de quem está mais devagar)
      if ((((k as number) - ATRASO_TURNOS) * PASSOS_POR_TURNO * 1000) / PASSOS_POR_SEGUNDO > agora() - inicio + 5000) return null;
      const limpos = c.map(limparComando).filter((x): x is Comando => x !== null);
      const e = entradas.get(k as number) ?? [null, null];
      e[d] = limpos;
      entradas.set(k as number, e);
      proximo[d]++;
      if (typeof h === 'string' && Number.isInteger(hk)) {
        const meu = hashes.get(hk as number);
        if (meu !== undefined && meu !== h) {
          falhas[d]++;
          if (falhas[d] >= 2) {
            terminar(null, 'desencontro');
            return null;
          }
          ctx.difundir?.({ tocas: 'ressincronizar', dono: d });
        }
      }
      resolver();
      return null;
    },
    conferir() {
      if (fase !== 'jogando') return;
      const t = agora();
      const aqui = new Set(ctx.naSala());
      for (const d of [0, 1] as Dono[]) {
        if (aqui.has(jogadores[d])) ausente[d] = null;
        else ausente[d] ??= t;
        const fora = ausente[d];
        if (fora !== null && t - fora > AUSENCIA_MS) return terminar((1 - d) as Dono, 'saiu');
      }
      if (t - ultimoTurnoEm > PARADA_MS) return terminar(null, 'parou');
      const agoraEspera = t - ultimoTurnoEm > ESPERA_MS ? ([0, 1] as Dono[]).filter((d) => proximo[d] <= resolvido) : [];
      if (agoraEspera.join() !== espera.join()) {
        espera = agoraEspera;
        ctx.difundir?.({ tocas: 'espera', donos: espera });
      }
    },
  };
}
