import { BarChart3, Check } from 'lucide-react';
import { useState } from 'react';
import { api } from './api';
import type { Poll } from './types';

/**
 * A enquete dentro da mensagem: cada opção é um botão com a barra de quantos votaram.
 * Clicar de novo na mesma opção tira o voto, como no Discord.
 */
export function PollCard({ poll, canClose, onChange }: { poll: Poll; canClose: boolean; onChange: (poll: Poll) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(path: string, body?: unknown) {
    setBusy(true);
    try {
      onChange(await api<Poll>(path, { method: 'POST', body: body ?? {} }));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const base = Math.max(poll.voters, 1);

  return (
    <div className="poll">
      <div className="poll-head">
        <BarChart3 size={16} />
        <span className="poll-question">{poll.question}</span>
      </div>

      <div className="poll-options">
        {poll.options.map((option) => {
          const percent = Math.round((option.votes / base) * 100);
          return (
            <button
              key={option.id}
              className={`poll-option${option.mine ? ' mine' : ''}`}
              disabled={busy || poll.closed}
              aria-pressed={option.mine}
              onClick={() => void act(`/api/polls/${poll.id}/vote`, { optionId: option.id })}
            >
              <span className="poll-bar" style={{ width: `${percent}%` }} aria-hidden="true" />
              <span className="poll-option-text">
                {option.mine && <Check size={14} />}
                {option.text}
              </span>
              <span className="poll-option-count">
                {percent}% · {option.votes}
              </span>
            </button>
          );
        })}
      </div>

      <div className="poll-foot">
        <span>
          {poll.voters === 0 ? 'Ninguém votou ainda' : poll.voters === 1 ? '1 pessoa votou' : `${poll.voters} pessoas votaram`}
          {poll.multiple && !poll.closed && ' · dá para marcar mais de uma'}
          {poll.closed && ' · enquete encerrada'}
        </span>
        {canClose && !poll.closed && (
          <button className="link-button" disabled={busy} onClick={() => void act(`/api/polls/${poll.id}/close`)}>
            Encerrar enquete
          </button>
        )}
      </div>
      {error && <p className="form-error small">{error}</p>}
    </div>
  );
}
