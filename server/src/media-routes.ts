import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import * as db from './db.js';
import { entregarArquivo } from './entregar.js';
import { restorePack } from './expressions.js';
import { parseMedia, parseMediaConferida, sniffMime } from './media.js';
import { communityRoom } from './realtime.js';
import { cotaEsgotada, manages, requireUser, roleIn } from './routes.js';

const KB = 1024;
// A CAPA É A MAIOR DE TODAS, e com motivo: ela é uma faixa larga que a pessoa olha de perto, e
// comprimir uma foto de 960 pixels de largura até caber em 2 MB deixa artefato visível. Quatro
// megabytes é o teto do que o navegador manda depois de redimensionar (ver web/src/upload.ts).
const LIMITS = { avatar: 2048 * KB, capa: 4096 * KB, emoji: 512 * KB, sound: 1024 * KB }; // avatar maior por causa de GIF animado
const UPLOAD_BODY_LIMIT = 6 * 1024 * KB; // base64 ocupa ~33% a mais que o arquivo, e a capa vai a 4 MB

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
    entregarArquivo(request, reply, db.findAvatar(Number(request.params.id))),
  );
  app.get<{ Params: { id: string } }>('/api/communities/:id/icon', async (request, reply) =>
    entregarArquivo(request, reply, db.findCommunityIcon(Number(request.params.id))),
  );
  app.get<{ Params: { id: string } }>('/api/communities/:id/capa', async (request, reply) =>
    entregarArquivo(request, reply, db.findCommunityBanner(Number(request.params.id))),
  );
  app.get<{ Params: { id: string } }>('/api/emojis/:id/image', async (request, reply) =>
    entregarArquivo(request, reply, db.findEmojiFile(Number(request.params.id))),
  );
  app.get<{ Params: { id: string } }>('/api/sounds/:id/audio', async (request, reply) =>
    entregarArquivo(request, reply, db.findSoundFile(Number(request.params.id))),
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
      if (cotaEsgotada(request, reply)) return reply;
      const media = await parseMediaConferida(request.body?.image, 'image', LIMITS.avatar, 'avatar', request.user.id);
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
        const media = await parseMediaConferida(request.body?.image, 'image', LIMITS.avatar, 'icone-comunidade', access.communityId);
        if (typeof media === 'string') return reply.code(400).send({ error: media });
        const community = db.setCommunityIcon(access.communityId, media);
        io.to(communityRoom(community.id)).emit('community:updated', community);
        return community;
      },
    );

    // ---------- Capa da comunidade ----------
    //
    // A MESMA PORTA DO ÍCONE, de propósito: parseMediaConferida é o funil por onde toda imagem
    // enviada passa, e é ele que confere a foto contra a base de abuso infantil antes de ela ficar
    // disponível (ver server/src/media.ts). Uma rota de imagem que não passe por aqui é uma porta
    // dos fundos, e o dia em que alguém criar uma vai ser por esquecimento.
    authed.put<{ Params: { id: string }; Body: { image?: string } }>(
      '/api/communities/:id/capa',
      { bodyLimit: UPLOAD_BODY_LIMIT },
      async (request, reply) => {
        const access = requireRole(request, reply);
        if (!access) return reply;
        if (!manages(access.role)) return reply.code(403).send({ error: 'Só quem administra a comunidade pode trocar a capa.' });
        const media = await parseMediaConferida(request.body?.image, 'image', LIMITS.capa, 'capa-comunidade', access.communityId);
        if (typeof media === 'string') return reply.code(400).send({ error: media });
        const community = db.setCommunityBanner(access.communityId, media);
        io.to(communityRoom(community.id)).emit('community:updated', community);
        return community;
      },
    );

    /**
     * A MESMA CAPA, VINDA DE UM ENDEREÇO — o GIPHY, o gifer, qualquer lugar.
     *
     * A ÚNICA DIFERENÇA ENTRE ESTA ROTA E A DE CIMA SÃO DUAS LINHAS: aqui os bytes são buscados em
     * vez de recebidos. Do `parseMediaConferida` em diante é o mesmo caminho — mesmo limite, mesmo
     * escudo contra material conhecido, mesma entrega por api.syden.chat. É de propósito: uma rota
     * de imagem que não passe por aquele funil é uma porta dos fundos.
     *
     * O SERVIDOR BAIXA E GUARDA, em vez de a tela apontar para fora. O porquê, com os quatro
     * motivos, está no alto de buscarImagem.ts — e o primeiro deles é que apontar entregaria o
     * endereço de rede de cada membro ao dono do site.
     */
    authed.put<{ Params: { id: string }; Body: { url?: string } }>(
      '/api/communities/:id/capa/endereco',
      async (request, reply) => {
        const access = requireRole(request, reply);
        if (!access) return reply;
        if (!manages(access.role)) return reply.code(403).send({ error: 'Só quem administra a comunidade pode trocar a capa.' });

        const { baixarImagem } = await import('./buscarImagem.js');
        const baixada = await baixarImagem(request.body?.url, LIMITS.capa);
        if (!baixada.startsWith('data:')) return reply.code(400).send({ error: baixada });

        const media = await parseMediaConferida(baixada, 'image', LIMITS.capa, 'capa-comunidade', access.communityId);
        if (typeof media === 'string') return reply.code(400).send({ error: media });
        const community = db.setCommunityBanner(access.communityId, media);
        io.to(communityRoom(community.id)).emit('community:updated', community);
        return community;
      },
    );

    /**
     * COMO A CAPA SE ENCAIXA. Não troca a imagem, só o jeito de mostrá-la.
     *
     * Rota à parte da que envia, de propósito: isto se mexe várias vezes seguidas até ficar bom, e
     * reenviar quatro megabytes de GIF a cada arrastada da régua seria absurdo.
     */
    authed.put<{ Params: { id: string }; Body: { encaixe?: string; posicao?: number } }>(
      '/api/communities/:id/capa/ajuste',
      async (request, reply) => {
        const access = requireRole(request, reply);
        if (!access) return reply;
        if (!manages(access.role)) return reply.code(403).send({ error: 'Só quem administra a comunidade pode trocar a capa.' });
        const community = db.setCommunityCapaAjuste(
          access.communityId,
          String(request.body?.encaixe ?? ''),
          Number(request.body?.posicao ?? 50),
        );
        io.to(communityRoom(community.id)).emit('community:updated', community);
        return community;
      },
    );

    /**
     * A LETRA DO NOME DA COMUNIDADE.
     *
     * O servidor guarda só o CÓDIGO, e não a pilha de fontes: quem conhece as famílias é o site
     * (web/src/fontesDaComunidade.ts). Mesma regra das molduras e dos efeitos de nome — trocar uma
     * pilha passa a ser publicar o site, sem migrar banco. Código que o site não conhece some na
     * tela em vez de virar um font-family inventado.
     */
    authed.put<{ Params: { id: string }; Body: { fonte?: string; efeito?: string } }>(
      '/api/communities/:id/fonte',
      async (request, reply) => {
        const access = requireRole(request, reply);
        if (!access) return reply;
        if (!manages(access.role)) return reply.code(403).send({ error: 'Só quem administra a comunidade pode trocar a letra do nome.' });
        const community = db.setCommunityFonte(
          access.communityId,
          String(request.body?.fonte ?? ''),
          String(request.body?.efeito ?? ''),
        );
        io.to(communityRoom(community.id)).emit('community:updated', community);
        return community;
      },
    );

    authed.delete<{ Params: { id: string } }>('/api/communities/:id/capa', async (request, reply) => {
      const access = requireRole(request, reply);
      if (!access) return reply;
      if (!manages(access.role)) return reply.code(403).send({ error: 'Só quem administra a comunidade pode tirar a capa.' });
      const community = db.setCommunityBanner(access.communityId, null);
      io.to(communityRoom(community.id)).emit('community:updated', community);
      return community;
    });

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
        const media = await parseMediaConferida(request.body?.image, 'image', LIMITS.emoji, 'emoji', access.communityId);
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

    /**
     * BUSCA UM SOM PELO ENDEREÇO COLADO (um link do MyInstants, por exemplo) e o DEVOLVE, sem guardar.
     *
     * Não guarda de propósito: o som volta para a tela da pessoa e entra pelo mesmo envio de quem
     * escolheu um arquivo no computador. Assim ele continua sendo algo que ELA subiu, com o nome dela
     * como autora — o Syden só fez o download que ela faria à mão.
     */
    authed.post<{ Body: { url?: string } }>('/api/sons/do-endereco', async (request, reply) => {
      const { baixarSom, nomeDoSom } = await import('./buscarImagem.js');
      const dados = await baixarSom(request.body?.url, LIMITS.sound);
      if (typeof dados === 'string') return reply.code(400).send({ error: dados });
      const mime = sniffMime(dados);
      if (!mime?.startsWith('audio/')) return reply.code(400).send({ error: 'Esse endereço não é de um arquivo de áudio.' });
      return { audio: `data:${mime};base64,${dados.toString('base64')}`, nome: nomeDoSom(String(request.body?.url)) };
    });

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
