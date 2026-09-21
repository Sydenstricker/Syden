import type { Server as IOServer, Socket } from 'socket.io';
import { verifySession } from './auth.js';
import * as db from './db.js';

/** Sala do socket com todo mundo que participa de uma comunidade. */
export const communityRoom = (communityId: number) => `community:${communityId}`;

/** O que aparece na barra lateral sob cada sala de voz. */
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

type Ack = (result: { ok: true } | { ok: false; error: string }) => void;

interface VoiceSession extends VoiceMember {
  socketId: string;
  voiceSessionId: number;
  screenSessionId: number | null;
}

// Estado em memória: suficiente para uma instância. Para rodar várias instâncias do servidor,
// isto passa para o Redis (junto com o @socket.io/redis-adapter).
const voiceMembers = new Map<number, VoiceSession>();
const onlineSockets = new Map<number, { username: string; sockets: Set<string> }>();

const USAGE_HEARTBEAT_MS = 60_000;

/** Quem está em chamada numa comunidade (cada uma só vê a sua). */
function voiceState(communityId: number): VoiceMember[] {
  return [...voiceMembers.values()]
    .filter((member) => member.communityId === communityId)
    .map(({ socketId: _s, voiceSessionId: _v, screenSessionId: _c, ...member }) => member);
}

function broadcastVoice(io: IOServer, communityId: number) {
  io.to(communityRoom(communityId)).emit('voice:state', { communityId, members: voiceState(communityId) });
}

/** Entrou numa comunidade com o app aberto: as abas dela passam a receber os avisos de lá. */
export function joinCommunityRoom(io: IOServer, userId: number, communityId: number) {
  for (const socketId of onlineSockets.get(userId)?.sockets ?? []) {
    io.sockets.sockets.get(socketId)?.join(communityRoom(communityId));
  }
}

export function leaveCommunityRoom(io: IOServer, userId: number, communityId: number) {
  for (const socketId of onlineSockets.get(userId)?.sockets ?? []) {
    io.sockets.sockets.get(socketId)?.leave(communityRoom(communityId));
  }
}

function activeUsageSessionIds(session: VoiceSession) {
  return session.screenSessionId === null ? [session.voiceSessionId] : [session.voiceSessionId, session.screenSessionId];
}

function endVoiceSession(userId: number) {
  const session = voiceMembers.get(userId);
  if (!session) return;
  db.touchUsageSessions(activeUsageSessionIds(session));
  voiceMembers.delete(userId);
}

/** Sala de voz excluída: encerra as sessões de quem estava nela (os apps saem da chamada ao receber channel:deleted). */
export function removeVoiceChannelMembers(io: IOServer, channelId: number) {
  const inChannel = [...voiceMembers.values()].filter((m) => m.channelId === channelId);
  if (inChannel.length === 0) return;
  const communityId = inChannel[0].communityId;
  for (const member of inChannel) endVoiceSession(member.userId);
  broadcastVoice(io, communityId);
}

/** Conta excluída: tira a pessoa das salas de voz e derruba as conexões abertas (o app volta ao login). */
export function disconnectUser(io: IOServer, userId: number) {
  const communityId = voiceMembers.get(userId)?.communityId;
  endVoiceSession(userId);
  const online = onlineSockets.get(userId);
  onlineSockets.delete(userId);
  for (const socketId of online?.sockets ?? []) io.sockets.sockets.get(socketId)?.disconnect(true);
  if (communityId !== undefined) broadcastVoice(io, communityId);
  io.emit('presence', onlineUsers());
}

function onlineUsers(): db.UserRef[] {
  return [...onlineSockets.entries()].map(([id, { username }]) => ({ id, username }));
}

