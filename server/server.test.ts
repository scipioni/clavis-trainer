import { describe, expect, test, beforeEach } from 'bun:test';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ServerDB, AUTH_TTL_MS } from './db';
import { LoginBot } from './bot';
import { createApp, COOKIE, MAX_UPLOAD } from './app';
import { FakeTelegramApi } from './telegram';
import { LOGIN_TTL_MS } from './auth';
import { computeResult } from '../src/core/session/result';
import type { Sample } from '../src/core/session/session';
import { DEFAULT_SETTINGS, type StoredSession } from '../src/core/data';

const SITE = 'https://clavis.example';
const ALICE = { id: 111, first_name: 'Alice', username: 'alice', language_code: 'it' };
const BOB = { id: 222, first_name: 'Bob', language_code: 'en-GB' };

function session(id: string, startedAt = 1000): StoredSession {
  const samples: Sample[] = Array.from({ length: 5 }, (_, i) => ({
    i, char: 'ciao!'[i], prev: i ? 'ciao!'[i - 1] : null, ms: i ? 150 : null, errors: 0, wrong: [], deadErrors: 0, modMisfires: 0,
  }));
  return { id, startedAt, mode: 'adaptive', durationMs: null, status: 'completed', deadKeys: true, samples, result: computeResult(samples, 600) };
}

let clock = 1_800_000_000_000;
let db: ServerDB;
let tg: FakeTelegramApi;
let bot: LoginBot;
let app: ReturnType<typeof createApp>;
let staticDir: string;

beforeEach(async () => {
  clock = 1_800_000_000_000;
  db = new ServerDB();
  tg = new FakeTelegramApi();
  bot = new LoginBot(tg, db, { publicUrl: SITE, now: () => clock, log: () => {} });
  await bot.init();
  staticDir = mkdtempSync(join(tmpdir(), 'clavis-static-'));
  mkdirSync(join(staticDir, 'assets'));
  mkdirSync(join(staticDir, 'corpus'));
  writeFileSync(join(staticDir, 'index.html'), '<!doctype html><title>clavis</title>');
  writeFileSync(join(staticDir, 'assets', 'app-abc.js'), 'console.log(1)');
  writeFileSync(join(staticDir, 'corpus', 'words.json'), '{"words":[]}');
  writeFileSync(join(staticDir, 'corpus', 'words.json.gz'), Bun.gzipSync('{"words":[]}'));
  app = createApp({ db, bot, publicUrl: SITE, staticDir, now: () => clock });
});

