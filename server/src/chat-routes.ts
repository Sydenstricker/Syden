// O que uma mensagem pode carregar além do texto: arquivos, enquetes e tópicos.
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import * as db from './db.js';
import { decodeDataUrl, sniffAttachmentMime } from './media.js';
import { channelRoom, communityRoom } from './realtime.js';
import { canUseChannel, manages, poderDeOperador, requireUser, roleIn } from './routes.js';

const MB = 1024 * 1024;
export const MAX_ATTACHMENT_BYTES = 8 * MB;
/**
 * Recado em vídeo de tela: é o único arquivo grande que o Syden aceita, e o preço disso é ter prazo.
 * Dez minutos de tela a uns 800 kbps dão uns 60 MB; o teto fica um pouco acima, para caber um recado
 * mais pesado sem virar depósito.
 */
export const MAX_RECADO_BYTES = 90 * MB;
export const DIAS_DO_RECADO = 7;
export const MAX_RECADO_SEGUNDOS = 10 * 60;
const MAX_FILES_PER_MESSAGE = 5;
// base64 ocupa ~33% a mais que o arquivo, e ainda cabe o texto e os nomes.
const UPLOAD_BODY_LIMIT = Math.round(MAX_FILES_PER_MESSAGE * MAX_ATTACHMENT_BYTES * 1.4);

const MAX_POLL_OPTIONS = 10;

/** Os tipos que o navegador pode abrir na própria página; o resto é sempre download. */
const INLINE = /^(image|video|audio)\//;

/** "relatório final.pdf" → um nome seguro para o cabeçalho de download. */
function safeName(raw: unknown): string {
  const name = String(raw ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '')
    .trim()
    .slice(0, 120);
  return name || 'arquivo';
}

/** Dimensão da imagem mandada pelo navegador, usada só para reservar o espaço na tela. */
function dimension(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= 20000 ? Math.round(n) : null;
}

