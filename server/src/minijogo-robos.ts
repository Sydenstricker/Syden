import type { Contexto } from './minijogo-motor.js';

/**
 * OS ADVERSÁRIOS DO COMPUTADOR (pedido dele, 05/11/2026: "opção de jogar sozinho, contra IA"; primeiro no Cidades à venda,
 * depois nos outros jogos da turma). Só no Solo: a pessoa escolhe quantos, e eles entram como jogadores de id NEGATIVO (nenhuma
 * conta tem id negativo), sempre "na sala". O nome é próprio, para não pedir tradução, e o 🤖 na frente diz em qualquer língua
 * que é o computador (a tela não mente).
 *
 * São REGRAS, não modelo de linguagem, e veem só o que uma pessoa naquele lugar veria. Agem depois de uma pausa curta, para a
 * pessoa ver o que eles fizeram. Contra o computador não há troféu nem conquista: o troféu é um registro de um momento entre
 * amigos, e o Solo não conta nas conquistas da turma.
 */
export const NOMES_DOS_ROBOS = ['Tico', 'Lola', 'Bento', 'Nina', 'Juca'];
export const MAXIMO_DE_ROBOS = NOMES_DOS_ROBOS.length;
/** Quanto o robô espera antes de agir: o bastante para a pessoa ver o que ele fez. */
export const PAUSA_DO_ROBO = 1_200;

export const ehRobo = (id: number) => id < 0;
export const nomeDoRobo = (id: number) => `🤖 ${NOMES_DOS_ROBOS[(-id - 1) % NOMES_DOS_ROBOS.length]}`;
/** Os ids dos `n` robôs: -1, -2, … */
export const idsDosRobos = (n: number) => Array.from({ length: n }, (_, k) => -(k + 1));

/** Quantos robôs o corpo pede (`robos`), entre `minimo` e `maximo`; fora do Solo, sempre 0. */
export function quantosRobos(ctx: Pick<Contexto, 'solo'>, corpo: Record<string, unknown>, maximo = MAXIMO_DE_ROBOS, minimo = 0): number {
  if (!ctx.solo) return 0;
  const n = Math.floor(Number(corpo.robos) || 0);
  return Math.min(maximo, Math.max(minimo, n));
}

/**
 * O contexto visto por um jogo com robôs: eles estão sempre na sala (quem joga não "sai"), e têm o nome do 🤖. Assim o jogo
 * que já sabia jogar por quem saiu (o Dominó, o Truco) não precisa saber de robô nenhum para contá-los.
 */
export function comRobos(ctx: Contexto, robos: number[]): Contexto {
  if (!robos.length) return ctx;
  return {
    ...ctx,
    naSala: () => [...ctx.naSala(), ...robos],
    nome: (id) => (ehRobo(id) ? nomeDoRobo(id) : ctx.nome(id)),
  };
}