/** Richiesta come la fa l'app: header X-Clavis, Origin del sito, cookie se presente. */
function call(method: string, path: string, opts: { body?: unknown; cookie?: string | null; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { 'x-clavis': '1', origin: SITE, ...opts.headers };
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.cookie) headers.cookie = `${COOKIE}=${opts.cookie}`;
  return app.fetch(
    new Request(`${SITE}${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) }),
    '10.0.0.1',
  );
}

const cookieFrom = (res: Response) => /clavis_session=([^;]*)/.exec(res.headers.get('set-cookie') ?? '')?.[1] ?? null;

/** Simula l'utente che apre il link e preme un pulsante nel bot. */
async function telegramUser(id: string, from: typeof ALICE | typeof BOB, action: 'ok' | 'no' | null) {
  tg.push({ message: { message_id: 1, chat: { id: from.id }, from, text: `/start ${id}` } });
  await bot.pollOnce(0);
  if (!action) return;
  const sent = tg.sent('sendMessage').at(-1)!;
  tg.push({ callback_query: { id: 'q', from, data: `${action}:${id}`, message: { message_id: 100, chat: { id: from.id } } } });
  await bot.pollOnce(0);
  return sent;
}

/** Accesso completo; restituisce il cookie. */
async function login(user: typeof ALICE | typeof BOB = ALICE): Promise<string> {
  const start = await (await call('POST', '/api/auth/start')).json();
  await telegramUser(start.id, user, 'ok');
  const res = await call('POST', '/api/auth/poll', { body: { id: start.id, pollSecret: start.pollSecret } });
  expect((await res.json()).status).toBe('approved');
  return cookieFrom(res)!;
}

describe('database', () => {
  test('inserimento idempotente e cursore a pagine', () => {
    db.upsertUser(ALICE, clock);
    expect(db.insertSessions(ALICE.id, [session('a'), session('b')])).toBe(2);
    expect(db.insertSessions(ALICE.id, [session('a'), session('c')])).toBe(1);
    const p1 = db.sessionsAfter(ALICE.id, 0, 2);
    expect(p1.sessions.map((s) => s.id)).toEqual(['a', 'b']);
    expect(p1.hasMore).toBe(true);
    const p2 = db.sessionsAfter(ALICE.id, p1.cursor, 2);
    expect(p2.sessions.map((s) => s.id)).toEqual(['c']);
    expect(p2.hasMore).toBe(false);
  });

  test('impostazioni: vince la più recente', () => {
    db.upsertUser(ALICE, clock);
    db.putSettings(ALICE.id, { ...DEFAULT_SETTINGS, digits: 0.2 }, 200);
    db.putSettings(ALICE.id, { ...DEFAULT_SETTINGS, digits: 0.1 }, 100);
    expect(db.getSettings(ALICE.id)).toEqual({ value: { ...DEFAULT_SETTINGS, digits: 0.2 }, updatedAt: 200 });
  });

  test('pulizia di richieste scadute e sessioni inutilizzate', () => {
    db.upsertUser(ALICE, clock);
    db.createLogin({ id: 'x', code: 'ABCDEF', pollHash: 'h', createdAt: 0, expiresAt: 10 });
    db.createAuth('vecchia', ALICE.id, 0);
    db.createAuth('nuova', ALICE.id, clock);
    expect(db.cleanup(clock)).toEqual({ logins: 1, auth: 1 });
    expect(db.getAuth('nuova')).not.toBeNull();
  });
});

describe('bot', () => {
  test('presentazione: inglese predefinito e italiano per it, impostati una volta sola', async () => {
    await bot.present();
    await bot.present();
    expect(tg.sent('setMyName')).toHaveLength(2); // predefinito + it
    expect(tg.sent('setMyDescription')).toHaveLength(2);
    expect(tg.sent('setMyCommands')).toHaveLength(4);
    expect(tg.profile['description|']).toContain('Sign-in bot');
    expect(tg.profile['description|it']).toContain('Bot di accesso');
    expect(tg.profile['short_description|']).toContain('Sign in');
  });

  test('utente con Telegram in inglese: codice e pulsanti in inglese', async () => {
    const start = await (await call('POST', '/api/auth/start')).json();
    await telegramUser(start.id, BOB, null);
    const sent = tg.sent('sendMessage')[0];
    expect(String(sent.text)).toContain(`Code: ${start.code}`);
    expect(JSON.stringify(sent.reply_markup)).toContain('Confirm');
    expect(JSON.stringify(sent.reply_markup)).toContain('Cancel');
    tg.push({ callback_query: { id: 'q', from: BOB, data: `ok:${start.id}`, message: { message_id: 100, chat: { id: BOB.id } } } });
    await bot.pollOnce(0);
    expect(String(tg.sent('editMessageText').at(-1)!.text)).toContain('Sign-in confirmed');
  });

  test('/start senza codice in inglese', async () => {
    tg.push({ message: { message_id: 1, chat: { id: 5 }, from: BOB, text: '/start' } });
    await bot.pollOnce(0);
    expect(String(tg.sent('sendMessage')[0].text)).toContain('This bot is used to sign in');
  });

  test('/start senza codice: istruzioni con il link al sito', async () => {
    tg.push({ message: { message_id: 1, chat: { id: 5 }, from: ALICE, text: '/start' } });
    await bot.pollOnce(0);
    expect(String(tg.sent('sendMessage')[0].text)).toContain(SITE);
  });

  test('il bot mostra lo stesso codice del sito con i pulsanti', async () => {
    const start = await (await call('POST', '/api/auth/start')).json();
    expect(start.url).toBe(`https://t.me/clavis_test_bot?start=${start.id}`);
    expect(start.code).toMatch(/^[A-Z2-9]{6}$/);
    const sent = (await telegramUser(start.id, ALICE, null), tg.sent('sendMessage')[0]);
    expect(String(sent.text)).toContain(start.code);
    expect(JSON.stringify(sent.reply_markup)).toContain(`ok:${start.id}`);
  });

  test('offset persistito: gli update non vengono rielaborati', async () => {
    tg.push({ message: { message_id: 1, chat: { id: 5 }, from: ALICE, text: '/start' } });
    await bot.pollOnce(0);
    await bot.pollOnce(0);
    expect(tg.sent('sendMessage')).toHaveLength(1);
    expect(db.kvGet('telegram_offset')).toBe('2');
  });
});

