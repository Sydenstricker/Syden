import type { Server as IOServer, Socket } from 'socket.io';
import { verifySession } from './auth.js';
import { barrarMensagem } from './automod.js';
import { responderComando } from './comandos-routes.js';
import * as db from './db.js';
import { pontuarMensagem, pontuarMinutoDeVoz } from './niveis.js';

/** Sala do socket com todo mundo que participa de uma comunidade. */
export const communityRoom = (communityId: number) => `community:${communityId}`;

/** Sala do socket de uma conversa privada (direta ou em grupo). */
export const directRoom = (channelId: number) => `dm:${channelId}`;

/**
 * Sala do socket de UMA PESSOA, juntando todas as abas e aparelhos dela.
 *
 * Serve para o que é dirigido à pessoa e não a um lugar — hoje, os pedidos de amizade. Sem ela,
 * avisar alguém exigiria varrer todos os sockets à procura dos que pertencem àquela conta.
 */
export const salaDaPessoa = (userId: number) => `user:${userId}`;

/** Para onde vai o aviso de uma mensagem: a comunidade toda, ou só quem está na conversa privada. */
export const channelRoom = (channel: { id: number; communityId: number | null }) =>
  channel.communityId === null ? directRoom(channel.id) : communityRoom(channel.communityId);

/** Status de presença, como no Discord. "invisivel" faz o cliente tratar a pessoa como offline (ver
 * web/src/MemberList.tsx) — a marcação em si é só de boa-fé, não é escondida de verdade no servidor. */
export type PresenceStatus = 'online' | 'ausente' | 'ocupado' | 'invisivel';
const PRESENCE_STATUSES: PresenceStatus[] = ['online', 'ausente', 'ocupado', 'invisivel'];
const isPresenceStatus = (value: unknown): value is PresenceStatus => PRESENCE_STATUSES.includes(value as PresenceStatus);

/**
 * "FULANO ESTÁ DIGITANDO": se este aviso pode sair, e para onde.
 *
 * Fica numa função à parte, e não dentro do evento, para ser testada sem abrir conexão (ver
 * server/test/digitando.test.ts). As regras:
 *   - só para quem pode escrever ali: participar da comunidade, ou estar na conversa privada — as
 *     mesmas de mandar mensagem;
 *   - NÃO para quem está invisível. O aviso diria "ela está aqui, escrevendo" justamente de quem
 *     escolheu não aparecer;
 *   - no máximo um a cada 2,5 s por pessoa e canal: o navegador manda enquanto a pessoa digita, e um
 *     cliente adulterado não transforma isso numa enxurrada para a comunidade inteira.
 */
const INTERVALO_DE_DIGITACAO_MS = 2500;
const ultimoAvisoDeDigitacao = new Map<string, number>();

export function avisoDeDigitacao(
  userId: number,
  channelId: number,
  status: PresenceStatus | undefined,
  agora = Date.now(),
): { room: string; channelId: number; communityId: number | null } | null {
  if (status === 'invisivel') return null;
  const channel = db.findChannel(channelId);
  if (!channel || (channel.type !== 'text' && channel.type !== 'dm')) return null;
  const pode = channel.communityId === null ? db.isChannelMember(channel.id, userId) : !!db.memberRole(channel.communityId, userId);
  if (!pode) return null;
  const chave = `${userId}:${channel.id}`;
  if (agora - (ultimoAvisoDeDigitacao.get(chave) ?? -Infinity) < INTERVALO_DE_DIGITACAO_MS) return null;
  // O mapa não cresce para sempre: passou de alguns milhares de pares, os velhos saem.
  if (ultimoAvisoDeDigitacao.size > 5000) {
    for (const [k, quando] of ultimoAvisoDeDigitacao) if (agora - quando > INTERVALO_DE_DIGITACAO_MS) ultimoAvisoDeDigitacao.delete(k);
  }
  ultimoAvisoDeDigitacao.set(chave, agora);
  return { room: channelRoom(channel), channelId: channel.id, communityId: channel.communityId };
}

/** O que aparece na barra lateral sob cada sala de voz. */
export interface VoiceMember {
  userId: number;
  username: string;
  communityId: number;
  channelId: number;
  muted: boolean;
  deafened: boolean;
  video: boolean;
  screen: boolean;
  /** O que está sendo transmitido ("League of Legends"), quando dá para saber. */
  screenName: string | null;
}

type Ack = (result: { ok: true } | { ok: false; error: string }) => void;

interface VoiceSession extends VoiceMember {
  socketId: string;
  voiceSessionId: number;
  screenSessionId: number | null;
}

// Estado em memória: suficiente para uma instância. Para rodar várias instâncias do servidor,
// isto passa para o Redis (junto com o @socket.io/redis-adapter).
const voiceMembers = new Map<number, VoiceSession>();
const onlineSockets = new Map<number, { username: string; sockets: Set<string>; status: PresenceStatus }>();

