import type { FastifyBaseLogger } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import * as db from './db.js';
import { channelRoom } from './realtime.js';

// A vassoura dos recados em vídeo. Eles são os únicos arquivos grandes que o Syden guarda, e só ficam
// por sete dias — sem isso, alguns recados de dez minutos encheriam o disco do servidor em poucas
// semanas. Passado o prazo, o arquivo some, e a mensagem some junto se não sobrar nada nela.

/** De quanto em quanto tempo a vassoura passa. De hora em hora basta: o prazo é de dias. */
const INTERVALO = 60 * 60 * 1000;

export function limparRecadosVencidos(io: IOServer, log: FastifyBaseLogger) {
  try {
    const { removidos, mensagensVazias } = db.limparAnexosVencidos();
    if (removidos === 0) return;
    for (const mensagem of mensagensVazias) {
      const canal = db.findChannel(mensagem.channelId);
      if (!canal) continue;
      io.to(channelRoom(canal)).emit('message:deleted', { id: mensagem.id, channelId: mensagem.channelId, threadId: null });
    }
    log.info({ removidos, mensagensApagadas: mensagensVazias.length }, 'recados em vídeo vencidos foram apagados');
  } catch (error) {
    log.error({ err: error }, 'falha ao limpar os recados vencidos');
  }
}

export function comecarLimpezaDeRecados(io: IOServer, log: FastifyBaseLogger) {
  limparRecadosVencidos(io, log); // uma passada logo ao subir, para o servidor não acordar devendo
  const timer = setInterval(() => limparRecadosVencidos(io, log), INTERVALO);
  timer.unref?.();
}
