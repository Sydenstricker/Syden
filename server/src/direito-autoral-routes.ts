/**
 * RETIRADA POR DIREITO AUTORAL (11/10/2026).
 *
 * Os termos (web/site/termos.html, seção 4) prometem a quem escreve para direitos@syden.chat: o conteúdo é
 * RETIRADO, quem o publicou é AVISADO do motivo e pode contestar, e a REINCIDÊNCIA custa a conta. Até aqui
 * só a promessa existia — cumpri-la era mexer no banco à mão. Estas rotas são o lado de dentro:
 *
 *   - procurar pelo nome (é o que o e-mail traz: "o que é e onde está"): sons, músicas, emojis (de comunidade
 *     e de pacote) e anexos dos canais de comunidade — nunca de conversa privada;
 *   - retirar: apaga COM AS CÓPIAS do mesmo arquivo, some da tela de quem tinha, fica registrado e quem subiu
 *     recebe o aviso;
 *   - o histórico, com quantas vezes cada pessoa já teve conteúdo retirado — o número que decide a conta.
 *
 * O AVISO SAI DE QUEM RETIROU, numa conversa privada, e não da conta do Syden: ela não tem conversa privada
 * (ver contaDoSyden, em db.ts), e é justamente a resposta de quem subiu ("eu tinha o direito") que os termos
 * mandam ouvir. O texto vem da tela já pronto e EDITÁVEL: quem retira pode escrever na língua da pessoa.
 *
 * Banir não é automático. A tela mostra a reincidência; quem decide é uma pessoa.
 */
import type { FastifyInstance } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import * as db from './db.js';
import { channelRoom, communityRoom, directRoom, emitToUser, joinDirectRoom } from './realtime.js';
import { requireUser } from './routes.js';

const TIPOS: db.TipoRetiravel[] = ['som', 'musica', 'emoji', 'emoji-pacote', 'anexo'];

export function registerDireitoAutoralRoutes(app: FastifyInstance, io: IOServer) {
  app.register(async (authed) => {
    authed.addHook('preHandler', requireUser);
    authed.addHook('preHandler', async (request, reply) => {
      if (!request.user.isAdmin) return reply.code(403).send({ error: 'Só quem cuida do Syden retira conteúdo por direito autoral.' });
    });

    authed.get<{ Querystring: { q?: string } }>('/api/direito-autoral/procurar', async (request, reply) => {
      const termo = String(request.query?.q ?? '').trim();
      if (termo.length < 2) return reply.code(400).send({ error: 'Escreva pelo menos duas letras do nome.' });
      return db.procurarRetiravel(termo);
    });

    authed.get('/api/direito-autoral', async () => db.listarRetiradas());

    authed.post<{ Body: { tipo?: string; id?: number; reclamante?: string; aviso?: string } }>(
      '/api/direito-autoral/retirar',
      async (request, reply) => {
        const tipo = request.body?.tipo as db.TipoRetiravel;
        if (!TIPOS.includes(tipo)) return reply.code(400).send({ error: 'Tipo de conteúdo inválido.' });
        const reclamante = String(request.body?.reclamante ?? '').trim().slice(0, 300);
        if (reclamante.length < 3) return reply.code(400).send({ error: 'Diga quem reclamou: é isso que fica registrado.' });
        const aviso = String(request.body?.aviso ?? '').trim().slice(0, 2000);

        const conteudo = db.acharRetiravel(tipo, Number(request.body?.id));
        if (!conteudo) return reply.code(404).send({ error: 'Esse conteúdo não existe mais.' });

        // 1. Retirar — com as cópias do mesmo arquivo — e sumir da tela de quem tinha, pelos mesmos avisos
        // que a exclusão comum usa.
        const saiu = db.retirarComCopias(conteudo);
        for (const item of saiu) {
          if (item.tipo === 'som') {
            if (item.communityId !== null) {
              io.to(communityRoom(item.communityId)).emit('sound:deleted', { id: item.id, communityId: item.communityId });
            } else if (item.packId !== null) {
              // Som de pacote mora no soundboard de quem instalou, em qualquer comunidade.
              for (const userId of db.quemInstalou(item.packId)) emitToUser(io, userId, 'sound:deleted', { id: item.id, communityId: null });
            }
          } else if (item.tipo === 'musica') {
            io.to(communityRoom(item.communityId!)).emit('karaoke:deleted', { id: item.id, communityId: item.communityId });
          } else if (item.tipo === 'emoji') {
            io.to(communityRoom(item.communityId!)).emit('emoji:deleted', { id: item.id, communityId: item.communityId });
          } else if (item.tipo === 'anexo') {
            const canal = db.findChannel(item.channelId!);
            if (!canal) continue;
            if (item.mensagemApagada) io.to(channelRoom(canal)).emit('message:deleted', { id: item.messageId, channelId: item.channelId, threadId: null });
            else io.to(channelRoom(canal)).emit('attachment:removed', { id: item.id, messageId: item.messageId, channelId: item.channelId });
          }
          // Item de pacote de emojis não tem tela aberta para avisar: ele só aparece no catálogo, que relê.
        }
        const copias = Math.max(0, saiu.length - 1);

        // 2. O registro: é ele que conta a reincidência, e a auditoria responde "por que isto sumiu?".
        db.registrarRetirada(conteudo, reclamante, request.user.username, copias);
        db.registrarAuditoria({
          actor: request.user,
          action: 'retirada por direito autoral',
          target: `${conteudo.tipo} «${conteudo.nome}» (${conteudo.onde})`,
          communityId: conteudo.communityId,
          detail: `Reclamação de ${reclamante}${copias ? ` · mais ${copias} cópia(s) do mesmo arquivo` : ''}`,
        });

        // 3. O aviso a quem subiu. Sem autor conhecido (conta apagada) ou sendo a própria pessoa, não há a quem.
        let avisado = false;
        const autor = conteudo.autorId === null ? undefined : db.findUserById(conteudo.autorId);
        if (autor && aviso && autor.id !== request.user.id && !db.ehContaDoSistema(autor.id)) {
          const existente = db.findDirectBetween(request.user.id, autor.id);
          const conversa = existente ?? db.createDirectChannel('', request.user.id, [autor.id]);
          for (const userId of [request.user.id, autor.id]) {
            joinDirectRoom(io, userId, conversa.id);
            const daPessoa = db.listDirectChannels(userId).find((c) => c.id === conversa.id);
            if (daPessoa) emitToUser(io, userId, existente ? 'direct:updated' : 'direct:created', daPessoa);
          }
          const mensagem = db.createMessage(conversa.id, request.user.id, aviso);
          io.to(directRoom(conversa.id)).emit('message:new', {
            ...(db.findMessageFull(mensagem.id, request.user.id) ?? mensagem),
            communityId: null,
          });
          avisado = true;
        }

        return { ok: true, avisado, copias, retiradasDoAutor: db.retiradasDe(conteudo.autorId) };
      },
    );
  });
}
