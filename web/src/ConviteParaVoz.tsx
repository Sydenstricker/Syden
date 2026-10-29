import { X } from 'lucide-react';
import { Avatar } from './Avatar';
import { isolar } from './bidi';
import { nomeDe } from './directory';
import { useT } from './i18n';

/** O que chega a quem foi chamado para a voz ('voice:convite', em server/src/realtime.ts). */
export interface ConviteRecebido {
  de: { id: number; username: string; nomeDeExibicao: string | null };
  channelId: number;
  sala: string;
  communityId: number;
  comunidade: string;
}

/**
 * O CONVITE PARA A VOZ, do lado de quem foi chamado (ver ConvidarParaVoz.tsx). Um cartão no canto, sem roubar o foco e
 * sem som: entrar é um clique, ignorar é não fazer nada. Quem o põe e o tira é o Shell — e ele SOME SOZINHO quando quem
 * chamou sai da sala, porque um convite para uma sala vazia afirmaria uma coisa que já não é.
 */
export function ConviteParaVoz({ convite, aoEntrar, aoFechar }: { convite: ConviteRecebido; aoEntrar: () => void; aoFechar: () => void }) {
  const t = useT();
  const quem = nomeDe(convite.de);
  return (
    <div className="convite-voz" role="status">
      <Avatar name={quem} userId={convite.de.id} size={40} />
      <div className="convite-voz-texto">
        <strong>{t('{quem} chama você para a voz', { quem: isolar(quem) })}</strong>
        <span>
          {convite.sala} · {convite.comunidade}
        </span>
        <div className="convite-voz-botoes">
          <button type="button" className="btn-primary" onClick={aoEntrar}>
            {t('Entrar na voz')}
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
