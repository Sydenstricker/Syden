import type { Server as IOServer, Socket } from 'socket.io';
import { verifySession } from './auth.js';
import { barrarMensagem } from './automod.js';
import { entregarPendentes } from './agendador.js';
import { responderComando } from './comandos-routes.js';
import * as db from './db.js';
import { apagarSeVazia } from './salas-temporarias.js';
import { pontuarMensagem, pontuarMinutoDeVoz } from './niveis.js';
import { barreiraDe, hojeEmBrasilia, podeConversarNoParticular, podeVerVideo, regrasDe } from './protecao.js';

/** Os gêneros que a TV do salão sabe desenhar (a mesma lista de web/src/generoDoJogo.ts). */
const GENEROS_DE_JOGO = new Set(['moba', 'tiro', 'futebol', 'corrida', 'luta', 'aventura', 'construcao', 'fazenda', 'estrategia', 'cartas', 'terror', 'plataforma', 'festa', 'espaco', 'quebracabeca', 'esportes', 'voo', 'turnos', 'historia', 'ritmo']);

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

/**
 * Manda a mensagem nova para quem tem que receber. A exceção é a RESPOSTA numa conversa privada: cada pessoa recebe a
 * citação do jeito que a vê, porque quem apagou a conversa não pode receber de volta o texto que apagou.
 */
export function publicarMensagem(io: IOServer, channel: { id: number; communityId: number | null }, message: db.Message) {
  const evento = { ...message, communityId: channel.communityId };
  if (channel.communityId === null && message.replyTo?.id != null) {
    for (const userId of db.channelMemberIds(channel.id)) {
      io.to(salaDaPessoa(userId)).emit('message:new', { ...evento, replyTo: db.citacaoPara(message.id, userId) });
    }
    return;
  }
  io.to(channelRoom(channel)).emit('message:new', evento);
}

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
  /** Lido na hora de entrar (o `user` do socket é de quando ele conectou). */
  nomeDeExibicao: string | null;
  /** Nula na CHAMADA DE UMA CONVERSA PRIVADA (02/11/2026): ela não é de comunidade nenhuma (ver anunciarVoz). */
  communityId: number | null;
  channelId: number;
  muted: boolean;
  deafened: boolean;
  video: boolean;
  screen: boolean;
  /** O que está sendo transmitido ("League of Legends"), quando dá para saber. */
  screenName: string | null;
  /** O gênero do jogo transmitido, de uma lista fechada (web/src/generoDoJogo.ts): a TV do salão desenha o dele. */
  screenGenero: string | null;
  /**
   * De quem são as transmissões que esta pessoa ABRIU (ids). É o que conta "quantas pessoas assistem":
   * estar na sala não basta, porque abrir a transmissão é escolha de cada um (ver assistir, em useVoice.ts).
   */
  assistindo: number[];
  /** O microfone está TRAVADO pela moderação da comunidade (ver travarMicrofone): a pessoa não consegue ligá-lo. */
  travado: boolean;
}

type Ack = (result: { ok: true; communityId?: number } | { ok: false; error: string }) => void;

interface VoiceSession extends VoiceMember {
  socketId: string;
  voiceSessionId: number;
  screenSessionId: number | null;
}

// Estado em memória: suficiente para uma instância. Para rodar várias instâncias do servidor,
// isto passa para o Redis (junto com o @socket.io/redis-adapter).
const voiceMembers = new Map<number, VoiceSession>();
/**
 * MICROFONES TRAVADOS PELA MODERAÇÃO ("comunidade:pessoa"), como o "silenciar no servidor" do Discord: vale para a
 * comunidade inteira, sobrevive a sair e voltar da chamada, e só quem administra tira. A trava de verdade é a permissão
 * do LiveKit (ver permissaoNaSala, em routes.ts); isto é o que ela lê. Em memória: some se o servidor reiniciar.
 */
