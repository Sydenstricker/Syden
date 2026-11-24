import type { EstadoTabuleiro } from './minijogos';

/** O lugar de cada casa no desenho de reserva do Tabuleiro da turma (JogoTabuleiro.tsx), à parte para o teste. */
/** Os ramais de sempre (o servidor manda os dele; estes são só para quem desenha sem estado). */
export const RAMAIS_PADRAO: EstadoTabuleiro['ramais'] = [
  { de: 5, ate: 10, inicio: 30, tamanho: 4 },
  { de: 20, ate: 25, inicio: 34, tamanho: 4 },
];

export const CASA = 28;
export const BORDA = 4;
/**
 * O retângulo de cada tabuleiro no desenho de reserva (24/11/2026): a volta é a borda dele, então 2 × (colunas + linhas) − 4
 * casas (a horta 30, o rio 32, a serra 28; o teste confere que bate com o servidor e que nenhuma casa cai em cima de outra).
 */
export const MEDIDAS_2D: Record<string, { colunas: number; linhas: number }> = {
  horta: { colunas: 11, linhas: 6 },
  rio: { colunas: 12, linhas: 6 },
  serra: { colunas: 10, linhas: 6 },
};

/**
 * Onde fica cada casa: a fileira de cima da esquerda para a direita, desce pela direita, volta por baixo e sobe. `medidas` é o
 * retângulo do tabuleiro (sem ele, o da horta).
 */
export function lugarDaCasa(
  i: number,
  ramais: EstadoTabuleiro['ramais'] = RAMAIS_PADRAO,
  medidas: { colunas: number; linhas: number } = MEDIDAS_2D.horta,
): { x: number; y: number } {
  const { colunas: C, linhas: L } = medidas;
  // as casas dos ramais (19/11/2026): uma casa para dentro da casa da volta que cada uma acompanha
  const ramal = ramais.find((r) => i >= r.inicio && i < r.inicio + r.tamanho);
  if (ramal) {
    const v = lugarDaCasa(ramal.de + 1 + (i - ramal.inicio), [], medidas);
    const c0 = (v.x - BORDA) / CASA;
    const l0 = (v.y - BORDA) / CASA;
    const [c1, l1] = l0 === 0 ? [c0, 1] : l0 === L - 1 ? [c0, L - 2] : c0 === C - 1 ? [C - 2, l0] : [1, l0];
    return { x: BORDA + c1 * CASA, y: BORDA + l1 * CASA };
  }
  const total = 2 * (C + L) - 4;
  let c: number;
  let l: number;
  if (i <= C - 1) [c, l] = [i, 0];
  else if (i <= C + L - 3) [c, l] = [C - 1, i - (C - 1)];
  else if (i <= 2 * (C - 1) + L - 1) [c, l] = [2 * (C - 1) + L - 1 - i, L - 1];
  else [c, l] = [0, total - i];
  return { x: BORDA + c * CASA, y: BORDA + l * CASA };
}
