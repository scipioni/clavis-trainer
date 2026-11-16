import type { ServerDB } from './db';
import { isUsable } from './auth';
import { TelegramError, type InlineButton, type TelegramApi, type TgUpdate } from './telegram';

export interface BotOptions {
  publicUrl: string;
  now?: () => number;
  log?: (msg: string) => void;
}

const PROFILE = {
  name: 'clavis-trainer',
  description:
    'Bot di accesso a clavis-trainer, il trainer di digitazione per la tastiera clavis. ' +
    'Per accedere premi "Accedi con Telegram" sul sito: qui ti arriverà un codice da confermare.',
  short_description: 'Accesso a clavis-trainer: conferma il codice mostrato dal sito.',
};

const OFFSET_KEY = 'telegram_offset';

/**
 * Bot di accesso: riceve `/start <id>` dal link del sito, mostra il codice e
 * chiede conferma con due pulsanti. Gli aggiornamenti arrivano in long polling.
 */
export class LoginBot {
  username: string | null = null;
  private running = false;
  private abort: AbortController | null = null;
  private readonly now: () => number;
  private readonly log: (msg: string) => void;

  constructor(
    private readonly api: TelegramApi,
    private readonly db: ServerDB,
    private readonly opts: BotOptions,
  ) {
    this.now = opts.now ?? Date.now;
    this.log = opts.log ?? ((m) => console.log(`[bot] ${m}`));
  }

  get ready(): boolean {
    return this.username !== null;
  }

  link(id: string): string {
    return `https://t.me/${this.username}?start=${id}`;
  }

  /** Verifica il token e prende lo username del bot. */
  async init(): Promise<boolean> {
    try {
      const me = await this.api.call<{ username: string }>('getMe');
      this.username = me.username;
      this.log(`attivo come @${me.username}`);
      return true;
    } catch (e) {
      this.log(`token non valido o Telegram irraggiungibile: ${(e as Error).message}`);
      return false;
    }
  }

  /** Nome, descrizioni e comandi: si aggiornano solo se diversi, per non incappare nei limiti di Telegram. */
  async present() {
    const steps: [string, string, string, string][] = [
      ['getMyName', 'name', 'setMyName', PROFILE.name],
      ['getMyDescription', 'description', 'setMyDescription', PROFILE.description],
      ['getMyShortDescription', 'short_description', 'setMyShortDescription', PROFILE.short_description],
    ];
    for (const [get, field, set, value] of steps) {
      try {
        const cur = await this.api.call<Record<string, string>>(get);
        if (cur[field] !== value) await this.api.call(set, { [field]: value });
      } catch (e) {
        this.log(`${set} non riuscito: ${(e as Error).message}`);
      }
    }
    try {
      await this.api.call('setMyCommands', { commands: [{ command: 'start', description: 'Come accedere a clavis-trainer' }] });
    } catch (e) {
      this.log(`setMyCommands non riuscito: ${(e as Error).message}`);
    }
  }

