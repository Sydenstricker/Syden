// Status de presença escolhido (online, ausente, ocupado, invisível): guardado no navegador para continuar
// valendo depois de recarregar a página, e reenviado ao servidor sempre que a conexão volta.
import type { PresenceStatus } from './types';

const KEY = 'syden.status';
const VALID: PresenceStatus[] = ['online', 'ausente', 'ocupado', 'invisivel'];

export function loadMyStatus(): PresenceStatus {
  try {
    const saved = localStorage.getItem(KEY);
    return (VALID as string[]).includes(saved ?? '') ? (saved as PresenceStatus) : 'online';
  } catch {
    return 'online';
  }
}

export function saveMyStatus(status: PresenceStatus) {
  try {
    localStorage.setItem(KEY, status);
  } catch {
    // navegador sem armazenamento: só não lembra da próxima vez
  }
}

export const STATUS_LABEL: Record<PresenceStatus, string> = {
  online: 'Online',
  ausente: 'Ausente',
  ocupado: 'Não perturbe',
  invisivel: 'Invisível',
};
