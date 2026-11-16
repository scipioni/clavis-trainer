import { join, normalize } from 'node:path';
import { normalizeSettings, validSession, type Settings, type StoredSession } from '../src/core/data';
import { AUTH_TTL_MS, type ServerDB } from './db';
import { pollLogin, sha256, startLogin } from './auth';
import type { LoginBot } from './bot';

export interface AppOptions {
  db: ServerDB;
  bot: LoginBot | null;
  /** URL pubblico del sito, es. https://clavis.mywire.org */
  publicUrl: string;
  /** Altre origini ammesse (sviluppo). */
  extraOrigins?: string[];
  /** Cartella dei file statici; null = solo API. */
  staticDir: string | null;
  now?: () => number;
  /** Cookie con attributo Secure (sempre in produzione). */
  secureCookie?: boolean;
  /** Abilita /api/test/* per gli e2e col bot finto. */
  testHooks?: boolean;
}

export const COOKIE = 'clavis_session';
export const MAX_BODY = 8 * 1024 * 1024;
export const MAX_UPLOAD = 50;
export const PAGE_SIZE = 200;
const RENEW_AFTER_MS = 24 * 3600 * 1000;
const LOGIN_RATE = { max: 10, windowMs: 60_000 };

type Handler = (req: Request, ctx: Ctx) => Promise<Response> | Response;
interface Ctx {
  ip: string;
  userId: number | null;
  tokenHash: string | null;
  setCookie: string | null;
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });

const error = (status: number, message: string) => json({ error: message }, status);

