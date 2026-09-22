import { Avatar } from './Avatar';
import { useDirectory } from './directory';
import { PersonMenu, usePersonMenu } from './PersonMenu';
import type { Channel, CommunityMember, PresenceEntry, Role, VoiceMember } from './types';
import type { Voice } from './useVoice';

/** Como no Discord: dono destacado, depois administradores, depois o resto — cada um com sua cor. */
const GROUPS: { role: Role; label: string; className: string }[] = [
  { role: 'owner', label: 'Dono', className: 'role-owner' },
  { role: 'admin', label: 'Administradores', className: 'role-admin' },
  { role: 'member', label: 'Disponível', className: '' },
];

/**
 * Coluna da direita: quem participa da comunidade, dividido por cargo como no Discord, com o que cada
 * um está fazendo agora. Offline fica numa lista à parte no fim, esmaecida, sem separar por cargo.
 * Botão direito abre o mesmo menu de volume/administração da barra de voz — e, quem estiver transmitindo,
 * ganha um atalho para entrar direto na sala e assistir.
 */
export function MemberList({
  online,
  voiceMembers,
  channels,
  voice,
  role,
  communityId,
  selfId,
  onWatchStream,
  onSendMessage,
}: {
  online: PresenceEntry[];
  voiceMembers: VoiceMember[];
  channels: Channel[];
  voice: Voice;
  /** Seu cargo nesta comunidade: decide o que o menu do botão direito oferece. */
  role: Role;
  communityId: number;
  selfId: number;
  /** Abre e entra na sala de quem está transmitindo, direto pelo menu do botão direito. */
  onWatchStream: (channelId: number) => void;
  /** Abre a conversa privada com alguém, pelo menu do botão direito. */
  onSendMessage: (userId: number) => void;
}) {
  const { members } = useDirectory();
  const menu = usePersonMenu();
  // "Invisível" só é de boa-fé: o servidor manda o status real, e é o cliente que trata como offline
  // para todo mundo, menos para a própria pessoa (que continua se vendo normalmente).
  const presenceById = new Map(online.map((p) => [p.id, p]));
  const onlineIds = new Set(online.filter((p) => p.id === selfId || p.status !== 'invisivel').map((p) => p.id));
  const voiceById = new Map(voiceMembers.map((m) => [m.userId, m]));
  const channelName = (id: number) => channels.find((c) => c.id === id)?.name ?? 'uma sala';

  const all = [...members.values()].sort((a, b) => a.username.localeCompare(b.username));
  const aqui = all.filter((m) => onlineIds.has(m.id));
  const fora = all.filter((m) => !onlineIds.has(m.id));

  const status = (id: number) => {
    const voice = voiceById.get(id);
    if (!voice) return null;
    if (voice.screen) return { text: `Transmitindo em ${channelName(voice.channelId)}`, live: true };
    if (voice.video) return { text: `Com câmera em ${channelName(voice.channelId)}`, live: false };
    return { text: `Em ${channelName(voice.channelId)}`, live: false };
  };

  const row = (member: CommunityMember, className: string) => {
    const agora = status(member.id);
    return (
      <div key={member.id} className="member" onContextMenu={(e) => menu.open(e, member.id, member.username)}>
        <Avatar name={member.username} userId={member.id} online status={presenceById.get(member.id)?.status} />
        <span className="member-info">
          <span className={`member-name ${className}`}>{member.username}</span>
          {agora && (
            <span className={`member-status${agora.live ? ' live' : ''}`}>
              {agora.live && <span className="live-dot" aria-hidden="true" />}
              {agora.text}
            </span>
          )}
        </span>
      </div>
    );
  };

  return (
    <aside className="members">
      {GROUPS.map(({ role: groupRole, label, className }) => {
        const group = aqui.filter((m) => m.role === groupRole);
        if (group.length === 0) return null;
        return (
          <div key={groupRole}>
            <h3>
              {label} — {group.length}
            </h3>
            {group.map((member) => row(member, className))}
          </div>
        );
      })}

      {fora.length > 0 && (
        <>
          <h3>Offline — {fora.length}</h3>
          {fora.map((member) => (
            <div key={member.id} className="member offline" onContextMenu={(e) => menu.open(e, member.id, member.username)}>
              <Avatar name={member.username} userId={member.id} />
              <span className="member-info">
                <span className="member-name">{member.username}</span>
              </span>
            </div>
          ))}
        </>
      )}

      {menu.target && (
        <PersonMenu
          target={menu.target}
          onClose={menu.close}
          voice={voice}
          role={role}
          channelId={voice.channelId}
          communityId={communityId}
          channels={channels}
          inVoiceChannel={voiceById.get(menu.target.userId)?.channelId ?? null}
          targetScreen={voiceById.get(menu.target.userId)?.screen ?? false}
          targetRole={members.get(menu.target.userId)?.role ?? 'member'}
          isSelf={menu.target.userId === selfId}
          onWatchStream={onWatchStream}
          onSendMessage={onSendMessage}
        />
      )}
    </aside>
  );
}
