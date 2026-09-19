import { RoomAudioRenderer, RoomContext } from '@livekit/components-react';
import { useEffect, useRef, useState } from 'react';
import { type Socket, io } from 'socket.io-client';
import { API_URL, ApiError, api } from './api';
import { Avatar } from './Avatar';
import { desktopBridge } from './desktop';
import { loadDirectory, syncDirectory, useDirectory } from './directory';
import { getSettings } from './settings';
import { Sidebar } from './Sidebar';
import { TextChannel } from './TextChannel';
import { SettingsModal } from './SettingsModal';
import type { Channel, Message, User, UserRef, VoiceMember } from './types';
import { UsageDashboard } from './UsageDashboard';
import { useVoice } from './useVoice';
import { VoiceStage } from './VoiceStage';

export function Shell({ token, user: loggedUser, onLogout }: { token: string; user: User; onLogout: () => void }) {
  // Os cargos podem mudar com o app aberto (o dono deu ou tirou o de administrador, ou excluiu a conta e outro assumiu).
  const { users } = useDirectory();
  const current = users.get(loggedUser.id);
  const user: User = {
    ...loggedUser,
    isAdmin: current?.isAdmin ?? loggedUser.isAdmin,
    isOwner: current?.isOwner ?? loggedUser.isOwner ?? false,
  };
  const [socket, setSocket] = useState<Socket | null>(null);
  const [online, setOnline] = useState(true);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [presence, setPresence] = useState<UserRef[]>([]);
  const [voiceMembers, setVoiceMembers] = useState<VoiceMember[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  const voice = useVoice(socket);
  const onLogoutRef = useRef(onLogout);
  onLogoutRef.current = onLogout;
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  useEffect(() => {
    const s = io(API_URL, { auth: { token } });
    s.on('connect', () => setOnline(true));
    s.on('disconnect', (reason) => {
      setOnline(false);
      // O servidor só derruba a conexão de propósito quando a conta foi excluída; nos outros casos, reconecta.
      if (reason === 'io server disconnect') {
        api('/api/me').then(
          () => s.connect(),
          (error) => (error instanceof ApiError && error.status === 401 ? onLogoutRef.current() : s.connect()),
        );
      }
    });
    s.on('connect_error', (error) => {
      setOnline(false);
      if (error.message === 'unauthorized') onLogoutRef.current();
    });
    s.on('presence', setPresence);
    s.on('voice:state', setVoiceMembers);
    s.on('channel:created', (channel: Channel) =>
      setChannels((list) => (list.some((c) => c.id === channel.id) ? list : [...list, channel])),
    );
    s.on('channel:updated', (channel: Channel) =>
      setChannels((list) => list.map((c) => (c.id === channel.id ? channel : c))),
    );
    s.on('channel:deleted', ({ id }: { id: number }) => {
      setChannels((list) => list.filter((c) => c.id !== id));
      if (voiceRef.current.channelId === id) voiceRef.current.leave();
    });
    const unsync = syncDirectory(s);
    setSocket(s);
    return () => {
      unsync();
      s.disconnect();
    };
  }, [token]);

  useEffect(() => {
    loadDirectory().catch(console.error);
    api<Channel[]>('/api/channels').then((list) => {
      setChannels(list);
      setSelectedId((current) => current ?? list.find((c) => c.type === 'text')?.id ?? null);
    }, console.error);
  }, []);

  // Notificação do Windows para mensagens novas de outras pessoas, quando o Syden não está à vista
  // ou a mensagem é de outro canal. Clicar leva direto ao canal.
  const channelsRef = useRef(channels);
  channelsRef.current = channels;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  useEffect(() => {
    if (!socket) return;
    const onMessage = (message: Message) => {
      if (message.author.id !== loggedUser.id) notifyMessage(message);
    };
    const notifyMessage = (message: Message) => {
      if (!getSettings().notifications || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      const lookingAtIt = document.hasFocus() && !document.hidden && selectedIdRef.current === message.channelId;
      if (lookingAtIt) return;
      const channel = channelsRef.current.find((c) => c.id === message.channelId);
      const notification = new Notification(`${message.author.username} em #${channel?.name ?? 'canal'}`, {
        body: message.content.length > 140 ? `${message.content.slice(0, 140)}…` : message.content,
        tag: `channel-${message.channelId}`, // várias mensagens seguidas do mesmo canal viram uma notificação só
      });
      notification.onclick = () => {
        desktopBridge?.focus();
        window.focus();
        setShowUsage(false);
        setSelectedId(message.channelId);
        notification.close();
      };
    };
    socket.on('message:new', onMessage);
    return () => {
      socket.off('message:new', onMessage);
    };
  }, [socket, loggedUser.id]);

  // Teclas de atalho globais do app de desktop (mudo e ensurdecer), só durante uma chamada.
  useEffect(
    () =>
      desktopBridge?.onShortcut((action) => {
        const current = voiceRef.current;
        if (current.channelId === null) return;
        if (action === 'mute') void current.toggleMute();
        else void current.toggleDeafen();
      }),
    [],
  );

  // O canal aberto foi excluído (por você ou por outra pessoa): volta para o primeiro canal de texto.
  useEffect(() => {
    if (channels.length > 0 && !channels.some((c) => c.id === selectedId)) {
      setSelectedId(channels.find((c) => c.type === 'text')?.id ?? null);
    }
  }, [channels, selectedId]);

  const selected = showUsage ? undefined : channels.find((c) => c.id === selectedId);

  function selectChannel(channel: Channel) {
    setShowUsage(false);
    setSelectedId(channel.id);
    if (channel.type === 'voice') void voice.join(channel.id);
  }

  function logout() {
    voice.leave();
    onLogout();
  }

  return (
    <RoomContext.Provider value={voice.room}>
      <div className="app">
        <Sidebar
          user={user}
          channels={channels}
          selectedId={showUsage ? null : selectedId}
          usageActive={showUsage}
          voiceMembers={voiceMembers}
          voice={voice}
          onSelect={selectChannel}
          onOpenUsage={() => setShowUsage(true)}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        <main className="main">
          {!online && <div className="banner">Reconectando ao servidor…</div>}
          {voice.error && (
            <div className="banner banner-error" onClick={voice.clearError} role="alert">
              {voice.error} <span className="banner-close">✕</span>
            </div>
          )}
          {selected?.type === 'text' && socket && <TextChannel key={selected.id} channel={selected} socket={socket} user={user} />}
          {selected?.type === 'voice' && (
            <VoiceStage
              channel={selected}
              voice={voice}
              members={voiceMembers.filter((m) => m.channelId === selected.id)}
            />
          )}
          {showUsage && <UsageDashboard voiceMembers={voiceMembers} />}
          {!selected && !showUsage && <div className="empty">Escolha um canal à esquerda.</div>}
        </main>
        {selected?.type === 'text' && (
          <aside className="members">
            <h3>Online — {presence.length}</h3>
            {presence.map((p) => (
              <div key={p.id} className="member">
                <Avatar name={p.username} userId={p.id} online />
                <span>{p.username}</span>
              </div>
            ))}
          </aside>
        )}
      </div>
      {settingsOpen && (
        <SettingsModal user={user} voice={voice} onClose={() => setSettingsOpen(false)} onLogout={logout} />
      )}
      <RoomAudioRenderer muted={voice.deafened} />
    </RoomContext.Provider>
  );
}
