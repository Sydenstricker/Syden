import { useSpeakingParticipants } from '@livekit/components-react';
import {
  BarChart3,
  Download,
  Hash,
  Headphones,
  HeadphoneOff,
  Mic,
  MicOff,
  Pencil,
  PhoneOff,
  Plus,
  Settings,
  Trash2,
  Video,
  Volume2,
} from 'lucide-react';
import { type KeyboardEvent, type ReactNode, useState } from 'react';
import { api } from './api';
import { ConfirmDialog } from './ConfirmDialog';
import { DESKTOP_DOWNLOAD_URL, showDesktopDownload } from './desktopDownload';
import { Avatar } from './Avatar';
import { IconButton } from './IconButton';
import { LivePreview } from './LivePreview';
import { useDirectory } from './directory';
import { PersonMenu, usePersonMenu } from './PersonMenu';
import { ScreenShareButton } from './ScreenShareButton';
import type { Channel, Community, User, VoiceMember } from './types';
import type { Voice } from './useVoice';

interface Props {
  user: User;
  community: Community;
  channels: Channel[];
  selectedId: number | null;
  voiceMembers: VoiceMember[];
  voice: Voice;
  usageActive: boolean;
  onSelect: (channel: Channel) => void;
  onOpenUsage: () => void;
  onOpenSettings: () => void;
}

