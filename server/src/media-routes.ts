import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Server as IOServer } from 'socket.io';
import * as db from './db.js';
import { shaDeArquivo } from './arquivos.js';
import { entregarArquivo } from './entregar.js';
import { restorePack } from './expressions.js';
import { parseMedia, parseMediaConferida, sniffMime } from './media.js';
import { communityRoom } from './realtime.js';
import { nomeDeEmoji } from './nome-do-emoji.js';
import { codigo as codigoDoCoelho, lerCodigo } from './coelho-receita.js';
import { cotaEsgotada, manages, requireUser, roleIn } from './routes.js';

/**
 * O volume de um som, de 0,1 a 1 (ver a coluna em db.ts). Sem valor válido, fica o que já era. O piso
 * de 10% é para "baixar" nunca virar "sumir": som mudo no soundboard parece defeito.
 */
export function volumeDoSom(bruto: unknown, atual: number): number {
  const valor = Number(bruto);
  if (bruto === undefined || bruto === null || !Number.isFinite(valor)) return atual;
  return Math.round(Math.min(1, Math.max(0.1, valor)) * 100) / 100;
}

const KB = 1024;
// A CAPA É A MAIOR DE TODAS, e com motivo: ela é uma faixa larga que a pessoa olha de perto, e
// comprimir uma foto de 960 pixels de largura até caber em 2 MB deixa artefato visível. Quatro
// megabytes é o teto do que o navegador manda depois de redimensionar (ver web/src/upload.ts).
// O avatar vai a 5 MB por causa do GIF animado (pedido dele, 04/11/2026: "o limite de 2 MB pegou vários GIFs entre 2 e 3 MB");
// o ícone da comunidade fica nos 2 de antes.
const LIMITS = { avatar: 5120 * KB, icone: 2048 * KB, capa: 4096 * KB, emoji: 512 * KB, sound: 1024 * KB };
const UPLOAD_BODY_LIMIT = 7 * 1024 * KB; // base64 ocupa ~33% a mais que o arquivo, e o avatar vai a 5 MB

/** "Coração Feliz" → "coracao_feliz", o formato usado em :nome: nas mensagens. */
const emojiName = nomeDeEmoji;

/**
 * QUANTAS IMAGENS POR LINK uma pessoa pede ao servidor buscar (04/11/2026, ao abrir o avatar por link a todo mundo): cada
 * pedido faz o servidor baixar até 3 MB de um site qualquer. Sem um teto, uma conta só faria o Syden buscar sem parar — gastando
 * a internet do servidor e usando-o para bater em sites de terceiros. Cinco por minuto sobram para quem está escolhendo.
 */
