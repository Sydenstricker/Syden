import { type ReactNode, useEffect } from 'react';

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-title">
        <h2 id="dialog-title">{title}</h2>
        <div className="dialog-body">{children}</div>
        {error && <p className="form-error">{error}</p>}
        <div className="dialog-actions">
          <button className="link-button" onClick={onCancel}>
            Cancelar
          </button>
          <button className="btn-danger" onClick={onConfirm} disabled={busy} autoFocus>
            {busy ? 'Aguarde…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
