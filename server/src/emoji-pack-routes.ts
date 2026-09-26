import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import * as db from './db.js';
import { parseMedia } from './media.js';
import { communityRoom } from './realtime.js';
import { requireUser } from './routes.js';

// Catálogo de pacotes de emoji. A diferença para os pacotes de som é de quem instala: som é coisa de
// cada pessoa, no soundboard dela; emoji é da COMUNIDADE, porque só faz sentido se todo mundo na
// conversa enxergar o mesmo desenho. Então quem instala é quem administra a comunidade, e o pacote entra
// para todos de uma vez.

const KB = 1024;
const EMOJI_LIMIT = 512 * KB;
const UPLOAD_BODY_LIMIT = 48 * 1024 * KB; // o pacote inteiro sobe de uma vez; base64 ocupa ~33% a mais
const MAX_EMOJIS = 60;
const MAX_PACKS_PER_USER = 10;

interface EmojiBody {
  name?: string;
  image?: string;
}

function packName(raw: unknown): string | null {
  const name = String(raw ?? '').trim();
  return name.length >= 2 && name.length <= 32 ? name : null;
}

function icon(raw: unknown, fallback: string): string {
  const value = String(raw ?? '').trim();
  return value && [...value].length <= 4 ? value : fallback;
}

/** O mesmo nome que vale para emoji de comunidade: é assim que ele vai ser escrito na mensagem. */
function emojiName(raw: unknown): string | null {
  const name = String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return name.length >= 2 && name.length <= 32 ? name : null;
}

/** O que um desenho guardado no pacote traz de volta, ou a mensagem de erro se não deu. */
type EmojiGuardado = { name: string; mime: string; data: Buffer };

/** Valida e guarda um desenho dentro do pacote. Texto = deu errado, e o texto é o motivo. */
function addEmoji(packId: number, body: EmojiBody): EmojiGuardado | string {
  const name = emojiName(body?.name);
  if (!name) return 'Cada emoji precisa de um nome de 2 a 32 letras, números ou _.';
  const media = parseMedia(body?.image, 'image', EMOJI_LIMIT);
  if (typeof media === 'string') return media;
  try {
    db.addEmojiToPack(packId, name, media.mime, media.data);
  } catch {
    return `O pacote já tem um emoji chamado :${name}:.`;
  }
  return { name, mime: media.mime, data: media.data };
}

