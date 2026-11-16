import { describe, expect, test } from 'vitest';
import { clavisResolver } from '../keyboard';
import type { Sample } from '../session/session';
import { applySamples, rankAll, recompute, unexplored, updateUnit, weakest, type StatsTable, type UnitStats } from './stats';
import { unitKey, unitsOf } from './units';

const resolver = clavisResolver();

const sample = (char: string, prev: string | null, ms: number | null, errors = 0, modMisfires = 0): Sample => ({
  i: 0, char, prev, ms, errors, wrong: [], deadErrors: 0, modMisfires,
});

const fresh = (): UnitStats => ({ n: 0, nMs: 0, emaMs: null, emaErr: 0, emaMisfire: 0, misfires: 0 });

describe('unità', () => {
  test('( dopo a: carattere, bigramma, transizione BASE>SYM, dito', () => {
    const keys = unitsOf('(', 'a', resolver).map(unitKey);
    expect(keys).toEqual(['char:(', 'bigram:a(', 'layer:BASE>SYM', 'finger:L-index']);
  });

  test('è: unità tasto morto', () => {
    expect(unitsOf('è', 'p', resolver).map(unitKey)).toContain('dead:è');
  });

  test('niente bigrammi con lo spazio', () => {
    expect(unitsOf(' ', 'a', resolver).some((u) => u.type === 'bigram')).toBe(false);
  });
});

describe('statistiche', () => {
  test('miglioramento recente: la media scende senza finestra fissa', () => {
    const s = fresh();
    for (let i = 0; i < 50; i++) updateUnit(s, { ms: 400, errors: 0, modMisfires: 0 });
    expect(s.emaMs).toBeCloseTo(400);
    for (let i = 0; i < 15; i++) updateUnit(s, { ms: 200, errors: 0, modMisfires: 0 });
    expect(s.emaMs!).toBeLessThan(260);
  });

  test('esitazione lunga: tempo escluso, errore incluso', () => {
    const s = fresh();
    updateUnit(s, { ms: 150, errors: 0, modMisfires: 0 });
    updateUnit(s, { ms: 3500, errors: 1, modMisfires: 0 });
    expect(s.emaMs).toBe(150);
    expect(s.nMs).toBe(1);
    expect(s.emaErr).toBeCloseTo(0.5);
  });

  test('tempo nullo (dopo pausa) escluso', () => {
    const s = fresh();
    updateUnit(s, { ms: null, errors: 0, modMisfires: 0 });
    expect(s.emaMs).toBeNull();
    expect(s.n).toBe(1);
  });
});

/** Tabella con molti bigrammi "normali" a 200 ms e due bigrammi da confrontare. */
function tableWith(): StatsTable {
  const t: StatsTable = {};
  const put = (bg: string, ms: number, errRate: number, n = 100) => {
    const s = (t[`bigram:${bg}`] = fresh());
    for (let i = 0; i < n; i++) updateUnit(s, { ms, errors: i < errRate * n ? 1 : 0, modMisfires: 0 });
    // gli errori all'inizio pesano poco nell'EMA: li reimposto al tasso voluto
    s.emaErr = errRate;
  };
  for (const bg of ['ar', 'st', 'en', 'io', 'on', 'to', 'ra']) put(bg, 200, 0.01);
  put('ch', 200, 0.01);
  put('gl', 400, 0.08);
  put('qu', 900, 0.5, 3);
  return t;
}

describe('punteggio e classifiche', () => {
  test('gl più debole di ch', () => {
    const ranked = rankAll(tableWith(), 'bigram');
    const score = (v: string) => ranked.find((r) => r.value === v)!.score;
    expect(score('gl')).toBeGreaterThan(score('ch'));
    expect(ranked[0].value).toBe('gl');
  });

  test('pochi campioni: escluso e segnalato come poco esplorato', () => {
    const t = tableWith();
    expect(rankAll(t, 'bigram').some((r) => r.value === 'qu')).toBe(false);
    expect(unexplored(t, 'bigram')).toEqual(['bigram:qu']);
  });

  test('i 10 più deboli', () => {
    const top = weakest(tableWith(), 'bigram', 10);
    expect(top.length).toBeLessThanOrEqual(10);
    expect(top.every((r) => r.stats.n >= 5)).toBe(true);
    for (let i = 1; i < top.length; i++) expect(top[i - 1].score).toBeGreaterThanOrEqual(top[i].score);
  });

  test('i mod involontari alzano il punteggio', () => {
    const t = tableWith();
    const s = t['bigram:st'];
    for (let i = 0; i < 10; i++) updateUnit(s, { ms: 200, errors: 0, modMisfires: 1 });
    const ranked = rankAll(t, 'bigram');
    expect(ranked.findIndex((r) => r.value === 'st')).toBeLessThan(ranked.findIndex((r) => r.value === 'ch'));
  });
});

describe('ricalcolo', () => {
  test('incrementale e ricalcolo coincidono', () => {
    const s1 = { samples: [sample('c', null, null), sample('i', 'c', 180), sample('a', 'i', 150, 1)] };
    const s2 = { samples: [sample('(', 'a', 400), sample('è', '(', 600, 0, 1), sample('5', 'è', 2500)] };
    const incremental: StatsTable = {};
    applySamples(incremental, s1.samples, resolver);
    applySamples(incremental, s2.samples, resolver);
    expect(recompute([s1, s2], resolver)).toEqual(incremental);
  });
});
