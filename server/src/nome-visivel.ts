/**
 * A LIMPEZA DE UM NOME QUE OS OUTROS VEEM (o apelido da comunidade e o nome de exibição da conta).
 *
 * Sem os caracteres invisíveis e de controle (revisão de 16/10/2026): um espaço de largura zero deixava o nome em branco
 * para todo mundo, e o U+202E virava de trás para frente o nome e o texto depois dele. Fica o U+200D, que junta os emojis
 * compostos. Sem nada visível, devolve '' (é como apagar o nome).
 */
export function limparNomeVisivel(valor: unknown): string {
  const limpo = String(valor ?? '').replace(/(?!\u{200D})[\p{Cc}\p{Cf}]/gu, '').trim().replace(/\s+/g, ' ');
  return /[^\s\u{200D}]/u.test(limpo) ? limpo : '';
}

/** O mesmo tamanho do apelido da comunidade. */
export const NOME_VISIVEL_MAXIMO = 32;