export function registerEmojiPackRoutes(app: FastifyInstance, io: IOServer) {
  // A imagem de um emoji de catálogo é pública, como a dos emojis das comunidades: ela aparece no cartão
  // do pacote antes de alguém instalar.
  app.get<{ Params: { id: string } }>('/api/emoji-pack-items/:id/image', async (request, reply) => {
    const file = db.findEmojiPackItemFile(Number(request.params.id));
    if (!file) return reply.code(404).send({ error: 'Emoji não encontrado.' });
    return reply.header('Cache-Control', 'public, max-age=31536000, immutable').type(file.mime).send(Buffer.from(file.data));
  });

  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    /** A comunidade que a pessoa está olhando, e o cargo dela lá. */
    function membership(request: FastifyRequest, reply: FastifyReply, raw: unknown) {
      const communityId = Number(raw);
      if (!Number.isInteger(communityId)) {
        reply.code(400).send({ error: 'Comunidade inválida.' });
        return null;
      }
      const role = db.memberRole(communityId, request.user.id);
      if (!role) {
        reply.code(404).send({ error: 'Comunidade não encontrada.' });
        return null;
      }
      return { communityId, role };
    }

    const manages = (role: string) => role === 'owner' || role === 'admin';

    authed.get<{ Querystring: { communityId?: string } }>('/api/emoji-packs', async (request, reply) => {
      const access = membership(request, reply, request.query.communityId);
      if (!access) return reply;
      return db.listEmojiPacks(request.user.id, access.communityId);
    });

    authed.get<{ Params: { id: string } }>('/api/emoji-packs/:id/emojis', async (request, reply) => {
      const packId = Number(request.params.id);
      if (!db.emojiPackOwner(packId)) return reply.code(404).send({ error: 'Pacote não encontrado.' });
      return db.listEmojiPackItems(packId);
    });

    authed.post<{ Body: { name?: string; description?: string; icon?: string; emojis?: EmojiBody[] } }>(
      '/api/emoji-packs',
      { bodyLimit: UPLOAD_BODY_LIMIT },
      async (request, reply) => {
        const name = packName(request.body?.name);
        if (!name) return reply.code(400).send({ error: 'O pacote precisa de um nome de 2 a 32 caracteres.' });
        const emojis = Array.isArray(request.body?.emojis) ? request.body.emojis : [];
        if (emojis.length === 0) return reply.code(400).send({ error: 'Escolha pelo menos um emoji para o pacote.' });
        if (emojis.length > MAX_EMOJIS) return reply.code(400).send({ error: `Um pacote cabe até ${MAX_EMOJIS} emojis.` });
        if (db.countEmojiPacksCreatedBy(request.user.id) >= MAX_PACKS_PER_USER) {
          return reply.code(409).send({ error: `Cada pessoa pode montar até ${MAX_PACKS_PER_USER} pacotes.` });
        }

        const packId = db.createEmojiPack(name, String(request.body?.description ?? '').trim().slice(0, 140), icon(request.body?.icon, '😀'), request.user.id);
        for (const item of emojis) {
          const guardado = addEmoji(packId, item);
          if (typeof guardado === 'string') {
            db.deleteEmojiPack(packId); // nada pela metade
            return reply.code(400).send({ error: guardado });
          }
        }
        return db.findEmojiPack(packId, request.user.id, 0);
      },
    );

    /** Transforma os emojis que a comunidade já tem num pacote, para outras comunidades usarem. */
    authed.post<{ Body: { communityId?: number; name?: string; description?: string; icon?: string } }>(
      '/api/emoji-packs/from-community',
      async (request, reply) => {
        const access = membership(request, reply, request.body?.communityId);
        if (!access) return reply;
        if (!manages(access.role)) return reply.code(403).send({ error: 'Só quem administra a comunidade pode publicar os emojis dela.' });
        const name = packName(request.body?.name);
        if (!name) return reply.code(400).send({ error: 'O pacote precisa de um nome de 2 a 32 caracteres.' });
        if (db.countEmojiPacksCreatedBy(request.user.id) >= MAX_PACKS_PER_USER) {
          return reply.code(409).send({ error: `Cada pessoa pode montar até ${MAX_PACKS_PER_USER} pacotes.` });
        }

        const emojis = db.emojiFilesOfCommunity(access.communityId);
        if (emojis.length === 0) return reply.code(400).send({ error: 'Esta comunidade ainda não tem emojis para publicar.' });
        if (emojis.length > MAX_EMOJIS) return reply.code(400).send({ error: `Um pacote cabe até ${MAX_EMOJIS} emojis.` });

        const packId = db.createEmojiPack(
          name,
          String(request.body?.description ?? '').trim().slice(0, 140),
          icon(request.body?.icon, '😀'),
          request.user.id,
        );
        for (const emoji of emojis) db.addEmojiToPack(packId, emoji.name, emoji.mime, Buffer.from(emoji.data));
        return db.findEmojiPack(packId, request.user.id, access.communityId);
      },
    );

    authed.patch<{ Params: { id: string }; Body: { name?: string; description?: string; icon?: string } }>(
      '/api/emoji-packs/:id',
      async (request, reply) => {
        const packId = Number(request.params.id);
        const dono = db.emojiPackOwner(packId);
        if (!dono) return reply.code(404).send({ error: 'Pacote não encontrado.' });
        if (dono.createdBy !== request.user.id) return reply.code(403).send({ error: 'Só quem montou o pacote pode mudá-lo.' });
        const name = packName(request.body?.name);
        if (!name) return reply.code(400).send({ error: 'O pacote precisa de um nome de 2 a 32 caracteres.' });
        db.updateEmojiPack(packId, name, String(request.body?.description ?? '').trim().slice(0, 140), icon(request.body?.icon, '😀'));
        return { ok: true };
      },
    );

    authed.delete<{ Params: { id: string } }>('/api/emoji-packs/:id', async (request, reply) => {
      const packId = Number(request.params.id);
      const dono = db.emojiPackOwner(packId);
      if (!dono) return reply.code(404).send({ error: 'Pacote não encontrado.' });
      if (dono.createdBy !== request.user.id) return reply.code(403).send({ error: 'Só quem montou o pacote pode apagá-lo.' });
      db.deleteEmojiPack(packId);
      return { ok: true };
    });

    /** Acrescenta desenhos a um pacote que já está publicado. */
    authed.post<{ Params: { id: string }; Body: { emojis?: EmojiBody[] } }>(
      '/api/emoji-packs/:id/emojis',
      { bodyLimit: UPLOAD_BODY_LIMIT },
      async (request, reply) => {
        const packId = Number(request.params.id);
        const dono = db.emojiPackOwner(packId);
        if (!dono) return reply.code(404).send({ error: 'Pacote não encontrado.' });
        if (dono.createdBy !== request.user.id) return reply.code(403).send({ error: 'Só quem montou o pacote pode mudá-lo.' });

        const novos = Array.isArray(request.body?.emojis) ? request.body.emojis : [];
        if (novos.length === 0) return reply.code(400).send({ error: 'Escolha pelo menos um emoji.' });
        if (db.countEmojiPackItems(packId) + novos.length > MAX_EMOJIS) {
          return reply.code(400).send({ error: `Um pacote cabe até ${MAX_EMOJIS} emojis.` });
        }

        for (const item of novos) {
          const guardado = addEmoji(packId, item);
          if (typeof guardado === 'string') return reply.code(400).send({ error: guardado });
          // Quem já tem o pacote instalado recebe o desenho novo na hora, sem reinstalar nada.
          for (const { communityId, emoji } of db.spreadPackEmoji(packId, guardado.name, guardado.mime, guardado.data)) {
            io.to(communityRoom(communityId)).emit('emoji:created', emoji);
          }
        }
        return db.findEmojiPack(packId, request.user.id, 0);
      },
    );

    /** Tira um desenho do pacote — e das comunidades que o instalaram. */
    authed.delete<{ Params: { id: string; itemId: string } }>('/api/emoji-packs/:id/emojis/:itemId', async (request, reply) => {
      const packId = Number(request.params.id);
      const dono = db.emojiPackOwner(packId);
      if (!dono) return reply.code(404).send({ error: 'Pacote não encontrado.' });
      if (dono.createdBy !== request.user.id) return reply.code(403).send({ error: 'Só quem montou o pacote pode mudá-lo.' });
      const item = db.findEmojiPackItem(Number(request.params.itemId));
      if (!item || item.packId !== packId) return reply.code(404).send({ error: 'Emoji não encontrado neste pacote.' });

      for (const alvo of db.unspreadPackEmoji(packId, item.name)) {
        io.to(communityRoom(alvo.communityId)).emit('emoji:deleted', { id: alvo.id, communityId: alvo.communityId });
      }
      db.deleteEmojiPackItem(item.id);
      return db.findEmojiPack(packId, request.user.id, 0);
    });

    /** Põe o pacote na comunidade: os emojis entram para todo mundo, na hora. */
    authed.post<{ Params: { id: string }; Body: { communityId?: number } }>('/api/emoji-packs/:id/install', async (request, reply) => {
      const access = membership(request, reply, request.body?.communityId);
      if (!access) return reply;
      if (!manages(access.role)) return reply.code(403).send({ error: 'Só quem administra a comunidade pode instalar um pacote nela.' });
      const packId = Number(request.params.id);
      if (!db.emojiPackOwner(packId)) return reply.code(404).send({ error: 'Pacote não encontrado.' });

      const { added, skipped } = db.installEmojiPack(packId, access.communityId, request.user.id);
      for (const emoji of added) io.to(communityRoom(access.communityId)).emit('emoji:created', emoji);
      return { added: added.length, skipped };
    });

    authed.delete<{ Params: { id: string }; Querystring: { communityId?: string } }>(
      '/api/emoji-packs/:id/install',
      async (request, reply) => {
        const access = membership(request, reply, request.query.communityId);
        if (!access) return reply;
        if (!manages(access.role)) return reply.code(403).send({ error: 'Só quem administra a comunidade pode tirar um pacote dela.' });
        const removidos = db.uninstallEmojiPack(Number(request.params.id), access.communityId);
        for (const id of removidos) io.to(communityRoom(access.communityId)).emit('emoji:deleted', { id, communityId: access.communityId });
        return { removed: removidos.length };
      },
    );

    authed.put<{ Params: { id: string }; Body: { stars?: number } }>('/api/emoji-packs/:id/rating', async (request, reply) => {
      const stars = Number(request.body?.stars);
      if (!Number.isInteger(stars) || stars < 1 || stars > 5) return reply.code(400).send({ error: 'A nota vai de 1 a 5 estrelas.' });
      const packId = Number(request.params.id);
      if (!db.emojiPackOwner(packId)) return reply.code(404).send({ error: 'Pacote não encontrado.' });
      db.rateEmojiPack(packId, request.user.id, stars);
      return { ok: true };
    });
  });
}
