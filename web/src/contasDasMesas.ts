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

/**
 * A régua desta mão, do mais fraco ao mais forte: os valores sem o da manilha, e as quatro manilhas no fim. No mineiro, os
 * dez valores (as cartas comuns de 4, 7 e ás continuam na régua) e as quatro fixas.
 */
export function reguaDaForca(manilha: string): { valores: string[]; manilhas: string[] } {
  if (manilha === MINEIRO) return { valores: [...FORCA_DOS_VALORES], manilhas: [...MANILHAS_MINEIRAS] };
  const ehValor = (FORCA_DOS_VALORES as readonly string[]).includes(manilha);
  return {
    valores: FORCA_DOS_VALORES.filter((v) => v !== manilha),
    manilhas: ehValor ? FORCA_DAS_MANILHAS.map((n) => `${manilha}${n}`) : [],
  };
}

/**
 * O TRUCO MINEIRO (20/11/2026): sem vira, e as manilhas fixas da mais fraca à mais forte (o 7 de ouros, o ás de espadas, o 7
 * de copas e o zap, o 4 de paus). A manilha que o servidor manda é a palavra 'mineiro' (MINEIRO em server/src/minijogo-truco.ts).
 */
export const MINEIRO = 'mineiro';
export const MANILHAS_MINEIRAS = ['7o', 'Ae', '7c', '4p'] as const;

/** A carta é manilha nesta mão? */
export function ehManilha(carta: string, manilha: string): boolean {
  return manilha === MINEIRO ? (MANILHAS_MINEIRAS as readonly string[]).includes(carta) : carta.slice(0, -1) === manilha;
}