export function setupRealtime(io: IOServer) {
  io.use(async (socket, next) => {
    const userId = await verifySession(socket.handshake.auth?.token);
    const user = userId === null ? undefined : db.findUserById(userId);
    if (!user) return next(new Error('unauthorized'));
    socket.data.user = user;
    next();
  });

  setInterval(() => {
    db.touchUsageSessions([...voiceMembers.values()].flatMap(activeUsageSessionIds));
  }, USAGE_HEARTBEAT_MS).unref();

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as db.User;

    const online = onlineSockets.get(user.id) ?? { username: user.username, sockets: new Set<string>() };
    online.sockets.add(socket.id);
    onlineSockets.set(user.id, online);
    io.emit('presence', onlineUsers());

    // Só chegam a esta aba os avisos das comunidades de que a pessoa participa.
    const myCommunities = db.communityIdsForUser(user.id);
    for (const id of myCommunities) {
      socket.join(communityRoom(id));
      socket.emit('voice:state', { communityId: id, members: voiceState(id) });
    }

    socket.on('message:send', (payload: { channelId?: number; content?: string }, ack?: Ack) => {
      const content = String(payload?.content ?? '').trim();
      const channel = db.findChannel(Number(payload?.channelId));
      if (!channel || channel.type !== 'text') return ack?.({ ok: false, error: 'Canal inválido.' });
      if (!db.memberRole(channel.communityId, user.id)) return ack?.({ ok: false, error: 'Você não participa desta comunidade.' });
      if (!content || content.length > 2000) return ack?.({ ok: false, error: 'Mensagem vazia ou longa demais.' });
      io.to(communityRoom(channel.communityId)).emit('message:new', {
        ...db.createMessage(channel.id, user.id, content),
        communityId: channel.communityId,
      });
      ack?.({ ok: true });
    });

    socket.on('voice:join', (payload: { channelId?: number }, ack?: Ack) => {
      const channel = db.findChannel(Number(payload?.channelId));
      if (!channel || channel.type !== 'voice') return ack?.({ ok: false, error: 'Sala inválida.' });
      if (!db.memberRole(channel.communityId, user.id)) return ack?.({ ok: false, error: 'Você não participa desta comunidade.' });
      const previous = voiceMembers.get(user.id)?.communityId;
      endVoiceSession(user.id); // trocou de sala, ou entrou por outra aba
      voiceMembers.set(user.id, {
        userId: user.id,
        username: user.username,
        communityId: channel.communityId,
        channelId: channel.id,
        muted: false,
        deafened: false,
        video: false,
        screen: false,
        socketId: socket.id,
        voiceSessionId: db.startUsageSession('voice', user.id),
        screenSessionId: null,
      });
      if (previous !== undefined && previous !== channel.communityId) broadcastVoice(io, previous);
      broadcastVoice(io, channel.communityId);
      ack?.({ ok: true });
    });

    socket.on('voice:update', (patch: Partial<Pick<VoiceMember, 'muted' | 'deafened' | 'video' | 'screen'>>) => {
      const member = voiceMembers.get(user.id);
      if (!member || member.socketId !== socket.id) return;
      for (const key of ['muted', 'deafened', 'video', 'screen'] as const) {
        if (typeof patch?.[key] === 'boolean') member[key] = patch[key];
      }
      if (member.screen && member.screenSessionId === null) {
        member.screenSessionId = db.startUsageSession('screen', user.id);
      } else if (!member.screen && member.screenSessionId !== null) {
        db.touchUsageSessions([member.screenSessionId]);
        member.screenSessionId = null;
      }
      broadcastVoice(io, member.communityId);
    });

    const leaveVoice = () => {
      // Só remove se a sessão de voz pertence a esta aba (o usuário pode ter entrado por outra).
      const member = voiceMembers.get(user.id);
      if (member?.socketId === socket.id) {
        endVoiceSession(user.id);
        broadcastVoice(io, member.communityId);
      }
    };
    socket.on('voice:leave', leaveVoice);

    socket.on('disconnect', () => {
      leaveVoice();
      online.sockets.delete(socket.id);
      if (online.sockets.size === 0) onlineSockets.delete(user.id);
      io.emit('presence', onlineUsers());
    });
  });
}
