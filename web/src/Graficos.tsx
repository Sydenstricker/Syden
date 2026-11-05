import { useState } from 'react';
import { Gauge } from 'lucide-react';
import { useT } from './i18n';

/**
 * OS GRÁFICOS DO QUARTO E DO SALÃO (pedido dele, 15/10/2026: "as partículas e a sombra deveriam estar num menu para
 * ligar e desligar; aqui está pesando, imagine em PC mais modesto"). Moram no navegador, em 'syden:graficos', e as
 * páginas do quarto e do salão (o mesmo site, num iframe) leem dali e percebem a troca na hora. TODAS DESLIGADAS DE
 * FÁBRICA, e sem "ajustar sozinho" (decisões dele, mesmo dia: o uso principal é com um jogo aberto). Fica no ar desde já,
 * também por decisão dele. Desde 17/10/2026 é uma seção própria das Configurações, e não um pedaço da Aparência (pedido
 * dele: "Gráfico merece parte dedicada").
 */
/**
 * O ESTILO VISUAL (05/11/2026, pedido dele: "quero ter material 2D pixel art e 3D low poly; que o usuário possa escolher o que
 * ele mais gosta"). 2D é o de sempre (o quarto e o salão em pixel art, o tabuleiro desenhado); 3D usa o que existe em low poly
 * (hoje, o tabuleiro do Cidades à venda). O que ainda não tem a versão 3D continua em 2D para quem escolheu 3D. De fábrica é o 3D,
 * porque hoje ele só muda o Cidades, que ele pediu em 3D; quando o quarto 3D chegar, a decisão do padrão é dele de novo.
 */
export type EstiloVisual = '2d' | '3d';
const GRAFICOS_PADRAO = { particulas: false, sombras: false, telas: false, estilo: '3d' as EstiloVisual };
type Graficos = typeof GRAFICOS_PADRAO;
export function estiloVisual(): EstiloVisual {
  return lerGraficos().estilo === '2d' ? '2d' : '3d';
}
function lerGraficos(): Graficos {
  try {
    return { ...GRAFICOS_PADRAO, ...JSON.parse(localStorage.getItem('syden:graficos') ?? '{}') };
  } catch {
    return { ...GRAFICOS_PADRAO };
  }
}
export function GraficosSection() {
  const t = useT();
  const [g, setG] = useState(lerGraficos);
  const mudar = <K extends keyof Graficos>(k: K, valor: Graficos[K]) => {
    const novo = { ...g, [k]: valor };
    setG(novo);
    try {
      localStorage.setItem('syden:graficos', JSON.stringify(novo));
    } catch {
      /* só nesta visita */
    }
  };
  const opcoes: { k: 'particulas' | 'sombras' | 'telas'; nome: string }[] = [
    { k: 'particulas', nome: t('Partículas') },
    { k: 'sombras', nome: t('Sombras') },
    { k: 'telas', nome: t('Telas animadas') },
  ];
  return (
    <section className="graficos-dos-ambientes">
      <h2>
        <Gauge size={20} aria-hidden="true" /> {t('Gráficos')}
      </h2>
      <div className="toggle-row">
        <span className="toggle-label">{t('Estilo visual')}</span>
        <span className="estilo-visual" role="radiogroup" aria-label={t('Estilo visual')}>
          {(['2d', '3d'] as const).map((e) => (
            <button key={e} type="button" role="radio" aria-checked={g.estilo === e} className={g.estilo === e ? 'escolhido' : ''} onClick={() => mudar('estilo', e)}>
              {e.toUpperCase()}
            </button>
          ))}
        </span>
      </div>
      {opcoes.map(({ k, nome }) => (
        <label key={k} className="toggle-row">
          <span>
            <span className="toggle-label">{nome}</span>
          </span>
          <input type="checkbox" role="switch" checked={g[k]} onChange={(e) => mudar(k, e.target.checked)} />
          <span className="switch" aria-hidden="true" />
        </label>
      ))}
    </section>
  );
}
