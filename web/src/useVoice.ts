import {
  ConnectionState,
  type LocalParticipant,
  type Participant,
  type RemoteParticipant,
  Room,
  RoomEvent,
  ScreenSharePresets,
  Track,
  type TrackPublication,
  VideoPreset,
  VideoPresets,
} from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { api } from './api';
import { getDirectory } from './directory';
import { type ScreenQuality, getSettings, updateSettings } from './settings';
import { playSoundboard } from './soundboard';
import { applyAllVolumes } from './voiceVolumes';
import { sounds } from './sounds';

export interface LocalMedia {
  muted: boolean;
  video: boolean;
  screen: boolean;
}

function readLocalMedia(lp: LocalParticipant): LocalMedia {
  return { muted: !lp.isMicrophoneEnabled, video: lp.isCameraEnabled, screen: lp.isScreenShareEnabled };
}

// Qualidade do compartilhamento de tela escolhida nas configurações.
const SCREEN_PRESETS: Record<ScreenQuality, VideoPreset> = {
  light: ScreenSharePresets.h720fps30, // até 2 Mbps
  standard: ScreenSharePresets.h1080fps30, // até 5 Mbps
  smooth: new VideoPreset(1920, 1080, 8_000_000, 60), // jogos; até 8 Mbps
};

/**
 * Quando falta banda ou processador, o navegador precisa escolher o que sacrificar. Em jogo, imagem travada
 * é pior que imagem menos nítida, então mandamos ele manter os quadros por segundo; em apresentação de slides
 * ou planilha, o contrário: melhor nitidez e menos quadros.
 */
const SCREEN_HINTS: Record<ScreenQuality, { contentHint: 'motion' | 'detail'; degradation: RTCDegradationPreference }> = {
  light: { contentHint: 'detail', degradation: 'maintain-resolution' },
  standard: { contentHint: 'detail', degradation: 'balanced' },
  smooth: { contentHint: 'motion', degradation: 'maintain-framerate' },
};

const SOUNDBOARD_TOPIC = 'soundboard';
const SEND_COOLDOWN_MS = 1500;
const RECEIVE_COOLDOWN_MS = 1000;
const SOUND_BADGE_MS = 2500;

function isCancelledPicker(error: unknown) {
  return error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'AbortError');
}

/**
 * Conta ao servidor um problema que só acontece no computador da pessoa (microfone bloqueado, voz barrada
 * pela rede). Vira uma linha no diário da aba de saúde, e é assim que o administrador descobre o que houve
 * sem precisar perguntar. Falhar aqui não pode atrapalhar nada, então o erro é engolido.
 */
function reportProblem(kind: 'microfone' | 'câmera' | 'conexão', message: string) {
  void api('/api/client-errors', { method: 'POST', body: { kind, message } }).catch(() => {});
}

/**
 * O navegador diz por que o microfone (ou a câmera) não abriu, e cada motivo tem uma saída diferente.
 * Sem isso, todo problema virava "libere a permissão", o que não ajuda quem tem o aparelho ocupado por
 * outro programa, por exemplo.
 */
function deviceErrorMessage(error: unknown, device: 'microfone' | 'câmera') {
  const name = error instanceof DOMException ? error.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return `Sem acesso ao ${device}: o navegador bloqueou. Clique no cadeado na barra de endereço, permita o ${device} e tente de novo.`;
    case 'NotFoundError':
    case 'OverconstrainedError':
      return `Nenhum ${device} encontrado. Ligue o aparelho e confira se ele aparece em Configurações → Voz e vídeo.`;
    case 'NotReadableError':
    case 'AbortError':
      return `O ${device} está ocupado por outro programa (jogo, Discord, OBS). Feche o outro programa ou escolha outro aparelho em Configurações → Voz e vídeo.`;
    default:
      return `Não foi possível usar o ${device}. Tente escolher outro aparelho em Configurações → Voz e vídeo.`;
  }
}

