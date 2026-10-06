import { useSpeakingParticipants } from '@livekit/components-react';
import {
  BarChart3,
  Download,
  Gamepad2,
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
  Home,
} from 'lucide-react';
import { type KeyboardEvent, type ReactNode, useState } from 'react';
import { api } from './api';
import { DIAS_NA_LIXEIRA } from './lixeira';
import { SeloDaComunidade } from './SeloDaComunidade';
import { ConfirmDialog } from './ConfirmDialog';
import { LINK_PRINCIPAL, PELA_STORE, showDesktopDownload } from './desktopDownload';
import { AnimatedIcon } from './AnimatedIcon';
import { CapaDaComunidade } from './CapaDaComunidade';
import { efeitoDaComunidade, pilhaDaFonte } from './fontesDaComunidade';
import { Avatar } from './Avatar';
import { useT } from './i18n';
import { Puxador } from './Puxador';
import { IconButton } from './IconButton';
import { LivePreview } from './LivePreview';
import { useDirectory } from './directory';
import { corDoNome } from './profileStyles';
import { PersonMenu, usePersonMenu } from './PersonMenu';
import { ProfileCard } from './ProfileCard';
import { ScreenShareButton } from './ScreenShareButton';
import { StatusMenu, useStatusMenu } from './StatusMenu';
import { nomeDeCanal } from './bidi';
import type { Channel, Community, CommunityMember, PresenceStatus, User, VoiceMember } from './types';
import type { Voice } from './useVoice';

interface Props {
  user: User;
  community: Community;
  channels: Channel[];
  selectedId: number | null;
  voiceMembers: VoiceMember[];
  voice: Voice;
  usageActive: boolean;
  jogosActive: boolean;
  /** O código da arte da comunidade (o mesmo da tela de boas-vindas), para a faixa do alto. */
  arteDaComunidade?: string | null;
  inicioActive: boolean;
  myStatus: PresenceStatus;
  onSetStatus: (status: PresenceStatus) => void;
  /** Abre e entra na sala de quem está transmitindo, direto pelo menu do botão direito. */
  onWatchStream: (channelId: number, userId: number) => void;
  /** Abre a conversa privada com alguém, pelo menu do botão direito. */
  onSendMessage: (userId: number) => void;
  /** No modo conversas, a lista de canais dá lugar à lista de conversas privadas. */
  directMode: boolean;
  directList: ReactNode;
  onSelect: (channel: Channel) => void;
  onOpenUsage: () => void;
  onOpenJogos: () => void;
  onOpenInicio: () => void;
  onOpenSettings: () => void;
}

