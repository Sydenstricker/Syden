import { mediaUrl } from './api';
import { useDirectory } from './directory';
import type { PresenceStatus } from './types';

const AVATAR_COLORS = ['#5865f2', '#3ba55d', '#faa61a', '#ed4245', '#eb459e', '#00a8fc', '#9b59b6', '#e67e22'];

/** Mesmas cores do Discord: verde online, amarelo ausente, vermelho não perturbe, cinza invisível/offline. */
const STATUS_COLORS: Record<PresenceStatus, string> = {
  online: 'var(--green)',
  ausente: '#f0b232',
  ocupado: 'var(--red)',
  invisivel: '#80848e',
};

/** Foto de perfil quando a pessoa enviou uma; senão, a inicial do nome num círculo colorido. */
export function Avatar({
  name,
  userId,
  online,
  status,
  speaking,
  size = 32,
}: {
  name: string;
  userId?: number;
  online?: boolean;
  /** Bolinha colorida pelo status (online/ausente/ocupado/invisível) em vez do verde padrão. */
  status?: PresenceStatus;
  speaking?: boolean;
  size?: number;
}) {
  const { members } = useDirectory();
  const version = userId === undefined ? null : (members.get(userId)?.avatarVersion ?? null);
  // Hash que espalha bem nomes parecidos (ana1, ana2...) entre as cores; somar os códigos repetia muito.
  const hash = [...name].reduce((acc, ch) => (Math.imul(acc, 31) + ch.charCodeAt(0)) >>> 0, 7);

  return (
    <span
      className={`avatar${speaking ? ' speaking' : ''}`}
      style={{
        width: size,
        height: size,
        background: version === null ? AVATAR_COLORS[hash % AVATAR_COLORS.length] : undefined,
        fontSize: size * 0.42,
      }}
    >
      {version === null ? name.slice(0, 1).toUpperCase() : <img src={mediaUrl.avatar(userId!, version)} alt="" draggable={false} />}
      {online && <span className="avatar-status" style={{ background: STATUS_COLORS[status ?? 'online'] }} />}
    </span>
  );
}
