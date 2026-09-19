import { useSyncExternalStore } from 'react';
import type { Socket } from 'socket.io-client';
import { api } from './api';
import type { Emoji, PublicUser, Sound } from './types';

// Dados compartilhados por todo o app: quem é quem (para os avatares), emojis e sons do servidor.
// Carrega uma vez e se mantém atualizado pelos eventos do socket.

interface Directory {
  users: Map<number, PublicUser>;
  emojis: Emoji[];
  /** Emojis por nome, para trocar :nome: pela imagem nas mensagens. */
  emojisByName: Map<string, Emoji>;
  sounds: Sound[];
}

let state: Directory = { users: new Map(), emojis: [], emojisByName: new Map(), sounds: [] };
const listeners = new Set<() => void>();

function set(patch: Partial<Omit<Directory, 'emojisByName'>>) {
  const emojis = patch.emojis ?? state.emojis;
  state = { ...state, ...patch, emojis, emojisByName: new Map(emojis.map((e) => [e.name, e])) };
  for (const listener of listeners) listener();
}

export async function loadDirectory() {
  const [users, emojis, sounds] = await Promise.all([
    api<PublicUser[]>('/api/users'),
    api<Emoji[]>('/api/emojis'),
    api<Sound[]>('/api/sounds'),
  ]);
  set({ users: new Map(users.map((u) => [u.id, u])), emojis, sounds });
}

/** Liga os eventos do socket ao diretório; devolve a função que desliga. */
export function syncDirectory(socket: Socket) {
  const onUser = (user: PublicUser) => set({ users: new Map(state.users).set(user.id, user) });
  const onEmojiCreated = (emoji: Emoji) =>
    set({ emojis: [...state.emojis.filter((e) => e.id !== emoji.id), emoji].sort((a, b) => a.name.localeCompare(b.name)) });
  const onEmojiDeleted = ({ id }: { id: number }) => set({ emojis: state.emojis.filter((e) => e.id !== id) });
  const onSoundCreated = (sound: Sound) => set({ sounds: [...state.sounds.filter((s) => s.id !== sound.id), sound] });
  const onSoundDeleted = ({ id }: { id: number }) => set({ sounds: state.sounds.filter((s) => s.id !== id) });

  // Ao reconectar (ex.: o servidor reiniciou com um pacote de sons novo), recarrega tudo.
  let connectedBefore = socket.connected;
  const onConnect = () => {
    if (connectedBefore) loadDirectory().catch(console.error);
    connectedBefore = true;
  };

  socket.on('connect', onConnect);
  socket.on('user:updated', onUser);
  socket.on('emoji:created', onEmojiCreated);
  socket.on('emoji:deleted', onEmojiDeleted);
  socket.on('sound:created', onSoundCreated);
  socket.on('sound:deleted', onSoundDeleted);
  return () => {
    socket.off('connect', onConnect);
    socket.off('user:updated', onUser);
    socket.off('emoji:created', onEmojiCreated);
    socket.off('emoji:deleted', onEmojiDeleted);
    socket.off('sound:created', onSoundCreated);
    socket.off('sound:deleted', onSoundDeleted);
  };
}

export function getDirectory() {
  return state;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDirectory(): Directory {
  return useSyncExternalStore(subscribe, getDirectory);
}
