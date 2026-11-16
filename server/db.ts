import { Database } from 'bun:sqlite';
import type { Settings, StoredSession } from '../src/core/data';

export interface TelegramUser {
  id: number;
  first_name: string;
  username?: string;
}

export type LoginStatus = 'pending' | 'approved' | 'denied';

export interface LoginRequest {
  id: string;
  code: string;
  pollHash: string;
  status: LoginStatus;
  createdAt: number;
  expiresAt: number;
  /** Utente Telegram che ha aperto il link (prima della conferma). */
  tgUserId: number | null;
  chatId: number | null;
  messageId: number | null;
}

export interface AuthSession {
  tokenHash: string;
  userId: number;
  createdAt: number;
  lastSeen: number;
}

export interface SyncPage {
  sessions: StoredSession[];
  cursor: number;
  hasMore: boolean;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  first_name TEXT NOT NULL,
  username TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS login_requests (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  poll_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  tg_user_id INTEGER,
  chat_id INTEGER,
  message_id INTEGER
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  data TEXT NOT NULL,
  UNIQUE (user_id, id)
);
CREATE TABLE IF NOT EXISTS settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

/** Durata di una sessione del browser non usata. */
export const AUTH_TTL_MS = 180 * 24 * 3600 * 1000;

interface LoginRow {
  id: string;
  code: string;
  poll_hash: string;
  status: LoginStatus;
  created_at: number;
  expires_at: number;
  tg_user_id: number | null;
  chat_id: number | null;
  message_id: number | null;
}

const toLogin = (r: LoginRow): LoginRequest => ({
  id: r.id,
  code: r.code,
  pollHash: r.poll_hash,
  status: r.status,
  createdAt: r.created_at,
  expiresAt: r.expires_at,
  tgUserId: r.tg_user_id,
  chatId: r.chat_id,
  messageId: r.message_id,
});

export class ServerDB {
  readonly db: Database;

  constructor(path = ':memory:') {
    this.db = new Database(path, { create: true, strict: true });
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    this.db.exec(SCHEMA);
  }

  close() {
    this.db.close();
  }

  // --- utenti -----------------------------------------------------------------

  upsertUser(u: TelegramUser, now: number) {
    this.db
      .query(
        `INSERT INTO users (id, first_name, username, created_at) VALUES ($id, $first, $username, $now)
         ON CONFLICT(id) DO UPDATE SET first_name = excluded.first_name, username = excluded.username`,
      )
      .run({ id: u.id, first: u.first_name, username: u.username ?? null, now });
  }

  getUser(id: number): TelegramUser | null {
    const r = this.db.query('SELECT id, first_name, username FROM users WHERE id = ?').get(id) as
      | { id: number; first_name: string; username: string | null }
      | null;
    return r ? { id: r.id, first_name: r.first_name, username: r.username ?? undefined } : null;
  }

  // --- richieste di accesso -----------------------------------------------------

  createLogin(r: Pick<LoginRequest, 'id' | 'code' | 'pollHash' | 'createdAt' | 'expiresAt'>) {
    this.db
      .query(
        `INSERT INTO login_requests (id, code, poll_hash, status, created_at, expires_at)
         VALUES ($id, $code, $poll, 'pending', $created, $expires)`,
      )
      .run({ id: r.id, code: r.code, poll: r.pollHash, created: r.createdAt, expires: r.expiresAt });
  }

  getLogin(id: string): LoginRequest | null {
    const r = this.db.query('SELECT * FROM login_requests WHERE id = ?').get(id) as LoginRow | null;
    return r ? toLogin(r) : null;
  }

  updateLogin(id: string, patch: Partial<Pick<LoginRequest, 'status' | 'tgUserId' | 'chatId' | 'messageId'>>) {
    const cur = this.getLogin(id);
    if (!cur) return;
    const next = { ...cur, ...patch };
    this.db
      .query('UPDATE login_requests SET status = $status, tg_user_id = $tg, chat_id = $chat, message_id = $msg WHERE id = $id')
      .run({ id, status: next.status, tg: next.tgUserId, chat: next.chatId, msg: next.messageId });
  }

  deleteLogin(id: string) {
    this.db.query('DELETE FROM login_requests WHERE id = ?').run(id);
  }

