import { Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api';
import type { Message } from './types';

const MAX_OPTIONS = 10;

/** Janela de criar enquete: pergunta, opções e se dá para marcar mais de uma. */
export function PollDialog({
  channelId,
  threadId = null,
  onClose,
  onCreated,
}: {
  channelId: number;
  threadId?: number | null;
  onClose: () => void;
  onCreated?: (message: Message) => void;
}) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multiple, setMultiple] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filled = options.map((o) => o.trim()).filter(Boolean);
  const ready = question.trim().length > 0 && filled.length >= 2;

  async function create() {
    setBusy(true);
    try {
      const message = await api<Message>(`/api/channels/${channelId}/polls`, {
        method: 'POST',
        body: { question: question.trim(), options: filled, multiple, threadId },
      });
      onCreated?.(message);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog poll-dialog" role="dialog" aria-modal="true" aria-labelledby="poll-dialog-title">
        <h2 id="poll-dialog-title">Criar enquete</h2>
        <div className="dialog-body">
          <label>
            Pergunta
            <input
              autoFocus
              value={question}
              maxLength={300}
              placeholder="O que vamos jogar hoje?"
              onChange={(e) => setQuestion(e.target.value)}
            />
          </label>

          <div className="poll-dialog-options">
            <span className="poll-dialog-label">Opções</span>
            {options.map((option, i) => (
              <div key={i} className="poll-dialog-option">
                <input
                  value={option}
                  maxLength={100}
                  placeholder={`Opção ${i + 1}`}
                  aria-label={`Opção ${i + 1}`}
                  onChange={(e) => setOptions((list) => list.map((o, j) => (j === i ? e.target.value : o)))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && options.length < MAX_OPTIONS && i === options.length - 1) {
                      e.preventDefault();
                      setOptions((list) => [...list, '']);
                    }
                  }}
                />
                {options.length > 2 && (
                  <button
                    className="icon-plain"
                    aria-label={`Tirar opção ${i + 1}`}
                    title="Tirar opção"
                    onClick={() => setOptions((list) => list.filter((_, j) => j !== i))}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
            {options.length < MAX_OPTIONS && (
              <button className="poll-dialog-add" onClick={() => setOptions((list) => [...list, ''])}>
                <Plus size={16} /> Adicionar opção
              </button>
            )}
          </div>

          <label className="poll-dialog-multi">
            <input type="checkbox" checked={multiple} onChange={(e) => setMultiple(e.target.checked)} />
            Deixar marcar mais de uma opção
          </label>
        </div>

        {error && <p className="form-error">{error}</p>}
        <div className="dialog-actions">
          <button className="link-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={!ready || busy} onClick={() => void create()}>
            {busy ? 'Criando…' : 'Criar enquete'}
          </button>
        </div>
      </div>
    </div>
  );
}
