import type { ServerDB, LoginRequest, TelegramUser } from './db';

/** Validità di una richiesta di accesso. */
export const LOGIN_TTL_MS = 10 * 60 * 1000;
/** Alfabeto del codice senza caratteri ambigui (0/O, 1/I/L). */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n));
}

export function randomToken(bytes: number): string {
  return Buffer.from(randomBytes(bytes)).toString('base64url');
}

export function sha256(s: string): string {
  return new Bun.CryptoHasher('sha256').update(s).digest('hex');
}

export function randomCode(len = 6): string {
  const out: string[] = [];
  // rifiuto dei valori oltre il multiplo dell'alfabeto: niente sbilanciamenti
  const limit = 256 - (256 % CODE_ALPHABET.length);
  while (out.length < len) {
    for (const b of randomBytes(len * 2)) {
      if (b < limit && out.length < len) out.push(CODE_ALPHABET[b % CODE_ALPHABET.length]);
    }
  }
  return out.join('');
}

export interface StartedLogin {
  id: string;
  code: string;
  /** Segreto noto solo al browser che ha avviato l'accesso: senza, il link basta a rubare la sessione. */
  pollSecret: string;
  expiresAt: number;
}

export function startLogin(db: ServerDB, now: number): StartedLogin {
  const id = randomToken(16);
  const pollSecret = randomToken(24);
  const code = randomCode();
  const expiresAt = now + LOGIN_TTL_MS;
  db.createLogin({ id, code, pollHash: sha256(pollSecret), createdAt: now, expiresAt });
  return { id, code, pollSecret, expiresAt };
}

export type PollResult =
  | { status: 'pending' | 'denied' | 'expired' | 'unknown' }
  | { status: 'approved'; token: string; user: TelegramUser };

/** Controlla una richiesta; se confermata crea la sessione del browser e consuma la richiesta. */
export function pollLogin(db: ServerDB, id: string, pollSecret: string, now: number): PollResult {
  const r = db.getLogin(id);
  if (!r || r.pollHash !== sha256(pollSecret)) return { status: 'unknown' };
  if (r.status === 'denied') {
    db.deleteLogin(id);
    return { status: 'denied' };
  }
  if (r.status === 'approved' && r.tgUserId !== null) {
    const user = db.getUser(r.tgUserId);
    db.deleteLogin(id);
    if (!user) return { status: 'unknown' };
    const token = randomToken(32);
    db.createAuth(sha256(token), user.id, now);
    return { status: 'approved', token, user };
  }
  if (now > r.expiresAt) return { status: 'expired' };
  return { status: 'pending' };
}

export function isUsable(r: LoginRequest | null, now: number): r is LoginRequest {
  return r !== null && r.status === 'pending' && now <= r.expiresAt;
}
