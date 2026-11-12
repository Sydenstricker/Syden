import { type RefObject, useEffect, useState } from 'react';

/**
 * NA TELA CHEIA, OS CONTROLES SOMEM COM O MOUSE PARADO (12/11/2026, relato de quem usa: "em tela cheia ele não esconde os
 * ícones"; o desenho é o do YouTube, pedido dele). Depois de 3 s sem mexer, o palco ganha `data-ocioso`, e o CSS apaga
 * a barra da chamada, o botão de tela cheia, o nome e o "i" das transmissões e o cursor. Mexer o mouse, tocar ou apertar
 * uma tecla traz tudo de volta na hora. As câmeras e os avisos (microfone bloqueado, silenciado) não somem: são conteúdo.
 *
 * Nunca some enquanto a pessoa está USANDO os controles: o mouse em cima da barra ou do "i", um menu aberto
 * (`aria-expanded`; menos a setinha da faixa de baixo, que fica "aberta" o tempo todo com a faixa à vista e prendia os
 * controles na tela para sempre), ou o foco do teclado num deles. Fora da tela cheia, nada muda: o palco divide a tela com o resto do
 * Syden, e esconder ali seria só atrapalhar.
 */
export const OCIOSO_MS = 3000;

/** O que segura os controles na tela, mesmo com o mouse parado. */
const EM_USO = '.stage-controls:hover, .stream-info:hover, .stage-controls :focus-visible, [aria-expanded="true"]:not(.stage-faixa-botao)';

export function useOciosoNaTelaCheia(alvo: RefObject<HTMLElement | null>): boolean {
  const [ocioso, setOcioso] = useState(false);

  useEffect(() => {
    let cheia = false;
    let relogio: ReturnType<typeof setTimeout> | undefined;

    const contar = () => {
      clearTimeout(relogio);
      relogio = setTimeout(() => {
        if (alvo.current?.querySelector(EM_USO)) contar();
        else setOcioso(true);
      }, OCIOSO_MS);
    };
    const acordar = () => {
      setOcioso(false);
      if (cheia) contar();
    };
    const mudouTelaCheia = () => {
      cheia = document.fullscreenElement !== null && document.fullscreenElement === alvo.current;
      if (cheia) acordar();
      else {
        clearTimeout(relogio);
        setOcioso(false);
      }
    };

    const eventos = ['pointermove', 'pointerdown', 'wheel', 'touchstart'] as const;
    for (const e of eventos) document.addEventListener(e, acordar, { passive: true });
    document.addEventListener('keydown', acordar);
    document.addEventListener('fullscreenchange', mudouTelaCheia);
    mudouTelaCheia();
    return () => {
      clearTimeout(relogio);
      for (const e of eventos) document.removeEventListener(e, acordar);
      document.removeEventListener('keydown', acordar);
      document.removeEventListener('fullscreenchange', mudouTelaCheia);
    };
  }, [alvo]);

  return ocioso;
}
