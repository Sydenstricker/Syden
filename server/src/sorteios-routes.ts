import type { FastifyInstance, FastifyReply } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import { encerrarESortear, publicarResultado, sortearEntre } from './agendador.js';
import * as db from './db.js';
import { channelRoom } from './realtime.js';
import { manages, requireUser } from './routes.js';
import { publicarComoSyden } from './syden-app.js';

/**
 * OS SORTEIOS (ver o bloco em db.ts). Só quem administra cria, encerra e sorteia de novo; participar é
 * reagir com 🎉 no anúncio, pela reação de sempre.
 *
 * OS TEXTOS CHEGAM PRONTOS, na língua de quem cria — é nela que a comunidade conversa. O anúncio vem
 * inteiro (com a hora já escrita no fuso de quem criou), e os do resultado trazem {vencedores} e {premio}
 * para o agendador preencher.
 */
const NAO_ENCONTRADA = 'Comunidade não encontrada.';
const PREMIO_MAXIMO = 200;
const TEXTO_MAXIMO = 1000;
const MAXIMO_DE_VENCEDORES = 20;
const MAXIMO_ABERTOS = 10;
const UM_MINUTO_MS = 60_000;
const TRINTA_DIAS_MS = 30 * 24 * 60 * 60_000;

export function registerSorteiosRoutes(app: FastifyInstance, io: IOServer) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    /** O papel de quem pede, ou a resposta de recusa já enviada. */
    function administra(communityId: number, userId: number, reply: FastifyReply, acao: string): boolean {
      const papel = db.memberRole(communityId, userId);
      if (!papel) {
        void reply.code(404).send({ error: NAO_ENCONTRADA });
        return false;
      }
      if (!manages(papel)) {
        void reply.code(403).send({ error: `Só quem administra a comunidade ${acao}.` });
        return false;
      }
      return true;
    }

    authed.get<{ Params: { id: string } }>('/api/communities/:id/sorteios', async (request, reply) => {
      const communityId = Number(request.params.id);
      if (!administra(communityId, request.user.id, reply, 'vê os sorteios')) return;
      return db.listarSorteios(communityId);
    });

    authed.post<{
      Params: { id: string };
      Body: { channelId?: number; premio?: string; vencedores?: number; terminaEm?: string; anuncio?: string; textoResultado?: string; textoVazio?: string };
    }>('/api/communities/:id/sorteios', async (request, reply) => {
      const communityId = Number(request.params.id);
      if (!administra(communityId, request.user.id, reply, 'cria sorteios')) return;
      const corpo = request.body ?? {};
      const canal = db.findChannel(Number(corpo.channelId));
      if (!canal || canal.communityId !== communityId || canal.type !== 'text') return reply.code(400).send({ error: 'Escolha um canal de texto da comunidade.' });
      const premio = String(corpo.premio ?? '').trim();
      if (!premio || premio.length > PREMIO_MAXIMO) return reply.code(400).send({ error: `O prêmio deve ter de 1 a ${PREMIO_MAXIMO} caracteres.` });
      const vencedores = Number(corpo.vencedores);
      if (!Number.isInteger(vencedores) || vencedores < 1 || vencedores > MAXIMO_DE_VENCEDORES) {
        return reply.code(400).send({ error: `De 1 a ${MAXIMO_DE_VENCEDORES} ganhadores.` });
      }
      const terminaEm = Date.parse(String(corpo.terminaEm ?? ''));
      if (!Number.isFinite(terminaEm) || terminaEm < Date.now() + UM_MINUTO_MS || terminaEm > Date.now() + TRINTA_DIAS_MS) {
        return reply.code(400).send({ error: 'O sorteio termina de 1 minuto a 30 dias a partir de agora.' });
      }
      const anuncio = String(corpo.anuncio ?? '').trim();
      const textoResultado = String(corpo.textoResultado ?? '').trim();
      const textoVazio = String(corpo.textoVazio ?? '').trim();
      if ([anuncio, textoResultado, textoVazio].some((t) => !t || t.length > TEXTO_MAXIMO)) {
        return reply.code(400).send({ error: `Os textos devem ter de 1 a ${TEXTO_MAXIMO} caracteres.` });
      }
      if (!textoResultado.includes('{vencedores}')) return reply.code(400).send({ error: 'O texto do resultado precisa de {vencedores}.' });
      if (db.contarSorteiosAbertos(communityId) >= MAXIMO_ABERTOS) {
        return reply.code(409).send({ error: `Esta comunidade já tem ${MAXIMO_ABERTOS} sorteios abertos, o máximo.` });
      }

      const mensagem = publicarComoSyden(io, canal, anuncio);
      // O Syden deixa o 🎉 pronto: participar vira um clique, sem ninguém procurar o emoji.
      db.toggleReaction(mensagem.id, db.EMOJI_DO_SORTEIO, db.contaDoSyden());
      io.to(channelRoom(canal)).emit('reaction:updated', {
        messageId: mensagem.id,
        channelId: canal.id,
        threadId: null,
        reactions: db.reactionCounts(mensagem.id),
      });
      return db.criarSorteio({
        communityId,
        channelId: canal.id,
        messageId: mensagem.id,
        premio,
        vencedores,
        terminaEm: new Date(terminaEm).toISOString(),
        textoResultado,
        textoVazio,
        criadoPor: request.user.id,
      });
    });

    authed.post<{ Params: { id: string; sorteioId: string } }>('/api/communities/:id/sorteios/:sorteioId/encerrar', async (request, reply) => {
      const communityId = Number(request.params.id);
      if (!administra(communityId, request.user.id, reply, 'encerra sorteios')) return;
      const sorteio = db.acharSorteio(communityId, Number(request.params.sorteioId));
      if (!sorteio) return reply.code(404).send({ error: 'Sorteio não encontrado.' });
      if (sorteio.encerrado) return reply.code(409).send({ error: 'Este sorteio já terminou.' });
      encerrarESortear(io, sorteio);
      return db.acharSorteio(communityId, sorteio.id);
    });

    /** Quando quem ganhou não aparece: sorteia mais um, entre quem ainda não ganhou. */
    authed.post<{ Params: { id: string; sorteioId: string } }>('/api/communities/:id/sorteios/:sorteioId/sortear-de-novo', async (request, reply) => {
      const communityId = Number(request.params.id);
      if (!administra(communityId, request.user.id, reply, 'sorteia de novo')) return;
      const sorteio = db.acharSorteio(communityId, Number(request.params.sorteioId));
      if (!sorteio) return reply.code(404).send({ error: 'Sorteio não encontrado.' });
      if (!sorteio.encerrado) return reply.code(409).send({ error: 'Este sorteio ainda não terminou.' });
      const jaGanharam = db.idsGanhadores(sorteio.id);
      const [novo] = sortearEntre(db.participantesDoSorteio(communityId, sorteio.messageId), 1, jaGanharam);
      if (!novo) return reply.code(409).send({ error: 'Não sobrou ninguém para sortear.' });
      db.encerrarSorteio(sorteio.id, [...jaGanharam, novo.id], sorteio.terminaEm);
      publicarResultado(io, sorteio, [novo]);
      return db.acharSorteio(communityId, sorteio.id);
    });
  });
}
