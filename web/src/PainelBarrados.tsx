import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { api } from './api';
import { useT } from './i18n';

interface Barrado {
  userId: number;
  username: string;
  banidoEm: string | null;
  banidoMotivo: string | null;
  suspensaEm: string | null;
  suspensaMotivo: string | null;
  recurso: string | null;
  recursoEm: string | null;
}

const quando = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });

/**
 * BANIR E SUSPENDER POR IDADE (17/10/2026; ver server/src/protecao.ts), para quem cuida do Syden. O motivo é obrigatório
 * porque é o que a pessoa lê na tela dela, e é dele que ela recorre (ECA Digital, art. 30). Os recursos chegam aqui.
 */
export function BarrarConta({ username = '', aoFeito }: { username?: string; aoFeito?: () => void }) {
  const t = useT();
  const [nome, setNome] = useState(username);
  const [motivo, setMotivo] = useState('');
  const [acao, setAcao] = useState<'banir' | 'suspender-idade'>('banir');
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState(false);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    try {
      await api(`/api/admin/${acao}`, { method: 'POST', body: { username: nome, motivo } });
      setFeito(true);
      setMotivo('');
      aoFeito?.();
    } catch (err) {
      setErro((err as Error).message);
    }
  }
  return (
    <form className="denuncia-resolver" onSubmit={enviar}>
      <div className="denuncia-autoridade">
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder={t('Nome de usuário')} required />
        <select value={acao} onChange={(e) => setAcao(e.target.value as typeof acao)}>
          <option value="banir">{t('Banir do Syden')}</option>
          <option value="suspender-idade">{t('Suspender por idade')}</option>
        </select>
      </div>
      <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} placeholder={t('O motivo (a pessoa vai ler)')} required />
      {erro && <p className="form-error">{erro}</p>}
      {feito && <p className="form-success">{t('Feito. A pessoa vê o motivo e pode recorrer.')}</p>}
      <button className="btn-primary" disabled={!nome.trim() || motivo.trim().length < 5}>
        {t('Aplicar')}
      </button>
    </form>
  );
}

export function PainelBarrados() {
  const t = useT();
  const [barrados, setBarrados] = useState<Barrado[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const carregar = useCallback(() => {
    api<{ barrados: Barrado[] }>('/api/admin/barrados').then((r) => setBarrados(r.barrados), (e) => setErro((e as Error).message));
  }, []);
  useEffect(carregar, [carregar]);
  // recurso novo chegando com o painel aberto (Shell.tsx repassa o 'recurso:novo')
  useEffect(() => {
    window.addEventListener('syden:recursos', carregar);
    return () => window.removeEventListener('syden:recursos', carregar);
  }, [carregar]);

  async function desfazer(b: Barrado) {
    await api(b.banidoEm ? '/api/admin/desbanir' : '/api/admin/levantar-suspensao', { method: 'POST', body: { userId: b.userId } }).catch((e) =>
      setErro((e as Error).message),
    );
    carregar();
  }

  return (
    <section className="usage-card">
      <h3>
        <ShieldAlert size={16} aria-hidden="true" /> {t('Contas barradas')}
      </h3>
      <BarrarConta aoFeito={carregar} />
      {erro && <p className="form-error">{erro}</p>}
      <ul className="denuncias-lista">
        {barrados?.map((b) => (
          <li key={b.userId} className="denuncia-item">
            <div className="denuncia-topo">
              <strong>
                {b.username} · {b.banidoEm ? t('banida') : t('suspensa por idade')}
              </strong>
              <small>{quando((b.banidoEm ?? b.suspensaEm)!)}</small>
            </div>
            <p className="denuncia-motivo">{b.banidoMotivo ?? b.suspensaMotivo}</p>
            {b.recurso && (
              <blockquote className="denuncia-copia">
                {t('Recurso em {quando}:', { quando: quando(b.recursoEm!) })} {b.recurso}
              </blockquote>
            )}
            <button type="button" className="btn-secondary" onClick={() => void desfazer(b)}>
              {b.banidoEm ? t('Desfazer o banimento') : t('Levantar a suspensão')}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
