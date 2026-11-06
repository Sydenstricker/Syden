import { useEffect, useState } from 'react';
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
 * porque hoje ele só muda o Cidades, que ele pediu em 3D; quando o quarto 3D chegar, a decisão do padrão é dele de novo. O quarto 3D
 * chegou em 06/11/2026 (QuartoComEstilo.tsx), e o padrão DELE é o pixel art até essa decisão (`estiloDoQuarto`, abaixo).
 */
export type EstiloVisual = '2d' | '3d';
const GRAFICOS_PADRAO = { particulas: false, sombras: false, telas: false, estilo: '3d' as EstiloVisual };
/**
 * `estiloEscolhido`: a pessoa escolheu o estilo (aqui ou no botão do quarto). Até 06/11/2026 a seção gravava o objeto inteiro a
 * cada mudança, com o '3d' de fábrica junto: um '3d' guardado sem a marca pode não ter sido escolha. Um '2d' guardado sempre foi.
 */
type Graficos = typeof GRAFICOS_PADRAO & { estiloEscolhido?: boolean };
export function estiloVisual(): EstiloVisual {
  return lerGraficos().estilo === '2d' ? '2d' : '3d';
}
/**
 * O ESTILO DO QUARTO (06/11/2026, o quarto 3D no app, pedido dele: "um ícone no quarto que alterne entre 3D e Pixel Art"). É a
 * MESMA escolha de cima (o botão do quarto e esta seção mexem no mesmo valor), mas o padrão do quarto é o PIXEL ART: o quarto
 * 3D é piloto, e quando ele fosse ao app o padrão era decisão dele de novo. Só quem escolheu o 3D (`estiloEscolhido`) o vê.
 */
export function estiloDoQuarto(): EstiloVisual {
  const g = lerGraficos();
  return g.estilo === '3d' && g.estiloEscolhido ? '3d' : '2d';
}
/** Escolher o estilo de qualquer lugar (o botão do quarto): grava e avisa quem mostra (o quarto, esta seção, a cena 3D). */
export function escolherEstiloVisual(estilo: EstiloVisual) {
  gravarGraficos({ ...lerGraficos(), estilo, estiloEscolhido: true });
}
/** O estilo do quarto, e muda quando a escolha muda (aqui, no botão do quarto ou noutra aba). */
export function useEstiloDoQuarto(): EstiloVisual {
  const [estilo, setEstilo] = useState(estiloDoQuarto);
  useEffect(() => ouvirGraficos(() => setEstilo(estiloDoQuarto())), []);
  return estilo;
}
/** Sem o armazenamento do navegador (janela privada), a escolha vale nesta visita, guardada aqui. */
let naMemoria: Graficos | null = null;
function lerGraficos(): Graficos {
  if (naMemoria) return { ...naMemoria };
  try {
    return { ...GRAFICOS_PADRAO, ...JSON.parse(localStorage.getItem('syden:graficos') ?? '{}') };
  } catch {
    return { ...GRAFICOS_PADRAO };
  }
}
function gravarGraficos(novo: Graficos) {
  try {
    localStorage.setItem('syden:graficos', JSON.stringify(novo));
    naMemoria = null;
  } catch {
    naMemoria = novo;
  }
  // as páginas do quarto e do salão (iframes) percebem pelo evento 'storage'; quem mora nesta página, por este
  window.dispatchEvent(new Event('syden:graficos'));
}
function ouvirGraficos(f: () => void) {
  const daOutraAba = () => {
    naMemoria = null;
    f();
  };
  window.addEventListener('syden:graficos', f);
  window.addEventListener('storage', daOutraAba);
  return () => {
    window.removeEventListener('syden:graficos', f);
    window.removeEventListener('storage', daOutraAba);
  };
}
export function GraficosSection() {
  const t = useT();
  const [g, setG] = useState(lerGraficos);
  // o botão do quarto também muda o estilo: a seção acompanha
  useEffect(() => ouvirGraficos(() => setG(lerGraficos())), []);
  const mudar = <K extends keyof typeof GRAFICOS_PADRAO>(k: K, valor: Graficos[K]) => {
    const novo = { ...g, [k]: valor, ...(k === 'estilo' ? { estiloEscolhido: true } : {}) };
    setG(novo);
    gravarGraficos(novo);
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
