import { mediaUrl } from './api';
import type { Community } from './types';

const LINKING_WORDS = new Set(['do', 'da', 'de', 'dos', 'das', 'e']);

/** Iniciais do nome, como o Discord faz quando a comunidade não tem imagem: "Time do Valorant" → "TV". */
export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter((word) => !LINKING_WORDS.has(word.toLowerCase()));
  const letters = words.length > 1 ? words[0][0] + words[1][0] : name.trim().slice(0, 2);
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
