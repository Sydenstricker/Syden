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
 * O coelho em cada status — o mascote, e não o D4 (decisão de 05/10/2026). Cada status é um SVG
 * exportado do estúdio (animacaoSVG/animacoes_d4.html, grupo "O avatar"), recortado perto da cabeça:
 * online de orelhas em pé, ausente dormindo com os "z", ocupado no notebook, offline descansando com
 * as orelhas caídas. A cor da faixa da orelha reforça, mas a POSTURA é que diz o status — dá para ler
 * sem distinguir verde de vermelho.
 *
 * 'neutro' é quando não se sabe o status (numa mensagem, numa chamada): olhos abertos e a faixa rosa,
 * sem afirmar "online" para quem pode não estar.
 */
const POSE: Record<PresenceStatus, string> = {
  online: 'online',
  ausente: 'ausente',
  ocupado: 'ocupado',
  invisivel: 'offline',
};

function AvatarCoelho({ pose }: { pose: string }) {
  return (
    <img
      className="avatar-coelho"
      data-status={pose}
      src={`${import.meta.env.BASE_URL}mascote/avatar-${pose}.svg`}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
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
        <AvatarCoelho pose={offline ? 'offline' : online ? POSE[status ?? 'online'] : 'neutro'} />
      ) : (
        <img src={mediaUrl.avatar(userId!, version)} alt="" draggable={false} />
      )}
      {/* Com foto, o status vai na bolinha; no coelho, a pose dele já diz. */}
      {online && version !== null && <span className="avatar-status" style={{ background: STATUS_COLORS[status ?? 'online'] }} />}
    </span>
  );
}
