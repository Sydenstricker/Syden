import type { ReactNode } from 'react';

/** Botão redondo de ícone, usado nos controles de voz e na barra lateral. */
export function IconButton({
  label,
  onClick,
  active,
  danger,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      className={`icon-button${active ? ' active' : ''}${danger ? ' danger' : ''}`}
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
