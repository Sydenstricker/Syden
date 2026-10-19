import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './api';
import { useT } from './i18n';
import { IDIOMAS } from './i18n/idiomas';

// OS IDIOMAS DA PESSOA (ver server/src/idiomas-routes.ts): "idiomas falados" e "idiomas em estudo", informados em Minha
// conta e mostrados no cartão de perfil. É o teste barato de "Aprender idiomas dentro do Syden" (CLAUDE.md): quem fala
// um acha quem estuda o outro, sem o Syden construir mais nada.
//
// O nome de cada idioma vai NA PRÓPRIA LÍNGUA ("日本語", "English"): é como a pessoa reconhece o dela, e não depende
// de o navegador ter os nomes em todas as línguas do Syden (tétum, samoano…), que é onde o Intl falha.

export interface Idiomas {
  falados: string[];
  estudo: string[];
}

const POR_LISTA = 6;
const NOMES = new Map(IDIOMAS.map((i) => [i.codigo, i.nativo]));
const conhecidos = (codigos: string[]) => codigos.filter((c) => NOMES.has(c));
const nomes = (codigos: string[]) => conhecidos(codigos).map((c) => NOMES.get(c)!).join(', ');

/** As duas linhas do cartão de perfil. Sem nada informado, nada aparece. */
export function IdiomasNoCartao({ userId }: { userId: number }) {
  const t = useT();
  const [idiomas, setIdiomas] = useState<Idiomas | null>(null);

  useEffect(() => {
    let vivo = true;
    setIdiomas(null);
    // servidor antigo (sem a rota) ou erro: o cartão segue sem as linhas
    api<Idiomas>(`/api/users/${userId}/idiomas`).then((r) => vivo && setIdiomas(r), () => null);
    return () => {
      vivo = false;
    };
  }, [userId]);

  if (!idiomas) return null;
  const falados = nomes(idiomas.falados), estudo = nomes(idiomas.estudo);
  if (!falados && !estudo) return null;
  return (
    <dl className="perfil-idiomas">
      {falados && (
        <>
          <dt>{t('Idiomas falados')}</dt>
          <dd>{falados}</dd>
        </>
      )}
      {estudo && (
        <>
          <dt>{t('Idiomas em estudo')}</dt>
          <dd>{estudo}</dd>
        </>
      )}
    </dl>
  );
}

/** Configurações → Minha conta. Cada mudança já vale (sem "Salvar"), como o resto da conta que é lista. */
export function MeusIdiomas() {
  const t = useT();
  const [idiomas, setIdiomas] = useState<Idiomas | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api<Idiomas>('/api/me/idiomas').then(setIdiomas, () => setIdiomas({ falados: [], estudo: [] }));
  }, []);

  if (!idiomas) return null;

  async function guardar(novo: Idiomas) {
    const antes = idiomas;
    setIdiomas(novo);
    setErro(null);
    try {
      await api('/api/me/idiomas', { method: 'PUT', body: novo });
    } catch (e) {
      setIdiomas(antes);
      setErro((e as Error).message);
    }
  }

  const lista = (qual: keyof Idiomas, rotulo: string) => {
    const escolhidos = conhecidos(idiomas[qual]);
    const usados = new Set([...idiomas.falados, ...idiomas.estudo]);
    return (
      <div className="meus-idiomas-lista">
        <span className="meus-idiomas-rotulo">{rotulo}</span>
        <div className="meus-idiomas-fichas">
          {escolhidos.map((c) => (
            <span key={c} className="meus-idiomas-ficha">
              {NOMES.get(c)}
              <button
                type="button"
                aria-label={`${t('Tirar')}: ${NOMES.get(c)}`}
                onClick={() => void guardar({ ...idiomas, [qual]: idiomas[qual].filter((x) => x !== c) })}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </span>
          ))}
          {escolhidos.length < POR_LISTA && (
            <select
              className="moderacao-tempo"
              value=""
              aria-label={`${rotulo}: ${t('Adicionar')}`}
              onChange={(e) => e.target.value && void guardar({ ...idiomas, [qual]: [...idiomas[qual], e.target.value] })}
            >
              <option value="">+ {t('Adicionar')}</option>
              {IDIOMAS.filter((i) => !usados.has(i.codigo))
                .slice()
                .sort((a, b) => a.nativo.localeCompare(b.nativo))
                .map((i) => (
                  <option key={i.codigo} value={i.codigo}>
                    {i.nativo}
                  </option>
                ))}
            </select>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <h3>{t('Idiomas')}</h3>
      <div className="settings-card">
        <p className="settings-hint">{t('Aparece no seu cartão de perfil, para quem fala um idioma achar quem o estuda. É opcional.')}</p>
        {lista('falados', t('Idiomas falados'))}
        {lista('estudo', t('Idiomas em estudo'))}
        {erro && <p className="form-error">{erro}</p>}
      </div>
    </>
  );
}
