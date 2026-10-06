import { useEffect, useState } from 'react';
import { api } from './api';
import { nomeDeCanal } from './bidi';
import { useT } from './i18n';
import type { Channel, Community } from './types';

// OS DESTAQUES, nas configurações da comunidade (só para quem administra): o canal e quantas ⭐ bastam.
// Quem destaca é todo mundo, pela reação de sempre. Ver server/src/destaques-routes.ts.

export function DestaquesSection({ community }: { community: Community }) {
  const t = useT();
  const [canais, setCanais] = useState<Channel[]>([]);
  const [canalId, setCanalId] = useState<number | ''>('');
  const [minimo, setMinimo] = useState(3);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  useEffect(() => {
    api<Channel[]>(`/api/communities/${community.id}/channels`).then((lista) => setCanais(lista.filter((c) => c.type === 'text')), () => null);
    api<{ canalId: number | null; minimo: number }>(`/api/communities/${community.id}/destaques`).then((r) => {
      setCanalId(r.canalId ?? '');
      setMinimo(r.minimo);
    }, () => null);
  }, [community.id]);

  async function salvar() {
    setAviso(null);
    try {
      await api(`/api/communities/${community.id}/destaques`, { method: 'PUT', body: { canalId: canalId === '' ? null : canalId, minimo } });
      setAviso({ ok: true, texto: t('Salvo.') });
    } catch (e) {
      setAviso({ ok: false, texto: (e as Error).message });
    }
  }

  return (
    <>
      <h2>{t('Destaques')}</h2>
      <p className="settings-lead">
        {t('Quando uma mensagem junta estrelas ⭐ suficientes, o Syden a publica no canal de destaques. A estrela de quem escreveu não conta, e apagar a mensagem apaga o destaque.')}
      </p>
      <div className="settings-card comandos-form">
        <div className="agendada-linha">
          <select className="moderacao-tempo" value={canalId} aria-label={t('Canal de destaques')} onChange={(e) => setCanalId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">{t('Desligado')}</option>
            {canais.map((c) => (
              <option key={c.id} value={c.id}>
                {nomeDeCanal(c.name, true)}
              </option>
            ))}
          </select>
          <label className="settings-hint">
            {t('Estrelas necessárias')}{' '}
            <input
              type="number"
              className="moderacao-tempo"
              min={1}
              max={50}
              value={minimo}
              onChange={(e) => setMinimo(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
            />
          </label>
        </div>
        <button type="button" className="btn-primary" onClick={() => void salvar()}>
          {t('Salvar')}
        </button>
        {aviso && <p className={aviso.ok ? 'settings-hint' : 'form-error'}>{aviso.texto}</p>}
      </div>
    </>
  );
}
