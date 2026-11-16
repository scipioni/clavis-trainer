import 'fake-indexeddb/auto';
import { describe, expect, test } from 'vitest';
import { clavisResolver } from '../core/keyboard';
import { TypingSession } from '../core/session/session';
import { computeResult } from '../core/session/result';
import { DEFAULT_SETTINGS, type Settings, type StoredSession } from '../core/data';
import { TrainerStore } from '../storage/db';
import { SyncEngine } from './engine';
import { OfflineError, type AccountApi, type AccountUser, type SyncRequest, type SyncResponse } from './api';

const resolver = clavisResolver();
const ALICE: AccountUser = { id: 1, first_name: 'Alice' };
const BOB: AccountUser = { id: 2, first_name: 'Bob' };
let n = 0;

function session(id: string, startedAt: number, text = 'ciao mondo'): StoredSession {
  const s = new TypingSession(text);
  let t = 0;
  for (const c of text) s.handle({ type: 'char', data: c, t: (t += 120 + (startedAt % 7) * 10) });
  return {
    id, startedAt, mode: 'adaptive', durationMs: null, status: 'completed', deadKeys: true,
    samples: s.samples, result: computeResult(s.samples, s.activeMs),
  };
}

/** Server finto con la stessa semantica di server/app.ts (seq crescente, INSERT OR IGNORE, ultima modifica). */
class FakeServer {
  rows = new Map<number, { seq: number; s: StoredSession }[]>();
  settings = new Map<number, { value: Settings; updatedAt: number }>();
  seq = 0;
  failAfterApply = 0;
  offline = false;
  requests: SyncRequest[] = [];

  apiFor(user: AccountUser): AccountApi {
    const srv = this;
    return {
      config: async () => ({ telegram: true, bot: 'b' }),
      me: async () => user,
      startLogin: async () => { throw new Error('non usato'); },
      pollLogin: async () => ({ status: 'pending' }),
      logout: async () => {},
      deleteData: async () => {
        srv.rows.delete(user.id);
        srv.settings.delete(user.id);
      },
      sync: async (req: SyncRequest): Promise<SyncResponse> => {
        if (srv.offline) throw new OfflineError('offline');
        srv.requests.push(req);
        const rows = srv.rows.get(user.id) ?? [];
        let accepted = 0;
        for (const s of req.upload) {
          if (rows.some((r) => r.s.id === s.id)) continue;
          rows.push({ seq: ++srv.seq, s: structuredClone(s) });
          accepted++;
        }
        srv.rows.set(user.id, rows);
        const cur = srv.settings.get(user.id);
        if (req.settings && (!cur || req.settings.updatedAt > cur.updatedAt)) srv.settings.set(user.id, req.settings);
        if (srv.failAfterApply > 0) {
          srv.failAfterApply--;
          throw new OfflineError('connessione caduta dopo il salvataggio');
        }
        const after = rows.filter((r) => r.seq > req.cursor).slice(0, 200);
        return {
          accepted,
          sessions: after.map((r) => structuredClone(r.s)),
          cursor: after.length ? after[after.length - 1].seq : req.cursor,
          hasMore: rows.filter((r) => r.seq > req.cursor).length > 200,
          settings: srv.settings.get(user.id) ?? null,
        };
      },
    };
  }

  count(user: AccountUser) {
    return this.rows.get(user.id)?.length ?? 0;
  }
}

async function device(server: FakeServer, user: AccountUser) {
  const store = await TrainerStore.open(`dev-${++n}`);
  const engine = new SyncEngine(server.apiFor(user), store, () => resolver);
  return { store, engine };
}

