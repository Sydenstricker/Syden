import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import * as db from './db.js';
import { parseMedia } from './media.js';
import { requireUser } from './routes.js';

// Catálogo de pacotes de sons: qualquer pessoa monta o seu, quem quiser instala no próprio soundboard e
// dá de uma a cinco estrelas. O número de instalações é o "baixaram" que aparece no cartão do pacote.

const KB = 1024;
const SOUND_LIMIT = 1024 * KB;
const UPLOAD_BODY_LIMIT = 48 * 1024 * KB; // um pacote inteiro pode subir de uma vez (base64 ocupa ~33% a mais)
const MAX_SOUNDS = 40;
const MAX_PACKS_PER_USER = 20;

interface SoundBody {
  name?: string;
  icon?: string;
  audio?: string;
}

function packName(raw: unknown): string | null {
  const name = String(raw ?? '').trim();
  return name.length >= 2 && name.length <= 32 ? name : null;
}

function icon(raw: unknown, fallback: string): string {
  const value = String(raw ?? '').trim();
  return value && [...value].length <= 4 ? value : fallback;
}

/** Valida e guarda um som dentro do pacote; devolve a mensagem de erro, se houver. */
function addSound(packId: number, body: SoundBody): string | null {
  const name = String(body?.name ?? '').trim();
  if (name.length < 1 || name.length > 32) return 'Cada som precisa de um nome de 1 a 32 caracteres.';
  const media = parseMedia(body?.audio, 'audio', SOUND_LIMIT);
  if (typeof media === 'string') return media;
  db.createPackSound(packId, name, icon(body?.icon, '🔊'), media.mime, media.data);
  return null;
}

