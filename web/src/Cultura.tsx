import { BookOpen, Landmark } from 'lucide-react';
import { useEffect, useState } from 'react';
import { API_URL, api } from './api';
import { idiomaAtual, paisDaPessoa, useT } from './i18n';
import { nomeDoPais } from './i18n/paises';

// A FAIXA DE CULTURA DA HOME: fotos do país da pessoa e livros para ler de graça na língua dela.
//
// O que aparece aqui não é escolhido pelo Syden: as fotos são as "imagens de qualidade" que a
// comunidade do Wikimedia Commons aprovou, e os livros são os mais lidos do Projeto Gutenberg — o
// servidor só sorteia seis de cada por dia e tira o que não combina com a home (ver server/src/cultura.ts).
// E o navegador não fala com nenhum dos dois: imagem e capa chegam de api.syden.chat.

interface ImagemDaCultura {
  id: string;
  titulo: string;
  autor: string;
  licenca: string;
  pagina: string;
}

interface LivroDaCultura {
  id: string;
  titulo: string;
  autor: string;
  pagina: string;
  temCapa: boolean;
}

interface Cultura {
  pais: string;
  lingua: string;
  imagens: ImagemDaCultura[];
  livros: LivroDaCultura[];
}

const arquivo = (id: string) => `${API_URL}/api/cultura/arquivo/${encodeURIComponent(id)}`;

/**
 * `onde` fixa o país e a língua — a CULTURA DA TURMA, escolhida por quem administra a comunidade (ver
 * CulturaDaTurma.tsx). Sem ele, vale a preferência de idioma da própria pessoa, como sempre foi.
 * `titulo` troca o "Cultura" do alto, para as duas faixas não se confundirem na mesma tela.
 */
export function FaixaDaCultura({ onde: ondeFixo, titulo }: { onde?: { pais: string; lingua: string }; titulo?: string } = {}) {
  const t = useT();
  const [ondeDaPessoa] = useState(paisDaPessoa);
  const onde = ondeFixo ?? ondeDaPessoa;
  // undefined = ainda vindo; null = não veio nada (a faixa some).
  const [cultura, setCultura] = useState<Cultura | null | undefined>(onde ? undefined : null);

  useEffect(() => {
    if (!onde) return;
    let vivo = true;
    api<Cultura>(`/api/cultura?pais=${onde.pais}&lingua=${onde.lingua}`)
      .then((c) => vivo && setCultura(c.imagens.length + c.livros.length > 0 ? c : null))
      .catch(() => vivo && setCultura(null));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onde?.pais, onde?.lingua]);

  if (!onde || cultura === null) return null;
  const pais = nomeDoPais(onde.pais, idiomaAtual());

  return (
    <section className="cultura" aria-label={titulo ?? t('Cultura')} aria-busy={cultura === undefined}>
      <h2>
        <Landmark size={20} aria-hidden="true" />
        {titulo ?? t('Cultura')}
      </h2>
      <p className="cultura-lead">
        {t('{pais}: fotos escolhidas pela comunidade do Wikimedia Commons e livros para ler de graça. Muda todo dia.', { pais })}
      </p>

      {/* ENQUANTO VEM, GUARDA O LUGAR SEM DIZER NADA: seis quadros vazios. A faixa entrando atrasada
          empurraria a caixa de ideias para baixo, e o olho lê isso como travamento. */}
      {cultura === undefined ? (
        <div className="cultura-imagens" aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="cultura-imagem esperando" />
          ))}
        </div>
      ) : (
        <>
          {cultura.imagens.length > 0 && (
            <div className="cultura-imagens">
              {cultura.imagens.map((imagem) => (
                <figure key={imagem.id} className="cultura-imagem">
                  <a href={imagem.pagina} target="_blank" rel="noreferrer noopener" title={t('Abrir no Wikimedia Commons')}>
                    <img src={arquivo(imagem.id)} alt={imagem.titulo} loading="lazy" />
                  </a>
                  {/* O crédito é exigência da licença, não enfeite: autor e licença, com a página. */}
                  <figcaption>
                    {t('Por {autor}', { autor: imagem.autor })}
                    {imagem.licenca && <span className="cultura-licenca"> · {imagem.licenca}</span>}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}

          {/* Menos de três não é estante, é sobra: em árabe, o Gutenberg só tinha uma homenagem ao
              próprio fundador. Aí a seção não aparece. */}
          {cultura.livros.length >= 3 && (
            <>
              <h3>
                <BookOpen size={16} aria-hidden="true" />
                {t('Para ler')}
              </h3>
              <ul className="cultura-livros">
                {cultura.livros.map((livro) => (
                  <li key={livro.id}>
                    <a href={livro.pagina} target="_blank" rel="noreferrer noopener" title={t('Ler no Projeto Gutenberg')}>
                      <span className="cultura-capa">
                        {livro.temCapa ? <img src={arquivo(livro.id)} alt="" loading="lazy" /> : <BookOpen size={22} aria-hidden="true" />}
                      </span>
                      <bdi className="cultura-livro-titulo">{livro.titulo}</bdi>
                      <bdi className="cultura-livro-autor">{livro.autor}</bdi>
                    </a>
                  </li>
                ))}
              </ul>
              <p className="settings-hint">{t('Livros em domínio público, de graça no Projeto Gutenberg.')}</p>
            </>
          )}
        </>
      )}
    </section>
  );
}
