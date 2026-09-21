import { useState } from 'react';
import { CommunityDialog } from './CommunityRail';
import { Logo } from './Logo';
import type { Community } from './types';

/** Tela de quem ainda não participa de nenhuma comunidade (conta nova, ou saiu de todas). */
export function EmptyCommunities({ onDone }: { onDone: (community: Community) => void }) {
  const [dialog, setDialog] = useState<'create' | 'join' | null>(null);

  return (
    <div className="no-community">
      <Logo size={56} />
      <h2>Você ainda não está em nenhuma comunidade</h2>
      <p>
        Uma comunidade é um lugar com canais de texto e salas de voz, como um servidor do Discord. Entre na de um amigo
        com o código de convite dele, ou crie a sua.
      </p>
      <div className="no-community-actions">
        <button className="btn-primary" onClick={() => setDialog('join')}>
          Entrar com um convite
        </button>
        <button className="btn-secondary" onClick={() => setDialog('create')}>
          Criar a minha comunidade
        </button>
      </div>
      {dialog && (
        <CommunityDialog
          mode={dialog}
          onClose={() => setDialog(null)}
          onDone={(community) => {
            setDialog(null);
            onDone(community);
          }}
        />
      )}
    </div>
  );
}