describe('sincronizzazione', () => {
  test('secondo dispositivo: stesse sessioni e stesse statistiche', async () => {
    const server = new FakeServer();
    const laptop = await device(server, ALICE);
    await laptop.engine.bindAccount(ALICE);
    for (let i = 0; i < 20; i++) await laptop.store.completeSession(session(`s${i}`, 1000 + i), resolver);
    await laptop.engine.sync();
    expect(server.count(ALICE)).toBe(20);

    const desktop = await device(server, ALICE);
    await desktop.engine.bindAccount(ALICE);
    const r = await desktop.engine.sync();
    expect(r.downloaded).toBe(20);
    expect((await desktop.store.listSessions()).map((s) => s.id)).toEqual((await laptop.store.listSessions()).map((s) => s.id));
    expect(await desktop.store.getStats()).toEqual(await laptop.store.getStats());
  });

  test('la nuova sessione di un dispositivo arriva all\'altro', async () => {
    const server = new FakeServer();
    const a = await device(server, ALICE);
    const b = await device(server, ALICE);
    await a.engine.bindAccount(ALICE);
    await b.engine.bindAccount(ALICE);
    await b.engine.sync();
    await a.store.completeSession(session('nuova', 5000), resolver);
    await a.engine.sync();
    expect((await b.engine.sync()).downloaded).toBe(1);
    expect((await b.store.listSessions()).map((s) => s.id)).toEqual(['nuova']);
  });

  test('invio ripetuto dopo una connessione caduta: una sola copia', async () => {
    const server = new FakeServer();
    const d = await device(server, ALICE);
    await d.engine.bindAccount(ALICE);
    await d.store.completeSession(session('a', 1), resolver);
    server.failAfterApply = 1;
    await expect(d.engine.sync()).rejects.toThrow(OfflineError);
    expect((await d.store.getSync()).pending).toEqual(['a']);
    await d.engine.sync();
    expect(server.count(ALICE)).toBe(1);
    expect((await d.store.getSync()).pending).toEqual([]);
  });

  test('offline poi online: la sessione arriva una volta', async () => {
    const server = new FakeServer();
    const d = await device(server, ALICE);
    await d.engine.bindAccount(ALICE);
    server.offline = true;
    await d.store.completeSession(session('a', 1), resolver);
    await d.store.completeSession(session('b', 2), resolver);
    await expect(d.engine.sync()).rejects.toThrow(OfflineError);
    expect((await d.store.getSync()).pending).toHaveLength(2);
    server.offline = false;
    await d.engine.sync();
    expect(server.count(ALICE)).toBe(2);
  });

  test('storico anonimo: confluisce nell\'account (5 + 10 = 15)', async () => {
    const server = new FakeServer();
    const other = await device(server, ALICE);
    await other.engine.bindAccount(ALICE);
    for (let i = 0; i < 10; i++) await other.store.completeSession(session(`acc${i}`, 100 + i), resolver);
    await other.engine.sync();

    const anon = await device(server, ALICE);
    for (let i = 0; i < 5; i++) await anon.store.completeSession(session(`anon${i}`, 200 + i), resolver);
    await anon.engine.bindAccount(ALICE);
    await anon.engine.sync();
    expect(server.count(ALICE)).toBe(15);
    expect(await anon.store.listSessions()).toHaveLength(15);
  });

  test('sessioni di prima della sincronizzazione (senza pending) salgono comunque', async () => {
    const server = new FakeServer();
    const d = await device(server, ALICE);
    await d.store.completeSession(session('vecchia', 1), resolver);
    await d.store.patchSync({ pending: [] }); // come un browser della versione precedente
    await d.engine.bindAccount(ALICE);
    await d.engine.sync();
    expect(server.count(ALICE)).toBe(1);
  });

  test('browser di un altro account: i dati locali vengono tolti', async () => {
    const server = new FakeServer();
    const d = await device(server, ALICE);
    await d.engine.bindAccount(ALICE);
    await d.store.completeSession(session('di-alice', 1), resolver);
    await d.engine.sync();
    const asBob = new SyncEngine(server.apiFor(BOB), d.store, () => resolver);
    await asBob.bindAccount(BOB);
    await asBob.sync();
    expect(await d.store.listSessions()).toEqual([]);
    expect(server.count(BOB)).toBe(0);
    expect((await d.store.getSync()).account).toBe(BOB.id);
  });

  test('lotti da 50: 120 sessioni in 3 richieste', async () => {
    const server = new FakeServer();
    const d = await device(server, ALICE);
    await d.engine.bindAccount(ALICE);
    for (let i = 0; i < 120; i++) await d.store.completeSession(session(`s${i}`, i, 'ab'), resolver);
    await d.engine.sync();
    expect(server.requests.map((r) => r.upload.length)).toEqual([50, 50, 20]);
    expect(server.count(ALICE)).toBe(120);
  });

  test('impostazioni: vince l\'ultima modifica', async () => {
    const server = new FakeServer();
    const laptop = await device(server, ALICE);
    const desktop = await device(server, ALICE);
    for (const d of [laptop, desktop]) await d.engine.bindAccount(ALICE);
    await desktop.store.saveSettings(DEFAULT_SETTINGS, 1000);
    await desktop.engine.sync();
    await laptop.store.saveSettings({ ...DEFAULT_SETTINGS, showKeyboard: false }, 2000);
    await laptop.engine.sync();
    const r = await desktop.engine.sync();
    expect(r.settingsChanged).toBe(true);
    expect((await desktop.store.getSettings()).showKeyboard).toBe(false);
    // e non viene rimandata indietro come modifica locale
    const before = server.requests.length;
    await desktop.engine.sync();
    expect(server.requests[before].settings).toBeUndefined();
  });

  test('sessione troppo grande: resta solo nel browser e non blocca le altre', async () => {
    const server = new FakeServer();
    const d = await device(server, ALICE);
    await d.engine.bindAccount(ALICE);
    await d.store.completeSession(session('enorme', 1, 'a'.repeat(6000)), resolver);
    await d.store.completeSession(session('normale', 2), resolver);
    const r = await d.engine.sync();
    expect(r.localOnly).toBe(1);
    expect(server.count(ALICE)).toBe(1);
    expect((await d.store.getSync()).pending).toEqual([]);
    expect(await d.store.listSessions()).toHaveLength(2);
  });
});

describe('azzeramento e importazione con accesso', () => {
  test('azzeramento: account e browser vuoti, l\'altro dispositivo non riceve più nulla', async () => {
    const server = new FakeServer();
    const a = await device(server, ALICE);
    await a.engine.bindAccount(ALICE);
    for (let i = 0; i < 3; i++) await a.store.completeSession(session(`s${i}`, i), resolver);
    await a.engine.sync();
    await a.engine.wipeAccount(ALICE);
    expect(server.count(ALICE)).toBe(0);
    expect(await a.store.listSessions()).toEqual([]);
    const b = await device(server, ALICE);
    await b.engine.bindAccount(ALICE);
    expect((await b.engine.sync()).downloaded).toBe(0);
  });

  test('importazione: 3 sessioni del file al posto delle 10 dell\'account', async () => {
    const server = new FakeServer();
    const d = await device(server, ALICE);
    await d.engine.bindAccount(ALICE);
    for (let i = 0; i < 10; i++) await d.store.completeSession(session(`old${i}`, i), resolver);
    await d.engine.sync();
    const file = { format: 'clavis-trainer' as const, version: 1 as const, exportedAt: '', settings: DEFAULT_SETTINGS,
      sessions: [session('f1', 1), session('f2', 2), session('f3', 3)] };
    await d.engine.importIntoAccount(file, ALICE);
    expect(server.count(ALICE)).toBe(3);
    expect((await d.store.listSessions()).map((s) => s.id)).toEqual(['f1', 'f2', 'f3']);
    expect((await d.store.getSync()).account).toBe(ALICE.id);
  });
});
