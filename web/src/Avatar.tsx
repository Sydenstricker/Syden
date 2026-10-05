import { mediaUrl } from './api';
import { useDirectory } from './directory';
import type { PresenceStatus } from './types';

/** Mesmas cores do Discord: verde online, amarelo ausente, vermelho não perturbe, cinza invisível/offline. */
const STATUS_COLORS: Record<PresenceStatus, string> = {
  online: 'var(--green)',
  ausente: '#f0b232',
  ocupado: 'var(--red)',
  invisivel: '#80848e',
};

/**
 * Como as orelhas do coelho ficam em cada status. A POSTURA é a pista principal e a cor só reforça —
 * dá para ler o status sem distinguir verde de vermelho. 'marca' é quando não se sabe o status (numa
 * mensagem, numa chamada): faixas âmbar, como no ícone.
 */
const ORELHAS: Record<PresenceStatus, string> = {
  online: 'online',
  ausente: 'away',
  ocupado: 'dnd',
  invisivel: 'offline',
};

/**
 * O coelho do Syden (D4) como avatar padrão, para quem não enviou foto. As orelhas contam o status:
 * em pé online, uma caída ausente, as duas deitadas em não perturbe, recolhidas e cinza offline. A
 * mudança é animada pelo CSS (.avatar-coelho, em styles.css) a partir do data-status.
 *
 * O fundo é um círculo, e não o quadrado arredondado do ícone, porque todo avatar do Syden é redondo.
 */
function AvatarCoelho({ estado }: { estado: string }) {
  return (
    <svg className="avatar-coelho" data-status={estado} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <circle className="ac-fundo" cx="50" cy="50" r="50" />
      <g className="ac-orelha ac-orelha-e">
        <ellipse className="ac-orelha-fora" cx="38" cy="30" rx="10" ry="18" transform="rotate(-12 38 30)" />
        <ellipse className="ac-orelha-dentro" cx="38" cy="31" rx="3.6" ry="11" transform="rotate(-12 38 30)" />
      </g>
      <g className="ac-orelha ac-orelha-d">
        <ellipse className="ac-orelha-fora" cx="62" cy="30" rx="10" ry="18" transform="rotate(12 62 30)" />
        <ellipse className="ac-orelha-dentro" cx="62" cy="31" rx="3.6" ry="11" transform="rotate(12 62 30)" />
      </g>
      <path
        className="ac-balao"
        d="M32 38 H68 A16 16 0 0 1 84 54 V62 A16 16 0 0 1 68 78 H42 L22 88 L28 78 H32 A16 16 0 0 1 16 62 V54 A16 16 0 0 1 32 38 Z"
        strokeWidth="6"
        strokeLinejoin="round"
      />
      <g className="ac-rosto ac-pontos">
        <circle cx="36" cy="58" r="4.5" />
        <circle cx="50" cy="58" r="4.5" />
        <circle cx="64" cy="58" r="4.5" />
      </g>
      <path className="ac-rosto ac-sono" d="M33 59 Q38 63 43 59 M57 59 Q62 63 67 59" strokeWidth="4.5" strokeLinecap="round" />
      <rect className="ac-rosto ac-barra" x="35" y="55" width="30" height="6" rx="3" />
    </svg>
  );
}

/**
 * Foto de perfil quando a pessoa enviou uma; senão, o coelho do Syden com as orelhas no status dela.
 * A foto substitui o coelho por escolha de quem a envia (Configurações → Minha conta).
 */
export function Avatar({
  userId,
  online,
  offline,
  status,
  speaking,
  size = 32,
}: {
  /** Não aparece mais no desenho (era a inicial, antes do coelho); fica para quem chama dizer de quem é. */
  name: string;
  userId?: number;
  online?: boolean;
  /** Bolinha colorida pelo status (online/ausente/ocupado/invisível) em vez do verde padrão. */
  status?: PresenceStatus;
  /** Sabidamente desconectada (o grupo "Offline" da lista de membros): o coelho recolhe as orelhas. */
  offline?: boolean;
  speaking?: boolean;
  size?: number;
}) {
  const { members } = useDirectory();
  const membro = userId === undefined ? undefined : members.get(userId);
  const version = membro?.avatarVersion ?? null;
  // A moldura vem do DIRETÓRIO, e não de quem chamou: assim ela aparece em toda parte onde já se
  // desenha um avatar (lista de membros, chamada, mensagem) sem passar a escolha de mão em mão. E
  // muda sozinha quando a pessoa troca, pelo mesmo "user:updated" que já atualiza o nome.
  const moldura = membro?.moldura ?? undefined;

  return (
    <span
      className={`avatar${speaking ? ' speaking' : ''}`}
      data-moldura={moldura || undefined}
      style={{
        width: size,
        height: size,
      }}
    >
      {version === null ? (
        <AvatarCoelho estado={offline ? 'offline' : online ? ORELHAS[status ?? 'online'] : 'marca'} />
      ) : (
        <img src={mediaUrl.avatar(userId!, version)} alt="" draggable={false} />
      )}
      {/* Com foto, o status vai na bolinha; no coelho, as próprias orelhas já dizem. */}
      {online && version !== null && <span className="avatar-status" style={{ background: STATUS_COLORS[status ?? 'online'] }} />}
    </span>
  );
}
