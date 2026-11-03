/**
 * O NOME DE UM EMOJI DA COMUNIDADE (ou de um pacote), a mesma regra do servidor (server/src/nome-do-emoji.ts): minúsculas,
 * sem acento, e o que não for letra, número ou _ vira _. "Coração" vira "coracao".
 *
 * Moram aqui e não espalhados porque cada lugar tinha a sua (relato dele, 03/11/2026: "tentei fazer o coração e não
 * saiu"): o pacote trocava o ç e o ã por _ ("cora_o"), a mensagem só reconhecia :nome: sem acento, e a busca do seletor
 * jogava fora as letras acentuadas ("corao"). Com a mesma regra nos três, :coração: acha o emoji coracao.
 */
export function nomeDeEmoji(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
}