export function registerPackRoutes(app: FastifyInstance) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    /** O pacote e a permissão de mexer nele: quem montou, ou quem administra o Syden. */
    function editable(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) {
      const pack = db.findPack(Number(request.params.id), request.user.id);
      if (!pack) {
        reply.code(404).send({ error: 'Pacote não encontrado.' });
        return undefined;
      }
      if (pack.builtin) {
        reply.code(403).send({ error: 'Os pacotes que vêm com o Syden não podem ser alterados.' });
        return undefined;
      }
      if (pack.createdBy !== request.user.id && !request.user.isAdmin) {
        reply.code(403).send({ error: 'Só quem montou o pacote pode alterá-lo.' });
        return undefined;
      }
      return pack;
    }

    authed.get('/api/packs', async (request) => db.listPacks(request.user.id));

    authed.get<{ Params: { id: string } }>('/api/packs/:id/sounds', async (request, reply) => {
      const pack = db.findPack(Number(request.params.id), request.user.id);
      if (!pack) return reply.code(404).send({ error: 'Pacote não encontrado.' });
      return db.packSounds(pack.id);
    });

    authed.post<{ Body: { name?: string; description?: string; icon?: string; sounds?: SoundBody[] } }>(
      '/api/packs',
      { bodyLimit: UPLOAD_BODY_LIMIT },
      async (request, reply) => {
        const name = packName(request.body?.name);
        if (!name) return reply.code(400).send({ error: 'O nome do pacote deve ter de 2 a 32 caracteres.' });
        if (db.findPackByName(name)) return reply.code(409).send({ error: 'Já existe um pacote com esse nome.' });
        if (db.countPacksCreatedBy(request.user.id) >= MAX_PACKS_PER_USER) {
          return reply.code(409).send({ error: `Cada pessoa pode ter até ${MAX_PACKS_PER_USER} pacotes.` });
        }
        const sounds = request.body?.sounds ?? [];
        if (sounds.length < 1) return reply.code(400).send({ error: 'Escolha pelo menos um som para o pacote.' });
        if (sounds.length > MAX_SOUNDS) return reply.code(400).send({ error: `Um pacote pode ter até ${MAX_SOUNDS} sons.` });
        const description = String(request.body?.description ?? '')
          .trim()
          .slice(0, 200);

        const packId = db.createPack(name, description, icon(request.body?.icon, '📦'), request.user.id);
        for (const sound of sounds) {
          const error = addSound(packId, sound);
          if (error) {
            db.deletePack(packId); // pacote pela metade não serve a ninguém: desfaz tudo
            return reply.code(400).send({ error });
          }
        }
        // Quem monta o pacote já fica com ele no próprio soundboard.
        db.installPack(packId, request.user.id);
        return db.findPack(packId, request.user.id);
      },
    );

    authed.patch<{ Params: { id: string }; Body: { name?: string; description?: string; icon?: string } }>(
      '/api/packs/:id',
      async (request, reply) => {
        const pack = editable(request, reply);
        if (!pack) return reply;
        const name = packName(request.body?.name ?? pack.name);
        if (!name) return reply.code(400).send({ error: 'O nome do pacote deve ter de 2 a 32 caracteres.' });
        const outro = db.findPackByName(name);
        if (outro && outro.id !== pack.id) return reply.code(409).send({ error: 'Já existe um pacote com esse nome.' });
        const description = String(request.body?.description ?? pack.description)
          .trim()
          .slice(0, 200);
        db.updatePack(pack.id, name, description, icon(request.body?.icon, pack.icon));
        return db.findPack(pack.id, request.user.id);
      },
    );

    authed.delete<{ Params: { id: string } }>('/api/packs/:id', async (request, reply) => {
      const pack = editable(request, reply);
      if (!pack) return reply;
      db.deletePack(pack.id);
      return { ok: true };
    });

    authed.post<{ Params: { id: string }; Body: { sounds?: SoundBody[] } }>(
      '/api/packs/:id/sounds',
      { bodyLimit: UPLOAD_BODY_LIMIT },
      async (request, reply) => {
        const pack = editable(request, reply);
        if (!pack) return reply;
        const sounds = request.body?.sounds ?? [];
        if (sounds.length < 1) return reply.code(400).send({ error: 'Escolha pelo menos um som.' });
        if (pack.soundCount + sounds.length > MAX_SOUNDS) {
          return reply.code(400).send({ error: `Um pacote pode ter até ${MAX_SOUNDS} sons.` });
        }
        for (const sound of sounds) {
          const error = addSound(pack.id, sound);
          if (error) return reply.code(400).send({ error });
        }
        return db.findPack(pack.id, request.user.id);
      },
    );

    authed.delete<{ Params: { id: string; soundId: string } }>('/api/packs/:id/sounds/:soundId', async (request, reply) => {
      const pack = editable(request, reply);
      if (!pack) return reply;
      const sound = db.findSound(Number(request.params.soundId));
      if (!sound || sound.packId !== pack.id) return reply.code(404).send({ error: 'Som não encontrado neste pacote.' });
      db.deleteSound(sound.id);
      return db.findPack(pack.id, request.user.id);
    });

    // ---------- Instalar, tirar e avaliar ----------

    authed.post<{ Params: { id: string } }>('/api/packs/:id/install', async (request, reply) => {
      const pack = db.findPack(Number(request.params.id), request.user.id);
      if (!pack) return reply.code(404).send({ error: 'Pacote não encontrado.' });
      db.installPack(pack.id, request.user.id);
      return db.findPack(pack.id, request.user.id);
    });

    authed.delete<{ Params: { id: string } }>('/api/packs/:id/install', async (request, reply) => {
      const pack = db.findPack(Number(request.params.id), request.user.id);
      if (!pack) return reply.code(404).send({ error: 'Pacote não encontrado.' });
      db.uninstallPack(pack.id, request.user.id);
      return db.findPack(pack.id, request.user.id);
    });

    // Nota de 1 a 5; zero tira a nota que a pessoa tinha dado.
    authed.put<{ Params: { id: string }; Body: { stars?: number } }>('/api/packs/:id/rating', async (request, reply) => {
      const pack = db.findPack(Number(request.params.id), request.user.id);
      if (!pack) return reply.code(404).send({ error: 'Pacote não encontrado.' });
      const stars = Math.round(Number(request.body?.stars ?? 0));
      if (stars < 0 || stars > 5) return reply.code(400).send({ error: 'A nota vai de 1 a 5 estrelas.' });
      if (stars === 0) db.clearRating(pack.id, request.user.id);
      else db.ratePack(pack.id, request.user.id, stars);
      return db.findPack(pack.id, request.user.id);
    });

    // ---------- Favoritos ----------

    authed.put<{ Params: { id: string }; Body: { favorite?: boolean } }>('/api/sounds/:id/favorite', async (request, reply) => {
      const sound = db.findSound(Number(request.params.id));
      if (!sound) return reply.code(404).send({ error: 'Som não encontrado.' });
      db.setFavoriteSound(request.user.id, sound.id, request.body?.favorite !== false);
      return { ok: true };
    });
  });
}
