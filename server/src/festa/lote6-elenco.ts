/**
 * O ELENCO DOS MICROJOGOS DE UM CONTRA TRÊS (lote 6, 05/11/2026; a classe C de docs/mario-party-3.md): quem é o SOLITÁRIO e
 * quem é o GRUPO. Só os microjogos do lote 6 usam este arquivo.
 *
 * O elenco sai das EQUIPES do formato (comum.ts, lote 5): a rodada chama `equipes` antes de `gerar`, e o solitário é sorteado
 * entre todos (robôs inclusive: o robô faz qualquer papel). São duas equipes, [o solitário] e [o grupo], e a posição é por
 * equipe: o grupo ganha junto. Com menos de 4 na rodada, continua um solitário e o resto é o grupo.
 */
import { sortear, type Turma } from './comum.js';

/** As duas equipes: o solitário e o grupo (na ordem da inscrição). */
export function umContraTodos(jogadores: number[], aleatorio: () => number): number[][] {
  if (jogadores.length === 0) return [];
  const solo = jogadores[sortear(aleatorio, jogadores.length)];
  return [[solo], jogadores.filter((id) => id !== solo)];
}

export interface Elenco {
  solo: number;
  grupo: number[];
  /** Os do computador (o servidor os joga). */
  robos: number[];
}

/** O elenco a partir da turma (ou, no teste do registro, sem turma: 1 contra 2). */
export function elencoDa(turma: Turma | undefined): Elenco {
  const eq = turma?.equipes;
  if (!eq || !eq[0]?.length) return { solo: 1, grupo: [2], robos: [] };
  return { solo: eq[0][0], grupo: eq[1] ?? [], robos: [...(turma?.robos ?? [])] };
}

export const papelDe = (e: Elenco, quem: number): 'solo' | 'grupo' | null =>
  e.solo === quem ? 'solo' : e.grupo.includes(quem) ? 'grupo' : null;

/** Um número de 0 a 1 repetível a partir de inteiros (a simulação dos robôs: o mesmo sorteio para quem pergunta de novo). */
export function acaso(...n: number[]) {
  let h = 2166136261;
  for (const x of n) {
    h ^= x | 0;
    h = Math.imul(h, 16777619) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995) >>> 0;
  }
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/**
 * A memória da rodada presa aos dados, sem aparecer no JSON: o `robo()` só recebe os dados, e o resultado do robô de um
 * contra três tem de ser o da equipe dele (o grupo ganha ou perde junto). Fora da rodada (o teste do registro), não há.
 */
export const VIVO = Symbol('vivo');
export function prender<M>(dados: object, mem: M): M {
  Object.defineProperty(dados, VIVO, { value: mem });
  return mem;
}
export const memoriaDe = <M>(dados: object): M | undefined => (dados as { [VIVO]?: M })[VIVO];