const LINKS_POR_MINUTO = 5;
const linksPedidos = new Map<number, number[]>();
export function muitosLinks(userId: number, agora = Date.now()): boolean {
  const recentes = (linksPedidos.get(userId) ?? []).filter((t) => agora - t < 60_000);
  if (recentes.length >= LINKS_POR_MINUTO) {
    linksPedidos.set(userId, recentes);
    return true;
  }
  recentes.push(agora);
  linksPedidos.set(userId, recentes);
  return false;
}
const MUITOS_LINKS = 'Muitos links seguidos. Tente de novo daqui a pouco.';

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
  // O avatar anterior (09/11/2026): pela chave do endereço, que só a dona recebe (GET /api/me/avatares-anteriores).
  app.get<{ Params: { id: string; chave: string } }>('/api/avatares-anteriores/:id/:chave', async (request, reply) => {
    const arquivo = db.arquivoDoAvatarAnterior(Number(request.params.id), String(request.params.chave));
    if (!arquivo) return reply.code(404).send({ error: 'Avatar não encontrado.' });
    return entregarArquivo(request, reply, arquivo, { 'content-disposition': 'inline' });
  });
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

    // O avatar por LINK (04/11/2026): o servidor baixa e guarda, como a capa (o porquê está no alto de buscarImagem.ts), e
    // aceita o link da página do GIF (Tenor, GIPHY), não só o do arquivo. Vai inteiro, como o GIF enviado do computador.
    authed.put<{ Body: { url?: string } }>('/api/me/avatar/endereco', async (request, reply) => {
      if (cotaEsgotada(request, reply)) return reply;
      if (muitosLinks(request.user.id)) return reply.code(429).send({ error: MUITOS_LINKS });
      const { baixarImagemOuDaPagina } = await import('./buscarImagem.js');
      const baixada = await baixarImagemOuDaPagina(request.body?.url, LIMITS.avatar);
      if (!baixada.startsWith('data:')) return reply.code(400).send({ error: baixada });
      const media = await parseMediaConferida(baixada, 'image', LIMITS.avatar, 'avatar', request.user.id);
      if (typeof media === 'string') return reply.code(400).send({ error: media });
      const user = db.setAvatar(request.user.id, media);
      io.emit('user:updated', user);
      return user;
    });

    // O coelho pronto: só o número, sem imagem nenhuma subindo (o desenho já mora no site).
    authed.put<{ Body: { numero?: unknown } }>('/api/me/avatar-pronto', async (request, reply) => {
      const numero = request.body?.numero;
      if (typeof numero !== 'number' || !Number.isInteger(numero) || numero < 1 || numero > db.COELHOS_PRONTOS) {
        return reply.code(400).send({ error: 'Esse coelho não existe.' });
      }
      const user = db.setAvatarPronto(request.user.id, numero);
      io.emit('user:updated', user);
      return user;
    });

    // O COELHO DO CRIADOR (10/11/2026, pedido dele): a receita (o corpo, as cores, os acessórios), e o número da sugestão
    // quando a pessoa escolheu uma das 16 sem mexer (aí o avatar continua o desenho pronto dela). Guardada já canônica.
    authed.put<{ Body: { codigo?: unknown; pronto?: unknown } }>('/api/me/coelho', async (request, reply) => {
      const receita = lerCodigo(request.body?.codigo);
      if (!receita) return reply.code(400).send({ error: 'Esse código não é de um coelho do Syden.' });
      const pronto = request.body?.pronto;
      if (pronto !== undefined && pronto !== null && (typeof pronto !== 'number' || !Number.isInteger(pronto) || pronto < 1 || pronto > db.COELHOS_PRONTOS)) {
        return reply.code(400).send({ error: 'Esse coelho não existe.' });
      }
      const user = db.setCoelho(request.user.id, codigoDoCoelho(receita), (pronto as number | null | undefined) ?? null);
      io.emit('user:updated', user);
      return user;
    });

    // "MEUS COELHOS" (10/11/2026, pedido dele: "criar determinado perfil e permitir copiar código"): receitas com nome,
    // na conta (e não no aparelho), até 12. A lista vai inteira a cada mudança; cada código é conferido e guardado canônico.
    authed.get('/api/me/coelhos-salvos', async (request) => db.coelhosSalvos(request.user.id));
    authed.put<{ Body: { lista?: unknown } }>('/api/me/coelhos-salvos', async (request, reply) => {
      const lista = request.body?.lista;
      if (!Array.isArray(lista) || lista.length > db.COELHOS_SALVOS_MAXIMO) return reply.code(400).send({ error: 'Lista de coelhos inválida.' });
      const limpa: { nome: string; codigo: string }[] = [];
      for (const item of lista as { nome?: unknown; codigo?: unknown }[]) {
        const receita = lerCodigo(item?.codigo);
        const nome = typeof item?.nome === 'string' ? item.nome.trim().slice(0, 24) : '';
        if (!receita || !nome) return reply.code(400).send({ error: 'Lista de coelhos inválida.' });
        limpa.push({ nome, codigo: codigoDoCoelho(receita) });
      }
      db.guardarCoelhosSalvos(request.user.id, limpa);
      return limpa;
    });

    // OS AVATARES ANTERIORES (09/11/2026, pedido dele): os últimos 5 que a pessoa trocou, para voltar a um deles.
    authed.get('/api/me/avatares-anteriores', async (request) => db.avataresAnteriores(request.user.id));
    authed.put<{ Body: { id?: unknown } }>('/api/me/avatar/anterior', async (request, reply) => {
      const id = request.body?.id;
      if (typeof id !== 'number' || !Number.isInteger(id)) return reply.code(400).send({ error: 'Avatar não encontrado.' });
      const user = db.voltarAoAvatarAnterior(request.user.id, id);
      if (!user) return reply.code(404).send({ error: 'Avatar não encontrado.' });
      io.emit('user:updated', user);
      return user;
    });
    authed.delete<{ Params: { id: string } }>('/api/me/avatares-anteriores/:id', async (request, reply) => {
      if (!db.apagarAvatarAnterior(request.user.id, Number(request.params.id))) return reply.code(404).send({ error: 'Avatar não encontrado.' });
      return { ok: true };
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
        const media = await parseMediaConferida(request.body?.image, 'image', LIMITS.icone, 'icone-comunidade', access.communityId);
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

        if (muitosLinks(request.user.id)) return reply.code(429).send({ error: MUITOS_LINKS });
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
        // O mesmo áudio duas vezes na comunidade vira dois botões iguais no soundboard de todo mundo.
        const igual = db.somDaComunidadeComOAudio(access.communityId, shaDeArquivo(media.data));
        if (igual) return reply.code(409).send({ error: `Esse som já está no soundboard: «${igual.name}».` });
        const sound = db.createSound(access.communityId, name, icon, media.mime, media.data, request.user.id);
        io.to(communityRoom(access.communityId)).emit('sound:created', sound);
        return sound;
      },
    );

    authed.patch<{ Params: { id: string }; Body: { name?: string; icon?: string; volume?: number } }>('/api/sounds/:id', async (request, reply) => {
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
      const updated = db.updateSound(sound.id, name, icon, volumeDoSom(request.body?.volume, sound.volume));
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
