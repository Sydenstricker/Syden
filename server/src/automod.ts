import * as db from './db.js';

/**
 * A MODERAÇÃO AUTOMÁTICA (ver o bloco no fim de db.ts): o que barra uma mensagem antes de ela existir.
 *
 * Pedido de 06/10/2026, no pacote "MEE6 por dentro". O Syden tem uma pessoa moderando; estas regras são
 * o que ela não precisa fazer à mão. Cada uma é ligada por quem administra, e quem administra não passa
 * por nenhuma — é quem escreve as regras.
 *
 * A mensagem barrada NÃO É GRAVADA: volta como erro para quem escreveu, com o motivo, e o texto continua
 * na caixa dela para editar. Ninguém mais vê nada.
 */

/** A mesma regra do site (web/src/gifs.ts): um GIF sozinho é um endereço do GIPHY, e não é "link". */
const GIF_SOZINHO = /^https:\/\/(media[0-4]?|i)\.giphy\.com\/[\w./-]+\.(gif|webp)(\?[\w=&.-]*)?$/;
/** Endereço escrito de qualquer jeito comum: com protocolo, com www., ou convite de Discord. */
const LINK = /(?:https?:\/\/|www\.)\S+|\bdiscord(?:app)?\.(?:gg|com\/invite)\/\S+/i;

/** Excesso: mais de 5 mensagens em 10 segundos. */
const FLOOD = { mensagens: 5, janelaMs: 10_000 };
export const MODOS_LENTOS = [0, 5, 10, 30, 60, 300, 900];
export const MAXIMO_DE_PALAVRAS = 200;

/** Sem acento e em minúsculas: "Pôrra" e "porra" são a mesma palavra para o filtro. */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A palavra aparece INTEIRA no texto — "cu" não pega "cultura". */
export function contemPalavra(texto: string, palavra: string): boolean {
  const alvo = normalizar(palavra.trim());
  if (!alvo) return false;
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapar(alvo)}($|[^\\p{L}\\p{N}])`, 'u').test(normalizar(texto));
}

export function temLink(texto: string): boolean {
  return !GIF_SOZINHO.test(texto.trim()) && LINK.test(texto);
}

// Memória curta, só deste processo: quando cada pessoa escreveu por último em cada canal (modo lento) e
// as mensagens recentes dela em cada comunidade (excesso). Reiniciar o servidor zera, e não faz falta.
const ultimaNoCanal = new Map<string, number>();
const recentesNaComunidade = new Map<string, number[]>();

/**
 * Diz se a mensagem pode ser gravada. Devolve o motivo quando não pode, e null quando pode — e, nesse
 * caso, já anota a mensagem para as contas do modo lento e do excesso.
 */
export function barrarMensagem(
  channel: db.Channel,
  userId: number,
  conteudo: string,
  agora = Date.now(),
): string | null {
  if (channel.communityId === null) return null;
  // O SILÊNCIO vem antes de tudo (ver advertencias-routes.ts): quem está calado não escreve, ponto.
  const silencio = db.silenciadoAte(channel.communityId, userId, agora);
  if (silencio) {
    const minutos = Math.ceil((Date.parse(silencio) - agora) / 60_000);
    return `Você está em silêncio nesta comunidade por mais ${minutos} min.`;
  }
  const papel = db.memberRole(channel.communityId, userId);
  if (papel === 'owner' || papel === 'admin') return null;

  const chaveDoCanal = `${channel.id}:${userId}`;
  const lento = channel.modoLento ?? 0;
  const ultima = ultimaNoCanal.get(chaveDoCanal);
  if (lento > 0 && ultima !== undefined && agora - ultima < lento * 1000) {
    const falta = Math.ceil((lento * 1000 - (agora - ultima)) / 1000);
    return `Este canal está em modo lento: espere ${falta} s para mandar outra mensagem.`;
  }

  const regras = db.regrasDeModeracao(channel.communityId);
  if (regras.palavras.some((palavra) => contemPalavra(conteudo, palavra))) {
    return 'Esta comunidade não permite uma das palavras desta mensagem.';
  }
  if (regras.links && temLink(conteudo)) return 'Esta comunidade não permite links nas mensagens.';

  const chaveDaComunidade = `${channel.communityId}:${userId}`;
  const recentes = (recentesNaComunidade.get(chaveDaComunidade) ?? []).filter((t) => agora - t < FLOOD.janelaMs);
  if (regras.flood && recentes.length >= FLOOD.mensagens) {
    return 'Calma: muitas mensagens em pouco tempo. Espere alguns segundos.';
  }

  ultimaNoCanal.set(chaveDoCanal, agora);
  recentesNaComunidade.set(chaveDaComunidade, [...recentes, agora]);
  esquecerOAntigo(agora);
  return null;
}

/** A memória não cresce para sempre: o que passou do maior modo lento não decide mais nada. */
function esquecerOAntigo(agora: number) {
  if (ultimaNoCanal.size + recentesNaComunidade.size < 5000) return;
  const limite = Math.max(...MODOS_LENTOS) * 1000;
  for (const [chave, quando] of ultimaNoCanal) if (agora - quando > limite) ultimaNoCanal.delete(chave);
  for (const [chave, lista] of recentesNaComunidade) if (lista.every((t) => agora - t > FLOOD.janelaMs)) recentesNaComunidade.delete(chave);
}
