import { AppWindow, Globe, Monitor, MonitorOff, MonitorX } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { AnimatedIcon } from './AnimatedIcon';
import { IconButton } from './IconButton';
import type { Voice } from './useVoice';

const OPTIONS: { surface: 'monitor' | 'window' | 'browser'; label: string; hint: string; icon: ReactNode }[] = [
  {
    surface: 'monitor',
    label: 'Tela inteira',
    hint: 'Tudo o que está na tela. O som vai ser o do computador inteiro — inclusive esta chamada.',
    icon: <Monitor size={16} />,
  },
  {
    surface: 'window',
    label: 'Uma janela ou app',
    hint: 'Só aquele programa. No Windows o som dele não vem junto: a transmissão fica muda.',
    icon: <AppWindow size={16} />,
  },
  {
    surface: 'browser',
    label: 'Uma aba do navegador',
    hint: 'Só aquela aba, com o som dela — a única forma de mandar som sem devolver a chamada junto.',
    icon: <Globe size={16} />,
  },
];

/**
 * Botão de compartilhar tela com um menu, em vez de ligar/desligar na hora: escolhe o que mostrar
 * (tela inteira, uma janela ou uma aba) e, já transmitindo, troca para outra tela ou para.
 */
export function ScreenShareButton({ voice }: { voice: Voice }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const sharing = voice.media.screen;

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  return (
    <div className="screenshare-anchor" ref={ref}>
      <IconButton label={sharing ? 'Opções da transmissão' : 'Compartilhar tela'} active={sharing} onClick={() => setOpen(!open)}>
        {/* Transmitindo, o ícone precisa avisar que dá para parar: aí volta o desenho comum. */}
        {sharing ? <MonitorOff /> : <AnimatedIcon name="tela" size={24} />}
      </IconButton>
      {open && (
        <div className="screenshare-menu" role="menu">
          <div className="screenshare-menu-title">{sharing ? 'Trocar para…' : 'O que compartilhar?'}</div>
          {OPTIONS.map((option) => (
            <button
              key={option.surface}
              className="person-menu-item screenshare-option"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void voice.shareScreen(option.surface);
              }}
            >
              {option.icon}
              <span className="screenshare-option-text">
                <span>{option.label}</span>
                <small>{option.hint}</small>
              </span>
            </button>
          ))}
          {sharing && (
            <button
              className="person-menu-item danger"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                void voice.stopScreen();
              }}
            >
              <MonitorX size={16} /> Parar de compartilhar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
