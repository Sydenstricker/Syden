import { Check, Languages } from 'lucide-react';
import { useState } from 'react';
import { IDIOMAS, PADRAO, TRADUCOES, idiomaAtual, paisesCobertos, trocarIdioma, useT } from './i18n';
import { GradeDePaises } from './GradeDePaises';

// Configurações → Idioma. A escolha é DENTRO do app, e não no instalador: quem baixou o Syden de alguém
// não precisa reinstalar nada para ler na língua dele, e a troca vale na hora, sem reiniciar.

/**
 * O nome de uma língua NA LÍNGUA DE QUEM LÊ — ou nada.
 *
 * O segundo nome de cada botão ("Inglês", "Alemão") vinha da lista do Syden, que está em português:
 * numa tela em alemão aparecia "Inglês". Quem sabe o nome de cada língua em cada língua é o
 * navegador (Intl.DisplayNames).
 *
 * E QUANDO O NAVEGADOR NÃO CONHECE A LÍNGUA DA TELA — o Chrome não tem dados de 29 das 77, entre elas
 * o oromo, o hauçá e o iorubá (ver algarismos.ts) — ele não falha: responde no idioma do computador.
 * Aí não se mostra segundo nome nenhum. O nome nativo, que vem logo acima, é sempre certo; um nome em
 * português numa tela em oromo é só ruído. Também some quando repete o nativo (Deutsch / Deutsch).
 */
function nomeNaMinhaLingua(codigo: string, nativo: string, nomeEmPortugues: string, atual: string): string | null {
  if (atual === PADRAO) return nomeEmPortugues === nativo ? null : nomeEmPortugues;
  try {
    if (Intl.DisplayNames.supportedLocalesOf(atual).length === 0) return null;
    const nome = new Intl.DisplayNames([atual], { type: 'language' }).of(codigo);
    if (!nome || nome === codigo || nome.toLocaleLowerCase(atual) === nativo.toLocaleLowerCase(atual)) return null;
    // Muitas línguas escrevem o nome de língua em minúscula ("inglés"); num rótulo, ele abre a linha.
    return nome.charAt(0).toLocaleUpperCase(atual) + nome.slice(1);
  } catch {
    return null;
  }
}

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
            {(() => {
              const nome = nomeNaMinhaLingua(idioma.codigo, idioma.nativo, idioma.nome, atual);
              // O lang do nome é o da TELA, não o da língua do botão: é a tela que o escreve.
              return nome && <span className="idioma-nome" lang={atual}>{nome}</span>;
            })()}
            {atual === idioma.codigo && <Check size={16} className="idioma-marca" aria-hidden="true" />}
          </button>
        ))}
      </div>

      {/* A grade é do idioma ESCOLHIDO, e não de um que se passe o mouse: ela responde "onde falam o
          que eu estou lendo agora", que é a pergunta que a pessoa tem ao abrir esta tela. Trocar de
          idioma troca a grade na hora, junto com o resto. */}
      <GradeDePaises idioma={atual} />

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
          <span
            key={idioma.codigo}
            className="idioma-futuro"
            lang={idioma.codigo}
            title={nomeNaMinhaLingua(idioma.codigo, idioma.nativo, idioma.nome, atual) ?? undefined}
          >
            {idioma.nativo}
          </span>
        ))}
      </div>
    </>
  );
}
