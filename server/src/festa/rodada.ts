/**
 * A RODADA DE UM MICROJOGO DA FESTA (05/11/2026, separada de ../minijogo-festa.ts): o "prepare-se", o eco da rede, o jogo, a
 * conferência e a revelação, iguais para todos os microjogos (cada um em ./<id>.ts, juntos em ./registro.ts, onde está o guia).
 * Serve à Festa e ao Tabuleiro da turma. Não toca no banco: os testes a montam sem servidor (server/test/festa-ajuda.ts).
 */
import {
  ATRASO_MAXIMO,
  ECOS_POR_RODADA,
  FOLGA_ACIMA,
  FOLGA_DA_REDE,
  PREPARO_MS,
  REVELACAO_MS,
  type MicrojogoDoServidor,
  type Resultado,
} from './comum.js';
import * as registro from './registro.js';
import type { Contexto } from '../minijogo-motor.js';

/** Os microjogos pelo id (festa/registro.ts). */
const POR_ID = new Map<string, MicrojogoDoServidor<unknown, unknown>>(
  Object.values(registro).map((m) => [m.id, m as unknown as MicrojogoDoServidor<unknown, unknown>]),
);
/** Todos os ids, na ordem do registro: o sorteio da Festa e do Tabuleiro sai daqui. */
export const MICROJOGOS: readonly string[] = [...POR_ID.keys()];
export type Microjogo = string;
export const microjogoDe = (id: string) => {
  const m = POR_ID.get(id);
  if (!m) throw new Error(`microjogo desconhecido: ${id}`);
  return m;
};

export const RODADAS_FESTA = 5;
export const PONTOS_FESTA = [10, 8, 6, 5, 4, 3, 2, 1];

/** Quanto dura o "jogando" de cada um. */
export const duracaoDe = (m: Microjogo, dados: unknown) => microjogoDe(m).duracao(dados);
/** Sorteia os dados de um microjogo. `aleatorio` é trocável para o teste. */
export const gerarDados = (m: Microjogo, aleatorio: () => number) => microjogoDe(m).gerar(aleatorio);

/** O que alguém viu numa rodada, para a tela: a ordem e os pontos. */
export interface LinhaDaRodada {
  userId: number;
  username: string;
  valor: number | null;
  motivo: 'cedo' | 'errou' | 'invalido' | 'nada' | null;
  posicao: number | null;
  pontos: number;
}

/**
 * UMA RODADA DE MICROJOGO, sozinha (03/11/2026): o "prepare-se", o jogo e a revelação, com toda a conferência. A Festa
 * encadeia cinco; o Tabuleiro da turma (minijogo-tabuleiro-da-turma.ts) joga uma entre as rodadas do tabuleiro. Ela usa o
 * relógio do contexto (um só): enquanto ela corre, quem a chamou não marca outro. O que é de cada microjogo mora em festa/.
 */
export interface RodadaDeFesta {
  readonly microjogo: Microjogo;
  /** O que `quem` vê desta rodada. */
  publico(quem: number): {
    fase: 'preparando' | 'jogando' | 'revelando';
    /** A medida da rede: o site devolve este número na hora, pela ação 'eco' (só no "prepare-se"). */
    eco: number | null;
    microjogo: Microjogo;
    dados: unknown;
    duracaoMs: number;
    /** Jogando: há quanto o jogo começou, no relógio do servidor (quem chega no meio, ou recarrega, acerta o começo por ele). */
    jogandoHaMs: number | null;
    sinal: boolean;
    meu: { motivo: Resultado['motivo']; valor: number | null } | null;
    prontos: number[];
    resposta: number | null;
    linhas: LinhaDaRodada[] | null;
  };
  /** 'resultado', 'acerto' ou 'eco' de um inscrito (as mesmas mensagens de erro da Festa; o 'eco' nunca dá erro). */
  acao(quem: number, corpo: Record<string, unknown>): string | null;
  /** Alguém pode ter saído: a rodada que só esperava essa pessoa revela. */
  conferir(): void;
}

