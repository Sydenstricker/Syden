export interface User {
  id: number;
  username: string;
  isAdmin: boolean;
  /** O dono do servidor é quem dá e tira o cargo de administrador. */
  isOwner: boolean;
  avatarVersion: number | null;
}

export type UserRef = Pick<User, 'id' | 'username'>;

export type PublicUser = Pick<User, 'id' | 'username' | 'avatarVersion' | 'isAdmin' | 'isOwner'>;

/** Cargo dentro de uma comunidade. Quem criou é "owner"; "admin" modera; "member" participa. */
export type Role = 'owner' | 'admin' | 'member';

export type CommunityMember = PublicUser & { role: Role };

/** Uma comunidade (o "servidor" do Discord) do jeito que quem participa dela enxerga. */
export interface Community {
  id: number;
  name: string;
  createdBy: number | null;
  /** Muda a cada troca de imagem; entra na URL para o navegador buscar a nova. null = sem imagem. */
  iconVersion: number | null;
  role: Role;
  memberCount: number;
  /** Só quem administra recebe o código; para os outros vem null. */
  inviteCode: string | null;
}

export interface Emoji {
  id: number;
  communityId: number;
  name: string;
  createdBy: number | null;
}

export interface Sound {
  id: number;
  communityId: number;
  name: string;
  icon: string;
  createdBy: number | null;
}

export interface Channel {
  id: number;
  communityId: number;
  name: string;
  type: 'text' | 'voice';
  position: number;
  createdBy: number | null;
}

export interface Message {
  id: number;
  channelId: number;
  content: string;
  createdAt: string;
  author: UserRef;
}

export interface VoiceMember {
  userId: number;
  username: string;
  communityId: number;
  channelId: number;
  muted: boolean;
  deafened: boolean;
  video: boolean;
  screen: boolean;
}

export type Traffic =
  | { status: 'unavailable'; message: string }
  | { status: 'ok'; outgoingBytes: number; includedBytes: number; projectedBytes: number | null; measuringSince: string };

export interface HealthSample {
  at: string;
  /** Fração de 0 a 1. */
  cpu: number;
  memory: number;
  diskFree: number | null;
  diskTotal: number | null;
  livekitOk: boolean;
  errors: number;
  /** Velocidade de rede no intervalo, em bits por segundo. */
  networkIn: number | null;
  networkOut: number | null;
}

export interface HealthEvent {
  at: string;
  kind: string;
  detail: string;
}

export interface HealthReport {
  startedAt: string;
  uptimeSeconds: number;
  livekitOk: boolean | null;
  cpu: number;
  memory: number;
  diskFree: number | null;
  diskTotal: number | null;
  errorsNow: number;
  errors24h: number;
  samples: HealthSample[];
  events: HealthEvent[];
}

export interface UsageSummary {
  monthStart: string;
  monthProgress: number;
  traffic: Traffic;
  users: { userId: number; username: string; voiceSeconds: number; screenSeconds: number }[];
}
