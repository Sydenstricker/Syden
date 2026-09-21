import { Avatar } from './Avatar';
import { useDirectory } from './directory';
import type { Channel, UserRef, VoiceMember } from './types';

/**
 * Coluna da direita: quem participa da comunidade, com o que cada um está fazendo agora, como no Discord.
 * Offline fica no fim, esmaecido, para a lista não sumir quando o pessoal desconecta.
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

  return (
    <aside className="members">
      {/* Só quem participa desta comunidade: não dá para espiar quem está em outra. */}
      <h3>Online — {aqui.length}</h3>
      {aqui.map((member) => {
        const agora = status(member.id);
        return (
          <div key={member.id} className="member">
            <Avatar name={member.username} userId={member.id} online />
            <span className="member-info">
              <span className="member-name">{member.username}</span>
              {agora && (
                <span className={`member-status${agora.live ? ' live' : ''}`}>
                  {agora.live && <span className="live-dot" aria-hidden="true" />}
                  {agora.text}
                </span>
              )}
            </span>
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
