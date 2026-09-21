import { VideoTrack, isTrackReference, useTracks } from '@livekit/components-react';
import { Track } from 'livekit-client';
import { useState } from 'react';
import { createPortal } from 'react-dom';

const WIDTH = 280;
const HEIGHT = 190; // vídeo 16:9 mais a legenda

/**
 * Espiada no que alguém está compartilhando, ao passar o mouse pelo "AO VIVO" da barra lateral (como no
 * Discord). A imagem só existe para quem já está na mesma sala: o vídeo vem da chamada, não do servidor.
 */
export function LivePreview({ userId, username, connected }: { userId: number; username: string; connected: boolean }) {
  // A prévia é desenhada fora da barra lateral (portal): dentro dela, a rolagem cortaria a janelinha.
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const screens = useTracks([{ source: Track.Source.ScreenShare, withPlaceholder: false }], { onlySubscribed: false });
  const screen = screens.find((track) => track.participant.identity === String(userId));

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
        aria-label={`Ver o que ${username} está compartilhando`}
        onMouseEnter={(e) => show(e.currentTarget)}
        onMouseLeave={() => setAt(null)}
        onFocus={(e) => show(e.currentTarget)}
        onBlur={() => setAt(null)}
      >
        AO VIVO
      </span>
      {at &&
        createPortal(
          <div className="live-preview" role="tooltip" style={{ top: at.top, left: at.left, width: WIDTH }}>
            {isTrackReference(screen) ? (
              <VideoTrack trackRef={screen} />
            ) : (
              <div className="live-preview-empty">{connected ? 'Carregando a imagem…' : 'Entre na sala para ver a tela.'}</div>
            )}
            <div className="live-preview-caption">{username} está compartilhando a tela</div>
          </div>,
          document.body,
        )}
    </>
  );
}
