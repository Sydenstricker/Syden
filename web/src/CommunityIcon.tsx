import { mediaUrl } from './api';
import { grafemas, primeiroEmoji } from './nomeComEmoji';
import type { Community } from './types';

const LINKING_WORDS = new Set(['do', 'da', 'de', 'dos', 'das', 'e']);

/**
 * Iniciais do nome, como o Discord faz quando a comunidade não tem imagem: "Time do Valorant" → "TV".
 *
 * COM EMOJI NO NOME, O EMOJI É O ÍCONE. Quem põe 🎮 no nome da comunidade está escolhendo por que ela
 * vai ser reconhecida de longe, e espremer o desenho ao lado de uma letra deixaria os dois pequenos
 * demais para enxergar num quadrado de 46 pixels. Vale o primeiro emoji, esteja ele no começo ou no
 * meio: "Café ☕ dos Devs" vira ☕.
 *
 * E AS LETRAS PASSAM A SE CONTAR EM GRAFEMAS. Antes era `nome[0]`, que em "🎮 Jogos da firma"
 * devolvia "\ud83cJ" — metade do emoji, que o navegador desenha como o losango de interrogação.
 */
export function initials(name: string) {
  const limpo = name.trim();
  const emoji = primeiroEmoji(limpo);
  if (emoji) return emoji;

  const words = limpo.split(/\s+/).filter((word) => !LINKING_WORDS.has(word.toLowerCase()));
  const letters = words.length > 1 ? grafemas(words[0])[0] + grafemas(words[1])[0] : grafemas(limpo).slice(0, 2).join('');
  return letters.toUpperCase();
}

/**
 * Imagem da comunidade; sem imagem, as iniciais do nome. Dentro da coluna de comunidades o botão já dá o fundo
 * e o formato; em qualquer outro lugar, `standalone` desenha o quadrado arredondado.
 */
export function CommunityIcon({
  community,
  size = 46,
  standalone = false,
}: {
  community: Pick<Community, 'id' | 'name' | 'iconVersion'>;
  size?: number;
  standalone?: boolean;
}) {
  return (
    <span
      className={`community-badge${standalone ? ' standalone' : ''}`}
      style={standalone ? { width: size, height: size, fontSize: size * 0.34 } : undefined}
    >
      {community.iconVersion === null ? (
        initials(community.name)
      ) : (
        <img src={mediaUrl.communityIcon(community.id, community.iconVersion)} alt="" draggable={false} />
      )}
    </span>
  );
}
