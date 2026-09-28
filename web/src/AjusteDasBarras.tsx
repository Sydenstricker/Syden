import { useEffect, useState } from 'react';
import { useT } from './i18n';
import { BARRAS, type Barra, type Larguras, PADRAO, aoMudarLarguras, guardarLarguras, lerLarguras } from './larguras';

// O ajuste das barras por número, em Configurações.
//
// POR QUE EXISTE, se dá para arrastar a borda. Porque arrastar exige mirar numa faixa de oito pixels e
// segurar o botão enquanto se move — e quem tem tremor, artrite ou usa só o teclado não consegue. A
// funcionalidade nasceu de um pedido de acessibilidade; entregar só o arrasto seria entregar a parte
// que exclui quem pediu.
//
// Os dois controles fazem coisas diferentes de propósito: os de cima ajustam UMA barra, o de baixo
// ajusta as DUAS juntas. Quem precisa de mais espaço costuma precisar em tudo.

export function AjusteDasBarras() {
  const t = useT();
  const [larguras, setLarguras] = useState<Larguras>(lerLarguras);

  // As larguras também mudam ao arrastar a borda; sem ouvir, os números aqui ficariam velhos.
  //
  // As chaves em volta importam: `aoMudarLarguras` devolve um `delete` do Set, que é um boolean, e o
  // React exige que a limpeza de um efeito não devolva nada. Sem elas, o TypeScript reclama.
  useEffect(() => {
    return aoMudarLarguras(setLarguras);
  }, []);

  function mudar(campo: Barra | 'escala', valor: number) {
    guardarLarguras({ ...larguras, [campo]: valor });
  }

  const noPadrao = larguras.sidebar === PADRAO.sidebar && larguras.membros === PADRAO.membros && larguras.escala === 1;

  return (
    <section className="ajuste-barras">
      <h3>{t('Largura das barras')}</h3>
      <p className="settings-hint">
        {t('Também dá para arrastar a borda de cada barra na tela. Dois cliques na borda volta ao padrão.')}
      </p>

      {(Object.keys(BARRAS) as Barra[]).map((barra) => (
        <label key={barra} className="ajuste-linha">
          <span>{t(BARRAS[barra].nome)}</span>
          <input
            type="range"
            min={BARRAS[barra].minimo}
            max={BARRAS[barra].maximo}
            step={8}
            value={larguras[barra]}
            onChange={(e) => mudar(barra, Number(e.target.value))}
          />
          {/* O número aparece porque "arraste até ficar bom" não serve para quem quer repetir o mesmo
              ajuste em outra máquina. */}
          <output>{larguras[barra]}px</output>
        </label>
      ))}

      <label className="ajuste-linha">
        <span>{t('As duas juntas')}</span>
        <input
          type="range"
          min={0.8}
          max={1.6}
          step={0.05}
          value={larguras.escala}
          onChange={(e) => mudar('escala', Number(e.target.value))}
        />
        <output>{Math.round(larguras.escala * 100)}%</output>
      </label>

      <button type="button" className="btn-secondary" disabled={noPadrao} onClick={() => guardarLarguras(PADRAO)}>
        {t('Voltar ao padrão')}
      </button>
    </section>
  );
}
