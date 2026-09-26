import { Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { EFEITOS_VISUAIS } from './efeitosVisuais';
import { IconButton } from './IconButton';
import { useSettings } from './settings';
import type { Voice } from './useVoice';

/**
 * Manda um efeito visual para a sala inteira: confete, fogos ou corações.
 *
 * É o irmão do soundboard, e dá para usar os dois ao mesmo tempo — clicar num som e num efeito é o que
 * faz a comemoração parecer comemoração. O efeito não passa pelo servidor: vai pelo mesmo canal de
 * dados da chamada que o soundboard já usa, e cada computador desenha o seu.
 */
export function EfeitoVisualButton({ voice }: { voice: Voice }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const ligado = useSettings().efeitosVisuais;

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  // Quem desligou os efeitos não vê o botão: mandaria para os outros uma coisa que ele mesmo não veria.
  if (!ligado) return null;

  return (
    <div className="screenshare-anchor" ref={ref}>
      <IconButton label="Mandar um efeito para a sala" onClick={() => setOpen(!open)}>
        <Sparkles />
      </IconButton>
      {open && (
        <div className="screenshare-menu" role="menu">
          <div className="screenshare-menu-title">Efeito para a sala</div>
          {EFEITOS_VISUAIS.map((efeito) => (
            <button
              key={efeito.id}
              className="person-menu-item screenshare-option"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void voice.mandarEfeitoVisual(efeito.id);
              }}
            >
              <span className="efeito-visual-emoji" aria-hidden="true">
                {efeito.emoji}
              </span>
              <span className="screenshare-option-text">
                <span>{efeito.nome}</span>
                <small>{efeito.dica}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
