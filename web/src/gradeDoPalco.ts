import { type CSSProperties, useLayoutEffect, useState } from 'react';

/**
 * A GRADE QUE ENCHE O PALCO (12/11/2026, sugestão de quem usa, com o monitor EM PÉ): o lado a lado e o "todos do mesmo
 * tamanho" eram `repeat(auto-fit, minmax(260px, 1fr))`, que só olha a LARGURA. Num monitor em pé (1080 × 1920), quatro
 * quadros cabiam numa linha, e sobrava uma tela inteira de preto em cima e embaixo. Agora o número de colunas sai da
 * conta: para cada número de colunas, o maior quadro 16:9 que cabe na largura e na altura; fica o que der o maior.
 * Deitado, quatro quadros viram 2 × 2 em vez de uma fileira estreita; em pé, eles empilham.
 */
export const PROPORCAO = 16 / 9;
/** Menor que isto, a grade volta à de sempre, que rola: quadros minúsculos não servem para nada. */
const MENOR_QUADRO = 200;

export function melhorGrade(quantos: number, largura: number, altura: number, espaco: number) {
  let melhor = { colunas: 1, largura: 0 };
  for (let colunas = 1; colunas <= quantos; colunas++) {
    const linhas = Math.ceil(quantos / colunas);
    const pelaLargura = (largura - (colunas - 1) * espaco) / colunas;
    const pelaAltura = ((altura - (linhas - 1) * espaco) / linhas) * PROPORCAO;
    const q = Math.floor(Math.min(pelaLargura, pelaAltura));
    if (q > melhor.largura) melhor = { colunas, largura: q };
  }
  return melhor;
}

/** A medida da grade e o estilo que a enche. Sem medida (ou com quadros pequenos demais), o CSS de sempre. */
export function useGradeQueEnche(quantos: number) {
  // A grade aparece e some com o modo (lado a lado, mosaico, destaque): o ref é o próprio elemento, guardado em estado,
  // para a medida recomeçar a cada vez que ela nasce.
  const [el, ref] = useState<HTMLDivElement | null>(null);
  const [caixa, setCaixa] = useState<{ w: number; h: number; espaco: number } | null>(null);
  useLayoutEffect(() => {
    if (!el || typeof ResizeObserver === 'undefined') return setCaixa(null);
    const medir = () => {
      const estilo = getComputedStyle(el);
      setCaixa({
        w: el.clientWidth - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight),
        h: el.clientHeight - parseFloat(estilo.paddingTop) - parseFloat(estilo.paddingBottom),
        espaco: parseFloat(estilo.columnGap) || 0,
      });
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [el]);
  let estilo: CSSProperties | undefined;
  if (caixa && quantos > 0) {
    const g = melhorGrade(quantos, caixa.w, caixa.h, caixa.espaco);
    if (g.largura >= MENOR_QUADRO) {
      estilo = { gridTemplateColumns: `repeat(${g.colunas}, ${g.largura}px)`, justifyContent: 'center', overflowY: 'hidden' };
    }
  }
  return { ref, estilo };
}
