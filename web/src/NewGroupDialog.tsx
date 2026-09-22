import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api';
import { Avatar } from './Avatar';
import { useDirectory } from './directory';
import type { DirectChannel } from './types';

/**
 * Criar uma conversa em grupo: escolhe quem entra (entre quem está na comunidade aberta) e, se quiser,
 * dá um nome. Sem nome, o grupo nasce chamado "Grupo" e dá para renomear depois.
 */
export function NewGroupDialog({
  selfId,
  onClose,
  onCreated,
}: {
  selfId: number;
  onClose: () => void;
  onCreated: (conversa: DirectChannel) => void;
}) {
  const { members } = useDirectory();
  const [chosen, setChosen] = useState<number[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const pessoas = [...members.values()].filter((m) => m.id !== selfId).sort((a, b) => a.username.localeCompare(b.username));
  const toggle = (id: number) => setChosen((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  async function create() {
    setBusy(true);
    try {
      const conversa = await api<DirectChannel>('/api/direct', {
        method: 'POST',
        body: { userIds: chosen, name: name.trim() || (chosen.length > 1 ? 'Grupo' : '') },
      });
      onCreated(conversa);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="group-dialog-title">
        <h2 id="group-dialog-title">Nova conversa</h2>
        <div className="dialog-body">
          <p className="dialog-note">Escolha quem entra. Com mais de uma pessoa, vira uma conversa em grupo.</p>

          <div className="group-people">
            {pessoas.length === 0 && <p className="settings-hint">Ninguém mais nesta comunidade ainda.</p>}
            {pessoas.map((pessoa) => (
              <button
                key={pessoa.id}
                className={`group-person${chosen.includes(pessoa.id) ? ' chosen' : ''}`}
                aria-pressed={chosen.includes(pessoa.id)}
                onClick={() => toggle(pessoa.id)}
              >
                <Avatar name={pessoa.username} userId={pessoa.id} size={28} />
                <span className="group-person-name">{pessoa.username}</span>
                {chosen.includes(pessoa.id) && <Check size={16} />}
              </button>
            ))}
          </div>

          {chosen.length > 1 && (
            <label>
              Nome do grupo (opcional)
              <input value={name} maxLength={50} placeholder="Ex.: Time do Valorant" onChange={(e) => setName(e.target.value)} />
            </label>
          )}
        </div>

        {error && <p className="form-error">{error}</p>}
        <div className="dialog-actions">
          <button className="link-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={chosen.length === 0 || busy} onClick={() => void create()}>
            {busy ? 'Criando…' : 'Começar conversa'}
          </button>
        </div>
      </div>
    </div>
  );
}
