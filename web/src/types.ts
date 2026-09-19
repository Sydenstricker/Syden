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

export interface Emoji {
  id: number;
  name: string;
  createdBy: number | null;
}

export interface Sound {
  id: number;
  name: string;
  icon: string;
  createdBy: number | null;
}

export interface Channel {
  id: number;
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
  channelId: number;
  muted: boolean;
  deafened: boolean;
  video: boolean;
  screen: boolean;
}

export type Traffic =
  | { status: 'unavailable'; message: string }
  | { status: 'ok'; outgoingBytes: number; includedBytes: number; projectedBytes: number | null; measuringSince: string };

export interface UsageSummary {
  monthStart: string;
  monthProgress: number;
  traffic: Traffic;
  users: { userId: number; username: string; voiceSeconds: number; screenSeconds: number }[];
}
