import { Clock } from 'lucide-react';
import { useState } from 'react';
import { Puxador } from './Puxador';
import { Avatar } from './Avatar';
import { SeloDaComunidade } from './SeloDaComunidade';
import { useDirectory } from './directory';
import { PersonMenu, usePersonMenu } from './PersonMenu';
import { ProfileCard } from './ProfileCard';
import { corDoNome, efeitoDoNome, letraDoNome } from './profileStyles';
import { fraseDaTransmissao } from './streamName';
import { quemAssiste } from './assistindo';
import { silencioVale } from './ModeracaoDaPessoa';
import { chave, useT } from './i18n';
import type { Channel, CommunityMember, PresenceEntry, Role, VoiceMember } from './types';
import type { Voice } from './useVoice';

/** Como no Discord: dono destacado, depois administradores, depois o resto — cada um com sua cor. */
const GROUPS: { role: Role; label: string; className: string }[] = [
  { role: 'owner', label: chave('Dono'), className: 'role-owner' },
  { role: 'admin', label: chave('Administradores'), className: 'role-admin' },
  { role: 'member', label: chave('Disponível'), className: '' },
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
  onWatchStream: (channelId: number, userId: number) => void;
  /** Abre a conversa privada com alguém, pelo menu do botão direito. */
  onSendMessage: (userId: number) => void;
}) {
  const t = useT();
  const { members, cargos } = useDirectory();
  const menu = usePersonMenu();
  // Clicar em alguém abre o cartão de perfil, com o fundo e a cor de nome que a pessoa escolheu.
  const [perfil, setPerfil] = useState<{ membro: CommunityMember; x: number; y: number } | null>(null);
  // "Invisível" só é de boa-fé: o servidor manda o status real, e é o cliente que trata como offline
  // para todo mundo, menos para a própria pessoa (que continua se vendo normalmente).
  const presenceById = new Map(online.map((p) => [p.id, p]));
  const onlineIds = new Set(online.filter((p) => p.id === selfId || p.status !== 'invisivel').map((p) => p.id));
  const voiceById = new Map(voiceMembers.map((m) => [m.userId, m]));
  // Quem está na plateia de uma transmissão aparece de pipoca (ver assistindo.ts).
  const plateia = quemAssiste(voiceMembers);
  const channelName = (id: number) => channels.find((c) => c.id === id)?.name ?? t('uma sala');

  const all = [...members.values()].sort((a, b) => a.username.localeCompare(b.username));
  const aqui = all.filter((m) => onlineIds.has(m.id));
  const fora = all.filter((m) => !onlineIds.has(m.id));

  const status = (id: number) => {
    const voice = voiceById.get(id);
    if (!voice) return null;
    if (voice.screen) return { text: fraseDaTransmissao(voice.screenName, channelName(voice.channelId)), live: true };
    // Quem está de pipoca diz QUEM assiste: é a legenda do coelho de pipoca, que sozinho ninguém lia.
    const alvo = plateia.has(id) ? voiceMembers.find((m) => m.screen && voice.assistindo?.includes(m.userId)) : undefined;
    if (alvo) return { text: t('Assistindo {pessoa}', { pessoa: alvo.username }), live: false };
    if (voice.video) return { text: t('Com câmera em {sala}', { sala: channelName(voice.channelId) }), live: false };
    return { text: t('Em {sala}', { sala: channelName(voice.channelId) }), live: false };
  };

  const row = (member: CommunityMember, className: string) => {
    const agora = status(member.id);
    return (
      <div
        key={member.id}
        className="member"
        role="button"
        tabIndex={0}
        onClick={(e) => setPerfil({ membro: member, x: e.clientX - 150, y: e.clientY - 40 })}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            const caixa = e.currentTarget.getBoundingClientRect();
            setPerfil({ membro: member, x: caixa.left - 160, y: caixa.top });
          }
        }}
        onContextMenu={(e) => menu.open(e, member.id, member.username)}
      >
        <Avatar
          name={member.username}
          userId={member.id}
          online
          status={presenceById.get(member.id)?.status}
          assistindo={plateia.has(member.id)}
        />
        <span className="member-info">
          <span className={`member-name ${className}`} data-cor={corDoNome(member.nameColor)} data-efeito={efeitoDoNome(member.nameEffect)} style={{ fontFamily: letraDoNome(member.nameFont) }}>
            {member.username}
          </span>
          {member.selo && <SeloDaComunidade selo={member.selo} />}
          {silencioVale(member.silenciadoAte) && (
            <span className="member-silencio" title={t('Em silêncio')} aria-label={t('Em silêncio')}>
              <Clock size={13} />
            </span>
          )}
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

  /**
   * OS GRUPOS, como no Discord: dono, administradores, depois um grupo para cada cargo marcado como
   * "separado na lista" (na ordem dos cargos), e o resto em "Disponível". Cada pessoa aparece uma vez
   * só, no primeiro grupo que lhe cabe — quem tem dois cargos separados fica no de cima.
   */
  const separados = cargos.filter((c) => c.separado);
  const grupoDe = (m: CommunityMember): string => {
    if (m.role !== 'member') return m.role;
    const cargo = separados.find((c) => m.cargos?.includes(c.id));
    return cargo ? `cargo-${cargo.id}` : 'member';
  };
  const naOrdem = [
    ...GROUPS.filter((g) => g.role !== 'member').map((g) => ({ chave: g.role, titulo: t(g.label), className: g.className })),
    ...separados.map((c) => ({ chave: `cargo-${c.id}`, titulo: c.nome, className: '' })),
    ...GROUPS.filter((g) => g.role === 'member').map((g) => ({ chave: g.role, titulo: t(g.label), className: g.className })),
  ];
  const grupos = naOrdem.map((g) => ({ ...g, gente: aqui.filter((m) => grupoDe(m) === g.chave) }));

  return (
    <aside className="members">
      <Puxador barra="membros" lado="esquerda" />
      {grupos.map(({ chave: chaveDoGrupo, titulo, className, gente }) =>
        gente.length === 0 ? null : (
          <div key={chaveDoGrupo}>
            <h3>
              <bdi>{titulo}</bdi> — {gente.length}
            </h3>
            {gente.map((member) => row(member, className))}
          </div>
        ),
      )}

      {fora.length > 0 && (
        <>
          <h3>Offline — {fora.length}</h3>
          {fora.map((member) => (
            <div
              key={member.id}
              className="member offline"
              role="button"
              tabIndex={0}
              onClick={(e) => setPerfil({ membro: member, x: e.clientX - 150, y: e.clientY - 40 })}
              onContextMenu={(e) => menu.open(e, member.id, member.username)}
            >
              <Avatar name={member.username} userId={member.id} offline />
              <span className="member-info">
                <span className="member-name" data-cor={corDoNome(member.nameColor)} data-efeito={efeitoDoNome(member.nameEffect)} style={{ fontFamily: letraDoNome(member.nameFont) }}>
                  {member.username}
                </span>
              </span>
            </div>
          ))}
        </>
      )}

      {perfil && (
        <ProfileCard
          membro={perfil.membro}
          status={presenceById.get(perfil.membro.id)?.status}
          x={perfil.x}
          y={perfil.y}
          isSelf={perfil.membro.id === selfId}
          onClose={() => setPerfil(null)}
          onSendMessage={onSendMessage}
        />
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
          onOpenProfile={(userId, x, y) => {
            const alvo = members.get(userId);
            if (alvo) setPerfil({ membro: alvo, x, y });
          }}
        />
      )}
    </aside>
  );
}