const microfonesTravados = new Set<string>();
/**
 * A TELA E A CÂMERA CORTADAS pela moderação (parar-video, em routes.ts): pessoa → sala. Fora da sessão de voz de
 * propósito (achado da revisão de 21/10/2026): o socket que cai apaga a sessão, e a próxima conta da permissão
 * devolveria a tela. Sai quando a pessoa SAI da sala pelo botão, ou entra noutra.
 */
const videosCortados = new Map<number, number>();
const onlineSockets = new Map<number, { username: string; sockets: Set<string>; status: PresenceStatus }>();
/** Quando cada pessoa convidou cada outra para a voz ("quem:alvo"), para o freio de um aviso por minuto. */
const convitesParaVoz = new Map<string, number>();

const USAGE_HEARTBEAT_MS = 60_000;

/** Quem está em chamada numa comunidade (cada uma só vê a sua). */
function voiceState(communityId: number): VoiceMember[] {
  return [...voiceMembers.values()]
    .filter((member) => member.communityId === communityId)
    .map(({ socketId: _s, voiceSessionId: _v, screenSessionId: _c, ...member }) => ({
      ...member,
      travado: microfoneTravado(communityId, member.userId),
    }));
}

function broadcastVoice(io: IOServer, communityId: number) {
  io.to(communityRoom(communityId)).emit('voice:state', { communityId, members: voiceState(communityId) });
}

/**
 * A CHAMADA DE UMA CONVERSA PRIVADA (pedido dele, 02/11/2026): voz, câmera e transmissão entre quem conversa, sem
 * comunidade. Quem está nela vai só para quem está na conversa (a sala `dm:<id>` do socket), num evento próprio, para a
 * lista das comunidades nunca a ver.
 */
function membrosDaChamada(channelId: number): VoiceMember[] {
  return [...voiceMembers.values()]
    .filter((m) => m.communityId === null && m.channelId === channelId)
    .map(({ socketId: _s, voiceSessionId: _v, screenSessionId: _c, ...member }) => ({ ...member, travado: false }));
}

/** Esta pessoa pode estar junto de cada uma destas na chamada? Nenhum bloqueio, e a regra dos menores. */
function compativelCom(userId: number, outros: number[]): boolean {
  return outros.every((outro) => outro === userId || (!db.haBloqueio(userId, outro) && podeConversarNoParticular(userId, outro)));
}

/**
 * Quem está na chamada, como ESTA pessoa o vê: a lista inteira para quem está nela ou poderia entrar; vazia para quem
 * seria recusado (achado da revisão de 02/11/2026). Sem isso, quem bloqueou via "Entrar na chamada" de quem bloqueou, e o
 * menor via a chamada de um adulto que já não é amigo: o mesmo sinal de contato que o toque já não mandava.
 */
function chamadaVistaPor(userId: number, channelId: number): VoiceMember[] {
  const membros = membrosDaChamada(channelId);
  const ids = membros.map((m) => m.userId);
  return ids.includes(userId) || compativelCom(userId, ids) ? membros : [];
}

function broadcastChamada(io: IOServer, channelId: number) {
  for (const id of db.channelMemberIds(channelId)) {
    io.to(salaDaPessoa(id)).emit('chamada:estado', { channelId, members: chamadaVistaPor(id, channelId) });
  }
}

/**
 * CONFERE DE NOVO a chamada privada em que a pessoa está (achado da revisão de 02/11/2026: o bloqueio e a amizade desfeita
 * só valiam na entrada, e quem já estava junto continuava ouvindo e vendo). Percorre quem está nela NA ORDEM DE CHEGADA e
 * tira quem não pode mais estar junto de alguém que chegou antes: da lista e do LiveKit, onde mora o áudio. Chamada ao
 * bloquear, ao desfazer amizade e quando o responsável muda as regras de um menor.
 */
export function reconferirChamadaDe(io: IOServer, userId: number) {
  const sessao = voiceMembers.get(userId);
  if (!sessao || sessao.communityId !== null) return;
  const ficam: number[] = [];
  for (const m of [...voiceMembers.values()].filter((v) => v.communityId === null && v.channelId === sessao.channelId)) {
    if (compativelCom(m.userId, ficam)) {
      ficam.push(m.userId);
      continue;
    }
    encerrarChamadaDe(io, m.userId, sessao.channelId);
    void import('./routes.js').then(({ tirarDaChamada }) => tirarDaChamada(sessao.channelId, m.userId)).catch(() => {});
  }
}

