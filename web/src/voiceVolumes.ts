import { type RemoteAudioTrack, type Room, Track, TrackEvent } from 'livekit-client';
import { criarTeto } from './limitador';
import { getSettings } from './settings';

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

/**
 * A VOZ DE CADA PESSOA VAI ATÉ 200% (pedido dele, 02/11/2026), pelo mesmo caminho do som da transmissão (ver
 * TETO_DA_TRANSMISSAO, abaixo): acima de 100% a faixa passa a tocar por Web Audio, com o limitador antes do ganho. É o
 * amigo de microfone baixo que se quer ouvir mais alto, e não um estouro no ouvido de quem ajusta.
 */
export const TETO_DA_VOZ = 2;

function apply(room: Room, userId: number) {
  const participant = room.remoteParticipants.get(String(userId));
  if (!participant) return;
  const volume = isLocallyMuted(userId) ? 0 : getUserVolume(userId);
  // O volume da PESSOA nunca passa de 1: o LiveKit o guarda e o repete em cada faixa que chega, e uma faixa ainda sem o
  // reforço o escreveria no `element.volume`, que dá erro acima de 1 e derruba o som. O que passa de 100% vai só na
  // faixa do microfone, depois de o reforço estar ligado; quando ela ainda não chegou, o TrackSubscribed devolve tudo.
  participant.setVolume(Math.min(1, volume));
  const microfone = participant.getTrackPublication(Track.Source.Microphone)?.track as RemoteAudioTrack | undefined;
  if (microfone) manterOZeroAoLigar(microfone, () => (isLocallyMuted(userId) ? 0 : getUserVolume(userId)));
  if (microfone && volume > 1) aplicarVolume(microfone, volume);
}

export function setUserVolume(room: Room, userId: number, volume: number) {
  volumes = { ...volumes, [String(userId)]: Math.min(TETO_DA_VOZ, Math.max(0, volume)) };
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
/**
 * O VOLUME GUARDADO NUNCA É ZERO (16/10/2026, relato dele: as transmissões de um amigo chegavam sem som, pela janela, pela
 * aba e pela tela inteira). Silenciar gravava 0 aqui — e isto sobe para a conta (preferencias.ts) — então quem calou a
 * transmissão de alguém uma vez passava a receber todas as transmissões dele mudas, em qualquer aparelho, sem nada na
 * tela dizer por quê. O mudo é da sessão (`caladas`, abaixo); o 0 que já estava gravado é descartado ao ler.
 */
let screenVolumes = Object.fromEntries(Object.entries(read<Record<string, number>>(SCREEN_KEY, {})).filter(([, v]) => typeof v === 'number' && v > 0));
/** As transmissões caladas nesta sessão (o clique no alto-falante, ou a régua levada a zero). */
const caladas = new Set<number>();

export function getScreenVolume(userId: number) {
  return caladas.has(userId) ? 0 : (screenVolumes[String(userId)] ?? 1);
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
 * dele existir), então o teto entra ANTES do ganho: o limitador segura os picos em -7 dB e o dobro
 * os leva a uns -0,6 dB, abaixo do estouro (ver criarTeto, com a compensação que o compressor aplica sozinho).
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
    if (!contextoDoReforco) {
      contextoDoReforco = new AudioContext();
      trocarSaidaDoReforco(getSettings().audioOutput);
    }
    // O contexto nasce suspenso quando a página ainda não teve gesto nenhum. Arrastando a régua sempre teve; mas o
    // volume acima de 100% GUARDADO é ligado sozinho quando o som chega (applyAllVolumes), e um contexto suspenso deixa
    // a transmissão muda. Por isso, além de tentar já, ele é retomado no próximo clique ou tecla da pessoa.
    const ctx = contextoDoReforco;
    void ctx.resume().catch(() => {});
    if (ctx.state !== 'running') {
      const retomar = () => { void ctx.resume().catch(() => {}); if (ctx.state === 'running') { removeEventListener('pointerdown', retomar, true); removeEventListener('keydown', retomar, true); } };
      addEventListener('pointerdown', retomar, true);
      addEventListener('keydown', retomar, true);
    }
    const teto = criarTeto(contextoDoReforco);
    if (teto && typeof interna.setWebAudioPlugins === 'function') interna.setWebAudioPlugins(teto);
    interna.setAudioContext(contextoDoReforco);
    jaReforcadas.add(faixa);
    return true;
  } catch (erro) {
    console.error(erro);
    return false;
  }
}

