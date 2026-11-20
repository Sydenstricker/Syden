/**
 * Contas pequenas das telas das mesas (20/11/2026, a segunda auditoria), à parte para os testes não carregarem o React nem o CSS.
 * Só TELA: quem decide cada jogo continua sendo o servidor.
 */

/** O Sudoku: quantas vezes o número ainda falta no tabuleiro (os errados marcados não contam). */
export function faltamDo(tabuleiro: readonly number[], errados: readonly number[], n: number): number {
  let postos = 0;
  tabuleiro.forEach((v, i) => {
    if (v === n && !errados.includes(i)) postos++;
  });
  return Math.max(0, 9 - postos);
}

/** O Truco: do mais fraco ao mais forte (a mesma ordem de VALORES em server/src/minijogo-truco.ts) e as manilhas. */
export const FORCA_DOS_VALORES = ['4', '5', '6', '7', 'Q', 'J', 'K', 'A', '2', '3'] as const;
/** Na ordem das manilhas: ouros, espadas, copas e paus, o zap (NAIPES no servidor). */
export const FORCA_DAS_MANILHAS = ['o', 'e', 'c', 'p'] as const;

/** A régua desta mão, do mais fraco ao mais forte: os valores sem o da manilha, e as quatro manilhas no fim. */
export function reguaDaForca(manilha: string): { valores: string[]; manilhas: string[] } {
  const ehValor = (FORCA_DOS_VALORES as readonly string[]).includes(manilha);
  return {
    valores: FORCA_DOS_VALORES.filter((v) => v !== manilha),
    manilhas: ehValor ? FORCA_DAS_MANILHAS.map((n) => `${manilha}${n}`) : [],
  };
}
