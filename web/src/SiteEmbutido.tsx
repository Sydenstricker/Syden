import { ExternalLink, X } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useT } from './i18n';

/**
 * UM JOGO DE PARCEIRO RODANDO DENTRO DO SYDEN (13/10/2026, decisão do Sydenstricker: "a comodidade da aba de
 * mini-games é justamente rodar no Syden"). O site só carrega DEPOIS do clique de quem quer jogar — nunca sozinho,
 * nem para os outros. O que ele carrega (o Termo: o Google Analytics) está declarado na política de privacidade,
 * em #jogos-de-parceiros, e o endereço está na frame-src da política de segurança.
 *
 * VAI DIRETO NO <body> (portal): aberto da estante da sala, ele nascia dentro do painel de mini-games, que usa
 * `transform` — e um elemento com transform prende o `position: fixed` de quem está dentro. O Termo saiu espremido
 * no painel, com barras de rolagem ("inviável usar assim", 13/10/2026).
 *
 * O quadro é isolado: o site roda os scripts dele e guarda o próprio progresso, mas não navega a janela do Syden,
 * e não recebe de onde veio (sem referrer). O botão de abrir no navegador fica sempre à mão, com o nome do site:
 * o jogo é dele, e não nosso.
 */
export function SiteEmbutido({ nome, endereco, aoFechar }: { nome: string; endereco: string; aoFechar: () => void }) {
  const t = useT();
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aoFechar]);

  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="dialog site-embutido" role="dialog" aria-modal="true" aria-label={nome}>
        <header>
          <strong>{nome}</strong>
          <a className="site-embutido-fora" href={endereco} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={14} aria-hidden="true" /> {t('Abrir em outra janela')}
          </a>
          <button type="button" className="icon-plain" aria-label={t('Fechar')} onClick={aoFechar}>
            <X size={16} />
          </button>
        </header>
        <iframe
          src={endereco}
          title={nome}
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
          referrerPolicy="no-referrer"
          allow="clipboard-write"
        />
      </div>
    </div>,
    document.body,
  );
}
