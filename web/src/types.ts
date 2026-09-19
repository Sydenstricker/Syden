export interface User {
  id: number;
  username: string;
}

export interface Channel {
  id: number;
  name: string;
  type: 'text' | 'voice';
  position: number;
}

export interface Message {
  id: number;
  channelId: number;
  content: string;
  createdAt: string;
  author: User;
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
