import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';
import type { NovoServidor, ServidorDeJogo } from './jogos.js';

/** 'dm' são as conversas privadas (direta entre duas pessoas ou grupo), fora de qualquer comunidade. */
export type ChannelType = 'text' | 'voice' | 'dm';

/** Cargo dentro de uma comunidade (o "servidor" do Discord). */
export type Role = 'owner' | 'admin' | 'member';

export interface Community {
  id: number;
  name: string;
  createdBy: number | null;
  /** Muda a cada troca de imagem e entra na URL, para o navegador buscar a nova. null = sem imagem. */
  iconVersion: number | null;
  /**
   * O selo conquistado, ou nulo enquanto não houver. Ver selos.ts.
   *
   * Viaja junto com a comunidade em vez de ter um pedido próprio: quem já desenha o nome passa a
   * poder desenhar o selo sem ir buscar nada, e o selo aparece em muitos lugares.
   */
  seloTexto?: string | null;
  seloIcone?: string | null;
  seloCor?: string | null;
}

/** Uma comunidade vista por quem participa dela. */
export interface CommunityForUser extends Community {
  role: Role;
  memberCount: number;
  /** Só vai para quem administra: é o que convida gente nova. Para os outros, null. */
  inviteCode: string | null;
}

export interface User {
  id: number;
  username: string;
  /** Administradores moderam o servidor: canais, mensagens, emojis e sons de todos, e membros comuns. */
  isAdmin: boolean;
  /** O dono (o primeiro cadastro) também é administrador e é quem dá e tira o cargo de administrador. */
  isOwner: boolean;
  avatarVersion: number | null;
  /** Nome da cor escolhida para o nome, ou null para a cor padrão do cargo. */
  nameColor: string | null;
  /** Nome do fundo escolhido para o cartão de perfil, ou null para o liso. */
  banner: string | null;
  /** Nome da moldura escolhida para o avatar, ou null para nenhuma. */
  moldura: string | null;
  /** O selo que a pessoa escolheu vestir, ja resolvido. Nulo quando ela nao veste nenhum. */
  selo?: { texto: string; icone: string; cor: string } | null;
  /** As insígnias que a pessoa escolheu exibir no perfil, na ordem em que ela pôs. */
  vitrine: string[];
  /** Quantas ideias desta pessoa já entraram no Syden. É o que vira a medalha no perfil. */
  acceptedIdeas: number;
}

/** Identificação pública de alguém (autor de mensagem, lista de online). */
export type UserRef = Pick<User, 'id' | 'username'>;

/** O que todos precisam saber de cada usuário para desenhar nome e avatar. */
export type PublicUser = Pick<
  User,
  'id' | 'username' | 'avatarVersion' | 'isAdmin' | 'isOwner' | 'moldura' | 'vitrine' | 'acceptedIdeas' | 'selo'
>;

/** Alguém dentro de uma comunidade: os dados públicos mais o cargo que tem ali. */
export type CommunityMember = PublicUser & { role: Role };

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
  /** Pacote a que ele pertence; null quando alguém o enviou direto para a comunidade. */
  packId: number | null;
  name: string;
  /** Um emoji comum que representa o som no soundboard. */
  icon: string;
  createdBy: number | null;
}

export interface Channel {
  id: number;
  /** null nas conversas privadas: elas não pertencem a nenhuma comunidade. */
  communityId: number | null;
  name: string;
  type: ChannelType;
  position: number;
  /** Quem criou o canal; null nos canais que vêm de fábrica. */
  createdBy: number | null;
}

/** Uma conversa privada do jeito que ela aparece na lista: com quem é e qual foi a última mensagem. */
export interface DirectChannel {
  id: number;
  /** Nome do grupo; vazio nas conversas de duas pessoas (o nome vem de quem está do outro lado). */
  name: string;
  createdBy: number | null;
  members: UserRef[];
  lastMessageAt: string | null;
  lastMessage: string | null;
  /** Número da última mensagem: é com ele que o cliente sabe o que ainda não foi lido. */
  lastMessageId: number | null;
}

/** Arquivo enviado junto com uma mensagem. Os bytes ficam no banco; aqui vai só a ficha dele. */
export interface Attachment {
  id: number;
  /** Parte secreta do endereço do arquivo: quem não recebeu o link não consegue abri-lo. */
  key: string;
  name: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  /** Quando o arquivo some sozinho (recados em vídeo), ou null quando fica para sempre. */
  expiresAt?: string | null;
}

export interface PollOption {
  id: number;
  text: string;
  votes: number;
  /** Se quem está lendo votou nesta opção. */
  mine: boolean;
}

export interface Poll {
  id: number;
  question: string;
  /** Deixa escolher mais de uma opção. */
  multiple: boolean;
  closed: boolean;
  options: PollOption[];
  /** Quantas pessoas votaram (não quantos votos). */
  voters: number;
}

/** O tópico de uma mensagem, do jeito que aparece embaixo dela. */
export interface ThreadSummary {
  id: number;
  channelId: number;
  parentMessageId: number;
  title: string;
  replyCount: number;
  /** Quando foi a última mensagem do tópico; null quando ninguém respondeu ainda. */
  lastAt: string | null;
}

/** Uma reação (👍, ❤️, ou :nome: de um emoji da comunidade) e quantos marcaram. */
export interface Reaction {
  emoji: string;
  count: number;
  /** Se quem está lendo reagiu com este emoji. */
  mine: boolean;
}

export interface Message {
  id: number;
  channelId: number;
  content: string;
  createdAt: string;
  author: UserRef;
  /** null quando a mensagem está no canal; o id do tópico quando ela é resposta de um. */
  threadId: number | null;
  attachments: Attachment[];
  poll: Poll | null;
  /** O tópico que pendura nesta mensagem, quando alguém criou um. */
  thread: ThreadSummary | null;
  reactions: Reaction[];
  /** Quando esta mensagem é uma ideia mandada pela tela inicial: o número dela e se já foi acolhida. */
  suggestion: { id: number; accepted: boolean } | null;
}