const USAGE_HEARTBEAT_MS = 60_000;

/** Quem está em chamada numa comunidade (cada uma só vê a sua). */
function voiceState(communityId: number): VoiceMember[] {
  return [...voiceMembers.values()]
    .filter((member) => member.communityId === communityId)
    .map(({ socketId: _s, voiceSessionId: _v, screenSessionId: _c, ...member }) => member);
}

function broadcastVoice(io: IOServer, communityId: number) {
  io.to(communityRoom(communityId)).emit('voice:state', { communityId, members: voiceState(communityId) });
}

/** Entrou numa comunidade com o app aberto: as abas dela passam a receber os avisos de lá. */
/**
 * Avisa quem está junto que o perfil desta pessoa mudou — insígnia nova, por exemplo. Sem isto, a lista
 * de membros e o cartão de perfil só descobrem a mudança quando alguém recarrega o Syden.
 */
export function anunciarPerfil(io: IOServer, userId: number) {
  const user = db.findUserById(userId);
  if (!user) return;
  for (const comunidade of db.listCommunitiesForUser(userId)) {
    io.to(communityRoom(comunidade.id)).emit('member:updated', {
      communityId: comunidade.id,
      member: { ...user, role: db.memberRole(comunidade.id, userId) ?? 'member' },
    });
  }
}

export function joinCommunityRoom(io: IOServer, userId: number, communityId: number) {
  for (const socketId of onlineSockets.get(userId)?.sockets ?? []) {
    io.sockets.sockets.get(socketId)?.join(communityRoom(communityId));
  }
}

/** Alguém entrou numa conversa privada: as abas dela passam a receber as mensagens de lá na hora. */
export function joinDirectRoom(io: IOServer, userId: number, channelId: number) {
  for (const socketId of onlineSockets.get(userId)?.sockets ?? []) {
    io.sockets.sockets.get(socketId)?.join(directRoom(channelId));
  }
}

export function leaveDirectRoom(io: IOServer, userId: number, channelId: number) {
  for (const socketId of onlineSockets.get(userId)?.sockets ?? []) {
    io.sockets.sockets.get(socketId)?.leave(directRoom(channelId));
  }
}

/** Manda um aviso só para as abas de uma pessoa (ex.: "você foi movido para outra sala"). */
export function emitToUser(io: IOServer, userId: number, event: string, payload: unknown) {
  for (const socketId of onlineSockets.get(userId)?.sockets ?? []) {
    io.sockets.sockets.get(socketId)?.emit(event, payload);
  }
}

export function leaveCommunityRoom(io: IOServer, userId: number, communityId: number) {
  for (const socketId of onlineSockets.get(userId)?.sockets ?? []) {
    io.sockets.sockets.get(socketId)?.leave(communityRoom(communityId));
  }
}

function activeUsageSessionIds(session: VoiceSession) {
  return session.screenSessionId === null ? [session.voiceSessionId] : [session.voiceSessionId, session.screenSessionId];
}

function endVoiceSession(userId: number) {
  const session = voiceMembers.get(userId);
  if (!session) return;
  db.touchUsageSessions(activeUsageSessionIds(session));
  voiceMembers.delete(userId);
}

/** Em que sala de voz a pessoa está agora, se estiver. */
export function salaDeVozDe(userId: number): { channelId: number; communityId: number } | undefined {
  const sessao = voiceMembers.get(userId);
  return sessao && { channelId: sessao.channelId, communityId: sessao.communityId };
}

/** Sala de voz excluída: encerra as sessões de quem estava nela (os apps saem da chamada ao receber channel:deleted). */
export function removeVoiceChannelMembers(io: IOServer, channelId: number) {
  const inChannel = [...voiceMembers.values()].filter((m) => m.channelId === channelId);
  if (inChannel.length === 0) return;
  const communityId = inChannel[0].communityId;
  for (const member of inChannel) endVoiceSession(member.userId);
  broadcastVoice(io, communityId);
}

/** Conta excluída: tira a pessoa das salas de voz e derruba as conexões abertas (o app volta ao login). */
export function disconnectUser(io: IOServer, userId: number) {
  const communityId = voiceMembers.get(userId)?.communityId;
  endVoiceSession(userId);
  const online = onlineSockets.get(userId);
  onlineSockets.delete(userId);
  for (const socketId of online?.sockets ?? []) io.sockets.sockets.get(socketId)?.disconnect(true);
  if (communityId !== undefined) broadcastVoice(io, communityId);
  broadcastPresence(io);
}

/**
 * Quantas pessoas estão com o Syden aberto agora, no Syden inteiro.
 *
 * É por PESSOA, e não por conexão: quem deixa o app no computador e o site no celular conta uma vez.
 * Contar conexões faria o painel dizer que há o dobro de gente, e a diferença apareceria justamente
 * quando alguém estivesse acompanhando o crescimento.
 */
