import { useState } from 'react';
import { api } from './api';
import { IDIOMAS, idiomaAtual, useT } from './i18n';
import { nomeDoPais, paisesDoIdioma } from './i18n/paises';
import type { Community } from './types';

/**
 * "Cultura da turma", nas configurações da comunidade (só para quem administra).
 *
 * A faixa de cultura da tela inicial mostra o país do idioma do SISTEMA de cada um — para uma turma
 * de japonês, isso daria a cada aluno a cultura dele mesmo. Aqui quem dá a aula escolhe o que a turma
 * estuda (a língua, e um país onde ela é oficial), e todo mundo da comunidade passa a ver livros e
 * fotos de lá: na tela inicial e, no modo sala, ao lado da conversa (ver server/src/aula-routes.ts).
 *
 * A língua sai da lista dos idiomas do Syden, que já sabe em que países cada um é oficial; a busca
 * de livros usa o código curto ("pt", "zh").
 */
export function CulturaDaTurma({ community }: { community: Community }) {
  const t = useT();
  const idiomaDaTela = idiomaAtual();
  const inicial = IDIOMAS.find((i) => i.codigo.split('-')[0].toLowerCase() === community.culturaLingua)?.codigo ?? '';
  const [idioma, setIdioma] = useState(inicial);
  const [pais, setPais] = useState(community.culturaPais ?? '');
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);

  const paises = idioma ? paisesDoIdioma(idioma) : [];

  function escolherIdioma(codigo: string) {
    setIdioma(codigo);
    const lista = codigo ? paisesDoIdioma(codigo) : [];
    setPais(lista.includes(pais) ? pais : (lista[0] ?? ''));
  }

  async function salvar() {
    setAviso(null);
    try {
      await api(`/api/communities/${community.id}/cultura`, {
        method: 'PATCH',
        body: idioma && pais ? { pais, lingua: idioma.split('-')[0].toLowerCase() } : { pais: null, lingua: null },
      });
      setAviso({ ok: true, texto: t('Salvo.') });
    } catch (e) {
      setAviso({ ok: false, texto: (e as Error).message });
    }
  }

  return (
    <div className="settings-card cultura-da-turma">
      <p className="settings-hint">
        {t('A faixa de cultura desta comunidade mostra livros e fotos da língua e do país que a turma estuda.')}
      </p>
      <div className="cultura-da-turma-campos">
        <label>
          {t('Língua')}
          <select value={idioma} onChange={(e) => escolherIdioma(e.target.value)}>
            <option value="">{t('Nenhuma')}</option>
            {IDIOMAS.map((i) => (
              <option key={i.codigo} value={i.codigo}>
                {i.nativo}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('País')}
          <select value={pais} onChange={(e) => setPais(e.target.value)} disabled={!idioma}>
            {paises.map((p) => (
              <option key={p} value={p}>
                {nomeDoPais(p, idiomaDaTela)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-primary" onClick={() => void salvar()}>
          {t('Salvar')}
        </button>
      </div>
      {aviso && <p className={aviso.ok ? 'settings-hint' : 'form-error'}>{aviso.texto}</p>}
    </div>
  );
}