describe('accesso', () => {
  test('senza bot: config telegram false e start rifiutato', async () => {
    app = createApp({ db, bot: null, publicUrl: SITE, staticDir, now: () => clock });
    expect(await (await call('GET', '/api/config')).json()).toEqual({ telegram: false, bot: null });
    expect((await call('POST', '/api/auth/start')).status).toBe(503);
  });

  test('conferma: cookie HttpOnly Secure SameSite=Lax e /api/me', async () => {
    const start = await (await call('POST', '/api/auth/start')).json();
    expect((await (await call('POST', '/api/auth/poll', { body: start })).json()).status).toBe('pending');
    await telegramUser(start.id, ALICE, 'ok');
    expect(String(tg.sent('editMessageText')[0].text)).toContain('confermato');
    const res = await call('POST', '/api/auth/poll', { body: { id: start.id, pollSecret: start.pollSecret } });
    const sc = res.headers.get('set-cookie')!;
    expect(sc).toContain('HttpOnly');
    expect(sc).toContain('Secure');
    expect(sc).toContain('SameSite=Lax');
    expect(sc).toContain('Max-Age=15552000');
    const me = await (await call('GET', '/api/me', { cookie: cookieFrom(res) })).json();
    expect(me.user).toEqual({ id: ALICE.id, first_name: ALICE.first_name, username: ALICE.username });
    // il DB contiene solo l'impronta del token
    expect(db.getAuth(cookieFrom(res)!)).toBeNull();
  });

  test('richiesta consumata: un secondo poll non crea un\'altra sessione', async () => {
    const start = await (await call('POST', '/api/auth/start')).json();
    await telegramUser(start.id, ALICE, 'ok');
    await call('POST', '/api/auth/poll', { body: start });
    expect((await (await call('POST', '/api/auth/poll', { body: start })).json()).status).toBe('unknown');
  });

  test('chi conosce solo il link non può prendere la sessione', async () => {
    const start = await (await call('POST', '/api/auth/start')).json();
    await telegramUser(start.id, ALICE, 'ok');
    const stolen = await (await call('POST', '/api/auth/poll', { body: { id: start.id, pollSecret: 'indovinato' } })).json();
    expect(stolen.status).toBe('unknown');
  });

  test('rifiuto: nessuna sessione', async () => {
    const start = await (await call('POST', '/api/auth/start')).json();
    await telegramUser(start.id, ALICE, 'no');
    const res = await call('POST', '/api/auth/poll', { body: start });
    expect((await res.json()).status).toBe('denied');
    expect(res.headers.get('set-cookie')).toBeNull();
  });

  test('richiesta scaduta dopo 10 minuti', async () => {
    const start = await (await call('POST', '/api/auth/start')).json();
    clock += LOGIN_TTL_MS + 1;
    expect((await (await call('POST', '/api/auth/poll', { body: start })).json()).status).toBe('expired');
    await telegramUser(start.id, ALICE, null);
    expect(String(tg.sent('sendMessage')[0].text)).toContain('non è più valido');
  });

  test('link già usato', async () => {
    const start = await (await call('POST', '/api/auth/start')).json();
    await telegramUser(start.id, ALICE, 'ok');
    await call('POST', '/api/auth/poll', { body: start });
    await telegramUser(start.id, ALICE, null);
    expect(String(tg.sent('sendMessage').at(-1)!.text)).toContain('non è più valido');
  });

  test('il pulsante di un altro utente Telegram non conferma', async () => {
    const start = await (await call('POST', '/api/auth/start')).json();
    await telegramUser(start.id, ALICE, null);
    tg.push({ callback_query: { id: 'q', from: BOB, data: `ok:${start.id}`, message: { message_id: 100, chat: { id: BOB.id } } } });
    await bot.pollOnce(0);
    expect((await (await call('POST', '/api/auth/poll', { body: start })).json()).status).toBe('pending');
  });

  test('due browser sullo stesso account, uscita da uno solo', async () => {
    const a = await login();
    const b = await login();
    expect(a).not.toBe(b);
    const out = await call('POST', '/api/auth/logout', { cookie: a });
    expect(out.headers.get('set-cookie')).toContain('Max-Age=0');
    expect((await call('GET', '/api/me', { cookie: a })).status).toBe(401);
    expect((await call('GET', '/api/me', { cookie: b })).status).toBe(200);
  });

  test('sessione riconosciuta dopo una settimana e rinnovata', async () => {
    const c = await login();
    clock += 7 * 24 * 3600 * 1000;
    const res = await call('GET', '/api/me', { cookie: c });
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('Max-Age=15552000');
    clock += AUTH_TTL_MS + 1;
    expect((await call('GET', '/api/me', { cookie: c })).status).toBe(401);
  });

  test('richieste da un altro sito rifiutate', async () => {
    const c = await login();
    const noHeader = await app.fetch(new Request(`${SITE}/api/data`, { method: 'DELETE', headers: { cookie: `${COOKIE}=${c}` } }));
    expect(noHeader.status).toBe(403);
    const foreign = await call('DELETE', '/api/data', { cookie: c, headers: { origin: 'https://evil.example' } });
    expect(foreign.status).toBe(403);
  });

  test('più di 10 richieste di accesso al minuto: 429', async () => {
    const codes: number[] = [];
    for (let i = 0; i < 11; i++) codes.push((await call('POST', '/api/auth/start')).status);
    expect(codes.slice(0, 10).every((c) => c === 200)).toBe(true);
    expect(codes[10]).toBe(429);
    clock += 61_000;
    expect((await call('POST', '/api/auth/start')).status).toBe(200);
  });
});

