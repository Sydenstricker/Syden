import { MessageSquare } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Avatar } from './Avatar';
import { Vitrine, legendaDaVitrine } from './Vitrine';
import { useNota } from './notas';
import { classeDoFundo, corDoNome, efeitoDoNome, letraDoNome } from './profileStyles';
import type { CommunityMember, PresenceStatus } from './types';
import { chave, useT } from './i18n';

const CARGO: Record<string, string> = {
  owner: chave('Dono da comunidade'),
  admin: chave('Administra a comunidade'),
  member: chave('Membro'),
};
const PRESENCA: Record<PresenceStatus, string> = {
  online: chave('Disponível'),
  ausente: chave('Ausente'),
  ocupado: chave('Não perturbe'),
  invisivel: chave('Offline'),
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
  const t = useT();
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
          <h3 className="perfil-nome" data-cor={corDoNome(membro.nameColor)} data-efeito={efeitoDoNome(membro.nameEffect)} style={{ fontFamily: letraDoNome(membro.nameFont) }}>
            {membro.username}
          </h3>
          <p className="perfil-linha">{t(CARGO[membro.role] ?? chave('Membro'))}</p>
          <p className="perfil-linha">{t(status ? PRESENCA[status] : chave('Offline'))}</p>
          {membro.vitrine?.length > 0 && (
            <span className="medalha-linha">
              {/* 46 e não 72: a conta está no .medalha-linha, e é o que faz cinco insígnias caberem
                  numa fileira só em vez de virarem uma coluna. */}
              <Vitrine membro={membro} tamanho={46} />
              <span className="medalha-legenda">
                <strong>{legendaDaVitrine(membro)}</strong>
                {/* SEM "DELA": a frase fala de uma pessoa que pode ser qualquer pessoa, e o cartão é o
                    lugar mais errado possível para errar isso. "Teve uma ideia" resolve sem rodeio.
                    E passa pelo t(): estava cravada em português porque texto dentro de chaves não é
                    alcançado pela busca de texto cravado — ali dentro é código. */}
                {membro.acceptedIdeas > 0 && (
                  <small>
                    {membro.acceptedIdeas === 1
                      ? t('Teve uma ideia que entrou no app')
                      : t('Teve {quantas} ideias que entraram no app', { quantas: membro.acceptedIdeas })}
                  </small>
                )}
              </span>
            </span>
          )}
          {nota && (
            <p className="perfil-nota" title={t('Anotação sua, guardada só neste computador')}>
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
              {t('Mandar mensagem')}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
