import { BookOpen, Drama, Landmark, Music, Utensils, Footprints, MapPin } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { API_URL, api } from './api';
import { chave, idiomaAtual, paisDaPessoa, useT } from './i18n';
import { nomeDoPais } from './i18n/paises';

// A FAIXA DE CULTURA DA HOME: fotos do país da pessoa e livros para ler de graça na língua dela — e,
// desde 05/10/2026, comida, dança, música e teatro (ver SecaoDaCultura em server/src/cultura.ts).
//
// O que aparece aqui não é escolhido pelo Syden: as fotos são as "imagens de qualidade" que a
// comunidade do Wikimedia Commons aprovou, e os livros são os mais lidos do Projeto Gutenberg — o
// servidor só sorteia seis de cada por dia e tira o que não combina com a home (ver server/src/cultura.ts).
// E o navegador não fala com nenhum dos dois: imagem, capa e música chegam de api.syden.chat.

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

interface FaixaDaCultura {
  id: string;
  titulo: string;
  autor: string;
  licenca: string;
  pagina: string;
}

interface Cultura {
  pais: string;
  lingua: string;
  imagens: ImagemDaCultura[];
  livros: LivroDaCultura[];
}

interface ConteudoDaSecao {
  imagens: ImagemDaCultura[];
  livros: LivroDaCultura[];
  faixas: FaixaDaCultura[];
}

type Secao = 'comida' | 'danca' | 'musica' | 'teatro';
type Aba = 'lugares' | Secao;

/** As abas, na ordem da tela. "Lugares" são as fotos de qualidade, que vêm junto com os livros. */
const ABAS: { aba: Aba; rotulo: string; icone: ReactNode }[] = [
  { aba: 'lugares', rotulo: chave('Lugares'), icone: <MapPin size={15} aria-hidden="true" /> },
  { aba: 'comida', rotulo: chave('Comida'), icone: <Utensils size={15} aria-hidden="true" /> },
  { aba: 'danca', rotulo: chave('Dança'), icone: <Footprints size={15} aria-hidden="true" /> },
  { aba: 'musica', rotulo: chave('Música'), icone: <Music size={15} aria-hidden="true" /> },
  { aba: 'teatro', rotulo: chave('Teatro'), icone: <Drama size={15} aria-hidden="true" /> },
];
const SECOES: Secao[] = ['comida', 'danca', 'musica', 'teatro'];

/**
 * Menos de três não é seção, é sobra — a mesma regra dos livros (em árabe, o Gutenberg só tinha uma
 * homenagem ao fundador). Na música, basta uma das duas partes ter três: as gravações ou os instrumentos.
 */
const temConteudo = (c: ConteudoDaSecao | undefined) =>
  !!c && (c.imagens.length >= 3 || c.faixas.length >= 3 || c.livros.length >= 3);

const arquivo = (id: string) => `${API_URL}/api/cultura/arquivo/${encodeURIComponent(id)}`;
const audio = (id: string) => `${API_URL}/api/cultura/audio/${encodeURIComponent(id)}`;