/** Avisa a lista certa: a da comunidade, ou a da conversa privada. */
function anunciarVoz(io: IOServer, sala: { communityId: number | null; channelId: number }) {
  if (sala.communityId === null) broadcastChamada(io, sala.channelId);
  else broadcastVoice(io, sala.communityId);
}

/**
 * Esta pessoa pode estar NESTA chamada de conversa privada? Membro da conversa e, contra CADA UM de quem já está na
 * chamada, nenhum bloqueio (em qualquer sentido) e a regra dos menores (só amigos, ECA Digital). Conferir contra quem
 * ESTÁ, e não contra a conversa inteira, cobre o grupo com alguém bloqueado: os dois nunca ficam juntos na chamada,
 * entre quem chega por último. A recusa não diz o porquê (o mesmo motivo do convite para a voz).
 */
export function podeEntrarNaChamadaDaConversa(userId: number, channelId: number): boolean {
  const conversa = db.findChannel(channelId);
  if (!conversa || conversa.type !== 'dm' || !db.isChannelMember(conversa.id, userId)) return false;
  return compativelCom(userId, quemEstaNaSala(conversa.id));
}

/** Quando cada pessoa fez tocar cada conversa ("quem:conversa"): entrar e sair em seguida não vira toque sem fim. */
const toquesRecentes = new Map<string, number>();

/**
 * O TOQUE: quem liga entrou numa chamada vazia, e cada um dos outros da conversa que está com o Syden aberto recebe
 * "fulano está ligando". Só quem poderia entrar (sem bloqueio, e a regra dos menores): tocar para quem seria recusado
 * ao atender é chamar para uma porta fechada. Um toque a cada 20 s por pessoa e conversa.
 */
function tocarParaQuemPode(io: IOServer, quemLiga: number, channelId: number) {
  const chave = `${quemLiga}:${channelId}`, agora = Date.now();
  if ((toquesRecentes.get(chave) ?? 0) > agora - 20_000) return;
  toquesRecentes.set(chave, agora);
  for (const [k, quando] of toquesRecentes) if (quando <= agora - 20_000) toquesRecentes.delete(k);
  const eu = db.findUserById(quemLiga);
  if (!eu) return;
  const de = { id: eu.id, username: eu.username, nomeDeExibicao: eu.nomeDeExibicao ?? null };
  for (const outro of db.channelMemberIds(channelId)) {
    if (outro === quemLiga || !estaOnline(outro)) continue;
    if (db.haBloqueio(quemLiga, outro) || !podeConversarNoParticular(quemLiga, outro)) continue;
    io.to(salaDaPessoa(outro)).emit('chamada:tocando', { channelId, de });
  }
}

/** Tira alguém da chamada da conversa (saiu da conversa), e avisa quem está nela. */
export function encerrarChamadaDe(io: IOServer, userId: number, channelId: number) {
  const sessao = voiceMembers.get(userId);
  if (!sessao || sessao.channelId !== channelId) return;
  io.to(sessao.socketId).emit('voice:substituida', { channelId });
  endVoiceSession(userId);
  anunciarVoz(io, sessao);
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
/** A pessoa tem alguma aba conectada agora? */
export function estaOnline(userId: number): boolean {
  return (onlineSockets.get(userId)?.sockets.size ?? 0) > 0;
}

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
  // Era a última pessoa numa sala temporária: ela some. Depois desta volta, para quem chamou terminar de
  // avisar a saída antes de a sala desaparecer da lista.
  const io = ioDoServidor;
  if (io) setImmediate(() => apagarSeVazia(io, session.channelId));
}

export function microfoneTravado(communityId: number, userId: number): boolean {
  return microfonesTravados.has(`${communityId}:${userId}`);
}

