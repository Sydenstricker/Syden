// Conversas privadas: entre duas pessoas ou em grupo. Por baixo são canais sem comunidade (type 'dm'),
// então herdam mensagens, anexos, reações, enquetes e tópicos do resto do chat sem código novo.
import type { FastifyInstance } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import * as db from './db.js';
import { INSIGNIAS, entregar } from './presentes.js';
import { anunciarPerfil, directRoom, emitToUser, joinDirectRoom, leaveDirectRoom } from './realtime.js';
import { requireUser } from './routes.js';

const MAX_GROUP_MEMBERS = 20;

export function registerDirectRoutes(app: FastifyInstance, io: IOServer) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);

    /** Só dá para conversar com quem divide alguma comunidade com você — nada de mensagem de estranho. */
    function sharesCommunity(a: number, b: number) {
      const mine = new Set(db.communityIdsForUser(a));
      return db.communityIdsForUser(b).some((id) => mine.has(id));
    }

    /** A conversa existe e você está nela? */
    function myConversation(id: number, userId: number) {
      const channel = db.findChannel(id);
      return channel && channel.type === 'dm' && db.isChannelMember(channel.id, userId) ? channel : null;
    }

    /** Avisa as abas de cada participante para a conversa aparecer na lista deles na hora. */
    function announce(channelId: number, event: string) {
      for (const userId of db.channelMemberIds(channelId)) {
        joinDirectRoom(io, userId, channelId);
        const mine = db.listDirectChannels(userId).find((c) => c.id === channelId);
        if (mine) emitToUser(io, userId, event, mine);
      }
    }

    authed.get('/api/direct', async (request) => db.listDirectChannels(request.user.id));

    // ---------- Sugestões da tela inicial ----------
    //
    // A pessoa escreve uma ideia na vila e ela chega ao dono do Syden como conversa privada comum — com
    // resposta, histórico e aviso de mensagem nova, sem caixa de correio separada para ninguém esquecer
    // de olhar. O dono responde ali mesmo e a pessoa vê a resposta na conversa.
    const ultimaSugestao = new Map<number, number>();
    const ESPERA_ENTRE_SUGESTOES = 30_000;

    authed.post<{ Body: { content?: string } }>('/api/suggestions', async (request, reply) => {
      const texto = String(request.body?.content ?? '').trim();
      if (texto.length < 4) return reply.code(400).send({ error: 'Escreva um pouco mais sobre a sua ideia.' });
      if (texto.length > 1500) return reply.code(400).send({ error: 'Ideia comprida demais: resuma em até 1500 letras.' });

      const dono = db.findOwner();
      if (!dono) return reply.code(503).send({ error: 'Não há ninguém para receber sugestões agora.' });
      if (dono.id === request.user.id) {
        return reply.code(400).send({ error: 'As sugestões chegam até você — não precisa mandar para si mesmo.' });
      }

      const agora = Date.now();
      const anterior = ultimaSugestao.get(request.user.id) ?? 0;
      if (agora - anterior < ESPERA_ENTRE_SUGESTOES) {
        return reply.code(429).send({ error: 'Calma aí: espere meio minuto antes de mandar outra.' });
      }

      const existente = db.findDirectBetween(request.user.id, dono.id);
      const conversa = existente ?? db.createDirectChannel('', request.user.id, [dono.id]);
      announce(conversa.id, existente ? 'direct:updated' : 'direct:created');

      // A marca diz de onde veio, para o dono separar ideia de conversa do dia a dia.
      const message = db.createMessage(conversa.id, request.user.id, `💡 Ideia pela tela inicial:\n${texto}`);
      db.createSuggestion(request.user.id, message.id, texto);
      io.to(directRoom(conversa.id)).emit('message:new', { ...db.findMessageFull(message.id, request.user.id) ?? message, communityId: null });

      // Resposta automática, na hora: quem escreveu precisa saber que a ideia chegou a alguém, sem
      // esperar o dono acordar. Ela não fecha assunto nenhum — a conversa continua aberta dos dois
      // lados, e é por ela que ele vai tirar dúvidas sobre a ideia.
      const recibo = db.createMessage(
        conversa.id,
        dono.id,
        `🤖 Recado automático: sua ideia chegou, obrigado! Vou ler com calma. Se eu tiver dúvida, pergunto por aqui mesmo — e se ela entrar no Syden, você vai saber na hora.`,
      );
      io.to(directRoom(conversa.id)).emit('message:new', { ...recibo, communityId: null });

      ultimaSugestao.set(request.user.id, agora);
      return { ok: true };
    });

    /**
     * O joinha do dono: a ideia entrou no Syden. Do lado de quem teve a ideia cai confete, a conversa
     * ganha o aviso e o perfil ganha mais uma medalha de contribuição.
     */
    authed.post<{ Params: { id: string } }>('/api/suggestions/:id/accept', async (request, reply) => {
      if (!request.user.isOwner) return reply.code(403).send({ error: 'Só quem cuida do Syden pode acolher uma ideia.' });
      const ideia = db.findSuggestion(Number(request.params.id));
      if (!ideia) return reply.code(404).send({ error: 'Ideia não encontrada.' });
      if (!db.acceptSuggestion(ideia.id)) return { ok: true }; // clique repetido: não conta duas vezes

      const mensagem = db.findMessage(ideia.messageId);
      if (mensagem) {
        const aviso = db.createMessage(
          mensagem.channelId,
          request.user.id,
          `🎉 Ideia acolhida! Isto entrou no Syden: "${ideia.content.slice(0, 200)}". Obrigado — acompanhe as novidades na tela inicial.`,
        );
        io.to(directRoom(mensagem.channelId)).emit('message:new', { ...aviso, communityId: null });
      }

      // A medalha entra no inventário de quem teve a ideia (a primeira vez; da segunda em diante só o
      // contador aumenta, e é ele que vira o número no canto da medalha).
      entregar(ideia.userId, INSIGNIAS.IDEIA, 'Ideia acolhida no Syden');
      // E a lista de membros de quem está junto é avisada, para a insígnia aparecer no perfil dela sem
      // ninguém precisar recarregar o Syden.
      anunciarPerfil(io, ideia.userId);

      // O confete cai na hora para quem estiver com o Syden aberto; quem não estiver vê ao entrar.
      emitToUser(io, ideia.userId, 'suggestion:accepted', { id: ideia.id, content: ideia.content });
      return { ok: true };
    });

    /** O que ainda não foi comemorado por esta pessoa (ela pode ter estado offline na hora do joinha). */
    authed.get('/api/suggestions/celebrations', async (request) => db.suggestionsToCelebrate(request.user.id));

    /** O confete caiu: não cai de novo. */
    authed.post<{ Params: { id: string } }>('/api/suggestions/:id/celebrated', async (request) => {
      db.markCelebrated(Number(request.params.id), request.user.id);
      return { ok: true };
    });


    /** Abre (ou reabre) uma conversa: sem nome e com uma pessoa só = conversa direta; com nome = grupo. */
    authed.post<{ Body: { userIds?: number[]; name?: string } }>('/api/direct', async (request, reply) => {
      const wanted = [...new Set((Array.isArray(request.body?.userIds) ? request.body.userIds : []).map(Number))].filter(
        (id) => Number.isInteger(id) && id !== request.user.id,
      );
      if (wanted.length === 0) return reply.code(400).send({ error: 'Escolha com quem você quer conversar.' });
      if (wanted.length + 1 > MAX_GROUP_MEMBERS) {
        return reply.code(400).send({ error: `Uma conversa em grupo cabe até ${MAX_GROUP_MEMBERS} pessoas.` });
      }
      for (const id of wanted) {
        if (!db.findUserById(id)) return reply.code(404).send({ error: 'Pessoa não encontrada.' });
        if (!sharesCommunity(request.user.id, id)) {
          return reply.code(403).send({ error: 'Você só pode conversar com quem está numa comunidade sua.' });
        }
      }

      const name = String(request.body?.name ?? '').trim().slice(0, 50);
      // Conversa de duas pessoas sem nome: se já existe, devolve a mesma em vez de criar outra.
      if (wanted.length === 1 && !name) {
        const existing = db.findDirectBetween(request.user.id, wanted[0]);
        if (existing) {
          announce(existing.id, 'direct:updated');
          return db.listDirectChannels(request.user.id).find((c) => c.id === existing.id);
        }
      }

      const channel = db.createDirectChannel(name, request.user.id, wanted);
      announce(channel.id, 'direct:created');
      return db.listDirectChannels(request.user.id).find((c) => c.id === channel.id);
    });

    /** Trocar o nome de um grupo (conversa de duas pessoas não tem nome). */
    authed.patch<{ Params: { id: string }; Body: { name?: string } }>('/api/direct/:id', async (request, reply) => {
      const channel = myConversation(Number(request.params.id), request.user.id);
      if (!channel) return reply.code(404).send({ error: 'Conversa não encontrada.' });
      if (db.channelMemberIds(channel.id).length <= 2) {
        return reply.code(400).send({ error: 'Conversa de duas pessoas não tem nome.' });
      }
      const name = String(request.body?.name ?? '').trim().slice(0, 50);
      if (!name) return reply.code(400).send({ error: 'Dê um nome ao grupo.' });
      db.renameChannel(channel.id, name);
      announce(channel.id, 'direct:updated');
      return { ok: true };
    });

    /** Chamar mais alguém para a conversa; a de duas pessoas vira grupo ao receber o terceiro. */
    authed.post<{ Params: { id: string }; Body: { userId?: number } }>('/api/direct/:id/members', async (request, reply) => {
      const channel = myConversation(Number(request.params.id), request.user.id);
      if (!channel) return reply.code(404).send({ error: 'Conversa não encontrada.' });
      const userId = Number(request.body?.userId);
      if (!db.findUserById(userId)) return reply.code(404).send({ error: 'Pessoa não encontrada.' });
      if (!sharesCommunity(request.user.id, userId)) {
        return reply.code(403).send({ error: 'Você só pode chamar quem está numa comunidade sua.' });
      }
      const members = db.channelMemberIds(channel.id);
      if (members.includes(userId)) return reply.code(409).send({ error: 'Essa pessoa já está na conversa.' });
      if (members.length + 1 > MAX_GROUP_MEMBERS) {
        return reply.code(400).send({ error: `Uma conversa em grupo cabe até ${MAX_GROUP_MEMBERS} pessoas.` });
      }

      // Uma conversa de duas pessoas não tem nome; virando grupo, ganha um para não ficar "sem título".
      if (members.length === 2 && !channel.name) db.renameChannel(channel.id, 'Grupo');
      db.addChannelMember(channel.id, userId);
      announce(channel.id, 'direct:created'); // para quem chegou, é conversa nova; para os outros, atualização
      return { ok: true };
    });

    authed.post<{ Params: { id: string } }>('/api/direct/:id/leave', async (request, reply) => {
      const channel = myConversation(Number(request.params.id), request.user.id);
      if (!channel) return reply.code(404).send({ error: 'Conversa não encontrada.' });
      db.removeChannelMember(channel.id, request.user.id);
      leaveDirectRoom(io, request.user.id, channel.id);
      emitToUser(io, request.user.id, 'direct:removed', { id: channel.id });
      // Conversa sem ninguém some junto com as mensagens; com gente, os outros só veem a lista mudar.
      if (db.channelMemberIds(channel.id).length === 0) db.deleteChannel(channel.id);
      else {
        announce(channel.id, 'direct:updated');
        io.to(directRoom(channel.id)).emit('direct:updated', { id: channel.id });
      }
      return { ok: true };
    });
  });
}
