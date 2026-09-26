import { AppWindow, Globe, Monitor, MonitorOff, MonitorX, Volume2 } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { IconButton } from './IconButton';
import { appAudioSupported } from './screenAudio';
import type { Voice } from './useVoice';

type Superficie = 'monitor' | 'window' | 'browser';

interface Opcao {
  surface: Superficie;
  label: string;
  icon: ReactNode;
  /** No app de desktop o som do computador vai sozinho; no navegador depende da caixinha do seletor. */
  noApp: string;
  noNavegador: string;
}

const OPTIONS: Opcao[] = [
  {
    surface: 'monitor',
    label: 'Tela inteira',
    icon: <Monitor size={16} />,
    noApp: 'Tudo o que está na tela. O som do computador vai junto, já sem as vozes desta chamada.',
    noNavegador:
      'Tudo o que está na tela. Para ir com som, marque "compartilhar áudio do sistema" na janelinha do navegador.',
  },
  {
    surface: 'window',
    label: 'Uma janela ou app',
    icon: <AppWindow size={16} />,
    noApp: 'Só aquele programa, e o som do computador vai junto mesmo assim.',
    noNavegador: 'Só aquele programa. O navegador NÃO manda o som de uma janela: a transmissão fica muda.',
  },
  {
    surface: 'browser',
    label: 'Uma aba do navegador',
    icon: <Globe size={16} />,
    noApp: 'Só aquela aba, com o som dela.',
    noNavegador: 'Só aquela aba. É a única em que o navegador já vem com o som marcado.',
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
  // No app de desktop existe um caminho nativo que entrega o som do computador sem as vozes da chamada.
  // Saber disso muda tudo o que o menu diz, então a resposta é buscada uma vez só, ao montar.
  const [somAutomatico, setSomAutomatico] = useState(false);

  useEffect(() => {
    let vivo = true;
    void appAudioSupported().then((pode) => vivo && setSomAutomatico(pode));
    return () => {
      vivo = false;
    };
  }, []);

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
        {sharing ? <MonitorOff /> : <Monitor />}
      </IconButton>
      {open && (
        <div className="screenshare-menu" role="menu">
          <div className="screenshare-menu-title">{sharing ? 'Trocar para…' : 'O que compartilhar?'}</div>
          {somAutomatico ? (
            <p className="screenshare-menu-som">
              <Volume2 size={14} aria-hidden="true" /> O som do computador vai junto sozinho.
            </p>
          ) : (
            <p className="screenshare-menu-som atencao">
              <Volume2 size={14} aria-hidden="true" /> No navegador, o som só vai se você marcar a caixinha de áudio na
              janelinha que abrir. No app do Syden ele vai sozinho.
            </p>
          )}
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
                <small>{somAutomatico ? option.noApp : option.noNavegador}</small>
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