/** Trava ou solta o microfone de alguém na comunidade, e a lista das salas mostra na hora. */
export function travarMicrofone(io: IOServer, communityId: number, userId: number, travar: boolean) {
  if (travar) microfonesTravados.add(`${communityId}:${userId}`);
  else microfonesTravados.delete(`${communityId}:${userId}`);
  broadcastVoice(io, communityId);
}

/** A tela e a câmera de alguém foram cortadas na sala em que está (até sair dela). */
export function cortarVideo(userId: number, channelId: number) {
  videosCortados.set(userId, channelId);
}

export function videoCortado(userId: number, channelId: number): boolean {
  return videosCortados.get(userId) === channelId;
}

/** Quantas pessoas estão numa sala de voz agora. */
export function pessoasNaSala(channelId: number): number {
  let n = 0;
  for (const m of voiceMembers.values()) if (m.channelId === channelId) n++;
  return n;
}

/** Quem está agora numa sala de voz (ids), na ordem em que entrou. Usado pelos mini-games (minijogos.ts). */
export function quemEstaNaSala(channelId: number): number[] {
  return [...voiceMembers.values()].filter((m) => m.channelId === channelId).map((m) => m.userId);
}

let ioDoServidor: IOServer | null = null;

/** Em que sala de voz a pessoa está agora, se estiver. */
export function salaDeVozDe(userId: number): { channelId: number; communityId: number | null } | undefined {
  const sessao = voiceMembers.get(userId);
  return sessao && { channelId: sessao.channelId, communityId: sessao.communityId };
}

/** Sala de voz excluída: encerra as sessões de quem estava nela (os apps saem da chamada ao receber channel:deleted). */
export function removeVoiceChannelMembers(io: IOServer, channelId: number) {
  const inChannel = [...voiceMembers.values()].filter((m) => m.channelId === channelId);
  if (inChannel.length === 0) return;
  for (const member of inChannel) endVoiceSession(member.userId);
  anunciarVoz(io, inChannel[0]);
}

/** Conta excluída: tira a pessoa das salas de voz e derruba as conexões abertas (o app volta ao login). */
export function disconnectUser(io: IOServer, userId: number) {
  const sessao = voiceMembers.get(userId);
  endVoiceSession(userId);
  const online = onlineSockets.get(userId);
  onlineSockets.delete(userId);
  for (const socketId of online?.sockets ?? []) io.sockets.sockets.get(socketId)?.disconnect(true);
  if (sessao) anunciarVoz(io, sessao);
  broadcastPresence(io);
}

/**
 * O TEMPO DE USO DOS MENORES (ECA Digital, art. 18): cada minuto com o Syden aberto soma no dia (horário de Brasília).
 * De adulto não se mede nada. Esgotado o limite diário que o responsável pôs, a pessoa sai da chamada, recebe a
 * barreira e as conexões caem (a tela mostra "o tempo de hoje acabou" até a meia-noite).
 */
function contarMinutoDosMenores(io: IOServer) {
  const hoje = hojeEmBrasilia();
  for (const userId of onlineSockets.keys()) {
    if (!regrasDe(userId)) continue;
    db.somarUso(userId, hoje, USAGE_HEARTBEAT_MS / 1000);
    const barreira = barreiraDe(userId);
    if (barreira) void aplicarBarreira(io, userId, barreira);
  }
}

/** Barrou agora: avisa a tela, tira da chamada e derruba as conexões (o login continua valendo, a barreira não). */
export async function aplicarBarreira(io: IOServer, userId: number, barreira: unknown) {
  emitToUser(io, userId, 'barreira', barreira);
  const naVoz = voiceMembers.get(userId);
  if (naVoz) {
    const { tirarDaChamada } = await import('./routes.js');
    await tirarDaChamada(naVoz.channelId, userId);
  }
  // um instante para o aviso chegar antes de a conexão cair
  setTimeout(() => disconnectUser(io, userId), 300).unref();
}