function GradeDeImagens({ imagens }: { imagens: ImagemDaCultura[] }) {
  const t = useT();
  return (
    <div className="cultura-imagens">
      {imagens.map((imagem) => (
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
  );
}

function EstanteDeLivros({ livros }: { livros: LivroDaCultura[] }) {
  const t = useT();
  return (
    <ul className="cultura-livros">
      {livros.map((livro) => (
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
  );
}

/**
 * As gravações. `preload="none"`: nada é baixado até a pessoa apertar o play — seis músicas de 10 MB
 * descendo sozinhas a cada visita à home seriam internet gasta à toa, e tráfego do servidor também.
 */
function Gravacoes({ faixas }: { faixas: FaixaDaCultura[] }) {
  const t = useT();
  return (
    <ul className="cultura-faixas">
      {faixas.map((faixa) => (
        <li key={faixa.id}>
          <a href={faixa.pagina} target="_blank" rel="noreferrer noopener" title={t('Abrir no Wikimedia Commons')}>
            <bdi className="cultura-faixa-titulo">{faixa.titulo}</bdi>
          </a>
          <span className="cultura-faixa-credito">
            {t('Por {autor}', { autor: faixa.autor })}
            {faixa.licenca && <span className="cultura-licenca"> · {faixa.licenca}</span>}
          </span>
          <audio controls preload="none" src={audio(faixa.id)} />
        </li>
      ))}
    </ul>
  );
}

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
  const [secoes, setSecoes] = useState<Partial<Record<Secao, ConteudoDaSecao>>>({});
  const [aba, setAba] = useState<Aba>('lugares');

  useEffect(() => {
    if (!onde) return;
    let vivo = true;
    setSecoes({});
    setAba('lugares');
    api<Cultura>(`/api/cultura?pais=${onde.pais}&lingua=${onde.lingua}`)
      .then((c) => vivo && setCultura(c.imagens.length + c.livros.length > 0 ? c : null))
      .catch(() => vivo && setCultura(null));
    // CADA SEÇÃO NO SEU TEMPO. O teatro pode levar quase um minuto na primeira visita do dia (o
    // Gutendex é lento para buscar por assunto); a comida chega em um segundo. A aba de cada uma
    // aparece quando ela chega — ao lado das outras, sem empurrar nada da tela para baixo.
    for (const secao of SECOES) {
      api<ConteudoDaSecao>(`/api/cultura/secao/${secao}?pais=${onde.pais}&lingua=${onde.lingua}`)
        .then((c) => vivo && setSecoes((antes) => ({ ...antes, [secao]: c })))
        .catch(() => null);
    }
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onde?.pais, onde?.lingua]);

  if (!onde || cultura === null) return null;
  const pais = nomeDoPais(onde.pais, idiomaAtual());
  const abas = ABAS.filter(({ aba: a }) => a === 'lugares' || temConteudo(secoes[a as Secao]));
  const atual = aba === 'lugares' ? undefined : secoes[aba];

  return (
    <section className="cultura" aria-label={titulo ?? t('Cultura')} aria-busy={cultura === undefined}>
      <h2>
        <Landmark size={20} aria-hidden="true" />
        {titulo ?? t('Cultura')}
      </h2>
      <p className="cultura-lead">
        {t('{pais}: fotos escolhidas pela comunidade do Wikimedia Commons e livros para ler de graça. Muda todo dia.', { pais })}
      </p>

      {/* Só com mais de uma aba: uma aba sozinha é um botão que não faz nada. */}
      {abas.length > 1 && (
        <div className="cultura-abas" role="tablist" aria-label={t('Seções da cultura')}>
          {abas.map(({ aba: a, rotulo, icone }) => (
            <button
              key={a}
              type="button"
              role="tab"
              aria-selected={aba === a}
              className={aba === a ? 'escolhida' : ''}
              onClick={() => setAba(a)}
            >
              {icone}
              {t(rotulo)}
            </button>
          ))}
        </div>
      )}

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
          <div role={abas.length > 1 ? 'tabpanel' : undefined}>
            {aba === 'lugares' && cultura.imagens.length > 0 && <GradeDeImagens imagens={cultura.imagens} />}
            {aba === 'musica' && atual && (
              <>
                {atual.faixas.length >= 3 && <Gravacoes faixas={atual.faixas} />}
                {atual.imagens.length >= 3 && <GradeDeImagens imagens={atual.imagens} />}
                <p className="settings-hint">{t('Gravações e instrumentos com licença livre, do Wikimedia Commons.')}</p>
              </>
            )}
            {(aba === 'comida' || aba === 'danca') && atual && <GradeDeImagens imagens={atual.imagens} />}
            {aba === 'teatro' && atual && (
              <>
                <EstanteDeLivros livros={atual.livros} />
                <p className="settings-hint">{t('Peças de teatro em domínio público, de graça no Projeto Gutenberg.')}</p>
              </>
            )}
          </div>

          {/* Menos de três não é estante, é sobra: em árabe, o Gutenberg só tinha uma homenagem ao
              próprio fundador. Aí a seção não aparece. */}
          {cultura.livros.length >= 3 && (
            <>
              <h3>
                <BookOpen size={16} aria-hidden="true" />
                {t('Para ler')}
              </h3>
              <EstanteDeLivros livros={cultura.livros} />
              <p className="settings-hint">{t('Livros em domínio público, de graça no Projeto Gutenberg.')}</p>
            </>
          )}
        </>
      )}
    </section>
  );
}
