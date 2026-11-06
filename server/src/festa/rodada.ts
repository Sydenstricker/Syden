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
  MENSAGENS_AO_VIVO_POR_S,
  REVELACAO_MS,
  type MicrojogoDoServidor,
  type Resultado,
  type Turma,
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
/** Os microjogos que cabem numa partida de `jogadores` (robôs inclusive): o empurra-empurra pede 2 ou mais. */
export const microjogosPara = (jogadores: number) => MICROJOGOS.filter((id) => (microjogoDe(id).minimo ?? 1) <= jogadores);
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
  /** A equipe (o índice em `equipes`), no microjogo de equipes. */
  equipe?: number;
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
    /** As equipes (lote 5), no microjogo de equipes; senão null. */
    equipes: number[][] | null;
  };
  /** 'resultado', 'acerto' ou 'eco' de um inscrito (as mesmas mensagens de erro da Festa; o 'eco' nunca dá erro). */
  acao(quem: number, corpo: Record<string, unknown>): string | null;
  /** Alguém pode ter saído: a rodada que só esperava essa pessoa revela. */
  conferir(): void;
  /**
   * O CANAL AO VIVO (lote 5): o que chega pelo socket ('minijogo:tempo-real'), para o microjogo que tem `aoVivo`. Nunca
   * repassa direto (devolve null): o passo do servidor leva tudo a todos pelo `difundir`. Quem roda a rodada (a Festa, o
   * Tabuleiro) só encaminha.
   */
  tempoReal(quem: number, dados: unknown): null;
  /** A partida saiu da memória: o passo ao vivo para (pode ser chamado mais de uma vez). */
  parar(): void;
}

export interface OpcoesDaRodada {
  ctx: Pick<Contexto, 'agendar' | 'avisar' | 'naSala' | 'nome'> & Partial<Pick<Contexto, 'difundir'>>;
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
  /**
   * O relógio do passo ao vivo (lote 5): chama `fn` a cada `ms` e devolve o "desligar". Padrão: setInterval. O teste o troca
   * por um de mão (server/test/festa-ajuda-aovivo.ts).
   */
  aCada?: (ms: number, fn: () => void) => () => void;
}

const aCadaPadrao = (ms: number, fn: () => void) => {
  const id = setInterval(fn, ms);
  id.unref?.();
  return () => clearInterval(id);
};

/** Monta a turma de uma rodada: as equipes saem do microjogo (se ele tiver), na ordem da inscrição. */
export function turmaDa(micro: MicrojogoDoServidor<unknown, unknown>, jogadores: number[], robos: number[], aleatorio: () => number): Turma {
  const equipes = micro.equipes ? micro.equipes([...jogadores], aleatorio).filter((e) => e.length > 0) : null;
  const de = new Map<number, number>();
  equipes?.forEach((e, i) => e.forEach((id) => de.set(id, i)));
  return { jogadores: [...jogadores], robos: [...robos], equipes, equipeDe: (quem) => de.get(quem) ?? -1 };
}

/**
 * O RESULTADO DE UM ROBÔ num microjogo: sorteado numa faixa de quem joga bem, mas não perfeito (cada microjogo diz a dele, em
 * festa/<id>.ts). O robô não vê a tela: o servidor só inventa um resultado plausível, sem precisar de conferência.
 */
export function resultadoDoRobo(m: Microjogo, dados: unknown, aleatorio: () => number, passouMs = Infinity): Resultado {
  return microjogoDe(m).robo(dados, aleatorio, passouMs);
}