describe('sincronizzazione', () => {
  const sync = (cookie: string | null, body: unknown) => call('POST', '/api/sync', { cookie, body });

  test('senza accesso: 401', async () => {
    expect((await sync(null, { upload: [], cursor: 0 })).status).toBe(401);
  });

  test('secondo dispositivo riceve le sessioni del primo', async () => {
    const laptop = await login();
    const desktop = await login();
    const up = await (await sync(laptop, { upload: [session('a'), session('b')], cursor: 0 })).json();
    expect(up.accepted).toBe(2);
    const down = await (await sync(desktop, { upload: [], cursor: 0 })).json();
    expect(down.sessions.map((s: StoredSession) => s.id)).toEqual(['a', 'b']);
    const again = await (await sync(desktop, { upload: [], cursor: down.cursor })).json();
    expect(again.sessions).toEqual([]);
  });

  test('invio ripetuto: una sola copia', async () => {
    const c = await login();
    await sync(c, { upload: [session('a')], cursor: 0 });
    const r = await (await sync(c, { upload: [session('a')], cursor: 0 })).json();
    expect(r.accepted).toBe(0);
    expect(r.sessions).toHaveLength(1);
  });

  test('account separati', async () => {
    const a = await login(ALICE);
    const b = await login(BOB);
    await sync(a, { upload: [session('a')], cursor: 0 });
    expect((await (await sync(b, { upload: [], cursor: 0 })).json()).sessions).toEqual([]);
  });

  test('sessione malformata: 422 e account invariato', async () => {
    const c = await login();
    const bad = { ...session('x'), samples: undefined };
    const res = await sync(c, { upload: [session('ok'), bad], cursor: 0 });
    expect(res.status).toBe(422);
    expect((await (await sync(c, { upload: [], cursor: 0 })).json()).sessions).toEqual([]);
  });

  test('sessione di una versione precedente (senza profilo) accettata', async () => {
    const c = await login();
    const legacy = session('vecchia');
    const withProfile = { ...session('nuova'), keyboard: 'iso', layout: 'it', lang: 'en' };
    const r = await (await sync(c, { upload: [legacy, withProfile], cursor: 0 })).json();
    expect(r.accepted).toBe(2);
    const byId = Object.fromEntries(r.sessions.map((s: StoredSession) => [s.id, s]));
    expect(byId.vecchia.keyboard).toBeUndefined();
    expect(byId.nuova).toMatchObject({ keyboard: 'iso', layout: 'it', lang: 'en' });
  });

  test('profilo sconosciuto: 422 e account invariato', async () => {
    const c = await login();
    const res = await sync(c, { upload: [{ ...session('x'), layout: 'dvorak' }], cursor: 0 });
    expect(res.status).toBe(422);
    expect((await (await sync(c, { upload: [], cursor: 0 })).json()).sessions).toEqual([]);
  });

  test('impostazioni con profilo e lingue', async () => {
    const c = await login();
    const value = { ...DEFAULT_SETTINGS, keyboard: 'ansi', layout: 'us', uiLang: 'en', exerciseLang: 'en' };
    const r = await (await sync(c, { upload: [], cursor: 0, settings: { value, updatedAt: 10 } })).json();
    expect(r.settings.value).toMatchObject({ keyboard: 'ansi', layout: 'us', uiLang: 'en' });
    const bad = await sync(c, { upload: [], cursor: 0, settings: { value: { ...value, uiLang: 'de' }, updatedAt: 20 } });
    expect(bad.status).toBe(422);
  });

  test('troppe sessioni in una richiesta: 413', async () => {
    const c = await login();
    const many = Array.from({ length: MAX_UPLOAD + 1 }, (_, i) => session(`s${i}`));
    expect((await sync(c, { upload: many, cursor: 0 })).status).toBe(413);
  });

  test('impostazioni: vince l\'ultima modifica tra dispositivi', async () => {
    const laptop = await login();
    const desktop = await login();
    await sync(laptop, { upload: [], cursor: 0, settings: { value: { ...DEFAULT_SETTINGS, showKeyboard: false }, updatedAt: 500 } });
    const r = await (await sync(desktop, { upload: [], cursor: 0, settings: { value: DEFAULT_SETTINGS, updatedAt: 100 } })).json();
    expect(r.settings.value.showKeyboard).toBe(false);
  });

  test('cancellazione dei dati dell\'account', async () => {
    const c = await login();
    await sync(c, { upload: [session('a')], cursor: 0 });
    expect((await call('DELETE', '/api/data', { cookie: c })).status).toBe(200);
    expect((await (await sync(c, { upload: [], cursor: 0 })).json()).sessions).toEqual([]);
    expect((await call('GET', '/api/me', { cookie: c })).status).toBe(200);
  });
});

