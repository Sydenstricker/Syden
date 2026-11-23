import { PenLine, Pencil } from 'lucide-react';
import { type MouseEvent, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from './i18n';
import { definirStatusDaSala, MAXIMO_DO_STATUS, useStatusDaSala } from './statusDasSalas';

/**
 * O STATUS DA SALA DE VOZ na tela (ver statusDasSalas.ts): a linha embaixo do nome da sala, o menu do botão direito da
 * sala ("Definir status da sala") e o lápis do palco. O lápis é o caminho do toque e do teclado: função que só existe
 * no botão direito não existe no celular (CLAUDE.md, "O celular não tem botão direito").
 */

/** A linha esmaecida embaixo do nome da sala (ou ao lado dele, no cabeçalho do palco). Sem status, nada. */
export function LinhaDoStatusDaSala({ channelId, noCabecalho = false }: { channelId: number; noCabecalho?: boolean }) {
  const status = useStatusDaSala(channelId);
  if (!status) return null;
  return (
    <div className={`status-da-sala${noCabecalho ? ' no-cabecalho' : ''}`} title={status}>
      {status}
    </div>
  );
}

/** Abre o menu do status no botão direito em cima da sala (ou num clique, já editando). */
export function useMenuDoStatusDaSala() {
  const [aberto, setAberto] = useState<{ x: number; y: number; editando: boolean } | null>(null);
  return {
    aberto,
    abrir: (event: MouseEvent, editando = false) => {
      event.preventDefault();
      const caixa = (event.currentTarget as HTMLElement).getBoundingClientRect();
      // Pelo teclado (Enter no lápis) não há ponto do mouse: o menu vai embaixo do botão.
      const x = event.clientX || caixa.left;
      const y = event.clientY || caixa.bottom;
      setAberto({ x, y, editando });
    },
    fechar: () => setAberto(null),
  };
}

export function MenuDoStatusDaSala({
  channelId,
  x,
  y,
  editando: comecarEditando,
  onClose,
}: {
  channelId: number;
  x: number;
  y: number;
  editando: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const atual = useStatusDaSala(channelId);
  const [editando, setEditando] = useState(comecarEditando);
  const [texto, setTexto] = useState(atual);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const fechar = () => onClose();
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('pointerdown', fechar);
    window.addEventListener('keydown', tecla);
    return () => {
      window.removeEventListener('pointerdown', fechar);
      window.removeEventListener('keydown', tecla);
    };
  }, [onClose]);

  async function salvar(novo: string) {
    setSalvando(true);
    const falha = await definirStatusDaSala(channelId, novo);
    setSalvando(false);
    if (falha) setErro(falha);
    else onClose();
  }

  return createPortal(
    <div
      className="person-menu"
      role="menu"
      style={{ top: Math.min(y, window.innerHeight - 180), left: Math.min(x, window.innerWidth - 280) }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {editando ? (
        <div className="person-menu-nota">
          <input
            autoFocus
            value={texto}
            maxLength={MAXIMO_DO_STATUS}
            placeholder={t('Ex.: ranqueada, não chamar')}
            aria-label={t('Status da sala')}
            onChange={(e) => {
              setTexto(e.target.value);
              setErro(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (!salvando) void salvar(texto);
              }
            }}
          />
          {erro && <p className="form-error small">{t(erro)}</p>}
          <div className="person-menu-nota-rodape">
            <span>{t('Some quando a sala esvazia')}</span>
            {atual && (
              <button className="link-button" disabled={salvando} onClick={() => void salvar('')}>
                {t('Tirar o status')}
              </button>
            )}
            <button className="link-button" disabled={salvando} onClick={() => void salvar(texto)}>
              {t('Guardar')}
            </button>
          </div>
        </div>
      ) : (
        <button className="person-menu-item" role="menuitem" onClick={() => setEditando(true)}>
          <PenLine size={16} />
          {t('Definir status da sala')}
        </button>
      )}
    </div>,
    document.body,
  );
}

/** O lápis do palco, para quem está na sala: abre o status já editando. */
export function LapisDoStatusDaSala({ channelId }: { channelId: number }) {
  const t = useT();
  const menu = useMenuDoStatusDaSala();
  return (
    <>
      <button
        className="header-toggle lapis-do-status"
        title={t('Definir status da sala')}
        aria-label={t('Definir status da sala')}
        onClick={(e) => menu.abrir(e, true)}
      >
        <Pencil size={18} />
      </button>
      {menu.aberto && (
        <MenuDoStatusDaSala channelId={channelId} x={menu.aberto.x} y={menu.aberto.y} editando onClose={menu.fechar} />
      )}
    </>
  );
}
