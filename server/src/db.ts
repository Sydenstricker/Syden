import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

export type ChannelType = 'text' | 'voice';

export interface User {
  id: number;
  username: string;
  /** O primeiro usuário cadastrado administra o servidor (pode gerenciar qualquer canal). */
  isAdmin: boolean;
  avatarVersion: number | null;
}

/** Identificação pública de alguém (autor de mensagem, lista de online). */
export type UserRef = Pick<User, 'id' | 'username'>;

/** O que todos precisam saber de cada usuário para desenhar nome e avatar. */
export type PublicUser = Pick<User, 'id' | 'username' | 'avatarVersion'>;

export interface Emoji {
  id: number;
  name: string;
  createdBy: number | null;
}

export interface Sound {
  id: number;
  name: string;
  /** Um emoji comum que representa o som no soundboard. */
  icon: string;
  createdBy: number | null;
}

export interface Channel {
  id: number;
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

  CREATE TABLE IF NOT EXISTS channels (
    id       INTEGER PRIMARY KEY,
    name     TEXT NOT NULL,
    type     TEXT NOT NULL CHECK (type IN ('text', 'voice')),
    position INTEGER NOT NULL DEFAULT 0
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
  CREATE TABLE IF NOT EXISTS emojis (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
    mime       TEXT NOT NULL,
    data       BLOB NOT NULL,
    created_by INTEGER
  );

  CREATE TABLE IF NOT EXISTS sounds (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,
    icon       TEXT NOT NULL,
    mime       TEXT NOT NULL,
    data       BLOB NOT NULL,
    created_by INTEGER
  );
`);

// Colunas que chegaram depois da primeira versão: bancos antigos ganham elas na inicialização.
function addColumnIfMissing(table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
addColumnIfMissing('users', 'is_admin', 'INTEGER NOT NULL DEFAULT 0');
addColumnIfMissing('channels', 'created_by', 'INTEGER');
// Muda a cada troca de avatar; entra na URL da imagem para o navegador buscar a nova. null = sem avatar.
addColumnIfMissing('users', 'avatar_version', 'INTEGER');

// O emoji ":f:" do primeiro pacote tinha 1 letra, abaixo do mínimo de 2, e não funcionava nas mensagens.
if (!db.prepare("SELECT 1 FROM emojis WHERE name = 'pressf'").get()) {
  db.prepare("UPDATE emojis SET name = 'pressf' WHERE name = 'f' AND created_by IS NULL").run();
}

// Banco que já tinha usuários antes de existir administrador: o mais antigo assume.
if (!db.prepare('SELECT 1 FROM users WHERE is_admin = 1').get()) {
  db.exec('UPDATE users SET is_admin = 1 WHERE id = (SELECT MIN(id) FROM users)');
}

const { n: channelCount } = db.prepare('SELECT COUNT(*) AS n FROM channels').get() as { n: number };
if (channelCount === 0) {
  const insert = db.prepare('INSERT INTO channels (name, type, position) VALUES (?, ?, ?)');
  insert.run('geral', 'text', 0);
  insert.run('jogos', 'text', 1);
  insert.run('Sala 1', 'voice', 2);
  insert.run('Sala 2', 'voice', 3);
}

const userColumns = 'id, username, is_admin AS isAdmin, avatar_version AS avatarVersion';

type UserRow = { id: number; username: string; isAdmin: number; avatarVersion: number | null };

function toUser(row: UserRow | undefined): User | undefined {
  return row && { id: row.id, username: row.username, isAdmin: row.isAdmin === 1, avatarVersion: row.avatarVersion };
}

export function findUserByName(username: string) {
  const row = db
    .prepare(`SELECT ${userColumns}, password_hash AS passwordHash FROM users WHERE username = ?`)
    .get(username) as (UserRow & { passwordHash: string }) | undefined;
  return row && { ...toUser(row)!, passwordHash: row.passwordHash };
}

export function listPublicUsers(): PublicUser[] {
  return db.prepare('SELECT id, username, avatar_version AS avatarVersion FROM users ORDER BY id').all() as unknown as PublicUser[];
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

export function listEmojis(): Emoji[] {
  return db.prepare('SELECT id, name, created_by AS createdBy FROM emojis ORDER BY name').all() as unknown as Emoji[];
}

export function findEmoji(id: number) {
  return db.prepare('SELECT id, name, created_by AS createdBy FROM emojis WHERE id = ?').get(id) as Emoji | undefined;
}

export function emojiNameTaken(name: string) {
  return !!db.prepare('SELECT 1 FROM emojis WHERE name = ?').get(name);
}

export function createEmoji(name: string, mime: string, data: Buffer, createdBy: number | null): Emoji {
  const result = db.prepare('INSERT INTO emojis (name, mime, data, created_by) VALUES (?, ?, ?, ?)').run(name, mime, data, createdBy);
  return findEmoji(Number(result.lastInsertRowid))!;
}

export function deleteEmoji(id: number) {
  db.prepare('DELETE FROM emojis WHERE id = ?').run(id);
}

export function findEmojiFile(id: number) {
  return db.prepare('SELECT mime, data FROM emojis WHERE id = ?').get(id) as { mime: string; data: Uint8Array } | undefined;
}

export function listSounds(): Sound[] {
  return db.prepare('SELECT id, name, icon, created_by AS createdBy FROM sounds ORDER BY id').all() as unknown as Sound[];
}

export function findSound(id: number) {
  return db.prepare('SELECT id, name, icon, created_by AS createdBy FROM sounds WHERE id = ?').get(id) as Sound | undefined;
}

export function createSound(name: string, icon: string, mime: string, data: Buffer, createdBy: number | null): Sound {
  const result = db
    .prepare('INSERT INTO sounds (name, icon, mime, data, created_by) VALUES (?, ?, ?, ?, ?)')
    .run(name, icon, mime, data, createdBy);
  return findSound(Number(result.lastInsertRowid))!;
}

export function deleteSound(id: number) {
  db.prepare('DELETE FROM sounds WHERE id = ?').run(id);
}

/** Remove os sons do pacote de demonstração (os que ninguém enviou), para trocar por uma versão nova. */
export function deletePackSounds() {
  db.prepare('DELETE FROM sounds WHERE created_by IS NULL').run();
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

/** O primeiro cadastro do servidor vira administrador. */
export function createUser(username: string, passwordHash: string): User {
  const result = db
    .prepare('INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, NOT EXISTS (SELECT 1 FROM users))')
    .run(username, passwordHash);
  return findUserById(Number(result.lastInsertRowid))!;
}

export function updatePassword(userId: number, passwordHash: string) {
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, userId);
}

const channelColumns = 'id, name, type, position, created_by AS createdBy';

export function listChannels() {
  return db.prepare(`SELECT ${channelColumns} FROM channels ORDER BY position, id`).all() as unknown as Channel[];
}

export function findChannel(id: number) {
  return db.prepare(`SELECT ${channelColumns} FROM channels WHERE id = ?`).get(id) as Channel | undefined;
}

export function createChannel(name: string, type: ChannelType, createdBy: number): Channel {
  const { next } = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM channels').get() as { next: number };
  const result = db
    .prepare('INSERT INTO channels (name, type, position, created_by) VALUES (?, ?, ?, ?)')
    .run(name, type, next, createdBy);
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

export function countChannels(type: ChannelType) {
  return (db.prepare('SELECT COUNT(*) AS n FROM channels WHERE type = ?').get(type) as { n: number }).n;
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
