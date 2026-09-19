import { RoomAudioRenderer, RoomContext } from '@livekit/components-react';
import { useEffect, useRef, useState } from 'react';
import { type Socket, io } from 'socket.io-client';
import { API_URL, api } from './api';
import { Avatar } from './Avatar';
import { loadDirectory, syncDirectory } from './directory';
import { Sidebar } from './Sidebar';
import { TextChannel } from './TextChannel';
import { SettingsModal } from './SettingsModal';
import type { Channel, User, UserRef, VoiceMember } from './types';
import { UsageDashboard } from './UsageDashboard';
import { useVoice } from './useVoice';
import { VoiceStage } from './VoiceStage';

export function Shell({ token, user, onLogout }: { token: string; user: User; onLogout: () => void }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [online, setOnline] = useState(true);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [presence, setPresence] = useState<UserRef[]>([]);
  const [voiceMembers, setVoiceMembers] = useState<VoiceMember[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const voice = useVoice(socket);
  const onLogoutRef = useRef(onLogout);
  onLogoutRef.current = onLogout;
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  useEffect(() => {
    const s = io(API_URL, { auth: { token } });
    s.on('connect', () => setOnline(true));
    s.on('disconnect', () => setOnline(false));
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

  // O canal aberto foi excluído (por você ou por outra pessoa): volta para o primeiro canal de texto.
  useEffect(() => {
    if (channels.length > 0 && !channels.some((c) => c.id === selectedId)) {
      setSelectedId(channels.find((c) => c.type === 'text')?.id ?? null);
    }
  }, [channels, selectedId]);

  const [showUsage, setShowUsage] = useState(false);
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
          {selected?.type === 'text' && socket && <TextChannel key={selected.id} channel={selected} socket={socket} />}
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
