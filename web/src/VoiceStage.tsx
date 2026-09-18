import { ParticipantTile, StartAudio, type TrackReferenceOrPlaceholder, useTracks } from '@livekit/components-react';
import { Track } from 'livekit-client';
import {
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
import { useRef, useState } from 'react';
import { Avatar } from './Shell';
import { IconButton } from './Sidebar';
import type { Channel, VoiceMember } from './types';
import type { Voice } from './useVoice';

function trackKey(ref: TrackReferenceOrPlaceholder) {
  return `${ref.participant.identity}:${ref.source}`;
}

export function VoiceStage({ channel, voice, members }: { channel: Channel; voice: Voice; members: VoiceMember[] }) {
  const inThisRoom = voice.channelId === channel.id;

  return (
    <div className="voice-stage">
      <header className="main-header">
        <Volume2 size={22} className="muted-icon" /> {channel.name}
      </header>
      {inThisRoom ? (
        <Stage voice={voice} />
      ) : (
        <div className="voice-lobby">
          <div className="voice-lobby-avatars">
            {members.map((m) => (
              <Avatar key={m.userId} name={m.username} size={64} />
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

function Stage({ voice }: { voice: Voice }) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const [pinned, setPinned] = useState<string | null>(null);
  const focusRef = useRef<HTMLDivElement>(null);

  // Foco: o que o usuário fixou; senão, a primeira tela compartilhada (como o Discord faz).
  const focused =
    tracks.find((t) => trackKey(t) === pinned) ?? tracks.find((t) => t.source === Track.Source.ScreenShare);
  const others = focused ? tracks.filter((t) => t !== focused) : tracks;
  const cols = Math.ceil(Math.sqrt(tracks.length));

  const togglePin = (ref: TrackReferenceOrPlaceholder) =>
    setPinned(focused && trackKey(focused) === trackKey(ref) ? null : trackKey(ref));

  const tile = (ref: TrackReferenceOrPlaceholder) => (
    <div key={trackKey(ref)} className="tile" onClick={() => togglePin(ref)}>
      <ParticipantTile trackRef={ref} />
    </div>
  );

  return (
    <div className="stage" data-lk-theme="default">
      {focused ? (
        <div className="stage-focus">
          <div className="stage-main" ref={focusRef}>
            {tile(focused)}
            <button
              className="fullscreen-button"
              title="Tela cheia"
              onClick={() => void focusRef.current?.requestFullscreen()}
            >
              <Maximize size={18} />
            </button>
          </div>
          {others.length > 0 && <div className="stage-strip">{others.map(tile)}</div>}
        </div>
      ) : (
        <div className="stage-grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {tracks.map(tile)}
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
        <button className="leave-button" title="Desconectar" onClick={voice.leave}>
          <PhoneOff />
        </button>
      </div>
    </div>
  );
}