export interface OpcoesDaRodada {
  ctx: Pick<Contexto, 'agendar' | 'avisar' | 'naSala' | 'nome'>;
  microjogo: Microjogo;
  /** Quem joga (os que não estão na sala na hora não seguram ninguém, e não aparecem na revelação). */
  inscritos: number[];
  agora: () => number;
  aleatorio: () => number;
  /** Os pontos pela posição (empatados dividem a posição e os pontos dela). */
  pontos: number[];
  /** Na revelação: as linhas (com os pontos de cada um) e quem estava na sala naquela hora. */
  aoRevelar?: (linhas: LinhaDaRodada[], presentes: Set<number>) => void;
  /** Depois da revelação. */
  aoAcabar: () => void;
  /**
   * Os inscritos que são do computador (o Tabuleiro da turma no Solo, 05/11/2026). Eles não seguram a rodada: o resultado
   * deles é sorteado na revelação (`resultadoDoRobo`), e só ela espera a pessoa.
   */
  robos?: number[];
}

/**
 * O RESULTADO DE UM ROBÔ num microjogo: sorteado numa faixa de quem joga bem, mas não perfeito (cada microjogo diz a dele, em
 * festa/<id>.ts). O robô não vê a tela: o servidor só inventa um resultado plausível, sem precisar de conferência.
 */
export function resultadoDoRobo(m: Microjogo, dados: unknown, aleatorio: () => number, passouMs = Infinity): Resultado {
  return microjogoDe(m).robo(dados, aleatorio, passouMs);
}