function cookieOf(req: Request, name: string): string | null {
  const h = req.headers.get('cookie');
  if (!h) return null;
  for (const part of h.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

export function createApp(o: AppOptions) {
  const now = o.now ?? Date.now;
  const origins = new Set([new URL(o.publicUrl).origin, ...(o.extraOrigins ?? [])]);
  const secure = o.secureCookie ?? true;
  const loginHits = new Map<string, number[]>();

  const sessionCookie = (token: string, maxAgeSec: number) =>
    `${COOKIE}=${token}; HttpOnly;${secure ? ' Secure;' : ''} SameSite=Lax; Path=/api; Max-Age=${maxAgeSec}`;

  function rateLimited(ip: string): boolean {
    const t = now();
    const hits = (loginHits.get(ip) ?? []).filter((x) => t - x < LOGIN_RATE.windowMs);
    hits.push(t);
    loginHits.set(ip, hits);
    return hits.length > LOGIN_RATE.max;
  }

  /** Le richieste che cambiano qualcosa devono venire dall'app (header) e dal sito (Origin). */
  function csrfOk(req: Request): boolean {
    if (req.headers.get('x-clavis') !== '1') return false;
    const origin = req.headers.get('origin');
    return origin === null || origins.has(origin);
  }

  async function body<T>(req: Request): Promise<T | null> {
    const len = Number(req.headers.get('content-length') ?? 0);
    if (len > MAX_BODY) return null;
    try {
      const text = await req.text();
      if (text.length > MAX_BODY) return null;
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  }

  const routes: Record<string, Handler> = {
    'GET /api/config': () => json({ telegram: o.bot?.ready ?? false, bot: o.bot?.username ?? null }),

    'POST /api/auth/start': (_req, ctx) => {
      if (!o.bot?.ready) return error(503, 'accesso con Telegram non configurato');
      if (rateLimited(ctx.ip)) return error(429, 'troppe richieste di accesso, riprova tra un minuto');
      const l = startLogin(o.db, now());
      return json({ id: l.id, code: l.code, pollSecret: l.pollSecret, expiresAt: l.expiresAt, url: o.bot.link(l.id) });
    },

    'POST /api/auth/poll': async (req, ctx) => {
      const b = await body<{ id?: string; pollSecret?: string }>(req);
      if (!b?.id || !b.pollSecret) return error(400, 'richiesta non valida');
      const r = pollLogin(o.db, b.id, b.pollSecret, now());
      if (r.status === 'approved') {
        ctx.setCookie = sessionCookie(r.token, AUTH_TTL_MS / 1000);
        return json({ status: 'approved', user: r.user });
      }
      return json({ status: r.status });
    },

    'POST /api/auth/logout': (_req, ctx) => {
      if (ctx.tokenHash) o.db.deleteAuth(ctx.tokenHash);
      ctx.setCookie = sessionCookie('', 0);
      return json({ ok: true });
    },

    'GET /api/me': (_req, ctx) => {
      if (ctx.userId === null) return error(401, 'non connesso');
      return json({ user: o.db.getUser(ctx.userId), sessions: o.db.countSessions(ctx.userId) });
    },

    'POST /api/sync': async (req, ctx) => {
      if (ctx.userId === null) return error(401, 'non connesso');
      const b = await body<{ upload?: unknown[]; cursor?: number; settings?: { value: unknown; updatedAt: number } }>(req);
      if (!b || !Array.isArray(b.upload ?? []) || (b.cursor !== undefined && !Number.isInteger(b.cursor))) {
        return error(400, 'richiesta non valida');
      }
      const upload = b.upload ?? [];
      if (upload.length > MAX_UPLOAD) return error(413, `al massimo ${MAX_UPLOAD} sessioni per richiesta`);
      const bad = upload.findIndex((s) => !validSession(s));
      if (bad >= 0) return error(422, `sessione ${bad + 1} non valida`);
      let settingsIn: Settings | null = null;
      if (b.settings !== undefined) {
        settingsIn = normalizeSettings(b.settings?.value);
        if (!settingsIn || !Number.isFinite(b.settings.updatedAt)) return error(422, 'impostazioni non valide');
      }
      const accepted = o.db.insertSessions(ctx.userId, upload as StoredSession[]);
      if (settingsIn) o.db.putSettings(ctx.userId, settingsIn, b.settings!.updatedAt);
      const page = o.db.sessionsAfter(ctx.userId, b.cursor ?? 0, PAGE_SIZE);
      return json({ accepted, ...page, settings: o.db.getSettings(ctx.userId) });
    },

    'DELETE /api/data': (_req, ctx) => {
      if (ctx.userId === null) return error(401, 'non connesso');
      o.db.deleteUserData(ctx.userId);
      return json({ ok: true });
    },
  };

  if (o.testHooks) {
    // Solo per gli e2e col bot finto: simula l'utente Telegram che apre il link e conferma.
    routes['POST /api/test/telegram'] = async (req) => {
      const b = await body<{ id: string; action: 'ok' | 'no'; user?: { id: number; first_name: string } }>(req);
      if (!b || !o.bot) return error(400, 'richiesta non valida');
      const from = b.user ?? { id: 4242, first_name: 'Prova' };
      await o.bot.handle({ update_id: 0, message: { message_id: 1, chat: { id: from.id }, from, text: `/start ${b.id}` } });
      await o.bot.handle({
        update_id: 0,
        callback_query: { id: 'q', from, data: `${b.action}:${b.id}`, message: { message_id: 1, chat: { id: from.id } } },
      });
      return json({ ok: true });
    };
  }

  const MUTATING = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

  async function api(req: Request, url: URL, ip: string): Promise<Response> {
    const handler = routes[`${req.method} ${url.pathname}`];
    if (!handler) return error(404, 'non trovato');
    if (MUTATING.has(req.method) && !csrfOk(req)) return error(403, 'richiesta rifiutata');

    const ctx: Ctx = { ip, userId: null, tokenHash: null, setCookie: null };
    const token = cookieOf(req, COOKIE);
    if (token) {
      const hash = sha256(token);
      const s = o.db.getAuth(hash);
      const t = now();
      if (s && t - s.lastSeen < AUTH_TTL_MS) {
        ctx.userId = s.userId;
        ctx.tokenHash = hash;
        if (t - s.lastSeen > RENEW_AFTER_MS) {
          o.db.touchAuth(hash, t);
          ctx.setCookie = sessionCookie(token, AUTH_TTL_MS / 1000);
        }
      }
    }
    const res = await handler(req, ctx);
    if (ctx.setCookie) res.headers.append('set-cookie', ctx.setCookie);
    return res;
  }

  async function serveStatic(req: Request, url: URL): Promise<Response> {
    if (!o.staticDir || (req.method !== 'GET' && req.method !== 'HEAD')) return error(404, 'non trovato');
    let path: string;
    try {
      path = normalize(decodeURIComponent(url.pathname));
    } catch {
      return error(400, 'percorso non valido');
    }
    if (path.includes('\0') || path.split('/').includes('..')) return error(400, 'percorso non valido');
    const immutable = path.startsWith('/assets/') || path.startsWith('/corpus/');
    let file = Bun.file(join(o.staticDir, path));
    let isIndex = false;
    if (path.endsWith('/') || !(await file.exists())) {
      if (immutable) return new Response('non trovato', { status: 404 });
      file = Bun.file(join(o.staticDir, 'index.html'));
      isIndex = true;
    }
    const headers: Record<string, string> = {
      'cache-control': immutable && !isIndex ? 'public, max-age=31536000, immutable' : 'no-store',
      'content-type': file.type,
      'x-content-type-options': 'nosniff',
    };
    // versione precompressa accanto al file (gzip -n nel Dockerfile)
    if (/\bgzip\b/.test(req.headers.get('accept-encoding') ?? '')) {
      const gz = Bun.file(`${(file as unknown as { name: string }).name}.gz`);
      if (await gz.exists()) {
        return new Response(req.method === 'HEAD' ? null : gz, {
          headers: { ...headers, 'content-encoding': 'gzip', vary: 'accept-encoding' },
        });
      }
    }
    return new Response(req.method === 'HEAD' ? null : file, { headers });
  }

  return {
    async fetch(req: Request, ip = '0.0.0.0'): Promise<Response> {
      const url = new URL(req.url);
      const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
      try {
        if (url.pathname.startsWith('/api/')) return await api(req, url, fwd || ip);
        return await serveStatic(req, url);
      } catch (e) {
        console.error(e);
        return error(500, 'errore interno');
      }
    },
  };
}
