export interface User {
  id: number;
  username: string;
  isAdmin: boolean;
  /** O dono do servidor é quem dá e tira o cargo de administrador. */
  isOwner: boolean;
  avatarVersion: number | null;
  /** Nome da cor escolhida para o nome (ver profileStyles), ou null para a cor do cargo. */
  nameColor: string | null;
  /** Nome do fundo escolhido para o cartão de perfil, ou null para o liso. */
  banner: string | null;
  /** Nome da moldura do avatar escolhida na loja, ou null para nenhuma. */
  moldura: string | null;
  /** Os códigos das insígnias que ela escolheu exibir no perfil, na ordem (ver insignias.ts). */
  vitrine: string[];
  /** Quantas ideias desta pessoa já entraram no Syden: é a medalha de contribuição do perfil. */
  acceptedIdeas: number;
  /** O selo da comunidade que ela escolheu vestir, já resolvido. Nulo quando não veste nenhum. */
  selo?: { texto: string; icone: string; cor: string } | null;
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

export type PublicUser = Pick<
  User,
  'id' | 'username' | 'avatarVersion' | 'isAdmin' | 'isOwner' | 'nameColor' | 'banner' | 'moldura' | 'vitrine' | 'acceptedIdeas' | 'selo'
>;

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
  /** O mesmo, para a CAPA — a faixa larga no alto da lista de canais. null = sem foto, e aí vale a arte. */
  bannerVersion?: number | null;
  /** O selo que a comunidade conquistou. As três partes vêm juntas ou nenhuma vem. */
  seloTexto?: string | null;
  seloIcone?: string | null;
  seloCor?: string | null;
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
  /** Número da última mensagem, para saber o que ainda não foi lido. */
  lastMessageId: number | null;
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
  /** Recados em vídeo somem sozinhos; nos outros anexos isto vem null. */
  expiresAt?: string | null;
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
  /** Quando a mensagem é uma ideia mandada pela tela inicial: o número dela e se já foi acolhida. */
  suggestion: { id: number; accepted: boolean } | null;
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
  /** O que a pessoa está transmitindo, quando dá para saber pelo título da janela. */
  screenName: string | null;
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

/** Quantas contas existem e como elas chegaram. Ver server/src/db.ts -> resumoDeContas. */
export interface ResumoDeContas {
  total: number;
  hoje: number;
  seteDias: number;
  trintaDias: number;
  semComunidade: number;
  comProvedor: number;
  porConfirmar: number;
  vagasNaInsignia: number;
}

export interface UsageSummary {
  monthStart: string;
  monthProgress: number;
  traffic: Traffic;
  users: { userId: number; username: string; voiceSeconds: number; screenSeconds: number }[];
  contas: ResumoDeContas;
  /** Pessoas com o Syden aberto agora, no Syden inteiro. */
  online: number;
}

/** Um pacote de emojis do catálogo. Diferente do pacote de sons, ele é instalado na COMUNIDADE. */
export interface EmojiPack {
  id: number;
  name: string;
  description: string;
  icon: string;
  createdBy: number | null;
  authorName: string | null;
  createdAt: string;
  emojiCount: number;
  /** Em quantas comunidades o pacote está instalado. */
  installs: number;
  stars: number | null;
  ratings: number;
  myStars: number | null;
  /** Se a comunidade aberta agora já tem o pacote. */
  installed: boolean;
}

export interface EmojiPackItem {
  id: number;
  packId: number;
  name: string;
}

/** Uma música do karaokê da comunidade. */
export interface KaraokeSong {
  id: number;
  communityId: number;
  title: string;
  artist: string;
  /** Duração em segundos, lida do arquivo na hora de subir (0 quando não deu para saber). */
  seconds: number;
  /** A letra: .lrc com o tempo de cada linha, ou texto simples. Vazio = sem letra. */
  lyrics: string;
  createdBy: number | null;
}

/**
 * Um servidor de jogo cadastrado numa comunidade. O Syden guarda o endereço e mostra; ele não fala
 * com esses servidores nem sabe se estão no ar — é uma agenda.
 */
export interface ServidorDeJogo {
  id: number;
  communityId: number;
  nome: string;
  jogo: string;
  endereco: string;
  senha: string | null;
  observacao: string | null;
  createdBy: number;
  createdAt: string;
}

/** Um item da loja de cosméticos. O que cada código desenha mora em loja.ts. */
export type TipoDeItem = 'cor' | 'fundo' | 'moldura' | 'insignia';

/** Como se põe a mão num item. Nenhum dos dois jeitos é pagando — ver server/src/loja.ts. */
export type ComoSeGanha = 'livre' | 'conquista';

export interface ItemDaLoja {
  codigo: string;
  tipo: TipoDeItem;
  comoSeGanha: ComoSeGanha;
  /** Já é seu? Item livre é de todo mundo; conquista depende de ter acontecido. */
  tenho: boolean;
}

export interface Loja {
  itens: ItemDaLoja[];
  vestindo: { cor: string | null; fundo: string | null; moldura: string | null; insignias: string[] };
}
