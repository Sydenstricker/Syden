import { LogIn, Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { api } from './api';
import { CommunityIcon } from './CommunityIcon';
import { Logo } from './Logo';
import type { Community } from './types';

interface Props {
  communities: Community[];
  currentId: number | null;
  onSelect: (id: number) => void;
  onChanged: (community: Community) => void;
}

export function CommunityRail({ communities, currentId, onSelect, onChanged }: Props) {
  const [dialog, setDialog] = useState<'create' | 'join' | null>(null);

  return (
    <nav className="rail" aria-label="Comunidades">
      <div className="rail-logo" title="Syden">
        <Logo size={26} />
      </div>
      <div className="rail-list">
        {communities.map((community) => (
          <button
            key={community.id}
            className={`rail-item${community.id === currentId ? ' active' : ''}`}
            title={community.name}
            aria-label={community.name}
            aria-current={community.id === currentId}
            onClick={() => onSelect(community.id)}
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
    </nav>
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