export function rodadaDeFesta({ ctx, microjogo: m, inscritos, agora, aleatorio, pontos, aoRevelar, aoAcabar, robos = [], aCada = aCadaPadrao }: OpcoesDaRodada): RodadaDeFesta {
  const micro = microjogoDe(m);
  let fase: 'preparando' | 'jogando' | 'revelando' = 'preparando';
  // a turma (e as equipes) antes do sorteio: o microjogo de equipes sorteia o campo de cada uma
  const turma = turmaDa(micro, inscritos, robos, aleatorio);
  const dados = micro.gerar(aleatorio, turma);
  const mem = micro.memoria?.(dados, turma);
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

  /** O passo ao vivo (lote 5): ligado só no "jogando" de um microjogo com `aoVivo`. */
  let desligarPasso: (() => void) | null = null;
  let passoN = 0;
  const pararPasso = () => {
    desligarPasso?.();
    desligarPasso = null;
  };
  const darPasso = () => {
    if (fase !== 'jogando' || !micro.aoVivo) return pararPasso();
    const agoraMs = agora();
    const n = passoN++;
    const q = micro.aoVivo.passo({
      dados,
      mem: mem as never,
      turma,
      agora: agoraMs,
      passou: agoraMs - inicio,
      n,
      naSala: () => ctx.naSala().filter((id) => inscritos.includes(id)),
      aleatorio,
      folgaDe: folgaParaBaixo,
      revelar,
      avisar: ctx.avisar,
    });
    // o passo pode ter revelado: o quadro dele ainda vai (o último, com quem caiu)
    if (q !== null && q !== undefined) ctx.difundir?.({ festa: m, n, t: agoraMs - inicio, q });
  };

  const jogar = () => {
    fase = 'jogando';
    inicio = Math.min(comecaEm, agora());
    if (micro.iniciar) micro.iniciar({ dados, mem, turma, agora, aleatorio, agendar: ctx.agendar, avisar: ctx.avisar, revelar });
    else ctx.agendar(micro.duracao(dados), revelar);
    if (micro.aoVivo) desligarPasso = aCada(micro.aoVivo.passoMs, darPasso);
    ctx.avisar();
  };

  const revelar = () => {
    if (fase !== 'jogando') return;
    pararPasso();
    const presentes = new Set([...ctx.naSala(), ...robos]);
    // quem jogou ao vivo e não chegou a mandar o fim conta pelo que o servidor viu (e, no microjogo ao vivo, os robôs que ele
    // mesmo moveu: por isso antes do sorteio dos robôs)
    if (micro.noFim) {
      for (const [userId, r] of micro.noFim({ dados, mem, inscritos, turma })) if (!resultados.has(userId)) resultados.set(userId, r);
    }
    // os robôs (o Solo): o resultado deles sai agora, junto com o de quem joga
    for (const id of robos) if (!resultados.has(id)) resultados.set(id, micro.robo(dados, aleatorio, agora() - inicio));
    if (turma.equipes) {
      linhas = linhasPorEquipe(turma.equipes, presentes);
      fase = 'revelando';
      aoRevelar?.(linhas, presentes);
      ctx.agendar(REVELACAO_MS, aoAcabar);
      ctx.avisar();
      return;
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

  /**
   * A POSIÇÃO POR EQUIPE (lote 5): a equipe vale o melhor resultado de quem está nela; todos dela (na sala) dividem a posição,
   * o valor e os pontos. A equipe sem nenhum resultado que conte fica sem posição, cada um com o seu motivo.
   */
  const linhasPorEquipe = (equipes: number[][], presentes: Set<number>): LinhaDaRodada[] => {
    const menor = (a: number[], b: number[]) => {
      for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
      return 0;
    };
    const melhor = equipes.map((e) => {
      const validos = e.map((id) => resultados.get(id)).filter((r): r is Resultado => !!r && r.motivo === null);
      validos.sort((a, b) => menor(a.chave, b.chave));
      return validos[0] ?? null;
    });
    const ordem = equipes
      .map((_, i) => i)
      .sort((a, b) => {
        const ra = melhor[a];
        const rb = melhor[b];
        if (!ra || !rb) return (ra ? 0 : 1) - (rb ? 0 : 1);
        return menor(ra.chave, rb.chave);
      });
    const nova: LinhaDaRodada[] = [];
    for (const i of ordem) {
      const r = melhor[i];
      const posicao = r ? 1 + equipes.filter((_, j) => melhor[j] && menor(melhor[j]!.chave, r.chave) < 0).length : null;
      const p = posicao ? (pontos[posicao - 1] ?? 0) : 0;
      for (const userId of equipes[i]) {
        if (!presentes.has(userId) && !resultados.has(userId)) continue;
        const proprio = resultados.get(userId);
        // quem não fez nada (sem resultado próprio) não leva os pontos da equipe: aparece com zero, como no cada-um-por-si
        if (!proprio) {
          if (presentes.has(userId)) nova.push({ userId, username: ctx.nome(userId), valor: null, motivo: 'nada', posicao: null, pontos: 0, equipe: i });
          continue;
        }
        if (r) nova.push({ userId, username: ctx.nome(userId), valor: r.valor, motivo: null, posicao, pontos: p, equipe: i });
        else nova.push({ userId, username: ctx.nome(userId), valor: proprio?.valor ?? null, motivo: proprio?.motivo ?? 'nada', posicao: null, pontos: 0, equipe: i });
      }
    }
    return nova;
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
      turma,
      quem,
      corpo,
      agora: agoraMs,
      passou,
      abaixo,
      /** O tempo dito (desde o começo) cabe no que o servidor viu: nunca depois, e antes no máximo a rede da pessoa. */
      cabe: (t: number) => t <= passou + FOLGA_ACIMA && t >= passou - abaixo,
    };
  };

  /** As mensagens ao vivo de cada um, num balde que enche MENSAGENS_AO_VIVO_POR_S por segundo (o resto não conta). */
  const baldes = new Map<number, { tem: number; em: number }>();
  const gastar = (quem: number) => {
    const agoraMs = agora();
    const b = baldes.get(quem) ?? { tem: MENSAGENS_AO_VIVO_POR_S, em: agoraMs };
    b.tem = Math.min(MENSAGENS_AO_VIVO_POR_S, b.tem + ((agoraMs - b.em) * MENSAGENS_AO_VIVO_POR_S) / 1000);
    b.em = agoraMs;
    baldes.set(quem, b);
    if (b.tem < 1) return false;
    b.tem -= 1;
    return true;
  };
  /** Uma mensagem ao vivo de alguém (pelo socket, ou pela ação 'acerto' com `aoVivo`). */
  const receberAoVivo = (quem: number, corpo: unknown) => {
    if (!micro.aoVivo || fase !== 'jogando' || !inscritos.includes(quem) || robos.includes(quem)) return;
    if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo) || !gastar(quem)) return;
    micro.aoVivo.receber(conferencia(quem, corpo as Record<string, unknown>));
  };

  // o "prepare-se": o nome e a instrução na tela
  ctx.agendar(PREPARO_MS, jogar);
  ctx.avisar();

  return {
    microjogo: m,
    publico(quem) {
      const meu = resultados.get(quem);
      const vista = micro.vista?.({ dados, mem, quem, fase, agora: agora(), passou: fase === 'jogando' ? agora() - inicio : 0, turma }) ?? {};
      const deVista = 'dados' in vista ? vista.dados : dados;
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
        // o microjogo ao vivo ou de equipes recebe, junto dos dados, quem é quem (a tela não tem outro jeito de saber)
        dados:
          (micro.aoVivo || micro.equipes) && deVista && typeof deVista === 'object' && !Array.isArray(deVista)
            ? { ...deVista, turma: { eu: quem, equipes: turma.equipes, robos, nomes: Object.fromEntries(inscritos.map((id) => [id, ctx.nome(id)])) } }
            : deVista,
        duracaoMs: micro.duracao(dados),
        jogandoHaMs: fase === 'jogando' ? agora() - inicio : null,
        sinal: vista.sinal ?? false,
        meu: meu ? { motivo: meu.motivo, valor: meu.valor } : null,
        prontos: [...resultados.keys()],
        resposta: vista.resposta ?? null,
        linhas: fase === 'revelando' ? linhas : null,
        equipes: turma.equipes,
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
        // o canal ao vivo sem o socket (lote 5): a mesma mensagem, pela ação
        if (micro.aoVivo && corpo.aoVivo !== undefined) {
          receberAoVivo(quem, corpo.aoVivo);
          return null;
        }
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
    tempoReal(quem, dados) {
      receberAoVivo(quem, dados);
      return null;
    },
    parar: pararPasso,
  };
}
