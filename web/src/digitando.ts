import { useSyncExternalStore } from 'react';
import type { Socket } from 'socket.io-client';

/**
 * "Fulano está digitando": quem está escrevendo em cada canal, para a tela mostrar.
 *
 * O servidor só repassa o aviso (ver avisoDeDigitacao em server/src/realtime.ts); quem decide quanto
 * tempo ele vale é aqui. Cada aviso vale 6 s — o navegador de quem digita manda outro a cada 3 s
 * enquanto ele escreve, então quem continua escrevendo nunca some, e quem parou some sozinho. Mandou
 * a mensagem, sai na hora: o "digitando" virou a própria mensagem.
 *
 * Mora fora do React, como o diretório de membros: o aviso chega uma vez pelo socket e serve à linha
 * do canal e à lista de membros ao mesmo tempo.
 */
export interface QuemDigita {
  userId: number;
  username: string;
  ate: number;
}

const VALIDADE_MS = 6000;
const INTERVALO_DO_MEU_AVISO_MS = 3000;

const porCanal = new Map<number, Map<number, QuemDigita>>();
let versao = 0;
const ouvintes = new Set<() => void>();

function mudou() {
  versao++;
  for (const ouvinte of ouvintes) ouvinte();
}

function tirar(channelId: number, userId: number) {
  const canal = porCanal.get(channelId);
  if (canal?.delete(userId)) mudou();
}

/** Liga os avisos de um socket. Devolve o desligar. Os próprios avisos (outras abas) são ignorados. */
export function ligarDigitacao(socket: Socket, euId: number) {
  const aoDigitar = (aviso: { channelId: number; userId: number; username: string }) => {
    if (aviso.userId === euId) return;
    let canal = porCanal.get(aviso.channelId);
    if (!canal) porCanal.set(aviso.channelId, (canal = new Map()));
    const ate = Date.now() + VALIDADE_MS;
    canal.set(aviso.userId, { userId: aviso.userId, username: aviso.username, ate });
    mudou();
    // Vencido, sai sozinho — a não ser que um aviso mais novo tenha chegado no meio.
    setTimeout(() => {
      if (porCanal.get(aviso.channelId)?.get(aviso.userId)?.ate === ate) tirar(aviso.channelId, aviso.userId);
    }, VALIDADE_MS + 50);
  };
  const aoMandar = (mensagem: { channelId: number; author: { id: number } }) => tirar(mensagem.channelId, mensagem.author.id);
  socket.on('typing', aoDigitar);
  socket.on('message:new', aoMandar);
  return () => {
    socket.off('typing', aoDigitar);
    socket.off('message:new', aoMandar);
  };
}

const ultimoAvisoMeu = new Map<number, number>();

/** Chamado a cada tecla na caixa de mensagem; manda no máximo um aviso a cada 3 s por canal. */
export function avisarQueDigito(socket: Socket, channelId: number) {
  const agora = Date.now();
  if (agora - (ultimoAvisoMeu.get(channelId) ?? 0) < INTERVALO_DO_MEU_AVISO_MS) return;
  ultimoAvisoMeu.set(channelId, agora);
  socket.emit('typing', { channelId });
}

/** Mandou a mensagem: o próximo aviso pode sair logo, sem esperar os 3 s do anterior. */
export function pareiDeDigitar(channelId: number) {
  ultimoAvisoMeu.delete(channelId);
}

function assinar(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

/** Quem está digitando no canal agora (sem você). */
export function useDigitando(channelId: number | null): QuemDigita[] {
  useSyncExternalStore(assinar, () => versao);
  if (channelId === null) return [];
  const agora = Date.now();
  return [...(porCanal.get(channelId)?.values() ?? [])].filter((q) => q.ate > agora);
}
