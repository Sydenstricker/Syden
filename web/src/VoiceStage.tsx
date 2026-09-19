import {
  isTrackReference,
  ParticipantTile,
  StartAudio,
  type TrackReferenceOrPlaceholder,
  useIsMuted,
  useIsSpeaking,
  useTracks,
  VideoTrack,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import {
  AudioLines,
  HeadphoneOff,
  Headphones,
  Maximize,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  PhoneOff,
  Video,
  VideoOff,
  Volume2,
} from 'lucide-react';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { Avatar } from './Avatar';
import { useDirectory } from './directory';
import { IconButton } from './Sidebar';
import type { Channel, VoiceMember } from './types';
import type { Voice } from './useVoice';

function trackKey(ref: TrackReferenceOrPlaceholder) {
  return `${ref.participant.identity}:${ref.source}`;
}

/** Cartões menores conforme a sala enche, para caber todo mundo sem rolagem. */
function cardSize(count: number) {
  if (count <= 2) return { width: 360, avatar: 80 };
  if (count <= 4) return { width: 300, avatar: 80 };
  if (count <= 9) return { width: 240, avatar: 64 };
  return { width: 180, avatar: 56 };
}

export function VoiceStage({ channel, voice, members }: { channel: Channel; voice: Voice; members: VoiceMember[] }) {
  const inThisRoom = voice.channelId === channel.id;

  return (
    <div className="voice-stage">
      <header className="main-header">
        <Volume2 size={22} className="muted-icon" /> {channel.name}
      </header>
      {inThisRoom ? (
        <Stage voice={voice} members={members} />
      ) : (
        <div className="voice-lobby">
          <div className="voice-lobby-avatars">
            {members.map((m) => (
              <Avatar key={m.userId} name={m.username} userId={m.userId} size={64} />
            ))}
          </div>
          <h2>{channel.name}</h2>
          <p>{members.length === 0 ? 'Ninguém na sala ainda.' : `${members.map((m) => m.username).join(', ')} na sala.`}</p>
          <button className="btn-primary" disabled={voice.connecting} onClick={() => voice.join(channel.id)}>
            {voice.connecting ? 'Conectando…' : 'Entrar na sala'}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Quadro de uma pessoa: o vídeo da câmera quando ela está ligada; senão, o avatar pequeno no centro,
 * como no Discord (a silhueta padrão do LiveKit esticava até ocupar o quadro inteiro).
 */
function PersonTile({
  trackRef,
  member,
  avatarSize,
  sound,
}: {
  trackRef: TrackReferenceOrPlaceholder;
  member?: VoiceMember;
  avatarSize: number;
  /** Som do soundboard que a pessoa acabou de tocar. */
  sound?: { icon: string; key: number };
}) {
  const speaking = useIsSpeaking(trackRef.participant);
  const cameraMuted = useIsMuted(trackRef);
  const name = trackRef.participant.name || trackRef.participant.identity;

  return (
    <ParticipantTile trackRef={trackRef}>
      {isTrackReference(trackRef) && !cameraMuted ? (
        <VideoTrack trackRef={trackRef} />
      ) : (
        <div className="tile-avatar">
          <Avatar name={name} userId={Number(trackRef.participant.identity)} size={avatarSize} speaking={speaking} />
        </div>
      )}
      <div className="tile-name">
        {member?.deafened ? <HeadphoneOff size={14} /> : member?.muted && <MicOff size={14} />}
        <span>{name}</span>
      </div>
      {sound && (
        <span key={sound.key} className="tile-sound" aria-hidden="true">
          {sound.icon}
        </span>
      )}
    </ParticipantTile>
  );
}

/** Painel do soundboard: clicar num som toca para todos na sala. */
function Soundboard({ voice, onClose }: { voice: Voice; onClose: () => void }) {
  const { sounds } = useDirectory();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    const onPointer = (event: PointerEvent) => {
      // Fecha ao clicar fora (o próprio botão do soundboard fica fora, mas ele mesmo alterna).
      if (!ref.current?.parentElement?.contains(event.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [onClose]);

  return (
    <div className="soundboard" ref={ref} role="dialog" aria-label="Soundboard">
      <div className="soundboard-title">Soundboard</div>
      {sounds.length === 0 ? (
        <p className="soundboard-empty">Nenhum som ainda. Adicione em Configurações → Soundboard.</p>
      ) : (
        <div className="soundboard-grid">
          {sounds.map((sound) => (
            <button key={sound.id} className="soundboard-sound" onClick={() => void voice.playSound(sound.id)}>
              <span className="soundboard-icon">{sound.icon}</span>
              <span className="soundboard-name">{sound.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Stage({ voice, members }: { voice: Voice; members: VoiceMember[] }) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const [pinned, setPinned] = useState<string | null>(null);
  const [soundboardOpen, setSoundboardOpen] = useState(false);
  const focusRef = useRef<HTMLDivElement>(null);

  // Foco: o que o usuário fixou; senão, a primeira tela compartilhada (como o Discord faz).
  const focused =
    tracks.find((t) => trackKey(t) === pinned) ?? tracks.find((t) => t.source === Track.Source.ScreenShare);
  const others = focused ? tracks.filter((t) => t !== focused) : tracks;
  const card = cardSize(tracks.length);

  const togglePin = (ref: TrackReferenceOrPlaceholder) =>
    setPinned(focused && trackKey(focused) === trackKey(ref) ? null : trackKey(ref));

  const tile = (ref: TrackReferenceOrPlaceholder, avatarSize: number) => (
    <div key={trackKey(ref)} className="tile" onClick={() => togglePin(ref)}>
      {ref.source === Track.Source.Camera ? (
        <PersonTile
          trackRef={ref}
          member={members.find((m) => String(m.userId) === ref.participant.identity)}
          avatarSize={avatarSize}
          sound={voice.recentSounds.get(ref.participant.identity)}
        />
      ) : (
        <ParticipantTile trackRef={ref} />
      )}
    </div>
  );

  return (
    <div className="stage" data-lk-theme="default">
      {focused ? (
        <div className="stage-focus">
          <div className="stage-main" ref={focusRef}>
            {tile(focused, 80)}
            <button
              className="fullscreen-button"
              title="Tela cheia"
              onClick={() => void focusRef.current?.requestFullscreen()}
            >
              <Maximize size={18} />
            </button>
          </div>
          {others.length > 0 && <div className="stage-strip">{others.map((ref) => tile(ref, 48))}</div>}
        </div>
      ) : (
        // Sem tela compartilhada: cartões de tamanho fixo, centralizados, como no Discord.
        <div className="stage-cards" style={{ '--card-width': `${card.width}px` } as CSSProperties}>
          {tracks.map((ref) => tile(ref, card.avatar))}
        </div>
      )}

      <StartAudio label="Clique para ativar o áudio" className="start-audio" />

      <div className="stage-controls">
        <IconButton
          label={voice.media.muted ? 'Ativar microfone' : 'Silenciar'}
          danger={voice.media.muted}
          onClick={voice.toggleMute}
        >
          {voice.media.muted ? <MicOff /> : <Mic />}
        </IconButton>
        <IconButton label={voice.deafened ? 'Ativar áudio' : 'Desativar áudio'} danger={voice.deafened} onClick={voice.toggleDeafen}>
          {voice.deafened ? <HeadphoneOff /> : <Headphones />}
        </IconButton>
        <IconButton label={voice.media.video ? 'Desligar câmera' : 'Ligar câmera'} active={voice.media.video} onClick={voice.toggleCamera}>
          {voice.media.video ? <Video /> : <VideoOff />}
        </IconButton>
        <IconButton
          label={voice.media.screen ? 'Parar de compartilhar' : 'Compartilhar tela'}
          active={voice.media.screen}
          onClick={voice.toggleScreen}
        >
          {voice.media.screen ? <MonitorOff /> : <Monitor />}
        </IconButton>
        <div className="soundboard-anchor">
          <IconButton label="Soundboard" active={soundboardOpen} onClick={() => setSoundboardOpen(!soundboardOpen)}>
            <AudioLines />
          </IconButton>
          {soundboardOpen && <Soundboard voice={voice} onClose={() => setSoundboardOpen(false)} />}
        </div>
        <button className="leave-button" title="Desconectar" onClick={voice.leave}>
          <PhoneOff />
        </button>
      </div>
    </div>
  );
}
