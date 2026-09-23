import { useSyncExternalStore } from 'react';
import type { Socket } from 'socket.io-client';
import { api } from './api';
import type { CommunityMember, Emoji, PublicUser, Sound } from './types';

// Dados da comunidade aberta agora: quem participa (para nomes e avatares), emojis e sons dela.
// Carrega ao abrir a comunidade e se mantém atualizado pelos eventos do socket.

interface Directory {
  communityId: number | null;
  members: Map<number, CommunityMember>;
  emojis: Emoji[];
  /** Emojis por nome, para trocar :nome: pela imagem nas mensagens. */
  emojisByName: Map<string, Emoji>;
  sounds: Sound[];
}

const empty: Directory = { communityId: null, members: new Map(), emojis: [], emojisByName: new Map(), sounds: [] };
let state: Directory = empty;
const listeners = new Set<() => void>();

function set(patch: Partial<Omit<Directory, 'emojisByName'>>) {
  const emojis = patch.emojis ?? state.emojis;
  state = { ...state, ...patch, emojis, emojisByName: new Map(emojis.map((e) => [e.name, e])) };
  for (const listener of listeners) listener();
}

/** O que uma comunidade traz consigo, ainda sem entrar na tela. */
export interface DadosDaComunidade {
  communityId: number;
  members: Map<number, CommunityMember>;
  emojis: Emoji[];
  sounds: Sound[];
}

/**
 * Busca tudo de uma comunidade SEM trocar a tela. Quem chama decide a hora de aplicar — é assim que a
 * troca de comunidade acontece de uma vez só, em vez de cada pedaço aparecer quando fica pronto.
 */
export async function buscarComunidade(communityId: number): Promise<DadosDaComunidade> {
  const [members, emojis, sounds] = await Promise.all([
    api<CommunityMember[]>(`/api/communities/${communityId}/members`),
    api<Emoji[]>(`/api/communities/${communityId}/emojis`),
    api<Sound[]>(`/api/communities/${communityId}/sounds`),
  ]);
  return { communityId, members: new Map(members.map((m) => [m.id, m])), emojis, sounds };
}

/** Põe na tela o que `buscarComunidade` trouxe. */
export function aplicarComunidade(dados: DadosDaComunidade) {
  set(dados);
}

export async function loadDirectory(communityId: number) {
  aplicarComunidade(await buscarComunidade(communityId));
}

/** Relê o soundboard: usado quando a pessoa instala, tira ou monta um pacote. */
export async function reloadSounds() {
  if (state.communityId === null) return;
  set({ sounds: await api<Sound[]>(`/api/communities/${state.communityId}/sounds`) });
}

export function clearDirectory() {
  set(empty);
}

/** Liga os eventos do socket ao diretório; devolve a função que desliga. */
export function syncDirectory(socket: Socket) {
  // Os avisos chegam de todas as comunidades de que a pessoa participa; só interessam os da aberta agora.
  const mine = (communityId: number) => communityId === state.communityId;

  const onMember = ({ communityId, member }: { communityId: number; member: CommunityMember }) => {
    if (mine(communityId)) set({ members: new Map(state.members).set(member.id, member) });
  };
  const onMemberRemoved = ({ communityId, userId }: { communityId: number; userId: number }) => {
    if (!mine(communityId)) return;
    const members = new Map(state.members);
    members.delete(userId);
    set({ members });
  };
  // Avatar ou cargo no Syden inteiro mudou: atualiza quem já está na lista.
  const onUser = (user: PublicUser) => {
    const member = state.members.get(user.id);
    if (member) set({ members: new Map(state.members).set(user.id, { ...member, ...user }) });
  };
  const onUserDeleted = ({ id }: { id: number }) => onMemberRemoved({ communityId: state.communityId ?? -1, userId: id });

  const onEmojiCreated = (emoji: Emoji) => {
    if (mine(emoji.communityId)) {
      set({ emojis: [...state.emojis.filter((e) => e.id !== emoji.id), emoji].sort((a, b) => a.name.localeCompare(b.name)) });
    }
  };
  const onEmojiDeleted = ({ id, communityId }: { id: number; communityId: number }) => {
    if (mine(communityId)) set({ emojis: state.emojis.filter((e) => e.id !== id) });
  };
  const onSoundCreated = (sound: Sound) => {
    // Sons de pacote não chegam por aqui (eles não são de comunidade nenhuma).
    if (sound.communityId !== null && mine(sound.communityId)) set({ sounds: [...state.sounds.filter((s) => s.id !== sound.id), sound] });
  };
  const onSoundDeleted = ({ id, communityId }: { id: number; communityId: number }) => {
    if (mine(communityId)) set({ sounds: state.sounds.filter((s) => s.id !== id) });
  };

  // Ao reconectar (ex.: o servidor reiniciou), recarrega tudo da comunidade aberta.
  let connectedBefore = socket.connected;
  const onConnect = () => {
    if (connectedBefore && state.communityId !== null) loadDirectory(state.communityId).catch(console.error);
    connectedBefore = true;
  };

  socket.on('connect', onConnect);
  socket.on('member:updated', onMember);
  socket.on('member:removed', onMemberRemoved);
  socket.on('user:updated', onUser);
  socket.on('user:deleted', onUserDeleted);
  socket.on('emoji:created', onEmojiCreated);
  socket.on('emoji:deleted', onEmojiDeleted);
  socket.on('sound:created', onSoundCreated);
  socket.on('sound:deleted', onSoundDeleted);
  return () => {
    socket.off('connect', onConnect);
    socket.off('member:updated', onMember);
    socket.off('member:removed', onMemberRemoved);
    socket.off('user:updated', onUser);
    socket.off('user:deleted', onUserDeleted);
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
