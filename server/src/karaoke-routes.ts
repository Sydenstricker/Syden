import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import * as db from './db.js';
import { entregarArquivo } from './entregar.js';
import { decodeDataUrl, sniffMime } from './media.js';
import { communityRoom, pessoasNaSala, salaDeVozDe } from './realtime.js';
import { cotaEsgotada, requireUser } from './routes.js';

// Karaokê: as músicas de cada comunidade. O Syden não traz música nenhuma — quem sobe é quem tem o
// arquivo. O áudio não passa pela chamada: na hora de cantar, cada computador toca a própria cópia,
// como já acontece com o soundboard. É o que mantém a qualidade e deixa a letra andar certinho na tela
// de cada um, sem depender da internet de ninguém.

const KB = 1024;
const MB = 1024 * KB;
/** Uma música inteira, não um efeito: o teto é bem maior que o do soundboard. */
const LIMITE_AUDIO = 12 * MB;
const UPLOAD_BODY_LIMIT = Math.round(LIMITE_AUDIO * 1.4);
const MAX_MUSICAS = 40;
const MAX_LETRA = 20_000;

export function registerKaraokeRoutes(app: FastifyInstance, io: IOServer) {
  // O áudio é público como o dos sons: quem tem o endereço toca, e o endereço só sai para quem está na
  // comunidade (a lista vem autenticada).
  app.get<{ Params: { id: string } }>('/api/karaoke/:id/audio', async (request, reply) => {
    const file = db.findKaraokeFile(Number(request.params.id));
    if (!file) return reply.code(404).send({ error: 'Música não encontrada.' });
    // ARRASTAR A BARRA DA MÚSICA É O CASO DESTA ROTA. O entregador responde a pedido de pedaço
    // (Range) quando o arquivo já está no disco — sem isso, cada arraste rebaixa a música inteira.
    return entregarArquivo(request, reply, file);
  });

  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

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

    authed.get<{ Params: { id: string } }>('/api/communities/:id/karaoke', async (request, reply) => {
      const access = membership(request, reply, request.params.id);
      if (!access) return reply;
      return db.listKaraokeSongs(access.communityId);
    });

    authed.post<{
      Params: { id: string };
      Body: { title?: string; artist?: string; audio?: string; lyrics?: string; seconds?: number };
    }>('/api/communities/:id/karaoke', { bodyLimit: UPLOAD_BODY_LIMIT }, async (request, reply) => {
      if (cotaEsgotada(request, reply)) return reply;
      const access = membership(request, reply, request.params.id);
      if (!access) return reply;

      const title = String(request.body?.title ?? '').trim().slice(0, 80);
      if (title.length < 2) return reply.code(400).send({ error: 'A música precisa de um nome de pelo menos 2 letras.' });
      if (db.countKaraokeSongs(access.communityId) >= MAX_MUSICAS) {
        return reply.code(409).send({ error: `Cada comunidade guarda até ${MAX_MUSICAS} músicas. Apague uma para subir outra.` });
      }

      const data = decodeDataUrl(request.body?.audio, LIMITE_AUDIO);
      if (typeof data === 'string') return reply.code(400).send({ error: data });
      const mime = sniffMime(data);
      if (!mime || !mime.startsWith('audio/')) return reply.code(400).send({ error: 'Isto não é um arquivo de áudio.' });

      return db.createKaraokeSong({
        communityId: access.communityId,
        title,
        artist: String(request.body?.artist ?? '').trim().slice(0, 80),
        mime,
        data,
        seconds: Math.max(0, Math.min(Math.round(Number(request.body?.seconds) || 0), 60 * 60)),
        lyrics: String(request.body?.lyrics ?? '').slice(0, MAX_LETRA),
        createdBy: request.user.id,
      });
    });

    /*
     * "Pus esta música para cantar" (19/10/2026): o aviso de tocar vai pela chamada (LiveKit) e nunca passava por aqui, e
     * por isso nada contava. Agora quem põe a música avisa também o servidor, que conta para o ranking da comunidade e as
     * conquistas. Conta só o que é karaokê de verdade: a pessoa está numa sala de voz DESTA comunidade, com mais alguém
     * (como os pontos de voz dos níveis), e recomeçar a mesma música antes de ela acabar não conta de novo.
     */
    authed.post<{ Params: { id: string } }>('/api/karaoke/:id/cantada', async (request, reply) => {
      const song = db.findKaraokeSong(Number(request.params.id));
      if (!song || !db.memberRole(song.communityId, request.user.id)) return reply.code(404).send({ error: 'Música não encontrada.' });
      const sala = salaDeVozDe(request.user.id);
      if (!sala || sala.communityId !== song.communityId || pessoasNaSala(sala.channelId) < 2) return { contou: false };
      const ultima = db.ultimaCantada(request.user.id, song.id);
      const duracaoMs = Math.max(song.seconds || 0, 60) * 1000;
      if (ultima && Date.now() - Date.parse(ultima) < duracaoMs) return { contou: false };
      db.registrarCantada(song.communityId, song.id, request.user.id);
      return { contou: true };
    });

    authed.get<{ Params: { id: string } }>('/api/communities/:id/karaoke/ranking', async (request, reply) => {
      const access = membership(request, reply, request.params.id);
      if (!access) return reply;
      return db.rankingDoKaraoke(access.communityId);
    });

    authed.delete<{ Params: { id: string } }>('/api/karaoke/:id', async (request, reply) => {
      const song = db.findKaraokeSong(Number(request.params.id));
      if (!song) return reply.code(404).send({ error: 'Música não encontrada.' });
      const role = db.memberRole(song.communityId, request.user.id);
      if (!role) return reply.code(404).send({ error: 'Música não encontrada.' });
      const manda = role === 'owner' || role === 'admin';
      if (song.createdBy !== request.user.id && !manda) {
        return reply.code(403).send({ error: 'Só quem subiu a música ou quem administra a comunidade pode apagá-la.' });
      }
      db.deleteKaraokeSong(song.id);
      io.to(communityRoom(song.communityId)).emit('karaoke:deleted', { id: song.id, communityId: song.communityId });
      return { ok: true };
    });
  });
}
