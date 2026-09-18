import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

export type ChannelType = 'text' | 'voice';

export interface User {
  id: number;
  username: string;
}

export interface Channel {
  id: number;
  name: string;
  type: ChannelType;
  position: number;
}

export interface Message {
  id: number;
  channelId: number;
  content: string;
  createdAt: string;
  author: User;
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
`);

const { n: channelCount } = db.prepare('SELECT COUNT(*) AS n FROM channels').get() as { n: number };
if (channelCount === 0) {
  const insert = db.prepare('INSERT INTO channels (name, type, position) VALUES (?, ?, ?)');
  insert.run('geral', 'text', 0);
  insert.run('jogos', 'text', 1);
  insert.run('Sala 1', 'voice', 2);
  insert.run('Sala 2', 'voice', 3);
}

export function findUserByName(username: string) {
  return db
    .prepare('SELECT id, username, password_hash AS passwordHash FROM users WHERE username = ?')
    .get(username) as (User & { passwordHash: string }) | undefined;
}

export function findUserById(id: number) {
  return db.prepare('SELECT id, username FROM users WHERE id = ?').get(id) as User | undefined;
}

export function createUser(username: string, passwordHash: string): User {
  const result = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)').run(username, passwordHash);
  return { id: Number(result.lastInsertRowid), username };
}

export function listChannels() {
  return db.prepare('SELECT id, name, type, position FROM channels ORDER BY position, id').all() as unknown as Channel[];
}

export function findChannel(id: number) {
  return db.prepare('SELECT id, name, type, position FROM channels WHERE id = ?').get(id) as Channel | undefined;
}

export function createChannel(name: string, type: ChannelType): Channel {
  const { next } = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS next FROM channels').get() as { next: number };
  const result = db.prepare('INSERT INTO channels (name, type, position) VALUES (?, ?, ?)').run(name, type, next);
  return { id: Number(result.lastInsertRowid), name, type, position: next };
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

export function createMessage(channelId: number, userId: number, content: string): Message {
  const result = db
    .prepare('INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)')
    .run(channelId, userId, content);
  const row = db.prepare(`${messageSelect} WHERE m.id = ?`).get(result.lastInsertRowid) as unknown as MessageRow;
  return toMessage(row);
}
