import type { Server as IOServer, Socket } from 'socket.io';
import { verifySession } from './auth.js';
import * as db from './db.js';

/** O que aparece na barra lateral sob cada sala de voz. */
export interface VoiceMember {
  userId: number;
  username: string;
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

function voiceState(): VoiceMember[] {
  return [...voiceMembers.values()].map(({ socketId: _s, voiceSessionId: _v, screenSessionId: _c, ...member }) => member);
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
  for (const member of inChannel) endVoiceSession(member.userId);
  io.emit('voice:state', voiceState());
}

/** Conta excluída: tira a pessoa das salas de voz e derruba as conexões abertas (o app volta ao login). */
export function disconnectUser(io: IOServer, userId: number) {
  const hadVoice = voiceMembers.has(userId);
  endVoiceSession(userId);
  const online = onlineSockets.get(userId);
  onlineSockets.delete(userId);
  for (const socketId of online?.sockets ?? []) io.sockets.sockets.get(socketId)?.disconnect(true);
  if (hadVoice) io.emit('voice:state', voiceState());
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
    socket.emit('voice:state', voiceState());

    socket.on('message:send', (payload: { channelId?: number; content?: string }, ack?: Ack) => {
      const content = String(payload?.content ?? '').trim();
      const channel = db.findChannel(Number(payload?.channelId));
      if (!channel || channel.type !== 'text') return ack?.({ ok: false, error: 'Canal inválido.' });
      if (!content || content.length > 2000) return ack?.({ ok: false, error: 'Mensagem vazia ou longa demais.' });
      io.emit('message:new', db.createMessage(channel.id, user.id, content));
      ack?.({ ok: true });
    });

    socket.on('voice:join', (payload: { channelId?: number }, ack?: Ack) => {
      const channel = db.findChannel(Number(payload?.channelId));
      if (!channel || channel.type !== 'voice') return ack?.({ ok: false, error: 'Sala inválida.' });
      endVoiceSession(user.id); // trocou de sala, ou entrou por outra aba
      voiceMembers.set(user.id, {
        userId: user.id,
        username: user.username,
        channelId: channel.id,
        muted: false,
        deafened: false,
        video: false,
        screen: false,
        socketId: socket.id,
        voiceSessionId: db.startUsageSession('voice', user.id),
        screenSessionId: null,
      });
      io.emit('voice:state', voiceState());
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
      io.emit('voice:state', voiceState());
    });

    const leaveVoice = () => {
      // Só remove se a sessão de voz pertence a esta aba (o usuário pode ter entrado por outra).
      if (voiceMembers.get(user.id)?.socketId === socket.id) {
        endVoiceSession(user.id);
        io.emit('voice:state', voiceState());
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