const db = new DatabaseSync(config.databasePath);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  -- Cada comunidade é um "servidor" no sentido do Discord: canais, emojis, sons e membros próprios.
  CREATE TABLE IF NOT EXISTS communities (
    id           INTEGER PRIMARY KEY,
    name         TEXT NOT NULL,
    invite_code  TEXT NOT NULL UNIQUE COLLATE NOCASE,
    created_by   INTEGER,
    icon_version INTEGER,
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  -- Imagem da comunidade (o "ícone do servidor"), no mesmo formato dos avatares.
  CREATE TABLE IF NOT EXISTS community_icons (
    community_id INTEGER PRIMARY KEY REFERENCES communities(id) ON DELETE CASCADE,
    mime         TEXT NOT NULL,
    data         BLOB NOT NULL
  );

  CREATE TABLE IF NOT EXISTS community_members (
    community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role         TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
    joined_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (community_id, user_id)
  );

  -- Canais de uma comunidade e também as conversas privadas: nelas community_id é null, o tipo é 'dm'
  -- e quem participa está em channel_members (uma conversa direta tem 2; um grupo, quantos quiserem).
  CREATE TABLE IF NOT EXISTS channels (
    id           INTEGER PRIMARY KEY,
    community_id INTEGER REFERENCES communities(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    type         TEXT NOT NULL CHECK (type IN ('text', 'voice', 'dm')),
    position     INTEGER NOT NULL DEFAULT 0,
    created_by   INTEGER
  );

  -- QUEM ESTÁ NO PALCO de uma sala em modo apresentação, e quem levantou a mão.
  --
  -- Uma tabela só para as duas coisas, com uma coluna dizendo qual: quem sobe ao palco normalmente é
  -- quem tinha levantado a mão, e duas tabelas obrigariam a apagar de uma e inserir na outra a cada
  -- passagem de palavra — duas escritas onde uma basta, e a chance de sobrar linha nas duas.
  -- IMAGENS QUE ENTRARAM SEM CONFERÊNCIA, para reconferir quando o Shield voltar.
  --
  -- A política, decidida por ele, é aceitar e reconferir depois: barrar tudo quando o serviço de um
  -- terceiro cai deixaria o Syden sem troca de imagem por motivo que não é nosso. A dívida fica aqui.
  --
  -- Guarda ONDE a imagem está (tabela e id) porque, quando a conferência acusar, é preciso achá-la para
  -- apagar. Guardar só o hash daria uma resposta sem endereço.
  CREATE TABLE IF NOT EXISTS shield_fila (
    sha256   TEXT NOT NULL,
    onde     TEXT NOT NULL,
    alvo_id  INTEGER NOT NULL,
    quando   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    tentativas INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (sha256, onde, alvo_id)
  );

  CREATE TABLE IF NOT EXISTS channel_palco (
    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    situacao   TEXT NOT NULL CHECK (situacao IN ('palco', 'mao')),
    desde      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (channel_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS channel_members (
    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (channel_id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_channel_members_user ON channel_members(user_id);

  CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY,
    channel_id INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users(id),
    content    TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, id);

  -- Tempo em chamada e compartilhando tela, para o painel de uso.
  -- Enquanto a sessão está ativa, ended_at é atualizado a cada minuto; se o servidor cair,
  -- a sessão fica registrada até o último minuto visto.
  CREATE TABLE IF NOT EXISTS usage_sessions (
    id         INTEGER PRIMARY KEY,
    kind       TEXT NOT NULL CHECK (kind IN ('voice', 'screen')),
    user_id    INTEGER NOT NULL REFERENCES users(id),
    started_at TEXT NOT NULL,
    ended_at   TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_usage_sessions_ended ON usage_sessions(ended_at);

  -- Bytes enviados pela máquina em cada mês (chave 'AAAA-MM', UTC), medidos pelo próprio servidor.
  CREATE TABLE IF NOT EXISTS traffic_months (
    month TEXT PRIMARY KEY,
    bytes INTEGER NOT NULL
  );

  -- Saúde do servidor: uma amostra por minuto, guardadas por uma semana.
  CREATE TABLE IF NOT EXISTS health_samples (
    at         TEXT PRIMARY KEY,
    cpu        REAL NOT NULL,
    memory     REAL NOT NULL,
    disk_free  INTEGER,
    disk_total INTEGER,
    livekit_ok INTEGER NOT NULL,
    errors     INTEGER NOT NULL DEFAULT 0,
    net_in     INTEGER,
    net_out    INTEGER
  );

  -- Acontecimentos dignos de nota: reinícios, voz fora do ar, rajadas de erro.
  CREATE TABLE IF NOT EXISTS health_events (
    id     INTEGER PRIMARY KEY,
    at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    kind   TEXT NOT NULL,
    detail TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS kv (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS avatars (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    mime    TEXT NOT NULL,
    data    BLOB NOT NULL
  );

  -- AUTOINCREMENT: um id nunca é reaproveitado, então a URL de cada arquivo pode ficar em cache para sempre.
  -- O nome é único dentro da comunidade: duas comunidades podem ter o seu próprio :boom:.
  CREATE TABLE IF NOT EXISTS emojis (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    name         TEXT NOT NULL COLLATE NOCASE,
    mime         TEXT NOT NULL,
    data         BLOB NOT NULL,
    created_by   INTEGER,
    UNIQUE (community_id, name)
  );

  -- Pacote de sons: uma coleção com nome, autor e nota, que cada pessoa instala no seu soundboard.
  -- Os sons de um pacote ficam guardados uma vez só para o servidor inteiro, não por comunidade.
  CREATE TABLE IF NOT EXISTS packs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    icon        TEXT NOT NULL DEFAULT '📦',
    created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    builtin     INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  -- Quem instalou cada pacote. É essa contagem que aparece como "baixaram".
  CREATE TABLE IF NOT EXISTS pack_installs (
    pack_id      INTEGER NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    installed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (pack_id, user_id)
  );



  -- Músicas do karaokê. Cada comunidade tem as suas, e quem sobe é quem tem o arquivo — o Syden não
  -- traz música nenhuma junto. A letra fica ao lado do áudio, no formato .lrc (com o tempo de cada
  -- linha) ou como texto simples.
  CREATE TABLE IF NOT EXISTS karaoke_songs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    title        TEXT NOT NULL,
    artist       TEXT NOT NULL DEFAULT '',
    mime         TEXT NOT NULL,
    data         BLOB NOT NULL,
    seconds      INTEGER NOT NULL DEFAULT 0,
    lyrics       TEXT NOT NULL DEFAULT '',
    created_by   INTEGER,
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX IF NOT EXISTS idx_karaoke_community ON karaoke_songs(community_id);

  -- Pacote de emojis: uma coleção que alguém monta e qualquer comunidade instala de uma vez. Diferente
  -- dos pacotes de som, que cada PESSOA instala no próprio soundboard, este é instalado na COMUNIDADE —
  -- emoji só serve se todo mundo da conversa enxergar o mesmo desenho.
  CREATE TABLE IF NOT EXISTS emoji_packs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    icon        TEXT NOT NULL DEFAULT '😀',
    created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  -- Os desenhos do pacote, guardados uma vez só para o servidor inteiro.
  CREATE TABLE IF NOT EXISTS emoji_pack_items (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    pack_id INTEGER NOT NULL REFERENCES emoji_packs(id) ON DELETE CASCADE,
    name    TEXT NOT NULL COLLATE NOCASE,
    mime    TEXT NOT NULL,
    data    BLOB NOT NULL,
    UNIQUE (pack_id, name)
  );

  -- Em quais comunidades o pacote está instalado. É essa contagem que vira "N comunidades usam".
  CREATE TABLE IF NOT EXISTS emoji_pack_installs (
    pack_id      INTEGER NOT NULL REFERENCES emoji_packs(id) ON DELETE CASCADE,
    community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    installed_by INTEGER,
    installed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (pack_id, community_id)
  );

  CREATE TABLE IF NOT EXISTS emoji_pack_ratings (
    pack_id INTEGER NOT NULL REFERENCES emoji_packs(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stars   INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
    PRIMARY KEY (pack_id, user_id)
  );

  -- Uma nota de 1 a 5 estrelas por pessoa, como no VS Code.
  CREATE TABLE IF NOT EXISTS pack_ratings (
    pack_id INTEGER NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    stars   INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
    PRIMARY KEY (pack_id, user_id)
  );

  -- Sons preferidos de cada pessoa, que aparecem primeiro no soundboard.
  CREATE TABLE IF NOT EXISTS favorite_sounds (
    user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sound_id INTEGER NOT NULL REFERENCES sounds(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, sound_id)
  );

  -- Um som é de uma comunidade (alguém de lá enviou) ou de um pacote (catálogo do servidor), nunca dos dois.
  CREATE TABLE IF NOT EXISTS sounds (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    community_id INTEGER REFERENCES communities(id) ON DELETE CASCADE,
    pack_id      INTEGER REFERENCES packs(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    icon         TEXT NOT NULL,
    mime         TEXT NOT NULL,
    data         BLOB NOT NULL,
    created_by   INTEGER
  );

  -- Arquivos e imagens enviados numa mensagem. AUTOINCREMENT pelo mesmo motivo dos emojis:
  -- o id nunca se repete, então o navegador pode guardar o arquivo em cache para sempre.
  CREATE TABLE IF NOT EXISTS attachments (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    -- Parte secreta do endereço: sem ela ninguém abre o arquivo, nem adivinhando o número.
    key        TEXT NOT NULL,
    name       TEXT NOT NULL,
    mime       TEXT NOT NULL,
    size       INTEGER NOT NULL,
    width      INTEGER,
    height     INTEGER,
    data       BLOB NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_attachments_message ON attachments(message_id);

  -- Enquetes: cada uma é uma mensagem com pergunta e opções.
  CREATE TABLE IF NOT EXISTS polls (
    id         INTEGER PRIMARY KEY,
    message_id INTEGER NOT NULL UNIQUE REFERENCES messages(id) ON DELETE CASCADE,
    question   TEXT NOT NULL,
    multiple   INTEGER NOT NULL DEFAULT 0,
    closed     INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS poll_options (
    id       INTEGER PRIMARY KEY,
    poll_id  INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    text     TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON poll_options(poll_id, position);

  CREATE TABLE IF NOT EXISTS poll_votes (
    poll_id   INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
    option_id INTEGER NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
    user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (option_id, user_id)
  );

  -- Tópicos: uma conversa à parte pendurada numa mensagem, para não atravessar o canal.
  CREATE TABLE IF NOT EXISTS threads (
    id                INTEGER PRIMARY KEY,
    channel_id        INTEGER NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    parent_message_id INTEGER NOT NULL UNIQUE REFERENCES messages(id) ON DELETE CASCADE,
    title             TEXT NOT NULL,
    created_by        INTEGER,
    created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  -- Reação numa mensagem: "emoji" é um caractere Unicode ou ":nome:" de um emoji da comunidade.
  -- As ideias mandadas pela tela inicial. A conversa em si é uma conversa privada normal; esta tabela
  -- só guarda o que a conversa não sabe: qual mensagem é uma ideia, se ela já foi acolhida e se a
  -- pessoa já viu a comemoração (o confete só pode cair uma vez, mesmo que ela estivesse offline).
  CREATE TABLE IF NOT EXISTS suggestions (
    id            INTEGER PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message_id    INTEGER NOT NULL UNIQUE REFERENCES messages(id) ON DELETE CASCADE,
    content       TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    accepted_at   TEXT,
    celebrated_at TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_suggestions_user ON suggestions(user_id, accepted_at);

  -- Cada pessoa reage no máximo uma vez com o mesmo emoji na mesma mensagem.
  CREATE TABLE IF NOT EXISTS message_reactions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    emoji      TEXT NOT NULL,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (message_id, emoji, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_reactions_message ON message_reactions(message_id, id);

  -- O que cada pessoa tem. Serve para presente do sistema (a insígnia dos 25 primeiros), para recompensa
  -- (a medalha de ideia acolhida) e, mais para frente, para o que for comprado na loja. O DESENHO de cada
  -- item mora no app, não aqui: o banco guarda só o código, para trocar arte sem mexer em banco.
  -- Os servidores de jogo de uma comunidade: uma agenda de endereços, nada mais. O Syden não fala
  -- com esses servidores (ver server/src/jogos.ts).
  -- Entrar com Google/Discord: a ligação entre uma conta do Syden e a conta de lá.
  -- Uma pessoa pode ligar os dois provedores na mesma conta, e por isso a chave é o par.
  CREATE TABLE IF NOT EXISTS social_accounts (
    provedor   TEXT NOT NULL,
    sub        TEXT NOT NULL,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (provedor, sub)
  );

  CREATE INDEX IF NOT EXISTS idx_social_accounts_user ON social_accounts(user_id);

  -- As idas e vindas em andamento. Nasce quando o navegador pede para entrar, morre quando ele
  -- troca o comprovante pelo token — ou quando vence, meia hora depois.
  CREATE TABLE IF NOT EXISTS social_states (
    state      TEXT PRIMARY KEY,
    provedor   TEXT NOT NULL,
    -- O sha256 do segredo que ficou SÓ no navegador que começou. É o que impede login CSRF.
    resumo     TEXT NOT NULL,
    -- Preenchido quando o provedor volta: o comprovante de uso único e de quem é a conta.
    entrega    TEXT,
    user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE INDEX IF NOT EXISTS idx_social_states_entrega ON social_states(entrega);

  CREATE TABLE IF NOT EXISTS game_servers (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    nome         TEXT NOT NULL,
    jogo         TEXT NOT NULL,
    endereco     TEXT NOT NULL,
    senha        TEXT,
    observacao   TEXT,
    created_by   INTEGER NOT NULL REFERENCES users(id),
    created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE INDEX IF NOT EXISTS idx_game_servers_community ON game_servers(community_id, jogo, nome);

  CREATE TABLE IF NOT EXISTS user_items (
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code        TEXT NOT NULL,
    granted_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    reason      TEXT,
    -- Nulo enquanto a pessoa não viu a tela de destaque. É isto que faz o presente esperar por quem
    -- estava offline na hora em que ganhou.
    revealed_at TEXT,
    PRIMARY KEY (user_id, code)
  );
  CREATE INDEX IF NOT EXISTS idx_user_items_user ON user_items(user_id, revealed_at);

  -- Quem fez o quê, quando se trata de poder sobre os outros: apagar mensagem alheia, tirar alguém de uma
  -- comunidade, excluir uma conta, dar ou tirar o cargo de administrador.
  --
  -- Sem este registro não há como responder a uma reclamação ("quem apagou a minha mensagem?") nem provar
  -- que não foi você. Os nomes ficam guardados POR EXTENSO, e não só o número da conta, porque a conta
  -- pode ser apagada depois e o registro precisa continuar legível.
  CREATE TABLE IF NOT EXISTS audit_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    at           TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    actor_id     INTEGER,
    actor_name   TEXT NOT NULL,
    action       TEXT NOT NULL,
    target       TEXT,
    community_id INTEGER,
    detail       TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_log(id DESC);

  -- Os links que vão por e-mail: confirmar o endereço e recuperar a senha.
  --
  -- O que fica guardado é o RESUMO do código (hash), nunca ele mesmo — quem puser as mãos no banco não
  -- consegue entrar na conta de ninguém, do mesmo jeito que acontece com a senha. Cada código vale uma
  -- vez só e tem hora para vencer.
  CREATE TABLE IF NOT EXISTS email_tokens (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind       TEXT NOT NULL CHECK (kind IN ('verificar', 'recuperar')),
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at    TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
  CREATE INDEX IF NOT EXISTS idx_email_tokens_user ON email_tokens(user_id, kind);

  -- Denúncias. Quem recebe pessoas de fora precisa de um caminho para alguém dizer "isto aqui está errado"
  -- sem ter que achar o dono no particular. O texto denunciado é copiado para cá porque a mensagem pode
  -- ser apagada antes de alguém olhar a denúncia — e aí não sobraria o que julgar.
  -- As preferências de cada pessoa, para não se perderem na troca de navegador ou de aparelho.
  -- Um JSON só, porque o conjunto muda com frequência e cada preferência nova viraria uma migração.
  -- O servidor não interpreta o conteúdo: quem decide o que sobe é o site (ver preferencias.ts).
  -- Amizades.
  --
  -- UMA LINHA POR PAR, não duas. Guardar os dois sentidos parece mais simples na hora de consultar e
  -- cobra caro depois: as duas linhas podem discordar entre si — aceita de um lado, pendente do
  -- outro — e nada no banco impediria isso. Aqui o par é sempre gravado com o MENOR id primeiro, e
  -- então a chave primária garante sozinha que não existe pedido repetido nem invertido.
  --
  -- quem_pediu registra de que lado veio o convite. É o que permite mostrar "você pediu" para um e
  -- "quer ser seu amigo" para o outro a partir da mesma linha.
  CREATE TABLE IF NOT EXISTS friendships (
    menor_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    maior_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    quem_pediu INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    situacao   TEXT NOT NULL CHECK (situacao IN ('pendente', 'aceita')) DEFAULT 'pendente',
    criada_em  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    aceita_em  TEXT,
    PRIMARY KEY (menor_id, maior_id),
    CHECK (menor_id < maior_id)
  );
  CREATE INDEX IF NOT EXISTS idx_friendships_maior ON friendships(maior_id);

  -- Bloqueios.
  --
  -- DIRECIONAL, ao contrário da amizade: eu posso bloquear você sem que você me bloqueie. E, também
  -- ao contrário da amizade, ele NÃO precisa do consentimento do outro lado nem é visível para ele —
  -- quem bloqueia não deve nenhuma explicação, e avisar transformaria um ato de defesa num conflito.
  --
  -- O efeito vale NOS DOIS SENTIDOS mesmo sendo guardado num só: se eu bloqueio você, nem eu falo com
  -- você nem você fala comigo. Um bloqueio que só cala um lado não protege ninguém.
  CREATE TABLE IF NOT EXISTS blocks (
    quem_bloqueou INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bloqueado     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    criado_em     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (quem_bloqueou, bloqueado),
    CHECK (quem_bloqueou <> bloqueado)
  );
  CREATE INDEX IF NOT EXISTS idx_blocks_bloqueado ON blocks(bloqueado);

  CREATE TABLE IF NOT EXISTS user_prefs (
    user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data       TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS reports (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    reporter_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reporter_name TEXT NOT NULL,
    kind          TEXT NOT NULL CHECK (kind IN ('mensagem', 'pessoa')),
    target_id     INTEGER,
    target_name   TEXT,
    snapshot      TEXT,
    reason        TEXT NOT NULL,
    community_id  INTEGER,
    status        TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'resolvida')),
    resolved_by   TEXT,
    resolved_at   TEXT,
    resolution    TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status, id DESC);
`);

/**
 * Migrações com nome, que rodam uma vez só e ficam registradas.
 *
 * As mudanças de ESTRUTURA (coluna nova, tabela nova) se conferem sozinhas: `addColumnIfMissing` olha o
 * que existe antes de mexer, e `CREATE TABLE IF NOT EXISTS` não repete. Já as mudanças de CONTEÚDO — as
 * que reescrevem dados de gente de verdade — não podem depender disso: rodar duas vezes pode estragar o
 * que a primeira arrumou. Estas passam por aqui.
 *
 * O registro também responde, meses depois, "esta correção já rodou neste servidor?" — que é a pergunta
 * que não tinha resposta quando o banco só evoluía em silêncio.
 */
db.exec(`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    name    TEXT PRIMARY KEY,
    ran_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );
`);

function migrar(nome: string, passo: () => void) {
  if (db.prepare('SELECT 1 FROM schema_migrations WHERE name = ?').get(nome)) return;
  db.exec('BEGIN');
  try {
    passo();
    db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(nome);
    db.exec('COMMIT');
  } catch (erro) {
    // Sem gravar o nome: na próxima inicialização ela tenta de novo, em vez de ficar pela metade.
    db.exec('ROLLBACK');
    throw erro;
  }
}

/** O que já rodou neste banco, para o painel de quem cuida do servidor. */
export function migracoesAplicadas() {
  return db.prepare('SELECT name, ran_at AS ranAt FROM schema_migrations ORDER BY ran_at, name').all() as unknown as {
    name: string;
    ranAt: string;
  }[];
}

// Colunas que chegaram depois da primeira versão: bancos antigos ganham elas na inicialização.
function addColumnIfMissing(table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
function hasColumn(table: string, column: string) {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some((c) => c.name === column);
}

// Em qual comunidade a chamada aconteceu. Fica NULO nas sessões antigas, e é isso que permite dizer
// na tela "contado a partir de tal dia" em vez de mostrar um número que parece o histórico inteiro e
// não é. Sem ON DELETE: a comunidade pode sumir e o registro de uso continua valendo para o total.
addColumnIfMissing('usage_sessions', 'community_id', 'INTEGER');
// O selo da comunidade: quatro caracteres, um icone e uma cor, exibidos ao lado do nome dos membros.
// Fica nulo enquanto a comunidade nao alcancou o primeiro marco, ou nao escolheu o selo dela.
addColumnIfMissing('communities', 'selo_texto', 'TEXT');
addColumnIfMissing('communities', 'selo_icone', 'TEXT');
addColumnIfMissing('communities', 'selo_cor', 'TEXT');

// O ESPAÇO DE BOAS-VINDAS da comunidade: a primeira coisa que alguém vê ao entrar.
//
// Antes, entrar numa comunidade era cair numa lista de canais — correto e frio, como chegar numa casa
// e ver só o corredor. Aqui o dono escreve o que quiser dizer, escolhe uma arte, e aponta o que a
// pessoa deve fazer primeiro.
//
// A ARTE É UM CÓDIGO, e não uma imagem. Pela mesma razão das molduras da loja: trocar um degradê ou
// acrescentar uma arte nova vira uma mudança no site, publicada sozinha, sem tocar no servidor nem
// migrar banco. O desenho mora em web/src/boasVindas.ts.
// MODO APRESENTAÇÃO da sala de voz: uma pessoa fala e as outras assistem.
//
// Nulo ou 0 é o comum — todo mundo fala, como sempre foi. Ligado, só quem está no palco publica voz,
// câmera e tela; o resto entra como plateia e pode levantar a mão.
addColumnIfMissing('channels', 'apresentacao', 'INTEGER NOT NULL DEFAULT 0');

addColumnIfMissing('communities', 'bv_titulo', 'TEXT');
addColumnIfMissing('communities', 'bv_texto', 'TEXT');
addColumnIfMissing('communities', 'bv_arte', 'TEXT');

// Quando esta pessoa viu as boas-vindas desta comunidade. Nulo = nunca viu.
//
// FICA NO SERVIDOR, e não no navegador, de propósito: a pessoa que entra pelo computador de casa e
// depois pelo do trabalho não deve receber as boas-vindas duas vezes. É uma data, e não um sim/não,
// porque um dia vai ser útil saber QUANDO — e porque data que já existe não precisa de migração nova
// quando a pergunta mudar.
addColumnIfMissing('community_members', 'viu_boas_vindas', 'TEXT');
addColumnIfMissing('users', 'is_admin', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('channels', 'created_by', 'INTEGER');
// Muda a cada troca de avatar; entra na URL da imagem para o navegador buscar a nova. null = sem avatar.
addColumnIfMissing('users', 'avatar_version', 'INTEGER');
addColumnIfMissing('users', 'is_owner', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('users', 'accepted_ideas', 'INTEGER NOT NULL DEFAULT 0');
// Enfeites do perfil: a cor do nome e o fundo do cartão de perfil. Os dois guardam só o NOME da opção
// escolhida (ex.: 'carmim', 'aurora'); as cores de verdade moram no app, para dar para mexer sem migrar.
addColumnIfMissing('users', 'name_color', 'TEXT');
addColumnIfMissing('users', 'banner', 'TEXT');
// Número da sessão: vai dentro do token de login e é conferido a cada pedido. Aumentar este número
// derruba, na hora, todos os aparelhos que estavam logados — é como o Syden "desconecta" alguém sem
// poder apagar um token que já saiu daqui. Trocar a senha aumenta; a pessoa também pode aumentar à mão.
addColumnIfMissing('users', 'session_version', 'INTEGER NOT NULL DEFAULT 1');
// Quais insígnias a pessoa escolheu exibir, e em que ordem: os códigos separados por vírgula. Fica aqui,
// e não numa consulta à user_items, porque a lista de membros mostra isto de todo mundo o tempo todo.
addColumnIfMissing('users', 'vitrine', 'TEXT');
// A moldura do avatar, cosmético da loja. Guarda só o NOME da escolha ('prata'); o desenho mora no app.
addColumnIfMissing('users', 'moldura', 'TEXT');
// Qual SELO a pessoa escolheu vestir. Guarda o numero da comunidade, e nao uma copia do selo: assim,
// quando a comunidade troca o dela, o de quem veste troca junto, sem ninguem precisar reescolher.
// ON DELETE nao se aplica (e uma coluna solta): quem le confere se a comunidade ainda existe.
addColumnIfMissing('users', 'selo_comunidade', 'INTEGER');
// Ligar um provedor a uma conta QUE JÁ EXISTE é o mesmo passeio até o provedor, com outro destino no
// fim: em vez de achar/criar conta, pendura a conta de lá nesta aqui. Quem é "esta aqui" fica em
// ligar_user_id, escrito quando o passeio começa — por um pedido autenticado, que é o que prova quem é.
addColumnIfMissing('social_states', 'ligar_user_id', 'INTEGER');
addColumnIfMissing('social_states', 'sub', 'TEXT');

/**
 * Esta conta precisa confirmar o e-mail antes de entrar?
 *
 * É uma COLUNA, e não uma conta de datas, porque quem já tinha conta antes da regra existir não pode
 * ser trancado do lado de fora por ela. As linhas antigas ficam em 0 e seguem entrando como sempre;
 * só o cadastro novo por senha nasce com 1. Quem entra por Google/Discord/GitHub/Steam também nasce
 * com 0: o provedor já é a prova de que a pessoa existe, que é o que a confirmação vai buscar.
 */
addColumnIfMissing('users', 'exige_confirmacao', 'INTEGER NOT NULL DEFAULT 0');
// O e-mail é opcional: quem já tem conta continua entrando sem ele. Serve para recuperar a senha e para
// avisar de um incidente — sem endereço nenhum, quem esquece a senha perde a conta para sempre.
addColumnIfMissing('users', 'email', 'TEXT');
addColumnIfMissing('users', 'email_verified_at', 'TEXT');
// Dois cadastros não podem ficar com o mesmo endereço, senão "recuperar a senha" fica ambíguo. O índice é
// único mas aceita vários vazios, que é o caso de quem ainda não pôs e-mail.
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL');

// Quem já tinha medalha de ideia acolhida antes de o inventário existir passa a tê-la como item — já
// revelada, porque essas pessoas viram o confete na época, e já na vitrine, para o perfil continuar
// exatamente como estava.
//
// Esta mexe em DADOS, e por isso é uma migração com nome: se rodasse de novo depois de alguém escolher
// esconder a medalha do perfil, ela a devolveria à vitrine sem a pessoa pedir.
const MEDALHA_VIRA_ITEM = '2026-09-26-medalha-vira-item';
// Esta migração foi ao ar antes de existir o registro de migrações, então há bancos onde ela já rodou
// sem deixar rastro. Se o inventário já tem medalhas de ideia acolhida, ela já passou por aqui: marcamos
// como aplicada em vez de repetir — repetir devolveria a medalha ao perfil de quem escolheu escondê-la.
if (db.prepare("SELECT 1 FROM user_items WHERE code = 'ideia-acolhida' LIMIT 1").get()) {
  db.prepare('INSERT OR IGNORE INTO schema_migrations (name) VALUES (?)').run(MEDALHA_VIRA_ITEM);
}

migrar(MEDALHA_VIRA_ITEM, () => {
  db.exec(`
    INSERT OR IGNORE INTO user_items (user_id, code, reason, revealed_at)
    SELECT id, 'ideia-acolhida', 'Ideia acolhida no Syden', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    FROM users WHERE accepted_ideas > 0;

    UPDATE users SET vitrine = 'ideia-acolhida'
    WHERE accepted_ideas > 0 AND (vitrine IS NULL OR vitrine = '');
  `);
});
// De qual pacote o emoji veio, para dar para tirar o pacote inteiro depois. Null = enviado à mão.
addColumnIfMissing('emojis', 'pack_id', 'INTEGER');
// Recados em vídeo de tela ocupam muito espaço, então têm prazo: passado o dia marcado, somem sozinhos.
// Null = anexo comum, que fica para sempre.
addColumnIfMissing('attachments', 'expires_at', 'TEXT');
// Imagem da comunidade: chegou depois das comunidades.
addColumnIfMissing('communities', 'icon_version', 'INTEGER');
// Velocidade de rede: chegou depois do painel de saúde.
addColumnIfMissing('health_samples', 'net_in', 'INTEGER');
addColumnIfMissing('health_samples', 'net_out', 'INTEGER');
// Mensagem de tópico: null quando ela está no canal, como todas as mensagens antigas.
addColumnIfMissing('messages', 'thread_id', 'INTEGER REFERENCES threads(id) ON DELETE CASCADE');
db.exec('CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id, id)');

// O emoji ":f:" do primeiro pacote tinha 1 letra, abaixo do mínimo de 2, e não funcionava nas mensagens.
if (!db.prepare("SELECT 1 FROM emojis WHERE name = 'pressf'").get()) {
  db.prepare("UPDATE emojis SET name = 'pressf' WHERE name = 'f' AND created_by IS NULL").run();
}

/**
 * Todo servidor com membros tem um dono, que também é administrador. Sem dono (banco de antes dos cargos, ou o
 * dono excluiu a conta), o administrador mais antigo assume; se não houver administrador, o membro mais antigo.
 */
function ensureOwner() {
  if (db.prepare('SELECT 1 FROM users WHERE is_owner = 1').get()) return;
  db.exec('UPDATE users SET is_owner = 1, is_admin = 1 WHERE id = (SELECT id FROM users ORDER BY is_admin DESC, id LIMIT 1)');
}
ensureOwner();

/** Código de convite curto e fácil de ditar por voz (sem 0/O nem 1/I, que confundem). */
export function newInviteCode() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 8 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

/**
 * Antes das comunidades existia um conjunto único de canais, emojis e sons. Tudo isso vira a primeira
 * comunidade, com os membros de hoje dentro dela e o dono do Syden como dono dela.
 */
function migrateToCommunities() {
  if (hasColumn('channels', 'community_id')) return; // banco novo, ou já migrado
  db.exec('BEGIN');
  try {
    const owner = db.prepare('SELECT id FROM users ORDER BY is_owner DESC, is_admin DESC, id LIMIT 1').get() as
      | { id: number }
      | undefined;
    const { lastInsertRowid } = db
      .prepare('INSERT INTO communities (name, invite_code, created_by) VALUES (?, ?, ?)')
      .run('Syden', config.inviteCode || newInviteCode(), owner?.id ?? null);
    const communityId = Number(lastInsertRowid);

    db.prepare(
      `INSERT INTO community_members (community_id, user_id, role)
       SELECT ?, id, CASE WHEN is_owner = 1 THEN 'owner' WHEN is_admin = 1 THEN 'admin' ELSE 'member' END FROM users`,
    ).run(communityId);

    for (const table of ['channels', 'sounds']) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN community_id INTEGER`);
      db.prepare(`UPDATE ${table} SET community_id = ?`).run(communityId);
    }

    // A tabela de emojis exigia nome único no servidor inteiro; agora o nome é único dentro da comunidade.
    // Mudar isso no SQLite significa recriar a tabela e copiar os dados (os ids são preservados).
    db.exec(`
      CREATE TABLE emojis_new (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
        name         TEXT NOT NULL COLLATE NOCASE,
        mime         TEXT NOT NULL,
        data         BLOB NOT NULL,
        created_by   INTEGER,
        UNIQUE (community_id, name)
      )`);
    db.prepare('INSERT INTO emojis_new (id, community_id, name, mime, data, created_by) SELECT id, ?, name, mime, data, created_by FROM emojis').run(
      communityId,
    );
    db.exec('DROP TABLE emojis; ALTER TABLE emojis_new RENAME TO emojis;');
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
migrateToCommunities();

/**
 * As conversas privadas moram na mesma tabela dos canais (assim herdam anexos, reações, enquetes e
 * tópicos de graça), mas sem comunidade e com o tipo 'dm'. Bancos antigos têm community_id NOT NULL e
 * o tipo limitado a text/voice, então a tabela precisa ser recriada — é o caminho oficial do SQLite para
 * afrouxar uma restrição. As chaves estrangeiras ficam desligadas durante a troca: sem isso, o DROP da
 * tabela antiga apagaria em cascata todas as mensagens e tópicos.
 */
function migrateChannelsForDirectMessages() {
  const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'channels'").get() as
    | { sql: string }
    | undefined;
  if (!schema || schema.sql.includes("'dm'")) return; // banco novo, ou já migrado

  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN');
  try {
    db.exec(`
      CREATE TABLE channels_new (
        id           INTEGER PRIMARY KEY,
        community_id INTEGER REFERENCES communities(id) ON DELETE CASCADE,
        name         TEXT NOT NULL,
        type         TEXT NOT NULL CHECK (type IN ('text', 'voice', 'dm')),
        position     INTEGER NOT NULL DEFAULT 0,
        created_by   INTEGER
      )`);
    db.exec(
      'INSERT INTO channels_new (id, community_id, name, type, position, created_by) SELECT id, community_id, name, type, position, created_by FROM channels',
    );
    db.exec('DROP TABLE channels');
    db.exec('ALTER TABLE channels_new RENAME TO channels');
    const quebradas = db.prepare('PRAGMA foreign_key_check').all();
    if (quebradas.length > 0) throw new Error(`Chaves estrangeiras quebradas após migrar canais: ${JSON.stringify(quebradas)}`);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}
migrateChannelsForDirectMessages();

/**
 * Os sons deixaram de ser só "da comunidade": agora existem também os de pacote, que ficam guardados uma
 * vez só para o servidor inteiro (community_id null, pack_id preenchido). Bancos antigos têm community_id
 * NOT NULL e nenhuma coluna pack_id, então a tabela precisa ser recriada — é o caminho do SQLite para
 * afrouxar uma restrição. As chaves estrangeiras ficam desligadas durante a troca: sem isso, o DROP da
 * tabela antiga apagaria em cascata os favoritos que apontam para ela.
 */
function migrateSoundsForPacks() {
  if (hasColumn('sounds', 'pack_id')) return; // banco novo, ou já migrado

  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN');
  try {
    db.exec(`
      CREATE TABLE sounds_new (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        community_id INTEGER REFERENCES communities(id) ON DELETE CASCADE,
        pack_id      INTEGER REFERENCES packs(id) ON DELETE CASCADE,
        name         TEXT NOT NULL,
        icon         TEXT NOT NULL,
        mime         TEXT NOT NULL,
        data         BLOB NOT NULL,
        created_by   INTEGER
      )`);
    db.exec(
      'INSERT INTO sounds_new (id, community_id, name, icon, mime, data, created_by) SELECT id, community_id, name, icon, mime, data, created_by FROM sounds',
    );
    db.exec('DROP TABLE sounds');
    db.exec('ALTER TABLE sounds_new RENAME TO sounds');
    db.exec('CREATE INDEX IF NOT EXISTS idx_sounds_pack ON sounds(pack_id)');
    const quebradas = db.prepare('PRAGMA foreign_key_check').all();
    if (quebradas.length > 0) throw new Error(`Chaves estrangeiras quebradas após migrar sons: ${JSON.stringify(quebradas)}`);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}
migrateSoundsForPacks();
// Depois da migração a coluna existe em qualquer banco, novo ou antigo.
db.exec('CREATE INDEX IF NOT EXISTS idx_sounds_pack ON sounds(pack_id)');

/** Canais que toda comunidade nova ganha, para ninguém começar numa tela vazia. */
export function seedChannels(communityId: number) {
  const insert = db.prepare('INSERT INTO channels (community_id, name, type, position) VALUES (?, ?, ?, ?)');
  insert.run(communityId, 'geral', 'text', 0);
  insert.run(communityId, 'jogos', 'text', 1);
  insert.run(communityId, 'Sala 1', 'voice', 2);
  insert.run(communityId, 'Sala 2', 'voice', 3);
}

// ---------- Comunidades ----------

const communityColumns =
  'id, name, created_by AS createdBy, icon_version AS iconVersion, selo_texto AS seloTexto, selo_icone AS seloIcone, selo_cor AS seloCor';

export function listCommunitiesForUser(userId: number): CommunityForUser[] {
  return db
    .prepare(
      `SELECT c.id, c.name, c.created_by AS createdBy, c.icon_version AS iconVersion,
              c.selo_texto AS seloTexto, c.selo_icone AS seloIcone, c.selo_cor AS seloCor, m.role,
              (SELECT COUNT(*) FROM community_members WHERE community_id = c.id) AS memberCount,
              CASE WHEN m.role IN ('owner', 'admin') THEN c.invite_code END AS inviteCode
       FROM communities c JOIN community_members m ON m.community_id = c.id
       WHERE m.user_id = ? ORDER BY m.joined_at, c.id`,
    )
    .all(userId) as unknown as CommunityForUser[];
}

export function findCommunity(id: number) {
  return db.prepare(`SELECT ${communityColumns} FROM communities WHERE id = ?`).get(id) as Community | undefined;
}

export function findCommunityByInvite(code: string) {
  return db.prepare(`SELECT ${communityColumns} FROM communities WHERE invite_code = ?`).get(code.trim()) as Community | undefined;
}

export function communityInviteCode(id: number) {
  return (db.prepare('SELECT invite_code AS code FROM communities WHERE id = ?').get(id) as { code: string } | undefined)?.code;
}

export function setCommunityInviteCode(id: number, code: string) {
  db.prepare('UPDATE communities SET invite_code = ? WHERE id = ?').run(code, id);
}

/** A comunidade mais antiga: é a de todo mundo que se cadastra sem código de outra. */
export function defaultCommunity() {
  return db.prepare(`SELECT ${communityColumns} FROM communities ORDER BY id LIMIT 1`).get() as Community | undefined;
}

export function createCommunity(name: string, ownerId: number, inviteCode: string): Community {
  const result = db
    .prepare('INSERT INTO communities (name, invite_code, created_by) VALUES (?, ?, ?)')
    .run(name, inviteCode, ownerId);
  const id = Number(result.lastInsertRowid);
  addMember(id, ownerId, 'owner');
  seedChannels(id);
  return findCommunity(id)!;
}

export function renameCommunity(id: number, name: string) {
  db.prepare('UPDATE communities SET name = ? WHERE id = ?').run(name, id);
  return findCommunity(id)!;
}

/** Apaga a comunidade inteira: canais, mensagens, emojis, sons e a lista de membros (ON DELETE CASCADE). */
export function deleteCommunity(id: number) {
  db.prepare('DELETE FROM communities WHERE id = ?').run(id);
}

/** Guarda (ou apaga, com null) a imagem da comunidade e marca a versão nova. */
export function setCommunityIcon(communityId: number, icon: { mime: string; data: Buffer } | null): Community {
  if (icon) {
    db.prepare(
      'INSERT INTO community_icons (community_id, mime, data) VALUES (?, ?, ?) ON CONFLICT(community_id) DO UPDATE SET mime = excluded.mime, data = excluded.data',
    ).run(communityId, icon.mime, icon.data);
    db.prepare('UPDATE communities SET icon_version = ? WHERE id = ?').run(Date.now(), communityId);
  } else {
    db.prepare('DELETE FROM community_icons WHERE community_id = ?').run(communityId);
    db.prepare('UPDATE communities SET icon_version = NULL WHERE id = ?').run(communityId);
  }
  return findCommunity(communityId)!;
}

export function findCommunityIcon(communityId: number) {
  return lendoArquivo(() => db.prepare('SELECT mime, data FROM community_icons WHERE community_id = ?').get(communityId)) as
    | { mime: string; data: Uint8Array }
    | undefined;
}

export function countCommunitiesCreatedBy(userId: number) {
  return (db.prepare('SELECT COUNT(*) AS n FROM communities WHERE created_by = ?').get(userId) as { n: number }).n;
}

export function countMembers(communityId: number) {
  return (db.prepare('SELECT COUNT(*) AS n FROM community_members WHERE community_id = ?').get(communityId) as { n: number }).n;
}

export function memberRole(communityId: number, userId: number): Role | undefined {
  return (db.prepare('SELECT role FROM community_members WHERE community_id = ? AND user_id = ?').get(communityId, userId) as
    | { role: Role }
    | undefined)?.role;
}

export function addMember(communityId: number, userId: number, role: Role = 'member') {
  db.prepare('INSERT OR IGNORE INTO community_members (community_id, user_id, role) VALUES (?, ?, ?)').run(communityId, userId, role);
}

export function setMemberRole(communityId: number, userId: number, role: Role) {
  db.prepare('UPDATE community_members SET role = ? WHERE community_id = ? AND user_id = ?').run(role, communityId, userId);
}

export function removeMember(communityId: number, userId: number) {
  db.prepare('DELETE FROM community_members WHERE community_id = ? AND user_id = ?').run(communityId, userId);
  // Quem sai do time devolve a camiseta. Fica AQUI, e não em cada rota que remove alguém, porque
  // sair de uma comunidade acontece por vários caminhos — pedido próprio, expulsão, conta excluída —
  // e um deles esqueceria. O sintoma seria mudo: a pessoa continuaria exibindo o selo de uma
  // comunidade de que não faz mais parte, e nada daria erro.
  db.prepare('UPDATE users SET selo_comunidade = NULL WHERE id = ? AND selo_comunidade = ?').run(userId, communityId);
}

export function listCommunityMembers(communityId: number): CommunityMember[] {
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.is_admin AS isAdmin, u.is_owner AS isOwner, u.avatar_version AS avatarVersion,
              u.name_color AS nameColor, u.banner, u.moldura, u.vitrine, u.accepted_ideas AS acceptedIdeas, m.role
       FROM community_members m JOIN users u ON u.id = m.user_id
       WHERE m.community_id = ? ORDER BY u.id`,
    )
    .all(communityId) as unknown as (UserRow & { role: Role })[];
  return rows.map((row) => ({ ...toUser(row)!, role: row.role }));
}

/** Comunidades de que a pessoa participa, só os ids (para as salas do socket). */
export function communityIdsForUser(userId: number): number[] {
  return (db.prepare('SELECT community_id AS id FROM community_members WHERE user_id = ?').all(userId) as { id: number }[]).map(
    (row) => row.id,
  );
}

const userColumns =
  'id, username, is_admin AS isAdmin, is_owner AS isOwner, avatar_version AS avatarVersion, name_color AS nameColor, banner, moldura, vitrine, accepted_ideas AS acceptedIdeas, ' +
  // O selo vestido, resolvido aqui mesmo. Guarda-se o NÚMERO da comunidade e não uma cópia do selo:
  // quando ela troca o dela, o de quem veste troca junto, sem ninguém precisar reescolher.
  '(SELECT selo_texto FROM communities c WHERE c.id = users.selo_comunidade) AS seloTexto, ' +
  '(SELECT selo_icone FROM communities c WHERE c.id = users.selo_comunidade) AS seloIcone, ' +
  '(SELECT selo_cor   FROM communities c WHERE c.id = users.selo_comunidade) AS seloCor';

type UserRow = {
  id: number;
  username: string;
  isAdmin: number;
  isOwner: number;
  avatarVersion: number | null;
  nameColor: string | null;
  banner: string | null;
  moldura: string | null;
  vitrine: string | null;
  acceptedIdeas: number;
  seloTexto: string | null;
  seloIcone: string | null;
  seloCor: string | null;
};

function toUser(row: UserRow | undefined): User | undefined {
  return (
    row && {
      id: row.id,
      username: row.username,
      isAdmin: row.isAdmin === 1,
      isOwner: row.isOwner === 1,
      avatarVersion: row.avatarVersion,
      nameColor: row.nameColor,
      banner: row.banner,
      moldura: row.moldura,
      vitrine: lerVitrine(row.vitrine),
      acceptedIdeas: row.acceptedIdeas ?? 0,
      // As três partes vêm juntas ou nenhuma vem: um selo pela metade não se desenha.
      selo:
        row.seloTexto && row.seloIcone && row.seloCor
          ? { texto: row.seloTexto, icone: row.seloIcone, cor: row.seloCor }
          : null,
    }
  );
}

/** A vitrine é guardada como texto separado por vírgula; aqui ela volta a ser lista. */
function lerVitrine(texto: string | null): string[] {
  return (texto ?? '')
    .split(',')
    .map((codigo) => codigo.trim())
    .filter(Boolean);
}


// ---------------------------------------------------------------------------------------------------
// E-mail: endereço da pessoa e os códigos de uso único
// ---------------------------------------------------------------------------------------------------

/** O e-mail de alguém e se ele já foi confirmado. Fora de `userColumns`: não é assunto de terceiros. */
export function emailDe(userId: number): { email: string | null; verifiedAt: string | null } {
  const row = db.prepare('SELECT email, email_verified_at AS verifiedAt FROM users WHERE id = ?').get(userId) as
    | { email: string | null; verifiedAt: string | null }
    | undefined;
  return row ?? { email: null, verifiedAt: null };
}

export function findUserByEmail(email: string): User | undefined {
  return toUser(db.prepare(`SELECT ${userColumns} FROM users WHERE email = ?`).get(email.trim().toLowerCase()) as never);
}

/** Troca o endereço e o marca como não confirmado: endereço novo começa sempre por confirmar. */
export function definirEmail(userId: number, email: string | null) {
  db.prepare('UPDATE users SET email = ?, email_verified_at = NULL WHERE id = ?').run(email?.trim().toLowerCase() ?? null, userId);
}

export function marcarEmailVerificado(userId: number) {
  db.prepare("UPDATE users SET email_verified_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(userId);
}

export type TipoDeCodigo = 'verificar' | 'recuperar';

/**
 * Guarda o resumo de um código novo e apaga os anteriores do mesmo tipo — pedir outro link invalida o
 * anterior, que é o que a pessoa espera ao clicar em "reenviar".
 */
export function guardarCodigo(userId: number, kind: TipoDeCodigo, tokenHash: string, expiresAt: string) {
  db.prepare('DELETE FROM email_tokens WHERE user_id = ? AND kind = ?').run(userId, kind);
  db.prepare('INSERT INTO email_tokens (user_id, kind, token_hash, expires_at) VALUES (?, ?, ?, ?)').run(
    userId,
    kind,
    tokenHash,
    expiresAt,
  );
}

/**
 * Consome um código: só vale se existir, for do tipo certo, não estiver vencido e não tiver sido usado.
 * Marcar como usado faz parte do mesmo passo, para o mesmo link não servir duas vezes.
 */
export function usarCodigo(kind: TipoDeCodigo, tokenHash: string): number | null {
  const row = db
    .prepare(
      `SELECT id, user_id AS userId FROM email_tokens
       WHERE token_hash = ? AND kind = ? AND used_at IS NULL AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    )
    .get(tokenHash, kind) as { id: number; userId: number } | undefined;
  if (!row) return null;
  db.prepare("UPDATE email_tokens SET used_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(row.id);
  return row.userId;
}

// ---------------------------------------------------------------------------------------------------
// Consultas de apoio da moderação e da exportação de dados
// ---------------------------------------------------------------------------------------------------

// ---------------------------------------------------------------------------------------------------
// Medidor das leituras de arquivo
// ---------------------------------------------------------------------------------------------------

/**
 * Quem recebe o tempo de cada leitura. Fica como função registrável para o banco não precisar conhecer
 * o módulo de saúde — seria uma dependência circular, já que a saúde consulta o banco.
 */
let anotarLeitura: (ms: number) => void = () => {};
export function aoLerArquivo(fn: (ms: number) => void) {
  anotarLeitura = fn;
}

/**
 * Envolve uma leitura de arquivo guardado no banco e mede quanto tempo ela levou. Como o node:sqlite é
 * síncrono, esse tempo É o tempo que o servidor inteiro ficou surdo: nada de voz nem de chat enquanto
 * durar. É o teto conhecido do projeto, e é isto que avisa quando ele começar a ser alcançado.
 */
function lendoArquivo<T>(consulta: () => T): T {
  const comeco = performance.now();
  try {
    return consulta();
  } finally {
    anotarLeitura(performance.now() - comeco);
  }
}

/**
 * Quanto espaço os arquivos de uma pessoa ocupam no banco, em bytes.
 *
 * Existe porque, com o cadastro aberto, qualquer conta pode subir avatar, emoji, som e anexo — e os
 * arquivos moram dentro do banco, que mora no disco da máquina. Sem um teto por pessoa, algumas milhares
 * de contas automáticas enchem o disco, e disco cheio é o Syden parando de aceitar mensagem de todo mundo.
 *
 * A soma passa por todas as tabelas que guardam bytes de alguém. Sai de graça: `length()` num BLOB do
 * SQLite lê o cabeçalho, não o conteúdo.
 */
export function espacoUsado(userId: number): number {
  const somas = [
    'SELECT COALESCE(SUM(length(data)), 0) AS n FROM avatars WHERE user_id = ?',
    'SELECT COALESCE(SUM(length(data)), 0) AS n FROM emojis WHERE created_by = ?',
    'SELECT COALESCE(SUM(length(data)), 0) AS n FROM sounds WHERE created_by = ?',
    'SELECT COALESCE(SUM(length(data)), 0) AS n FROM karaoke_songs WHERE created_by = ?',
    'SELECT COALESCE(SUM(length(a.data)), 0) AS n FROM attachments a JOIN messages m ON m.id = a.message_id WHERE m.user_id = ?',
  ];
  return somas.reduce((total, sql) => total + (db.prepare(sql).get(userId) as { n: number }).n, 0);
}

/** O texto de uma mensagem, para copiar dentro da denúncia antes que ela possa ser apagada. */
export function findMessageContent(id: number): string | null {
  return (db.prepare('SELECT content FROM messages WHERE id = ?').get(id) as { content: string } | undefined)?.content ?? null;
}

/** Quem cuida do Syden, para avisar de uma denúncia nova. */
export function listAdmins(): User[] {
  return (db.prepare(`SELECT ${userColumns} FROM users WHERE is_admin = 1`).all() as UserRow[]).map((row) => toUser(row)!);
}

export function criadaEm(userId: number): string | null {
  return (db.prepare('SELECT created_at AS em FROM users WHERE id = ?').get(userId) as { em: string } | undefined)?.em ?? null;
}

/** Tudo o que a pessoa escreveu, para a exportação dos dados dela. */
export function mensagensDaPessoa(userId: number) {
  return db
    .prepare(
      `SELECT m.id, m.created_at AS quando, m.content AS texto, c.name AS canal, c.community_id AS comunidadeId
       FROM messages m LEFT JOIN channels c ON c.id = m.channel_id
       WHERE m.user_id = ? ORDER BY m.id`,
    )
    .all(userId);
}

/** Quanto tempo a pessoa passou em chamada e transmitindo, que é o que o painel de uso mede sobre ela. */
export function usoDaPessoa(userId: number) {
  return db
    .prepare(
      `SELECT kind AS tipo, COUNT(*) AS vezes, SUM(strftime('%s', COALESCE(ended_at, started_at)) - strftime('%s', started_at)) AS segundos
       FROM usage_sessions WHERE user_id = ? GROUP BY kind`,
    )
    .all(userId);
}

// ---------------------------------------------------------------------------------------------------
// Denúncias
// ---------------------------------------------------------------------------------------------------

export interface Denuncia {
  id: number;
  at: string;
  reporterName: string;
  kind: 'mensagem' | 'pessoa';
  targetId: number | null;
  targetName: string | null;
  /** Cópia do que foi denunciado, para o caso de sumir antes de alguém olhar. */
  snapshot: string | null;
  reason: string;
  communityId: number | null;
  status: 'aberta' | 'resolvida';
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolution: string | null;
}

const denunciaColumns = `id, at, reporter_name AS reporterName, kind, target_id AS targetId, target_name AS targetName,
  snapshot, reason, community_id AS communityId, status, resolved_by AS resolvedBy, resolved_at AS resolvedAt, resolution`;

export function criarDenuncia(entrada: {
  reporter: { id: number; username: string };
  kind: 'mensagem' | 'pessoa';
  targetId?: number | null;
  targetName?: string | null;
  snapshot?: string | null;
  reason: string;
  communityId?: number | null;
}): Denuncia {
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO reports (reporter_id, reporter_name, kind, target_id, target_name, snapshot, reason, community_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      entrada.reporter.id,
      entrada.reporter.username,
      entrada.kind,
      entrada.targetId ?? null,
      entrada.targetName ?? null,
      entrada.snapshot ?? null,
      entrada.reason,
      entrada.communityId ?? null,
    );
  return db.prepare(`SELECT ${denunciaColumns} FROM reports WHERE id = ?`).get(Number(lastInsertRowid)) as unknown as Denuncia;
}

export function listarDenuncias(status?: 'aberta' | 'resolvida'): Denuncia[] {
  const sql = `SELECT ${denunciaColumns} FROM reports ${status ? 'WHERE status = ?' : ''} ORDER BY id DESC LIMIT 300`;
  return (status ? db.prepare(sql).all(status) : db.prepare(sql).all()) as unknown as Denuncia[];
}

export function contarDenunciasAbertas(): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM reports WHERE status = 'aberta'").get() as { n: number }).n;
}

export function resolverDenuncia(id: number, quem: string, resolucao: string): Denuncia | undefined {
  db.prepare(
    "UPDATE reports SET status = 'resolvida', resolved_by = ?, resolution = ?, resolved_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND status = 'aberta'",
  ).run(quem, resolucao, id);
  return db.prepare(`SELECT ${denunciaColumns} FROM reports WHERE id = ?`).get(id) as unknown as Denuncia | undefined;
}

/** Quantas denúncias esta pessoa já abriu hoje: quem denuncia tudo o tempo todo também é um problema. */
export function denunciasDeHoje(userId: number): number {
  return (
    db
      .prepare("SELECT COUNT(*) AS n FROM reports WHERE reporter_id = ? AND at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')")
      .get(userId) as { n: number }
  ).n;
}

// ---------------------------------------------------------------------------------------------------
// Registro de auditoria
// ---------------------------------------------------------------------------------------------------

export interface LinhaDeAuditoria {
  id: number;
  at: string;
  actorId: number | null;
  actorName: string;
  action: string;
  target: string | null;
  communityId: number | null;
  detail: string | null;
}

export function registrarAuditoria(entrada: {
  actor: { id: number; username: string };
  action: string;
  target?: string;
  communityId?: number | null;
  detail?: string;
}) {
  db.prepare('INSERT INTO audit_log (actor_id, actor_name, action, target, community_id, detail) VALUES (?, ?, ?, ?, ?, ?)').run(
    entrada.actor.id,
    entrada.actor.username,
    entrada.action,
    entrada.target ?? null,
    entrada.communityId ?? null,
    entrada.detail ?? null,
  );
}

export function lerAuditoria(limite = 200): LinhaDeAuditoria[] {
  return db
    .prepare(
      `SELECT id, at, actor_id AS actorId, actor_name AS actorName, action, target, community_id AS communityId, detail
       FROM audit_log ORDER BY id DESC LIMIT ?`,
    )
    .all(Math.min(Math.max(limite, 1), 500)) as unknown as LinhaDeAuditoria[];
}

// ---------------------------------------------------------------------------------------------------
// Inventário: o que cada pessoa tem
// ---------------------------------------------------------------------------------------------------

export interface ItemDaPessoa {
  code: string;
  grantedAt: string;
  reason: string | null;
  /** Nulo enquanto ela não viu a tela de destaque deste item. */
  revealedAt: string | null;
}

const itemColumns = 'code, granted_at AS grantedAt, reason, revealed_at AS revealedAt';

export function itensDaPessoa(userId: number): ItemDaPessoa[] {
  return db
    .prepare(`SELECT ${itemColumns} FROM user_items WHERE user_id = ? ORDER BY granted_at, code`)
    .all(userId) as unknown as ItemDaPessoa[];
}

export function temItem(userId: number, code: string): boolean {
  return db.prepare('SELECT 1 FROM user_items WHERE user_id = ? AND code = ?').get(userId, code) !== undefined;
}

/**
 * Dá um item a alguém. Devolve false se a pessoa já tinha — assim a conferência pode rodar toda vez que
 * ela entra, sem medo de dar o mesmo presente duas vezes.
 */
export function darItem(userId: number, code: string, reason: string): boolean {
  if (temItem(userId, code)) return false;
  db.prepare('INSERT INTO user_items (user_id, code, reason) VALUES (?, ?, ?)').run(userId, code, reason);
  return true;
}

/** Os que ainda não passaram pela tela de destaque, na ordem em que foram ganhos: é a fila. */
export function itensPorRevelar(userId: number): ItemDaPessoa[] {
  return db
    .prepare(`SELECT ${itemColumns} FROM user_items WHERE user_id = ? AND revealed_at IS NULL ORDER BY granted_at, code`)
    .all(userId) as unknown as ItemDaPessoa[];
}

export function marcarRevelado(userId: number, code: string) {
  db.prepare(
    "UPDATE user_items SET revealed_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE user_id = ? AND code = ? AND revealed_at IS NULL",
  ).run(userId, code);
}

/**
 * Troca a vitrine da pessoa. Só entram códigos que ela realmente tem — mandar um código qualquer pela API
 * não vira insígnia no perfil de ninguém.
 */
export function definirVitrine(userId: number, codigos: string[]): string[] {
  const tem = new Set(itensDaPessoa(userId).map((item) => item.code));
  const validos = [...new Set(codigos)].filter((codigo) => tem.has(codigo));
  db.prepare('UPDATE users SET vitrine = ? WHERE id = ?').run(validos.join(',') || null, userId);
  return validos;
}

/** Põe o item na vitrine se ainda houver espaço: insígnia recém-ganha aparece sem precisar configurar. */
export function exibirSeCouber(userId: number, code: string, limite: number) {
  const atual = lerVitrine(
    (db.prepare('SELECT vitrine FROM users WHERE id = ?').get(userId) as { vitrine: string | null } | undefined)?.vitrine ?? null,
  );
  if (atual.includes(code) || atual.length >= limite) return;
  db.prepare('UPDATE users SET vitrine = ? WHERE id = ?').run([...atual, code].join(','), userId);
}

// ---------------------------------------------------------------------------------------------------
// Ideias da tela inicial
// ---------------------------------------------------------------------------------------------------

export interface Suggestion {
  id: number;
  userId: number;
  messageId: number;
  content: string;
  accepted: boolean;
}

/** Guarda que aquela mensagem da conversa é uma ideia, para depois poder ser acolhida. */
export function createSuggestion(userId: number, messageId: number, content: string): number {
  const info = db
    .prepare('INSERT INTO suggestions (user_id, message_id, content) VALUES (?, ?, ?)')
    .run(userId, messageId, content);
  return Number(info.lastInsertRowid);
}

export function findSuggestion(id: number): Suggestion | undefined {
  const row = db
    .prepare('SELECT id, user_id AS userId, message_id AS messageId, content, accepted_at AS acceptedAt FROM suggestions WHERE id = ?')
    .get(id) as unknown as { id: number; userId: number; messageId: number; content: string; acceptedAt: string | null } | undefined;
  return row && { id: row.id, userId: row.userId, messageId: row.messageId, content: row.content, accepted: row.acceptedAt !== null };
}

/**
 * O joinha do dono: a ideia passa a valer e a pessoa ganha mais uma no contador da medalha. Devolve
 * false se ela já tinha sido acolhida antes, para não contar duas vezes num clique repetido.
 */
export function acceptSuggestion(id: number): boolean {
  const info = db
    .prepare("UPDATE suggestions SET accepted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND accepted_at IS NULL")
    .run(id);
  if (info.changes === 0) return false;
  db.prepare('UPDATE users SET accepted_ideas = accepted_ideas + 1 WHERE id = (SELECT user_id FROM suggestions WHERE id = ?)').run(id);
  return true;
}

/** Ideias acolhidas que a pessoa ainda não viu comemorar — é o que faz o confete cair ao abrir o app. */
export function suggestionsToCelebrate(userId: number): { id: number; content: string }[] {
  return db
    .prepare('SELECT id, content FROM suggestions WHERE user_id = ? AND accepted_at IS NOT NULL AND celebrated_at IS NULL ORDER BY id')
    .all(userId) as unknown as { id: number; content: string }[];
}

/** O confete já caiu: não cai de novo. */
export function markCelebrated(id: number, userId: number) {
  db.prepare(
    "UPDATE suggestions SET celebrated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND user_id = ?",
  ).run(id, userId);
}
export function findUserByName(username: string) {
  const row = db
    .prepare(`SELECT ${userColumns}, password_hash AS passwordHash FROM users WHERE username = ?`)
    .get(username) as (UserRow & { passwordHash: string }) | undefined;
  return row && { ...toUser(row)!, passwordHash: row.passwordHash };
}

/** O dono do Syden: é para ele que vão as sugestões mandadas pela tela inicial. */
export function findOwner(): User | undefined {
  return toUser(db.prepare(`SELECT ${userColumns} FROM users WHERE is_owner = 1`).get() as UserRow | undefined);
}

/** Dá ou tira o cargo de administrador. O dono é administrador sempre. */
export function setAdmin(userId: number, isAdmin: boolean): User | undefined {
  db.prepare('UPDATE users SET is_admin = ? WHERE id = ? AND is_owner = 0').run(isAdmin ? 1 : 0, userId);
  return findUserById(userId);
}

export function setAvatar(userId: number, avatar: { mime: string; data: Buffer } | null): User {
  if (avatar) {
    db.prepare(
      'INSERT INTO avatars (user_id, mime, data) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET mime = excluded.mime, data = excluded.data',
    ).run(userId, avatar.mime, avatar.data);
    db.prepare('UPDATE users SET avatar_version = ? WHERE id = ?').run(Date.now(), userId);
  } else {
    db.prepare('DELETE FROM avatars WHERE user_id = ?').run(userId);
    db.prepare('UPDATE users SET avatar_version = NULL WHERE id = ?').run(userId);
  }
  return findUserById(userId)!;
}

/** Cor do nome e fundo do perfil. Passar null em qualquer um dos dois volta ao padrão. */
export function setProfile(
  userId: number,
  perfil: { nameColor: string | null; banner: string | null; moldura: string | null },
): User {
  db.prepare('UPDATE users SET name_color = ?, banner = ?, moldura = ? WHERE id = ?').run(
    perfil.nameColor,
    perfil.banner,
    perfil.moldura,
    userId,
  );
  return findUserById(userId)!;
}

/** Só os códigos que a pessoa tem no inventário. É o que a loja precisa para saber o que liberar. */
export function codigosDoInventario(userId: number): string[] {
  return (db.prepare('SELECT code FROM user_items WHERE user_id = ?').all(userId) as unknown as { code: string }[]).map(
    (linha) => linha.code,
  );
}

export function findAvatar(userId: number) {
  return lendoArquivo(() => db.prepare('SELECT mime, data FROM avatars WHERE user_id = ?').get(userId)) as
    | { mime: string; data: Uint8Array }
    | undefined;
}



// ---------- Karaokê ----------

export interface KaraokeSong {
  id: number;
  communityId: number;
  title: string;
  artist: string;
  seconds: number;
  lyrics: string;
  createdBy: number | null;
}

const karaokeColumns = 'id, community_id AS communityId, title, artist, seconds, lyrics, created_by AS createdBy';

export function listKaraokeSongs(communityId: number): KaraokeSong[] {
  return db
    .prepare(`SELECT ${karaokeColumns} FROM karaoke_songs WHERE community_id = ? ORDER BY title COLLATE NOCASE`)
    .all(communityId) as unknown as KaraokeSong[];
}

export function findKaraokeSong(id: number): KaraokeSong | undefined {
  return db.prepare(`SELECT ${karaokeColumns} FROM karaoke_songs WHERE id = ?`).get(id) as KaraokeSong | undefined;
}

export function findKaraokeFile(id: number) {
  return lendoArquivo(() => db.prepare('SELECT mime, data FROM karaoke_songs WHERE id = ?').get(id)) as
    | { mime: string; data: Uint8Array }
    | undefined;
}

export function countKaraokeSongs(communityId: number): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM karaoke_songs WHERE community_id = ?').get(communityId) as { n: number }).n;
}

export function createKaraokeSong(song: {
  communityId: number;
  title: string;
  artist: string;
  mime: string;
  data: Buffer;
  seconds: number;
  lyrics: string;
  createdBy: number;
}): KaraokeSong {
  const result = db
    .prepare(
      'INSERT INTO karaoke_songs (community_id, title, artist, mime, data, seconds, lyrics, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(song.communityId, song.title, song.artist, song.mime, song.data, song.seconds, song.lyrics, song.createdBy);
  return findKaraokeSong(Number(result.lastInsertRowid))!;
}

export function deleteKaraokeSong(id: number) {
  db.prepare('DELETE FROM karaoke_songs WHERE id = ?').run(id);
}

// ---------- Pacotes de emojis ----------

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
  /** Se ESTA comunidade já tem o pacote. */
  installed: boolean;
}

export interface EmojiPackItem {
  id: number;
  packId: number;
  name: string;
}

const emojiPackColumns = `
  p.id, p.name, p.description, p.icon, p.created_by AS createdBy, p.created_at AS createdAt,
  u.username AS authorName,
  (SELECT COUNT(*) FROM emoji_pack_items i WHERE i.pack_id = p.id) AS emojiCount,
  (SELECT COUNT(*) FROM emoji_pack_installs n WHERE n.pack_id = p.id) AS installs,
  (SELECT COUNT(*) FROM emoji_pack_ratings r WHERE r.pack_id = p.id) AS ratings,
  (SELECT AVG(r.stars) FROM emoji_pack_ratings r WHERE r.pack_id = p.id) AS stars,
  (SELECT r.stars FROM emoji_pack_ratings r WHERE r.pack_id = p.id AND r.user_id = ?) AS myStars,
  (SELECT 1 FROM emoji_pack_installs n WHERE n.pack_id = p.id AND n.community_id = ?) AS installed`;

function toEmojiPack(row: Record<string, unknown>): EmojiPack {
  return {
    ...(row as unknown as EmojiPack),
    installed: Boolean(row.installed),
    stars: row.stars === null ? null : Math.round(Number(row.stars) * 10) / 10,
  };
}

/** O catálogo, do mais bem avaliado para o menos. "installed" é em relação à comunidade aberta. */
export function listEmojiPacks(userId: number, communityId: number): EmojiPack[] {
  const rows = db
    .prepare(
      `SELECT ${emojiPackColumns} FROM emoji_packs p LEFT JOIN users u ON u.id = p.created_by
       ORDER BY stars IS NULL, stars DESC, installs DESC, p.name COLLATE NOCASE`,
    )
    .all(userId, communityId) as Record<string, unknown>[];
  return rows.map(toEmojiPack);
}

export function findEmojiPack(id: number, userId: number, communityId: number): EmojiPack | undefined {
  const row = db
    .prepare(`SELECT ${emojiPackColumns} FROM emoji_packs p LEFT JOIN users u ON u.id = p.created_by WHERE p.id = ?`)
    .get(userId, communityId, id) as Record<string, unknown> | undefined;
  return row ? toEmojiPack(row) : undefined;
}

export function emojiPackOwner(id: number) {
  return db.prepare('SELECT created_by AS createdBy FROM emoji_packs WHERE id = ?').get(id) as { createdBy: number | null } | undefined;
}

export function countEmojiPacksCreatedBy(userId: number): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM emoji_packs WHERE created_by = ?').get(userId) as { n: number }).n;
}

export function createEmojiPack(name: string, description: string, icon: string, createdBy: number): number {
  const result = db
    .prepare('INSERT INTO emoji_packs (name, description, icon, created_by) VALUES (?, ?, ?, ?)')
    .run(name, description, icon, createdBy);
  return Number(result.lastInsertRowid);
}

export function updateEmojiPack(id: number, name: string, description: string, icon: string) {
  db.prepare('UPDATE emoji_packs SET name = ?, description = ?, icon = ? WHERE id = ?').run(name, description, icon, id);
}

export function deleteEmojiPack(id: number) {
  db.prepare('DELETE FROM emoji_packs WHERE id = ?').run(id);
}

export function addEmojiToPack(packId: number, name: string, mime: string, data: Buffer): number {
  const result = db
    .prepare('INSERT INTO emoji_pack_items (pack_id, name, mime, data) VALUES (?, ?, ?, ?)')
    .run(packId, name, mime, data);
  return Number(result.lastInsertRowid);
}

export function listEmojiPackItems(packId: number): EmojiPackItem[] {
  return db
    .prepare('SELECT id, pack_id AS packId, name FROM emoji_pack_items WHERE pack_id = ? ORDER BY name')
    .all(packId) as unknown as EmojiPackItem[];
}

export function findEmojiPackItemFile(id: number) {
  return lendoArquivo(() => db.prepare('SELECT mime, data FROM emoji_pack_items WHERE id = ?').get(id)) as
    | { mime: string; data: Uint8Array }
    | undefined;
}

/**
 * Põe o pacote numa comunidade: copia cada desenho para os emojis dela. Nome que já existe por lá fica
 * de fora — renomear o emoji de alguém no meio de uma conversa quebraria as mensagens antigas.
 * Devolve o que entrou e o que foi pulado.
 */
export function installEmojiPack(packId: number, communityId: number, installedBy: number): { added: Emoji[]; skipped: string[] } {
  const itens = db.prepare('SELECT name, mime, data FROM emoji_pack_items WHERE pack_id = ? ORDER BY name').all(packId) as {
    name: string;
    mime: string;
    data: Uint8Array;
  }[];
  const added: Emoji[] = [];
  const skipped: string[] = [];
  db.exec('BEGIN');
  try {
    db.prepare('INSERT OR REPLACE INTO emoji_pack_installs (pack_id, community_id, installed_by) VALUES (?, ?, ?)').run(
      packId,
      communityId,
      installedBy,
    );
    for (const item of itens) {
      if (emojiNameTaken(communityId, item.name)) {
        skipped.push(item.name);
        continue;
      }
      const result = db
        .prepare('INSERT INTO emojis (community_id, name, mime, data, created_by, pack_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run(communityId, item.name, item.mime, Buffer.from(item.data), installedBy, packId);
      added.push(findEmoji(Number(result.lastInsertRowid))!);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return { added, skipped };
}

/** Tira o pacote da comunidade: só os emojis que vieram dele. Devolve os ids apagados. */
export function uninstallEmojiPack(packId: number, communityId: number): number[] {
  const ids = (
    db.prepare('SELECT id FROM emojis WHERE community_id = ? AND pack_id = ?').all(communityId, packId) as { id: number }[]
  ).map((row) => row.id);
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM emojis WHERE community_id = ? AND pack_id = ?').run(communityId, packId);
    db.prepare('DELETE FROM emoji_pack_installs WHERE pack_id = ? AND community_id = ?').run(packId, communityId);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return ids;
}

export function rateEmojiPack(packId: number, userId: number, stars: number) {
  db.prepare(
    'INSERT INTO emoji_pack_ratings (pack_id, user_id, stars) VALUES (?, ?, ?) ON CONFLICT(pack_id, user_id) DO UPDATE SET stars = excluded.stars',
  ).run(packId, userId, stars);
}


/**
 * O pacote ganhou um desenho novo depois de já estar instalado por aí. Como cada comunidade guarda a sua
 * cópia dos emojis, o desenho precisa ser levado até elas — senão quem instalou ontem nunca veria o que
 * o autor acrescentou hoje. Nome que já existe na comunidade fica de fora, como na instalação.
 */
export function spreadPackEmoji(packId: number, name: string, mime: string, data: Buffer): { communityId: number; emoji: Emoji }[] {
  // Leva junto quem instalou o pacote em cada comunidade: o emoji novo fica com o mesmo autor dos
  // outros do pacote, em vez de parecer que veio de fábrica.
  const comunidades = db
    .prepare('SELECT community_id AS communityId, installed_by AS installedBy FROM emoji_pack_installs WHERE pack_id = ?')
    .all(packId) as { communityId: number; installedBy: number | null }[];
  const criados: { communityId: number; emoji: Emoji }[] = [];
  db.exec('BEGIN');
  try {
    for (const { communityId, installedBy } of comunidades) {
      if (emojiNameTaken(communityId, name)) continue;
      const result = db
        .prepare('INSERT INTO emojis (community_id, name, mime, data, created_by, pack_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run(communityId, name, mime, data, installedBy, packId);
      criados.push({ communityId, emoji: findEmoji(Number(result.lastInsertRowid))! });
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return criados;
}

/** O caminho de volta: o autor tirou um desenho do pacote, então ele sai das comunidades também. */
export function unspreadPackEmoji(packId: number, name: string): { communityId: number; id: number }[] {
  const alvos = db
    .prepare('SELECT id, community_id AS communityId FROM emojis WHERE pack_id = ? AND name = ?')
    .all(packId, name) as { id: number; communityId: number }[];
  for (const alvo of alvos) db.prepare('DELETE FROM emojis WHERE id = ?').run(alvo.id);
  return alvos;
}

export function findEmojiPackItem(id: number) {
  return db.prepare('SELECT id, pack_id AS packId, name FROM emoji_pack_items WHERE id = ?').get(id) as
    | { id: number; packId: number; name: string }
    | undefined;
}

export function deleteEmojiPackItem(id: number) {
  db.prepare('DELETE FROM emoji_pack_items WHERE id = ?').run(id);
}

export function countEmojiPackItems(packId: number): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM emoji_pack_items WHERE pack_id = ?').get(packId) as { n: number }).n;
}

/** Os desenhos de uma comunidade, para virarem um pacote novo (o "publicar os meus emojis"). */
export function emojiFilesOfCommunity(communityId: number) {
  return db.prepare('SELECT name, mime, data FROM emojis WHERE community_id = ? ORDER BY name').all(communityId) as {
    name: string;
    mime: string;
    data: Uint8Array;
  }[];
}

// ---------- Sons ----------

// ---------- Emojis e sons do servidor ----------

const emojiColumns = 'id, community_id AS communityId, name, created_by AS createdBy';

export function listEmojis(communityId: number): Emoji[] {
  return db.prepare(`SELECT ${emojiColumns} FROM emojis WHERE community_id = ? ORDER BY name`).all(communityId) as unknown as Emoji[];
}

export function findEmoji(id: number) {
  return db.prepare(`SELECT ${emojiColumns} FROM emojis WHERE id = ?`).get(id) as Emoji | undefined;
}

export function emojiNameTaken(communityId: number, name: string) {
  return !!db.prepare('SELECT 1 FROM emojis WHERE community_id = ? AND name = ?').get(communityId, name);
}

export function createEmoji(communityId: number, name: string, mime: string, data: Buffer, createdBy: number | null): Emoji {
  const result = db
    .prepare('INSERT INTO emojis (community_id, name, mime, data, created_by) VALUES (?, ?, ?, ?, ?)')
    .run(communityId, name, mime, data, createdBy);
  return findEmoji(Number(result.lastInsertRowid))!;
}

export function renameEmoji(id: number, name: string): Emoji {
  db.prepare('UPDATE emojis SET name = ? WHERE id = ?').run(name, id);
  return findEmoji(id)!;
}

export function deleteEmoji(id: number) {
  db.prepare('DELETE FROM emojis WHERE id = ?').run(id);
}

export function findEmojiFile(id: number) {
  return lendoArquivo(() => db.prepare('SELECT mime, data FROM emojis WHERE id = ?').get(id)) as { mime: string; data: Uint8Array } | undefined;
}

const soundColumns = 'id, community_id AS communityId, pack_id AS packId, name, icon, created_by AS createdBy';

export function listSounds(communityId: number): Sound[] {
  return db.prepare(`SELECT ${soundColumns} FROM sounds WHERE community_id = ? ORDER BY id`).all(communityId) as unknown as Sound[];
}

export function findSound(id: number) {
  return db.prepare(`SELECT ${soundColumns} FROM sounds WHERE id = ?`).get(id) as Sound | undefined;
}

export function createSound(
  communityId: number,
  name: string,
  icon: string,
  mime: string,
  data: Buffer,
  createdBy: number | null,
): Sound {
  const result = db
    .prepare('INSERT INTO sounds (community_id, name, icon, mime, data, created_by) VALUES (?, ?, ?, ?, ?, ?)')
    .run(communityId, name, icon, mime, data, createdBy);
  return findSound(Number(result.lastInsertRowid))!;
}

export function updateSound(id: number, name: string, icon: string): Sound {
  db.prepare('UPDATE sounds SET name = ?, icon = ? WHERE id = ?').run(name, icon, id);
  return findSound(id)!;
}

export function deleteSound(id: number) {
  db.prepare('DELETE FROM sounds WHERE id = ?').run(id);
}

/** Tira das comunidades os sons do antigo pacote de demonstração, que agora vive como pacote do catálogo. */
export function deleteLegacyPackSounds() {
  db.prepare('DELETE FROM sounds WHERE community_id IS NOT NULL AND created_by IS NULL').run();
}

export function findSoundFile(id: number) {
  return lendoArquivo(() => db.prepare('SELECT mime, data FROM sounds WHERE id = ?').get(id)) as { mime: string; data: Uint8Array } | undefined;
}

// ---------- Pacotes de sons ----------

export interface Pack {
  id: number;
  name: string;
  description: string;
  icon: string;
  /** Quem montou o pacote; null nos que vêm de fábrica com o Syden. */
  createdBy: number | null;
  authorName: string | null;
  builtin: boolean;
  createdAt: string;
  soundCount: number;
  /** Quantas pessoas instalaram: o "baixaram" do catálogo. */
  installs: number;
  /** Média das estrelas (null quando ninguém avaliou) e quantas notas formaram a média. */
  stars: number | null;
  ratings: number;
  /** A nota de quem está olhando, e se ele já tem o pacote. */
  myStars: number | null;
  installed: boolean;
}

/** Um som como ele aparece no soundboard de alguém: com o pacote de origem e a marca de favorito. */
export interface BoardSound extends Sound {
  packName: string | null;
  favorite: boolean;
}

const packColumns = `
  p.id, p.name, p.description, p.icon, p.created_by AS createdBy, p.builtin, p.created_at AS createdAt,
  u.username AS authorName,
  (SELECT COUNT(*) FROM sounds s WHERE s.pack_id = p.id) AS soundCount,
  (SELECT COUNT(*) FROM pack_installs i WHERE i.pack_id = p.id) AS installs,
  (SELECT COUNT(*) FROM pack_ratings r WHERE r.pack_id = p.id) AS ratings,
  (SELECT AVG(r.stars) FROM pack_ratings r WHERE r.pack_id = p.id) AS stars,
  (SELECT r.stars FROM pack_ratings r WHERE r.pack_id = p.id AND r.user_id = ?) AS myStars,
  (SELECT 1 FROM pack_installs i WHERE i.pack_id = p.id AND i.user_id = ?) AS installed`;

function toPack(row: Record<string, unknown>): Pack {
  return {
    ...(row as unknown as Pack),
    builtin: Boolean(row.builtin),
    installed: Boolean(row.installed),
    stars: row.stars === null ? null : Math.round(Number(row.stars) * 10) / 10,
  };
}

/** Catálogo inteiro, do mais bem avaliado para o menos; sem nota, vale quantas pessoas baixaram. */
export function listPacks(userId: number): Pack[] {
  const rows = db
    .prepare(
      `SELECT ${packColumns} FROM packs p LEFT JOIN users u ON u.id = p.created_by
       ORDER BY stars IS NULL, stars DESC, installs DESC, p.name COLLATE NOCASE`,
    )
    .all(userId, userId) as Record<string, unknown>[];
  return rows.map(toPack);
}

export function findPack(id: number, userId: number): Pack | undefined {
  const row = db
    .prepare(`SELECT ${packColumns} FROM packs p LEFT JOIN users u ON u.id = p.created_by WHERE p.id = ?`)
    .get(userId, userId, id) as Record<string, unknown> | undefined;
  return row ? toPack(row) : undefined;
}

export function findPackByName(name: string) {
  return db.prepare('SELECT id, builtin FROM packs WHERE name = ? COLLATE NOCASE').get(name) as
    | { id: number; builtin: number }
    | undefined;
}

export function createPack(name: string, description: string, icon: string, createdBy: number | null, builtin = false): number {
  const result = db
    .prepare('INSERT INTO packs (name, description, icon, created_by, builtin) VALUES (?, ?, ?, ?, ?)')
    .run(name, description, icon, createdBy, builtin ? 1 : 0);
  return Number(result.lastInsertRowid);
}

export function updatePack(id: number, name: string, description: string, icon: string) {
  db.prepare('UPDATE packs SET name = ?, description = ?, icon = ? WHERE id = ?').run(name, description, icon, id);
}

export function countPacksCreatedBy(userId: number): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM packs WHERE created_by = ?').get(userId) as { n: number }).n;
}

export function deletePack(id: number) {
  db.prepare('DELETE FROM packs WHERE id = ?').run(id); // os sons dele saem junto, em cascata
}

export function packSounds(packId: number): Sound[] {
  return db.prepare(`SELECT ${soundColumns} FROM sounds WHERE pack_id = ? ORDER BY id`).all(packId) as unknown as Sound[];
}

export function createPackSound(packId: number, name: string, icon: string, mime: string, data: Buffer): Sound {
  const result = db
    .prepare('INSERT INTO sounds (pack_id, name, icon, mime, data, created_by) VALUES (?, ?, ?, ?, ?, NULL)')
    .run(packId, name, icon, mime, data);
  return findSound(Number(result.lastInsertRowid))!;
}

export function installPack(packId: number, userId: number) {
  db.prepare('INSERT OR IGNORE INTO pack_installs (pack_id, user_id) VALUES (?, ?)').run(packId, userId);
}

export function uninstallPack(packId: number, userId: number) {
  db.prepare('DELETE FROM pack_installs WHERE pack_id = ? AND user_id = ?').run(packId, userId);
}

export function ratePack(packId: number, userId: number, stars: number) {
  db.prepare(
    `INSERT INTO pack_ratings (pack_id, user_id, stars) VALUES (?, ?, ?)
     ON CONFLICT (pack_id, user_id) DO UPDATE SET stars = excluded.stars`,
  ).run(packId, userId, stars);
}

export function clearRating(packId: number, userId: number) {
  db.prepare('DELETE FROM pack_ratings WHERE pack_id = ? AND user_id = ?').run(packId, userId);
}

/**
 * O soundboard de uma pessoa numa comunidade: o que a comunidade enviou mais os pacotes que ela instalou.
 * Os favoritos vêm marcados para a tela colocá-los na frente.
 */
export function boardSounds(communityId: number, userId: number): BoardSound[] {
  const rows = db
    .prepare(
      `SELECT s.id, s.community_id AS communityId, s.pack_id AS packId, s.name, s.icon, s.created_by AS createdBy,
              p.name AS packName,
              (SELECT 1 FROM favorite_sounds f WHERE f.sound_id = s.id AND f.user_id = ?) AS favorite
       FROM sounds s
       LEFT JOIN packs p ON p.id = s.pack_id
       WHERE s.community_id = ?
          OR s.pack_id IN (SELECT pack_id FROM pack_installs WHERE user_id = ?)
       ORDER BY s.pack_id IS NOT NULL, p.name COLLATE NOCASE, s.id`,
    )
    .all(userId, communityId, userId) as Record<string, unknown>[];
  return rows.map((row) => ({ ...(row as unknown as BoardSound), favorite: Boolean(row.favorite) }));
}

/** Quem pode tocar este som: quem é da comunidade dele, ou qualquer um, se ele for de um pacote. */
export function soundIsPublic(sound: Sound) {
  return sound.packId !== null;
}

export function setFavoriteSound(userId: number, soundId: number, favorite: boolean) {
  if (favorite) db.prepare('INSERT OR IGNORE INTO favorite_sounds (user_id, sound_id) VALUES (?, ?)').run(userId, soundId);
  else db.prepare('DELETE FROM favorite_sounds WHERE user_id = ? AND sound_id = ?').run(userId, soundId);
}

/** Todo mundo que já tem conta, para instalar um pacote de fábrica em quem entrou antes dele existir. */
export function allUserIds(): number[] {
  return (db.prepare('SELECT id FROM users').all() as { id: number }[]).map((row) => row.id);
}

export function findUserById(id: number) {
  return toUser(db.prepare(`SELECT ${userColumns} FROM users WHERE id = ?`).get(id) as never);
}

/**
 * A pessoa e o número da sessão dela, numa consulta só. É o que roda a cada pedido autenticado, por isso
 * não são duas idas ao banco. O número da sessão não entra em `userColumns` de propósito: ele é assunto
 * interno do servidor e não precisa ir parar na tela de ninguém.
 */
export function findUserForSession(id: number): { user: User; sessionVersion: number } | undefined {
  const row = db.prepare(`SELECT ${userColumns}, session_version AS sessionVersion FROM users WHERE id = ?`).get(id) as
    | (UserRow & { sessionVersion: number })
    | undefined;
  const user = toUser(row);
  return user && { user, sessionVersion: row!.sessionVersion };
}

/** O número da sessão desta pessoa, para carimbar num token recém-emitido. */
export function sessionVersion(userId: number): number {
  const row = db.prepare('SELECT session_version AS v FROM users WHERE id = ?').get(userId) as { v: number } | undefined;
  return row?.v ?? 1;
}

/** Derruba todas as sessões desta pessoa e devolve o número novo, para quem pediu continuar logado. */
export function bumpSessionVersion(userId: number): number {
  const row = db
    .prepare('UPDATE users SET session_version = session_version + 1 WHERE id = ? RETURNING session_version AS v')
    .get(userId) as { v: number } | undefined;
  return row?.v ?? 1;
}

export function findPasswordHash(userId: number) {
  return (db.prepare('SELECT password_hash AS hash FROM users WHERE id = ?').get(userId) as { hash: string }).hash;
}

/** O primeiro cadastro do servidor vira dono e administrador. */
/** `email` e `exigeConfirmacao` vêm do cadastro por senha; o caminho social usa createUserSemSenha. */
export function createUser(username: string, passwordHash: string, email: string | null = null, exigeConfirmacao = false): User {
  const first = !db.prepare('SELECT 1 FROM users').get();
  const result = db
    .prepare(
      'INSERT INTO users (username, password_hash, is_admin, is_owner, email, exige_confirmacao) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(username, passwordHash, first ? 1 : 0, first ? 1 : 0, email?.trim().toLowerCase() ?? null, exigeConfirmacao ? 1 : 0);
  return findUserById(Number(result.lastInsertRowid))!;
}

/**
 * Falta confirmar o e-mail desta conta para ela poder entrar?
 *
 * Só vale para quem nasceu com a exigência. Conta antiga e conta de provedor respondem false sempre —
 * ver o comentário da coluna, mais acima.
 */
export function precisaConfirmar(userId: number): boolean {
  const linha = db
    .prepare('SELECT exige_confirmacao AS exige, email_verified_at AS confirmadoEm FROM users WHERE id = ?')
    .get(userId) as { exige: number; confirmadoEm: string | null } | undefined;
  return Boolean(linha && linha.exige === 1 && !linha.confirmadoEm);
}

/**
 * Comunidade sem dono (quem criou saiu ou excluiu a conta): o administrador mais antigo assume, ou o membro
 * mais antigo. Comunidade que ficou sem ninguém é apagada, junto com os canais, mensagens, emojis e sons.
 */
export function ensureCommunityOwners() {
  const orphans = db
    .prepare(
      `SELECT c.id FROM communities c
       WHERE NOT EXISTS (SELECT 1 FROM community_members m WHERE m.community_id = c.id AND m.role = 'owner')`,
    )
    .all() as { id: number }[];
  for (const { id } of orphans) {
    const heir = db
      .prepare(
        `SELECT user_id AS userId FROM community_members WHERE community_id = ?
         ORDER BY CASE role WHEN 'admin' THEN 0 ELSE 1 END, joined_at, user_id LIMIT 1`,
      )
      .get(id) as { userId: number } | undefined;
    if (heir) setMemberRole(id, heir.userId, 'owner');
    else deleteCommunity(id);
  }
}

/**
 * Apaga a conta e os dados pessoais dela (mensagens, avatar, histórico de uso). Canais, emojis e sons que a
 * pessoa criou continuam onde estão, sem dono. Cargos que ela tinha passam para outra pessoa (ensureOwner e
 * ensureCommunityOwners).
 */
export function deleteAccount(userId: number) {
  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM messages WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM usage_sessions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM avatars WHERE user_id = ?').run(userId);
    // O ON DELETE CASCADE já daria conta, mas aqui dentro estão as ANOTAÇÕES QUE A PESSOA ESCREVEU
    // SOBRE OUTRAS — dado pessoal de terceiro. Apagar por efeito indireto de uma configuração que
    // alguém pode desligar sem perceber é frágil demais para esse conteúdo.
    db.prepare('DELETE FROM user_prefs WHERE user_id = ?').run(userId);
    for (const table of ['channels', 'emojis', 'sounds', 'threads']) {
      db.prepare(`UPDATE ${table} SET created_by = NULL WHERE created_by = ?`).run(userId);
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    ensureOwner();
    ensureCommunityOwners();
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function findMessage(id: number) {
  return db
    .prepare(
      `SELECT m.id, m.channel_id AS channelId, m.user_id AS userId, m.thread_id AS threadId, c.community_id AS communityId
       FROM messages m JOIN channels c ON c.id = m.channel_id WHERE m.id = ?`,
    )
    .get(id) as { id: number; channelId: number; userId: number; threadId: number | null; communityId: number | null } | undefined;
}

export function deleteMessage(id: number) {
  db.prepare('DELETE FROM messages WHERE id = ?').run(id);
}

export function updatePassword(userId: number, passwordHash: string) {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
}

const channelColumns = 'id, community_id AS communityId, name, type, position, created_by AS createdBy';

export function listChannels(communityId: number) {
  return db
    .prepare(`SELECT ${channelColumns} FROM channels WHERE community_id = ? ORDER BY position, id`)
    .all(communityId) as unknown as Channel[];
}

export function findChannel(id: number) {
  return db.prepare(`SELECT ${channelColumns} FROM channels WHERE id = ?`).get(id) as Channel | undefined;
}

export function createChannel(communityId: number, name: string, type: ChannelType, createdBy: number): Channel {
  const { next } = db
    .prepare('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM channels WHERE community_id = ?')
    .get(communityId) as { next: number };
  const result = db
    .prepare('INSERT INTO channels (community_id, name, type, position, created_by) VALUES (?, ?, ?, ?, ?)')
    .run(communityId, name, type, next, createdBy);
  return findChannel(Number(result.lastInsertRowid))!;
}

export function renameChannel(id: number, name: string): Channel {
  db.prepare('UPDATE channels SET name = ? WHERE id = ?').run(name, id);
  return findChannel(id)!;
}

/** Apaga o canal; as mensagens vão junto (ON DELETE CASCADE). */
export function deleteChannel(id: number) {
  db.prepare('DELETE FROM channels WHERE id = ?').run(id);
}

export function countChannels(communityId: number, type: ChannelType) {
  return (db.prepare('SELECT COUNT(*) AS n FROM channels WHERE community_id = ? AND type = ?').get(communityId, type) as { n: number })
    .n;
}

// ---------- Conversas privadas (direta e em grupo) ----------

export function isChannelMember(channelId: number, userId: number) {
  return db.prepare('SELECT 1 FROM channel_members WHERE channel_id = ? AND user_id = ?').get(channelId, userId) !== undefined;
}

export function channelMemberIds(channelId: number): number[] {
  return (db.prepare('SELECT user_id AS id FROM channel_members WHERE channel_id = ?').all(channelId) as { id: number }[]).map(
    (row) => row.id,
  );
}

export function addChannelMember(channelId: number, userId: number) {
  db.prepare('INSERT OR IGNORE INTO channel_members (channel_id, user_id) VALUES (?, ?)').run(channelId, userId);
}

export function removeChannelMember(channelId: number, userId: number) {
  db.prepare('DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?').run(channelId, userId);
}

/** Cria a conversa (sem nome = conversa direta; com nome = grupo) já com todo mundo dentro. */
export function createDirectChannel(name: string, createdBy: number, userIds: number[]): Channel {
  const result = db
    .prepare("INSERT INTO channels (community_id, name, type, position, created_by) VALUES (NULL, ?, 'dm', 0, ?)")
    .run(name, createdBy);
  const id = Number(result.lastInsertRowid);
  for (const userId of new Set([createdBy, ...userIds])) addChannelMember(id, userId);
  return findChannel(id)!;
}

/** A conversa direta que já existe entre duas pessoas (sem nome e com exatamente as duas dentro). */
export function findDirectBetween(a: number, b: number): Channel | undefined {
  const row = db
    .prepare(
      `SELECT ${channelColumns} FROM channels c
       WHERE c.type = 'dm' AND c.name = ''
         AND (SELECT COUNT(*) FROM channel_members m WHERE m.channel_id = c.id) = 2
         AND EXISTS (SELECT 1 FROM channel_members m WHERE m.channel_id = c.id AND m.user_id = ?)
         AND EXISTS (SELECT 1 FROM channel_members m WHERE m.channel_id = c.id AND m.user_id = ?)
       LIMIT 1`,
    )
    .get(a, b) as Channel | undefined;
  return row;
}

/** As conversas privadas de alguém, da mais recente para a mais antiga. */
export function listDirectChannels(userId: number): DirectChannel[] {
  const rows = db
    .prepare(
      `SELECT c.id, c.name, c.created_by AS createdBy,
              (SELECT MAX(m.created_at) FROM messages m WHERE m.channel_id = c.id) AS lastMessageAt,
              (SELECT m.content FROM messages m WHERE m.channel_id = c.id ORDER BY m.id DESC LIMIT 1) AS lastMessage,
              (SELECT m.id FROM messages m WHERE m.channel_id = c.id ORDER BY m.id DESC LIMIT 1) AS lastMessageId
       FROM channels c
       JOIN channel_members mine ON mine.channel_id = c.id AND mine.user_id = ?
       WHERE c.type = 'dm'
       ORDER BY COALESCE(lastMessageAt, '') DESC, c.id DESC`,
    )
    .all(userId) as unknown as Omit<DirectChannel, 'members'>[];
  if (rows.length === 0) return [];

  const members = db
    .prepare(
      `SELECT m.channel_id AS channelId, u.id, u.username
       FROM channel_members m JOIN users u ON u.id = m.user_id
       WHERE m.channel_id IN (${idList(rows.map((r) => r.id))})`,
    )
    .all() as unknown as { channelId: number; id: number; username: string }[];

  const byChannel = new Map<number, UserRef[]>(rows.map((row) => [row.id, []]));
  for (const { channelId, ...user } of members) byChannel.get(channelId)?.push(user);
  return rows.map((row) => ({ ...row, members: byChannel.get(row.id) ?? [] }));
}

interface MessageRow {
  id: number;
  channelId: number;
  content: string;
  createdAt: string;
  threadId: number | null;
  userId: number;
  username: string;
}

const messageSelect = `
  SELECT m.id, m.channel_id AS channelId, m.content, m.created_at AS createdAt, m.thread_id AS threadId,
         u.id AS userId, u.username
  FROM messages m JOIN users u ON u.id = m.user_id`;

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    channelId: row.channelId,
    content: row.content,
    createdAt: row.createdAt,
    threadId: row.threadId,
    author: { id: row.userId, username: row.username },
    attachments: [],
    poll: null,
    thread: null,
    reactions: [],
    suggestion: null,
  };
}

/** Lista de ids para um `IN (...)`. São números vindos do próprio banco, então não há o que escapar. */
const idList = (ids: number[]) => ids.join(',');

/**
 * Completa as mensagens com o que está em outras tabelas: arquivos, enquete e tópico. Uma consulta por
 * assunto para a página inteira, em vez de uma por mensagem. `viewerId` decide o "você votou aqui".
 */
function hydrate(messages: Message[], viewerId: number): Message[] {
  if (messages.length === 0) return messages;
  const byId = new Map(messages.map((m) => [m.id, m]));
  const ids = idList([...byId.keys()]);

  const files = db
    .prepare(
      `SELECT id, message_id AS messageId, key, name, mime, size, width, height, expires_at AS expiresAt
       FROM attachments WHERE message_id IN (${ids}) ORDER BY id`,
    )
    .all() as unknown as (Attachment & { messageId: number })[];
  for (const { messageId, ...file } of files) byId.get(messageId)?.attachments.push(file);

  for (const thread of threadRows(`t.parent_message_id IN (${ids})`)) {
    const parent = byId.get(thread.parentMessageId);
    if (parent) parent.thread = thread;
  }

  const polls = db
    .prepare(`SELECT id, message_id AS messageId, question, multiple, closed FROM polls WHERE message_id IN (${ids})`)
    .all() as unknown as { id: number; messageId: number; question: string; multiple: number; closed: number }[];
  if (polls.length > 0) {
    const tallies = pollTallies(
      polls.map((p) => p.id),
      viewerId,
    );
    for (const row of polls) {
      const message = byId.get(row.messageId);
      if (!message) continue;
      const tally = tallies.get(row.id)!;
      message.poll = {
        id: row.id,
        question: row.question,
        multiple: row.multiple === 1,
        closed: row.closed === 1,
        options: tally.options,
        voters: tally.voters,
      };
    }
  }

  const ideias = db
    .prepare(`SELECT id, message_id AS messageId, accepted_at AS acceptedAt FROM suggestions WHERE message_id IN (${ids})`)
    .all() as unknown as { id: number; messageId: number; acceptedAt: string | null }[];
  for (const row of ideias) {
    const message = byId.get(row.messageId);
    if (message) message.suggestion = { id: row.id, accepted: row.acceptedAt !== null };
  }

  const reactionRows = db
    .prepare(
      `SELECT message_id AS messageId, emoji, COUNT(*) AS count, MAX(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS mine
       FROM message_reactions WHERE message_id IN (${ids}) GROUP BY message_id, emoji ORDER BY MIN(id)`,
    )
    .all(viewerId) as unknown as { messageId: number; emoji: string; count: number; mine: number }[];
  for (const row of reactionRows) {
    byId.get(row.messageId)?.reactions.push({ emoji: row.emoji, count: row.count, mine: row.mine === 1 });
  }

  return messages;
}

/** Mensagens mais recentes do canal (ou anteriores a `beforeId`), em ordem cronológica. */
export function listMessages(channelId: number, beforeId: number | undefined, viewerId: number, limit = 50): Message[] {
  const rows = db
    .prepare(`${messageSelect} WHERE m.channel_id = ? AND m.thread_id IS NULL AND m.id < ? ORDER BY m.id DESC LIMIT ?`)
    .all(channelId, beforeId ?? Number.MAX_SAFE_INTEGER, limit) as unknown as MessageRow[];
  return hydrate(rows.reverse().map(toMessage), viewerId);
}

/** As respostas de um tópico, no mesmo formato das mensagens do canal. */
export function listThreadMessages(threadId: number, beforeId: number | undefined, viewerId: number, limit = 50): Message[] {
  const rows = db
    .prepare(`${messageSelect} WHERE m.thread_id = ? AND m.id < ? ORDER BY m.id DESC LIMIT ?`)
    .all(threadId, beforeId ?? Number.MAX_SAFE_INTEGER, limit) as unknown as MessageRow[];
  return hydrate(rows.reverse().map(toMessage), viewerId);
}

export function findMessageFull(id: number, viewerId: number): Message | undefined {
  const row = db.prepare(`${messageSelect} WHERE m.id = ?`).get(id) as unknown as MessageRow | undefined;
  return row && hydrate([toMessage(row)], viewerId)[0];
}

// ---------- Arquivos das mensagens ----------


/**
 * Passa a vassoura nos recados em vídeo que venceram. Devolve as mensagens que ficaram sem nada — sem
 * texto e sem anexo —, para quem chamou poder apagá-las e avisar as telas abertas.
 */
export function limparAnexosVencidos(): { removidos: number; mensagensVazias: { id: number; channelId: number }[] } {
  const vencidos = db
    .prepare("SELECT id, message_id AS messageId FROM attachments WHERE expires_at IS NOT NULL AND expires_at <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now')")
    .all() as { id: number; messageId: number }[];
  if (vencidos.length === 0) return { removidos: 0, mensagensVazias: [] };

  const mensagensVazias: { id: number; channelId: number }[] = [];
  db.exec('BEGIN');
  try {
    for (const alvo of vencidos) db.prepare('DELETE FROM attachments WHERE id = ?').run(alvo.id);
    const mensagens = [...new Set(vencidos.map((v) => v.messageId))];
    for (const messageId of mensagens) {
      const restante = db.prepare('SELECT COUNT(*) AS n FROM attachments WHERE message_id = ?').get(messageId) as { n: number };
      const mensagem = db.prepare('SELECT channel_id AS channelId, content FROM messages WHERE id = ?').get(messageId) as
        | { channelId: number; content: string }
        | undefined;
      if (!mensagem) continue;
      if (restante.n === 0 && mensagem.content.trim() === '') {
        db.prepare('DELETE FROM messages WHERE id = ?').run(messageId);
        mensagensVazias.push({ id: messageId, channelId: mensagem.channelId });
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return { removidos: vencidos.length, mensagensVazias };
}

export interface NewAttachment {
  name: string;
  mime: string;
  data: Buffer;
  width: number | null;
  height: number | null;
  /** Data em que o arquivo some sozinho, ou null para ficar para sempre. */
  expiresAt?: string | null;
}

export function addAttachment(messageId: number, file: NewAttachment): Attachment {
  const key = randomBytes(12).toString('hex');
  const result = db
    .prepare(
      'INSERT INTO attachments (message_id, key, name, mime, size, width, height, data, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    .run(messageId, key, file.name, file.mime, file.data.length, file.width, file.height, file.data, file.expiresAt ?? null);
  return {
    id: Number(result.lastInsertRowid),
    key,
    name: file.name,
    mime: file.mime,
    size: file.data.length,
    width: file.width,
    height: file.height,
    expiresAt: file.expiresAt ?? null,
  };
}

/** O arquivo só sai daqui com o id e a chave certos. */
export function findAttachmentFile(id: number, key: string) {
  // Os anexos são os maiores: um recado em vídeo chega a dezenas de megabytes, e é esta leitura que mais
  // tempo deixa o servidor parado. É a que mais interessa medir.
  return lendoArquivo(() => db.prepare('SELECT name, mime, data FROM attachments WHERE id = ? AND key = ?').get(id, key)) as
    | { name: string; mime: string; data: Uint8Array }
    | undefined;
}

// ---------- Enquetes ----------

/** Votos de cada opção das enquetes pedidas, já sabendo o que `viewerId` votou. */
function pollTallies(pollIds: number[], viewerId: number) {
  const ids = idList(pollIds);
  const options = db
    .prepare(
      `SELECT o.id, o.poll_id AS pollId, o.text,
              (SELECT COUNT(*) FROM poll_votes v WHERE v.option_id = o.id) AS votes,
              (SELECT COUNT(*) FROM poll_votes v WHERE v.option_id = o.id AND v.user_id = ?) AS mine
       FROM poll_options o WHERE o.poll_id IN (${ids}) ORDER BY o.position, o.id`,
    )
    .all(viewerId) as unknown as { id: number; pollId: number; text: string; votes: number; mine: number }[];
  const voters = db
    .prepare(`SELECT poll_id AS pollId, COUNT(DISTINCT user_id) AS voters FROM poll_votes WHERE poll_id IN (${ids}) GROUP BY poll_id`)
    .all() as unknown as { pollId: number; voters: number }[];

  const result = new Map<number, { options: PollOption[]; voters: number }>();
  for (const id of pollIds) result.set(id, { options: [], voters: 0 });
  for (const option of options) {
    result.get(option.pollId)?.options.push({ id: option.id, text: option.text, votes: option.votes, mine: option.mine > 0 });
  }
  for (const row of voters) {
    const tally = result.get(row.pollId);
    if (tally) tally.voters = row.voters;
  }
  return result;
}

export interface PollLocation {
  id: number;
  messageId: number;
  channelId: number;
  communityId: number;
  threadId: number | null;
  createdBy: number;
  multiple: boolean;
  closed: boolean;
}

export function findPoll(id: number): PollLocation | undefined {
  const row = db
    .prepare(
      `SELECT p.id, p.message_id AS messageId, p.multiple, p.closed, m.channel_id AS channelId, m.thread_id AS threadId,
              m.user_id AS createdBy, c.community_id AS communityId
       FROM polls p JOIN messages m ON m.id = p.message_id JOIN channels c ON c.id = m.channel_id
       WHERE p.id = ?`,
    )
    .get(id) as
    | { id: number; messageId: number; multiple: number; closed: number; channelId: number; threadId: number | null; createdBy: number; communityId: number }
    | undefined;
  return row && { ...row, multiple: row.multiple === 1, closed: row.closed === 1 };
}

export function createPoll(messageId: number, question: string, options: string[], multiple: boolean) {
  const result = db
    .prepare('INSERT INTO polls (message_id, question, multiple) VALUES (?, ?, ?)')
    .run(messageId, question, multiple ? 1 : 0);
  const pollId = Number(result.lastInsertRowid);
  const insert = db.prepare('INSERT INTO poll_options (poll_id, position, text) VALUES (?, ?, ?)');
  options.forEach((text, position) => insert.run(pollId, position, text));
  return pollId;
}

/** Marca ou desmarca um voto. Em enquete de resposta única, o voto anterior sai. */
export function votePoll(pollId: number, optionId: number, userId: number, multiple: boolean) {
  const had = db.prepare('SELECT 1 FROM poll_votes WHERE option_id = ? AND user_id = ?').get(optionId, userId);
  if (had) {
    db.prepare('DELETE FROM poll_votes WHERE option_id = ? AND user_id = ?').run(optionId, userId);
    return;
  }
  if (!multiple) db.prepare('DELETE FROM poll_votes WHERE poll_id = ? AND user_id = ?').run(pollId, userId);
  db.prepare('INSERT INTO poll_votes (poll_id, option_id, user_id) VALUES (?, ?, ?)').run(pollId, optionId, userId);
}

export function closePoll(pollId: number) {
  db.prepare('UPDATE polls SET closed = 1 WHERE id = ?').run(pollId);
}

export function optionBelongsToPoll(pollId: number, optionId: number) {
  return db.prepare('SELECT 1 FROM poll_options WHERE id = ? AND poll_id = ?').get(optionId, pollId) !== undefined;
}

/** O estado da enquete para mandar a quem está olhando (os votos de cada um vêm de `viewerId`). */
export function pollState(pollId: number, viewerId: number) {
  const tally = pollTallies([pollId], viewerId).get(pollId)!;
  const row = db.prepare('SELECT question, multiple, closed FROM polls WHERE id = ?').get(pollId) as
    | { question: string; multiple: number; closed: number }
    | undefined;
  if (!row) return undefined;
  return {
    id: pollId,
    question: row.question,
    multiple: row.multiple === 1,
    closed: row.closed === 1,
    options: tally.options,
    voters: tally.voters,
  } satisfies Poll;
}

// ---------- Tópicos ----------

function threadRows(where: string, ...params: unknown[]): ThreadSummary[] {
  return db
    .prepare(
      `SELECT t.id, t.channel_id AS channelId, t.parent_message_id AS parentMessageId, t.title,
              (SELECT COUNT(*) FROM messages m WHERE m.thread_id = t.id) AS replyCount,
              (SELECT MAX(m.created_at) FROM messages m WHERE m.thread_id = t.id) AS lastAt
       FROM threads t WHERE ${where}`,
    )
    .all(...(params as never[])) as unknown as ThreadSummary[];
}

export function findThread(id: number): ThreadSummary | undefined {
  return threadRows('t.id = ?', id)[0];
}

export function findThreadByMessage(messageId: number): ThreadSummary | undefined {
  return threadRows('t.parent_message_id = ?', messageId)[0];
}

export function createThread(channelId: number, parentMessageId: number, title: string, createdBy: number): ThreadSummary {
  const result = db
    .prepare('INSERT INTO threads (channel_id, parent_message_id, title, created_by) VALUES (?, ?, ?, ?)')
    .run(channelId, parentMessageId, title, createdBy);
  return findThread(Number(result.lastInsertRowid))!;
}

/** Em que comunidade e canal um tópico vive, para conferir quem pode escrever nele. */
export function threadLocation(id: number) {
  return db
    .prepare(
      `SELECT t.id, t.channel_id AS channelId, t.created_by AS createdBy, c.community_id AS communityId, c.type AS channelType
       FROM threads t JOIN channels c ON c.id = t.channel_id WHERE t.id = ?`,
    )
    .get(id) as { id: number; channelId: number; createdBy: number | null; communityId: number; channelType: ChannelType } | undefined;
}

export function deleteThread(id: number) {
  db.prepare('DELETE FROM threads WHERE id = ?').run(id);
}

export type UsageKind = 'voice' | 'screen';

export function startUsageSession(kind: UsageKind, userId: number, communityId: number | null = null): number {
  const now = new Date().toISOString();
  const result = db
    .prepare('INSERT INTO usage_sessions (kind, user_id, started_at, ended_at, community_id) VALUES (?, ?, ?, ?, ?)')
    .run(kind, userId, now, now, communityId);
  return Number(result.lastInsertRowid);
}

/** Marca as sessões como vistas agora (usado para encerrar uma sessão e no pulso de cada minuto). */
export function touchUsageSessions(ids: number[]) {
  if (ids.length === 0) return;
  const stmt = db.prepare('UPDATE usage_sessions SET ended_at = ? WHERE id = ?');
  const now = new Date().toISOString();
  for (const id of ids) stmt.run(now, id);
}

export interface UsageByUser {
  userId: number;
  username: string;
  voiceSeconds: number;
  screenSeconds: number;
}

/** Segundos em chamada e compartilhando tela por pessoa, contando só o que caiu a partir de `since`. */
export function usageSince(since: string): UsageByUser[] {
  const rows = db
    .prepare(
      `SELECT u.id AS userId, u.username, s.kind,
              SUM((julianday(s.ended_at) - julianday(MAX(s.started_at, ?))) * 86400) AS seconds
       FROM usage_sessions s JOIN users u ON u.id = s.user_id
       WHERE s.ended_at >= ?
       GROUP BY u.id, s.kind`,
    )
    .all(since, since) as unknown as { userId: number; username: string; kind: UsageKind; seconds: number }[];

  const byUser = new Map<number, UsageByUser>();
  for (const row of rows) {
    const entry = byUser.get(row.userId) ?? { userId: row.userId, username: row.username, voiceSeconds: 0, screenSeconds: 0 };
    entry[row.kind === 'voice' ? 'voiceSeconds' : 'screenSeconds'] = Math.round(row.seconds);
    byUser.set(row.userId, entry);
  }
  return [...byUser.values()].sort((a, b) => b.voiceSeconds - a.voiceSeconds);
}

// ---------- Saúde do servidor ----------

export interface HealthSample {
  at: string;
  cpu: number;
  memory: number;
  diskFree: number | null;
  diskTotal: number | null;
  livekitOk: boolean;
  errors: number;
  /** Velocidade de rede no intervalo, em bits por segundo (null fora do Linux). */
  networkIn: number | null;
  networkOut: number | null;
}

export interface HealthEvent {
  at: string;
  kind: string;
  detail: string;
}

export function addHealthSample(sample: HealthSample) {
  db.prepare(
    `INSERT INTO health_samples (at, cpu, memory, disk_free, disk_total, livekit_ok, errors, net_in, net_out)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(at) DO NOTHING`,
  ).run(
    sample.at,
    sample.cpu,
    sample.memory,
    sample.diskFree,
    sample.diskTotal,
    sample.livekitOk ? 1 : 0,
    sample.errors,
    sample.networkIn,
    sample.networkOut,
  );
}

export function listHealthSamples(since: string): HealthSample[] {
  const rows = db
    .prepare(
      `SELECT at, cpu, memory, disk_free AS diskFree, disk_total AS diskTotal, livekit_ok AS livekitOk, errors,
              net_in AS networkIn, net_out AS networkOut
       FROM health_samples WHERE at >= ? ORDER BY at`,
    )
    .all(since) as unknown as (Omit<HealthSample, 'livekitOk'> & { livekitOk: number })[];
  return rows.map((row) => ({ ...row, livekitOk: row.livekitOk === 1 }));
}

export function addHealthEvent(kind: string, detail: string) {
  db.prepare('INSERT INTO health_events (kind, detail) VALUES (?, ?)').run(kind, detail);
}

export function listHealthEvents(limit: number): HealthEvent[] {
  return db
    .prepare('SELECT at, kind, detail FROM health_events ORDER BY at DESC, id DESC LIMIT ?')
    .all(limit) as unknown as HealthEvent[];
}

export function pruneHealth(before: string) {
  db.prepare('DELETE FROM health_samples WHERE at < ?').run(before);
  db.prepare('DELETE FROM health_events WHERE at < ?').run(before);
}

export function getKv(key: string): string | undefined {
  return (db.prepare('SELECT value FROM kv WHERE key = ?').get(key) as { value: string } | undefined)?.value;
}

export function setKv(key: string, value: string) {
  db.prepare('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

export function addTraffic(month: string, bytes: number) {
  db.prepare(
    'INSERT INTO traffic_months (month, bytes) VALUES (?, ?) ON CONFLICT(month) DO UPDATE SET bytes = bytes + excluded.bytes',
  ).run(month, bytes);
}

export function trafficForMonth(month: string): number {
  return (db.prepare('SELECT bytes FROM traffic_months WHERE month = ?').get(month) as { bytes: number } | undefined)?.bytes ?? 0;
}

export function createMessage(channelId: number, userId: number, content: string, threadId: number | null = null): Message {
  const result = db
    .prepare('INSERT INTO messages (channel_id, user_id, content, thread_id) VALUES (?, ?, ?, ?)')
    .run(channelId, userId, content, threadId);
  const row = db.prepare(`${messageSelect} WHERE m.id = ?`).get(result.lastInsertRowid) as unknown as MessageRow;
  return toMessage(row);
}

// ---------- Reações ----------

/** Marca ou desmarca a reação; devolve se ficou marcada (true) ou foi tirada (false). */
export function toggleReaction(messageId: number, emoji: string, userId: number): boolean {
  const had = db.prepare('SELECT 1 FROM message_reactions WHERE message_id = ? AND emoji = ? AND user_id = ?').get(messageId, emoji, userId);
  if (had) {
    db.prepare('DELETE FROM message_reactions WHERE message_id = ? AND emoji = ? AND user_id = ?').run(messageId, emoji, userId);
    return false;
  }
  db.prepare('INSERT INTO message_reactions (message_id, emoji, user_id) VALUES (?, ?, ?)').run(messageId, emoji, userId);
  return true;
}

/** As reações de uma mensagem, já sabendo o que `viewerId` marcou — para responder a quem acabou de agir. */
export function reactionsForMessage(messageId: number, viewerId: number): Reaction[] {
  const rows = db
    .prepare(
      `SELECT emoji, COUNT(*) AS count, MAX(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS mine
       FROM message_reactions WHERE message_id = ? GROUP BY emoji ORDER BY MIN(id)`,
    )
    .all(viewerId, messageId) as unknown as { emoji: string; count: number; mine: number }[];
  return rows.map((r) => ({ emoji: r.emoji, count: r.count, mine: r.mine === 1 }));
}

/**
 * Quem esta pessoa pode ver online: quem divide alguma comunidade com ela, mais quem tem conversa
 * privada com ela.
 *
 * Existe porque a presença era mandada para TODO MUNDO: o servidor emitia a lista inteira de quem
 * estava online no Syden para o navegador de cada pessoa. A tela filtrava antes de desenhar, então
 * não aparecia nada de errado — mas o nome e o estado de todo mundo estavam ali, ao alcance de quem
 * abrisse as ferramentas do navegador. Entre amigos numa comunidade só isso não tinha consequência.
 * Com o cadastro aberto, tem: um estranho que se cadastra veria a lista de quem está online aqui.
 */
export function quemVejoOnline(userId: number): Set<number> {
  const linhas = db
    .prepare(
      `SELECT DISTINCT outro.user_id AS id
         FROM community_members meu
         JOIN community_members outro ON outro.community_id = meu.community_id
        WHERE meu.user_id = ?
        UNION
       SELECT DISTINCT outro.user_id AS id
         FROM channel_members meu
         JOIN channel_members outro ON outro.channel_id = meu.channel_id
         JOIN channels c ON c.id = meu.channel_id
        WHERE meu.user_id = ? AND c.type = 'dm'`,
    )
    .all(userId, userId) as unknown as { id: number }[];
  return new Set(linhas.map((l) => l.id));
}

/**
 * Quantas contas existem, e como elas chegaram. É o painel de crescimento.
 *
 * `insigniaDosPrimeiros` é o teto da promoção dos 25 primeiros: com ele na tela dá para responder
 * "ainda cabe alguém?" sem contar na mão nem abrir o banco.
 */
export function resumoDeContas(insigniaDosPrimeiros: number) {
  const uma = (sql: string, ...args: unknown[]) => (db.prepare(sql).get(...(args as never[])) as { n: number }).n;
  const agora = Date.now();
  const desde = (dias: number) => new Date(agora - dias * 86_400_000).toISOString();

  return {
    total: uma('SELECT COUNT(*) AS n FROM users'),
    hoje: uma('SELECT COUNT(*) AS n FROM users WHERE created_at >= ?', desde(1)),
    seteDias: uma('SELECT COUNT(*) AS n FROM users WHERE created_at >= ?', desde(7)),
    trintaDias: uma('SELECT COUNT(*) AS n FROM users WHERE created_at >= ?', desde(30)),
    /** Sem comunidade nenhuma: chegou, não usou um convite e ainda não criou a sua. */
    semComunidade: uma('SELECT COUNT(*) AS n FROM users u WHERE NOT EXISTS (SELECT 1 FROM community_members m WHERE m.user_id = u.id)'),
    /** Entrou por Google, Discord, GitHub ou Steam em algum momento. */
    comProvedor: uma('SELECT COUNT(DISTINCT user_id) AS n FROM social_accounts'),
    /** Cadastrou por senha e ainda não abriu o link: é o atrito da porta de entrada, em número. */
    porConfirmar: uma('SELECT COUNT(*) AS n FROM users WHERE exige_confirmacao = 1 AND email_verified_at IS NULL'),
    /** Quantas vagas restam na insígnia dos primeiros, para responder "ainda dá tempo?". */
    vagasNaInsignia: Math.max(0, insigniaDosPrimeiros - uma('SELECT COUNT(*) AS n FROM users')),
  };
}

// ---------- Entrar com Google/Discord ----------

export function contaSocial(provedor: string, sub: string): number | undefined {
  const linha = db.prepare('SELECT user_id AS userId FROM social_accounts WHERE provedor = ? AND sub = ?').get(provedor, sub) as
    | { userId: number }
    | undefined;
  return linha?.userId;
}

export function ligarContaSocial(provedor: string, sub: string, userId: number) {
  db.prepare(
    'INSERT INTO social_accounts (provedor, sub, user_id) VALUES (?, ?, ?) ON CONFLICT(provedor, sub) DO UPDATE SET user_id = excluded.user_id',
  ).run(provedor, sub, userId);
}

/** De quem é esta conta de provedor, se for de alguém. Serve para recusar a ligação dizendo de quem. */
export function donoDaContaSocial(provedor: string, sub: string): User | undefined {
  const userId = contaSocial(provedor, sub);
  return userId === undefined ? undefined : findUserById(userId);
}

/** Quais provedores esta pessoa já ligou. A tela de conta mostra isso. */
export function contasSociaisDe(userId: number): string[] {
  return (db.prepare('SELECT provedor FROM social_accounts WHERE user_id = ?').all(userId) as unknown as { provedor: string }[]).map(
    (l) => l.provedor,
  );
}

export function desligarContaSocial(provedor: string, userId: number) {
  db.prepare('DELETE FROM social_accounts WHERE provedor = ? AND user_id = ?').run(provedor, userId);
}

/** `ligarUserId` só vem quando a ida ao provedor é para LIGAR numa conta que já existe. */
export function criarEstadoSocial(state: string, provedor: string, resumo: string, ligarUserId?: number) {
  db.prepare('INSERT INTO social_states (state, provedor, resumo, ligar_user_id) VALUES (?, ?, ?, ?)').run(
    state,
    provedor,
    resumo,
    ligarUserId ?? null,
  );
}

export function acharEstadoSocial(state: string) {
  return db
    .prepare(
      'SELECT state, provedor, resumo, entrega, user_id AS userId, ligar_user_id AS ligarUserId, sub, created_at AS createdAt FROM social_states WHERE state = ?',
    )
    .get(state) as
    | {
        state: string;
        provedor: string;
        resumo: string;
        entrega: string | null;
        userId: number | null;
        ligarUserId: number | null;
        sub: string | null;
        createdAt: string;
      }
    | undefined;
}

/**
 * Guarda o comprovante. `userId` é quem vai entrar (login); `sub` é a conta de lá que vai ser ligada
 * (ligação). Uma ida ao provedor é uma coisa ou a outra, nunca as duas.
 */
export function guardarEntregaSocial(state: string, entrega: string, userId: number | null, sub: string | null = null) {
  db.prepare('UPDATE social_states SET entrega = ?, user_id = ?, sub = ? WHERE state = ?').run(entrega, userId, sub, state);
}

export function acharEntregaSocial(entrega: string) {
  return db
    .prepare(
      'SELECT state, provedor, resumo, user_id AS userId, ligar_user_id AS ligarUserId, sub, created_at AS createdAt FROM social_states WHERE entrega = ?',
    )
    .get(entrega) as
    | {
        state: string;
        provedor: string;
        resumo: string;
        userId: number | null;
        ligarUserId: number | null;
        sub: string | null;
        createdAt: string;
      }
    | undefined;
}

/** Uso único: o comprovante some no instante em que é trocado pelo token. */
export function consumirEstadoSocial(state: string) {
  db.prepare('DELETE FROM social_states WHERE state = ?').run(state);
}

/** Limpeza do que ficou pelo caminho (a pessoa desistiu na tela do Google e fechou a aba). */
export function limparEstadosSociais(antesDe: string) {
  db.prepare('DELETE FROM social_states WHERE created_at < ?').run(antesDe);
}

/** Cria uma conta SEM SENHA, para quem entrou pelo Google. Ver o comentário em criarUsuarioSocial. */
export function createUserSemSenha(username: string, email: string | null): User {
  const first = !db.prepare('SELECT 1 FROM users').get();
  const resultado = db
    .prepare('INSERT INTO users (username, password_hash, is_admin, is_owner, email, email_verified_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(
      username,
      // A coluna é NOT NULL. Este valor NÃO É um hash de senha nenhuma: o formato do scrypt tem
      // partes separadas por ':', e um texto sem isso nunca confere com senha alguma. É assim que
      // a conta nasce sem porta de senha — e ganha uma quando a pessoa definir uma.
      'sem-senha',
      first ? 1 : 0,
      first ? 1 : 0,
      email,
      email ? new Date().toISOString() : null,
    );
  return findUserById(Number(resultado.lastInsertRowid))!;
}

/** Esta conta tem senha? Sem isso, a tela de conta ofereceria "trocar a senha" a quem nunca teve uma. */
export function temSenha(userId: number): boolean {
  const linha = db.prepare('SELECT password_hash AS hash FROM users WHERE id = ?').get(userId) as { hash: string } | undefined;
  return Boolean(linha && linha.hash.includes(':'));
}

export function definirSenha(userId: number, passwordHash: string) {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
}

// ---------- Servidores de jogo ----------

const COLUNAS_JOGO =
  'id, community_id AS communityId, nome, jogo, endereco, senha, observacao, created_by AS createdBy, created_at AS createdAt';

/** A agenda de uma comunidade, agrupada na tela pelo jogo — por isso a ordem já vem por jogo. */
export function servidoresDeJogo(communityId: number): ServidorDeJogo[] {
  return db
    .prepare(`SELECT ${COLUNAS_JOGO} FROM game_servers WHERE community_id = ? ORDER BY jogo, nome`)
    .all(communityId) as unknown as ServidorDeJogo[];
}

export function contarServidoresDeJogo(communityId: number): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM game_servers WHERE community_id = ?').get(communityId) as { n: number }).n;
}

export function acharServidorDeJogo(id: number): ServidorDeJogo | undefined {
  return db.prepare(`SELECT ${COLUNAS_JOGO} FROM game_servers WHERE id = ?`).get(id) as unknown as ServidorDeJogo | undefined;
}

export function criarServidorDeJogo(communityId: number, criadoPor: number, novo: NovoServidor): ServidorDeJogo {
  const { lastInsertRowid } = db
    .prepare(
      'INSERT INTO game_servers (community_id, nome, jogo, endereco, senha, observacao, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
    )
    .run(communityId, novo.nome, novo.jogo, novo.endereco, novo.senha, novo.observacao, criadoPor);
  return acharServidorDeJogo(Number(lastInsertRowid))!;
}

export function atualizarServidorDeJogo(id: number, novo: NovoServidor): ServidorDeJogo | undefined {
  db.prepare('UPDATE game_servers SET nome = ?, jogo = ?, endereco = ?, senha = ?, observacao = ? WHERE id = ?').run(
    novo.nome,
    novo.jogo,
    novo.endereco,
    novo.senha,
    novo.observacao,
    id,
  );
  return acharServidorDeJogo(id);
}

export function apagarServidorDeJogo(id: number) {
  db.prepare('DELETE FROM game_servers WHERE id = ?').run(id);
}

/** Só as contagens, sem "mine": é o que vai para todo mundo — quem marcou o quê fica só com cada um. */
export function reactionCounts(messageId: number): { emoji: string; count: number }[] {
  return db
    .prepare('SELECT emoji, COUNT(*) AS count FROM message_reactions WHERE message_id = ? GROUP BY emoji ORDER BY MIN(id)')
    .all(messageId) as unknown as { emoji: string; count: number }[];
}

/**
 * Panorama das comunidades, para quem cuida do Syden inteiro.
 *
 * POR QUE ISTO EXISTE. Com o cadastro aberto, qualquer pessoa cria a sua comunidade, e quem mantém o
 * servidor deixou de ter ideia do que existe nele. Isso é um problema de duas pontas: não dá para
 * saber onde vale investir energia, nem para perceber que apareceu um lugar que não devia existir.
 * Hoje a única forma de descobrir é alguém de dentro denunciar.
 *
 * O QUE ISTO NÃO FAZ, e é de propósito: nada aqui lê o CONTEÚDO de mensagem nenhuma. Só se conta
 * quantas houve, de quantas pessoas diferentes e quando foi a última. É a diferença entre saber que
 * uma sala está cheia e ficar escutando a conversa — e é a linha que separa administrar de vigiar.
 *
 * A atividade de VOZ só existe A PARTIR DE 27/09/2026, quando usage_sessions passou a guardar em qual
 * comunidade a chamada aconteceu. As sessões anteriores têm community_id nulo e ficam de fora — não dá
 * para descobrir depois onde alguém estava. Por isso a tela diz desde quando conta, em vez de mostrar
 * um número que parece o histórico inteiro e não é.
 */
export interface PanoramaDeComunidade {
  id: number;
  nome: string;
  criadaEm: string;
  /** Quem criou. Nulo quando a conta já foi excluída. */
  criadaPor: string | null;
  membros: number;
  canais: number;
  /** Mensagens dentro da janela pedida, e quantas pessoas diferentes escreveram nela. */
  mensagens: number;
  pessoasQueEscreveram: number;
  /** Quando foi a última mensagem, de qualquer época. Nulo em comunidade onde ninguém falou nunca. */
  ultimaMensagemEm: string | null;
  /** Segundos em chamada e transmitindo tela dentro da janela. Só contam as sessões que sabem onde
   *  aconteceram — as de antes de 27/09/2026 não sabem. */
  segundosDeVoz: number;
  segundosDeTela: number;
}

export function panoramaDeComunidades(desde: string): PanoramaDeComunidade[] {
  return db
    .prepare(
      `SELECT
         c.id                                                        AS id,
         c.name                                                      AS nome,
         c.created_at                                                AS criadaEm,
         u.username                                                  AS criadaPor,
         (SELECT COUNT(*) FROM community_members m WHERE m.community_id = c.id)  AS membros,
         (SELECT COUNT(*) FROM channels ch WHERE ch.community_id = c.id)         AS canais,
         (SELECT COUNT(*)          FROM messages ms JOIN channels ch ON ch.id = ms.channel_id
            WHERE ch.community_id = c.id AND ms.created_at >= ?)                 AS mensagens,
         (SELECT COUNT(DISTINCT ms.user_id) FROM messages ms JOIN channels ch ON ch.id = ms.channel_id
            WHERE ch.community_id = c.id AND ms.created_at >= ?)                 AS pessoasQueEscreveram,
         (SELECT MAX(ms.created_at) FROM messages ms JOIN channels ch ON ch.id = ms.channel_id
            WHERE ch.community_id = c.id)                                        AS ultimaMensagemEm,
         -- O tempo sai da diferença entre início e fim de cada sessão, somada. strftime('%s') devolve
         -- segundos desde 1970, que é o que permite subtrair duas datas em SQLite.
         (SELECT COALESCE(SUM(strftime('%s', s.ended_at) - strftime('%s', s.started_at)), 0)
            FROM usage_sessions s
            WHERE s.community_id = c.id AND s.kind = 'voice' AND s.ended_at >= ?)  AS segundosDeVoz,
         (SELECT COALESCE(SUM(strftime('%s', s.ended_at) - strftime('%s', s.started_at)), 0)
            FROM usage_sessions s
            WHERE s.community_id = c.id AND s.kind = 'screen' AND s.ended_at >= ?) AS segundosDeTela
       FROM communities c
       LEFT JOIN users u ON u.id = c.created_by
       ORDER BY mensagens DESC, membros DESC, c.id ASC`,
    )
    .all(desde, desde, desde, desde) as unknown as PanoramaDeComunidade[];
}

// ---------- Preferências de cada pessoa ----------

export function lerPreferencias(userId: number): { data: string; em: string } | null {
  const linha = db
    .prepare('SELECT data, updated_at AS em FROM user_prefs WHERE user_id = ?')
    .get(userId) as { data: string; em: string } | undefined;
  return linha ?? null;
}

export function guardarPreferencias(userId: number, data: string) {
  db.prepare(
    `INSERT INTO user_prefs (user_id, data, updated_at) VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
     ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
  ).run(userId, data);
}

// ---------- Amizades ----------

/**
 * O par, sempre na mesma ordem.
 *
 * Toda consulta e toda gravação passam por aqui. É o que faz a chave primária valer: sem a ordem
 * fixa, (3,7) e (7,3) seriam dois pedidos diferentes para a mesma dupla, e o banco aceitaria os dois.
 */
function par(a: number, b: number): [number, number] {
  return a < b ? [a, b] : [b, a];
}

export type SituacaoDeAmizade = 'pendente' | 'aceita';

export interface Amizade {
  /** A OUTRA pessoa — quem pergunta nunca aparece na própria lista. */
  userId: number;
  username: string;
  avatarVersion: number | null;
  situacao: SituacaoDeAmizade;
  /** Verdadeiro quando o pedido partiu de quem está perguntando. Só vale enquanto pendente. */
  euPedi: boolean;
  desde: string;
}

const amizadeSelect = `
  SELECT
    CASE WHEN f.menor_id = ? THEN f.maior_id ELSE f.menor_id END AS userId,
    u.username        AS username,
    u.avatar_version  AS avatarVersion,
    f.situacao        AS situacao,
    f.quem_pediu = ?  AS euPedi,
    COALESCE(f.aceita_em, f.criada_em) AS desde
  FROM friendships f
  JOIN users u ON u.id = CASE WHEN f.menor_id = ? THEN f.maior_id ELSE f.menor_id END
  WHERE ? IN (f.menor_id, f.maior_id)
`;

export function listarAmizades(userId: number): Amizade[] {
  const linhas = db
    .prepare(`${amizadeSelect} ORDER BY u.username COLLATE NOCASE`)
    .all(userId, userId, userId, userId) as unknown as (Omit<Amizade, 'euPedi'> & { euPedi: number })[];
  // O SQLite devolve 0 e 1 para comparação, não booleano: converte aqui para a tela não precisar saber.
  return linhas.map((l) => ({ ...l, euPedi: Boolean(l.euPedi) }));
}

export function amizadeEntre(a: number, b: number): { situacao: SituacaoDeAmizade; quemPediu: number } | null {
  const [menor, maior] = par(a, b);
  const linha = db
    .prepare('SELECT situacao, quem_pediu AS quemPediu FROM friendships WHERE menor_id = ? AND maior_id = ?')
    .get(menor, maior) as { situacao: SituacaoDeAmizade; quemPediu: number } | undefined;
  return linha ?? null;
}

/** Devolve falso quando já existia alguma relação — o chamador decide o que dizer nesse caso. */
export function pedirAmizade(de: number, para: number): boolean {
  const [menor, maior] = par(de, para);
  const resultado = db
    .prepare(
      `INSERT INTO friendships (menor_id, maior_id, quem_pediu, situacao) VALUES (?, ?, ?, 'pendente')
       ON CONFLICT(menor_id, maior_id) DO NOTHING`,
    )
    .run(menor, maior, de);
  return resultado.changes > 0;
}

export function aceitarAmizade(quemAceita: number, oOutro: number): boolean {
  const [menor, maior] = par(quemAceita, oOutro);
  // `quem_pediu <> ?` é a trava que importa: sem ela, quem pediu aceitaria o próprio pedido e viraria
  // amigo de quem nunca respondeu. É uma linha de SQL no lugar de uma checagem que dá para esquecer.
  const resultado = db
    .prepare(
      `UPDATE friendships SET situacao = 'aceita', aceita_em = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE menor_id = ? AND maior_id = ? AND situacao = 'pendente' AND quem_pediu <> ?`,
    )
    .run(menor, maior, quemAceita);
  return resultado.changes > 0;
}

/** Serve para recusar um pedido e para desfazer uma amizade: nos dois casos a linha some. */
export function desfazerAmizade(a: number, b: number): boolean {
  const [menor, maior] = par(a, b);
  return db.prepare('DELETE FROM friendships WHERE menor_id = ? AND maior_id = ?').run(menor, maior).changes > 0;
}

/**
 * Quem poderia ser seu amigo, e por quê.
 *
 * DUAS ORIGENS, e a ordem entre elas não é detalhe:
 *
 *   1. quem você JÁ CONVERSOU em conversa privada. É o sinal mais forte que existe — vocês já se
 *      falam, só não há nada guardado dizendo isso. Vem primeiro na lista.
 *   2. quem divide comunidade com você, ordenado por quantas: duas em comum é um conhecido melhor
 *      do que uma.
 *
 * O QUE NÃO ENTRA, e é decisão de privacidade e não limitação: qualquer pessoa com quem você não
 * tenha nenhuma dessas duas ligações. Uma lista de "pessoas que talvez você conheça" montada sobre o
 * Syden inteiro entregaria a existência de estranhos a estranhos — quem se cadastrou ontem apareceria
 * na tela de alguém que nunca o viu. Dividir comunidade já significa que vocês se veem na lista de
 * membros; ter conversado significa muito mais que isso.
 *
 * Mensagem em canal de comunidade NÃO é uma terceira origem: quem escreve num canal já é membro dela,
 * então já está coberto pela segunda — e usar "escreveu perto de você" acabaria sugerindo alguém que
 * você nunca notou num canal de mil pessoas.
 */
export interface SugestaoDeAmizade {
  userId: number;
  username: string;
  avatarVersion: number | null;
  /** Quantas comunidades vocês dividem. Pode ser zero quando a ligação é só a conversa privada. */
  emComum: number;
  /** Vocês já têm uma conversa privada aberta. É o motivo mais forte, e a tela diz isso. */
  jaConversaram: boolean;
}

export function sugestoesDeAmizade(userId: number, limite = 12): SugestaoDeAmizade[] {
  // Uma consulta só, com as duas origens somadas por UNION ALL e depois agrupadas: assim quem
  // aparece pelos dois motivos vira uma linha, e não duas.
  return db
    .prepare(
      `WITH candidatos AS (
         -- 1. Quem divide comunidade.
         SELECT m.user_id AS id, m.community_id AS comunidade, 0 AS conversa
           FROM community_members m
           JOIN community_members meus
             ON meus.community_id = m.community_id AND meus.user_id = ?
          WHERE m.user_id <> ?

         UNION ALL

         -- 2. Quem já está numa conversa privada com você. Vale para a conversa de dois e para o
         --    grupo: nos dois casos vocês já trocaram mensagem no mesmo lugar.
         SELECT cm.user_id AS id, NULL AS comunidade, 1 AS conversa
           FROM channel_members cm
           JOIN channels ch ON ch.id = cm.channel_id AND ch.type = 'dm'
           JOIN channel_members meus ON meus.channel_id = ch.id AND meus.user_id = ?
          WHERE cm.user_id <> ?
       )
       SELECT u.id                                AS userId,
              u.username                          AS username,
              u.avatar_version                    AS avatarVersion,
              COUNT(DISTINCT c.comunidade)        AS emComum,
              MAX(c.conversa)                     AS jaConversaram
         FROM candidatos c
         JOIN users u ON u.id = c.id
        WHERE NOT EXISTS (
                SELECT 1 FROM friendships f
                 WHERE f.menor_id = MIN(?, u.id) AND f.maior_id = MAX(?, u.id)
              )
        GROUP BY u.id
        -- Quem você já conversou vem antes de quem só divide comunidade.
        ORDER BY jaConversaram DESC, emComum DESC, u.username COLLATE NOCASE
        LIMIT ?`,
    )
    .all(userId, userId, userId, userId, userId, userId, limite)
    .map((l) => {
      const linha = l as { userId: number; username: string; avatarVersion: number | null; emComum: number; jaConversaram: number };
      // O SQLite devolve 0 e 1 no lugar de booleano; a tela não precisa saber disso.
      return { ...linha, jaConversaram: Boolean(linha.jaConversaram) };
    });
}

// ---------- O selo da comunidade ----------

/**
 * Os fatos que decidem quais marcos a comunidade alcançou.
 *
 * Tudo sai de contagem: quantos membros, quantas contas diferentes escreveram, em quantos DIAS
 * diferentes houve conversa e quanto tempo de voz. Nenhuma linha aqui lê o texto de uma mensagem.
 */
export function fatosDaComunidade(communityId: number) {
  const uma = (sql: string) => (db.prepare(sql).get(communityId) as { n: number }).n;

  return {
    membros: uma('SELECT COUNT(*) AS n FROM community_members WHERE community_id = ?'),
    pessoasQueEscreveram: uma(
      `SELECT COUNT(DISTINCT ms.user_id) AS n FROM messages ms
         JOIN channels ch ON ch.id = ms.channel_id WHERE ch.community_id = ?`,
    ),
    // substr(...,1,10) recorta o "AAAA-MM-DD" da data ISO: é assim que dias diferentes viram contagem.
    diasComConversa: uma(
      `SELECT COUNT(DISTINCT substr(ms.created_at, 1, 10)) AS n FROM messages ms
         JOIN channels ch ON ch.id = ms.channel_id WHERE ch.community_id = ?`,
    ),
    segundosDeVoz: uma(
      `SELECT COALESCE(SUM(strftime('%s', ended_at) - strftime('%s', started_at)), 0) AS n
         FROM usage_sessions WHERE community_id = ? AND kind = 'voice'`,
    ),
  };
}

export function lerSelo(communityId: number): { texto: string; icone: string; cor: string } | null {
  const linha = db
    .prepare('SELECT selo_texto AS texto, selo_icone AS icone, selo_cor AS cor FROM communities WHERE id = ?')
    .get(communityId) as { texto: string | null; icone: string | null; cor: string | null } | undefined;
  if (!linha?.texto || !linha.icone || !linha.cor) return null;
  return { texto: linha.texto, icone: linha.icone, cor: linha.cor };
}

export function guardarSelo(communityId: number, selo: { texto: string; icone: string; cor: string } | null) {
  db.prepare('UPDATE communities SET selo_texto = ?, selo_icone = ?, selo_cor = ? WHERE id = ?').run(
    selo?.texto ?? null,
    selo?.icone ?? null,
    selo?.cor ?? null,
    communityId,
  );
}

/**
 * Quais selos esta pessoa pode vestir.
 *
 * Só das comunidades de que ela PARTICIPA e que já conquistaram o selo. As duas condições valem
 * sempre, e não só na hora de escolher: alguém que saiu da comunidade não continua usando a
 * camiseta do time, e é por isso que quem lê confere de novo.
 */
export function selosQuePodeVestir(userId: number) {
  return db
    .prepare(
      `SELECT c.id AS communityId, c.name AS nome,
              c.selo_texto AS texto, c.selo_icone AS icone, c.selo_cor AS cor
         FROM community_members m
         JOIN communities c ON c.id = m.community_id
        WHERE m.user_id = ? AND c.selo_texto IS NOT NULL AND c.selo_icone IS NOT NULL AND c.selo_cor IS NOT NULL
        ORDER BY c.name COLLATE NOCASE`,
    )
    .all(userId) as unknown as { communityId: number; nome: string; texto: string; icone: string; cor: string }[];
}

/** Devolve falso quando a pessoa não pode vestir esse selo — e aí nada é gravado. */
export function vestirSelo(userId: number, communityId: number | null): boolean {
  if (communityId === null) {
    db.prepare('UPDATE users SET selo_comunidade = NULL WHERE id = ?').run(userId);
    return true;
  }
  // A conferência é do servidor, e não da tela: a lista de opções vem daqui, mas um pedido feito à
  // mão pediria a camiseta de um time do qual a pessoa nunca fez parte.
  if (!selosQuePodeVestir(userId).some((s) => s.communityId === communityId)) return false;
  db.prepare('UPDATE users SET selo_comunidade = ? WHERE id = ?').run(communityId, userId);
  return true;
}

/**
 * Tira o selo de quem não pode mais usá-lo.
 *
 * Roda quando alguém sai (ou é removido) de uma comunidade, e quando uma comunidade perde o selo.
 * Sem isso, a camiseta continuaria no corpo de quem saiu do time — e ninguém repararia, porque nada
 * daria erro.
 */
export function limparSelosInvalidos(communityId: number) {
  db.prepare(
    `UPDATE users SET selo_comunidade = NULL
      WHERE selo_comunidade = ?
        AND id NOT IN (SELECT user_id FROM community_members WHERE community_id = ?)`,
  ).run(communityId, communityId);
}

/** Tira este selo do corpo de todo mundo: usado quando a comunidade deixa de ter selo. */
export function despirSeloDaComunidade(communityId: number) {
  db.prepare('UPDATE users SET selo_comunidade = NULL WHERE selo_comunidade = ?').run(communityId);
}

// ---------- Bloqueios ----------

/**
 * Existe bloqueio entre estes dois, em qualquer sentido?
 *
 * É esta pergunta — e não "fulano bloqueou beltrano" — que o resto do programa faz. Um bloqueio que
 * calasse só um dos lados não protegeria ninguém: quem bloqueou continuaria recebendo mensagem.
 */
export function haBloqueio(a: number, b: number): boolean {
  const linha = db
    .prepare(
      `SELECT 1 AS n FROM blocks
        WHERE (quem_bloqueou = ? AND bloqueado = ?) OR (quem_bloqueou = ? AND bloqueado = ?) LIMIT 1`,
    )
    .get(a, b, b, a);
  return linha !== undefined;
}

/** Quem esta pessoa bloqueou. Só ela vê a própria lista. */
export function listarBloqueios(userId: number): { userId: number; username: string; desde: string }[] {
  return db
    .prepare(
      `SELECT u.id AS userId, u.username AS username, b.criado_em AS desde
         FROM blocks b JOIN users u ON u.id = b.bloqueado
        WHERE b.quem_bloqueou = ? ORDER BY u.username COLLATE NOCASE`,
    )
    .all(userId) as unknown as { userId: number; username: string; desde: string }[];
}

/**
 * Bloquear DESFAZ a amizade e qualquer pedido pendente.
 *
 * Sem isso sobraria um estado sem sentido: "amigo" de alguém com quem não se pode trocar mensagem.
 * E, pior, a pessoa continuaria aparecendo na lista de amigos de quem a bloqueou.
 */
export function bloquear(quemBloqueou: number, bloqueado: number): boolean {
  if (quemBloqueou === bloqueado) return false;
  if (!findUserById(bloqueado)) return false;
  db.exec('BEGIN');
  try {
    db.prepare('INSERT INTO blocks (quem_bloqueou, bloqueado) VALUES (?, ?) ON CONFLICT DO NOTHING').run(
      quemBloqueou,
      bloqueado,
    );
    const [menor, maior] = quemBloqueou < bloqueado ? [quemBloqueou, bloqueado] : [bloqueado, quemBloqueou];
    db.prepare('DELETE FROM friendships WHERE menor_id = ? AND maior_id = ?').run(menor, maior);
    db.exec('COMMIT');
    return true;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/** Desbloquear NÃO devolve a amizade: ela foi desfeita, e refazê-la é escolha das duas pessoas. */
export function desbloquear(quemBloqueou: number, bloqueado: number): boolean {
  return (
    db.prepare('DELETE FROM blocks WHERE quem_bloqueou = ? AND bloqueado = ?').run(quemBloqueou, bloqueado).changes > 0
  );
}

/** Os números de quem esta pessoa bloqueou OU que a bloquearam: é o que a tela usa para esconder. */
export function idsBloqueadosDe(userId: number): number[] {
  return (
    db
      .prepare(
        `SELECT bloqueado AS id FROM blocks WHERE quem_bloqueou = ?
         UNION
         SELECT quem_bloqueou AS id FROM blocks WHERE bloqueado = ?`,
      )
      .all(userId, userId) as { id: number }[]
  ).map((linha) => linha.id);
}

// ---------------------------------------------------------------------------------------------------
// O ESPAÇO DE BOAS-VINDAS DA COMUNIDADE
// ---------------------------------------------------------------------------------------------------

export interface BoasVindas {
  titulo: string;
  texto: string;
  /** Código da arte de fundo; o desenho mora em web/src/boasVindas.ts. */
  arte: string;
}

/** O que o dono escreveu. Nulo quando a comunidade ainda não montou o espaço dela. */
export function lerBoasVindas(communityId: number): BoasVindas | null {
  const linha = db
    .prepare('SELECT bv_titulo AS titulo, bv_texto AS texto, bv_arte AS arte FROM communities WHERE id = ?')
    .get(communityId) as { titulo: string | null; texto: string | null; arte: string | null } | undefined;
  if (!linha?.titulo && !linha?.texto) return null;
  return { titulo: linha.titulo ?? '', texto: linha.texto ?? '', arte: linha.arte ?? 'aurora' };
}

export function guardarBoasVindas(communityId: number, bv: BoasVindas | null) {
  db.prepare('UPDATE communities SET bv_titulo = ?, bv_texto = ?, bv_arte = ? WHERE id = ?').run(
    bv?.titulo ?? null,
    bv?.texto ?? null,
    bv?.arte ?? null,
    communityId,
  );
}

/** Esta pessoa já viu as boas-vindas desta comunidade? */
export function jaViuBoasVindas(communityId: number, userId: number): boolean {
  const linha = db
    .prepare('SELECT viu_boas_vindas AS quando FROM community_members WHERE community_id = ? AND user_id = ?')
    .get(communityId, userId) as { quando: string | null } | undefined;
  return Boolean(linha?.quando);
}

/**
 * Marca que viu. É idempotente de propósito: guarda a PRIMEIRA vez, e chamadas seguintes não mexem.
 *
 * Sem o `IS NULL`, cada abertura sobrescreveria a data e a informação "quando esta pessoa chegou de
 * verdade" se perderia na primeira vez que alguém reabrisse a tela por curiosidade.
 */
export function marcarViuBoasVindas(communityId: number, userId: number) {
  db.prepare(
    `UPDATE community_members SET viu_boas_vindas = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE community_id = ? AND user_id = ? AND viu_boas_vindas IS NULL`,
  ).run(communityId, userId);
}

// ---------------------------------------------------------------------------------------------------
// MODO APRESENTAÇÃO: uma pessoa fala, as outras assistem
// ---------------------------------------------------------------------------------------------------

export type SituacaoNoPalco = 'palco' | 'mao';

export function ehApresentacao(channelId: number): boolean {
  const linha = db.prepare('SELECT apresentacao FROM channels WHERE id = ?').get(channelId) as
    | { apresentacao: number }
    | undefined;
  return linha?.apresentacao === 1;
}

/**
 * Liga ou desliga o modo apresentação.
 *
 * Desligar LIMPA o palco e as mãos. Sem isso, uma sala que voltasse ao normal e fosse posta em
 * apresentação de novo reapareceria com o palco de semanas atrás — e ninguém entenderia por que aquelas
 * pessoas específicas podem falar.
 */
export function definirApresentacao(channelId: number, ligado: boolean) {
  db.prepare('UPDATE channels SET apresentacao = ? WHERE id = ?').run(ligado ? 1 : 0, channelId);
  if (!ligado) db.prepare('DELETE FROM channel_palco WHERE channel_id = ?').run(channelId);
}

export interface NoPalco {
  userId: number;
  username: string;
  situacao: SituacaoNoPalco;
  desde: string;
}

/** Quem está no palco e quem levantou a mão, em ordem de chegada. */
export function lerPalco(channelId: number): NoPalco[] {
  return db
    .prepare(
      `SELECT p.user_id AS userId, u.username, p.situacao, p.desde
       FROM channel_palco p JOIN users u ON u.id = p.user_id
       WHERE p.channel_id = ?
       ORDER BY p.desde`,
    )
    .all(channelId) as unknown as NoPalco[];
}

export function situacaoNoPalco(channelId: number, userId: number): SituacaoNoPalco | null {
  const linha = db
    .prepare('SELECT situacao FROM channel_palco WHERE channel_id = ? AND user_id = ?')
    .get(channelId, userId) as { situacao: SituacaoNoPalco } | undefined;
  return linha?.situacao ?? null;
}

/**
 * Põe alguém no palco ou na fila de mãos levantadas.
 *
 * O `desde` só é reescrito quando a situação MUDA. Assim quem levantou a mão primeiro continua sendo o
 * primeiro da fila mesmo que alguma outra coisa toque nesta linha — e a fila de mão levantada só é justa
 * se a ordem for a de quem pediu antes.
 */
export function porNoPalco(channelId: number, userId: number, situacao: SituacaoNoPalco) {
  db.prepare(
    `INSERT INTO channel_palco (channel_id, user_id, situacao) VALUES (?, ?, ?)
     ON CONFLICT (channel_id, user_id) DO UPDATE SET
       situacao = excluded.situacao,
       desde = CASE WHEN channel_palco.situacao = excluded.situacao THEN channel_palco.desde
                    ELSE strftime('%Y-%m-%dT%H:%M:%fZ', 'now') END`,
  ).run(channelId, userId, situacao);
}

export function tirarDoPalco(channelId: number, userId: number) {
  db.prepare('DELETE FROM channel_palco WHERE channel_id = ? AND user_id = ?').run(channelId, userId);
}

// ---------------------------------------------------------------------------------------------------
// A FILA DE RECONFERÊNCIA DO SHIELD
// ---------------------------------------------------------------------------------------------------

export interface NaFila {
  sha256: string;
  onde: string;
  alvoId: number;
  quando: string;
  tentativas: number;
}

/**
 * Anota uma imagem que entrou sem conferência.
 *
 * O `ON CONFLICT DO NOTHING` importa: a mesma imagem pode entrar em vários lugares durante uma queda
 * do Shield, e cada um deles precisa da própria linha — mas a mesma imagem no mesmo lugar não.
 */
export function porNaFilaDoShield(sha256: string, onde: string, alvoId: number) {
  db.prepare(
    'INSERT INTO shield_fila (sha256, onde, alvo_id) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
  ).run(sha256, onde, alvoId);
}

export function lerFilaDoShield(quantos = 20): NaFila[] {
  return db
    .prepare(
      `SELECT sha256, onde, alvo_id AS alvoId, quando, tentativas FROM shield_fila
       ORDER BY tentativas, quando LIMIT ?`,
    )
    .all(quantos) as unknown as NaFila[];
}

export function tamanhoDaFilaDoShield(): number {
  return (db.prepare('SELECT COUNT(*) AS n FROM shield_fila').get() as { n: number }).n;
}

export function tirarDaFilaDoShield(sha256: string, onde: string, alvoId: number) {
  db.prepare('DELETE FROM shield_fila WHERE sha256 = ? AND onde = ? AND alvo_id = ?').run(sha256, onde, alvoId);
}

/**
 * Conta mais uma tentativa que falhou.
 *
 * Sem isto, um item que o Shield nunca consegue conferir ficaria eternamente na frente da fila e os
 * outros nunca seriam vistos — a ordenação é por tentativas primeiro, justamente para o que já falhou
 * ir para o fim.
 */
export function maisUmaTentativaNoShield(sha256: string, onde: string, alvoId: number) {
  db.prepare(
    'UPDATE shield_fila SET tentativas = tentativas + 1 WHERE sha256 = ? AND onde = ? AND alvo_id = ?',
  ).run(sha256, onde, alvoId);
}
