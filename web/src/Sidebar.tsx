import { useSpeakingParticipants } from '@livekit/components-react';
import {
  Download,
  Hash,
  Headphones,
  HeadphoneOff,
  LogOut,
  Mic,
  MicOff,
  Monitor,
  PhoneOff,
  Plus,
  Video,
  Volume2,
} from 'lucide-react';
import { type KeyboardEvent, useState } from 'react';
import { api } from './api';
import { DESKTOP_DOWNLOAD_URL, showDesktopDownload } from './desktopDownload';
import { Avatar } from './Shell';
import type { Channel, User, VoiceMember } from './types';
import type { Voice } from './useVoice';

interface Props {
  user: User;
  channels: Channel[];
  selectedId: number | null;
  voiceMembers: VoiceMember[];
  voice: Voice;
  onSelect: (channel: Channel) => void;
  onLogout: () => void;
}

export function Sidebar({ user, channels, selectedId, voiceMembers, voice, onSelect, onLogout }: Props) {
  // Indicador de fala só existe para a sala em que estamos conectados (é o LiveKit que sabe quem fala).
  const speaking = new Set(useSpeakingParticipants().map((p) => p.identity));
  const connectedChannel = channels.find((c) => c.id === voice.channelId);

  return (
    <nav className="sidebar">
      <header className="sidebar-header">
        Janja
        {showDesktopDownload && (
          <a className="icon-button" href={DESKTOP_DOWNLOAD_URL} title="Baixar o app para Windows" aria-label="Baixar o app para Windows">
            <Download size={18} />
          </a>
        )}
      </header>

      <div className="channel-list">
        <ChannelGroup title="Canais de texto" type="text">
          {channels
            .filter((c) => c.type === 'text')
            .map((c) => (
              <button key={c.id} className={`channel${c.id === selectedId ? ' active' : ''}`} onClick={() => onSelect(c)}>
                <Hash size={18} /> {c.name}
              </button>
            ))}
        </ChannelGroup>

        <ChannelGroup title="Canais de voz" type="voice">
          {channels
            .filter((c) => c.type === 'voice')
            .map((c) => (
              <div key={c.id}>
                <button className={`channel${c.id === selectedId ? ' active' : ''}`} onClick={() => onSelect(c)}>
                  <Volume2 size={18} /> {c.name}
                </button>
                {voiceMembers
                  .filter((m) => m.channelId === c.id)
                  .map((m) => (
                    <div key={m.userId} className="voice-member">
                      <Avatar name={m.username} size={22} speaking={speaking.has(String(m.userId))} />
                      <span className="voice-member-name">{m.username}</span>
                      {m.screen && <span className="live-badge">AO VIVO</span>}
                      {m.video && <Video size={14} />}
                      {m.deafened ? <HeadphoneOff size={14} className="muted-icon" /> : m.muted && <MicOff size={14} className="muted-icon" />}
                    </div>
                  ))}
              </div>
            ))}
        </ChannelGroup>
      </div>

      {connectedChannel && (
        <div className="voice-panel">
          <div>
            <div className="voice-panel-status">Voz conectada</div>
            <div className="voice-panel-channel">{connectedChannel.name}</div>
          </div>
          <div className="icon-row">
            <IconButton label="Compartilhar tela" active={voice.media.screen} onClick={voice.toggleScreen}>
              <Monitor size={18} />
            </IconButton>
            <IconButton label="Desconectar" onClick={voice.leave}>
              <PhoneOff size={18} />
            </IconButton>
          </div>
        </div>
      )}
      {voice.connecting && <div className="voice-panel voice-panel-status">Conectando…</div>}

      <div className="user-panel">
        <Avatar name={user.username} online />
        <span className="user-panel-name">{user.username}</span>
        <div className="icon-row">
          <IconButton
            label={voice.media.muted ? 'Ativar microfone' : 'Silenciar'}
            danger={voice.channelId !== null && voice.media.muted}
            disabled={voice.channelId === null}
            onClick={voice.toggleMute}
          >
            {voice.channelId !== null && voice.media.muted ? <MicOff size={18} /> : <Mic size={18} />}
          </IconButton>
          <IconButton
            label={voice.deafened ? 'Ativar áudio' : 'Desativar áudio'}
            danger={voice.deafened}
            disabled={voice.channelId === null}
            onClick={voice.toggleDeafen}
          >
            {voice.deafened ? <HeadphoneOff size={18} /> : <Headphones size={18} />}
          </IconButton>
          <IconButton label="Sair" onClick={onLogout}>
            <LogOut size={18} />
          </IconButton>
        </div>
      </div>
    </nav>
  );
}

function ChannelGroup({ title, type, children }: { title: string; type: Channel['type']; children: React.ReactNode }) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') return setAdding(false);
    if (event.key !== 'Enter') return;
    const name = event.currentTarget.value.trim();
    if (!name) return;
    try {
      await api<Channel>('/api/channels', { method: 'POST', body: { name, type } });
      setAdding(false);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <section className="channel-group">
      <div className="channel-group-title">
        <span>{title}</span>
        <button className="icon-plain" title="Criar canal" onClick={() => setAdding(!adding)}>
          <Plus size={16} />
        </button>
      </div>
      {adding && (
        <>
          <input
            className="channel-input"
            placeholder={type === 'text' ? 'nome-do-canal' : 'Nome da sala'}
            autoFocus
            onKeyDown={onKeyDown}
            onBlur={() => setAdding(false)}
          />
          {error && <p className="form-error small">{error}</p>}
        </>
      )}
      {children}
    </section>
  );
}

export function IconButton({
  label,
  onClick,
  active,
  danger,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      className={`icon-button${active ? ' active' : ''}${danger ? ' danger' : ''}`}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
