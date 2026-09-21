import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

export type ChannelType = 'text' | 'voice';

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
  communityId: number;
  name: string;
  /** Um emoji comum que representa o som no soundboard. */
  icon: string;
  createdBy: number | null;
}

export interface Channel {
  id: number;
  communityId: number;
  name: string;
  type: ChannelType;
  position: number;
  /** Quem criou o canal; null nos canais que vêm de fábrica. */
  createdBy: number | null;
}

export interface Message {
  id: number;
  channelId: number;
  content: string;
  createdAt: string;
  author: UserRef;
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

  CREATE TABLE IF NOT EXISTS channels (
    id           INTEGER PRIMARY KEY,
    community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    type         TEXT NOT NULL CHECK (type IN ('text', 'voice')),
    position     INTEGER NOT NULL DEFAULT 0,
    created_by   INTEGER
  );

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

  -- Saúde do servidor: uma amostra a cada 5 minutos, guardadas por uma semana.
  CREATE TABLE IF NOT EXISTS health_samples (
    at         TEXT PRIMARY KEY,
    cpu        REAL NOT NULL,
    memory     REAL NOT NULL,
    disk_free  INTEGER,
    disk_total INTEGER,
    livekit_ok INTEGER NOT NULL,
    errors     INTEGER NOT NULL DEFAULT 0
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

  CREATE TABLE IF NOT EXISTS sounds (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    community_id INTEGER NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    icon         TEXT NOT NULL,
    mime         TEXT NOT NULL,
    data         BLOB NOT NULL,
    created_by   INTEGER
  );
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

const soundColumns = 'id, community_id AS communityId, name, icon, created_by AS createdBy';

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

/** Remove os sons do pacote de demonstração (os que ninguém enviou), para trocar por uma versão nova. */
export function deletePackSounds(communityId: number) {
  db.prepare('DELETE FROM sounds WHERE community_id = ? AND created_by IS NULL').run(communityId);
}

export function findSoundFile(id: number) {
  return db.prepare('SELECT mime, data FROM sounds WHERE id = ?').get(id) as { mime: string; data: Uint8Array } | undefined;
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
    for (const table of ['channels', 'emojis', 'sounds']) {
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
      `SELECT m.id, m.channel_id AS channelId, m.user_id AS userId, c.community_id AS communityId
       FROM messages m JOIN channels c ON c.id = m.channel_id WHERE m.id = ?`,
    )
    .get(id) as { id: number; channelId: number; userId: number; communityId: number } | undefined;
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

interface MessageRow {
  id: number;
  channelId: number;
  content: string;
  createdAt: string;
  userId: number;
  username: string;
}

const messageSelect = `
  SELECT m.id, m.channel_id AS channelId, m.content, m.created_at AS createdAt,
         u.id AS userId, u.username
  FROM messages m JOIN users u ON u.id = m.user_id`;

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    channelId: row.channelId,
    content: row.content,
    createdAt: row.createdAt,
    author: { id: row.userId, username: row.username },
  };
}

/** Mensagens mais recentes do canal (ou anteriores a `beforeId`), em ordem cronológica. */
export function listMessages(channelId: number, beforeId: number | undefined, limit = 50): Message[] {
  const rows = db
    .prepare(`${messageSelect} WHERE m.channel_id = ? AND m.id < ? ORDER BY m.id DESC LIMIT ?`)
    .all(channelId, beforeId ?? Number.MAX_SAFE_INTEGER, limit) as unknown as MessageRow[];
  return rows.reverse().map(toMessage);
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
}

export interface HealthEvent {
  at: string;
  kind: string;
  detail: string;
}

export function addHealthSample(sample: HealthSample) {
  db.prepare(
    `INSERT INTO health_samples (at, cpu, memory, disk_free, disk_total, livekit_ok, errors)
     VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(at) DO NOTHING`,
  ).run(sample.at, sample.cpu, sample.memory, sample.diskFree, sample.diskTotal, sample.livekitOk ? 1 : 0, sample.errors);
}

export function listHealthSamples(since: string): HealthSample[] {
  const rows = db
    .prepare(
      `SELECT at, cpu, memory, disk_free AS diskFree, disk_total AS diskTotal, livekit_ok AS livekitOk, errors
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

export function createMessage(channelId: number, userId: number, content: string): Message {
  const result = db
    .prepare('INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)')
    .run(channelId, userId, content);
  const row = db.prepare(`${messageSelect} WHERE m.id = ?`).get(result.lastInsertRowid) as unknown as MessageRow;
  return toMessage(row);
}
