import type { Server as IOServer } from 'socket.io';
import * as db from './db.js';
import { emitToUser, estaOnline } from './realtime.js';
import { publicarComoSyden } from './syden-app.js';

/**
 * O AGENDADOR: a cada 30 segundos, publica as mensagens agendadas que venceram e entrega os lembretes.
 * Ver o bloco "MENSAGENS AGENDADAS E LEMBRETES" em db.ts.
 *
 * SERVIDOR DESLIGADO NÃO PERDE NADA, só atrasa: a hora fica no banco, e a primeira volta depois de ligar
 * publica o que venceu enquanto ele estava fora. A repetição pula para a próxima hora FUTURA — um "bom
 * dia" diário não sai sete vezes seguidas depois de uma semana fora do ar.
 */
const INTERVALO_MS = 30_000;
const PASSO: Record<Exclude<db.Repeticao, 'nunca'>, number> = { diario: 24 * 60 * 60_000, semanal: 7 * 24 * 60 * 60_000 };

/** A próxima hora de uma repetição que já venceu: a primeira que ainda está no futuro. */
export function proximaRepeticao(venceuEm: string, repetir: Exclude<db.Repeticao, 'nunca'>, agora: number): string {
  let proxima = Date.parse(venceuEm);
  while (proxima <= agora) proxima += PASSO[repetir];
  return new Date(proxima).toISOString();
}

/** O aviso de um lembrete: vai só para quem pediu, com o trecho da mensagem e onde ela está. */
function entregar(io: IOServer, lembrete: db.LembreteVencido) {
  emitToUser(io, lembrete.userId, 'lembrete', {
    messageId: lembrete.messageId,
    channelId: lembrete.channelId,
    communityId: lembrete.communityId,
    autor: lembrete.autor,
    trecho: lembrete.trecho,
  });
  db.apagarLembrete(lembrete.id);
}

/** Uma volta do agendador. Exportada para os testes rodarem com a hora que quiserem. */
export function rodarAgendador(io: IOServer, agora = Date.now()) {
  const agoraIso = new Date(agora).toISOString();
  for (const agendada of db.agendadasVencidas(agoraIso)) {
    const canal = db.findChannel(agendada.channelId);
    if (canal) publicarComoSyden(io, canal, agendada.texto);
    if (agendada.repetir === 'nunca' || !canal) db.removerAgendada(agendada.id);
    else db.adiarAgendada(agendada.id, proximaRepeticao(agendada.proximaEm, agendada.repetir, agora));
  }
  // Lembrete de quem está fora fica esperando: chega quando a pessoa voltar (ver entregarPendentes).
  for (const lembrete of db.lembretesVencidos(agoraIso)) if (estaOnline(lembrete.userId)) entregar(io, lembrete);
}

/** Quem acabou de conectar recebe os lembretes que venceram enquanto estava fora. */
export function entregarPendentes(io: IOServer, userId: number) {
  for (const lembrete of db.lembretesVencidos(new Date().toISOString(), userId)) entregar(io, lembrete);
}

export function iniciarAgendador(io: IOServer) {
  rodarAgendador(io);
  setInterval(() => rodarAgendador(io), INTERVALO_MS).unref();
}
