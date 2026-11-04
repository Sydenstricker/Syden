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
 * A FOLGA É A REDE DE CADA UM (revisão independente, 03/11/2026: a folga fixa, de 0,5 s para cima e 0,9 s para baixo, deixava
 * o console mandar os 10 s exatos do relógio em qualquer instante de 9,5 a 10,9 s, e a janela da força era mais larga que o
 * período da barra, então o pico estava sempre ao alcance). O que o site mede começa no instante marcado mais o tempo de o
 * estado chegar, e chega ao servidor depois de mais uma ida: o tempo HONESTO nunca passa do que o servidor viu (só um fio,
 * FOLGA_ACIMA), e fica abaixo dele no máximo uma ida e volta. A ida e volta de cada um é medida no "prepare-se" pelo eco
 * (`eco` no estado, devolvido pela ação 'eco'): vale a MENOR medida, porque segurar o eco só a aumenta, com um teto
 * (ATRASO_MAXIMO), que é também o de quem não mediu; e mais FOLGA_DA_REDE, para a internet que engasga num aperto.
 * O que sobra, e não tem conserto pelo relógio: um programa que espere a hora certa e mande o perfeito ainda passa, como
 * passaria um dedo perfeito. A conferência estreita a janela; não adivinha quem apertou.
 *
 * Os dados de cada microjogo vão PRONTOS ao site (as trocas dos copos, as setas, os alvos), e não uma semente: assim o site
 * não precisa do mesmo sorteador, e todo mundo vê a mesma coisa. O sinal do saque é a exceção: ele só vai quando sai, e a
 * reação é medida na tela de cada um, a partir do momento em que o sinal apareceu ali — quem tem internet pior não perde.
 *
 * OS TROFÉUS: o pódio de uma partida com 2 pessoas ou mais vai para o quarto de quem ficou nele, como o da corrida
 * (corrida_trofeus, com a "pista" 'festa' e os pontos; o site dá o nome).
 */
import * as db from './db.js';
import { embaralhar, placar, type Contexto, type Definicao } from './minijogo-motor.js';

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
/** O tempo dito pode passar do que o servidor viu só por isto (o arredondamento e o relógio de cada lado). */
export const FOLGA_ACIMA = 50;
/** Para baixo, além da ida e volta medida de cada um: a internet que engasga num aperto. */
export const FOLGA_DA_REDE = 300;
/** O teto da ida e volta medida (quem segura o eco não ganha mais folga que isto), e a de quem não mediu. */
export const ATRASO_MAXIMO = 600;
/** Quantos ecos por rodada: três idas e voltas cabem com folga no "prepare-se". */
export const ECOS_POR_RODADA = 3;

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
      // a mesma folga da siga e do alvo (revisão independente, 03/11/2026): sem ela, o aperto honesto no fim da barra, que a
      // tela deu como feito, chegava depois da revelação e não contava
      return FORCA_MS + 1500;
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
export const minimoDaSiga = (n: number) => ((n * (n + 1)) / 2) * SIGA_PASSO_MS + Math.max(0, n - 1) * SIGA_PAUSA_MS;
/** A pausa da tela entre um nível e o próximo (web/src/JogoFesta.tsx, Siga). */
export const SIGA_PAUSA_MS = 400;

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
 * relógio do contexto (um só): enquanto ela corre, quem a chamou não marca outro.
 */
