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
    await a.completeSession(session('s1', 'ciao mondo', 1000), resolver);
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
    await db.completeSession(session('s1', 'ciao', 1000), resolver);
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
    await db.completeSession(found, resolver);
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
    await db.completeSession(session('s1', 'ciao mondo', 1000), resolver);
    await db.completeSession(session('s2', 'perché sì', 2000), resolver);
    await db.saveSettings({ ...(await db.getSettings()), punctuation: 0.4 });
    const sessions = await db.listSessions();
    const stats = await db.getStats();
    const file = JSON.stringify(await db.exportData());

    await db.reset();
    expect(await db.listSessions()).toEqual([]);
    expect(await db.getStats()).toEqual({});

    await db.importData(parseExport(file), resolver);
    expect(await db.listSessions()).toEqual(sessions);
    expect(await db.getStats()).toEqual(stats);
    expect((await db.getSettings()).punctuation).toBe(0.4);
  });

  test('file non valido: errore e dati invariati', async () => {
    const db = await openFresh();
    await db.completeSession(session('s1', 'ciao', 1000), resolver);
    const before = await db.listSessions();
    for (const bad of ['non json', '{"format":"altro"}', '{"format":"clavis-trainer","version":1,"sessions":[{"id":3}]}']) {
      expect(() => parseExport(bad)).toThrow(ImportError);
    }
    expect(await db.listSessions()).toEqual(before);
  });
});