  // --- sessioni del browser -----------------------------------------------------

  createAuth(tokenHash: string, userId: number, now: number) {
    this.db
      .query('INSERT INTO auth_sessions (token_hash, user_id, created_at, last_seen) VALUES (?, ?, ?, ?)')
      .run(tokenHash, userId, now, now);
  }

  getAuth(tokenHash: string): AuthSession | null {
    const r = this.db.query('SELECT * FROM auth_sessions WHERE token_hash = ?').get(tokenHash) as
      | { token_hash: string; user_id: number; created_at: number; last_seen: number }
      | null;
    return r ? { tokenHash: r.token_hash, userId: r.user_id, createdAt: r.created_at, lastSeen: r.last_seen } : null;
  }

  touchAuth(tokenHash: string, now: number) {
    this.db.query('UPDATE auth_sessions SET last_seen = ? WHERE token_hash = ?').run(now, tokenHash);
  }

  deleteAuth(tokenHash: string) {
    this.db.query('DELETE FROM auth_sessions WHERE token_hash = ?').run(tokenHash);
  }

  // --- storico ------------------------------------------------------------------

  /** Inserisce le sessioni ignorando quelle già presenti; restituisce quante sono nuove. */
  insertSessions(userId: number, sessions: StoredSession[]): number {
    const stmt = this.db.query(
      'INSERT OR IGNORE INTO sessions (user_id, id, started_at, data) VALUES (?, ?, ?, ?)',
    );
    let added = 0;
    this.db.transaction(() => {
      for (const s of sessions) added += stmt.run(userId, s.id, s.startedAt, JSON.stringify(s)).changes;
    })();
    return added;
  }

  sessionsAfter(userId: number, cursor: number, limit: number): SyncPage {
    const rows = this.db
      .query('SELECT seq, data FROM sessions WHERE user_id = ? AND seq > ? ORDER BY seq LIMIT ?')
      .all(userId, cursor, limit + 1) as { seq: number; data: string }[];
    const page = rows.slice(0, limit);
    return {
      sessions: page.map((r) => JSON.parse(r.data) as StoredSession),
      cursor: page.length ? page[page.length - 1].seq : cursor,
      hasMore: rows.length > limit,
    };
  }

  countSessions(userId: number): number {
    return (this.db.query('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?').get(userId) as { n: number }).n;
  }

  // --- impostazioni -------------------------------------------------------------

  getSettings(userId: number): { value: Settings; updatedAt: number } | null {
    const r = this.db.query('SELECT data, updated_at FROM settings WHERE user_id = ?').get(userId) as
      | { data: string; updated_at: number }
      | null;
    return r ? { value: JSON.parse(r.data) as Settings, updatedAt: r.updated_at } : null;
  }

  /** Salva le impostazioni solo se più recenti di quelle presenti (vince l'ultima modifica). */
  putSettings(userId: number, value: Settings, updatedAt: number) {
    this.db
      .query(
        `INSERT INTO settings (user_id, data, updated_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
         WHERE excluded.updated_at > settings.updated_at`,
      )
      .run(userId, JSON.stringify(value), updatedAt);
  }

  /** Cancella storico e impostazioni dell'utente (non l'account né le sessioni del browser). */
  deleteUserData(userId: number) {
    this.db.transaction(() => {
      this.db.query('DELETE FROM sessions WHERE user_id = ?').run(userId);
      this.db.query('DELETE FROM settings WHERE user_id = ?').run(userId);
    })();
  }

  // --- varie --------------------------------------------------------------------

  kvGet(key: string): string | null {
    const r = this.db.query('SELECT value FROM kv WHERE key = ?').get(key) as { value: string } | null;
    return r?.value ?? null;
  }

  kvSet(key: string, value: string) {
    this.db.query('INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
  }

  /** Rimuove richieste di accesso scadute e sessioni del browser inutilizzate. */
  cleanup(now: number): { logins: number; auth: number } {
    const logins = this.db.query('DELETE FROM login_requests WHERE expires_at < ?').run(now - 3600_000).changes;
    const auth = this.db.query('DELETE FROM auth_sessions WHERE last_seen < ?').run(now - AUTH_TTL_MS).changes;
    return { logins, auth };
  }
}
