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
const GRAFICOS_PADRAO = { particulas: false, sombras: false, telas: false };
type Graficos = typeof GRAFICOS_PADRAO;
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
  const mudar = (k: keyof Graficos, valor: boolean) => {
    const novo = { ...g, [k]: valor };
    setG(novo);
    try {
      localStorage.setItem('syden:graficos', JSON.stringify(novo));
    } catch {
      /* só nesta visita */
    }
  };
  const opcoes: { k: keyof Graficos; nome: string }[] = [
    { k: 'particulas', nome: t('Partículas') },
    { k: 'sombras', nome: t('Sombras') },
    { k: 'telas', nome: t('Telas animadas') },
  ];
  return (
    <section className="graficos-dos-ambientes">
      <h2>
        <Gauge size={20} aria-hidden="true" /> {t('Gráficos')}
      </h2>
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
