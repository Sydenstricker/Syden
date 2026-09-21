import { RoomAudioRenderer, RoomContext } from '@livekit/components-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type Socket, io } from 'socket.io-client';
import { API_URL, ApiError, api } from './api';
import { Avatar } from './Avatar';
import { CommunityRail } from './CommunityRail';
import { desktopBridge } from './desktop';
import { clearDirectory, loadDirectory, syncDirectory, useDirectory } from './directory';
import { EmptyCommunities } from './EmptyCommunities';
import { getSettings } from './settings';
import { Sidebar } from './Sidebar';
import { TextChannel } from './TextChannel';
import { SettingsModal } from './SettingsModal';
import type { Channel, Community, Message, User, UserRef, VoiceMember } from './types';
import { UsageDashboard } from './UsageDashboard';
import { useVoice } from './useVoice';
import { VoiceStage } from './VoiceStage';

/** Última comunidade aberta, para o app voltar onde a pessoa estava. */
const LAST_COMMUNITY_KEY = 'syden.community';

function rememberCommunity(id: number | null) {
  try {
    if (id === null) localStorage.removeItem(LAST_COMMUNITY_KEY);
    else localStorage.setItem(LAST_COMMUNITY_KEY, String(id));
  } catch {
    // navegador sem armazenamento (janela anônima): só não lembra
  }
}

function rememberedCommunity(): number | null {
  try {
    const saved = Number(localStorage.getItem(LAST_COMMUNITY_KEY));
    return Number.isInteger(saved) && saved > 0 ? saved : null;
  } catch {
    return null;
  }
}

