export interface User {
  id: number;
  username: string;
  isAdmin: boolean;
  /** O dono do servidor é quem dá e tira o cargo de administrador. */
  isOwner: boolean;
  avatarVersion: number | null;
}

export type UserRef = Pick<User, 'id' | 'username'>;

/** Status de presença, como no Discord. "invisivel" faz a pessoa aparecer offline para os outros. */
export type PresenceStatus = 'online' | 'ausente' | 'ocupado' | 'invisivel';

/** O que a lista de presença traz de cada pessoa conectada. */
export interface PresenceEntry {
  id: number;
  username: string;
  status: PresenceStatus;
}

export type PublicUser = Pick<User, 'id' | 'username' | 'avatarVersion' | 'isAdmin' | 'isOwner'>;

/** Cargo dentro de uma comunidade. Quem criou é "owner"; "admin" modera; "member" participa. */
export type Role = 'owner' | 'admin' | 'member';

export type CommunityMember = PublicUser & { role: Role };

/** Uma comunidade (o "servidor" do Discord) do jeito que quem participa dela enxerga. */
export interface Community {
  id: number;
  name: string;
  createdBy: number | null;
  /** Muda a cada troca de imagem; entra na URL para o navegador buscar a nova. null = sem imagem. */
  iconVersion: number | null;
  role: Role;
  memberCount: number;
  /** Só quem administra recebe o código; para os outros vem null. */
  inviteCode: string | null;
}

export interface Emoji {
  id: number;
  communityId: number;
  name: string;
  createdBy: number | null;
}

export interface Sound {
  id: number;
  /** Comunidade dona do som; null quando ele vem de um pacote do catálogo. */
  communityId: number | null;
  /** Pacote de onde ele veio, com o nome para agrupar na tela; null se alguém enviou direto. */
  packId: number | null;
  packName: string | null;
  /** Marcado como preferido por mim: vai para o topo do soundboard. */
  favorite: boolean;
  name: string;
  icon: string;
  createdBy: number | null;
}

/** Pacote de sons do catálogo, com autor, quantas pessoas baixaram e a nota em estrelas. */
export interface Pack {
  id: number;
  name: string;
  description: string;
  icon: string;
  createdBy: number | null;
  authorName: string | null;
  builtin: boolean;
  createdAt: string;
  soundCount: number;
  installs: number;
  /** Média das estrelas (null se ninguém avaliou) e quantas notas formaram a média. */
  stars: number | null;
  ratings: number;
  myStars: number | null;
  installed: boolean;
}

export interface Channel {
  id: number;
  /** null nas conversas privadas: elas não pertencem a nenhuma comunidade. */
  communityId: number | null;
  name: string;
  type: 'text' | 'voice' | 'dm';
  position: number;
  createdBy: number | null;
}

/** Uma conversa privada (direta ou em grupo) do jeito que ela aparece na lista. */
export interface DirectChannel {
  id: number;
  /** Nome do grupo; vazio na conversa de duas pessoas (aí o nome é o da outra pessoa). */
  name: string;
  createdBy: number | null;
  members: UserRef[];
  lastMessageAt: string | null;
  lastMessage: string | null;
}

/** Arquivo mandado junto com uma mensagem (imagem, vídeo, áudio ou qualquer outro). */
export interface Attachment {
  id: number;
  /** Parte secreta do endereço do arquivo: sem ela o arquivo não abre. */
  key: string;
  name: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
}

export interface PollOption {
  id: number;
  text: string;
  votes: number;
  /** Se você votou nesta opção. */
  mine: boolean;
}

export interface Poll {
  id: number;
  question: string;
  multiple: boolean;
  closed: boolean;
  options: PollOption[];
  /** Quantas pessoas votaram. */
  voters: number;
}

/** Uma reação (emoji comum ou :nome: de um emoji da comunidade) e quantos marcaram. */
export interface Reaction {
  emoji: string;
  count: number;
  /** Se você reagiu com este emoji. */
  mine: boolean;
}

/** Um tópico pendurado numa mensagem: conversa à parte, sem atravessar o canal. */
export interface ThreadSummary {
  id: number;
  channelId: number;
  parentMessageId: number;
  title: string;
  replyCount: number;
  lastAt: string | null;
}

export interface Message {
  id: number;
  channelId: number;
  content: string;
  createdAt: string;
  author: UserRef;
  /** null quando a mensagem está no canal; o id do tópico quando é resposta de um. */
  threadId: number | null;
  attachments: Attachment[];
  poll: Poll | null;
  thread: ThreadSummary | null;
  reactions: Reaction[];
}

export interface VoiceMember {
  userId: number;
  username: string;
  communityId: number;
  channelId: number;
  muted: boolean;
  deafened: boolean;
  video: boolean;
  screen: boolean;
}

export type Traffic =
  | { status: 'unavailable'; message: string }
  | { status: 'ok'; outgoingBytes: number; includedBytes: number; projectedBytes: number | null; measuringSince: string };

export interface HealthSample {
  at: string;
  /** Fração de 0 a 1. */
  cpu: number;
  memory: number;
  diskFree: number | null;
  diskTotal: number | null;
  livekitOk: boolean;
  errors: number;
  /** Velocidade de rede no intervalo, em bits por segundo. */
  networkIn: number | null;
  networkOut: number | null;
}

export interface HealthEvent {
  at: string;
  kind: string;
  detail: string;
}

/** Gráficos vindos do provedor (Hetzner), os mesmos do painel deles. */
export interface ProviderMetrics {
  name: string;
  series: {
    label: string;
    unit: 'percent' | 'bps' | 'iops' | 'pps';
    points: { at: string; value: number }[];
  }[];
}

export interface HealthReport {
  startedAt: string;
  uptimeSeconds: number;
  livekitOk: boolean | null;
  cpu: number;
  memory: number;
  diskFree: number | null;
  diskTotal: number | null;
  errorsNow: number;
  errors24h: number;
  samples: HealthSample[];
  events: HealthEvent[];
}

export interface UsageSummary {
  monthStart: string;
  monthProgress: number;
  traffic: Traffic;
  users: { userId: number; username: string; voiceSeconds: number; screenSeconds: number }[];
}
