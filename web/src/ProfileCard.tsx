import { MessageSquare } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Avatar } from './Avatar';
import { Vitrine, legendaDaVitrine } from './Vitrine';
import { useNota } from './notas';
import { classeDoFundo, corDoNome } from './profileStyles';
import type { CommunityMember, PresenceStatus } from './types';

const CARGO: Record<string, string> = { owner: 'Dono da comunidade', admin: 'Administra a comunidade', member: 'Membro' };
const PRESENCA: Record<PresenceStatus, string> = {
  online: 'Disponível',
  ausente: 'Ausente',
  ocupado: 'Não perturbe',
  invisivel: 'Offline',
};

/**
 * O cartão que aparece ao clicar em alguém: o fundo escolhido pela pessoa, o avatar por cima e o nome
 * na cor dela. É aqui que os enfeites de perfil ganham um lugar de verdade para aparecer.
 */
export function ProfileCard({
  membro,
  status,
  x,
  y,
  onClose,
  onSendMessage,
  isSelf,
}: {
  membro: CommunityMember;
  status: PresenceStatus | undefined;
  x: number;
  y: number;
  onClose: () => void;
  onSendMessage: (userId: number) => void;
  isSelf: boolean;
}) {
  const nota = useNota(membro.id);
  const ref = useRef<HTMLDivElement | null>(null);
  const [lugar, setLugar] = useState({ left: x, top: y });

  // O cartão nasce onde o mouse clicou, mas não pode passar da borda da janela.
  useEffect(() => {
    const caixa = ref.current?.getBoundingClientRect();
    if (!caixa) return;
    setLugar({
      left: Math.max(8, Math.min(x, window.innerWidth - caixa.width - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - caixa.height - 8)),
    });
  }, [x, y]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="perfil-sombra" onClick={onClose} onContextMenu={(e) => e.preventDefault()}>
      <div
        ref={ref}
        className="perfil-cartao"
        style={{ left: lugar.left, top: lugar.top }}
        role="dialog"
        aria-label={`Perfil de ${membro.username}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`perfil-banner ${classeDoFundo(membro.banner)}`} aria-hidden="true" />
        <div className="perfil-avatar">
          <Avatar name={membro.username} userId={membro.id} size={72} />
        </div>
        <div className="perfil-corpo">
          <h3 className="perfil-nome" data-cor={corDoNome(membro.nameColor)}>
            {membro.username}
          </h3>
          <p className="perfil-linha">{CARGO[membro.role] ?? 'Membro'}</p>
          <p className="perfil-linha">{status ? PRESENCA[status] : 'Offline'}</p>
          {membro.vitrine?.length > 0 && (
            <span className="medalha-linha">
              <Vitrine membro={membro} tamanho={72} />
              <span className="medalha-legenda">
                <strong>{legendaDaVitrine(membro)}</strong>
                {membro.acceptedIdeas > 0 && (
                  <small>
                    {membro.acceptedIdeas === 1 ? 'Uma ideia dela entrou no app' : membro.acceptedIdeas + ' ideias dela entraram no app'}
                  </small>
                )}
              </span>
            </span>
          )}
          {nota && (
            <p className="perfil-nota" title="Anotação sua, guardada só neste computador">
              {nota}
            </p>
          )}
          {!isSelf && (
            <button
              className="perfil-acao"
              onClick={() => {
                onClose();
                onSendMessage(membro.id);
              }}
            >
              <MessageSquare size={16} aria-hidden="true" />
              Mandar mensagem
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
