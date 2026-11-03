/**
 * O NOME DE UM EMOJI DA COMUNIDADE OU DE UM PACOTE: minúsculas, sem acento, e o que não for letra, número ou _ vira _
 * ("Coração" vira "coracao"); de 2 a 32. A mesma regra do site (web/src/nomeDoEmoji.ts).
 *
 * Um arquivo só desde 03/11/2026 (relato dele: "tentei fazer o coração e não saiu"): o pacote tinha a própria regra, que
 * trocava as letras acentuadas por _ e guardava "cora_o".
 */
export function nomeDeEmoji(raw: unknown): string | null {
  const name = String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return name.length >= 2 && name.length <= 32 ? name : null;
}
