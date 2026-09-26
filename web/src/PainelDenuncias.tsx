import { useEffect, useState } from 'react';
import { Flag } from 'lucide-react';
import { api } from './api';

interface Denuncia {
  id: number;
  at: string;
  reporterName: string;
  kind: 'mensagem' | 'pessoa';
  targetName: string | null;
  snapshot: string | null;
  reason: string;
  status: 'aberta' | 'resolvida';
  resolvedBy: string | null;
  resolution: string | null;
}

const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

/**
 * A fila de denúncias, para quem cuida do Syden. Resolver exige escrever o que foi feito — é isso que vai
 * para o registro de auditoria e que responde, meses depois, "por que essa conta foi removida?".
 */
export function PainelDenuncias() {
  const [denuncias, setDenuncias] = useState<Denuncia[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [resolvendo, setResolvendo] = useState<number | null>(null);
  const [texto, setTexto] = useState('');

  function carregar() {
    api<{ denuncias: Denuncia[] }>('/api/reports')
      .then((r) => setDenuncias(r.denuncias))
      .catch((e) => setErro((e as Error).message));
  }
  useEffect(carregar, []);

  async function resolver(id: number) {
    try {
      await api(`/api/reports/${id}/resolver`, { method: 'POST', body: { resolucao: texto } });
      setResolvendo(null);
      setTexto('');
      carregar();
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  if (erro) return <p className="form-error">{erro}</p>;
  if (!denuncias) return null;

  if (denuncias.length === 0) {
    return (
      <section className="usage-card">
        <h3>
          <Flag size={16} aria-hidden="true" /> Denúncias
        </h3>
        <p className="settings-hint">Nenhuma denúncia até agora.</p>
      </section>
    );
  }

  return (
    <section className="usage-card">
      <h3>
        <Flag size={16} aria-hidden="true" /> Denúncias
      </h3>
      <ul className="denuncias-lista">
        {denuncias.map((d) => (
          <li key={d.id} className={`denuncia-item${d.status === 'resolvida' ? ' resolvida' : ''}`}>
            <div className="denuncia-topo">
              <strong>
                {d.kind === 'mensagem' ? 'Mensagem' : 'Pessoa'}
                {d.targetName && ` de ${d.targetName}`}
              </strong>
              <small>
                {quando(d.at)} · denunciada por {d.reporterName}
              </small>
            </div>
            <p className="denuncia-motivo">{d.reason}</p>
            {d.snapshot && <blockquote className="denuncia-copia">{d.snapshot}</blockquote>}

            {d.status === 'resolvida' ? (
              <p className="settings-hint">
                Resolvida por {d.resolvedBy}: {d.resolution}
              </p>
            ) : resolvendo === d.id ? (
              <div className="denuncia-resolver">
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  rows={2}
                  placeholder="O que você fez a respeito?"
                  autoFocus
                />
                <div className="dialog-actions">
                  <button type="button" className="btn-secondary" onClick={() => setResolvendo(null)}>
                    Cancelar
                  </button>
                  <button type="button" className="btn-primary" disabled={!texto.trim()} onClick={() => resolver(d.id)}>
                    Marcar como resolvida
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn-secondary" onClick={() => setResolvendo(d.id)}>
                Resolver
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
