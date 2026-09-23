import { useState } from 'react';
import { CommunityDialog } from './CommunityRail';
import { Logo } from './Logo';
import type { Community } from './types';

/** Tela de quem ainda não participa de nenhuma comunidade (conta nova, ou saiu de todas). */
export function EmptyCommunities({ onDone }: { onDone: (community: Community) => void }) {
  const [abrindo, setAbrindo] = useState(false);

  return (
    <div className="no-community">
      <Logo size={56} />
      <h2>Você ainda não está em nenhuma comunidade</h2>
      <p>
        Uma comunidade é um lugar com canais de texto e salas de voz, como um servidor do Discord. Entre na de um amigo
        com o código de convite dele, ou crie a sua.
      </p>
      <div className="no-community-actions">
        {/* Um caminho só, igual ao botão da coluna: a escolha entre criar e entrar mora dentro da janela. */}
        <button className="btn-primary" onClick={() => setAbrindo(true)}>
          Adicionar comunidade
        </button>
      </div>
      {abrindo && (
        <CommunityDialog
          mode="choose"
          onClose={() => setAbrindo(false)}
          onDone={(community) => {
            setAbrindo(false);
            onDone(community);
          }}
        />
      )}
    </div>
  );
}