export function Shell({ token, user: loggedUser, onLogout }: { token: string; user: User; onLogout: () => void }) {
  // Os cargos podem mudar com o app aberto (o dono deu ou tirou o de administrador, ou excluiu a conta e outro assumiu).
  const { members } = useDirectory();
  const me = members.get(loggedUser.id);
  const user: User = {
    ...loggedUser,
    isAdmin: me?.isAdmin ?? loggedUser.isAdmin,
    isOwner: me?.isOwner ?? loggedUser.isOwner ?? false,
  };
  const [socket, setSocket] = useState<Socket | null>(null);
  const [online, setOnline] = useState(true);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [communityId, setCommunityId] = useState<number | null>(rememberedCommunity());
  const [loadingCommunities, setLoadingCommunities] = useState(true);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [presence, setPresence] = useState<UserRef[]>([]);
  // Quem está em chamada, por comunidade: a barra lateral só mostra a da comunidade aberta.
  const [voiceByCommunity, setVoiceByCommunity] = useState<Record<number, VoiceMember[]>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  const voice = useVoice(socket);
  const onLogoutRef = useRef(onLogout);
  onLogoutRef.current = onLogout;
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  const community = communities.find((c) => c.id === communityId);
  const voiceMembers = communityId === null ? [] : (voiceByCommunity[communityId] ?? []);
  const onlineHere = presence.filter((p) => members.has(p.id));

  const reloadCommunities = useCallback(async () => {
    const list = await api<Community[]>('/api/communities');
    setCommunities(list);
    setCommunityId((current) => (list.some((c) => c.id === current) ? current : (list[0]?.id ?? null)));
    setLoadingCommunities(false);
    return list;
  }, []);

  useEffect(() => {
    reloadCommunities().catch(console.error);
  }, [reloadCommunities]);

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
    s.on('voice:state', ({ communityId: id, members: list }: { communityId: number; members: VoiceMember[] }) =>
      setVoiceByCommunity((current) => ({ ...current, [id]: list })),
    );
    s.on('channel:created', (channel: Channel) =>
      setChannels((list) => (list.some((c) => c.id === channel.id) || !isOpenCommunity(channel.communityId) ? list : [...list, channel])),
    );
    s.on('channel:updated', (channel: Channel) =>
      setChannels((list) => list.map((c) => (c.id === channel.id ? channel : c))),
    );
    s.on('channel:deleted', ({ id }: { id: number }) => {
      setChannels((list) => list.filter((c) => c.id !== id));
      if (voiceRef.current.channelId === id) voiceRef.current.leave();
    });
    // Nome ou imagem da comunidade mudou (por você ou por outro administrador).
    s.on('community:updated', (updated: Pick<Community, 'id' | 'name' | 'iconVersion'>) =>
      setCommunities((list) =>
        list.map((c) => (c.id === updated.id ? { ...c, name: updated.name, iconVersion: updated.iconVersion } : c)),
      ),
    );
    s.on('community:deleted', ({ id }: { id: number }) => setCommunities((list) => list.filter((c) => c.id !== id)));
    // Removido (ou saiu por outra aba) de uma comunidade: ela some da coluna.
    s.on('member:removed', ({ communityId: id, userId }: { communityId: number; userId: number }) => {
      if (userId === loggedUser.id) setCommunities((list) => list.filter((c) => c.id !== id));
    });
    const unsync = syncDirectory(s);
    setSocket(s);
    return () => {
      unsync();
      s.disconnect();
    };
  }, [token, loggedUser.id]);

  // A comunidade aberta muda: recarrega membros, emojis, sons e canais dela.
  const openCommunityRef = useRef<number | null>(communityId);
  openCommunityRef.current = communityId;
  const isOpenCommunity = (id: number) => openCommunityRef.current === id;

  useEffect(() => {
    rememberCommunity(communityId);
    if (communityId === null) {
      clearDirectory();
      setChannels([]);
      setSelectedId(null);
      return;
    }
    setShowUsage(false);
    loadDirectory(communityId).catch(console.error);
    api<Channel[]>(`/api/communities/${communityId}/channels`).then((list) => {
      if (openCommunityRef.current !== communityId) return; // trocou de comunidade enquanto carregava
      setChannels(list);
      setSelectedId(list.find((c) => c.type === 'text')?.id ?? null);
    }, console.error);
  }, [communityId]);

  // Notificação do Windows para mensagens novas de outras pessoas, quando o Syden não está à vista
  // ou a mensagem é de outro canal. Clicar leva direto ao canal.
  const channelsRef = useRef(channels);
  channelsRef.current = channels;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  useEffect(() => {
    if (!socket) return;
    const onMessage = (message: Message & { communityId: number }) => {
      if (message.author.id !== loggedUser.id) notifyMessage(message);
    };
    const notifyMessage = (message: Message & { communityId: number }) => {
      if (!getSettings().notifications || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
      const here = isOpenCommunity(message.communityId);
      const lookingAtIt = here && document.hasFocus() && !document.hidden && selectedIdRef.current === message.channelId;
      if (lookingAtIt) return;
      const channel = here ? channelsRef.current.find((c) => c.id === message.channelId) : undefined;
      const notification = new Notification(`${message.author.username} em #${channel?.name ?? 'canal'}`, {
        body: message.content.length > 140 ? `${message.content.slice(0, 140)}…` : message.content,
        tag: `channel-${message.channelId}`, // várias mensagens seguidas do mesmo canal viram uma notificação só
      });
      notification.onclick = () => {
        desktopBridge?.focus();
        window.focus();
        setShowUsage(false);
        setCommunityId(message.communityId);
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

  // Painel de consumo é só para administradores; se alguém perder o cargo com ele aberto, a tela volta ao normal.
  const usageOpen = showUsage && user.isAdmin;
  const selected = usageOpen ? undefined : channels.find((c) => c.id === selectedId);

  function selectChannel(channel: Channel) {
    setShowUsage(false);
    setSelectedId(channel.id);
    if (channel.type === 'voice') void voice.join(channel.id);
  }

  function logout() {
    voice.leave();
    rememberCommunity(null);
    onLogout();
  }

  async function afterCommunityChange(changed: Community | null) {
    const list = await reloadCommunities().catch(() => null);
    if (changed && list?.some((c) => c.id === changed.id)) setCommunityId(changed.id);
  }

  return (
    <RoomContext.Provider value={voice.room}>
      <div className="app">
        <CommunityRail
          communities={communities}
          currentId={communityId}
          onSelect={setCommunityId}
          onChanged={(created) => void afterCommunityChange(created)}
        />
        {community ? (
          <Sidebar
            user={user}
            community={community}
            channels={channels}
            selectedId={usageOpen ? null : selectedId}
            usageActive={usageOpen}
            voiceMembers={voiceMembers}
            voice={voice}
            onSelect={selectChannel}
            onOpenUsage={() => setShowUsage(true)}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        ) : (
          !loadingCommunities && <EmptyCommunities onDone={(created) => void afterCommunityChange(created)} />
        )}
        <main className="main">
          {!online && <div className="banner">Reconectando ao servidor…</div>}
          {voice.error && (
            <div className="banner banner-error" onClick={voice.clearError} role="alert">
              {voice.error} <span className="banner-close">✕</span>
            </div>
          )}
          {selected?.type === 'text' && socket && <TextChannel key={selected.id} channel={selected} socket={socket} user={user} role={community?.role ?? 'member'} />}
          {selected?.type === 'voice' && (
            <VoiceStage
              channel={selected}
              voice={voice}
              members={voiceMembers.filter((m) => m.channelId === selected.id)}
            />
          )}
          {usageOpen && <UsageDashboard voiceMembers={voiceMembers} />}
          {community && !selected && !usageOpen && <div className="empty">Escolha um canal à esquerda.</div>}
        </main>
        {selected?.type === 'text' && (
          <aside className="members">
            {/* Só quem participa desta comunidade: não dá para espiar quem está em outra. */}
            <h3>Online — {onlineHere.length}</h3>
            {onlineHere.map((p) => (
              <div key={p.id} className="member">
                <Avatar name={p.username} userId={p.id} online />
                <span>{p.username}</span>
              </div>
            ))}
          </aside>
        )}
      </div>
      {settingsOpen && (
        <SettingsModal
          user={user}
          community={community}
          voice={voice}
          onClose={() => setSettingsOpen(false)}
          onLogout={logout}
          onCommunityChanged={() => void afterCommunityChange(null)}
        />
      )}
      <RoomAudioRenderer muted={voice.deafened} />
    </RoomContext.Provider>
  );
}