export function Sidebar({
  user,
  community,
  channels,
  selectedId,
  usageActive,
  voiceMembers,
  voice,
  onSelect,
  onOpenUsage,
  onOpenSettings,
}: Props) {
  // Indicador de fala só existe para a sala em que estamos conectados (é o LiveKit que sabe quem fala).
  const speaking = new Set(useSpeakingParticipants().map((p) => p.identity));
  const connectedChannel = channels.find((c) => c.id === voice.channelId);
  const [deleting, setDeleting] = useState<Channel | null>(null);
  const menu = usePersonMenu();
  const { members } = useDirectory();

  // Quem criou o canal mexe nele; quem administra a comunidade mexe em todos.
  const managesCommunity = community.role === 'owner' || community.role === 'admin';
  const canManage = (channel: Channel) => managesCommunity || channel.createdBy === user.id;
  const row = (channel: Channel, icon: ReactNode) => (
    <ChannelRow
      channel={channel}
      icon={icon}
      active={channel.id === selectedId}
      manageable={canManage(channel)}
      onSelect={() => onSelect(channel)}
      onDelete={() => setDeleting(channel)}
    />
  );

  return (
    <nav className="sidebar">
      <header className="sidebar-header">
        <span className="sidebar-brand" title={community.name}>
          {community.name}
        </span>
        {showDesktopDownload && (
          <a className="icon-button" href={DESKTOP_DOWNLOAD_URL} title="Baixar o app para Windows" aria-label="Baixar o app para Windows">
            <Download size={18} />
          </a>
        )}
      </header>

      <div className="channel-list">
        {/* Consumo do servidor interessa a quem cuida dele: só os administradores veem. */}
        {user.isAdmin && (
          <button className={`channel usage-link${usageActive ? ' active' : ''}`} onClick={onOpenUsage}>
            <BarChart3 size={18} /> Uso do servidor
          </button>
        )}

        <ChannelGroup title="Canais de texto" type="text" communityId={community.id}>
          {channels
            .filter((c) => c.type === 'text')
            .map((c) => (
              <div key={c.id}>{row(c, <Hash size={18} />)}</div>
            ))}
        </ChannelGroup>

        <ChannelGroup title="Canais de voz" type="voice" communityId={community.id}>
          {channels
            .filter((c) => c.type === 'voice')
            .map((c) => (
              <div key={c.id}>
                {row(c, <Volume2 size={18} />)}
                {voiceMembers
                  .filter((m) => m.channelId === c.id)
                  .map((m) => (
                    <div
                      key={m.userId}
                      className="voice-member"
                      // Botão direito abre o menu da pessoa (volume, silenciar), como no Discord.
                      onContextMenu={(e) => menu.open(e, m.userId, m.username)}
                    >
                      <Avatar name={m.username} userId={m.userId} size={22} speaking={speaking.has(String(m.userId))} />
                      <span className="voice-member-name">{m.username}</span>
                      {m.screen && <LivePreview userId={m.userId} username={m.username} channelId={c.id} connected={voice.channelId === c.id} />}
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
            <ScreenShareButton voice={voice} />
            <IconButton label="Desconectar" onClick={voice.leave}>
              <PhoneOff size={18} />
            </IconButton>
          </div>
        </div>
      )}
      {voice.connecting && <div className="voice-panel voice-panel-status">Conectando…</div>}

      <div className="user-panel">
        <Avatar name={user.username} userId={user.id} online />
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
          <IconButton label="Configurações" onClick={onOpenSettings}>
            <Settings size={18} />
          </IconButton>
        </div>
      </div>

      {deleting && <DeleteChannelDialog channel={deleting} onClose={() => setDeleting(null)} />}
      {menu.target && (
        <PersonMenu
          target={menu.target}
          onClose={menu.close}
          voice={voice}
          role={community.role}
          channelId={voice.channelId}
          communityId={community.id}
          channels={channels}
          inVoiceChannel={voiceMembers.find((m) => m.userId === menu.target!.userId)?.channelId ?? null}
          targetRole={members.get(menu.target.userId)?.role ?? 'member'}
          isSelf={menu.target.userId === user.id}
        />
      )}
    </nav>
  );
}

function ChannelRow({
  channel,
  icon,
  active,
  manageable,
  onSelect,
  onDelete,
}: {
  channel: Channel;
  icon: ReactNode;
  active: boolean;
  manageable: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setRenaming(false);
      setError(null);
      return;
    }
    if (event.key !== 'Enter') return;
    const name = event.currentTarget.value.trim();
    if (!name || name === channel.name) return setRenaming(false);
    try {
      await api<Channel>(`/api/channels/${channel.id}`, { method: 'PATCH', body: { name } });
      setRenaming(false);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  if (renaming) {
    return (
      <>
        <input
          className="channel-input"
          defaultValue={channel.name}
          aria-label={`Novo nome para ${channel.name}`}
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={onKeyDown}
          onBlur={() => !error && setRenaming(false)}
        />
        {error && <p className="form-error small">{error}</p>}
      </>
    );
  }

  return (
    <div className={`channel-row${active ? ' active' : ''}`}>
      <button className={`channel${active ? ' active' : ''}`} onClick={onSelect}>
        {icon} <span className="channel-name">{channel.name}</span>
      </button>
      {manageable && (
        <div className="channel-actions">
          <button className="icon-plain" title="Renomear" aria-label={`Renomear ${channel.name}`} onClick={() => setRenaming(true)}>
            <Pencil size={14} />
          </button>
          <button className="icon-plain" title="Excluir" aria-label={`Excluir ${channel.name}`} onClick={onDelete}>
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function DeleteChannelDialog({ channel, onClose }: { channel: Channel; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    try {
      await api(`/api/channels/${channel.id}`, { method: 'DELETE' });
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const label = channel.type === 'text' ? `#${channel.name}` : channel.name;
  return (
    <ConfirmDialog
      title={channel.type === 'text' ? 'Excluir canal' : 'Excluir sala de voz'}
      confirmLabel="Excluir"
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={onClose}
    >
      Tem certeza que quer excluir <strong>{label}</strong>?{' '}
      {channel.type === 'text'
        ? 'Todas as mensagens do canal serão apagadas para todos. Não dá para desfazer.'
        : 'Quem estiver na sala será desconectado.'}
    </ConfirmDialog>
  );
}

function ChannelGroup({
  title,
  type,
  communityId,
  children,
}: {
  title: string;
  type: Channel['type'];
  communityId: number;
  children: ReactNode;
}) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') return setAdding(false);
    if (event.key !== 'Enter') return;
    const name = event.currentTarget.value.trim();
    if (!name) return;
    try {
      await api<Channel>(`/api/communities/${communityId}/channels`, { method: 'POST', body: { name, type } });
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