export function registerChatRoutes(app: FastifyInstance, io: IOServer) {
  // <img> e <a download> não conseguem mandar o token de login, então o próprio endereço é o segredo:
  // sem a chave sorteada no envio, nem adivinhando o número se chega ao arquivo.
  app.get<{ Params: { id: string; key: string } }>('/api/attachments/:id/:key', async (request, reply) => {
    const file = db.findAttachmentFile(Number(request.params.id), request.params.key);
    if (!file) return reply.code(404).send({ error: 'Arquivo não encontrado.' });
    const disposition = INLINE.test(file.mime) ? 'inline' : 'attachment';
    return reply
      .header('content-type', file.mime)
      .header('content-disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(file.name)}`)
      .header('cache-control', 'public, max-age=31536000, immutable')
      .header('x-content-type-options', 'nosniff')
      .send(Buffer.from(file.data));
  });

  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    /**
     * Onde a mensagem vai cair: o canal de texto e, quando vem `threadId`, o tópico dele. Confere de uma vez
     * que a pessoa participa da comunidade e que o tópico é mesmo daquele canal.
     */
    function destination(request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply, threadId: unknown) {
      const channel = db.findChannel(Number(request.params.id));
      const podeEscrever = channel && (channel.type === 'text' || channel.type === 'dm') && canUseChannel(request.user, channel);
      if (!channel || !podeEscrever) {
        reply.code(404).send({ error: 'Canal não encontrado.' });
        return null;
      }
      if (threadId === undefined || threadId === null) return { channel, threadId: null as number | null };
      const thread = db.threadLocation(Number(threadId));
      if (!thread || thread.channelId !== channel.id) {
        reply.code(404).send({ error: 'Tópico não encontrado.' });
        return null;
      }
      return { channel, threadId: thread.id };
    }

    /** Manda a mensagem pronta para quem tem que receber: a comunidade toda, ou só a conversa privada. */
    function publish(channel: db.Channel, message: db.Message) {
      const room = channelRoom(channel);
      io.to(room).emit('message:new', { ...message, communityId: channel.communityId });
      if (message.threadId !== null) {
        const thread = db.findThread(message.threadId);
        if (thread) io.to(room).emit('thread:updated', { ...thread, communityId: channel.communityId });
      }
      return message;
    }

    /**
     * Recado em vídeo de tela: chega como arquivo cru, não como JSON. Sessenta megabytes viram oitenta
     * em base64, e transformar isso em texto para caber num JSON gastaria memória dos dois lados à toa.
     */
    authed.post<{ Params: { id: string }; Querystring: { segundos?: string; nome?: string } }>(
      '/api/channels/:id/screen-video',
      { bodyLimit: MAX_RECADO_BYTES + MB },
      async (request, reply) => {
        const where = destination(request, reply, null);
        if (!where) return reply;

        const data = request.body as Buffer;
        if (!Buffer.isBuffer(data) || data.length === 0) return reply.code(400).send({ error: 'Vídeo vazio.' });
        if (data.length > MAX_RECADO_BYTES) {
          return reply.code(400).send({ error: `Um recado em vídeo pode ter até ${MAX_RECADO_BYTES / MB} MB.` });
        }
        const mime = sniffAttachmentMime(data);
        if (!mime.startsWith('video/')) return reply.code(400).send({ error: 'Isto não é um vídeo.' });

        const segundos = Math.min(Math.max(Number(request.query.segundos) || 0, 0), MAX_RECADO_SEGUNDOS);
        const vence = new Date(Date.now() + DIAS_DO_RECADO * 24 * 60 * 60 * 1000).toISOString();
        const message = db.createMessage(where.channel.id, request.user.id, '', null);
        message.attachments.push(
          db.addAttachment(message.id, {
            name: safeName(request.query.nome ?? 'Recado em vídeo.webm'),
            mime,
            data,
            width: null,
            height: null,
            expiresAt: vence,
          }),
        );
        void segundos;
        return publish(where.channel, message);
      },
    );

    // ---------- Mensagem com arquivos ----------

    authed.post<{
      Params: { id: string };
      Body: { content?: string; threadId?: number; files?: { name?: string; data?: string; width?: number; height?: number }[] };
    }>('/api/channels/:id/messages', { bodyLimit: UPLOAD_BODY_LIMIT }, async (request, reply) => {
      const where = destination(request, reply, request.body?.threadId);
      if (!where) return reply;

      const content = String(request.body?.content ?? '').trim();
      const files = Array.isArray(request.body?.files) ? request.body.files : [];
      if (files.length === 0) return reply.code(400).send({ error: 'Nenhum arquivo para enviar.' });
      if (files.length > MAX_FILES_PER_MESSAGE) {
        return reply.code(400).send({ error: `Dá para mandar até ${MAX_FILES_PER_MESSAGE} arquivos por mensagem.` });
      }
      if (content.length > 2000) return reply.code(400).send({ error: 'Mensagem longa demais.' });

      // Decodifica tudo antes de gravar: se um arquivo não presta, nada é criado pela metade.
      const prepared: db.NewAttachment[] = [];
      for (const file of files) {
        const data = decodeDataUrl(file?.data, MAX_ATTACHMENT_BYTES);
        if (typeof data === 'string') return reply.code(400).send({ error: data });
        prepared.push({
          name: safeName(file?.name),
          mime: sniffAttachmentMime(data),
          data,
          width: dimension(file?.width),
          height: dimension(file?.height),
        });
      }

      const message = db.createMessage(where.channel.id, request.user.id, content, where.threadId);
      for (const file of prepared) message.attachments.push(db.addAttachment(message.id, file));
      return publish(where.channel, message);
    });

    // ---------- Enquetes ----------

    authed.post<{ Params: { id: string }; Body: { question?: string; options?: string[]; multiple?: boolean; threadId?: number } }>(
      '/api/channels/:id/polls',
      async (request, reply) => {
        const where = destination(request, reply, request.body?.threadId);
        if (!where) return reply;

        const question = String(request.body?.question ?? '').trim();
        if (question.length < 1 || question.length > 300) {
          return reply.code(400).send({ error: 'A pergunta deve ter de 1 a 300 caracteres.' });
        }
        const options = (Array.isArray(request.body?.options) ? request.body.options : [])
          .map((option) => String(option ?? '').trim().slice(0, 100))
          .filter((option) => option.length > 0);
        if (options.length < 2) return reply.code(400).send({ error: 'A enquete precisa de pelo menos duas opções.' });
        if (options.length > MAX_POLL_OPTIONS) {
          return reply.code(400).send({ error: `A enquete pode ter até ${MAX_POLL_OPTIONS} opções.` });
        }

        const message = db.createMessage(where.channel.id, request.user.id, '', where.threadId);
        const pollId = db.createPoll(message.id, question, options, request.body?.multiple === true);
        message.poll = db.pollState(pollId, request.user.id)!;
        return publish(where.channel, message);
      },
    );

    /** O canal de uma mensagem/enquete/tópico, já conferindo que a pessoa pode mexer ali. */
    function channelFor(channelId: number, user: db.User): db.Channel | null {
      const channel = db.findChannel(channelId);
      return channel && canUseChannel(user, channel) ? channel : null;
    }

    /**
     * Em conversa privada não existe administrador: vale só quem criou a coisa.
     *
     * Quem cuida do Syden também alcança aqui — é obrigação de quem opera o serviço poder tirar do ar
     * conteúdo ilegal sem esperar o dono da comunidade acordar —, mas por um caminho separado e registrado
     * na auditoria, e não por ser confundido com administrador daquela comunidade.
     */
    const managesChannel = (channel: db.Channel, user: db.User) =>
      channel.communityId !== null && manages(roleIn(user, channel.communityId));

    const podeModerarMensagem = (channel: db.Channel, user: db.User, oQue: string) =>
      managesChannel(channel, user) ||
      poderDeOperador(user, 'moderacao.mensagem', { target: oQue, communityId: channel.communityId, detail: `canal ${channel.name}` });

    /** Votar de novo na mesma opção tira o voto, como no Discord. */
    authed.post<{ Params: { id: string }; Body: { optionId?: number } }>('/api/polls/:id/vote', async (request, reply) => {
      const poll = db.findPoll(Number(request.params.id));
      const channel = poll && channelFor(poll.channelId, request.user);
      if (!poll || !channel) return reply.code(404).send({ error: 'Enquete não encontrada.' });
      if (poll.closed) return reply.code(400).send({ error: 'Esta enquete já foi encerrada.' });
      const optionId = Number(request.body?.optionId);
      if (!db.optionBelongsToPoll(poll.id, optionId)) return reply.code(400).send({ error: 'Opção inválida.' });

      db.votePoll(poll.id, optionId, request.user.id, poll.multiple);
      const state = db.pollState(poll.id, request.user.id)!;
      // Para os outros vai só a contagem: quem votou no quê é de cada um.
      io.to(channelRoom(channel)).emit('poll:tally', {
        pollId: poll.id,
        channelId: poll.channelId,
        closed: state.closed,
        voters: state.voters,
        options: state.options.map(({ id, votes }) => ({ id, votes })),
      });
      return state;
    });

    authed.post<{ Params: { id: string } }>('/api/polls/:id/close', async (request, reply) => {
      const poll = db.findPoll(Number(request.params.id));
      const channel = poll && channelFor(poll.channelId, request.user);
      if (!poll || !channel) return reply.code(404).send({ error: 'Enquete não encontrada.' });
      if (poll.createdBy !== request.user.id && !podeModerarMensagem(channel, request.user, 'enquete ' + poll.id)) {
        return reply.code(403).send({ error: 'Só quem criou a enquete ou quem administra a comunidade pode encerrá-la.' });
      }
      db.closePoll(poll.id);
      const state = db.pollState(poll.id, request.user.id)!;
      io.to(channelRoom(channel)).emit('poll:tally', {
        pollId: poll.id,
        channelId: poll.channelId,
        closed: true,
        voters: state.voters,
        options: state.options.map(({ id, votes }) => ({ id, votes })),
      });
      return state;
    });

    // ---------- Tópicos ----------

    authed.post<{ Params: { id: string }; Body: { title?: string } }>('/api/messages/:id/thread', async (request, reply) => {
      const message = db.findMessage(Number(request.params.id));
      const channel = message && channelFor(message.channelId, request.user);
      if (!message || !channel) return reply.code(404).send({ error: 'Mensagem não encontrada.' });
      if (message.threadId !== null) return reply.code(400).send({ error: 'Não dá para abrir um tópico dentro de outro.' });

      const existing = db.findThreadByMessage(message.id);
      if (existing) return existing; // outra pessoa criou primeiro: abre o que já existe

      const title = String(request.body?.title ?? '').trim().slice(0, 100);
      if (title.length < 1) return reply.code(400).send({ error: 'Dê um nome ao tópico.' });
      const thread = db.createThread(message.channelId, message.id, title, request.user.id);
      io.to(channelRoom(channel)).emit('thread:created', { ...thread, communityId: channel.communityId });
      return thread;
    });

    authed.get<{ Params: { id: string }; Querystring: { before?: string } }>('/api/threads/:id/messages', async (request, reply) => {
      const location = db.threadLocation(Number(request.params.id));
      if (!location || !channelFor(location.channelId, request.user)) {
        return reply.code(404).send({ error: 'Tópico não encontrado.' });
      }
      const before = request.query.before ? Number(request.query.before) : undefined;
      return db.listThreadMessages(location.id, before, request.user.id);
    });

    authed.delete<{ Params: { id: string } }>('/api/threads/:id', async (request, reply) => {
      const location = db.threadLocation(Number(request.params.id));
      const channel = location && channelFor(location.channelId, request.user);
      if (!location || !channel) return reply.code(404).send({ error: 'Tópico não encontrado.' });
      if (location.createdBy !== request.user.id && !podeModerarMensagem(channel, request.user, 'tópico ' + location.id)) {
        return reply.code(403).send({ error: 'Só quem criou o tópico ou quem administra a comunidade pode apagá-lo.' });
      }
      const thread = db.findThread(location.id);
      db.deleteThread(location.id);
      io.to(channelRoom(channel)).emit('thread:deleted', {
        id: location.id,
        channelId: location.channelId,
        parentMessageId: thread?.parentMessageId ?? null,
      });
      return { ok: true };
    });

    // ---------- Reações ----------

    /**
     * :nome: de um emoji da comunidade, ou um emoji comum curto (👍, ❤️, 🎉…). Em conversa privada não há
     * comunidade, então lá só valem os emojis comuns — o outro lado não teria de onde carregar a imagem.
     */
    function validReaction(raw: unknown, communityId: number | null): string | null {
      const value = String(raw ?? '').trim();
      const customName = /^:([a-z0-9_]{2,32}):$/.exec(value);
      if (customName) {
        return communityId !== null && db.emojiNameTaken(communityId, customName[1]) ? `:${customName[1]}:` : null;
      }
      // Emoji comum: no máximo um punhado de pontos de código (cobre bandeiras, tom de pele, ZWJ).
      return value.length >= 1 && [...value].length <= 8 ? value : null;
    }

    authed.post<{ Params: { id: string }; Body: { emoji?: string } }>('/api/messages/:id/reactions', async (request, reply) => {
      const message = db.findMessage(Number(request.params.id));
      const channel = message && channelFor(message.channelId, request.user);
      if (!message || !channel) return reply.code(404).send({ error: 'Mensagem não encontrada.' });
      const emoji = validReaction(request.body?.emoji, channel.communityId);
      if (!emoji) return reply.code(400).send({ error: 'Emoji inválido.' });

      db.toggleReaction(message.id, emoji, request.user.id);
      io.to(channelRoom(channel)).emit('reaction:updated', {
        messageId: message.id,
        channelId: message.channelId,
        threadId: message.threadId,
        reactions: db.reactionCounts(message.id),
      });
      // Só para quem agiu: a lista já com "mine" certo, pronta para substituir o estado local.
      return db.reactionsForMessage(message.id, request.user.id);
    });
  });
}
