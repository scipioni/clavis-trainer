import type { ServerDB } from './db';
import { isUsable } from './auth';
import { TelegramError, type InlineButton, type TelegramApi, type TgUpdate } from './telegram';

export interface BotOptions {
  publicUrl: string;
  now?: () => number;
  log?: (msg: string) => void;
}

type BotLang = 'it' | 'en';

/** Lingua dei messaggi: italiano per chi usa Telegram in italiano, altrimenti inglese. */
export function botLang(languageCode?: string): BotLang {
  return languageCode?.toLowerCase().startsWith('it') ? 'it' : 'en';
}

/** Testi del bot nelle due lingue. */
const TEXT = {
  it: {
    name: 'clavis-trainer',
    description:
      'Bot di accesso a clavis-trainer, il trainer di digitazione per la tastiera clavis e le tastiere classiche. ' +
      'Per accedere premi "Accedi con Telegram" sul sito: qui ti arriverà un codice da confermare.',
    short: 'Accesso a clavis-trainer: conferma il codice mostrato dal sito.',
    command: 'Come accedere a clavis-trainer',
    help: (url: string) =>
      `Questo bot serve ad accedere a clavis-trainer.\n\nApri ${url}, premi "Accedi con Telegram" e segui il link: qui ti chiederò di confermare il codice mostrato dal sito.`,
    invalidLink: 'Questo link di accesso non è più valido. Torna sul sito e premi di nuovo "Accedi con Telegram".',
    request: (code: string) =>
      `Richiesta di accesso a clavis-trainer.\n\nCodice: ${code}\n\nConferma solo se lo stesso codice è sul sito che hai davanti. ` +
      'Se non hai chiesto tu di accedere, premi Annulla: qualcuno sta provando a usare il tuo account.',
    confirm: '✅ Conferma',
    cancel: 'Annulla',
    unknownButton: 'Pulsante non riconosciuto',
    expiredShort: 'Richiesta scaduta o già usata',
    expiredLong: 'Questo link di accesso non è più valido.',
    confirmed: (code: string, url: string) => `✅ Accesso confermato (codice ${code}). Puoi tornare su ${url}`,
    confirmedShort: 'Accesso confermato',
    cancelled: 'Accesso annullato. Nessun browser è stato collegato al tuo account.',
    cancelledShort: 'Accesso annullato',
  },
  en: {
    name: 'clavis-trainer',
    description:
      'Sign-in bot for clavis-trainer, the typing trainer for the clavis keyboard and standard keyboards. ' +
      'To sign in, press "Sign in with Telegram" on the website: you will get a code to confirm here.',
    short: 'Sign in to clavis-trainer: confirm the code shown on the website.',
    command: 'How to sign in to clavis-trainer',
    help: (url: string) =>
      `This bot is used to sign in to clavis-trainer.\n\nOpen ${url}, press "Sign in with Telegram" and follow the link: here I will ask you to confirm the code shown on the website.`,
    invalidLink: 'This sign-in link is no longer valid. Go back to the website and press "Sign in with Telegram" again.',
    request: (code: string) =>
      `Sign-in request for clavis-trainer.\n\nCode: ${code}\n\nConfirm only if the same code is on the website in front of you. ` +
      'If you did not ask to sign in, press Cancel: someone is trying to use your account.',
    confirm: '✅ Confirm',
    cancel: 'Cancel',
    unknownButton: 'Unknown button',
    expiredShort: 'Request expired or already used',
    expiredLong: 'This sign-in link is no longer valid.',
    confirmed: (code: string, url: string) => `✅ Sign-in confirmed (code ${code}). You can go back to ${url}`,
    confirmedShort: 'Sign-in confirmed',
    cancelled: 'Sign-in cancelled. No browser was connected to your account.',
    cancelledShort: 'Sign-in cancelled',
  },
} as const;

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

  /**
   * Nome, descrizioni e comandi: in inglese come predefinito e in italiano per
   * `language_code: it`. Si aggiornano solo se diversi, per non incappare nei
   * limiti di Telegram.
   */
  async present() {
    for (const [lang, code] of [['en', undefined], ['it', 'it']] as const) {
      const tx = TEXT[lang];
      const lc = code ? { language_code: code } : {};
      const steps: [string, string, string, string][] = [
        ['getMyName', 'name', 'setMyName', tx.name],
        ['getMyDescription', 'description', 'setMyDescription', tx.description],
        ['getMyShortDescription', 'short_description', 'setMyShortDescription', tx.short],
      ];
      for (const [get, field, set, value] of steps) {
        try {
          const cur = await this.api.call<Record<string, string>>(get, lc);
          if (cur[field] !== value) await this.api.call(set, { [field]: value, ...lc });
        } catch (e) {
          this.log(`${set} (${lang}) non riuscito: ${(e as Error).message}`);
        }
      }
      try {
        await this.api.call('setMyCommands', { commands: [{ command: 'start', description: tx.command }], ...lc });
      } catch (e) {
        this.log(`setMyCommands (${lang}) non riuscito: ${(e as Error).message}`);
      }
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

  private async onStart(chatId: number, from: { id: number; first_name: string; username?: string; language_code?: string }, payload?: string) {
    const tx = TEXT[botLang(from.language_code)];
    if (!payload) {
      await this.send(chatId, tx.help(this.opts.publicUrl));
      return;
    }
    const now = this.now();
    const r = this.db.getLogin(payload);
    if (!isUsable(r, now) || (r.tgUserId !== null && r.tgUserId !== from.id)) {
      await this.send(chatId, tx.invalidLink);
      return;
    }
    const msg = await this.send(chatId, tx.request(r.code), [
      [{ text: tx.confirm, callback_data: `ok:${r.id}` }, { text: tx.cancel, callback_data: `no:${r.id}` }],
    ]);
    this.db.updateLogin(r.id, { tgUserId: from.id, chatId, messageId: msg.message_id });
  }

  private async onButton(q: NonNullable<TgUpdate['callback_query']>) {
    const tx = TEXT[botLang(q.from.language_code)];
    const m = /^(ok|no):(.+)$/.exec(q.data ?? '');
    const answer = (text: string) => this.api.call('answerCallbackQuery', { callback_query_id: q.id, text }).catch(() => {});
    if (!m) return answer(tx.unknownButton);
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
      await edit(tx.expiredLong);
      return answer(tx.expiredShort);
    }
    if (action === 'ok') {
      this.db.upsertUser({ id: q.from.id, first_name: q.from.first_name, username: q.from.username }, now);
      this.db.updateLogin(id, { status: 'approved' });
      await edit(tx.confirmed(r.code, this.opts.publicUrl));
      return answer(tx.confirmedShort);
    }
    this.db.updateLogin(id, { status: 'denied' });
    await edit(tx.cancelled);
    return answer(tx.cancelledShort);
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
