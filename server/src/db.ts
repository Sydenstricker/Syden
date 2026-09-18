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

export function createMessage(channelId: number, userId: number, content: string): Message {
  const result = db
    .prepare('INSERT INTO messages (channel_id, user_id, content) VALUES (?, ?, ?)')
    .run(channelId, userId, content);
  const row = db.prepare(`${messageSelect} WHERE m.id = ?`).get(result.lastInsertRowid) as unknown as MessageRow;
  return toMessage(row);
}
