import { Link, LogIn, Plus } from 'lucide-react';
import { type FormEvent, type MouseEvent, type ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from './api';
import { CommunityIcon } from './CommunityIcon';
import { Logo } from './Logo';
import type { Community } from './types';

interface Props {
  communities: Community[];
  currentId: number | null;
  onSelect: (id: number) => void;
  onChanged: (community: Community) => void;
  /** Botão extra acima das comunidades (as conversas privadas ficam aqui). */
  top?: ReactNode;
}

export function CommunityRail({ communities, currentId, onSelect, onChanged, top }: Props) {
  const [dialog, setDialog] = useState<'create' | 'join' | null>(null);
  const [menu, setMenu] = useState<{ community: Community; x: number; y: number } | null>(null);

  return (
    <nav className="rail" aria-label="Comunidades">
      <div className="rail-logo" title="Syden">
        <Logo size={26} />
      </div>
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
      <button className="rail-item rail-action" title="Criar comunidade" aria-label="Criar comunidade" onClick={() => setDialog('create')}>
        <Plus size={20} />
      </button>
      <button className="rail-item rail-action" title="Entrar com um convite" aria-label="Entrar com um convite" onClick={() => setDialog('join')}>
        <LogIn size={18} />
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
          <Link size={16} /> {copied ? 'Link copiado!' : 'Copiar link de convite'}
        </button>
      ) : (
        <p className="person-menu-hint">Só quem administra pode convidar gente nova.</p>
      )}
    </div>,
    document.body,
  );
}

/** Criar uma comunidade nova ou entrar numa que já existe, pelo código de convite. */
export function CommunityDialog({
  mode,
  onClose,
  onDone,
}: {
  mode: 'create' | 'join';
  onClose: () => void;
  onDone: (community: Community) => void;
}) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const creating = mode === 'create';

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const community = creating
        ? await api<Community>('/api/communities', { method: 'POST', body: { name: value } })
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
            ? 'Um lugar novo, com canais próprios. Você escolhe quem entra pelo código de convite.'
            : 'Cole aqui o código que alguém te passou.'}
        </p>
        <label>
          {creating ? 'Nome da comunidade' : 'Código de convite'}
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={creating ? 'Ex.: Time do Valorant' : 'Ex.: k3m9xq2p'}
            autoFocus
            required
          />
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="link-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={busy}>
            {busy ? 'Aguarde…' : creating ? 'Criar' : 'Entrar'}
          </button>
        </div>
      </form>
    </div>
  );
}