export interface RodadaDeFesta {
  readonly microjogo: Microjogo;
  /** O que `quem` vê desta rodada. */
  publico(quem: number): {
    fase: 'preparando' | 'jogando' | 'revelando';
    /** A medida da rede: o site devolve este número na hora, pela ação 'eco' (só no "prepare-se"). */
    eco: number | null;
    microjogo: Microjogo;
    dados: Dados;
    duracaoMs: number;
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
}

export function rodadaDeFesta({ ctx, microjogo: m, inscritos, agora, aleatorio, pontos, aoRevelar, aoAcabar }: OpcoesDaRodada): RodadaDeFesta {
  let fase: 'preparando' | 'jogando' | 'revelando' = 'preparando';
  const dados: Dados = gerarDados(m, aleatorio);
  let inicio = 0;
  /** O saque: quando o sinal saiu (relógio do servidor), ou null. */
  let sinalEm: number | null = null;
  const resultados = new Map<number, Resultado>();
  /** Tiro ao alvo: cada acerto chega na hora, e o servidor confere no relógio dele (revisão de 03/11/2026: a lista inteira
   * mandada no fim deixava o console acertar todos). */
  const acertosDoAlvo = new Map<number, Set<number>>();
  let linhas: LinhaDaRodada[] | null = null;

  /**
   * A REDE DE CADA UM (revisão independente, 03/11/2026): os ecos mandados no "prepare-se" (o número e quando saiu), quantos
   * voltaram, e a menor ida e volta vista. E, no saque, quando o estado com o sinal foi servido a cada um: a reação honesta
   * começa depois disso.
   */
  const ecosMandados = new Map<number, Map<number, number>>();
  const ecosVoltaram = new Map<number, number>();
  const idaEVolta = new Map<number, number>();
  const sinalServidoEm = new Map<number, number>();
  let proximoEco = 1;
  /** O que o tempo honesto de `quem` pode ficar abaixo do que o servidor viu passar. */
  const folgaParaBaixo = (quem: number) => Math.min(idaEVolta.get(quem) ?? ATRASO_MAXIMO, ATRASO_MAXIMO) + FOLGA_DA_REDE;

  /** O instante marcado para o jogo começar: é dele que o site conta (o restanteMs do relógio da partida), e não de quando o
   * relógio do servidor de fato disparou, que pode atrasar uns milissegundos. */
  const comecaEm = agora() + PREPARO_MS;

  const jogar = () => {
    fase = 'jogando';
    inicio = Math.min(comecaEm, agora());
    if (m === 'saque') {
      const espera = SAQUE_ESPERA_MIN + Math.floor(aleatorio() * (SAQUE_ESPERA_MAX - SAQUE_ESPERA_MIN));
      ctx.agendar(espera, () => {
        sinalEm = agora();
        ctx.agendar(SAQUE_DEPOIS_MS, revelar);
        ctx.avisar();
      });
    } else {
      ctx.agendar(duracaoDe(m, dados), revelar);
    }
    ctx.avisar();
  };

  const revelar = () => {
    if (fase !== 'jogando') return;
    const presentes = new Set(ctx.naSala());
    // no alvo, quem acertou alguma e não chegou a mandar o fim conta pelo que o servidor viu
    if (m === 'alvo') {
      for (const [userId, acertos] of acertosDoAlvo) {
        if (!resultados.has(userId) && acertos.size) resultados.set(userId, { motivo: null, valor: acertos.size, chave: [-acertos.size] });
      }
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
    const presentes = ctx.naSala().filter((id) => inscritos.includes(id));
    return presentes.every((id) => resultados.has(id));
  };

  const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

  /** Confere o resultado mandado e o transforma no que conta. */
  const avaliar = (quem: number, corpo: Record<string, unknown>): Resultado => {
    const agoraMs = agora();
    const passou = agoraMs - inicio;
    const invalido: Resultado = { motivo: 'invalido', valor: null, chave: [] };
    const abaixo = folgaParaBaixo(quem);
    /** O tempo dito (desde o começo) cabe no que o servidor viu: nunca depois, e antes no máximo a rede da pessoa. */
    const cabe = (t: number) => t <= passou + FOLGA_ACIMA && t >= passou - abaixo;
    switch (m) {
      case 'saque': {
        if (corpo.cedo === true || sinalEm === null) return { motivo: 'cedo', valor: null, chave: [] };
        if (!numero(corpo.reacaoMs)) return invalido;
        if (corpo.reacaoMs < REACAO_MINIMA) return { motivo: 'cedo', valor: null, chave: [] };
        // a reação conta de quando o sinal apareceu na tela, e ele só aparece depois de o estado com ele ser servido: ela não
        // passa do que o servidor viu desde então, e não fica abaixo disso mais do que a rede da pessoa (aí, o servidor a sobe)
        const desde = agoraMs - (sinalServidoEm.get(quem) ?? sinalEm);
        if (corpo.reacaoMs > desde + FOLGA_ACIMA) return invalido;
        const reacao = Math.round(Math.max(corpo.reacaoMs, desde - abaixo));
        return { motivo: null, valor: reacao, chave: [reacao] };
      }
      case 'forca': {
        const t = corpo.t;
        // o tempo dito tem de ser o de agora (com a folga da rede): não vale calcular o perfeito e mandar depois
        if (!numero(t) || t < 0 || t > FORCA_MS || !cabe(t)) return invalido;
        const v = Math.round(valorDaForca((dados as DadosForca).periodoMs, t) * 10) / 10;
        return { motivo: null, valor: v, chave: [100 - v] };
      }
      case 'relogio': {
        const t = corpo.t;
        if (!numero(t) || t < 0 || t > RELOGIO_MS || !cabe(t)) return invalido;
        const ms = Math.round(t);
        return { motivo: null, valor: ms, chave: [Math.abs(ms - RELOGIO_ALVO)] };
      }
      case 'copos': {
        const d = dados as DadosCopos;
        const anim = animacaoDosCopos(d);
        if (!numero(corpo.copo) || !numero(corpo.ms) || corpo.ms < 0) return invalido;
        // não se escolhe antes de os copos pararem, nem se diz que levou mais do que o servidor viu
        if (anim + corpo.ms > passou + FOLGA_ACIMA) return invalido;
        if (corpo.copo !== copoFinal(d)) return { motivo: 'errou', valor: null, chave: [] };
        const ms = Math.round(Math.max(corpo.ms, REACAO_MINIMA, passou - anim - abaixo));
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
        if (passou + FOLGA_ACIMA < minimoDaSiga(n)) return invalido;
        if (n === 0) return { motivo: 'errou', valor: 0, chave: [] };
        // o tempo (que só desempata) não fica abaixo do mínimo de ver as setas, nem fora do que o servidor viu passar
        const minimo = Math.max(minimoDaSiga(n), passou - abaixo);
        const ms = numero(corpo.ms) ? Math.round(Math.min(Math.max(corpo.ms, minimo), passou + FOLGA_ACIMA)) : passou;
        return { motivo: null, valor: n, chave: [-n, ms] };
      }
      case 'alvo': {
        // o que vale é o que o servidor viu acertar, um a um (acao 'acerto')
        const n = acertosDoAlvo.get(quem)?.size ?? 0;
        if (n === 0) return { motivo: 'errou', valor: 0, chave: [] };
        return { motivo: null, valor: n, chave: [-n] };
      }
    }
  };

  // o "prepare-se": o nome e a instrução na tela
  ctx.agendar(PREPARO_MS, jogar);
  ctx.avisar();

  return {
    microjogo: m,
    publico(quem) {
      const meu = resultados.get(quem);
      // o estado com o sinal servido a esta pessoa pela primeira vez: a reação dela começa daqui
      if (fase === 'jogando' && sinalEm !== null && !sinalServidoEm.has(quem)) sinalServidoEm.set(quem, agora());
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
        dados,
        duracaoMs: duracaoDe(m, dados),
        sinal: sinalEm !== null,
        meu: meu ? { motivo: meu.motivo, valor: meu.valor } : null,
        prontos: [...resultados.keys()],
        // a resposta certa dos copos só na revelação (as trocas, todo mundo vê)
        resposta: fase === 'revelando' && m === 'copos' ? copoFinal(dados as DadosCopos) : null,
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
        // TIRO AO ALVO: um acerto vale se o alvo estava na tela AGORA (no relógio do servidor, com a folga da rede)
        if (m !== 'alvo' || resultados.has(quem)) return null;
        const alvos = (dados as DadosAlvo).alvos;
        const i = corpo.i;
        if (!numero(i) || !Number.isInteger(i) || i < 0 || i >= alvos.length) return null;
        const passou = agora() - inicio;
        // a cenoura aparece na tela no instante dela (mais o tempo de o estado ter chegado), e o acerto chega depois: nunca
        // antes do instante, e no máximo a rede da pessoa depois de ela sumir
        if (passou < alvos[i].t - FOLGA_ACIMA || passou > alvos[i].t + ALVO_VIDA_MS + folgaParaBaixo(quem)) return null;
        const meus = acertosDoAlvo.get(quem) ?? new Set<number>();
        meus.add(i);
        acertosDoAlvo.set(quem, meus);
        return null;
      }
      // o primeiro resultado é o que vale (o Enter apertado duas vezes não troca nada)
      if (resultados.has(quem)) return null;
      resultados.set(quem, avaliar(quem, corpo));
      if (todosResponderam()) revelar();
      else ctx.avisar();
      return null;
    },
    conferir() {
      if (fase === 'jogando' && todosResponderam()) revelar();
    },
  };
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
      let terminada = false;
      /** Quem estava na sala em TODAS as revelações: só eles são "a turma" do pódio (revisão de 03/11/2026: quem ficava
       * sozinho ganhava o troféu, e quem tinha saído também). */
      let ficaram: Set<number> | null = null;

      const nova = (): RodadaDeFesta =>
        rodadaDeFesta({
          ctx,
          microjogo: ordem[rodada - 1],
          inscritos,
          agora,
          aleatorio,
          pontos: PONTOS_FESTA,
          aoRevelar: (linhas, presentes) => {
            const agoraNaSala = inscritos.filter((id) => presentes.has(id));
            ficaram = new Set((ficaram ? [...ficaram] : inscritos).filter((id) => agoraNaSala.includes(id)));
            for (const l of linhas) if (l.pontos) pontos.set(l.userId, (pontos.get(l.userId) ?? 0) + l.pontos);
          },
          aoAcabar: () => {
            if (rodada >= ordem.length) return terminar();
            rodada++;
            atual = nova();
          },
        });
      let atual = nova();

      const terminar = () => {
        terminada = true;
        // O PÓDIO, com 2 pessoas ou mais que ficaram até o fim: até o 3º lugar (empatados dividem), e só quem fez algum ponto.
        const turma = ficaram ?? new Set<number>();
        if (turma.size >= 2) {
          const ordemFinal = placar(new Map([...pontos].filter(([id]) => turma.has(id))), ctx.nome);
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
              rivais: [...turma].filter((id) => id !== l.userId),
            });
          }
        }
        ctx.terminar();
      };

      /**
       * A classificação do fim, a mesma dos troféus (revisão independente, 03/11/2026: a tela dava medalha pelo placar de
       * todos, inclusive de quem tinha saído, e ao único que ficou): posição só para quem ficou até o fim, e só com 2 ou mais;
       * quem saiu vem depois, sem posição, marcado.
       */
      const classificacaoFinal = () => {
        const turma = ficaram ?? new Set<number>();
        const comPodio = turma.size >= 2;
        const ordemFinal = placar(pontos, ctx.nome);
        const ranking = comPodio ? ordemFinal.filter((l) => turma.has(l.userId)) : [];
        const resto = ordemFinal.filter((l) => !ranking.includes(l));
        return [
          ...ranking.map((l) => ({ ...l, posicao: 1 + ranking.filter((o) => o.pontos > l.pontos).length, saiu: false })),
          ...resto.map((l) => ({ ...l, posicao: null, saiu: !turma.has(l.userId) })),
        ];
      };

      return {
        publico(quem) {
          const r = atual.publico(quem);
          return {
            ...r,
            eco: terminada ? null : r.eco,
            classificacao: terminada ? classificacaoFinal() : null,
            fase: terminada ? 'fim' : r.fase,
            rodada,
            rodadas: ordem.length,
            dados: terminada ? null : r.dados,
            jogadores: inscritos.map((userId) => ({ userId, username: ctx.nome(userId) })),
            resposta: terminada ? null : r.resposta,
            placar: placar(pontos, ctx.nome),
            // a partida (o site monta a tela de novo a cada uma: o "Jogar de novo" do Solo não herda a rodada 5 da anterior)
            partidaId: evento,
          };
        },
        acao(quem, corpo) {
          if (corpo.tipo === 'eco') return terminada ? null : atual.acao(quem, corpo);
          if (corpo.tipo !== 'resultado' && corpo.tipo !== 'acerto') return 'Ação desconhecida.';
          if (!inscritos.includes(quem)) return 'Você está assistindo esta partida.';
          if (terminada) return 'Esta rodada já acabou.';
          return atual.acao(quem, corpo);
        },
        conferir() {
          if (!terminada) atual.conferir();
        },
      };
    },
  };
}
