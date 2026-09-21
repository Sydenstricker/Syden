import { type RemoteAudioTrack, type Room, Track } from 'livekit-client';

// Volume de cada pessoa, ajustado por quem escuta e guardado no navegador: um amigo com microfone baixo
// continua alto na próxima chamada, sem precisar mexer de novo. Nada disso vai para o servidor.

const KEY = 'syden.volumes';
const MUTED_KEY = 'syden.localMutes';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // navegador sem armazenamento: vale só para esta sessão
  }
}

let volumes = read<Record<string, number>>(KEY, {});
let mutes = read<Record<string, boolean>>(MUTED_KEY, {});

export function getUserVolume(userId: number) {
  return volumes[String(userId)] ?? 1;
}

export function isLocallyMuted(userId: number) {
  return mutes[String(userId)] === true;
}

function apply(room: Room, userId: number) {
  const participant = room.remoteParticipants.get(String(userId));
  participant?.setVolume(isLocallyMuted(userId) ? 0 : getUserVolume(userId));
}

export function setUserVolume(room: Room, userId: number, volume: number) {
  // O navegador só aceita de 0 a 1 no volume de um áudio; passar disso dá erro e derruba o som.
  volumes = { ...volumes, [String(userId)]: Math.min(1, Math.max(0, volume)) };
  write(KEY, volumes);
  apply(room, userId);
}

export function setLocalMute(room: Room, userId: number, muted: boolean) {
  mutes = { ...mutes, [String(userId)]: muted };
  write(MUTED_KEY, mutes);
  apply(room, userId);
}

// O som da transmissão de tela tem volume próprio: o jogo do amigo pode estar alto demais sem que a voz
// dele esteja. É o mesmo ajuste do Discord, separado do volume da pessoa.

const SCREEN_KEY = 'syden.screenVolumes';
let screenVolumes = read<Record<string, number>>(SCREEN_KEY, {});

export function getScreenVolume(userId: number) {
  return screenVolumes[String(userId)] ?? 1;
}

function screenAudioTrack(room: Room, userId: number) {
  const participant = room.remoteParticipants.get(String(userId));
  const publication = participant?.getTrackPublication(Track.Source.ScreenShareAudio);
  return publication?.track as RemoteAudioTrack | undefined;
}

export function setScreenVolume(room: Room, userId: number, volume: number) {
  screenVolumes = { ...screenVolumes, [String(userId)]: Math.min(1, Math.max(0, volume)) };
  write(SCREEN_KEY, screenVolumes);
  screenAudioTrack(room, userId)?.setVolume(getScreenVolume(userId));
}

/** Essa transmissão está vindo com som? */
export function hasScreenAudio(room: Room, userId: number) {
  return screenAudioTrack(room, userId) !== undefined;
}

/** Ao entrar na sala (ou quando alguém chega), devolve a cada pessoa o volume que você tinha escolhido. */
export function applyAllVolumes(room: Room) {
  for (const [identity, participant] of room.remoteParticipants) {
    const userId = Number(identity);
    if (!Number.isFinite(userId)) continue;
    participant.setVolume(isLocallyMuted(userId) ? 0 : getUserVolume(userId));
    screenAudioTrack(room, userId)?.setVolume(getScreenVolume(userId));
  }
}
