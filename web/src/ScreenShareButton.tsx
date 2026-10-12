import { AppWindow, Monitor, MonitorOff, MonitorX, Volume2 } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { chave, useT } from './i18n';
import { IconButton } from './IconButton';
import { desktopBridge } from './desktop';
import { appAudioSupported } from './screenAudio';
import type { Voice } from './useVoice';

type Superficie = 'monitor' | 'window' | 'browser';

interface Opcao {
  surface: Superficie;
  label: string;
  icon: ReactNode;
  /**
   * O texto com o som do computador indo sozinho (o app com o módulo de som) e o texto em que ele
   * depende da caixinha do seletor. Faltando um dos dois, a opção não aparece naquele lugar.
   */
  noApp?: string;
  noNavegador?: string;
}

/**
 * AS MESMAS DUAS OPÇÕES NO APP E NO NAVEGADOR: tela inteira e uma janela do Windows.
 *
 * - No APP não existe aba de navegador (11/10/2026): "Uma aba" abria o mesmo seletor de telas e janelas.
 * - No NAVEGADOR a aba saiu e a janela voltou (12/10/2026, pedido do Sydenstricker): quem transmite
 *   quer mostrar um programa, não uma aba. A janela sai MUDA pelo navegador (ele não captura o som de
 *   uma janela), e o texto da opção diz isso antes da escolha; o aviso de "sem som" manda para a tela
 *   inteira, que é onde existe a caixinha de áudio.
 *
 * Quem precisar de uma aba ainda a acha: o seletor do navegador mostra telas, janelas e abas juntas,
 * e o tipo escolhido aqui só decide qual aparece primeiro.
 */
const OPTIONS: Opcao[] = [
  {
    surface: 'monitor',
    label: chave('Tela inteira'),
    icon: <Monitor size={16} />,
    noApp: chave('Tudo o que está na tela. O som do computador vai junto, já sem as vozes desta chamada.'),
    noNavegador:
      chave('Tudo o que está na tela. Para ir com som, marque "compartilhar áudio do sistema" na janelinha do navegador.'),
  },
  {
    surface: 'window',
    label: chave('Uma janela ou app'),
    icon: <AppWindow size={16} />,
    noApp: chave('Só aquele programa, e o som do computador vai junto mesmo assim.'),
    noNavegador: chave('Só aquele programa, sem som: o navegador não pega o som de uma janela. Para ir com som, use a tela inteira.'),
  },
];

/**
 * Botão de compartilhar tela com um menu, em vez de ligar/desligar na hora: escolhe o que mostrar
 * (tela inteira, uma janela ou uma aba) e, já transmitindo, troca para outra tela ou para.
 */
export function ScreenShareButton({ voice }: { voice: Voice }) {
  const t = useT();
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
      <IconButton label={sharing ? t('Opções da transmissão') : t('Compartilhar tela')} active={sharing} onClick={() => setOpen(!open)}>
        {sharing ? <MonitorOff /> : <Monitor />}
      </IconButton>
      {open && (
        <div className="screenshare-menu" role="menu">
          <div className="screenshare-menu-title">{sharing ? t('Trocar para…') : t('O que compartilhar?')}</div>
          {somAutomatico ? (
            <p className="screenshare-menu-som">
              <Volume2 size={14} aria-hidden="true" /> {t('O som do computador vai junto sozinho.')}
            </p>
          ) : (
            <p className="screenshare-menu-som atencao">
              <Volume2 size={14} aria-hidden="true" />{' '}
              {t('No navegador, o som só vai se você marcar a caixinha de áudio na janelinha que abrir. No app do Syden ele vai sozinho.')}
            </p>
          )}
          {OPTIONS.filter((option) => (desktopBridge ? option.noApp : option.noNavegador)).map((option) => (
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
                <span>{t(option.label)}</span>
                <small>{t((somAutomatico && option.noApp) || option.noNavegador || option.noApp || '')}</small>
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
              <MonitorX size={16} /> {t('Parar de compartilhar')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
