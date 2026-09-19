import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AccessToken } from 'livekit-server-sdk';
import type { Server as IOServer } from 'socket.io';
import { hashPassword, signSession, verifyPassword, verifySession } from './auth.js';
import { config } from './config.js';
import * as db from './db.js';
import { disconnectUser, removeVoiceChannelMembers } from './realtime.js';
import { usageSummary } from './usage.js';

const USERNAME_RE = /^[\p{L}\p{N}_.-]{2,32}$/u;

export function voiceRoomName(channelId: number) {
  return `channel-${channelId}`;
}

/** Canais de texto seguem o padrão do Discord: minúsculas e hífens no lugar de espaços. */
function channelName(raw: string | undefined, type: db.ChannelType): string | null {
  const name = raw?.trim() ?? '';
  if (name.length < 1 || name.length > 50) return null;
  return type === 'text' ? name.toLowerCase().replace(/\s+/g, '-') : name;
}

function canManage(user: db.User, channel: db.Channel) {
  return user.isAdmin || channel.createdBy === user.id;
}

const forbiddenMessage = 'Só quem criou o canal ou o administrador pode alterá-lo.';

function removeAccount(io: IOServer, userId: number) {
  db.deleteAccount(userId);
  disconnectUser(io, userId);
  // Os apps tiram a pessoa da lista, apagam as mensagens dela da tela e atualizam quem é administrador.
  io.emit('user:deleted', { id: userId, users: db.listPublicUsers() });
}

declare module 'fastify' {
  interface FastifyRequest {
    user: db.User;
  }
}

