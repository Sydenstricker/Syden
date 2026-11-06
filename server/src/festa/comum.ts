/**
 * O QUE TODO MICROJOGO DA FESTA USA (05/11/2026): o contrato de um microjogo, os números da rede e os tipos do resultado.
 * O guia de como fazer um microjogo novo está em ./registro.ts; a rodada que os roda está em ../minijogo-festa.ts.
 */

/** O "prepare-se": o nome e a instrução na tela. */
export const PREPARO_MS = 3500;
/** A revelação de cada rodada. */
export const REVELACAO_MS = 5000;
/** Menos que isto não é reação, é chute. */
export const REACAO_MINIMA = 100;
/** O tempo dito pode passar do que o servidor viu só por isto (o arredondamento e o relógio de cada lado). */
export const FOLGA_ACIMA = 50;
/** Para baixo, além da ida e volta medida de cada um: a internet que engasga num aperto. */
export const FOLGA_DA_REDE = 300;
/** O teto da ida e volta medida (quem segura o eco não ganha mais folga que isto), e a de quem não mediu. */
export const ATRASO_MAXIMO = 600;
/** Quantos ecos por rodada: três idas e voltas cabem com folga no "prepare-se". */
export const ECOS_POR_RODADA = 3;

/** O resultado de alguém numa rodada. */
export interface Resultado {
  /** Desclassificado (antes do sinal), errou ou nada que conte: zero ponto. */
  motivo: 'cedo' | 'errou' | 'invalido' | null;
  /** O que aparece na revelação (a reação, a força, quantos acertos…). */
  valor: number | null;
  /** Para ordenar: MENOR é melhor, comparado número a número (empate total divide a posição). */
  chave: number[];
}

export const invalido = (): Resultado => ({ motivo: 'invalido', valor: null, chave: [] });

export type Fase = 'preparando' | 'jogando' | 'revelando';

/** O que um microjogo recebe ao conferir uma ação de alguém: o relógio do servidor e a folga da rede daquela pessoa. */
export interface Conferencia<D, M> {
  dados: D;
  /** A memória da rodada (o que o microjogo guarda entre as ações: os acertos de cada um, quando saiu o sinal…). */
  mem: M;
  quem: number;
  corpo: Record<string, unknown>;
  /** O relógio do servidor (ms). */
  agora: number;
  /** Quanto passou desde o começo do jogo, no relógio do servidor. */
  passou: number;
  /** Quanto o tempo honesto desta pessoa pode ficar ABAIXO do que o servidor viu (a ida e volta medida, mais a folga). */
  abaixo: number;
  /** O tempo dito (desde o começo) cabe no que o servidor viu: nunca depois (só FOLGA_ACIMA), antes no máximo `abaixo`. */
  cabe(t: number): boolean;
}

/** O controle do começo do jogo, para quem não acaba simplesmente depois de `duracao` (o saque marca o sinal antes). */
export interface Largada<D, M> {
  dados: D;
  mem: M;
  agora(): number;
  aleatorio(): number;
  /** O relógio da rodada (um só: marcar de novo troca o que estava marcado). */
  agendar(ms: number, depois: () => void): void;
  /** Avisa a sala de que o estado mudou. */
  avisar(): void;
  /** Encerra o jogo e mostra o resultado. */
  revelar(): void;
}

/** O que `quem` vê, além do de sempre: os dados (se não forem os mesmos de todos), o sinal e a resposta certa. */
export interface Vista {
  dados?: unknown;
  sinal?: boolean;
  resposta?: number | null;
}

/**
 * UM MICROJOGO DO SERVIDOR. `D` são os dados sorteados (o que vai pronto ao site), `M` a memória da rodada.
 * O guia completo está em ./registro.ts.
 */
export interface MicrojogoDoServidor<D = unknown, M = unknown> {
  /** O id (o mesmo do site e do registro). Só letras minúsculas e números. */
  id: string;
  /** Sorteia os dados da rodada. Use SÓ o `aleatorio` dado (o teste o troca por um fixo). */
  gerar(aleatorio: () => number): D;
  /** Quanto dura o "jogando" (ms), já com a folga para o último aperto honesto chegar. */
  duracao(dados: D): number;
  /** A memória da rodada, nova a cada rodada. Padrão: nenhuma. */
  memoria?(dados: D): M;
  /** O começo do jogo. Padrão: revelar depois de `duracao`. */
  iniciar?(l: Largada<D, M>): void;
  /** O que `quem` vê. Padrão: os dados inteiros, sem sinal nem resposta. */
  vista?(v: { dados: D; mem: M; quem: number; fase: Fase; agora: number; passou: number }): Vista;
  /** Confere o 'resultado' de alguém (o primeiro é o que vale) e o transforma no que conta. */
  avaliar(c: Conferencia<D, M>): Resultado;
  /** Uma ação AO VIVO ('acerto'), conferida na hora pelo relógio do servidor. Nunca dá erro: o que não vale só não conta. */
  acerto?(c: Conferencia<D, M>): void;
  /** Na revelação: o resultado de quem jogou ao vivo e não mandou o fim (o que o servidor viu). */
  noFim?(c: { dados: D; mem: M; inscritos: number[] }): Iterable<[number, Resultado]>;
  /**
   * O resultado de um ROBÔ do Solo: sorteado numa faixa de quem joga bem, mas não perfeito. `passouMs` é quanto a rodada
   * durou (a pessoa que responde logo revela a rodada): o robô nunca diz ter feito mais do que cabia nesse tempo.
   */
  robo(dados: D, aleatorio: () => number, passouMs: number): Resultado;
}

/** Ajuda a escrever um microjogo com os tipos certos. */
export const microjogo = <D, M = undefined>(m: MicrojogoDoServidor<D, M>): MicrojogoDoServidor<D, M> => m;

export const numero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
export const inteiro = (v: unknown): v is number => numero(v) && Number.isInteger(v);
/** Um inteiro de 0 a n − 1, do sorteador dado. */
export const sortear = (aleatorio: () => number, n: number) => Math.floor(aleatorio() * n);
