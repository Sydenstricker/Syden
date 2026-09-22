import { Avatar } from './Avatar';
import { useDirectory } from './directory';
import type { Channel, CommunityMember, Role, UserRef, VoiceMember } from './types';

/** Como no Discord: dono destacado, depois administradores, depois o resto — cada um com sua cor. */
const GROUPS: { role: Role; label: string; className: string }[] = [
  { role: 'owner', label: 'Dono', className: 'role-owner' },
  { role: 'admin', label: 'Administradores', className: 'role-admin' },
  { role: 'member', label: 'Disponível', className: '' },
];

/**
 * Coluna da direita: quem participa da comunidade, dividido por cargo como no Discord, com o que cada
 * um está fazendo agora. Offline fica numa lista à parte no fim, esmaecida, sem separar por cargo.
 */
export function MemberList({
  online,
  voiceMembers,
  channels,
}: {
  online: UserRef[];
  voiceMembers: VoiceMember[];
  channels: Channel[];
}) {
  const { members } = useDirectory();
  const onlineIds = new Set(online.map((p) => p.id));
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
      <div key={member.id} className="member">
        <Avatar name={member.username} userId={member.id} online />
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
      {GROUPS.map(({ role, label, className }) => {
        const group = aqui.filter((m) => m.role === role);
        if (group.length === 0) return null;
        return (
          <div key={role}>
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
            <div key={member.id} className="member offline">
              <Avatar name={member.username} userId={member.id} />
              <span className="member-info">
                <span className="member-name">{member.username}</span>
              </span>
            </div>
          ))}
        </>
      )}
    </aside>
  );
}