export async function requireUser(request: FastifyRequest, reply: FastifyReply) {
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
      io.emit('user:updated', user); // entra na lista de membros de quem já está com o app aberto
      return { token: await signSession(user), user };
    },
  );

  app.post<{ Body: { username?: string; password?: string } }>('/api/auth/login', async (request, reply) => {
    const found = db.findUserByName(request.body?.username?.trim() ?? '');
    if (!found || !(await verifyPassword(request.body?.password ?? '', found.passwordHash))) {
      return reply.code(401).send({ error: 'Usuário ou senha incorretos.' });
    }
    const { passwordHash: _, ...user } = found;
    return { token: await signSession(user), user };
  });

  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    authed.get('/api/me', async (request) => request.user);

    authed.post<{ Body: { currentPassword?: string; newPassword?: string } }>(
      '/api/me/password',
      async (request, reply) => {
        const newPassword = request.body?.newPassword ?? '';
        if (!(await verifyPassword(request.body?.currentPassword ?? '', db.findPasswordHash(request.user.id)))) {
          return reply.code(400).send({ error: 'A senha atual está incorreta.' });
        }
        if (newPassword.length < 6) {
          return reply.code(400).send({ error: 'A nova senha precisa ter pelo menos 6 caracteres.' });
        }
        db.updatePassword(request.user.id, await hashPassword(newPassword));
        return { ok: true };
      },
    );

    // Excluir a própria conta exige a senha, para ninguém fazer isso por engano (ou com o PC de outra pessoa).
    authed.post<{ Body: { password?: string } }>('/api/me/delete', async (request, reply) => {
      if (!(await verifyPassword(request.body?.password ?? '', db.findPasswordHash(request.user.id)))) {
        return reply.code(400).send({ error: 'Senha incorreta.' });
      }
      removeAccount(io, request.user.id);
      return { ok: true };
    });

    authed.delete<{ Params: { id: string } }>('/api/users/:id', async (request, reply) => {
      if (!request.user.isAdmin) return reply.code(403).send({ error: 'Só o administrador pode remover membros.' });
      const target = db.findUserById(Number(request.params.id));
      if (!target) return reply.code(404).send({ error: 'Membro não encontrado.' });
      if (target.id === request.user.id) {
        return reply.code(400).send({ error: 'Para sair, use "Excluir minha conta" em Minha conta.' });
      }
      // Administradores removem membros comuns; outro administrador, só o dono. E o dono ninguém remove.
      if (target.isOwner) return reply.code(403).send({ error: 'O dono do servidor não pode ser removido.' });
      if (target.isAdmin && !request.user.isOwner) {
        return reply.code(403).send({ error: 'Só o dono do servidor pode remover um administrador.' });
      }
      removeAccount(io, target.id);
      return { ok: true };
    });

    // Cargo de administrador: só o dono dá e tira, e o dele não sai.
    authed.put<{ Params: { id: string }; Body: { isAdmin?: boolean } }>('/api/users/:id/admin', async (request, reply) => {
      if (!request.user.isOwner) {
        return reply.code(403).send({ error: 'Só o dono do servidor pode dar ou tirar o cargo de administrador.' });
      }
      if (typeof request.body?.isAdmin !== 'boolean') return reply.code(400).send({ error: 'Pedido inválido.' });
      const target = db.findUserById(Number(request.params.id));
      if (!target) return reply.code(404).send({ error: 'Membro não encontrado.' });
      if (target.isOwner) return reply.code(400).send({ error: 'O dono do servidor é sempre administrador.' });
      const user = db.setAdmin(target.id, request.body.isAdmin)!;
      io.emit('user:updated', user);
      return user;
    });

    authed.delete<{ Params: { id: string } }>('/api/messages/:id', async (request, reply) => {
      const message = db.findMessage(Number(request.params.id));
      if (!message) return reply.code(404).send({ error: 'Mensagem não encontrada.' });
      if (message.userId !== request.user.id && !request.user.isAdmin) {
        return reply.code(403).send({ error: 'Só o autor ou o administrador pode apagar a mensagem.' });
      }
      db.deleteMessage(message.id);
      io.emit('message:deleted', { id: message.id, channelId: message.channelId });
      return { ok: true };
    });

    authed.get('/api/channels', async () => db.listChannels());

    authed.get('/api/usage', async () => usageSummary());

    authed.post<{ Body: { name?: string; type?: db.ChannelType } }>('/api/channels', async (request, reply) => {
      const type = request.body?.type;
      if (type !== 'text' && type !== 'voice') {
        return reply.code(400).send({ error: 'Tipo de canal inválido.' });
      }
      const name = channelName(request.body?.name, type);
      if (!name) return reply.code(400).send({ error: 'O nome do canal deve ter de 1 a 50 caracteres.' });
      const channel = db.createChannel(name, type, request.user.id);
      io.emit('channel:created', channel);
      return channel;
    });

    authed.patch<{ Params: { id: string }; Body: { name?: string } }>('/api/channels/:id', async (request, reply) => {
      const channel = db.findChannel(Number(request.params.id));
      if (!channel) return reply.code(404).send({ error: 'Canal não encontrado.' });
      if (!canManage(request.user, channel)) return reply.code(403).send({ error: forbiddenMessage });
      const name = channelName(request.body?.name, channel.type);
      if (!name) return reply.code(400).send({ error: 'O nome do canal deve ter de 1 a 50 caracteres.' });
      const updated = db.renameChannel(channel.id, name);
      io.emit('channel:updated', updated);
      return updated;
    });

    authed.delete<{ Params: { id: string } }>('/api/channels/:id', async (request, reply) => {
      const channel = db.findChannel(Number(request.params.id));
      if (!channel) return reply.code(404).send({ error: 'Canal não encontrado.' });
      if (!canManage(request.user, channel)) return reply.code(403).send({ error: forbiddenMessage });
      if (channel.type === 'text' && db.countChannels('text') === 1) {
        return reply.code(400).send({ error: 'Precisa existir pelo menos um canal de texto.' });
      }
      db.deleteChannel(channel.id);
      removeVoiceChannelMembers(io, channel.id);
      io.emit('channel:deleted', { id: channel.id });
      return { ok: true };
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
