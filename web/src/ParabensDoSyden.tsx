import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Confete } from './Comemoracao';
import { useT } from './i18n';
import { Mascote } from './Mascote';

/**
 * A FESTA DE ANIVERSÁRIO DO PRÓPRIO SYDEN (pedido dele, 18/10/2026): no dia do aniversário da pessoa (o dia e o mês que
 * ela informou em Minha conta, na hora do aparelho dela), ao abrir o Syden, confete, o mascote cantando e os parabéns.
 * Uma vez por ano: o servidor guarda o ano em que ela viu (POST /api/me/aniversario/parabens-visto), em qualquer
 * aparelho. Entra na fila das festas do Shell, uma de cada vez. Quem pediu menos movimento recebe o cartão sem o confete
 * (o Confete já respeita isso).
 *
 * A frase não fala com ninguém no masculino nem no feminino: "que este ano venha cheio…" (ver "Onde a língua esconde o
 * gênero", no CLAUDE.md), e o botão é o "Que legal!" da festa da ideia, e não um "Obrigado", que em português tem gênero.
 */
export function ParabensDoSyden({ nome, aoFechar }: { nome: string; aoFechar: () => void }) {
  const t = useT();
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aoFechar]);

  return createPortal(
    <div className="comemoracao-fundo" onClick={aoFechar}>
      <Confete />
      <div className="comemoracao parabens-do-syden" role="dialog" aria-labelledby="parabens-titulo" onClick={(e) => e.stopPropagation()}>
        <Mascote nome="karaoke" tamanho={220} />
        <h2 id="parabens-titulo">{t('Feliz aniversário, {nome}!', { nome })}</h2>
        <p>{t('Que este ano venha cheio de boas conversas, boas partidas e boa companhia.')}</p>
        <button className="btn-primary" onClick={aoFechar} autoFocus>
          {t('Que legal!')}
        </button>
      </div>
    </div>,
    document.body,
  );
}

