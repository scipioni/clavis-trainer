/** Minimo indispensabile della Bot API di Telegram, dietro un'interfaccia sostituibile nei test. */

export interface TgUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  username?: string;
}

export interface TgMessage {
  message_id: number;
  chat: { id: number };
  from?: TgUser;
  text?: string;
}

export interface TgCallbackQuery {
  id: string;
  from: TgUser;
  message?: TgMessage;
  data?: string;
}

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
}

export interface InlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export class TelegramError extends Error {
  constructor(
    readonly method: string,
    readonly code: number,
    description: string,
  ) {
    super(`${method}: ${code} ${description}`);
  }
}

export interface TelegramApi {
  call<T = unknown>(method: string, params?: Record<string, unknown>, signal?: AbortSignal): Promise<T>;
}

export class HttpTelegramApi implements TelegramApi {
  constructor(
    private readonly token: string,
    private readonly base = 'https://api.telegram.org',
  ) {}

  async call<T>(method: string, params: Record<string, unknown> = {}, signal?: AbortSignal): Promise<T> {
    const res = await fetch(`${this.base}/bot${this.token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(params),
      signal,
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; error_code?: number; description?: string };
    if (!body.ok) throw new TelegramError(method, body.error_code ?? res.status, body.description ?? res.statusText);
    return body.result as T;
  }
}

/**
 * Bot finto: registra le chiamate e risponde come Telegram. `push` simula un
 * messaggio o un pulsante premuto da un utente.
 */
export class FakeTelegramApi implements TelegramApi {
  readonly calls: { method: string; params: Record<string, unknown> }[] = [];
  private queue: TgUpdate[] = [];
  private nextUpdate = 1;
  private nextMessage = 100;
  private waiters: (() => void)[] = [];
  readonly profile: Record<string, string> = {};

  constructor(readonly username = 'clavis_test_bot') {}

  push(u: Omit<TgUpdate, 'update_id'>) {
    this.queue.push({ ...u, update_id: this.nextUpdate++ });
    for (const w of this.waiters.splice(0)) w();
  }

  sent(method: string) {
    return this.calls.filter((c) => c.method === method).map((c) => c.params);
  }

  async call<T>(method: string, params: Record<string, unknown> = {}, signal?: AbortSignal): Promise<T> {
    this.calls.push({ method, params });
    switch (method) {
      case 'getMe':
        return { id: 1, is_bot: true, first_name: 'clavis-trainer', username: this.username } as T;
      case 'getUpdates': {
        const offset = (params.offset as number) ?? 0;
        this.queue = this.queue.filter((u) => u.update_id >= offset);
        if (this.queue.length === 0 && (params.timeout as number) > 0) {
          await new Promise<void>((resolve) => {
            this.waiters.push(resolve);
            signal?.addEventListener('abort', () => resolve());
            setTimeout(resolve, Math.min((params.timeout as number) * 1000, 200));
          });
        }
        return [...this.queue] as T;
      }
      case 'sendMessage':
        return { message_id: this.nextMessage++, chat: { id: params.chat_id }, text: params.text } as T;
      case 'getMyName':
        return { name: this.profile.name ?? '' } as T;
      case 'getMyDescription':
        return { description: this.profile.description ?? '' } as T;
      case 'getMyShortDescription':
        return { short_description: this.profile.short_description ?? '' } as T;
      case 'setMyName':
      case 'setMyDescription':
      case 'setMyShortDescription': {
        const [k, v] = Object.entries(params)[0] ?? [];
        if (k) this.profile[k] = String(v);
        return true as T;
      }
      default:
        return true as T;
    }
  }
}