export function quantosOnline(): number {
  return onlineSockets.size;
}

function onlineUsers(): (db.UserRef & { status: PresenceStatus })[] {
  return [...onlineSockets.entries()].map(([id, { username, status }]) => ({ id, username, status }));
}

/**
 * Manda a presença para cada pessoa, com só quem ela pode ver.
 *
 * Antes isto era um `io.emit`, que manda a MESMA lista para todo mundo — a lista inteira de quem está
 * online no Syden. A tela filtrava antes de desenhar, e por isso nada parecia errado; mas o nome e o
 * estado de todos estavam no navegador de qualquer um. Agora a conta é feita aqui, e o que não é para
 * a pessoa ver não sai do servidor.
 *
 * O custo é uma consulta por pessoa conectada a cada mudança de presença. Numa casa deste tamanho
 * isso não se mede; o cache abaixo existe só porque uma pessoa costuma ter duas ou três abas abertas.
 */
function broadcastPresence(io: IOServer) {
  const todos = onlineUsers();
  const cache = new Map<number, Set<number>>();
  const vejo = (id: number) => {
    let lista = cache.get(id);
    if (!lista) {
      lista = db.quemVejoOnline(id);
      cache.set(id, lista);
    }
    return lista;
  };

  for (const socket of io.sockets.sockets.values()) {
    const user = socket.data.user as db.User | undefined;
    if (!user) continue;
    const visiveis = vejo(user.id);
    // A própria pessoa vai sempre: é dela que a tela lê o próprio estado (online, ausente, ocupado).
    socket.emit(
      'presence',
      todos.filter((p) => p.id === user.id || visiveis.has(p.id)),
    );
  }
}