export function rodadaDeFesta({ ctx, microjogo: m, inscritos, agora, aleatorio, pontos, aoRevelar, aoAcabar, robos = [] }: OpcoesDaRodada): RodadaDeFesta {
  const micro = microjogoDe(m);
  let fase: 'preparando' | 'jogando' | 'revelando' = 'preparando';
  const dados = micro.gerar(aleatorio);
  const mem = micro.memoria?.(dados);
  let inicio = 0;
  const resultados = new Map<number, Resultado>();
  let linhas: LinhaDaRodada[] | null = null;

  /**
   * A REDE DE CADA UM (revisão independente, 03/11/2026): os ecos mandados no "prepare-se" (o número e quando saiu), quantos
   * voltaram, e a menor ida e volta vista.
   */
  const ecosMandados = new Map<number, Map<number, number>>();
  const ecosVoltaram = new Map<number, number>();
  const idaEVolta = new Map<number, number>();
  let proximoEco = 1;
  /** O que o tempo honesto de `quem` pode ficar abaixo do que o servidor viu passar. */
  const folgaParaBaixo = (quem: number) => Math.min(idaEVolta.get(quem) ?? ATRASO_MAXIMO, ATRASO_MAXIMO) + FOLGA_DA_REDE;

  /** O instante marcado para o jogo começar: é dele que o site conta (o restanteMs do relógio da partida), e não de quando o
   * relógio do servidor de fato disparou, que pode atrasar uns milissegundos. */
  const comecaEm = agora() + PREPARO_MS;

  const jogar = () => {
    fase = 'jogando';
    inicio = Math.min(comecaEm, agora());
    if (micro.iniciar) micro.iniciar({ dados, mem, agora, aleatorio, agendar: ctx.agendar, avisar: ctx.avisar, revelar });
    else ctx.agendar(micro.duracao(dados), revelar);
    ctx.avisar();
  };

  const revelar = () => {
    if (fase !== 'jogando') return;
    const presentes = new Set([...ctx.naSala(), ...robos]);
    // os robôs (o Solo): o resultado deles sai agora, junto com o de quem joga
    for (const id of robos) if (!resultados.has(id)) resultados.set(id, micro.robo(dados, aleatorio, agora() - inicio));
    // quem jogou ao vivo e não chegou a mandar o fim conta pelo que o servidor viu
    if (micro.noFim) {
      for (const [userId, r] of micro.noFim({ dados, mem, inscritos })) if (!resultados.has(userId)) resultados.set(userId, r);
    }
    const validos = [...resultados.entries()].filter(([, r]) => r.motivo === null);
    const menor = (a: number[], b: number[]) => {
      for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
      return 0;
    };
    validos.sort(([, a], [, b]) => menor(a.chave, b.chave));
    const nova: LinhaDaRodada[] = validos.map(([userId, r]) => {
      // empatados dividem a posição (e os pontos dela)
      const posicao = 1 + validos.filter(([, o]) => menor(o.chave, r.chave) < 0).length;
      const p = pontos[posicao - 1] ?? 0;
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
    aoRevelar?.(nova, presentes);
    ctx.agendar(REVELACAO_MS, aoAcabar);
    ctx.avisar();
  };

  const todosResponderam = () => {
    // os robôs não seguram a rodada (o resultado deles sai na revelação)
    const presentes = ctx.naSala().filter((id) => inscritos.includes(id) && !robos.includes(id));
    return presentes.every((id) => resultados.has(id));
  };

  const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

  /** O relógio do servidor e a folga da rede de `quem`, para o microjogo conferir. */
  const conferencia = (quem: number, corpo: Record<string, unknown>) => {
    const agoraMs = agora();
    const passou = agoraMs - inicio;
    const abaixo = folgaParaBaixo(quem);
    return {
      dados,
      mem,
      quem,
      corpo,
      agora: agoraMs,
      passou,
      abaixo,
      /** O tempo dito (desde o começo) cabe no que o servidor viu: nunca depois, e antes no máximo a rede da pessoa. */
      cabe: (t: number) => t <= passou + FOLGA_ACIMA && t >= passou - abaixo,
    };
  };

  // o "prepare-se": o nome e a instrução na tela
  ctx.agendar(PREPARO_MS, jogar);
  ctx.avisar();

  return {
    microjogo: m,
    publico(quem) {
      const meu = resultados.get(quem);
      const vista = micro.vista?.({ dados, mem, quem, fase, agora: agora(), passou: fase === 'jogando' ? agora() - inicio : 0 }) ?? {};
      // o eco do "prepare-se": um número novo a cada estado, até ECOS_POR_RODADA voltarem (o site devolve na hora)
      let eco: number | null = null;
      if (fase === 'preparando' && inscritos.includes(quem) && (ecosVoltaram.get(quem) ?? 0) < ECOS_POR_RODADA) {
        eco = proximoEco++;
        const meus = ecosMandados.get(quem) ?? new Map<number, number>();
        meus.set(eco, agora());
        // só os últimos poucos (quem busca o estado muitas vezes não enche a memória)
        if (meus.size > 8) meus.delete(meus.keys().next().value!);
        ecosMandados.set(quem, meus);
      }
      return {
        eco,
        fase,
        microjogo: m,
        // o que só pode ser visto na hora (a próxima figura da flor) o microjogo tira daqui
        dados: 'dados' in vista ? vista.dados : dados,
        duracaoMs: micro.duracao(dados),
        jogandoHaMs: fase === 'jogando' ? agora() - inicio : null,
        sinal: vista.sinal ?? false,
        meu: meu ? { motivo: meu.motivo, valor: meu.valor } : null,
        prontos: [...resultados.keys()],
        resposta: vista.resposta ?? null,
        linhas: fase === 'revelando' ? linhas : null,
      };
    },
    acao(quem, corpo) {
      if (corpo.tipo === 'eco') {
        // a medida da rede: nunca é erro (o eco que chega tarde, ou repetido, só não conta)
        const em = numero(corpo.eco) ? ecosMandados.get(quem)?.get(corpo.eco) : undefined;
        if (em === undefined || fase !== 'preparando') return null;
        ecosMandados.get(quem)!.delete(corpo.eco as number);
        ecosVoltaram.set(quem, (ecosVoltaram.get(quem) ?? 0) + 1);
        idaEVolta.set(quem, Math.min(idaEVolta.get(quem) ?? Infinity, agora() - em));
        return null;
      }
      if (corpo.tipo !== 'resultado' && corpo.tipo !== 'acerto') return 'Ação desconhecida.';
      if (!inscritos.includes(quem)) return 'Você está assistindo esta partida.';
      if (fase !== 'jogando') return 'Esta rodada já acabou.';
      if (corpo.tipo === 'acerto') {
        // a ação AO VIVO (cada alvo, cada praga, cada pulo): conferida na hora pelo microjogo; a que não vale só não conta
        if (micro.acerto && !resultados.has(quem)) micro.acerto(conferencia(quem, corpo));
        return null;
      }
      // o primeiro resultado é o que vale (o Enter apertado duas vezes não troca nada)
      if (resultados.has(quem)) return null;
      resultados.set(quem, micro.avaliar(conferencia(quem, corpo)));
      if (todosResponderam()) revelar();
      else ctx.avisar();
      return null;
    },
    conferir() {
      if (fase === 'jogando' && todosResponderam()) revelar();
    },
  };
}
