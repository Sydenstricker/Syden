import { useSyncExternalStore } from 'react';

// Preferências de cada pessoa, guardadas só neste computador (localStorage).

export type ScreenQuality = 'light' | 'standard' | 'smooth';

export interface Settings {
  /** Ids de dispositivo; '' = o padrão do sistema. */
  audioInput: string;
  audioOutput: string;
  videoInput: string;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  screenQuality: ScreenQuality;
  /** Sons de entrada, saída, mudo etc. */
  sounds: boolean;
  /** Volume dos sons do soundboard tocados na sala (0 a 1). */
  soundboardVolume: number;
  /** Notificação do Windows para mensagens novas quando o Syden não está em primeiro plano. */
  notifications: boolean;
}

const DEFAULTS: Settings = {
  audioInput: '',
  audioOutput: '',
  videoInput: '',
  noiseSuppression: true,
  echoCancellation: true,
  screenQuality: 'standard',
  sounds: true,
  soundboardVolume: 0.6,
  notifications: true,
};

const STORAGE_KEY = 'janja.settings';

function load(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') };
  } catch {
    return DEFAULTS;
  }
}

let current = load();
const listeners = new Set<() => void>();

export function getSettings(): Settings {
  return current;
}

export function updateSettings(patch: Partial<Settings>) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Sem localStorage: vale só até fechar o app.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings);
}
