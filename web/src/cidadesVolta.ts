/**
 * A VOLTA DAS CAPITAIS (20/11/2026): quantas colunas e linhas o retângulo tem e onde cai cada casa. A de 32 casas é 10 × 8; a do
 * Brasil inteiro (40 casas), 12 × 10. Usada pelo desenho de reserva (JogoCidades.tsx) e pelo 3D (cidades3d/cena.ts), sem React
 * nem CSS, para o teste poder importar.
 */
export function voltaDasCidades(total: number): { colunas: number; linhas: number } {
  return total === 40 ? { colunas: 12, linhas: 10 } : { colunas: 10, linhas: 8 };
}

/** A coluna e a linha da casa `i`: a fileira de cima da esquerda para a direita, desce pela direita, volta por baixo e sobe. */
export function colunaLinhaDasCidades(i: number, total = 32): [number, number] {
  const { colunas: C, linhas: L } = voltaDasCidades(total);
  if (i <= C - 1) return [i, 0];
  if (i <= C + L - 2) return [C - 1, i - (C - 1)];
  if (i <= 2 * C + L - 3) return [2 * C + L - 3 - i, L - 1];
  return [0, 2 * C + 2 * L - 4 - i];
}

/** Onde fica cada casa no desenho de reserva, em casas de 40 px. */
export function lugarDaCasaDasCidades(i: number, total = 32): { x: number; y: number } {
  const [c, l] = colunaLinhaDasCidades(i, total);
  return { x: c * 40, y: l * 40 };
}

/** A cor de cada grupo, do Norte ao Sudeste. */
export const COR_DO_GRUPO = ['#6fa86a', '#3f8a72', '#e0b04a', '#d98448', '#b8743f', '#6d8fc4', '#9a72b8'];
/** No Brasil inteiro, 9 grupos: três verdes do Norte, três tons de amarelo e laranja do Nordeste, e os outros como na de 32. */
export const COR_DO_GRUPO_NO_BRASIL = ['#8cbf6a', '#6fa86a', '#3f8a72', '#e8c25a', '#e0a04a', '#d98448', '#b8743f', '#6d8fc4', '#9a72b8'];
