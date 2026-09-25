import { VideoTrack, isTrackReference, useTracks } from '@livekit/components-react';
import { type RemoteTrack, type RemoteTrackPublication, Room, RoomEvent, Track } from 'livekit-client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from './api';

const WIDTH = 320;
const HEIGHT = 216; // vídeo 16:9 mais a legenda

/**
 * Espiada no que alguém está compartilhando, ao passar o mouse pelo "AO VIVO" da barra lateral (como no
 * Discord). Serve justamente para decidir se vale a pena entrar na sala: quem ainda não está nela entra
 * invisível, só para receber essa imagem, e sai assim que tira o mouse.
 */
export function LivePreview({
  userId,
  username,
  transmitindo,
  channelId,
  connected,
}: {
  userId: number;
  username: string;
  /** O que a pessoa está transmitindo, quando dá para saber. */
  transmitindo?: string | null;
  channelId: number;
  connected: boolean;
}) {
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const open = at !== null;

  // Quem já está na sala tem o vídeo em mãos; quem não está precisa espiar por uma conexão à parte.
  const screens = useTracks([{ source: Track.Source.ScreenShare, withPlaceholder: false }], { onlySubscribed: false });
  const inRoom = connected ? screens.find((track) => track.participant.identity === String(userId)) : undefined;
  const peeked = usePeekScreen({ channelId, userId, active: open && !connected });

  function show(element: HTMLElement) {
    const badge = element.getBoundingClientRect();
    setAt({
      top: Math.min(Math.max(badge.top - HEIGHT / 2, 8), window.innerHeight - HEIGHT - 8),
      left: Math.min(badge.right + 10, window.innerWidth - WIDTH - 8),
    });
  }

  return (
    <>
      <span
        className="live-badge"
        tabIndex={0}
        role="button"
        aria-label={transmitindo ? `Ver ${username} transmitindo ${transmitindo}` : `Ver o que ${username} está compartilhando`}
        onMouseEnter={(e) => show(e.currentTarget)}
        onMouseLeave={() => setAt(null)}
        onFocus={(e) => show(e.currentTarget)}
        onBlur={() => setAt(null)}
      >
        AO VIVO
      </span>
      {at &&
        // Desenhada fora da barra lateral: dentro dela, a rolagem cortaria a janelinha.
        createPortal(
          <div className="live-preview" role="tooltip" style={{ top: at.top, left: at.left, width: WIDTH }}>
            {isTrackReference(inRoom) ? (
              <VideoTrack trackRef={inRoom} />
            ) : peeked.track ? (
              <PeekVideo track={peeked.track} />
            ) : (
              <div className="live-preview-empty">{peeked.error ?? 'Carregando a imagem…'}</div>
            )}
            <div className="live-preview-caption">
              {transmitindo ? `${username} está transmitindo ${transmitindo}` : `${username} está compartilhando a tela`}
              {!connected && <span className="live-preview-hint">Clique na sala para entrar e assistir.</span>}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/** Mostra um vídeo que veio da conexão de espiada (fora do contexto da chamada principal). */
function PeekVideo({ track }: { track: RemoteTrack }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    track.attach(element);
    return () => {
      track.detach(element);
    };
  }, [track]);
  return <video ref={ref} muted playsInline autoPlay />;
}

/**
 * Liga-se à sala como ouvinte invisível enquanto o mouse está sobre o selo, e desliga ao sair. O áudio não é
 * assinado: a espiada mostra só a imagem, e não faz o som da sala tocar para quem está de fora.
 */
function usePeekScreen({ channelId, userId, active }: { channelId: number; userId: number; active: boolean }) {
  const [track, setTrack] = useState<RemoteTrack | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active) {
      setTrack(null);
      setError(null);
      return;
    }
    let room: Room | null = null;
    let cancelled = false;

    const isTheScreen = (publication: RemoteTrackPublication, identity: string) =>
      publication.source === Track.Source.ScreenShare && identity === String(userId);

    (async () => {
      try {
        const { url, token } = await api<{ url: string; token: string }>(`/api/channels/${channelId}/peek-token`, {
          method: 'POST',
        });
        if (cancelled) return;
        room = new Room({ adaptiveStream: false, dynacast: false });
        room.on(RoomEvent.TrackSubscribed, (subscribed, publication, participant) => {
          if (isTheScreen(publication, participant.identity)) setTrack(subscribed);
        });
        await room.connect(url, token, { autoSubscribe: false });
        if (cancelled) return void room.disconnect();
        for (const participant of room.remoteParticipants.values()) {
          for (const publication of participant.trackPublications.values()) {
            if (isTheScreen(publication, participant.identity)) publication.setSubscribed(true);
          }
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setError('Não foi possível carregar a prévia.');
      }
    })();

    return () => {
      cancelled = true;
      setTrack(null);
      void room?.disconnect();
    };
  }, [active, channelId, userId]);

  return { track, error };
}
