import { useSyncExternalStore } from 'react';
import type { Socket } from 'socket.io-client';

/**
 * O STATUS DA SALA DE VOZ (ver server/src/status-da-sala.ts): a linha curta embaixo do nome da sala ("ranqueada, não
 * chamar"). Chega junto do voice:state de cada comunidade e some sozinho quando a sala esvazia; quem decide é o servidor.
 *
 * Mora fora do React, como o "digitando": serve à lista de canais e ao palco da sala ao mesmo tempo, e quem muda (a lista
 * e o palco) usa o mesmo socket.
 */
export const MAXIMO_DO_STATUS = 60;

/** communityId → { channelId: texto }. Cada voice:state troca a comunidade dele inteira. */
const porComunidade = new Map<number, Record<string, string>>();
const ouvintes = new Set<() => void>();
let socketAtual: Socket | null = null;

/** Liga os status de um socket. Devolve o desligar. */
export function ligarStatusDasSalas(socket: Socket) {
  socketAtual = socket;
  const aoMudar = ({ communityId, statusDasSalas }: { communityId: number; statusDasSalas?: Record<string, string> }) => {
    const novos = statusDasSalas ?? {};
    const antes = porComunidade.get(communityId) ?? {};
    if (JSON.stringify(antes) === JSON.stringify(novos)) return;
    porComunidade.set(communityId, novos);
    for (const ouvinte of ouvintes) ouvinte();
  };
  socket.on('voice:state', aoMudar);
  return () => {
    socket.off('voice:state', aoMudar);
    if (socketAtual === socket) socketAtual = null;
  };
}

function statusDe(channelId: number): string {
  for (const salas of porComunidade.values()) if (salas[channelId]) return salas[channelId];
  return '';
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

/** O status de uma sala, ou '' sem nenhum. */
export function useStatusDaSala(channelId: number): string {
  return useSyncExternalStore(assinar, () => statusDe(channelId));
}

/** Muda (ou, vazio, tira) o status de uma sala. Devolve o erro do servidor, ou null. */
export function definirStatusDaSala(channelId: number, texto: string): Promise<string | null> {
  const socket = socketAtual;
  if (!socket) return Promise.resolve('Não foi possível falar com o servidor.');
  return new Promise((ok) => {
    socket.emit('voice:status', { channelId, texto }, (r: { ok: boolean; error?: string }) => ok(r.ok ? null : (r.error ?? 'Não foi possível falar com o servidor.')));
  });
}
