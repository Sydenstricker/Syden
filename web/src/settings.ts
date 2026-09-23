import { useSyncExternalStore } from 'react';
import type { Theme } from './theme';
import type { VoiceEffectId } from './voiceEffects';

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
  /** Modificador de voz aplicado ao microfone na chamada. */
  voiceEffect: VoiceEffectId;
  /** Cores do app: escuro (padrão) ou claro. */
  theme: Theme;
  /** Microfone e áudio desligados de propósito, valendo já fora da chamada e ao entrar na próxima. */
  startMuted: boolean;
  startDeafened: boolean;
  /** Mostrar a lista de pessoas à direita também dentro das salas de voz. */
  showMembers: boolean;
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
  theme: 'dark',
  voiceEffect: 'none',
  startMuted: false,
  startDeafened: false,
  showMembers: true,
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
