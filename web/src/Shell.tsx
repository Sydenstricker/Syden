import { RoomAudioRenderer, RoomContext } from '@livekit/components-react';
import { useEffect, useRef, useState } from 'react';
import { type Socket, io } from 'socket.io-client';
import { API_URL, api } from './api';
import { Sidebar } from './Sidebar';
import { TextChannel } from './TextChannel';
import type { Channel, User, VoiceMember } from './types';
import { UsageDashboard } from './UsageDashboard';
import { useVoice } from './useVoice';
import { VoiceStage } from './VoiceStage';

export function Shell({ token, user, onLogout }: { token: string; user: User; onLogout: () => void }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [online, setOnline] = useState(true);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [presence, setPresence] = useState<User[]>([]);
  const [voiceMembers, setVoiceMembers] = useState<VoiceMember[]>([]);
  const voice = useVoice(socket);
  const onLogoutRef = useRef(onLogout);
  onLogoutRef.current = onLogout;

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
    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, [token]);

  useEffect(() => {
    api<Channel[]>('/api/channels').then((list) => {
      setChannels(list);
      setSelectedId((current) => current ?? list.find((c) => c.type === 'text')?.id ?? null);
    }, console.error);
  }, []);

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
          onLogout={logout}
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
                <Avatar name={p.username} online />
                <span>{p.username}</span>
              </div>
            ))}
          </aside>
        )}
      </div>
      <RoomAudioRenderer muted={voice.deafened} />
    </RoomContext.Provider>
  );
}

const AVATAR_COLORS = ['#5865f2', '#3ba55d', '#faa61a', '#ed4245', '#eb459e', '#00a8fc', '#9b59b6', '#e67e22'];

export function Avatar({ name, online, speaking, size = 32 }: { name: string; online?: boolean; speaking?: boolean; size?: number }) {
  const hash = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return (
    <span
      className={`avatar${speaking ? ' speaking' : ''}`}
      style={{ width: size, height: size, background: AVATAR_COLORS[hash % AVATAR_COLORS.length], fontSize: size * 0.42 }}
    >
      {name.slice(0, 1).toUpperCase()}
      {online && <span className="avatar-status" />}
    </span>
  );
}
