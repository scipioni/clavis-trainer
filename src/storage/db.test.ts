import 'fake-indexeddb/auto';
import { describe, expect, test } from 'vitest';
import { clavisResolver } from '../core/keyboard';
import { TypingSession } from '../core/session/session';
import { computeResult } from '../core/session/result';
import { ImportError, TrainerStore, parseExport, type StoredSession } from './db';

const resolver = clavisResolver();
let n = 0;
const openFresh = () => TrainerStore.open(`test-${++n}`);

function session(id: string, text: string, startedAt: number): StoredSession {
  const s = new TypingSession(text);
  let t = 0;
  for (const c of text) s.handle({ type: 'char', data: c, t: (t += 150) });
  return {
    id, startedAt, mode: 'adaptive', durationMs: null, status: 'completed', deadKeys: true,
    samples: s.samples, result: computeResult(s.samples, s.activeMs),
  };
}

describe('salvataggio locale', () => {
  test('sessione completata: sopravvive alla riapertura e aggiorna le statistiche', async () => {
    const name = `test-${++n}`;
    const a = await TrainerStore.open(name);
    await a.completeSession(session('s1', 'ciao mondo', 1000));
    a.close();
    const b = await TrainerStore.open(name);
    expect((await b.listSessions()).map((s) => s.id)).toEqual(['s1']);
    expect((await b.getStats())['bigram:ci'].n).toBe(1);
    b.close();
  });

  test('sessione in corso rimasta: si ritrova e si può scartare', async () => {
    const db = await openFresh();
    await db.saveInProgress(session('s1', 'ciao', 1000));
    expect((await db.findInProgress()).map((s) => s.id)).toEqual(['s1']);
    expect(await db.listSessions()).toEqual([]);
    await db.discardSession('s1');
    expect(await db.findInProgress()).toEqual([]);
  });

  test('sessione abbandonata: le statistiche non cambiano', async () => {
    const db = await openFresh();
    await db.completeSession(session('s1', 'ciao', 1000));
    const before = await db.getStats();
    await db.saveInProgress(session('s2', 'ciao ciao', 2000));
    await db.discardSession('s2');
    expect(await db.getStats()).toEqual(before);
  });

  test('sessione in corso chiusa come completata', async () => {
    const db = await openFresh();
    const s = session('s1', 'ciao', 1000);
    await db.saveInProgress(s);
    const [found] = await db.findInProgress();
    await db.completeSession(found);
    expect((await db.listSessions()).map((x) => x.status)).toEqual(['completed']);
  });

  test('impostazioni con valori predefiniti', async () => {
    const db = await openFresh();
    expect((await db.getSettings()).deadKeys).toBe(true);
    await db.saveSettings({ ...(await db.getSettings()), deadKeys: false });
    expect((await db.getSettings()).deadKeys).toBe(false);
  });
});

describe('esportazione, importazione, azzeramento', () => {
  test('andata e ritorno: dati identici', async () => {
    const db = await openFresh();
    await db.completeSession(session('s1', 'ciao mondo', 1000));
    await db.completeSession(session('s2', 'perché sì', 2000));
    await db.saveSettings({ ...(await db.getSettings()), punctuation: 0.4 });
    const sessions = await db.listSessions();
    const stats = await db.getStats();
    const file = JSON.stringify(await db.exportData());

    await db.reset();
    expect(await db.listSessions()).toEqual([]);
    expect(await db.getStats()).toEqual({});

    await db.importData(parseExport(file));
    expect(await db.listSessions()).toEqual(sessions);
    expect(await db.getStats()).toEqual(stats);
    expect((await db.getSettings()).punctuation).toBe(0.4);
  });

  test('file non valido: errore e dati invariati', async () => {
    const db = await openFresh();
    await db.completeSession(session('s1', 'ciao', 1000));
    const before = await db.listSessions();
    for (const bad of ['non json', '{"format":"altro"}', '{"format":"clavis-trainer","version":1,"sessions":[{"id":3}]}']) {
      expect(() => parseExport(bad)).toThrow(ImportError);
    }
    expect(await db.listSessions()).toEqual(before);
  });
});

describe('statistiche per profilo (IndexedDB v2)', () => {
  test('migrazione da v1: 20 sessioni, stesse statistiche nel profilo clavis:colemakdh', async () => {
    const { openDB } = await import('idb');
    const { recompute } = await import('../core/analysis/stats');
    const name = `v1-${++n}`;
    const sessions = Array.from({ length: 20 }, (_, i) => session(`s${i}`, i % 2 ? 'gli figli' : 'perché sì', 1000 + i));
    const legacy = recompute(sessions, resolver);
    const v1 = await openDB(name, 1, {
      upgrade(db) {
        db.createObjectStore('sessions', { keyPath: 'id' }).createIndex('startedAt', 'startedAt');
        db.createObjectStore('kv');
      },
    });
    for (const s of sessions) await v1.put('sessions', s);
    await v1.put('kv', legacy, 'stats');
    v1.close();

    const db = await TrainerStore.open(name);
    expect(await db.listSessions()).toHaveLength(20);
    expect(await db.getStats({ keyboard: 'clavis', layout: 'colemakdh' })).toEqual(legacy);
    expect(await db.getStats({ keyboard: 'iso', layout: 'it' })).toEqual({});
  });

  test('due profili: statistiche separate', async () => {
    const db = await openFresh();
    await db.completeSession(session('c', 'gli gli gli', 1000));
    await db.completeSession({ ...session('i', 'zzz zzz', 2000), keyboard: 'iso', layout: 'it' });
    const clavis = await db.getStats({ keyboard: 'clavis', layout: 'colemakdh' });
    const iso = await db.getStats({ keyboard: 'iso', layout: 'it' });
    expect(clavis['bigram:gl']).toBeDefined();
    expect(clavis['bigram:zz']).toBeUndefined();
    expect(iso['bigram:zz']).toBeDefined();
    expect(iso['bigram:gl']).toBeUndefined();
    expect(await db.listSessions({ keyboard: 'iso', layout: 'it' })).toHaveLength(1);
    // il ricalcolo completo ritrova le stesse tabelle
    await db.recomputeStats();
    expect(await db.getStats({ keyboard: 'iso', layout: 'it' })).toEqual(iso);
  });

  test('tastiera classica: nessuna transizione di layer, dita della classica', async () => {
    const db = await openFresh();
    await db.completeSession({ ...session('a', 'a(a(', 1000), keyboard: 'ansi', layout: 'us' });
    const st = await db.getStats({ keyboard: 'ansi', layout: 'us' });
    expect(Object.keys(st).some((k) => k.startsWith('layer:'))).toBe(false);
    expect(st['char:(']).toBeDefined();
    // ( su ANSI US = Shift + 9, anulare destro
    expect(st['finger:R-ring']).toBeDefined();
  });
});