/**
 * A REDE DE SEGURANÇA DO VÍDEO DOS MENORES. A trava principal está no app de quem transmite (as permissões de inscrição
 * do LiveKit: só os amigos recebem a tela e a câmera de um menor com "transmitir só para amigos") e no app de quem
 * assiste (um menor com "assistir só de amigos" não se inscreve no vídeo de quem não é amigo). Esta volta, a cada
 * 10 segundos, confere pelo servidor e desinscreve à força o que escapou — um app antigo, ou modificado.
 */
async function vigiarVideoDosMenores() {
  const salas = new Map<number, number[]>();
  for (const m of voiceMembers.values()) salas.set(m.channelId, [...(salas.get(m.channelId) ?? []), m.userId]);
  for (const [channelId, pessoas] of salas) {
    if (pessoas.length < 2 || !pessoas.some((id) => regrasDe(id))) continue;
    const { forcarDesinscricao } = await import('./routes.js');
    await forcarDesinscricao(channelId, (espectador, transmissor) => podeVerVideo(espectador, transmissor)).catch(() => {});
  }
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
  ioDoServidor = io;
  io.use(async (socket, next) => {
    const sessao = await verifySession(socket.handshake.auth?.token);
    const achado = sessao === null ? undefined : db.findUserForSession(sessao.userId);
    // Mesma conferência das rotas: token de sessão derrubada não abre conexão em tempo real.
    if (!achado || achado.sessionVersion !== sessao!.sessionVersion) return next(new Error('unauthorized'));
    // Conta barrada (banida, suspensa, sem a idade, sem o responsável, com o tempo do dia esgotado) não fica online:
    // a tela dela é a da barreira, que fala só pelas rotas (ver protecao.ts).
    if (barreiraDe(achado.user.id)) {
      // e não fica na chamada: o áudio é do LiveKit e sobreviveria à conexão recusada (ver tirarDeTodasAsChamadas)
      void import('./routes.js').then(({ tirarDeTodasAsChamadas }) => tirarDeTodasAsChamadas(achado.user.id)).catch(() => {});
      return next(new Error('barreira'));
    }
    socket.data.user = achado.user;
    next();
  });

  setInterval(() => {
    db.touchUsageSessions([...voiceMembers.values()].flatMap(activeUsageSessionIds));
    // O minuto de voz dos níveis: quem não está sozinho na sala ganha pontos (ver niveis.ts).
    // Só as salas de comunidade: os níveis são de cada comunidade, e a chamada da conversa privada não é de nenhuma.
    pontuarMinutoDeVoz(io, [...voiceMembers.values()].filter((m): m is VoiceSession & { communityId: number } => m.communityId !== null));
    // A "Sessão de cinema" das conquistas: transmitir com 2 ou mais assistindo (ver conquistas.ts). Quem assiste é quem
    // tem o id de quem transmite no PRÓPRIO `assistindo` (a lista das transmissões que cada um abriu) — e não o contrário,
    // que era o erro da primeira versão (achado da revisão, 21/10/2026).
    const membros = [...voiceMembers.values()];
    for (const m of membros) {
      if (!m.screen || m.communityId === null) continue;
      const plateia = membros.filter((o) => o.channelId === m.channelId && o.userId !== m.userId && o.assistindo.includes(m.userId)).length;
      if (plateia >= 2) db.somarCinema(m.communityId, m.userId, USAGE_HEARTBEAT_MS / 1000);
    }
    contarMinutoDosMenores(io);
  }, USAGE_HEARTBEAT_MS).unref();
  // A rede de segurança do vídeo dos menores (ver vigiarVideoDosMenores), mais curta que o minuto.
  setInterval(() => void vigiarVideoDosMenores(), 10_000).unref();

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as db.User;

    // Nova aba de quem já estava online mantém o status escolhido; a primeira conexão começa "online".
    const online = onlineSockets.get(user.id) ?? { username: user.username, sockets: new Set<string>(), status: 'online' as PresenceStatus };
    online.sockets.add(socket.id);
    onlineSockets.set(user.id, online);
    // Lembretes que venceram enquanto a pessoa estava fora chegam agora (ver agendador.ts).
    entregarPendentes(io, user.id);
    broadcastPresence(io);

    // Só chegam a esta aba os avisos das comunidades de que a pessoa participa.
    const myCommunities = db.communityIdsForUser(user.id);
    for (const id of myCommunities) {
      socket.join(communityRoom(id));
      socket.emit('voice:state', { communityId: id, members: voiceState(id) });
    }
    // E também as conversas privadas de que ela participa.
    // Inclusive as que ela apagou: é pela sala que chega a mensagem nova que traz a conversa de volta.
    for (const id of db.idsDasConversas(user.id)) {
      socket.join(directRoom(id));
      // Uma chamada já aberta numa conversa dela: quem abre o Syden no meio vê o "Entrar na chamada".
      if (pessoasNaSala(id) > 0) socket.emit('chamada:estado', { channelId: id, members: chamadaVistaPor(user.id, id) });
    }

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

    socket.on('message:send', (payload: { channelId?: number; content?: string; threadId?: number; replyTo?: number }, ack?: Ack) => {
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
      // Respondendo a uma mensagem: ela tem de estar aqui mesmo (ver podeResponderA).
      let replyTo: number | null = null;
      if (payload?.replyTo !== undefined && payload.replyTo !== null) {
        replyTo = Number(payload.replyTo);
        if (!Number.isInteger(replyTo) || !db.podeResponderA(replyTo, channel.id, threadId, user.id)) {
          return ack?.({ ok: false, error: 'A mensagem que você está respondendo não existe mais.' });
        }
      }

      const room = channelRoom(channel);
      publicarMensagem(io, channel, db.createMessage(channel.id, user.id, content, threadId, replyTo));
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
        nomeDeExibicao: db.findUserById(user.id)?.nomeDeExibicao ?? null,
      });
    });

    socket.on('voice:join', (payload: { channelId?: number }, ack?: Ack) => {
      const channel = db.findChannel(Number(payload?.channelId));
      // A sala de voz de uma comunidade, ou a chamada de uma conversa privada (com as regras de quem pode estar nela).
      const daConversa = channel?.type === 'dm';
      if (!channel || !(daConversa || (channel.type === 'voice' && channel.communityId !== null))) {
        return ack?.({ ok: false, error: 'Sala inválida.' });
      }
      if (daConversa ? !podeEntrarNaChamadaDaConversa(user.id, channel.id) : !db.memberRole(channel.communityId!, user.id)) {
        // Na conversa, a recusa também tira do LiveKit (achado da revisão de 02/11/2026): o token pode ter saído com a
        // chamada vazia, e quem foi bloqueado no meio-tempo chegaria lá dentro mesmo sem lugar na lista.
        if (daConversa) void import('./routes.js').then(({ tirarDaChamada }) => tirarDaChamada(channel.id, user.id)).catch(() => {});
        return ack?.({ ok: false, error: daConversa ? 'Não foi possível entrar nesta chamada.' : 'Você não participa desta comunidade.' });
      }
      // Entrar na chamada de uma conversa que a pessoa tinha apagado a traz de volta à lista dela (vazia, como reabrir).
      if (daConversa) db.reexibirConversa(user.id, channel.id);
      const communityId = daConversa ? null : channel.communityId;
      // Ninguém na chamada da conversa até agora: é quem LIGA, e os outros recebem o toque (abaixo).
      const ligando = daConversa && pessoasNaSala(channel.id) === 0;
      const anterior = voiceMembers.get(user.id);
      // A chamada foi assumida por OUTRO aparelho ou aba (revisão de 16/10/2026): o antigo é avisado, para não
      // "reanunciar" a cada 3 s e tomar a chamada de volta (os dois ficavam se alternando na lista para sempre).
      if (anterior && anterior.socketId !== socket.id) io.to(anterior.socketId).emit('voice:substituida', { channelId: anterior.channelId });
      endVoiceSession(user.id); // trocou de sala, ou entrou por outra aba
      if (videosCortados.has(user.id) && videosCortados.get(user.id) !== channel.id) videosCortados.delete(user.id);
      voiceMembers.set(user.id, {
        userId: user.id,
        username: user.username,
        nomeDeExibicao: db.findUserById(user.id)?.nomeDeExibicao ?? null,
        communityId,
        channelId: channel.id,
        muted: false,
        deafened: false,
        video: false,
        screen: false,
        screenName: null,
        screenGenero: null,
        assistindo: [],
        travado: false, // o voiceState lê de microfonesTravados
        socketId: socket.id,
        voiceSessionId: db.startUsageSession('voice', user.id, communityId, channel.id),
        screenSessionId: null,
      });
      // Saiu de outra sala (de comunidade ou de outra conversa): a lista de lá fica sabendo.
      if (anterior && (anterior.communityId !== communityId || anterior.channelId !== channel.id)) anunciarVoz(io, anterior);
      anunciarVoz(io, { communityId, channelId: channel.id });
      if (ligando) tocarParaQuemPode(io, user.id, channel.id);
      // A comunidade volta para o app conferir, em cada voice:state dela, que continua na lista (useVoice.ts). Na
      // conversa ela é nula, e quem confere é o chamada:estado.
      ack?.({ ok: true, communityId: communityId ?? undefined });
    });

    // Recusar o toque: quem está na chamada fica sabendo (na conversa de duas pessoas, a tela diz), e as outras abas de
    // quem recusou param de tocar. Só para quem é da conversa.
    socket.on('chamada:recusar', (payload: { channelId?: unknown }) => {
      const channelId = Number(payload?.channelId);
      const conversa = db.findChannel(channelId);
      if (!conversa || conversa.type !== 'dm' || !db.isChannelMember(channelId, user.id)) return;
      // Só com chamada aberta, e um aviso a cada 20 s: repetir não vira enxurrada de "recusou" (achado da revisão).
      if (pessoasNaSala(channelId) === 0) return;
      const chave = `recusa:${user.id}:${channelId}`, agora = Date.now();
      if ((toquesRecentes.get(chave) ?? 0) > agora - 20_000) return;
      toquesRecentes.set(chave, agora);
      io.to(directRoom(channelId)).emit('chamada:recusada', { channelId, userId: user.id });
    });

    socket.on('voice:update', (patch: Partial<Pick<VoiceMember, 'muted' | 'deafened' | 'video' | 'screen' | 'screenName' | 'screenGenero' | 'assistindo'>>) => {
      const member = voiceMembers.get(user.id);
      if (!member || member.socketId !== socket.id) return;
      for (const key of ['muted', 'deafened', 'video', 'screen'] as const) {
        if (typeof patch?.[key] === 'boolean') member[key] = patch[key];
      }
      // O nome do que está sendo transmitido vem do título da janela, então chega como texto de fora:
      // corta no tamanho e só vale enquanto a transmissão estiver de pé.
      const nome = typeof patch?.screenName === 'string' ? patch.screenName.trim().slice(0, 60) : null;
      member.screenName = member.screen ? nome || null : null;
      // O gênero: só um da lista, e só com a transmissão de pé.
      member.screenGenero = member.screen && typeof patch?.screenGenero === 'string' && GENEROS_DE_JOGO.has(patch.screenGenero) ? patch.screenGenero : null;
      // Só números, e só gente DA MESMA SALA: o que vem da tela não decide nada além disso. (Quem parou de
      // transmitir continua na lista: se voltar, a transmissão reabre sozinha para quem tinha aberto.)
      if (Array.isArray(patch?.assistindo)) {
        const naSala = new Set([...voiceMembers.values()].filter((m) => m.channelId === member.channelId).map((m) => m.userId));
        member.assistindo = [...new Set(patch.assistindo.map(Number))].filter((id) => naSala.has(id) && id !== user.id).slice(0, 20);
      }
      if (member.screen && member.screenSessionId === null) {
        member.screenSessionId = db.startUsageSession('screen', user.id, member.communityId);
      } else if (!member.screen && member.screenSessionId !== null) {
        db.touchUsageSessions([member.screenSessionId]);
        member.screenSessionId = null;
      }
      anunciarVoz(io, member);
    });

    // A CHAMADA DE PONTA A PONTA (web/src/chaveDaChamada.ts): o servidor só REPASSA, entre duas pessoas da mesma
    // sala, as chaves que os aparelhos combinam entre si. O conteúdo vai embrulhado e ele não o abre — nem
    // precisaria: é justamente o que o deixa de fora da chamada. Confere só quem manda, para quem, e o tamanho.
    socket.on('e2ee:chave', (payload: { para?: unknown; dados?: unknown }) => {
      const eu = voiceMembers.get(user.id);
      if (!eu || eu.socketId !== socket.id) return;
      const outro = voiceMembers.get(Number(payload?.para));
      if (!outro || outro.userId === user.id || outro.channelId !== eu.channelId) return;
      if (typeof payload?.dados !== 'string' || payload.dados.length > 2048) return;
      io.to(outro.socketId).emit('e2ee:chave', { de: user.id, dados: payload.dados });
    });

    // CONVIDAR PARA A VOZ (29/10/2026, como o "Convidar para voz" do Discord): quem está numa sala chama alguém da mesma
    // comunidade que está online, e só essa pessoa recebe o aviso, com o botão de entrar. O servidor confere tudo de novo,
    // porque a lista da tela é só uma sugestão: mesma comunidade, online e visível, fora da sala, sem bloqueio em nenhum
    // sentido e, com menor de idade, só entre amigos (a mesma regra da conversa privada: é contato direto). A recusa NÃO
    // DIZ O PORQUÊ, como a da transmissão: "é menor" dito a um estranho seria dar o mapa a quem procura criança.
    socket.on('voice:convidar', (payload: { userId?: unknown }, ack?: (r: { ok: boolean }) => void) => {
      const eu = voiceMembers.get(user.id);
      const alvo = Number(payload?.userId);
      const recusar = () => ack?.({ ok: false });
      // Na chamada de uma conversa privada não há comunidade para convidar: quem chama é o toque.
      if (!eu || eu.communityId === null || eu.socketId !== socket.id || !Number.isInteger(alvo) || alvo === user.id) return recusar();
      const online = onlineSockets.get(alvo);
      if (!online || online.status === 'invisivel' || !db.memberRole(eu.communityId, alvo)) return recusar();
      if (voiceMembers.get(alvo)?.channelId === eu.channelId || db.haBloqueio(user.id, alvo)) return recusar();
      if (!podeConversarNoParticular(user.id, alvo)) return recusar();
      // Um aviso por minuto para a mesma pessoa: clicar de novo não vira insistência no outro lado.
      const chave = `${user.id}:${alvo}`, agora = Date.now();
      if ((convitesParaVoz.get(chave) ?? 0) > agora - 60_000) return ack?.({ ok: true });
      convitesParaVoz.set(chave, agora);
      for (const [k, quando] of convitesParaVoz) if (quando <= agora - 60_000) convitesParaVoz.delete(k);
      io.to(salaDaPessoa(alvo)).emit('voice:convite', {
        de: { id: user.id, username: user.username, nomeDeExibicao: db.findUserById(user.id)?.nomeDeExibicao ?? null },
        channelId: eu.channelId,
        sala: db.findChannel(eu.channelId)?.name ?? '',
        communityId: eu.communityId,
        comunidade: db.findCommunity(eu.communityId)?.name ?? '',
      });
      ack?.({ ok: true });
    });

    const leaveVoice = () => {
      // Só remove se a sessão de voz pertence a esta aba (o usuário pode ter entrado por outra).
      const member = voiceMembers.get(user.id);
      if (member?.socketId === socket.id) {
        endVoiceSession(user.id);
        anunciarVoz(io, member);
      }
    };
    socket.on('voice:leave', () => {
      // Saiu pelo botão: o corte da tela termina com a sala. Socket que CAI não conta (ver videosCortados).
      if (voiceMembers.get(user.id)?.socketId === socket.id) videosCortados.delete(user.id);
      leaveVoice();
    });

    socket.on('disconnect', () => {
      leaveVoice();
      online.sockets.delete(socket.id);
      if (online.sockets.size === 0) onlineSockets.delete(user.id);
      broadcastPresence(io);
    });
  });
}