  private async send(chatId: number, text: string, buttons?: InlineButton[][]) {
    return this.api.call<{ message_id: number }>('sendMessage', {
      chat_id: chatId,
      text,
      ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}),
    });
  }

  async handle(u: TgUpdate): Promise<void> {
    if (u.message?.text && u.message.from) {
      const m = /^\/start(?:@\w+)?(?:\s+(\S+))?/.exec(u.message.text);
      if (m) await this.onStart(u.message.chat.id, u.message.from, m[1]);
      return;
    }
    if (u.callback_query) await this.onButton(u.callback_query);
  }

  private async onStart(chatId: number, from: { id: number; first_name: string; username?: string }, payload?: string) {
    if (!payload) {
      await this.send(
        chatId,
        `Questo bot serve ad accedere a clavis-trainer.\n\nApri ${this.opts.publicUrl}, premi "Accedi con Telegram" e segui il link: qui ti chiederò di confermare il codice mostrato dal sito.`,
      );
      return;
    }
    const now = this.now();
    const r = this.db.getLogin(payload);
    if (!isUsable(r, now) || (r.tgUserId !== null && r.tgUserId !== from.id)) {
      await this.send(chatId, 'Questo link di accesso non è più valido. Torna sul sito e premi di nuovo "Accedi con Telegram".');
      return;
    }
    const msg = await this.send(
      chatId,
      `Richiesta di accesso a clavis-trainer.\n\nCodice: ${r.code}\n\nConferma solo se lo stesso codice è sul sito che hai davanti. ` +
        'Se non hai chiesto tu di accedere, premi Annulla: qualcuno sta provando a usare il tuo account.',
      [[{ text: '✅ Conferma', callback_data: `ok:${r.id}` }, { text: 'Annulla', callback_data: `no:${r.id}` }]],
    );
    this.db.updateLogin(r.id, { tgUserId: from.id, chatId, messageId: msg.message_id });
  }

  private async onButton(q: NonNullable<TgUpdate['callback_query']>) {
    const m = /^(ok|no):(.+)$/.exec(q.data ?? '');
    const answer = (text: string) => this.api.call('answerCallbackQuery', { callback_query_id: q.id, text }).catch(() => {});
    if (!m) return answer('Pulsante non riconosciuto');
    const [, action, id] = m;
    const r = this.db.getLogin(id);
    const now = this.now();
    const edit = (text: string) =>
      q.message
        ? this.api
            .call('editMessageText', { chat_id: q.message.chat.id, message_id: q.message.message_id, text })
            .catch(() => {})
        : Promise.resolve();
    if (!isUsable(r, now) || r.tgUserId !== q.from.id) {
      await edit('Questo link di accesso non è più valido.');
      return answer('Richiesta scaduta o già usata');
    }
    if (action === 'ok') {
      this.db.upsertUser({ id: q.from.id, first_name: q.from.first_name, username: q.from.username }, now);
      this.db.updateLogin(id, { status: 'approved' });
      await edit(`✅ Accesso confermato (codice ${r.code}). Puoi tornare su ${this.opts.publicUrl}`);
      return answer('Accesso confermato');
    }
    this.db.updateLogin(id, { status: 'denied' });
    await edit('Accesso annullato. Nessun browser è stato collegato al tuo account.');
    return answer('Accesso annullato');
  }

  /** Un giro di getUpdates: elabora gli update e salva l'offset. */
  async pollOnce(timeoutSec = 30): Promise<number> {
    const offset = Number(this.db.kvGet(OFFSET_KEY) ?? 0);
    this.abort = new AbortController();
    const updates = await this.api.call<TgUpdate[]>(
      'getUpdates',
      { offset, timeout: timeoutSec, allowed_updates: ['message', 'callback_query'] },
      this.abort.signal,
    );
    for (const u of updates) {
      try {
        await this.handle(u);
      } catch (e) {
        this.log(`update ${u.update_id}: ${(e as Error).message}`);
      }
      this.db.kvSet(OFFSET_KEY, String(u.update_id + 1));
    }
    return updates.length;
  }

  /** Ciclo di long polling con attesa crescente sugli errori (409 = un altro processo usa lo stesso bot). */
  async run() {
    this.running = true;
    let backoff = 1000;
    while (this.running) {
      try {
        await this.pollOnce();
        backoff = 1000;
      } catch (e) {
        if (!this.running) break;
        const conflict = e instanceof TelegramError && e.code === 409;
        this.log(`${conflict ? 'conflitto: un altro processo usa questo bot' : 'errore'}: ${(e as Error).message}; riprovo tra ${backoff / 1000}s`);
        await Bun.sleep(backoff);
        backoff = Math.min(backoff * 2, 60_000);
      }
    }
  }

  stop() {
    this.running = false;
    this.abort?.abort();
  }
}
