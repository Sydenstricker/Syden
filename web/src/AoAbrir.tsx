import { useState } from 'react';
import { useT } from './i18n';
import { getSettings, updateSettings } from './settings';

/** Configurações → Minha conta: onde o Syden abre (ver firstView, em Shell.tsx). Vale da próxima vez que abrir. */
export function AoAbrir() {
  const t = useT();
  const [valor, setValor] = useState(getSettings().aoAbrir);
  return (
    <>
      <h3>{t('Ao abrir o Syden')}</h3>
      <div className="settings-card">
        <select
          className="moderacao-tempo"
          value={valor}
          aria-label={t('Ao abrir o Syden')}
          onChange={(e) => {
            const novo = e.target.value as typeof valor;
            setValor(novo);
            updateSettings({ aoAbrir: novo });
          }}
        >
          <option value="quarto">{t('No quarto')}</option>
          <option value="ondeParei">{t('Onde parei')}</option>
        </select>
      </div>
    </>
  );
}
