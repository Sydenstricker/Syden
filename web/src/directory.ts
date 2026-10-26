import { useSyncExternalStore } from 'react';
import type { Socket } from 'socket.io-client';
import { api } from './api';
import type { Cargo, CommunityMember, Emoji, PublicUser, Sound } from './types';

// Dados da comunidade aberta agora: quem participa (para nomes e avatares), emojis e sons dela.
// Carrega ao abrir a comunidade e se mantém atualizado pelos eventos do socket.

interface Directory {
  communityId: number | null;
  members: Map<number, CommunityMember>;
  emojis: Emoji[];
  /** Emojis por nome, para trocar :nome: pela imagem nas mensagens. */
  emojisByName: Map<string, Emoji>;
  sounds: Sound[];
  /** Os cargos personalizados da comunidade, na ordem da lista. */
  cargos: Cargo[];
}

const empty: Directory = { communityId: null, members: new Map(), emojis: [], emojisByName: new Map(), sounds: [], cargos: [] };
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
  cargos: Cargo[];
}

/**
 * Busca tudo de uma comunidade SEM trocar a tela. Quem chama decide a hora de aplicar — é assim que a
 * troca de comunidade acontece de uma vez só, em vez de cada pedaço aparecer quando fica pronto.
 */
export async function buscarComunidade(communityId: number): Promise<DadosDaComunidade> {
  const [members, emojis, sounds, cargos] = await Promise.all([
    api<CommunityMember[]>(`/api/communities/${communityId}/members`),
    api<Emoji[]>(`/api/communities/${communityId}/emojis`),
    api<Sound[]>(`/api/communities/${communityId}/sounds`),
    // O SITE SOBE ANTES DO SERVIDOR: num servidor que ainda não tem cargos, a rota dá 404, e isso não
    // pode derrubar a comunidade inteira — sem cargos, a lista só não tem grupos a mais.
    api<Cargo[]>(`/api/communities/${communityId}/cargos`).catch(() => [] as Cargo[]),
  ]);
  return { communityId, members: new Map(members.map((m) => [m.id, m])), emojis, sounds, cargos };
}

/**
 * OS NOMES DE EXIBIÇÃO que chegaram depois da carga (pelo "user:updated"), de qualquer pessoa, membro ou não. Valem mais do
 * que o que veio junto com uma mensagem ou uma lista, porque são mais novos. null = a pessoa tirou o nome de exibição.
 */
const exibicoes = new Map<number, string | null>();

/**
 * O NOME QUE APARECE, EM TODO O SYDEN: o apelido da comunidade aberta, senão o nome de exibição da conta, senão o nome da
 * conta (`username`). Fora de comunidade (início, conversas privadas) o diretório está vazio, e vale o nome de exibição.
 * `nomeDeExibicao` é o que veio com o dado (a mensagem, a lista de amigos…); quem chama e precisa redesenhar quando um
 * nome muda deve estar inscrito com useDirectory().
 */
export function nomeNaComunidade(userId: number, username: string, nomeDeExibicao?: string | null): string {
  const membro = state.members.get(userId);
  if (membro?.apelido) return membro.apelido;
  const exibicao = exibicoes.has(userId) ? exibicoes.get(userId) : membro ? membro.nomeDeExibicao : nomeDeExibicao;
  return exibicao || username;
}

/** O nome da CONTA, sem o apelido de comunidade nenhuma: o nome de exibição, ou o username. É o de Minha conta. */
export function nomeDaConta(pessoa: { id: number; username: string; nomeDeExibicao?: string | null }): string {
  const exibicao = exibicoes.has(pessoa.id) ? exibicoes.get(pessoa.id) : pessoa.nomeDeExibicao;
  return exibicao || pessoa.username;
}

/** O mesmo, para quem tem a pessoa inteira na mão (uma mensagem, um amigo, um membro). */
export function nomeDe(pessoa: { id?: number; userId?: number; username: string; nomeDeExibicao?: string | null }): string {
  return nomeNaComunidade(pessoa.id ?? pessoa.userId ?? -1, pessoa.username, pessoa.nomeDeExibicao);
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
    // Um servidor mais velho que o site não manda o campo: aí não se sabe, e nada muda.
    if (user.nomeDeExibicao !== undefined) exibicoes.set(user.id, user.nomeDeExibicao);
    const member = state.members.get(user.id);
    // Sem ser membro, o set vazio só avisa quem desenha nomes (a conversa privada, os amigos).
    set(member ? { members: new Map(state.members).set(user.id, { ...member, ...user }) } : {});
  };
  const onUserDeleted = ({ id }: { id: number }) => onMemberRemoved({ communityId: state.communityId ?? -1, userId: id });
  const onCargos = ({ communityId, cargos }: { communityId: number; cargos: Cargo[] }) => {
    if (mine(communityId)) set({ cargos });
  };

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
  // communityId nulo: som de PACOTE retirado (ver direito-autoral-routes.ts), que mora em qualquer comunidade.
  const onSoundDeleted = ({ id, communityId }: { id: number; communityId: number | null }) => {
    if (communityId === null || mine(communityId)) set({ sounds: state.sounds.filter((s) => s.id !== id) });
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
  socket.on('cargos:updated', onCargos);
  socket.on('user:updated', onUser);
  socket.on('user:deleted', onUserDeleted);
  socket.on('emoji:created', onEmojiCreated);
  socket.on('emoji:deleted', onEmojiDeleted);
  socket.on('sound:created', onSoundCreated);
  socket.on('sound:deleted', onSoundDeleted);
  // O SELO DA COMUNIDADE mudou ou saiu: quem o veste aparece com ele resolvido na lista de membros, então ela é relida
  // (raro, e só para quem é da comunidade do selo).
  const onSelo = () => {
    if (state.communityId !== null) loadDirectory(state.communityId).catch(console.error);
  };
  socket.on('selo:mudou', onSelo);
  return () => {
    socket.off('selo:mudou', onSelo);
    socket.off('connect', onConnect);
    socket.off('member:updated', onMember);
    socket.off('member:removed', onMemberRemoved);
    socket.off('cargos:updated', onCargos);
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
