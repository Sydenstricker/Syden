import { Link, LogIn, Plus } from 'lucide-react';
import { type FormEvent, type MouseEvent, type ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from './api';
import { CommunityIcon } from './CommunityIcon';
import { useT } from './i18n';
import { Logo } from './Logo';
import type { Community } from './types';

interface Props {
  communities: Community[];
  currentId: number | null;
  onSelect: (id: number) => void;
  onChanged: (community: Community) => void;
  /** Botão extra acima das comunidades (as conversas privadas ficam aqui). */
  top?: ReactNode;
  /** O logo no alto abre a tela inicial. */
  onHome: () => void;
  homeActive: boolean;
}

export function CommunityRail({ communities, currentId, onSelect, onChanged, top, onHome, homeActive }: Props) {
  const t = useT();
  const [dialog, setDialog] = useState<CommunityDialogMode | null>(null);
  const [menu, setMenu] = useState<{ community: Community; x: number; y: number } | null>(null);

  return (
    <nav className="rail" aria-label={t('Comunidades')}>
      <button
        className={`rail-logo${homeActive ? ' active' : ''}`}
        title={t('Início do Syden')}
        aria-label={t('Início do Syden')}
        aria-current={homeActive}
        onClick={onHome}
      >
        <Logo size={34} />
      </button>
      {top}
      <div className="rail-list">
        {communities.map((community) => (
          <button
            key={community.id}
            className={`rail-item${community.id === currentId ? ' active' : ''}`}
            title={community.name}
            aria-label={community.name}
            aria-current={community.id === currentId}
            onClick={() => onSelect(community.id)}
            onContextMenu={(e: MouseEvent) => {
              e.preventDefault();
              setMenu({ community, x: e.clientX, y: e.clientY });
            }}
          >
            <CommunityIcon community={community} />
          </button>
        ))}
      </div>
      {/* Um botão só: criar do zero e entrar por convite são dois caminhos da mesma coisa (ter mais uma
          comunidade na lista), e a escolha fica dentro da janela. */}
      <button
        className="rail-item rail-action"
        title="Adicionar comunidade"
        aria-label={t('Adicionar comunidade')}
        onClick={() => setDialog('choose')}
      >
        <Plus size={20} />
      </button>

      {dialog && (
        <CommunityDialog
          mode={dialog}
          onClose={() => setDialog(null)}
          onDone={(community) => {
            setDialog(null);
            onChanged(community);
          }}
        />
      )}

      {menu && <CommunityMenu community={menu.community} x={menu.x} y={menu.y} onClose={() => setMenu(null)} />}
    </nav>
  );
}

/**
 * Menu do botão direito em cima de uma comunidade na barra: por enquanto, só o link de convite —
 * só existe para quem administra (é quem recebe o código; ver server/src/db.ts, listCommunitiesForUser).
 */
function CommunityMenu({ community, x, y, onClose }: { community: Community; x: number; y: number; onClose: () => void }) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const close = () => onClose();
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', close);
    };
  }, [onClose]);

  function copyLink() {
    const url = new URL(window.location.href);
    url.search = `?convite=${community.inviteCode}`;
    url.hash = '';
    void navigator.clipboard?.writeText(url.toString());
    setCopied(true);
    setTimeout(onClose, 900);
  }

  return createPortal(
    <div
      className="person-menu"
      role="menu"
      style={{ top: Math.min(y, window.innerHeight - 100), left: Math.min(x, window.innerWidth - 250) }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="person-menu-name">{community.name}</div>
      {community.inviteCode ? (
        <button className="person-menu-item" onClick={copyLink}>
          <Link size={16} /> {copied ? t('Link copiado!') : t('Copiar link de convite')}
        </button>
      ) : (
        <p className="person-menu-hint">{t('Só quem administra pode convidar gente nova.')}</p>
      )}
    </div>,
    document.body,
  );
}

export type CommunityDialogMode = 'choose' | 'create' | 'join';

/**
 * Ter mais uma comunidade na lista: criando do zero ou entrando na de alguém com o código. Começando em
 * "choose", a janela pergunta primeiro qual dos dois — é o mesmo lugar, com dois caminhos.
 */
export function CommunityDialog({
  mode: modoInicial,
  onClose,
  onDone,
}: {
  mode: CommunityDialogMode;
  onClose: () => void;
  onDone: (community: Community) => void;
}) {
  const t = useT();
  const [mode, setMode] = useState<CommunityDialogMode>(modoInicial);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const creating = mode === 'create';

  function escolher(proximo: CommunityDialogMode) {
    setValue('');
    setError(null);
    setMode(proximo);
  }

  if (mode === 'choose') {
    return (
      <div className="dialog-backdrop" onClick={onClose}>
        <div className="dialog" role="dialog" aria-label={t('Adicionar comunidade')} onClick={(e) => e.stopPropagation()}>
          <h2>{t('Adicionar comunidade')}</h2>
          <p className="dialog-body">{t('Comece a sua, ou entre na de alguém com o código que essa pessoa te passou.')}</p>
          <div className="community-choice">
            <button className="community-choice-option" onClick={() => escolher('create')}>
              <Plus size={22} />
              <span>
                <strong>{t('Criar a minha')}</strong>
                <small>{t('Um lugar novo, com canais próprios, e você decide quem entra.')}</small>
              </span>
            </button>
            <button className="community-choice-option" onClick={() => escolher('join')}>
              <LogIn size={20} />
              <span>
                <strong>{t('Entrar com um convite')}</strong>
                <small>{t('Já recebeu um código de alguém? É por aqui.')}</small>
              </span>
            </button>
          </div>
          <div className="dialog-actions">
            <button type="button" className="link-button" onClick={onClose}>
              {t('Cancelar')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const community = creating
        ? await api<Community>('/api/communities', {
            method: 'POST',
            // Os canais iniciais nascem no idioma de quem cria (eram sempre geral, jogos, Sala 1 e Sala 2).
            body: { name: value, canais: [t('geral'), t('jogos'), t('Sala 1'), t('Sala 2')] },
          })
        : await api<Community>('/api/communities/join', { method: 'POST', body: { code: value } });
      onDone(community);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <form className="dialog" role="dialog" aria-label={creating ? 'Criar comunidade' : 'Entrar com um convite'} onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>{creating ? 'Criar comunidade' : 'Entrar com um convite'}</h2>
        <p className="dialog-body">
          {creating
            ? t('Um lugar novo, com canais próprios. Você escolhe quem entra pelo código de convite.')
            : t('Cole aqui o código que alguém te passou.')}
        </p>
        <label>
          {creating ? t('Nome da comunidade') : t('Código de convite')}
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={creating ? t('Ex.: Time do Valorant') : t('Ex.: k3m9xq2p')}
            autoFocus
            required
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="dialog-actions">
          <button
            type="button"
            className="link-button"
            onClick={() => (modoInicial === 'choose' ? escolher('choose') : onClose())}
          >
            {modoInicial === 'choose' ? 'Voltar' : 'Cancelar'}
          </button>
          <button className="btn-primary" disabled={busy}>
            {busy ? 'Aguarde…' : creating ? 'Criar' : 'Entrar'}
          </button>
        </div>
      </form>
    </div>
  );
}