export function Sidebar({
  user,
  community,
  channels,
  selectedId,
  usageActive,
  jogosActive,
  arteDaComunidade,
  inicioActive,
  voiceMembers,
  voice,
  myStatus,
  onSetStatus,
  onWatchStream,
  onSendMessage,
  directMode,
  directList,
  onSelect,
  onOpenUsage,
  onOpenJogos,
  onOpenInicio,
  onOpenSettings,
}: Props) {
  // Indicador de fala só existe para a sala em que estamos conectados (é o LiveKit que sabe quem fala).
  const speaking = new Set(useSpeakingParticipants().map((p) => p.identity));
  const connectedChannel = channels.find((c) => c.id === voice.channelId);
  const [deleting, setDeleting] = useState<Channel | null>(null);
  const statusMenu = useStatusMenu();
  const t = useT();
  const menu = usePersonMenu();
  const { members } = useDirectory();
  // Cartão de perfil aberto pelo menu do botão direito aqui da barra lateral.
  const [perfil, setPerfil] = useState<{ membro: CommunityMember; x: number; y: number } | null>(null);

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
      <Puxador barra="sidebar" lado="direita" />
      {/* A FAIXA DA COMUNIDADE, no alto da lista de canais: uma foto, se o dono mandou uma, ou o
          degradê que ele escolheu para as boas-vindas. Ver web/src/CapaDaComunidade.tsx.
          Nas conversas privadas não há comunidade, então não há faixa — e o cabeçalho volta a ser o
          cabeçalho comum. */}
      <header className={`sidebar-header${directMode ? '' : ' com-capa'}`}>
        {!directMode && <CapaDaComunidade community={community} arte={arteDaComunidade} />}
        {/* A LETRA DA COMUNIDADE vale só no NOME dela, e não na tela inteira: trocar a fonte das
            mensagens de todo mundo por gosto de quem administra é mexer no que os outros leem. Em
            Conversas não há comunidade, então não há letra. */}
        <span
          className="sidebar-brand"
          title={directMode ? t('Conversas') : community.name}
          style={directMode ? undefined : { fontFamily: pilhaDaFonte(community.fonte) || undefined }}
          data-efeito={directMode ? undefined : efeitoDaComunidade(community.efeito)}
        >
          {directMode ? t('Conversas') : community.name}
          {/* O selo fica ao lado do nome da comunidade: é onde a conquista dela faz sentido ser
              lida, e é a primeira coisa que quem entra vê. */}
          {!directMode && community.seloTexto && community.seloIcone && community.seloCor && (
            <SeloDaComunidade
              selo={{ texto: community.seloTexto, icone: community.seloIcone, cor: community.seloCor }}
            />
          )}
        </span>
        {showDesktopDownload && (
          <a
            className="icon-button"
            href={LINK_PRINCIPAL}
            title={PELA_STORE ? t('Baixar na Microsoft Store') : t('Baixar o app para Windows')}
            aria-label={PELA_STORE ? t('Baixar na Microsoft Store') : t('Baixar o app para Windows')}
          >
            <Download size={18} />
          </a>
        )}
      </header>

      {directMode && directList}

      <div className="channel-list" hidden={directMode}>
        {/* O INÍCIO DA COMUNIDADE FICA SEMPRE AQUI, e não só na primeira entrada.
            A tela de boas-vindas abre sozinha uma vez; este botão é o que a torna um LUGAR. Sem ele,
            o recado do dono e a arte da comunidade viveriam um instante e sumiriam para sempre — e
            quem chegou distraído nunca mais acharia o caminho de volta. */}
        <button className={`channel inicio-link${inicioActive ? ' active' : ''}`} onClick={onOpenInicio}>
          <Home size={18} /> {t('Início')}
        </button>

        {/* A agenda de servidores de jogo é da comunidade inteira: todo mundo vê, quem administra mexe. */}
        <button className={`channel jogos-link${jogosActive ? ' active' : ''}`} onClick={onOpenJogos}>
          <Gamepad2 size={18} /> {t('Servidores de jogos')}
        </button>

        {/* Consumo do servidor interessa a quem cuida dele: só os administradores veem. */}
        {user.isAdmin && (
          <button className={`channel usage-link${usageActive ? ' active' : ''}`} onClick={onOpenUsage}>
            <BarChart3 size={18} /> {t('Uso do servidor')}
          </button>
        )}

        <ChannelGroup title={t('Canais de texto')} type="text" communityId={community.id}>
          {channels
            .filter((c) => c.type === 'text')
            .map((c) => (
              <div key={c.id}>{row(c, <Hash size={18} />)}</div>
            ))}
        </ChannelGroup>

        <ChannelGroup title={t('Canais de voz')} type="voice" communityId={community.id}>
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
                      {/* A música do karaokê só é conhecida dentro da chamada em que ela toca: por isso o
                          fone aparece só na sala em que VOCÊ está. */}
                      <Avatar
                        name={m.username}
                        userId={m.userId}
                        size={22}
                        speaking={speaking.has(String(m.userId))}
                        musica={voice.karaoke !== null && m.channelId === voice.channelId}
                      />
                      <span className="voice-member-name">{m.username}</span>
                      {m.screen && (
                        <LivePreview
                          userId={m.userId}
                          username={m.username}
                          transmitindo={m.screenName}
                          channelId={c.id}
                          connected={voice.channelId === c.id}
                        />
                      )}
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
        <span onContextMenu={statusMenu.onOpen} title={t('Botão direito para mudar o status')}>
          <Avatar name={user.username} userId={user.id} online status={myStatus} />
        </span>
        <span className="user-panel-name" data-cor={corDoNome(members.get(user.id)?.nameColor)}>
          {user.username}
        </span>
        <div className="icon-row">
          {/* Funciona fora de qualquer sala: quem se silencia aqui entra mudo na próxima chamada. */}
          <IconButton
            label={voice.media.muted ? 'Ativar microfone' : 'Silenciar'}
            danger={voice.media.muted}
            onClick={voice.toggleMute}
          >
            {/* Mudo continua com o ícone de traço: ali o desenho precisa gritar que está desligado. */}
            {voice.media.muted ? <MicOff size={18} /> : <AnimatedIcon name="microfone" size={20} />}
          </IconButton>
          <IconButton
            label={voice.deafened ? 'Ativar áudio' : 'Desativar áudio'}
            danger={voice.deafened}
            onClick={voice.toggleDeafen}
          >
            {voice.deafened ? <HeadphoneOff size={18} /> : <Headphones size={18} />}
          </IconButton>
          <IconButton label={t('Configurações')} onClick={onOpenSettings}>
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
          targetScreen={voiceMembers.find((m) => m.userId === menu.target!.userId)?.screen ?? false}
          targetRole={members.get(menu.target.userId)?.role ?? 'member'}
          isSelf={menu.target.userId === user.id}
          onWatchStream={onWatchStream}
          onSendMessage={onSendMessage}
          onOpenProfile={(userId, x, y) => {
            const alvo = members.get(userId);
            if (alvo) setPerfil({ membro: alvo, x, y });
          }}
        />
      )}
      {perfil && (
        <ProfileCard
          membro={perfil.membro}
          /* Quem aparece aqui está numa sala de voz: está online, por definição. */
          status={perfil.membro.id === user.id ? myStatus : 'online'}
          x={perfil.x}
          y={perfil.y}
          isSelf={perfil.membro.id === user.id}
          onClose={() => setPerfil(null)}
          onSendMessage={onSendMessage}
        />
      )}
      {statusMenu.open && (
        <StatusMenu x={statusMenu.open.x} y={statusMenu.open.y} current={myStatus} onChoose={onSetStatus} onClose={statusMenu.close} />
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
  const t = useT();
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
          <button className="icon-plain" title={t('Renomear')} aria-label={`Renomear ${channel.name}`} onClick={() => setRenaming(true)}>
            <Pencil size={14} />
          </button>
          <button className="icon-plain" title={t('Excluir')} aria-label={`Excluir ${channel.name}`} onClick={onDelete}>
            <Trash2 size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

function DeleteChannelDialog({ channel, onClose }: { channel: Channel; onClose: () => void }) {
  const t = useT();
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

  const label = nomeDeCanal(channel.name, channel.type === 'text');
  return (
    <ConfirmDialog
      title={channel.type === 'text' ? t('Excluir canal') : t('Excluir sala de voz')}
      confirmLabel={t('Excluir')}
      busy={busy}
      error={error}
      onConfirm={confirm}
      onCancel={onClose}
    >
      {t('Tem certeza que quer excluir')} <strong>{label}</strong>?{' '}
      {/* O TEXTO DAQUI DIZIA "Não dá para desfazer", e virou mentira no dia em que a lixeira entrou.
          Aviso que exagera o estrago é tão ruim quanto aviso que o esconde: quem lê "não dá para
          desfazer" e apaga o canal errado passa a tarde achando que perdeu um mês de conversa. O
          prazo vem de web/src/lixeira.ts, que o teste mantém igual ao do servidor. */}
      {channel.type === 'text'
        ? t('O canal sai da vista de todos com as mensagens dentro. Dá para trazer de volta por {dias} dias, em Configurações → Comunidade → Lixeira.', {
            dias: DIAS_NA_LIXEIRA,
          })
        : t('Quem estiver na sala será desconectado. Dá para trazer a sala de volta por {dias} dias, em Configurações → Comunidade → Lixeira.', {
            dias: DIAS_NA_LIXEIRA,
          })}
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
  const t = useT();
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
        <button className="icon-plain" title={t('Criar canal')} onClick={() => setAdding(!adding)}>
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

