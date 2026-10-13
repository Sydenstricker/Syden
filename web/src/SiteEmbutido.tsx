import { ExternalLink, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from './i18n';

/**
 * UM JOGO DE PARCEIRO RODANDO DENTRO DO SYDEN (13/10/2026, decisão do Sydenstricker: "a comodidade da aba de
 * mini-games é justamente rodar no Syden"). O site só carrega DEPOIS do clique de quem quer jogar — nunca sozinho,
 * nem para os outros. O que ele carrega (o Termo: o Google Analytics) está declarado na política de privacidade,
 * em #jogos-de-parceiros, e o endereço está na frame-src da política de segurança.
 *
 * DOIS LUGARES. Na sala de voz, o jogo ocupa o PALCO, o espaço do vídeo e da tela (desenho dele, mesmo dia: "a minha
 * solução é ainda melhor") — a lista de gente, os canais e a barra da call continuam à mão e clicáveis. Fora da sala
 * (o computador do quarto), abre numa janela por cima de tudo, que vai direto no <body> (portal): dentro de um
 * elemento com `transform` o `position: fixed` fica preso, e foi assim que ele saiu espremido no painel da sala.
 *
 * O quadro é isolado: o site roda os scripts dele e guarda o próprio progresso, mas não navega a janela do Syden,
 * e não recebe de onde veio (sem referrer). O botão de abrir no navegador fica sempre à mão, com o nome do site:
 * o jogo é dele, e não nosso.
 */
function QuadroDoSite({ nome, endereco, aoFechar }: { nome: string; endereco: string; aoFechar: () => void }) {
  const t = useT();
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [aoFechar]);

  // O EMPURRÃOZINHO: cada modo do Termo é uma página, e ela mede a janela ao carregar. Trocando de modo lá dentro, o
  // Termo sozinho saiu com as peças grandes demais e cortado dos lados (relato de 13/10/2026). Depois de cada
  // carregamento o quadro encolhe 1 px e volta: o site recebe um "a janela mudou de tamanho" e mede de novo.
  const [ajuste, setAjuste] = useState(0);
  const relogio = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (relogio.current) clearTimeout(relogio.current);
  }, []);
  const aoCarregar = () => {
    if (relogio.current) clearTimeout(relogio.current);
    relogio.current = setTimeout(() => {
      setAjuste(1);
      relogio.current = setTimeout(() => setAjuste(0), 120);
    }, 400);
  };

  return (
    <>
      <header>
        <strong>{nome}</strong>
        <a className="site-embutido-fora" href={endereco} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={14} aria-hidden="true" /> {t('Abrir em outra janela')}
        </a>
        <button type="button" className="icon-plain" aria-label={t('Fechar')} onClick={aoFechar}>
          <X size={16} />
        </button>
      </header>
      {/* O quadro nunca fica mais alto que a largura ÷ 1,7: o Termo mede as peças pela ALTURA, e no Quarteto (4
          tabuleiros lado a lado) um quadro alto e estreito cortava os tabuleiros dos lados. Era ÷ 1,5, e no app dele
          ainda cortava (13/10/2026: 1,46 cortou, 1,49 coube — o limite muda com o tamanho, porque o teclado do
          Termo tem altura fixa); 1,7 deixa folga. Sobrando altura, ele fica no meio. */}
      <div className="site-embutido-quadro">
        <iframe
          src={endereco}
          title={nome}
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms"
          referrerPolicy="no-referrer"
          allow="clipboard-write"
          onLoad={aoCarregar}
          style={ajuste ? { width: `calc(100% - ${ajuste}px)` } : undefined}
        />
      </div>
    </>
  );
}

/** Fora da sala: a janela por cima de tudo. */
export function SiteEmbutido({ nome, endereco, aoFechar }: { nome: string; endereco: string; aoFechar: () => void }) {
  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="dialog site-embutido" role="dialog" aria-modal="true" aria-label={nome}>
        <QuadroDoSite nome={nome} endereco={endereco} aoFechar={aoFechar} />
      </div>
    </div>,
    document.body,
  );
}

/** Na sala de voz: o jogo no lugar do palco, com a barra da call embaixo. */
export function SiteNoPalco({ nome, endereco, aoFechar }: { nome: string; endereco: string; aoFechar: () => void }) {
  return (
    <section className="site-embutido site-no-palco" aria-label={nome}>
      <QuadroDoSite nome={nome} endereco={endereco} aoFechar={aoFechar} />
    </section>
  );
}
