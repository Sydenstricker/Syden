/**
 * A regra de "esta mensagem fala comigo?".
 *
 * Vive num arquivo só dela, sem depender de tela nem de navegador, porque é a parte que tem sutileza e
 * precisa de teste: "@ana" não pode acender para a "anaclara", e "@todos" vale para todo mundo.
 */

/** Caracteres que podem fazer parte de um nome de usuário no Syden (ver USERNAME_RE no servidor). */
const CONTINUA_O_NOME = '\\p{L}\\p{N}_.-';

export function mencionaVoce(texto: string, meuNome: string): boolean {
  if (!texto || !meuNome) return false;
  const limpo = texto.toLowerCase();
  if (limpo.includes('@todos') || limpo.includes('@everyone')) return true;

  // O nome vai escapado: quem se chama "a.b" não pode virar uma expressão que casa com "axb".
  const nome = meuNome.toLowerCase().replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
  // A fronteira no fim é o que separa "@ana" de "@anaclara". No começo, o próprio @ já separa.
  return new RegExp(`@${nome}(?![${CONTINUA_O_NOME}])`, 'u').test(limpo);
}
