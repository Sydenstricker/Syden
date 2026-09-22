import { Circle, CircleMinus, EyeOff, Moon } from 'lucide-react';
import { type MouseEvent, type ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { STATUS_LABEL } from './presenceStatus';
import type { PresenceStatus } from './types';

const OPTIONS: { status: PresenceStatus; icon: ReactNode; color: string }[] = [
  { status: 'online', icon: <Circle size={16} />, color: 'var(--green)' },
  { status: 'ausente', icon: <Moon size={16} />, color: '#f0b232' },
  { status: 'ocupado', icon: <CircleMinus size={16} />, color: 'var(--red)' },
  { status: 'invisivel', icon: <EyeOff size={16} />, color: '#80848e' },
];

/** Abre o menu de status no botão direito em cima do próprio avatar. */
export function useStatusMenu() {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  const open = (event: MouseEvent) => {
    event.preventDefault();
    setPos({ x: event.clientX, y: event.clientY });
  };

  return { open: pos, onOpen: open, close: () => setPos(null) };
}

/**
 * Escolher o próprio status (online, ausente, ocupado, invisível), como no Discord. "Invisível" só muda
 * como você aparece para os outros — a própria conexão continua normal.
 */
export function StatusMenu({
  x,
  y,
  current,
  onChoose,
  onClose,
}: {
  x: number;
  y: number;
  current: PresenceStatus;
  onChoose: (status: PresenceStatus) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', close);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="person-menu"
      role="menu"
      style={{ top: Math.min(y, window.innerHeight - 220), left: Math.min(x, window.innerWidth - 220) }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="person-menu-name">Seu status</div>
      {OPTIONS.map((option) => (
        <button
          key={option.status}
          className={`person-menu-item${current === option.status ? ' active' : ''}`}
          role="menuitemradio"
          aria-checked={current === option.status}
          onClick={() => {
            onChoose(option.status);
            onClose();
          }}
        >
          <span style={{ color: option.color, display: 'flex' }}>{option.icon}</span>
          {STATUS_LABEL[option.status]}
        </button>
      ))}
    </div>,
    document.body,
  );
}
