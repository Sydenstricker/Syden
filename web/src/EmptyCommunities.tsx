import { LogOut, Settings } from 'lucide-react';
import { useState } from 'react';
import { CommunityDialog } from './CommunityRail';
import { Logo } from './Logo';
import type { Community } from './types';
import { useT } from './i18n';

/**
 * Tela de quem ainda não participa de nenhuma comunidade (conta nova, ou saiu de todas).
 *
 * As configurações e o "sair" precisam estar AQUI, e não só na barra lateral: a barra só existe
 * quando há comunidade, e sem eles esta tela é um beco sem saída. É onde cai quem acabou de criar
 * conta pelo Google/GitHub — a primeira tela de boa parte de quem chega.
 */
export function EmptyCommunities({
  onDone,
  aoAbrirConfiguracoes,
  aoSair,
}: {
  onDone: (community: Community) => void;
  aoAbrirConfiguracoes: () => void;
  aoSair: () => void;
}) {
  const t = useT();
  const [abrindo, setAbrindo] = useState(false);

  return (
    <div className="no-community">
      <Logo size={56} />
      <h2>{t('Você ainda não está em nenhuma comunidade')}</h2>
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

      <div className="no-community-saidas">
        <button type="button" className="link" onClick={aoAbrirConfiguracoes}>
          <Settings size={15} aria-hidden="true" /> {t('Configurações da conta')}
        </button>
        <button type="button" className="link" onClick={aoSair}>
          <LogOut size={15} aria-hidden="true" /> {t('Sair da conta')}
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
