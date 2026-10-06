import type { Server as IOServer } from 'socket.io';
import * as db from './db.js';
import { channelRoom } from './realtime.js';

/**
 * PUBLICAR COMO O SYDEN: a mensagem automática que a comunidade configurou (comando, agendada,
 * parabéns, sorteio…) sai pela conta do Syden e chega a quem está no canal pelo mesmo evento de qualquer
 * mensagem. Ver "A CONTA DO SYDEN" em db.ts.
 */
export function publicarComoSyden(io: IOServer, channel: db.Channel, content: string, threadId: number | null = null): db.Message {
  const message = db.mensagemDoSyden(channel.id, content, threadId);
  io.to(channelRoom(channel)).emit('message:new', { ...message, communityId: channel.communityId });
  return message;
}

/** Troca {pessoa} e {comunidade} no texto configurado, para a resposta falar com quem pediu. */
export function preencher(texto: string, valores: { pessoa?: string; comunidade?: string }): string {
  return texto.replace(/\{(pessoa|comunidade)\}/g, (inteiro, campo: 'pessoa' | 'comunidade') => valores[campo] ?? inteiro);
}
