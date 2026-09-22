import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import * as db from './db.js';
import { restorePack } from './expressions.js';
import { parseMedia } from './media.js';
import { communityRoom } from './realtime.js';
import { manages, requireUser, roleIn } from './routes.js';

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

export function registerMediaRoutes(app: FastifyInstance, io: IOServer) {
  // Imagens e áudios são públicos: <img> e <audio> não conseguem mandar o token de login.
  app.get<{ Params: { id: string } }>('/api/users/:id/avatar', async (request, reply) =>
    sendFile(reply, db.findAvatar(Number(request.params.id))),
  );
  app.get<{ Params: { id: string } }>('/api/communities/:id/icon', async (request, reply) =>
    sendFile(reply, db.findCommunityIcon(Number(request.params.id))),
  );
  app.get<{ Params: { id: string } }>('/api/emojis/:id/image', async (request, reply) =>
    sendFile(reply, db.findEmojiFile(Number(request.params.id))),
  );
  app.get<{ Params: { id: string } }>('/api/sounds/:id/audio', async (request, reply) =>
    sendFile(reply, db.findSoundFile(Number(request.params.id))),
  );

  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    /** Confere que a pessoa participa da comunidade da URL e devolve o cargo dela. */
    const requireRole = (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const communityId = Number(request.params.id);
      const role = db.findCommunity(communityId) && roleIn(request.user, communityId);
      if (!role) {
        reply.code(403).send({ error: 'Você não participa desta comunidade.' });
        return null;
      }
      return { communityId, role };
    };

    /** Quem enviou o arquivo, ou quem administra a comunidade dele. */
    const canDelete = (user: db.User, item: { communityId: number | null; createdBy: number | null }) =>
      item.createdBy === user.id || (item.communityId !== null && manages(roleIn(user, item.communityId)));

    // ---------- Avatar ----------

    authed.put<{ Body: { image?: string } }>('/api/me/avatar', { bodyLimit: UPLOAD_BODY_LIMIT }, async (request, reply) => {
      const media = parseMedia(request.body?.image, 'image', LIMITS.avatar);
      if (typeof media === 'string') return reply.code(400).send({ error: media });
      const user = db.setAvatar(request.user.id, media);
      io.emit('user:updated', user);
      return user;
    });

    authed.delete('/api/me/avatar', async (request) => {
      const user = db.setAvatar(request.user.id, null);
      io.emit('user:updated', user);
      return user;
    });

    // ---------- Imagem da comunidade ----------

    authed.put<{ Params: { id: string }; Body: { image?: string } }>(
      '/api/communities/:id/icon',
      { bodyLimit: UPLOAD_BODY_LIMIT },
      async (request, reply) => {
        const access = requireRole(request, reply);
        if (!access) return reply;
        if (!manages(access.role)) return reply.code(403).send({ error: 'Só quem administra a comunidade pode trocar a imagem.' });
        const media = parseMedia(request.body?.image, 'image', LIMITS.avatar);
        if (typeof media === 'string') return reply.code(400).send({ error: media });
        const community = db.setCommunityIcon(access.communityId, media);
        io.to(communityRoom(community.id)).emit('community:updated', community);
        return community;
      },
    );

    authed.delete<{ Params: { id: string } }>('/api/communities/:id/icon', async (request, reply) => {
      const access = requireRole(request, reply);
      if (!access) return reply;
      if (!manages(access.role)) return reply.code(403).send({ error: 'Só quem administra a comunidade pode tirar a imagem.' });
      const community = db.setCommunityIcon(access.communityId, null);
      io.to(communityRoom(community.id)).emit('community:updated', community);
      return community;
    });

    /** Repõe os emojis e sons de demonstração que foram apagados (nada é duplicado). */
    authed.post<{ Params: { id: string } }>('/api/communities/:id/restore-pack', async (request, reply) => {
      const access = requireRole(request, reply);
      if (!access) return reply;
      if (!manages(access.role)) return reply.code(403).send({ error: 'Só quem administra a comunidade pode restaurar o pacote.' });
      const added = restorePack(access.communityId);
      for (const emoji of db.listEmojis(access.communityId)) io.to(communityRoom(access.communityId)).emit('emoji:created', emoji);
      for (const sound of db.listSounds(access.communityId)) io.to(communityRoom(access.communityId)).emit('sound:created', sound);
      return added;
    });

    // ---------- Emojis da comunidade ----------

    authed.get<{ Params: { id: string } }>('/api/communities/:id/emojis', async (request, reply) => {
      const access = requireRole(request, reply);
      if (!access) return reply;
      return db.listEmojis(access.communityId);
    });

    authed.post<{ Params: { id: string }; Body: { name?: string; image?: string } }>(
      '/api/communities/:id/emojis',
      { bodyLimit: UPLOAD_BODY_LIMIT },
      async (request, reply) => {
        const access = requireRole(request, reply);
        if (!access) return reply;
        const name = emojiName(request.body?.name);
        if (!name) return reply.code(400).send({ error: 'O nome do emoji deve ter de 2 a 32 letras, números ou _.' });
        if (db.emojiNameTaken(access.communityId, name)) {
          return reply.code(409).send({ error: `Já existe um emoji chamado :${name}: nesta comunidade.` });
        }
        const media = parseMedia(request.body?.image, 'image', LIMITS.emoji);
        if (typeof media === 'string') return reply.code(400).send({ error: media });
        const emoji = db.createEmoji(access.communityId, name, media.mime, media.data, request.user.id);
        io.to(communityRoom(access.communityId)).emit('emoji:created', emoji);
        return emoji;
      },
    );

    authed.patch<{ Params: { id: string }; Body: { name?: string } }>('/api/emojis/:id', async (request, reply) => {
      const emoji = db.findEmoji(Number(request.params.id));
      if (!emoji || !roleIn(request.user, emoji.communityId)) return reply.code(404).send({ error: 'Emoji não encontrado.' });
      if (!canDelete(request.user, emoji)) {
        return reply.code(403).send({ error: 'Só quem enviou o emoji ou quem administra a comunidade pode renomeá-lo.' });
      }
      const name = emojiName(request.body?.name);
      if (!name) return reply.code(400).send({ error: 'O nome do emoji deve ter de 2 a 32 letras, números ou _.' });
      if (name !== emoji.name && db.emojiNameTaken(emoji.communityId, name)) {
        return reply.code(409).send({ error: `Já existe um emoji chamado :${name}: nesta comunidade.` });
      }
      const updated = db.renameEmoji(emoji.id, name);
      io.to(communityRoom(emoji.communityId)).emit('emoji:created', updated); // a lista troca o item pelo id
      return updated;
    });

    authed.delete<{ Params: { id: string } }>('/api/emojis/:id', async (request, reply) => {
      const emoji = db.findEmoji(Number(request.params.id));
      if (!emoji || !roleIn(request.user, emoji.communityId)) return reply.code(404).send({ error: 'Emoji não encontrado.' });
      if (!canDelete(request.user, emoji)) {
        return reply.code(403).send({ error: 'Só quem enviou o emoji ou quem administra a comunidade pode excluí-lo.' });
      }
      db.deleteEmoji(emoji.id);
      io.to(communityRoom(emoji.communityId)).emit('emoji:deleted', { id: emoji.id, communityId: emoji.communityId });
      return { ok: true };
    });

    // ---------- Soundboard da comunidade ----------

    authed.get<{ Params: { id: string } }>('/api/communities/:id/sounds', async (request, reply) => {
      const access = requireRole(request, reply);
      if (!access) return reply;
      return db.boardSounds(access.communityId, request.user.id);
    });

    authed.post<{ Params: { id: string }; Body: { name?: string; icon?: string; audio?: string } }>(
      '/api/communities/:id/sounds',
      { bodyLimit: UPLOAD_BODY_LIMIT },
      async (request, reply) => {
        const access = requireRole(request, reply);
        if (!access) return reply;
        const name = String(request.body?.name ?? '').trim();
        if (name.length < 1 || name.length > 32) return reply.code(400).send({ error: 'O nome do som deve ter de 1 a 32 caracteres.' });
        const icon = String(request.body?.icon ?? '').trim() || '🔊';
        if ([...icon].length > 4) return reply.code(400).send({ error: 'Use um único emoji como ícone.' });
        const media = parseMedia(request.body?.audio, 'audio', LIMITS.sound);
        if (typeof media === 'string') return reply.code(400).send({ error: media });
        const sound = db.createSound(access.communityId, name, icon, media.mime, media.data, request.user.id);
        io.to(communityRoom(access.communityId)).emit('sound:created', sound);
        return sound;
      },
    );

    authed.patch<{ Params: { id: string }; Body: { name?: string; icon?: string } }>('/api/sounds/:id', async (request, reply) => {
      const sound = db.findSound(Number(request.params.id));
      // Som de pacote não se mexe por aqui: ele pertence ao pacote, e quem o montou cuida dele.
      if (!sound || sound.communityId === null || !roleIn(request.user, sound.communityId))
        return reply.code(404).send({ error: 'Som não encontrado.' });
      if (!canDelete(request.user, sound)) {
        return reply.code(403).send({ error: 'Só quem enviou o som ou quem administra a comunidade pode renomeá-lo.' });
      }
      const name = String(request.body?.name ?? '').trim();
      if (name.length < 1 || name.length > 32) return reply.code(400).send({ error: 'O nome do som deve ter de 1 a 32 caracteres.' });
      const icon = String(request.body?.icon ?? '').trim() || '🔊';
      if ([...icon].length > 4) return reply.code(400).send({ error: 'Use um único emoji como ícone.' });
      const updated = db.updateSound(sound.id, name, icon);
      io.to(communityRoom(sound.communityId)).emit('sound:created', updated); // a lista troca o item pelo id
      return updated;
    });

    authed.delete<{ Params: { id: string } }>('/api/sounds/:id', async (request, reply) => {
      const sound = db.findSound(Number(request.params.id));
      // Som de pacote não se mexe por aqui: ele pertence ao pacote, e quem o montou cuida dele.
      if (!sound || sound.communityId === null || !roleIn(request.user, sound.communityId))
        return reply.code(404).send({ error: 'Som não encontrado.' });
      if (!canDelete(request.user, sound)) {
        return reply.code(403).send({ error: 'Só quem enviou o som ou quem administra a comunidade pode excluí-lo.' });
      }
      db.deleteSound(sound.id);
      io.to(communityRoom(sound.communityId)).emit('sound:deleted', { id: sound.id, communityId: sound.communityId });
      return { ok: true };
    });
  });
}
