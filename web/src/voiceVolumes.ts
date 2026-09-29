import { type RemoteAudioTrack, type Room, Track } from 'livekit-client';
import { criarTeto } from './limitador';

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

/**
 * De quem esta pessoa mexeu no volume e não silenciou.
 *
 * Serve para a regra de quem ouvir em sala grande (ver quemOuvir.ts): mexer no volume de alguém é
 * escolha explícita, e escolha explícita vence a regra automática. Quem foi silenciado localmente fica
 * de fora — a pessoa já disse que não quer ouvir.
 */
export function idsComVolumeAjustado(): string[] {
  return Object.keys(volumes).filter((id) => (volumes[id] ?? 0) > 0 && mutes[id] !== true);
}

function apply(room: Room, userId: number) {
  const participant = room.remoteParticipants.get(String(userId));
  participant?.setVolume(isLocallyMuted(userId) ? 0 : getUserVolume(userId));
}

export function setUserVolume(room: Room, userId: number, volume: number) {
  // O navegador só aceita de 0 a 1 no volume de um áudio; passar disso dá erro e derruba o som.
  volumes = { ...volumes, [String(userId)]: Math.min(1, Math.max(0, volume)) };
  write(KEY, volumes);
  void import('./preferencias').then((m) => m.guardarEmBreve());
  apply(room, userId);
}

export function setLocalMute(room: Room, userId: number, muted: boolean) {
  mutes = { ...mutes, [String(userId)]: muted };
  write(MUTED_KEY, mutes);
  void import('./preferencias').then((m) => m.guardarEmBreve());
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

/**
 * O TETO DO SOM DA TRANSMISSÃO É 200%, e o caminho para passar de 100% é outro.
 *
 * `setVolume` do LiveKit escreve em `element.volume`, que o navegador prende entre 0 e 1 — pedir 1,5
 * ali não faz nada, em silêncio. Era isso que acontecia: "mesmo no máximo ficou baixo", porque o
 * máximo era o som cru, e som de jogo capturado costuma chegar baixo.
 *
 * Acima de 100% o LiveKit passa a tocar por Web Audio, onde o ganho é um nó e pode passar de 1. Só
 * que um ganho solto é justamente como alguém leva um estouro no ouvido (ver limitador.ts, e o motivo
 * dele existir), então o teto entra ANTES do ganho: o limitador segura os picos em -6 dB e o dobro
 * leva isso a 0 dB, que é o limite do que não estoura. Mais volume, nunca mais pico.
 *
 * O caminho novo só é ligado quando alguém realmente pede mais de 100%. Quem nunca mexe continua
 * exatamente como antes — se o reforço tiver algum problema, ele não alcança quem não pediu.
 */
export const TETO_DA_TRANSMISSAO = 2;

let contextoDoReforco: AudioContext | null = null;
/** Faixas que já estão tocando por Web Audio. Ligar duas vezes reconectaria o som no meio. */
const jaReforcadas = new WeakSet<object>();

/**
 * Passa esta faixa para o caminho de Web Audio, com o teto no meio.
 *
 * `setAudioContext` e `setWebAudioPlugins` são marcados como internos pelo LiveKit. É uma dívida
 * assumida e cercada: se a versão nova deixar de tê-los, a conferência abaixo devolve sem fazer nada
 * e o volume volta a parar em 100% — que é o de hoje, não um defeito novo.
 */
function ligarReforco(faixa: RemoteAudioTrack): boolean {
  if (jaReforcadas.has(faixa)) return true;
  const interna = faixa as unknown as {
    setAudioContext?: (ctx: AudioContext) => void;
    setWebAudioPlugins?: (nos: AudioNode[]) => void;
  };
  if (typeof interna.setAudioContext !== 'function') return false;
  try {
    contextoDoReforco ??= new AudioContext();
    // O contexto nasce suspenso quando a página ainda não teve gesto nenhum; aqui sempre teve (a
    // pessoa arrastou um controle), mas retomar é barato e cobre o caso de ele ter dormido.
    void contextoDoReforco.resume().catch(() => {});
    const teto = criarTeto(contextoDoReforco);
    if (teto && typeof interna.setWebAudioPlugins === 'function') interna.setWebAudioPlugins([teto]);
    interna.setAudioContext(contextoDoReforco);
    jaReforcadas.add(faixa);
    return true;
  } catch (erro) {
    console.error(erro);
    return false;
  }
}

/**
 * O volume que a pessoa tinha antes de silenciar aquela transmissão, para o clique de volta devolver
 * o mesmo e não um 100% no ouvido de quem estava em 40%.
 *
 * Fica na memória desta sessão, e não no disco: mudo é uma decisão do momento ("já volto"), e alguém
 * que fecha o Syden mudo e volta no dia seguinte espera ouvir. É o contrário do volume, que é uma
 * característica da pessoa do outro lado e por isso é guardada.
 */
const antesDoMudo = new Map<number, number>();

/** O clique no alto-falante: cala, e o clique seguinte devolve o volume que estava. */
export function alternarMudoDaTela(room: Room, userId: number) {
  const atual = getScreenVolume(userId);
  if (atual > 0) {
    antesDoMudo.set(userId, atual);
    setScreenVolume(room, userId, 0);
  } else {
    setScreenVolume(room, userId, antesDoMudo.get(userId) ?? 1);
  }
  return getScreenVolume(userId);
}

export function setScreenVolume(room: Room, userId: number, volume: number) {
  screenVolumes = { ...screenVolumes, [String(userId)]: Math.min(TETO_DA_TRANSMISSAO, Math.max(0, volume)) };
  write(SCREEN_KEY, screenVolumes);
  void import('./preferencias').then((m) => m.guardarEmBreve());
  aplicarVolumeDaTela(screenAudioTrack(room, userId), getScreenVolume(userId));
}

/**
 * Põe o volume na faixa, ligando o reforço quando o pedido passa de 100%.
 *
 * Sem faixa não há o que fazer, e isso é NORMAL: a escolha fica guardada e vale quando o som chegar
 * (o TrackSubscribed devolve todos os volumes, ver useVoice.ts). Era daí a impressão de que o
 * controle não funcionava para uma transmissão cujo som ainda não tinha sido assinado.
 */
function aplicarVolumeDaTela(faixa: RemoteAudioTrack | undefined, volume: number) {
  if (!faixa) return;
  // Acima de 100% sem o caminho de Web Audio, o navegador prenderia em 1 sem avisar. Melhor entregar
  // o máximo que existe do que fingir um número que não acontece.
  const conseguiu = volume > 1 ? ligarReforco(faixa) : true;
  faixa.setVolume(conseguiu ? volume : Math.min(1, volume));
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
    aplicarVolumeDaTela(screenAudioTrack(room, userId), getScreenVolume(userId));
  }
}
