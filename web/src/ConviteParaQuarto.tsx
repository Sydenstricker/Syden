import { X } from 'lucide-react';
import { Avatar } from './Avatar';
import { isolar } from './bidi';
import { nomeDe } from './directory';
import { useT } from './i18n';

/** O que chega a quem foi convidado para um quarto privado ('quarto:convite', em server/src/trofeus-routes.ts). */
export interface ConviteDeQuarto {
  de: { id: number; username: string; nomeDeExibicao: string | null };
}

/**
 * O CONVITE PARA O QUARTO (03/11/2026, pedido dele): um amigo marcou você na lista de quem entra no quarto privado dele.
 * O mesmo cartão do convite para a voz (ConviteParaVoz.tsx), no canto, sem som e sem roubar o foco: visitar é um clique,
 * ignorar é não fazer nada. Quem estava fora quando foi convidado acha o convite na tela de Amigos.
 */
export function ConviteParaQuarto({ convite, aoVisitar, aoFechar }: { convite: ConviteDeQuarto; aoVisitar: () => void; aoFechar: () => void }) {
  const t = useT();
  const quem = nomeDe(convite.de);
  return (
    <div className="convite-voz" role="status">
      <Avatar name={quem} userId={convite.de.id} size={40} />
      <div className="convite-voz-texto">
        <strong>{t('{quem} chama você para visitar o quarto', { quem: isolar(quem) })}</strong>
        <div className="convite-voz-botoes">
          <button type="button" className="btn-primary" onClick={aoVisitar}>
            {t('Visitar o quarto')}
          </button>
          <button type="button" className="btn-secondary" onClick={aoFechar}>
            {t('Agora não')}
          </button>
        </div>
      </div>
      <button type="button" className="convite-voz-fechar" aria-label={t('Fechar')} title={t('Fechar')} onClick={aoFechar}>
        <X size={16} />
      </button>
    </div>
  );
}
