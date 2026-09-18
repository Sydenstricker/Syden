import {
  ConnectionState,
  type LocalParticipant,
  type Participant,
  Room,
  RoomEvent,
  ScreenSharePresets,
  type TrackPublication,
  VideoPresets,
} from 'livekit-client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { api } from './api';

export interface LocalMedia {
  muted: boolean;
  video: boolean;
  screen: boolean;
}

function readLocalMedia(lp: LocalParticipant): LocalMedia {
  return { muted: !lp.isMicrophoneEnabled, video: lp.isCameraEnabled, screen: lp.isScreenShareEnabled };
}

function isCancelledPicker(error: unknown) {
  return error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'AbortError');
}

export type Voice = ReturnType<typeof useVoice>;

/**
 * Mantém uma única conexão com o LiveKit que sobrevive à navegação entre canais (como no Discord),
 * e espelha o estado local (mudo, câmera, tela) no servidor para a barra lateral de todos.
 */
export function useVoice(socket: Socket | null) {
  const [room] = useState(
    () =>
      new Room({
        adaptiveStream: true, // só baixa a resolução que o elemento de vídeo realmente mostra
        dynacast: true, // pausa camadas de vídeo que ninguém está assistindo
        audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        videoCaptureDefaults: { resolution: VideoPresets.h720.resolution },
        publishDefaults: { screenShareEncoding: ScreenSharePresets.h1080fps30.encoding, dtx: true, red: true },
      }),
  );
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

  useEffect(() => {
    const leaveOnClose = () => void room.disconnect();
    window.addEventListener('pagehide', leaveOnClose);
    return () => window.removeEventListener('pagehide', leaveOnClose);
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
      } catch (e) {
        console.error(e);
        setError('Não foi possível conectar à sala de voz.');
        setConnecting(false);
        return;
      }
      setConnecting(false);
      try {
        await room.localParticipant.setMicrophoneEnabled(true);
      } catch (e) {
        console.error(e);
        setError('Sem acesso ao microfone. Libere a permissão no navegador (ícone do cadeado na barra de endereço).');
      }
    },
    [room, connecting],
  );

  const leave = useCallback(() => void room.disconnect(), [room]);

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
    } catch (e) {
      console.error(e);
      setError('Sem acesso ao microfone. Libere a permissão no navegador.');
    }
  }, [room, setDeafenedState]);

  const toggleDeafen = useCallback(async () => {
    const next = !deafenedRef.current;
    setDeafenedState(next);
    await room.localParticipant.setMicrophoneEnabled(!next).catch(console.error);
  }, [room, setDeafenedState]);

  const toggleCamera = useCallback(async () => {
    const lp = room.localParticipant;
    try {
      await lp.setCameraEnabled(!lp.isCameraEnabled);
    } catch (e) {
      console.error(e);
      setError(
        isCancelledPicker(e)
          ? 'Sem acesso à câmera. Libere a permissão no navegador.'
          : 'Não foi possível ligar a câmera.',
      );
    }
  }, [room]);

  const toggleScreen = useCallback(async () => {
    const lp = room.localParticipant;
    try {
      await lp.setScreenShareEnabled(!lp.isScreenShareEnabled, {
        audio: true, // áudio da aba/sistema, quando o navegador suporta
        systemAudio: 'include',
        selfBrowserSurface: 'exclude',
        resolution: ScreenSharePresets.h1080fps30.resolution,
      });
    } catch (e) {
      // Fechar o seletor de tela sem escolher nada não é erro.
      if (!isCancelledPicker(e)) {
        console.error(e);
        setError('Não foi possível compartilhar a tela neste navegador.');
      }
    }
  }, [room]);

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
  };
}
