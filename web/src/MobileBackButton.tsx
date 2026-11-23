import { ChevronLeft, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useT } from './i18n';
import { updateSettings, useSettings } from './settings';

/**
 * Seta de voltar para a lista de canais, só visível em telas estreitas (a classe .mobile-back fica
 * escondida por padrão; o CSS mostra a partir do ponto em que a barra lateral e a conversa não cabem
 * lado a lado — ver @media em styles.css). Em telas largas não aparece nada, mesmo com o botão montado.
 *
 * NO COMPUTADOR, NO MESMO LUGAR, O BOTÃO DE RECOLHER OS CANAIS (23/11/2026, sugestão de quem usa: "esconder a aba
 * lateral da esquerda, como a da direita"). A da direita já tinha o botão das pessoas; a da esquerda não tinha nada, e a
 * transmissão ficava espremida entre as duas. Recolhida, a coluna sai (o .app ganha .canais-escondidos) e a escolha fica
 * guardada. Os ícones das comunidades continuam: é por eles que se volta para outro lugar. O rótulo é só "Canais", com o
 * estado em aria-pressed e no desenho do ícone, para não pedir uma frase nova aos 80 idiomas.
 */
export function MobileBackButton({ onBack }: { onBack: () => void }) {
  const t = useT();
  const { esconderCanais } = useSettings();
  return (
    <>
      <button className="mobile-back" title={t('Voltar aos canais')} aria-label={t('Voltar aos canais')} onClick={onBack}>
        <ChevronLeft size={22} />
      </button>
      <button
        className={`botao-dos-canais header-toggle${esconderCanais ? '' : ' active'}`}
        title={t('Canais')}
        aria-label={t('Canais')}
        aria-pressed={!esconderCanais}
        onClick={() => updateSettings({ esconderCanais: !esconderCanais })}
      >
        {esconderCanais ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
      </button>
    </>
  );
}
