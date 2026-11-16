import { describe, expect, test } from 'vitest';
import { clavisKeymap } from '../keyboard';
import { byDay, heatmap, summary, type HistoryEntry } from './history';
import type { StatsTable } from './stats';

const DAY = 24 * 3600 * 1000;
const t0 = new Date(2026, 10, 1, 10, 0).getTime();
const entry = (t: number, wpm: number, accuracy: number, chars = 100): HistoryEntry => ({ startedAt: t, result: { wpm, accuracy, chars } });

describe('andamento', () => {
  test('10 giorni → 10 punti con medie del giorno', () => {
    const entries: HistoryEntry[] = [];
    for (let d = 0; d < 10; d++) {
      entries.push(entry(t0 + d * DAY, 40 + d, 0.9));
      entries.push(entry(t0 + d * DAY + 3600_000, 50 + d, 1));
    }
    const days = byDay(entries);
    expect(days).toHaveLength(10);
    expect(days[0]).toMatchObject({ day: '2026-11-01', wpm: 45, sessions: 2 });
    expect(days[0].accuracy).toBeCloseTo(0.95);
    expect(days[9].wpm).toBe(54);
  });

  test('ultimo valore e media degli ultimi 7 giorni', () => {
    const entries = [entry(t0, 10, 0.5), entry(t0 + 8 * DAY, 40, 0.9), entry(t0 + 9 * DAY, 60, 1)];
    const s = summary(entries, t0 + 9 * DAY + 1000);
    expect(s.lastWpm).toBe(60);
    expect(s.avg7Wpm).toBe(50);
    expect(s.avg7Accuracy).toBeCloseTo(0.95);
  });

  test('nessuna sessione', () => {
    expect(summary([], t0)).toEqual({ lastWpm: null, lastAccuracy: null, avg7Wpm: null, avg7Accuracy: null });
  });
});

describe('mappa di calore', () => {
  const stat = (emaMs: number, emaErr = 0) => ({ n: 20, nMs: 20, emaMs, emaErr, emaMisfire: 0, misfires: 0 });
  const table: StatsTable = { 'char:a': stat(150), 'char:e': stat(200, 0.1), 'char:b': stat(450, 0.02), 'char:(': stat(600) };

  test('il tasto più lento ha il valore massimo', () => {
    const h = heatmap(table, clavisKeymap, 'BASE', 'time');
    const posB = clavisKeymap.layers.BASE.findIndex((k) => k.tap === 'b');
    expect(h.values[posB]).toBe(1);
    expect(h.values[clavisKeymap.layers.BASE.findIndex((k) => k.tap === 'a')]).toBe(0);
    expect(h.values[clavisKeymap.layers.BASE.findIndex((k) => k.tap === 'q')]).toBeNull();
  });

  test('metrica errori', () => {
    const h = heatmap(table, clavisKeymap, 'BASE', 'errors');
    expect(h.values[clavisKeymap.layers.BASE.findIndex((k) => k.tap === 'e')]).toBe(1);
  });

  test('layer SYM: simboli con dati, gli altri neutri', () => {
    const h = heatmap(table, clavisKeymap, 'SYM', 'time');
    const posPar = clavisKeymap.layers.SYM.findIndex((k) => k.tap === '(');
    expect(h.values[posPar]).toBe(0.5); // unico dato sul layer
    expect(h.values.filter((v) => v !== null)).toHaveLength(2); // ( sta sia in riga superiore sia sul pollice
    expect(h.titles[posPar]).toContain('600 ms');
  });
});