export function setupRealtime(io: IOServer) {
  io.use(async (socket, next) => {
    const sessao = await verifySession(socket.handshake.auth?.token);
    const achado = sessao === null ? undefined : db.findUserForSession(sessao.userId);
    // Mesma conferência das rotas: token de sessão derrubada não abre conexão em tempo real.
    if (!achado || achado.sessionVersion !== sessao!.sessionVersion) return next(new Error('unauthorized'));
    socket.data.user = achado.user;
    next();
  });

  setInterval(() => {
    db.touchUsageSessions([...voiceMembers.values()].flatMap(activeUsageSessionIds));
    // O minuto de voz dos níveis: quem não está sozinho na sala ganha pontos (ver niveis.ts).
    pontuarMinutoDeVoz(io, [...voiceMembers.values()]);
  }, USAGE_HEARTBEAT_MS).unref();

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as db.User;

    // Nova aba de quem já estava online mantém o status escolhido; a primeira conexão começa "online".
    const online = onlineSockets.get(user.id) ?? { username: user.username, sockets: new Set<string>(), status: 'online' as PresenceStatus };
    online.sockets.add(socket.id);
    onlineSockets.set(user.id, online);
    broadcastPresence(io);

    // Só chegam a esta aba os avisos das comunidades de que a pessoa participa.
    const myCommunities = db.communityIdsForUser(user.id);
    for (const id of myCommunities) {
      socket.join(communityRoom(id));
      socket.emit('voice:state', { communityId: id, members: voiceState(id) });
    }
    // E também as conversas privadas de que ela participa.
    for (const conversa of db.listDirectChannels(user.id)) socket.join(directRoom(conversa.id));

    // Uma sala por PESSOA, juntando todas as abas dela. É por onde chega o que é dirigido a ela e
    // não a um lugar — hoje, os pedidos de amizade. Sem ela, avisar alguém exigiria procurar todos
    // os sockets daquela conta a cada vez.
    socket.join(salaDaPessoa(user.id));

    // Ocupado, ausente, invisível... como no Discord. Vale para a pessoa (todas as abas dela juntas).
    socket.on('presence:set', (status: unknown) => {
      if (!isPresenceStatus(status)) return;
      const entry = onlineSockets.get(user.id);
      if (!entry) return;
      entry.status = status;
      broadcastPresence(io);
    });

    socket.on('message:send', (payload: { channelId?: number; content?: string; threadId?: number }, ack?: Ack) => {
      const content = String(payload?.content ?? '').trim();
      const channel = db.findChannel(Number(payload?.channelId));
      if (!channel || (channel.type !== 'text' && channel.type !== 'dm')) return ack?.({ ok: false, error: 'Canal inválido.' });
      // Canal de comunidade: tem que participar dela. Conversa privada: tem que estar na conversa.
      const pode =
        channel.communityId === null ? db.isChannelMember(channel.id, user.id) : !!db.memberRole(channel.communityId, user.id);
      if (!pode) return ack?.({ ok: false, error: 'Você não participa desta conversa.' });
      if (!content || content.length > 2000) return ack?.({ ok: false, error: 'Mensagem vazia ou longa demais.' });
      // A moderação automática da comunidade (desligada, não barra nada). Ver automod.ts.
      const barrada = barrarMensagem(channel, user.id, content);
      if (barrada) return ack?.({ ok: false, error: barrada });

      // Resposta dentro de um tópico: ele tem que ser deste canal.
      let threadId: number | null = null;
      if (payload?.threadId !== undefined && payload.threadId !== null) {
        const thread = db.threadLocation(Number(payload.threadId));
        if (!thread || thread.channelId !== channel.id) return ack?.({ ok: false, error: 'Tópico não encontrado.' });
        threadId = thread.id;
      }

      const room = channelRoom(channel);
      io.to(room).emit('message:new', {
        ...db.createMessage(channel.id, user.id, content, threadId),
        communityId: channel.communityId,
      });
      if (threadId !== null) {
        const thread = db.findThread(threadId);
        if (thread) io.to(room).emit('thread:updated', { ...thread, communityId: channel.communityId });
      }
      // Os níveis (desligados, não faz nada): uma mensagem por minuto rende pontos. Ver niveis.ts.
      if (channel.communityId !== null) pontuarMensagem(io, channel.communityId, user.id);
      // "!regras": se a comunidade tem esse comando, o Syden responde (ver comandos-routes.ts).
      responderComando(io, channel, user, content, threadId);
      ack?.({ ok: true });
    });

    // Quem digita avisa os outros; ele mesmo não recebe (socket.to exclui esta aba).
    socket.on('typing', (payload: { channelId?: number }) => {
      const aviso = avisoDeDigitacao(user.id, Number(payload?.channelId), onlineSockets.get(user.id)?.status);
      if (!aviso) return;
      socket.to(aviso.room).emit('typing', {
        channelId: aviso.channelId,
        communityId: aviso.communityId,
        userId: user.id,
        username: user.username,
      });
    });

    socket.on('voice:join', (payload: { channelId?: number }, ack?: Ack) => {
      const channel = db.findChannel(Number(payload?.channelId));
      if (!channel || channel.type !== 'voice' || channel.communityId === null) {
        return ack?.({ ok: false, error: 'Sala inválida.' });
      }
      if (!db.memberRole(channel.communityId, user.id)) return ack?.({ ok: false, error: 'Você não participa desta comunidade.' });
      const previous = voiceMembers.get(user.id)?.communityId;
      endVoiceSession(user.id); // trocou de sala, ou entrou por outra aba
      voiceMembers.set(user.id, {
        userId: user.id,
        username: user.username,
        communityId: channel.communityId,
        channelId: channel.id,
        muted: false,
        deafened: false,
        video: false,
        screen: false,
        screenName: null,
        socketId: socket.id,
        voiceSessionId: db.startUsageSession('voice', user.id, channel.communityId),
        screenSessionId: null,
      });
      if (previous !== undefined && previous !== channel.communityId) broadcastVoice(io, previous);
      broadcastVoice(io, channel.communityId);
      ack?.({ ok: true });
    });

    socket.on('voice:update', (patch: Partial<Pick<VoiceMember, 'muted' | 'deafened' | 'video' | 'screen' | 'screenName'>>) => {
      const member = voiceMembers.get(user.id);
      if (!member || member.socketId !== socket.id) return;
      for (const key of ['muted', 'deafened', 'video', 'screen'] as const) {
        if (typeof patch?.[key] === 'boolean') member[key] = patch[key];
      }
      // O nome do que está sendo transmitido vem do título da janela, então chega como texto de fora:
      // corta no tamanho e só vale enquanto a transmissão estiver de pé.
      const nome = typeof patch?.screenName === 'string' ? patch.screenName.trim().slice(0, 60) : null;
      member.screenName = member.screen ? nome || null : null;
      if (member.screen && member.screenSessionId === null) {
        member.screenSessionId = db.startUsageSession('screen', user.id, member.communityId);
      } else if (!member.screen && member.screenSessionId !== null) {
        db.touchUsageSessions([member.screenSessionId]);
        member.screenSessionId = null;
      }
      broadcastVoice(io, member.communityId);
    });

    const leaveVoice = () => {
      // Só remove se a sessão de voz pertence a esta aba (o usuário pode ter entrado por outra).
      const member = voiceMembers.get(user.id);
      if (member?.socketId === socket.id) {
        endVoiceSession(user.id);
        broadcastVoice(io, member.communityId);
      }
    };
    socket.on('voice:leave', leaveVoice);

    socket.on('disconnect', () => {
      leaveVoice();
      online.sockets.delete(socket.id);
      if (online.sockets.size === 0) onlineSockets.delete(user.id);
      broadcastPresence(io);
    });
  });
}
