import type { Settings, StoredSession } from '../core/data';

export interface AccountUser {
  id: number;
  first_name: string;
  username?: string;
}

export interface ServerConfig {
  telegram: boolean;
  bot: string | null;
}

export interface LoginStart {
  id: string;
  code: string;
  pollSecret: string;
  expiresAt: number;
  url: string;
}

export type PollStatus = 'pending' | 'approved' | 'denied' | 'expired' | 'unknown';

export interface SyncRequest {
  upload: StoredSession[];
  cursor: number;
  settings?: { value: Settings; updatedAt: number };
}

export interface SyncResponse {
  accepted: number;
  sessions: StoredSession[];
  cursor: number;
  hasMore: boolean;
  settings: { value: Settings; updatedAt: number } | null;
}

/** Server irraggiungibile (offline, o sito servito senza API). */
export class OfflineError extends Error {}
/** Sessione del browser assente o scaduta. */
export class UnauthorizedError extends Error {}
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Contratto dell'API, implementato via HTTP e da un finto nei test. */
export interface AccountApi {
  config(): Promise<ServerConfig>;
  me(): Promise<AccountUser>;
  startLogin(): Promise<LoginStart>;
  pollLogin(id: string, pollSecret: string): Promise<{ status: PollStatus; user?: AccountUser }>;
  logout(): Promise<void>;
  sync(req: SyncRequest): Promise<SyncResponse>;
  deleteData(): Promise<void>;
}

export class HttpAccountApi implements AccountApi {
  constructor(private readonly base = './api') {}

  private async req<T>(method: string, path: string, body?: unknown): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.base}${path}`, {
        method,
        credentials: 'same-origin',
        headers: { 'x-clavis': '1', ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new OfflineError('server non raggiungibile');
    }
    if (res.status === 401) throw new UnauthorizedError('non connesso');
    const type = res.headers.get('content-type') ?? '';
    // un sito senza API risponde con index.html o 404/502: lo tratto come assenza del server
    if (!type.includes('application/json')) throw new OfflineError(`API non disponibile (${res.status})`);
    const data = (await res.json()) as T & { error?: string };
    if (!res.ok) throw new ApiError(res.status, data.error ?? `errore ${res.status}`);
    return data;
  }

  config() {
    return this.req<ServerConfig>('GET', '/config');
  }
  async me() {
    return (await this.req<{ user: AccountUser }>('GET', '/me')).user;
  }
  startLogin() {
    return this.req<LoginStart>('POST', '/auth/start');
  }
  pollLogin(id: string, pollSecret: string) {
    return this.req<{ status: PollStatus; user?: AccountUser }>('POST', '/auth/poll', { id, pollSecret });
  }
  async logout() {
    await this.req('POST', '/auth/logout');
  }
  sync(req: SyncRequest) {
    return this.req<SyncResponse>('POST', '/sync', req);
  }
  async deleteData() {
    await this.req('DELETE', '/data');
  }
}
