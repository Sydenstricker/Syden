import { type FormEvent, useState } from 'react';
import { createPortal } from 'react-dom';
import { Flag } from 'lucide-react';
import { api } from './api';

/**
 * A caixa de denúncia. Fica disponível para qualquer pessoa, e não só para quem modera — é justamente
 * quem não tem poder nenhum que precisa de um caminho para dizer que algo está errado.
 *
 * O texto denunciado é copiado no servidor no momento da denúncia, então apagar a mensagem depois não
 * apaga a prova.
 */
export function DialogoDeDenuncia({
  titulo,
  corpo,
  aoFechar,
}: {
  titulo: string;
  corpo: { tipo: 'mensagem' | 'pessoa'; alvo: number };
  aoFechar: () => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [enviada, setEnviada] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    setOcupado(true);
    setErro(null);
    try {
      await api('/api/reports', { method: 'POST', body: { ...corpo, motivo } });
      setEnviada(true);
    } catch (e) {
      setErro((e as Error).message);
    }
    setOcupado(false);
  }

  return createPortal(
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className="dialog denuncia" role="dialog" aria-modal="true" aria-label={titulo}>
        {enviada ? (
          <>
            <h2>
              <Flag size={18} aria-hidden="true" /> Denúncia enviada
            </h2>
            <p>Quem cuida do Syden vai olhar. Obrigado por avisar.</p>
            <button type="button" className="btn-primary" onClick={aoFechar} autoFocus>
              Fechar
            </button>
          </>
        ) : (
          <form onSubmit={enviar}>
            <h2>
              <Flag size={18} aria-hidden="true" /> {titulo}
            </h2>
            <p className="settings-hint">Conte em poucas palavras o que houve. Quem cuida do Syden vai ler.</p>
            <label>
              
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                maxLength={1000}
                rows={4}
                required
                autoFocus
                placeholder="O que aconteceu?"
              />
            </label>
            {erro && <p className="form-error">{erro}</p>}
            <div className="dialog-actions">
              <button type="button" className="btn-secondary" onClick={aoFechar}>
                Cancelar
              </button>
              <button className="btn-primary" disabled={ocupado || motivo.trim().length < 3}>
                {ocupado ? 'Enviando…' : 'Enviar denúncia'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
