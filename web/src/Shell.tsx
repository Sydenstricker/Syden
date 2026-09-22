import { RoomAudioRenderer, RoomContext } from '@livekit/components-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type Socket, io } from 'socket.io-client';
import { API_URL, ApiError, api } from './api';
import { Avatar } from './Avatar';
import { CommunityRail } from './CommunityRail';
import { desktopBridge } from './desktop';
import { clearDirectory, loadDirectory, syncDirectory, useDirectory } from './directory';
import { EmptyCommunities } from './EmptyCommunities';
import { Home } from './Home';
import { temNovidade } from './changelog';
import { DirectList, DirectRailButton, directName } from './DirectList';
import { MemberList } from './MemberList';
import { NewGroupDialog } from './NewGroupDialog';
import { loadMyStatus, saveMyStatus } from './presenceStatus';
import { getSettings, updateSettings, useSettings } from './settings';
import { Sidebar } from './Sidebar';
import { TextChannel } from './TextChannel';
import { SettingsModal } from './SettingsModal';
import type { Channel, Community, DirectChannel, Message, PresenceEntry, PresenceStatus, User, VoiceMember } from './types';
import { UsageDashboard } from './UsageDashboard';
import { useVoice } from './useVoice';
import { VoiceStage } from './VoiceStage';

/** Última comunidade aberta, para o app voltar onde a pessoa estava. */
const LAST_COMMUNITY_KEY = 'syden.community';
/** Última tela aberta (início, comunidade ou conversas), pelo mesmo motivo. */
const LAST_VIEW_KEY = 'syden.view';

type View = 'home' | 'community' | 'direct';

function rememberView(view: View) {
  try {
    localStorage.setItem(LAST_VIEW_KEY, view);
  } catch {
    // sem armazenamento: abre na tela inicial da próxima vez, e tudo bem
  }
}

/**
 * Onde o Syden abre: onde a pessoa parou. Só cai na tela inicial quem nunca entrou, quem estava lá, ou
 * quem tem novidade para ver — assim quem só quer conversar não ganha um clique a mais todo dia.
 */
function firstView(): View {
  try {
    const saved = localStorage.getItem(LAST_VIEW_KEY);
    if (temNovidade()) return 'home';
    if (saved === 'community' || saved === 'direct' || saved === 'home') return saved;
  } catch {
    // sem armazenamento
  }
  return 'home';
}

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

