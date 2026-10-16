/**
 * O MOTOR DOS MINI-GAMES (12/10/2026): o que todo jogo da sala de voz tem em comum, e o que cada um faz
 * diferente. As rotas (minijogos-routes.ts) cuidam da sala, do relógio e do aviso à comunidade; cada jogo
 * só conhece as próprias regras.
 *
 * TODO JOGO É UMA MÁQUINA NO SERVIDOR: ele recebe as ações de quem está na sala, decide, e diz o que cada
 * um pode ver. "Cada um" importa: no Stop as respostas dos outros ficam escondidas até o fim da rodada, e
 * no Sudoku cada um vê só o próprio tabuleiro. Por isso o estado público é pedido POR PESSOA.
 */

export interface Contexto {
  /** O relógio da partida (um só): marcar de novo troca o que estava marcado. */
  agendar(ms: number, depois: () => void): void;
  /** Avisa a comunidade de que a partida mudou: quem está na sala busca o estado de novo. */
  avisar(): void;
  /** A partida acabou: o placar fica na tela por um tempo e some sozinho. */
  terminar(): void;
  /**
   * Quem JOGA e está na sala agora. Com o convite, só quem aceitou: quem está na sala transmitindo ou só conversando
   * não segura a rodada de ninguém (relato de 13/10/2026, com três pessoas transmitindo).
   */
  naSala(): number[];
  nome(userId: number): string;
}

export interface Jogo {
  /** O que `quem` vê agora. */
  publico(quem: number): Record<string, unknown>;
  /** Uma ação de alguém da sala. Devolve o erro (em português: o site traduz), ou null. */
  acao(quem: number, corpo: Record<string, unknown>): string | null;
  /**
   * O que precisa chegar aos outros NA HORA, sem passar pelo "mudou, busque de novo": o traço do desenho.
   * Vem pelo socket; devolve o que repassar a quem está na sala, ou null para descartar.
   */
  tempoReal?(quem: number, dados: unknown): unknown;
  /**
   * Alguém pode ter saído da sala: o jogo confere se já dá para seguir (a rodada que só esperava quem saiu). As rotas
   * chamam de tempos em tempos (revisão de 16/10/2026: a rodada ficava presa até o relógio de 3 minutos).
   */
  conferir?(): void;
}

export interface Definicao {
  /** Quantos jogadores, no mínimo, para começar (o convite só deixa começar com eles). */
  minimo?: number;
  /**
   * Jogo de MESA, de duas pessoas (Cinco em linha, Mancala): começa na hora, porque a mesa já é o convite — quem
   * começa senta e espera, e quem aceitar senta do outro lado (a ação 'sentar').
   */
  mesa?: boolean;
  /** Começa com quem aceitou o convite (`naSala`). Devolve o jogo, ou o erro que impede de começar. */
  comecar(ctx: Contexto, opcoes: { naSala: number[]; criadaPor: number; corpo: Record<string, unknown> }): Jogo | string;
}

export interface LinhaDoPlacar {
  userId: number;
  username: string;
  pontos: number;
}

/** O placar em ordem: mais pontos primeiro, e o nome desempata. */
export function placar(pontos: Map<number, number>, nome: (userId: number) => string): LinhaDoPlacar[] {
  return [...pontos.entries()]
    .map(([userId, p]) => ({ userId, username: nome(userId), pontos: p }))
    .sort((a, b) => b.pontos - a.pontos || a.username.localeCompare(b.username));
}

/** Embaralha no lugar (Fisher–Yates). `aleatorio` é trocável para o teste. */
export function embaralhar<T>(lista: T[], aleatorio = Math.random): T[] {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(aleatorio() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}
