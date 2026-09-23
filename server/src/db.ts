import { randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

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
}

/** Identificação pública de alguém (autor de mensagem, lista de online). */
export type UserRef = Pick<User, 'id' | 'username'>;

/** O que todos precisam saber de cada usuário para desenhar nome e avatar. */
export type PublicUser = Pick<User, 'id' | 'username' | 'avatarVersion' | 'isAdmin' | 'isOwner'>;

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
  -- Cada pessoa reage no máximo uma vez com o mesmo emoji na mesma mensagem.
  CREATE TABLE IF NOT EXISTS message_reactions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    emoji      TEXT NOT NULL,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (message_id, emoji, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_reactions_message ON message_reactions(message_id, id);
`);

// Colunas que chegaram depois da primeira versão: bancos antigos ganham elas na inicialização.
function addColumnIfMissing(table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
function hasColumn(table: string, column: string) {
  return (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).some((c) => c.name === column);
}

addColumnIfMissing('users', 'is_admin', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('channels', 'created_by', 'INTEGER');
// Muda a cada troca de avatar; entra na URL da imagem para o navegador buscar a nova. null = sem avatar.
addColumnIfMissing('users', 'avatar_version', 'INTEGER');
addColumnIfMissing('users', 'is_owner', 'INTEGER NOT NULL DEFAULT 0');
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

const communityColumns = 'id, name, created_by AS createdBy, icon_version AS iconVersion';

export function listCommunitiesForUser(userId: number): CommunityForUser[] {
  return db
    .prepare(
      `SELECT c.id, c.name, c.created_by AS createdBy, c.icon_version AS iconVersion, m.role,
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
  return db.prepare('SELECT mime, data FROM community_icons WHERE community_id = ?').get(communityId) as
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
}

export function listCommunityMembers(communityId: number): CommunityMember[] {
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.is_admin AS isAdmin, u.is_owner AS isOwner, u.avatar_version AS avatarVersion, m.role
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

const userColumns = 'id, username, is_admin AS isAdmin, is_owner AS isOwner, avatar_version AS avatarVersion';

type UserRow = { id: number; username: string; isAdmin: number; isOwner: number; avatarVersion: number | null };

function toUser(row: UserRow | undefined): User | undefined {
  return (
    row && {
      id: row.id,
      username: row.username,
      isAdmin: row.isAdmin === 1,
      isOwner: row.isOwner === 1,
      avatarVersion: row.avatarVersion,
    }
  );
}

export function findUserByName(username: string) {
  const row = db
    .prepare(`SELECT ${userColumns}, password_hash AS passwordHash FROM users WHERE username = ?`)
    .get(username) as (UserRow & { passwordHash: string }) | undefined;
  return row && { ...toUser(row)!, passwordHash: row.passwordHash };
}

export function listPublicUsers(): PublicUser[] {
  return (db.prepare(`SELECT ${userColumns} FROM users ORDER BY id`).all() as UserRow[]).map((row) => toUser(row)!);
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

export function findAvatar(userId: number) {
  return db.prepare('SELECT mime, data FROM avatars WHERE user_id = ?').get(userId) as
    | { mime: string; data: Uint8Array }
    | undefined;
}

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
  return db.prepare('SELECT mime, data FROM emojis WHERE id = ?').get(id) as { mime: string; data: Uint8Array } | undefined;
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
  return db.prepare('SELECT mime, data FROM sounds WHERE id = ?').get(id) as { mime: string; data: Uint8Array } | undefined;
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

export function findPasswordHash(userId: number) {
  return (db.prepare('SELECT password_hash AS hash FROM users WHERE id = ?').get(userId) as { hash: string }).hash;
}

/** O primeiro cadastro do servidor vira dono e administrador. */
export function createUser(username: string, passwordHash: string): User {
  const first = !db.prepare('SELECT 1 FROM users').get();
  const result = db
    .prepare('INSERT INTO users (username, password_hash, is_admin, is_owner) VALUES (?, ?, ?, ?)')
    .run(username, passwordHash, first ? 1 : 0, first ? 1 : 0);
  return findUserById(Number(result.lastInsertRowid))!;
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
      `SELECT id, message_id AS messageId, key, name, mime, size, width, height
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

export interface NewAttachment {
  name: string;
  mime: string;
  data: Buffer;
  width: number | null;
  height: number | null;
}

export function addAttachment(messageId: number, file: NewAttachment): Attachment {
  const key = randomBytes(12).toString('hex');
  const result = db
    .prepare('INSERT INTO attachments (message_id, key, name, mime, size, width, height, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(messageId, key, file.name, file.mime, file.data.length, file.width, file.height, file.data);
  return {
    id: Number(result.lastInsertRowid),
    key,
    name: file.name,
    mime: file.mime,
    size: file.data.length,
    width: file.width,
    height: file.height,
  };
}

/** O arquivo só sai daqui com o id e a chave certos. */
export function findAttachmentFile(id: number, key: string) {
  return db.prepare('SELECT name, mime, data FROM attachments WHERE id = ? AND key = ?').get(id, key) as
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

export function startUsageSession(kind: UsageKind, userId: number): number {
  const now = new Date().toISOString();
  const result = db
    .prepare('INSERT INTO usage_sessions (kind, user_id, started_at, ended_at) VALUES (?, ?, ?, ?)')
    .run(kind, userId, now, now);
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

/** Só as contagens, sem "mine": é o que vai para todo mundo — quem marcou o quê fica só com cada um. */
export function reactionCounts(messageId: number): { emoji: string; count: number }[] {
  return db
    .prepare('SELECT emoji, COUNT(*) AS count FROM message_reactions WHERE message_id = ? GROUP BY emoji ORDER BY MIN(id)')
    .all(messageId) as unknown as { emoji: string; count: number }[];
}
