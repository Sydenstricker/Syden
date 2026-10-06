import { Check, Copy, Link2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api';
import { enderecoDaAula } from './aula';
import { useT } from './i18n';

interface Aula {
  id: number;
  token: string;
  expiraEm: string;
}

const PRAZOS = [1, 2, 3, 6, 12, 24];

/**
 * O "Link da aula", no alto da sala de voz, para quem administra a comunidade.
 *
 * Gera o endereço que leva direto a esta sala (ver server/src/aula-routes.ts): quem tem conta cai na
 * sala; quem não tem entra só com o nome, numa conta que vale até o link vencer. Por isso o prazo é a
 * primeira escolha, e o link pode ser desligado a qualquer momento — ele é a chave da turma.
 */
export function LinkDaAula({ channelId, communityId }: { channelId: number; communityId: number }) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const [aulas, setAulas] = useState<Aula[]>([]);
  const [horas, setHoras] = useState(3);
  const [copiado, setCopiado] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!aberto) return;
    api<Aula[]>(`/api/channels/${channelId}/aulas`).then(setAulas, (e) => setErro((e as Error).message));
  }, [aberto, channelId]);

  async function criar() {
    setErro(null);
    try {
      const nova = await api<Aula>(`/api/channels/${channelId}/aulas`, { method: 'POST', body: { horas } });
      setAulas((lista) => [nova, ...lista]);
      void copiar(nova);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function copiar(aula: Aula) {
    try {
      await navigator.clipboard.writeText(enderecoDaAula(aula.token));
      setCopiado(aula.id);
      setTimeout(() => setCopiado((atual) => (atual === aula.id ? null : atual)), 2000);
    } catch {
      // Sem permissão de copiar: o endereço continua à vista no campo, para copiar à mão.
    }
  }

  async function desligar(aula: Aula) {
    await api(`/api/communities/${communityId}/aulas/${aula.id}`, { method: 'DELETE' }).catch(() => {});
    setAulas((lista) => lista.filter((a) => a.id !== aula.id));
  }

  const hora = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="link-aula-ancora">
      <button
        type="button"
        className={`header-toggle${aberto ? ' active' : ''}`}
        title={t('Link da aula')}
        aria-label={t('Link da aula')}
        aria-expanded={aberto}
        onClick={() => setAberto(!aberto)}
      >
        <Link2 size={20} />
      </button>
      {aberto && (
        <div className="link-aula" role="dialog" aria-label={t('Link da aula')}>
          <h3>{t('Link da aula')}</h3>
          <p>{t('Quem abrir este link cai direto nesta sala. Quem não tem conta entra só com o nome, até o link vencer.')}</p>
          <div className="link-aula-criar">
            <label>
              {t('Vale por')}
              <select value={horas} onChange={(e) => setHoras(Number(e.target.value))}>
                {PRAZOS.map((h) => (
                  <option key={h} value={h}>
                    {h} h
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn-primary" onClick={() => void criar()}>
              {t('Criar link')}
            </button>
          </div>
          {erro && <p className="form-error">{erro}</p>}
          {aulas.length === 0 ? (
            <p className="link-aula-vazio">{t('Nenhum link valendo.')}</p>
          ) : (
            <ul>
              {aulas.map((aula) => (
                <li key={aula.id}>
                  <input readOnly value={enderecoDaAula(aula.token)} onFocus={(e) => e.target.select()} aria-label={t('Link da aula')} />
                  <small>{t('Vale até {hora}', { hora: hora(aula.expiraEm) })}</small>
                  <button type="button" className="btn-secondary" onClick={() => void copiar(aula)}>
                    {copiado === aula.id ? <Check size={15} /> : <Copy size={15} />} {copiado === aula.id ? t('Copiado') : t('Copiar')}
                  </button>
                  <button type="button" className="link" onClick={() => void desligar(aula)}>
                    {t('Desligar')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
