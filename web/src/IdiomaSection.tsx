import { Check, Languages } from 'lucide-react';
import { useState } from 'react';
import { IDIOMAS, PADRAO, TRADUCOES, idiomaAtual, paisesCobertos, trocarIdioma, useT } from './i18n';

// Configurações → Idioma. A escolha é DENTRO do app, e não no instalador: quem baixou o Syden de alguém
// não precisa reinstalar nada para ler na língua dele, e a troca vale na hora, sem reiniciar.

export function IdiomaSection() {
  const t = useT();
  const [trocando, setTrocando] = useState<string | null>(null);
  const atual = idiomaAtual();
  const prontos = IDIOMAS.filter((i) => i.codigo === PADRAO || TRADUCOES[i.codigo]);
  const aCaminho = IDIOMAS.filter((i) => i.codigo !== PADRAO && !TRADUCOES[i.codigo]);

  async function escolher(codigo: string) {
    setTrocando(codigo);
    await trocarIdioma(codigo);
    setTrocando(null);
  }

  return (
    <>
      <h2>{t('Idioma')}</h2>
      <p className="settings-hint">
        {t('Escolha aqui a língua do Syden. Vale na hora, só para você, e fica guardada neste computador.')}
      </p>

      <div className="idiomas">
        {prontos.map((idioma) => (
          <button
            key={idioma.codigo}
            className={`idioma${atual === idioma.codigo ? ' selecionado' : ''}`}
            onClick={() => void escolher(idioma.codigo)}
            disabled={trocando !== null}
            lang={idioma.codigo}
          >
            <span className="idioma-nativo">{idioma.nativo}</span>
            <span className="idioma-nome">{idioma.nome}</span>
            {atual === idioma.codigo && <Check size={16} className="idioma-marca" aria-hidden="true" />}
          </button>
        ))}
      </div>

      <h3>{t('Os outros idiomas')}</h3>
      <p className="settings-hint">
        {t(
          'O Syden já sabe escrever em qualquer uma destas línguas — falta a tradução dos textos. Enquanto ela não chega, o que não estiver traduzido aparece em português, e as letras de cada alfabeto aparecem certas, sem quadradinhos.',
        )}
      </p>
      <p className="settings-hint">
        <Languages size={14} aria-hidden="true" />{' '}
        {t('Hoje dá para atender {paises} países da ONU; a lista abaixo cobre praticamente todos os outros.', {
          paises: paisesCobertos(),
        })}
      </p>
      <div className="idiomas-futuros">
        {aCaminho.map((idioma) => (
          <span key={idioma.codigo} className="idioma-futuro" lang={idioma.codigo} title={idioma.nome}>
            {idioma.nativo}
          </span>
        ))}
      </div>
    </>
  );
}
