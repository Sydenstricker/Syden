import { mediaUrl } from './api';
import { useDirectory } from './directory';

const AVATAR_COLORS = ['#5865f2', '#3ba55d', '#faa61a', '#ed4245', '#eb459e', '#00a8fc', '#9b59b6', '#e67e22'];

/** Foto de perfil quando a pessoa enviou uma; senão, a inicial do nome num círculo colorido. */
export function Avatar({
  name,
  userId,
  online,
  speaking,
  size = 32,
}: {
  name: string;
  userId?: number;
  online?: boolean;
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
      {online && <span className="avatar-status" />}
    </span>
  );
}