describe('file statici', () => {
  const get = (path: string, headers: Record<string, string> = {}) => app.fetch(new Request(`${SITE}${path}`, { headers }));

  test('pagina, asset, corpus compresso e fallback', async () => {
    const index = await get('/');
    expect(index.headers.get('cache-control')).toBe('no-store');
    expect(await index.text()).toContain('clavis');
    const js = await get('/assets/app-abc.js');
    expect(js.headers.get('cache-control')).toContain('immutable');
    const corpus = await get('/corpus/words.json?v=123', { 'accept-encoding': 'gzip, br' });
    expect(corpus.headers.get('content-encoding')).toBe('gzip');
    expect(corpus.headers.get('cache-control')).toContain('immutable');
    expect((await get('/assets/manca.js')).status).toBe(404);
    const spa = await get('/statistiche');
    expect(spa.status).toBe(200);
    expect(spa.headers.get('cache-control')).toBe('no-store');
    expect((await get('/api/manca')).status).toBe(404);
  });

  test('niente uscita dalla cartella', async () => {
    for (const path of ['/%2e%2e/%2e%2e/etc/passwd', '/..%2f..%2f..%2fetc%2fpasswd', '/assets/..%2f..%2f..%2fetc%2fpasswd']) {
      const res = await app.fetch(new Request(`${SITE}${path}`));
      expect(await res.text()).not.toContain('root:');
    }
  });
});
