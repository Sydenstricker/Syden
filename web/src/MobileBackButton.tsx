import { ChevronLeft } from 'lucide-react';

/**
 * Seta de voltar para a lista de canais, só visível em telas estreitas (a classe .mobile-back fica
 * escondida por padrão; o CSS mostra a partir do ponto em que a barra lateral e a conversa não cabem
 * lado a lado — ver @media em styles.css). Em telas largas não aparece nada, mesmo com o botão montado.
 */
export function MobileBackButton({ onBack }: { onBack: () => void }) {
  return (
    <button className="mobile-back" title="Voltar aos canais" aria-label="Voltar aos canais" onClick={onBack}>
      <ChevronLeft size={22} />
    </button>
  );
}
