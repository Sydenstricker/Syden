import { SmilePlus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useT } from './i18n';
import { IconButton } from './IconButton';
import { imagemDaReacao, REACOES } from './reacoes';
import type { Voice } from './useVoice';

/**
 * O BOTÃO DE REAGIR (05/11/2026): abre a grade dos balõezinhos (web/src/reacoes.ts); clicar num manda a reação e deixa a
 * grade ABERTA, para reagir de novo sem dois cliques (o freio de 0,7 s fica no useVoice). Fecha ao clicar fora ou no Esc.
 * As figuras não têm nome: um nome por balão seriam 20 frases nos 80 idiomas, e o desenho já diz.
 */
export function BotaoDeReacao({ voice }: { voice: Voice }) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    window.addEventListener('pointerdown', fora);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', fora);
      window.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  return (
    <div className="screenshare-anchor" ref={ref}>
      <IconButton label={t('Reagir')} active={aberto} onClick={() => setAberto(!aberto)}>
        <SmilePlus />
      </IconButton>
      {aberto && (
        <div className="screenshare-menu reacoes-grade" role="menu" aria-label={t('Reagir')}>
          {REACOES.map((r) => (
            <button key={r} type="button" className="reacoes-botao" role="menuitem" onClick={() => void voice.reagir(r)}>
              <img src={imagemDaReacao(r)} alt="" width={32} height={32} draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** O balão em cima do quadro de quem reagiu: entra pulando, fica e some (a animação é do CSS). */
export function BalaoDeReacao({ reacao }: { reacao: { reacao: (typeof REACOES)[number]; key: number } | undefined }) {
  if (!reacao) return null;
  return <img key={reacao.key} className="tile-reacao" src={imagemDaReacao(reacao.reacao)} alt="" aria-hidden="true" draggable={false} />;
}
