import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import * as db from './db.js';
import { parseMedia } from './media.js';
import { requireUser } from './routes.js';

const KB = 1024;
const LIMITS = { avatar: 2048 * KB, emoji: 512 * KB, sound: 1024 * KB }; // avatar maior por causa de GIF animado
const UPLOAD_BODY_LIMIT = 3 * 1024 * KB; // base64 ocupa ~33% a mais que o arquivo

function sendFile(reply: FastifyReply, file: { mime: string; data: Uint8Array } | undefined) {
  if (!file) return reply.code(404).send({ error: 'Arquivo não encontrado.' });
  // A URL muda quando o arquivo muda (versão/id), então o navegador pode guardar para sempre.
  return reply
    .header('content-type', file.mime)
    .header('cache-control', 'public, max-age=31536000, immutable')
    .header('x-content-type-options', 'nosniff')
    .send(Buffer.from(file.data));
}

/** "Coração Feliz" → "coracao_feliz", o formato usado em :nome: nas mensagens. */
function emojiName(raw: unknown): string | null {
  const name = String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return name.length >= 2 && name.length <= 32 ? name : null;
}

const canDelete = (user: db.User, item: { createdBy: number | null }) => user.isAdmin || item.createdBy === user.id;

export function registerMediaRoutes(app: FastifyInstance, io: IOServer) {
  // Imagens e áudios são públicos: <img> e <audio> não conseguem mandar o token de login.
  app.get<{ Params: { id: string } }>('/api/users/:id/avatar', async (request, reply) =>
    sendFile(reply, db.findAvatar(Number(request.params.id))),
  );
  app.get<{ Params: { id: string } }>('/api/emojis/:id/image', async (request, reply) =>
    sendFile(reply, db.findEmojiFile(Number(request.params.id))),
  );
  app.get<{ Params: { id: string } }>('/api/sounds/:id/audio', async (request, reply) =>
    sendFile(reply, db.findSoundFile(Number(request.params.id))),
  );

  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    authed.get('/api/users', async () => db.listPublicUsers());

    // ---------- Avatar ----------

    authed.put<{ Body: { image?: string } }>('/api/me/avatar', { bodyLimit: UPLOAD_BODY_LIMIT }, async (request, reply) => {
      const media = parseMedia(request.body?.image, 'image', LIMITS.avatar);
      if (typeof media === 'string') return reply.code(400).send({ error: media });
      const user = db.setAvatar(request.user.id, media);
      io.emit('user:updated', { id: user.id, username: user.username, avatarVersion: user.avatarVersion });
      return user;
    });

    authed.delete('/api/me/avatar', async (request) => {
      const user = db.setAvatar(request.user.id, null);
      io.emit('user:updated', { id: user.id, username: user.username, avatarVersion: null });
      return user;
    });

    // ---------- Emojis do servidor ----------

    authed.get('/api/emojis', async () => db.listEmojis());

    authed.post<{ Body: { name?: string; image?: string } }>('/api/emojis', { bodyLimit: UPLOAD_BODY_LIMIT }, async (request, reply) => {
      const name = emojiName(request.body?.name);
      if (!name) return reply.code(400).send({ error: 'O nome do emoji deve ter de 2 a 32 letras, números ou _.' });
      if (db.emojiNameTaken(name)) return reply.code(409).send({ error: `Já existe um emoji chamado :${name}:.` });
      const media = parseMedia(request.body?.image, 'image', LIMITS.emoji);
      if (typeof media === 'string') return reply.code(400).send({ error: media });
      const emoji = db.createEmoji(name, media.mime, media.data, request.user.id);
      io.emit('emoji:created', emoji);
      return emoji;
    });

    authed.delete<{ Params: { id: string } }>('/api/emojis/:id', async (request, reply) => {
      const emoji = db.findEmoji(Number(request.params.id));
      if (!emoji) return reply.code(404).send({ error: 'Emoji não encontrado.' });
      if (!canDelete(request.user, emoji)) {
        return reply.code(403).send({ error: 'Só quem enviou o emoji ou o administrador pode excluí-lo.' });
      }
      db.deleteEmoji(emoji.id);
      io.emit('emoji:deleted', { id: emoji.id });
      return { ok: true };
    });

    // ---------- Soundboard ----------

    authed.get('/api/sounds', async () => db.listSounds());

    authed.post<{ Body: { name?: string; icon?: string; audio?: string } }>(
      '/api/sounds',
      { bodyLimit: UPLOAD_BODY_LIMIT },
      async (request, reply) => {
        const name = String(request.body?.name ?? '').trim();
        if (name.length < 1 || name.length > 32) return reply.code(400).send({ error: 'O nome do som deve ter de 1 a 32 caracteres.' });
        const icon = String(request.body?.icon ?? '').trim() || '🔊';
        if ([...icon].length > 4) return reply.code(400).send({ error: 'Use um único emoji como ícone.' });
        const media = parseMedia(request.body?.audio, 'audio', LIMITS.sound);
        if (typeof media === 'string') return reply.code(400).send({ error: media });
        const sound = db.createSound(name, icon, media.mime, media.data, request.user.id);
        io.emit('sound:created', sound);
        return sound;
      },
    );

    authed.delete<{ Params: { id: string } }>('/api/sounds/:id', async (request, reply) => {
      const sound = db.findSound(Number(request.params.id));
      if (!sound) return reply.code(404).send({ error: 'Som não encontrado.' });
      if (!canDelete(request.user, sound)) {
        return reply.code(403).send({ error: 'Só quem enviou o som ou o administrador pode excluí-lo.' });
      }
      db.deleteSound(sound.id);
      io.emit('sound:deleted', { id: sound.id });
      return { ok: true };
    });
  });
}