/**
 * O ALTO-FALANTE DO REFORÇO. Com o reforço ligado, quem decide para onde o som vai é o contexto, e não mais o elemento de
 * áudio: sem isto, a voz de um amigo a 150% saía nas caixas de som enquanto o resto da chamada tocava no fone (revisão de
 * 02/11/2026). O mesmo cuidado do soundboard.ts. Vazio é o padrão do sistema.
 */
export function trocarSaidaDoReforco(deviceId: string) {
  const ctx = contextoDoReforco as (AudioContext & { setSinkId?(id: string): Promise<void> }) | null;
  void ctx?.setSinkId?.(deviceId || '').catch(() => {});
}

/**
 * O ZERO QUE O LIVEKIT ESQUECE (09/11/2026, relato: "o botão de calar as lives não funciona").
 *
 * `RemoteAudioTrack.setVolume` guarda o volume em `elementVolume` e o repete em cada elemento de áudio que se liga DEPOIS
 * — mas a conferência dele é `if (this.elementVolume)`, e 0 é falso. A faixa chega (TrackSubscribed, que devolve os
 * volumes) ANTES de o RoomAudioRenderer ligá-la ao `<audio>`, num efeito do React: o 0 ia para uma faixa ainda sem
 * elemento, o elemento nascia a 100%, e a transmissão calada tocava alto com o botão dizendo "calada". Acontece a cada vez
 * que o som da tela é baixado de novo (fechar e abrir a transmissão, reconectar), e o mesmo vale para a voz de quem você
 * silenciou, que em sala grande é baixada de novo quando a pessoa volta a falar.
 *
 * Aqui, cada elemento novo recebe o 0 de novo. Num microtask, porque o evento sai no MEIO do `attach`: com o reforço, o
 * LiveKit cria o nó de ganho logo depois (com ganho 1), e um 0 posto antes iria para o nó velho.
 */
const vigiadas = new WeakSet<object>();
function manterOZeroAoLigar(faixa: RemoteAudioTrack, volumeAgora: () => number) {
  if (vigiadas.has(faixa) || typeof (faixa as { on?: unknown }).on !== 'function') return;
  vigiadas.add(faixa);
  faixa.on(TrackEvent.ElementAttached, () => {
    queueMicrotask(() => {
      if (volumeAgora() === 0) faixa.setVolume(0);
    });
  });
}

/** O clique no alto-falante: cala, e o clique seguinte devolve o volume que estava (que continua guardado). */
export function alternarMudoDaTela(room: Room, userId: number) {
  if (caladas.has(userId) || !(screenVolumes[String(userId)] ?? 1)) caladas.delete(userId);
  else caladas.add(userId);
  aplicarVolume(screenAudioTrack(room, userId), getScreenVolume(userId), userId);
  return getScreenVolume(userId);
}

export function setScreenVolume(room: Room, userId: number, volume: number) {
  const v = Math.min(TETO_DA_TRANSMISSAO, Math.max(0, volume));
  // A régua no zero é calar (desta sessão); acima dele, é o volume, e esse fica guardado.
  if (v === 0) caladas.add(userId);
  else {
    caladas.delete(userId);
    screenVolumes = { ...screenVolumes, [String(userId)]: v };
    write(SCREEN_KEY, screenVolumes);
    void import('./preferencias').then((m) => m.guardarEmBreve());
  }
  aplicarVolume(screenAudioTrack(room, userId), getScreenVolume(userId), userId);
}

/**
 * Põe o volume na faixa, ligando o reforço quando o pedido passa de 100%.
 *
 * Sem faixa não há o que fazer, e isso é NORMAL: a escolha fica guardada e vale quando o som chegar
 * (o TrackSubscribed devolve todos os volumes, ver useVoice.ts). Era daí a impressão de que o
 * controle não funcionava para uma transmissão cujo som ainda não tinha sido assinado.
 */
function aplicarVolume(faixa: RemoteAudioTrack | undefined, volume: number, userId?: number) {
  if (!faixa) return;
  if (userId !== undefined) manterOZeroAoLigar(faixa, () => getScreenVolume(userId));
  // Acima de 100% sem o caminho de Web Audio, o navegador prenderia em 1 sem avisar. Melhor entregar
  // o máximo que existe do que fingir um número que não acontece.
  const conseguiu = volume > 1 ? ligarReforco(faixa) : true;
  faixa.setVolume(conseguiu ? volume : Math.min(1, volume));
}

/** Ao entrar na sala (ou quando alguém chega), devolve a cada pessoa o volume que você tinha escolhido. */
export function applyAllVolumes(room: Room) {
  for (const [identity, participant] of room.remoteParticipants) {
    const userId = Number(identity);
    if (!Number.isFinite(userId)) continue;
    apply(room, userId);
    aplicarVolume(screenAudioTrack(room, userId), getScreenVolume(userId), userId);
  }
}
