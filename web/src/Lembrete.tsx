import { BellPlus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from './api';
import { idiomaAtual, useT } from './i18n';
import { duracao } from './ModeracaoDaPessoa';

// "LEMBRAR DE MIM", na barra de ações da mensagem. Na hora, só você recebe o aviso — e, se estiver fora,
// recebe quando voltar. Quem cumpre a hora é o server/src/agendador.ts.

/** Os tempos que o servidor aceita (MINUTOS_DE_LEMBRETE em agendadas-routes.ts). */
const TEMPOS = [20, 60, 180, 1440];

export function BotaoDeLembrete({ messageId }: { messageId: number }) {
  const t = useT();
  const [aberto, setAberto] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const idioma = idiomaAtual();

  // Fecha ao clicar fora, como os outros menus.
  useEffect(() => {
    if (!aberto) return;
    const fechar = () => setAberto(false);
    window.addEventListener('pointerdown', fechar);
    return () => window.removeEventListener('pointerdown', fechar);
  }, [aberto]);

  // O "combinado" some sozinho: é confirmação, não aviso que precise ficar.
  useEffect(() => {
    if (!aviso) return;
    const tempo = setTimeout(() => setAviso(null), 2500);
    return () => clearTimeout(tempo);
  }, [aviso]);

  async function lembrar(minutos: number) {
    setAberto(false);
    try {
      await api('/api/lembretes', { method: 'POST', body: { messageId, minutos } });
      setAviso(t('Combinado: lembro você em {tempo}.', { tempo: duracao(minutos, idioma) }));
    } catch (e) {
      setAviso((e as Error).message);
    }
  }

  return (
    <>
      <button
        ref={botao}
        className="message-action"
        title={aviso ?? t('Lembrar de mim')}
        aria-label={t('Lembrar de mim')}
        onClick={() => {
          const caixa = botao.current?.getBoundingClientRect();
          setPos(caixa ? { x: caixa.left, y: caixa.bottom + 6 } : null);
          setAberto(!aberto);
        }}
      >
        <BellPlus size={16} />
      </button>
      {/* A CONFIRMAÇÃO VAI FORA DA BARRA DE AÇÕES: a barra some quando o mouse sai da mensagem — e o
          mouse sai justamente para clicar no menu. Dentro dela, ninguém chegava a ver o "combinado". */}
      {aviso &&
        pos &&
        createPortal(
          <span className="lembrete-aviso" role="status" style={{ position: 'fixed', top: pos.y, left: Math.min(pos.x, window.innerWidth - 300) }}>
            {aviso}
          </span>,
          document.body,
        )}
      {aberto &&
        pos &&
        createPortal(
          <div
            className="person-menu lembrete-menu"
            role="menu"
            style={{ position: 'fixed', top: pos.y, left: Math.min(pos.x, window.innerWidth - 220) }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="person-menu-name">{t('Lembrar de mim em…')}</div>
            {TEMPOS.map((minutos) => (
              <button key={minutos} className="person-menu-item" role="menuitem" onClick={() => void lembrar(minutos)}>
                <span className="person-menu-texto">{duracao(minutos, idioma)}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
