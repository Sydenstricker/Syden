import { MessagesSquare, Plus, Users } from 'lucide-react';
import { Avatar } from './Avatar';
import { isUnread } from './unread';
import type { DirectChannel, UserRef } from './types';

/** Nome que aparece na lista: o do grupo, ou o da outra pessoa numa conversa de dois. */
export function directName(conversa: DirectChannel, selfId: number): string {
  if (conversa.name) return conversa.name;
  const outros = conversa.members.filter((m) => m.id !== selfId);
  if (outros.length === 0) return 'Só você';
  return outros.map((m) => m.username).join(', ');
}

/** Quem ilustra a conversa: a outra pessoa, ou (no grupo) a primeira que não é você. */
function faceOf(conversa: DirectChannel, selfId: number): UserRef | undefined {
  return conversa.members.find((m) => m.id !== selfId) ?? conversa.members[0];
}

/**
 * Barra lateral no modo "Conversas": as conversas privadas no lugar dos canais da comunidade,
 * da mais recente para a mais antiga.
 */
export function DirectList({
  conversas,
  selectedId,
  selfId,
  onSelect,
  onNewGroup,
}: {
  conversas: DirectChannel[];
  selectedId: number | null;
  selfId: number;
  onSelect: (conversa: DirectChannel) => void;
  onNewGroup: () => void;
}) {
  return (
    <div className="channel-list">
      <div className="channel-group">
        <div className="channel-group-title">
          <span>Conversas</span>
          <button className="icon-plain" title="Nova conversa em grupo" aria-label="Nova conversa em grupo" onClick={onNewGroup}>
            <Plus size={16} />
          </button>
        </div>

        {conversas.length === 0 && (
          <p className="direct-empty">
            Nenhuma conversa ainda. Clique com o botão direito em alguém da comunidade e escolha "Enviar mensagem".
          </p>
        )}

        {conversas.map((conversa) => {
          const face = faceOf(conversa, selfId);
          const grupo = conversa.members.length > 2;
          const nova = isUnread(conversa) && conversa.id !== selectedId;
          return (
            <button
              key={conversa.id}
              className={`direct-row${conversa.id === selectedId ? ' active' : ''}${nova ? ' unread' : ''}`}
              onClick={() => onSelect(conversa)}
            >
              {grupo ? (
                <span className="direct-group-icon">
                  <Users size={18} />
                </span>
              ) : (
                <Avatar name={face?.username ?? '?'} userId={face?.id} size={32} />
              )}
              <span className="direct-info">
                <span className="direct-name">{directName(conversa, selfId)}</span>
                <span className="direct-preview">
                  {conversa.lastMessage || (grupo ? `${conversa.members.length} pessoas` : 'Sem mensagens ainda')}
                </span>
              </span>
              {nova && <span className="direct-row-dot" aria-label="mensagem nova" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Botão do topo da coluna de comunidades que abre as conversas privadas. */
export function DirectRailButton({ active, unread, onClick }: { active: boolean; unread: number; onClick: () => void }) {
  return (
    <button
      className={`rail-item rail-action direct-rail${active ? ' active' : ''}`}
      title={unread > 0 ? `Conversas (${unread} com mensagem nova)` : 'Conversas'}
      aria-label={unread > 0 ? `Conversas, ${unread} com mensagem nova` : 'Conversas'}
      aria-current={active}
      onClick={onClick}
    >
      <MessagesSquare size={20} />
      {unread > 0 && <span className="direct-unread">{unread > 9 ? '9+' : unread}</span>}
    </button>
  );
}
