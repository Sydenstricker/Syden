import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AccessToken } from 'livekit-server-sdk';
import type { Server as IOServer } from 'socket.io';
import { hashPassword, signSession, verifyPassword, verifySession } from './auth.js';
import { config } from './config.js';
import * as db from './db.js';

const USERNAME_RE = /^[\p{L}\p{N}_.-]{2,32}$/u;

export function voiceRoomName(channelId: number) {
  return `channel-${channelId}`;
}

declare module 'fastify' {
  interface FastifyRequest {
    user: db.User;
  }
}

async function requireUser(request: FastifyRequest, reply: FastifyReply) {
  const token = request.headers.authorization?.replace(/^Bearer /, '');
  const userId = await verifySession(token);
  const user = userId === null ? undefined : db.findUserById(userId);
  if (!user) return reply.code(401).send({ error: 'Sessão inválida. Entre novamente.' });
  request.user = user;
}

export function registerRoutes(app: FastifyInstance, io: IOServer) {
  app.decorateRequest('user', null as unknown as db.User);

  app.get('/api/health', async () => ({ ok: true }));

  app.post<{ Body: { username?: string; password?: string; inviteCode?: string } }>(
    '/api/auth/register',
    async (request, reply) => {
      const username = request.body?.username?.trim() ?? '';
      const password = request.body?.password ?? '';
      if (config.inviteCode && request.body?.inviteCode !== config.inviteCode) {
        return reply.code(403).send({ error: 'Código de convite inválido.' });
      }
      if (!USERNAME_RE.test(username)) {
        return reply.code(400).send({ error: 'Nome de usuário deve ter 2 a 32 letras, números, _ . ou -.' });
      }
      if (password.length < 6) {
        return reply.code(400).send({ error: 'A senha precisa ter pelo menos 6 caracteres.' });
      }
      if (db.findUserByName(username)) {
        return reply.code(409).send({ error: 'Esse nome de usuário já está em uso.' });
      }
      const user = db.createUser(username, await hashPassword(password));
      return { token: await signSession(user), user };
    },
  );

  app.post<{ Body: { username?: string; password?: string } }>('/api/auth/login', async (request, reply) => {
    const found = db.findUserByName(request.body?.username?.trim() ?? '');
    if (!found || !(await verifyPassword(request.body?.password ?? '', found.passwordHash))) {
      return reply.code(401).send({ error: 'Usuário ou senha incorretos.' });
    }
    const user = { id: found.id, username: found.username };
    return { token: await signSession(user), user };
  });

  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    authed.get('/api/me', async (request) => request.user);

    authed.get('/api/channels', async () => db.listChannels());

    authed.post<{ Body: { name?: string; type?: db.ChannelType } }>('/api/channels', async (request, reply) => {
      const name = request.body?.name?.trim() ?? '';
      const type = request.body?.type;
      if (name.length < 1 || name.length > 50) {
        return reply.code(400).send({ error: 'O nome do canal deve ter de 1 a 50 caracteres.' });
      }
      if (type !== 'text' && type !== 'voice') {
        return reply.code(400).send({ error: 'Tipo de canal inválido.' });
      }
      const channel = db.createChannel(type === 'text' ? name.toLowerCase().replace(/\s+/g, '-') : name, type);
      io.emit('channel:created', channel);
      return channel;
    });

    authed.get<{ Params: { id: string }; Querystring: { before?: string } }>(
      '/api/channels/:id/messages',
      async (request, reply) => {
        const channel = db.findChannel(Number(request.params.id));
        if (!channel || channel.type !== 'text') return reply.code(404).send({ error: 'Canal não encontrado.' });
        const before = request.query.before ? Number(request.query.before) : undefined;
        return db.listMessages(channel.id, before);
      },
    );

    // Emite o token que autoriza o navegador a entrar na sala do LiveKit correspondente ao canal de voz.
    authed.post<{ Params: { id: string } }>('/api/channels/:id/voice-token', async (request, reply) => {
      const channel = db.findChannel(Number(request.params.id));
      if (!channel || channel.type !== 'voice') return reply.code(404).send({ error: 'Sala de voz não encontrada.' });

      const token = new AccessToken(config.livekit.apiKey, config.livekit.apiSecret, {
        identity: String(request.user.id),
        name: request.user.username,
        ttl: '6h',
      });
      token.addGrant({
        room: voiceRoomName(channel.id),
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
      });
      return { url: config.livekit.url, token: await token.toJwt() };
    });
  });
}