export function Shell({
  token,
  user: loggedUser,
  pendingInviteCode,
  onLogout,
}: {
  token: string;
  user: User;
  /** Veio de um link de convite (?convite=xxxx): entra nessa comunidade assim que a sessão abre. */
  pendingInviteCode?: string | null;
  onLogout: () => void;
}) {
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
  const [presence, setPresence] = useState<PresenceEntry[]>([]);
  // Quem está em chamada, por comunidade: a barra lateral só mostra a da comunidade aberta.
  const [voiceByCommunity, setVoiceByCommunity] = useState<Record<number, VoiceMember[]>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const preferences = useSettings();
  const [showUsage, setShowUsage] = useState(false);
  // Em tela estreita só cabe uma coluna por vez: esta decide se é a lista de canais ou a conversa/chamada
  // que aparece. Em tela larga (a maioria) isto não muda nada — as duas colunas aparecem sempre.
  const [mobileChannels, setMobileChannels] = useState(true);
  // Conversas privadas: a barra lateral troca a lista de canais pela lista de conversas.
  const [view, setView] = useState<View>(firstView);
  const [directs, setDirects] = useState<DirectChannel[]>([]);
  const [directId, setDirectId] = useState<number | null>(null);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const voice = useVoice(socket);
  const onLogoutRef = useRef(onLogout);
  onLogoutRef.current = onLogout;
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  useEffect(() => rememberView(view), [view]);
  // A bolinha do logo some assim que a tela inicial é aberta.
  const [novidade, setNovidade] = useState(temNovidade);
  useEffect(() => {
    if (view === 'home') setNovidade(false);
  }, [view]);

  const community = communities.find((c) => c.id === communityId);
  const openDirect = directs.find((c) => c.id === directId);
  // A conversa privada aberta vira um "canal" para a tela de conversa poder ser a mesma dos canais de texto.
  const directAsChannel: Channel | undefined = openDirect && {
    id: openDirect.id,
    communityId: null,
    name: directName(openDirect, user.id),
    type: 'dm',
    position: 0,
    createdBy: openDirect.createdBy,
  };
  const voiceMembers = communityId === null ? [] : (voiceByCommunity[communityId] ?? []);
  const onlineHere = presence.filter((p) => members.has(p.id));
  const myStatus = presence.find((p) => p.id === user.id)?.status ?? loadMyStatus();

  function setMyStatus(status: PresenceStatus) {
    saveMyStatus(status);
    socket?.emit('presence:set', status);
  }

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
    api<DirectChannel[]>('/api/direct').then(setDirects, console.error);
  }, []);

  /** Abre uma conversa privada (vindo da lista ou do menu de alguém) e troca a barra lateral para ela. */
  function openConversation(conversa: DirectChannel) {
    setDirects((list) => (list.some((c) => c.id === conversa.id) ? list : [conversa, ...list]));
    setView('direct');
    setDirectId(conversa.id);
    setShowUsage(false);
    setMobileChannels(false);
  }

  /** "Enviar mensagem" no menu de alguém: abre a conversa que já existe, ou começa uma. */
  async function startConversation(userId: number) {
    try {
      openConversation(await api<DirectChannel>('/api/direct', { method: 'POST', body: { userIds: [userId] } }));
    } catch (e) {
      setNotice((e as Error).message);
    }
  }

  // Chegou por um link de convite (?convite=xxxx): entra nessa comunidade assim que a sessão abre. Quem já
  // participa (ex.: o próprio link de quem convidou) simplesmente não vê nada de diferente.
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!pendingInviteCode) return;
    api<Community>('/api/communities/join', { method: 'POST', body: { code: pendingInviteCode } }).then(
      (community) => {
        setNotice(`Você entrou em ${community.name}.`);
        void afterCommunityChange(community);
      },
      (error) => {
        if (error instanceof ApiError && error.status === 409) return; // já participava: nada a avisar
        setNotice((error as Error).message);
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInviteCode]);

  useEffect(() => {
    const s = io(API_URL, { auth: { token } });
    s.on('connect', () => {
      setOnline(true);
      // O servidor sempre começa te vendo como "online"; se você tinha escolhido outro status, reafirma.
      const saved = loadMyStatus();
      if (saved !== 'online') s.emit('presence:set', saved);
    });
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
    // Conversas privadas: entram, mudam de nome/gente ou somem da lista na hora.
    const upsertDirect = (conversa: DirectChannel) =>
      setDirects((list) => [conversa, ...list.filter((c) => c.id !== conversa.id)]);
    s.on('direct:created', upsertDirect);
    s.on('direct:updated', (conversa: DirectChannel) => {
      if (conversa.members) upsertDirect(conversa);
      else void api<DirectChannel[]>('/api/direct').then(setDirects, console.error);
    });
    s.on('direct:removed', ({ id }: { id: number }) => {
      setDirects((list) => list.filter((c) => c.id !== id));
      setDirectId((current) => (current === id ? null : current));
    });
    // Mensagem nova numa conversa privada: atualiza a prévia e sobe ela para o topo da lista.
    s.on('message:new', (message: Message & { communityId: number | null }) => {
      if (message.communityId !== null) return;
      setDirects((list) => {
        const conversa = list.find((c) => c.id === message.channelId);
        if (!conversa) return list;
        const atualizada = { ...conversa, lastMessage: message.content, lastMessageAt: message.createdAt };
        return [atualizada, ...list.filter((c) => c.id !== message.channelId)];
      });
    });
    s.on('voice:state', ({ communityId: id, members: list }: { communityId: number; members: VoiceMember[] }) =>
      setVoiceByCommunity((current) => ({ ...current, [id]: list })),
    );
    s.on('channel:created', (channel: Channel) =>
      setChannels((list) =>
        // Conversa privada não entra na lista de canais da comunidade (ela tem lista própria).
        list.some((c) => c.id === channel.id) || channel.communityId === null || !isOpenCommunity(channel.communityId)
          ? list
          : [...list, channel],
      ),
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
    // Um administrador te puxou para outra sala de voz: o app entra nela sozinho, como no Discord.
    s.on('voice:move', ({ channelId: to }: { channelId: number }) => {
      setSelectedId(to);
      setShowUsage(false);
      setMobileChannels(false);
      void voiceRef.current.join(to);
    });
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
    setMobileChannels(true); // troca de comunidade: mostra a lista de canais dela, não a conversa da anterior
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
      // Mensagem sem texto (só arquivo ou enquete) precisa de uma descrição na notificação.
      const text =
        message.content ||
        (message.poll ? `Enquete: ${message.poll.question}` : message.attachments.length > 0 ? 'Mandou um arquivo' : '');
      const notification = new Notification(`${message.author.username} em #${channel?.name ?? 'canal'}`, {
        body: text.length > 140 ? `${text.slice(0, 140)}…` : text,
        tag: `channel-${message.channelId}`, // várias mensagens seguidas do mesmo canal viram uma notificação só
      });
      notification.onclick = () => {
        desktopBridge?.focus();
        window.focus();
        setShowUsage(false);
        setMobileChannels(false);
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
  const usageOpen = showUsage && user.isAdmin && view === 'community';
  const selected = usageOpen || view !== 'community' ? undefined : channels.find((c) => c.id === selectedId);

  function selectChannel(channel: Channel) {
    setView('community'); // vindo da tela inicial ou de uma conversa privada, volta para a comunidade
    setShowUsage(false);
    setSelectedId(channel.id);
    setMobileChannels(false);
    if (channel.type === 'voice') void voice.join(channel.id);
  }

  /** "Assistir transmissão" no menu de alguém: abre a sala dela na tela, não só conecta por baixo. */
  function watchStream(channelId: number) {
    const channel = channels.find((c) => c.id === channelId);
    if (channel) selectChannel(channel);
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
      <div className={`app ${mobileChannels ? 'mobile-channels' : 'mobile-main'}`}>
        <CommunityRail
          communities={communities}
          currentId={view === 'community' ? communityId : null}
          onSelect={(id) => {
            setView('community');
            setCommunityId(id);
          }}
          onChanged={(created) => void afterCommunityChange(created)}
          onHome={() => {
            setView('home');
            setShowUsage(false);
            setMobileChannels(false);
          }}
          homeActive={view === 'home'}
          homeBadge={view !== 'home' && novidade}
          top={
            communities.length > 0 && (
              <DirectRailButton
                active={view === 'direct'}
                unread={false}
                onClick={() => {
                  setView('direct');
                  setShowUsage(false);
                  setMobileChannels(true);
                }}
              />
            )
          }
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
            myStatus={myStatus}
            onSetStatus={setMyStatus}
            onWatchStream={watchStream}
            onSendMessage={(id) => void startConversation(id)}
            onSelect={selectChannel}
            onOpenUsage={() => {
              setView('community');
              setShowUsage(true);
              setMobileChannels(false);
            }}
            onOpenSettings={() => setSettingsOpen(true)}
            directMode={view === 'direct'}
            directList={
              <DirectList
                conversas={directs}
                selectedId={directId}
                selfId={user.id}
                onSelect={openConversation}
                onNewGroup={() => setNewGroupOpen(true)}
              />
            }
          />
        ) : (
          !loadingCommunities && <EmptyCommunities onDone={(created) => void afterCommunityChange(created)} />
        )}
        <main className="main">
          {!online && <div className="banner">Reconectando ao servidor…</div>}
          {notice && (
            <div className="banner" onClick={() => setNotice(null)}>
              {notice} <span className="banner-close">✕</span>
            </div>
          )}
          {voice.error && (
            <div className="banner banner-error" onClick={voice.clearError} role="alert">
              {voice.error} <span className="banner-close">✕</span>
            </div>
          )}
          {view === 'home' && <Home />}
          {/* Conversa privada: mesma tela dos canais de texto, só que sem comunidade por trás. */}
          {view === 'direct' && directAsChannel && socket && (
            <TextChannel
              key={`dm-${directAsChannel.id}`}
              channel={directAsChannel}
              socket={socket}
              user={user}
              role="member"
              onMobileBack={() => setMobileChannels(true)}
            />
          )}
          {view === 'direct' && !directAsChannel && (
            <div className="empty">Escolha uma conversa à esquerda, ou comece uma nova.</div>
          )}
          {view === 'community' && selected?.type === 'text' && socket && (
            <TextChannel
              key={selected.id}
              channel={selected}
              socket={socket}
              user={user}
              role={community?.role ?? 'member'}
              onMobileBack={() => setMobileChannels(true)}
            />
          )}
          {view === 'community' && selected?.type === 'voice' && (
            <VoiceStage
              channel={selected}
              voice={voice}
              members={voiceMembers.filter((m) => m.channelId === selected.id)}
              onMobileBack={() => setMobileChannels(true)}
              membersOpen={preferences.showMembers}
              onToggleMembers={() => updateSettings({ showMembers: !preferences.showMembers })}
            />
          )}
          {view === 'community' && usageOpen && (
            <UsageDashboard voiceMembers={voiceMembers} onMobileBack={() => setMobileChannels(true)} />
          )}
          {view === 'community' && community && !selected && !usageOpen && (
            <div className="empty">Escolha um canal à esquerda.</div>
          )}
        </main>
        {/* A lista de pessoas acompanha tanto o canal de texto quanto a sala de voz (aí, se a pessoa quiser). */}
        {view === 'community' && (selected?.type === 'text' || (selected?.type === 'voice' && preferences.showMembers)) && (
          <MemberList
            online={onlineHere}
            voiceMembers={voiceMembers}
            channels={channels}
            voice={voice}
            role={community?.role ?? 'member'}
            communityId={communityId ?? 0}
            selfId={user.id}
            onWatchStream={watchStream}
            onSendMessage={(id) => void startConversation(id)}
          />
        )}
      </div>
      {newGroupOpen && (
        <NewGroupDialog
          selfId={user.id}
          onClose={() => setNewGroupOpen(false)}
          onCreated={(conversa) => {
            setNewGroupOpen(false);
            openConversation(conversa);
          }}
        />
      )}
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