export type Voice = ReturnType<typeof useVoice>;

/**
 * Mantém uma única conexão com o LiveKit que sobrevive à navegação entre canais (como no Discord),
 * e espelha o estado local (mudo, câmera, tela) no servidor para a barra lateral de todos.
 */
export function useVoice(socket: Socket | null) {
  const [room] = useState(() => {
    const settings = getSettings();
    return new Room({
      adaptiveStream: true, // só baixa a resolução que o elemento de vídeo realmente mostra
      dynacast: true, // pausa camadas de vídeo que ninguém está assistindo
      audioCaptureDefaults: {
        echoCancellation: settings.echoCancellation,
        noiseSuppression: settings.noiseSuppression,
        autoGainControl: true,
        deviceId: settings.audioInput || undefined,
      },
      videoCaptureDefaults: { resolution: VideoPresets.h720.resolution, deviceId: settings.videoInput || undefined },
      audioOutput: settings.audioOutput ? { deviceId: settings.audioOutput } : undefined,
      publishDefaults: { screenShareEncoding: ScreenSharePresets.h1080fps30.encoding, dtx: true, red: true },
    });
  });
  const [channelId, setChannelId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [media, setMedia] = useState<LocalMedia>({ muted: false, video: false, screen: false });
  const [deafened, setDeafened] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs para os handlers de eventos lerem o valor atual sem precisar se reinscrever.
  const channelRef = useRef<number | null>(null);
  const deafenedRef = useRef(false);
  const socketRef = useRef(socket);
  socketRef.current = socket;

  useEffect(() => {
    const lp = room.localParticipant;
    const sync = () => {
      const next = readLocalMedia(lp);
      setMedia(next);
      if (channelRef.current !== null) socketRef.current?.emit('voice:update', next);
    };
    const syncIfLocal = (_: TrackPublication, participant: Participant) => {
      if (participant === lp) sync();
    };
    const onDisconnected = () => {
      if (channelRef.current !== null) socketRef.current?.emit('voice:leave');
      channelRef.current = null;
      deafenedRef.current = false;
      setChannelId(null);
      setDeafened(false);
      setMedia(readLocalMedia(lp));
    };

    room
      .on(RoomEvent.LocalTrackPublished, sync)
      .on(RoomEvent.LocalTrackUnpublished, sync)
      .on(RoomEvent.TrackMuted, syncIfLocal)
      .on(RoomEvent.TrackUnmuted, syncIfLocal)
      .on(RoomEvent.Disconnected, onDisconnected);
    return () => {
      room
        .off(RoomEvent.LocalTrackPublished, sync)
        .off(RoomEvent.LocalTrackUnpublished, sync)
        .off(RoomEvent.TrackMuted, syncIfLocal)
        .off(RoomEvent.TrackUnmuted, syncIfLocal)
        .off(RoomEvent.Disconnected, onDisconnected);
    };
  }, [room]);

  // Volume que você escolheu para cada pessoa vale de novo sempre que ela chega ou volta a falar.
  useEffect(() => {
    const restore = () => applyAllVolumes(room);
    room
      .on(RoomEvent.ParticipantConnected, restore)
      .on(RoomEvent.TrackSubscribed, restore)
      .on(RoomEvent.Connected, restore);
    return () => {
      room
        .off(RoomEvent.ParticipantConnected, restore)
        .off(RoomEvent.TrackSubscribed, restore)
        .off(RoomEvent.Connected, restore);
    };
  }, [room]);

  // Sons de aviso, como no Discord: alguém entrou, saiu ou começou a compartilhar a tela.
  useEffect(() => {
    // Ao sairmos, o LiveKit remove os outros participantes da memória; isso não é "alguém saiu".
    const onParticipantLeft = () => {
      if (room.state === ConnectionState.Connected) sounds.userLeave();
    };
    const onPublished = (publication: TrackPublication) => {
      if (publication.source === Track.Source.ScreenShare) sounds.screenShareStart();
    };
    room
      .on(RoomEvent.ParticipantConnected, sounds.userJoin)
      .on(RoomEvent.ParticipantDisconnected, onParticipantLeft)
      .on(RoomEvent.TrackPublished, onPublished)
      .on(RoomEvent.LocalTrackPublished, onPublished);
    return () => {
      room
        .off(RoomEvent.ParticipantConnected, sounds.userJoin)
        .off(RoomEvent.ParticipantDisconnected, onParticipantLeft)
        .off(RoomEvent.TrackPublished, onPublished)
        .off(RoomEvent.LocalTrackPublished, onPublished);
    };
  }, [room]);

  // Soundboard: o ícone do som aparece por alguns segundos no quadro de quem tocou.
  const [recentSounds, setRecentSounds] = useState<Map<string, { icon: string; key: number }>>(new Map());
  const lastSentRef = useRef(0);
  const lastHeardRef = useRef(new Map<string, number>());

  const showSound = useCallback((identity: string, icon: string) => {
    const key = Date.now() + Math.random();
    setRecentSounds((map) => new Map(map).set(identity, { icon, key }));
    setTimeout(() => {
      setRecentSounds((map) => {
        if (map.get(identity)?.key !== key) return map; // já foi substituído por um som mais novo
        const next = new Map(map);
        next.delete(identity);
        return next;
      });
    }, SOUND_BADGE_MS);
  }, []);

  useEffect(() => {
    const onData = (payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      if (topic !== SOUNDBOARD_TOPIC || !participant) return;
      let soundId: unknown;
      try {
        soundId = JSON.parse(new TextDecoder().decode(payload)).soundId;
      } catch {
        return;
      }
      const sound = getDirectory().sounds.find((s) => s.id === soundId);
      if (!sound) return;
      // Ignora repetição rápida da mesma pessoa (clique duplo, cliente modificado).
      const now = Date.now();
      if (now - (lastHeardRef.current.get(participant.identity) ?? 0) < RECEIVE_COOLDOWN_MS) return;
      lastHeardRef.current.set(participant.identity, now);
      if (!deafenedRef.current) playSoundboard(sound.id);
      showSound(participant.identity, sound.icon);
    };
    room.on(RoomEvent.DataReceived, onData);
    return () => {
      room.off(RoomEvent.DataReceived, onData);
    };
  }, [room, showSound]);

  const playSound = useCallback(
    async (soundId: number) => {
      const sound = getDirectory().sounds.find((s) => s.id === soundId);
      if (!sound || channelRef.current === null) return;
      const now = Date.now();
      if (now - lastSentRef.current < SEND_COOLDOWN_MS) return;
      lastSentRef.current = now;
      if (!deafenedRef.current) playSoundboard(sound.id);
      showSound(room.localParticipant.identity, sound.icon);
      await room.localParticipant
        .publishData(new TextEncoder().encode(JSON.stringify({ soundId })), { reliable: true, topic: SOUNDBOARD_TOPIC })
        .catch(console.error);
    },
    [room, showSound],
  );

  // Se o socket cair e voltar (ou o servidor reiniciar), reanuncia em qual sala estamos.
  useEffect(() => {
    if (!socket) return;
    const onConnect = () => {
      if (channelRef.current === null) return;
      socket.emit('voice:join', { channelId: channelRef.current });
      socket.emit('voice:update', { ...readLocalMedia(room.localParticipant), deafened: deafenedRef.current });
    };
    socket.on('connect', onConnect);
    return () => {
      socket.off('connect', onConnect);
    };
  }, [socket, room]);

  // Sai da chamada ao fechar a página e também quando a tela principal desmonta (ex.: sessão expirada
  // manda de volta ao login); senão a conexão ficaria aberta por trás, com o microfone ligado.
  useEffect(() => {
    const leaveOnClose = () => void room.disconnect();
    window.addEventListener('pagehide', leaveOnClose);
    return () => {
      window.removeEventListener('pagehide', leaveOnClose);
      void room.disconnect();
    };
  }, [room]);

  const join = useCallback(
    async (id: number) => {
      if (channelRef.current === id || connecting || !socketRef.current) return;
      setError(null);
      setConnecting(true);
      // Chamado dentro do clique, para o navegador liberar a reprodução de áudio.
      void room.startAudio();
      try {
        if (room.state !== ConnectionState.Disconnected) await room.disconnect();
        const { url, token } = await api<{ url: string; token: string }>(`/api/channels/${id}/voice-token`, {
          method: 'POST',
        });
        await room.connect(url, token);
        channelRef.current = id;
        setChannelId(id);
        socketRef.current.emit('voice:join', { channelId: id });
        sounds.selfJoin();
      } catch (e) {
        console.error(e);
        // Causa mais comum: bloqueador de anúncios ou antivírus derrubando a conexão com o servidor de voz,
        // que fica num endereço gratuito (duckdns.org) presente em várias listas de bloqueio.
        setError('Não foi possível conectar à sala de voz. Se você usa bloqueador de anúncios (uBlock, AdGuard), antivírus com proteção web ou VPN, desative para este site e tente de novo.');
        reportProblem('conexão', 'Não conseguiu conectar à sala de voz (provável bloqueio de rede).');
        setConnecting(false);
        return;
      }
      setConnecting(false);
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
      } catch (e) {
        console.error(e);
        const message = deviceErrorMessage(e, 'microfone');
        setError(message);
        reportProblem('microfone', message);
      }
    },
    [room, connecting],
  );

  /**
   * Troca a qualidade da transmissão em andamento sem pedir para escolher a tela de novo: mexe direto nos
   * parâmetros de envio (quadros por segundo e taxa) do que já está sendo enviado.
   */
  const setScreenQuality = useCallback(
    async (quality: ScreenQuality) => {
      updateSettings({ screenQuality: quality });
      const track = room.localParticipant.getTrackPublication(Track.Source.ScreenShare)?.videoTrack;
      const sender = track?.sender;
      if (!track || !sender) return;

      const preset = SCREEN_PRESETS[quality];
      const hints = SCREEN_HINTS[quality];
      track.mediaStreamTrack.contentHint = hints.contentHint;
      const parameters = sender.getParameters();
      parameters.degradationPreference = hints.degradation;
      for (const encoding of parameters.encodings) {
        // Com camadas, as menores mantêm a proporção de taxa que já tinham.
        const share = encoding.maxBitrate ? encoding.maxBitrate / Math.max(...parameters.encodings.map((e) => e.maxBitrate ?? 1)) : 1;
        encoding.maxFramerate = preset.encoding.maxFramerate;
        encoding.maxBitrate = Math.round(preset.encoding.maxBitrate * share);
      }
      await sender.setParameters(parameters).catch(console.error);
    },
    [room],
  );

  const leave = useCallback(() => {
    if (channelRef.current !== null) sounds.selfLeave();
    void room.disconnect();
  }, [room]);

  const setDeafenedState = useCallback((value: boolean) => {
    deafenedRef.current = value;
    setDeafened(value);
    socketRef.current?.emit('voice:update', { deafened: value });
  }, []);

  const toggleMute = useCallback(async () => {
    const lp = room.localParticipant;
    const enable = !lp.isMicrophoneEnabled;
    try {
      await lp.setMicrophoneEnabled(enable);
      if (enable && deafenedRef.current) setDeafenedState(false); // falar implica ouvir, como no Discord
      (enable ? sounds.unmute : sounds.mute)();
    } catch (e) {
      console.error(e);
      const message = deviceErrorMessage(e, 'microfone');
      setError(message);
      reportProblem('microfone', message);
    }
  }, [room, setDeafenedState]);

  const toggleDeafen = useCallback(async () => {
    const next = !deafenedRef.current;
    setDeafenedState(next);
    (next ? sounds.deafen : sounds.undeafen)();
    await room.localParticipant.setMicrophoneEnabled(!next).catch(console.error);
  }, [room, setDeafenedState]);

  const toggleCamera = useCallback(async () => {
    const lp = room.localParticipant;
    try {
      await lp.setCameraEnabled(!lp.isCameraEnabled);
    } catch (e) {
      console.error(e);
      const message = deviceErrorMessage(e, 'câmera');
      setError(message);
      reportProblem('câmera', message);
    }
  }, [room]);

  const toggleScreen = useCallback(async () => {
    const lp = room.localParticipant;
    const quality = getSettings().screenQuality;
    const preset = SCREEN_PRESETS[quality];
    const hints = SCREEN_HINTS[quality];
    try {
      await lp.setScreenShareEnabled(
        !lp.isScreenShareEnabled,
        {
          contentHint: hints.contentHint,
          audio: true, // áudio da aba/sistema, quando o navegador suporta
          systemAudio: 'include',
          selfBrowserSurface: 'exclude',
          // Quase sempre a pessoa quer mostrar a tela inteira (um jogo, por exemplo), não a aba do navegador:
          // o Chrome e o Edge já abrem o seletor em "Tela inteira" por causa disto.
          video: { displaySurface: 'monitor' },
          preferCurrentTab: false,
          surfaceSwitching: 'include', // deixa trocar o que está sendo mostrado sem parar o compartilhamento
          resolution: preset.resolution,
        },
        { screenShareEncoding: preset.encoding, degradationPreference: hints.degradation },
      );
    } catch (e) {
      // Fechar o seletor de tela sem escolher nada não é erro.
      if (!isCancelledPicker(e)) {
        console.error(e);
        setError('Não foi possível compartilhar a tela neste navegador.');
      }
    }
  }, [room]);

  /** Troca microfone, alto-falante ou câmera; vale na hora e fica salvo para as próximas vezes. */
  const switchDevice = useCallback(
    async (kind: 'audioinput' | 'audiooutput' | 'videoinput', deviceId: string) => {
      const key = { audioinput: 'audioInput', audiooutput: 'audioOutput', videoinput: 'videoInput' } as const;
      updateSettings({ [key[kind]]: deviceId });
      try {
        if (deviceId || kind !== 'videoinput') {
          // 'default' é o dispositivo padrão do sistema para microfone e alto-falante.
          await room.switchActiveDevice(kind, deviceId || 'default', false);
        } else {
          room.options.videoCaptureDefaults = { ...room.options.videoCaptureDefaults, deviceId: undefined };
        }
      } catch (e) {
        console.error(e);
        setError('Não foi possível trocar o dispositivo.');
      }
    },
    [room],
  );

  /** Liga ou desliga supressão de ruído e cancelamento de eco, reiniciando o microfone se ele estiver em uso. */
  const setAudioProcessing = useCallback(
    async (patch: { noiseSuppression?: boolean; echoCancellation?: boolean }) => {
      updateSettings(patch);
      room.options.audioCaptureDefaults = { ...room.options.audioCaptureDefaults, ...patch };
      const track = room.localParticipant.getTrackPublication(Track.Source.Microphone)?.audioTrack;
      if (!track) return;
      const wasMuted = track.isMuted;
      try {
        await track.restartTrack(room.options.audioCaptureDefaults);
        if (wasMuted) await track.mute();
      } catch (e) {
        console.error(e);
        setError('Não foi possível aplicar a configuração do microfone.');
      }
    },
    [room],
  );

  return {
    room,
    channelId,
    connecting,
    media,
    deafened,
    error,
    clearError: () => setError(null),
    join,
    leave,
    toggleMute,
    toggleDeafen,
    toggleCamera,
    toggleScreen,
    setScreenQuality,
    switchDevice,
    setAudioProcessing,
    recentSounds,
    playSound,
  };
}
