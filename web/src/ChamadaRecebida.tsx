import { Phone, PhoneOff } from 'lucide-react';
import { useEffect } from 'react';
import { Avatar } from './Avatar';
import { isolar } from './bidi';
import { nomeDe } from './directory';
import { useT } from './i18n';
import { sounds } from './sounds';

/** O que chega a quem recebe a ligação ('chamada:tocando', em server/src/realtime.ts). */
export interface ChamadaTocando {
  channelId: number;
  de: { id: number; username: string; nomeDeExibicao: string | null };
}

/** Quanto tempo o toque dura antes de desistir sozinho, como um telefone. */
export const TEMPO_DO_TOQUE_MS = 30_000;

/**
 * ALGUÉM ESTÁ LIGANDO numa conversa privada (pedido dele, 02/11/2026). O cartão no canto, como o convite para a voz,
 * mas com toque: é uma ligação, e ligação que não toca ninguém atende. O toque se repete até atender, recusar, quem
 * ligou desistir ou passarem 30 s (quem tira o cartão é o Shell). Não rouba o foco nem traz a janela para a frente
 * ("a tela não interrompe"); em "Não perturbe", toca calado. `grupo` é o nome da conversa quando ela é de mais gente.
 */
export function ChamadaRecebida({
  chamada,
  grupo,
  calado,
  aoAtender,
  aoRecusar,
}: {
  chamada: ChamadaTocando;
  grupo: string | null;
  calado: boolean;
  aoAtender: () => void;
  aoRecusar: () => void;
}) {
  const t = useT();
  const quem = nomeDe(chamada.de);

  useEffect(() => {
    if (calado) return;
    sounds.toque();
    const relogio = window.setInterval(() => sounds.toque(), 2500);
    return () => window.clearInterval(relogio);
  }, [calado]);

  return (
    <div className="convite-voz chamada-recebida" role="alertdialog" aria-label={t('{quem} está ligando', { quem: quem })}>
      <Avatar name={quem} userId={chamada.de.id} size={40} />
      <div className="convite-voz-texto">
        <strong>{t('{quem} está ligando', { quem: isolar(quem) })}</strong>
        {grupo && <span>{grupo}</span>}
        <div className="convite-voz-botoes">
          <button type="button" className="btn-primary chamada-atender" onClick={aoAtender}>
            <Phone size={16} aria-hidden="true" /> {t('Atender')}
          </button>
          <button type="button" className="btn-secondary chamada-recusar" onClick={aoRecusar}>
            <PhoneOff size={16} aria-hidden="true" /> {t('Recusar chamada')}
          </button>
        </div>
      </div>
    </div>
  );
}
