import { Play, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useT } from './i18n';
import { ouvirToque } from './sounds';
import {
  apagarGrupo,
  criarGrupo,
  LIMITE_DO_NOME_DO_GRUPO,
  MAXIMO_DE_GRUPOS,
  mudarGrupo,
  NOME_DO_TOQUE,
  pessoasNoGrupo,
  TOQUES,
  type Toque,
  useToques,
} from './toquesDeLigacao';

/**
 * OS GRUPOS DE TOQUE, em Configurações → Notificações (09/11/2026, pedido dele: "grupo de CS, grupo da faculdade"): criar,
 * dar nome, escolher o som (e ouvir), apagar. Quem entra em cada grupo se escolhe no botão direito da pessoa → "Grupo".
 */
export function GruposDeToque() {
  const t = useT();
  const { grupos, pessoas } = useToques();
  const [nome, setNome] = useState('');

  function criar() {
    if (criarGrupo(nome)) setNome('');
  }

  return (
    <div className="grupos-de-toque">
      <h3>{t('Grupos de toque')}</h3>
      <p className="settings-hint">
        {t('Cada grupo tem o seu toque. Ponha alguém num grupo, ou escolha um toque só para essa pessoa, com o botão direito no nome dela.')}
      </p>
      {grupos.map((g) => (
        <div key={g.id} className="grupo-de-toque">
          <input
            defaultValue={g.nome}
            maxLength={LIMITE_DO_NOME_DO_GRUPO}
            aria-label={t('Nome do grupo')}
            onBlur={(e) => e.target.value.trim() && mudarGrupo(g.id, { nome: e.target.value })}
          />
          <span className="grupo-de-toque-pessoas">{t('{n} pessoas', { n: pessoasNoGrupo(g.id, { grupos, pessoas }) })}</span>
          <select aria-label={t('Toque de ligação')} value={g.toque} onChange={(e) => mudarGrupo(g.id, { toque: e.target.value as Toque })}>
            {TOQUES.map((x) => (
              <option key={x} value={x}>
                {t(NOME_DO_TOQUE[x])}
              </option>
            ))}
          </select>
          <button className="icon-plain" title={t('Ouvir')} aria-label={t('Ouvir')} disabled={g.toque === 'silencio'} onClick={() => ouvirToque(g.toque)}>
            <Play size={16} />
          </button>
          <button className="icon-plain" title={t('Apagar grupo')} aria-label={t('Apagar grupo')} onClick={() => apagarGrupo(g.id)}>
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      {grupos.length < MAXIMO_DE_GRUPOS && (
        <form
          className="grupo-de-toque novo"
          onSubmit={(e) => {
            e.preventDefault();
            criar();
          }}
        >
          <input value={nome} maxLength={LIMITE_DO_NOME_DO_GRUPO} placeholder={t('Nome do grupo')} aria-label={t('Nome do grupo')} onChange={(e) => setNome(e.target.value)} />
          <button className="btn-secondary" disabled={!nome.trim()}>
            {t('Novo grupo')}
          </button>
        </form>
      )}
    </div>
  );
}
