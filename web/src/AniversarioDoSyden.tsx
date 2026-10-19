import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NASCIMENTO_DO_SYDEN } from './diaDoSyden';
import { Confete } from './Comemoracao';
import { idiomaAtual, useT } from './i18n';
import { Mascote } from './Mascote';

/**
 * A FESTA DO ANIVERSÁRIO DO SYDEN (decisão dele, 19/10/2026): em 19/09, ao abrir o Syden, confete, o mascote cantando
 * e a data em que ele nasceu. Uma vez por ano, guardado nas preferências (que seguem a pessoa para os outros aparelhos).
 * Entra na fila das festas do Shell, depois do aniversário da pessoa. Quem pediu menos movimento recebe o cartão sem o
 * confete (o Confete já respeita isso). A frase não marca gênero de quem lê ("valeu por fazer parte").
 */
export function AniversarioDoSyden({ aoFechar }: { aoFechar: () => void }) {
  const t = useT();
  const idioma = idiomaAtual();
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aoFechar]);

  const { ano, mes, dia } = NASCIMENTO_DO_SYDEN;
  // sem os dados da língua no navegador (tétum, samoano…), o Intl escreveria a data na língua dele: aí, os números
  const data = Intl.DateTimeFormat.supportedLocalesOf(idioma).length
    ? new Intl.DateTimeFormat(idioma, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(ano, mes - 1, dia))
    : `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;

  return createPortal(
    <div className="comemoracao-fundo" onClick={aoFechar}>
      <Confete />
      <div className="comemoracao parabens-do-syden" role="dialog" aria-labelledby="aniversario-do-syden-titulo" onClick={(e) => e.stopPropagation()}>
        <Mascote nome="karaoke" tamanho={220} />
        <h2 id="aniversario-do-syden-titulo">{t('Hoje é aniversário do Syden!')}</h2>
        <p>{t('O Syden nasceu em {data}. Valeu por fazer parte desta história.', { data })}</p>
        <button className="btn-primary" onClick={aoFechar} autoFocus>
          {t('Que legal!')}
        </button>
      </div>
    </div>,
    document.body,
  );
}
