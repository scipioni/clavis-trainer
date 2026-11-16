import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { clavisResolver } from '../keyboard';
import type { StatsTable, UnitStats } from '../analysis/stats';
import { ExerciseGenerator, type AdaptiveOptions, type Corpus } from './generator';
import { seededRng } from './random';

const load = (f: string) => JSON.parse(readFileSync(new URL(`../../../public/corpus/${f}`, import.meta.url), 'utf8'));
const corpus: Corpus = { words: load('words.json').words, sentences: load('sentences.json').sentences };
const gen = new ExerciseGenerator(corpus, clavisResolver());

const stat = (emaMs: number, emaErr = 0.02, n = 50): UnitStats => ({ n, nMs: n, emaMs, emaErr, emaMisfire: 0, misfires: 0 });

/** Bigrammi comuni a tempo medio, più un'unità debole. */
function statsWithWeak(weakKey: string, ms = 600, err = 0.15): StatsTable {
  const t: StatsTable = {};
  for (const bg of ['er', 're', 'en', 'ch', 'co', 'on', 'to', 'st', 'ra', 'la', 'di', 'no']) t[`bigram:${bg}`] = stat(200);
  for (const c of 'aeionrstl') t[`char:${c}`] = stat(180);
  t[weakKey] = stat(ms, err);
  return t;
}

const plain: AdaptiveOptions = { words: 3000, capitals: 0, punctuation: 0, digits: 0 };
const share = (text: string, re: RegExp) => {
  const words = text.split(' ');
  return words.filter((w) => re.test(w)).length / words.length;
};

describe('modalità adattiva', () => {
  test('nessun dato: parole frequenti del corpus', () => {
    const text = gen.adaptive({}, { ...plain, words: 200 }, seededRng(1));
    const vocab = new Set(corpus.words.map(([w]) => w));
    const words = text.split(' ');
    expect(words).toHaveLength(200);
    expect(words.every((w) => vocab.has(w))).toBe(true);
  });

  test('con gl debole, gl compare molto più che scegliendo per frequenza', () => {
    const baseline = share(gen.adaptive({}, plain, seededRng(2)), /gl/);
    const targeted = share(gen.adaptive(statsWithWeak('bigram:gl'), plain, seededRng(2)), /gl/);
    expect(targeted).toBeGreaterThan(baseline * 3);
    expect(targeted).toBeGreaterThan(0.3);
  });

  test('solo minuscole', () => {
    const text = gen.adaptive(statsWithWeak('char:('), { ...plain, words: 500 }, seededRng(3));
    expect(text).toMatch(/^[a-zàèéìòù ]+$/);
  });

  test('transizione BASE>NUM debole con cifre abilitate: compaiono numeri', () => {
    const opts = { ...plain, words: 300, digits: 0.01 };
    const text = gen.adaptive(statsWithWeak('layer:BASE>NUM', 700, 0.2), opts, seededRng(4));
    expect(text).toMatch(/[0-9]/);
    const numbers = text.split(' ').filter((w) => /^[0-9]+$/.test(w)).length;
    const baseline = gen.adaptive({}, opts, seededRng(4)).split(' ').filter((w) => /^[0-9]+$/.test(w)).length;
    expect(numbers).toBeGreaterThan(baseline);
  });

  test('con punteggiatura e maiuscole: tutto digitabile', () => {
    const text = gen.adaptive({}, { words: 500, capitals: 0.3, punctuation: 0.4, digits: 0.1 }, seededRng(5));
    expect(clavisResolver().canTypeAll(text)).toBe(true);
    expect(text).toMatch(/[A-Z]/);
    expect(text).toMatch(/[,.;:?!()"']/);
    expect(text).toMatch(/[0-9]/);
  });

  test('allenamento mirato: la maggior parte delle parole contiene l\'unità', () => {
    const text = gen.adaptive({}, { ...plain, words: 500, focus: 'bigram:gl' }, seededRng(6));
    expect(share(text, /gl/)).toBeGreaterThan(0.8);
  });
});

describe('modalità frasi', () => {
  const accentRate = (text: string) => (text.match(/[àèéìòù']/g)?.length ?? 0) / text.length;

  test('con tasti morti deboli: più accentate e apostrofi della media del corpus', () => {
    const t = statsWithWeak('dead:è', 700, 0.2);
    t["dead:'"] = stat(700, 0.2);
    t['dead:à'] = stat(650, 0.2);
    const corpusRate = accentRate(corpus.sentences.map(([, s]) => s).join(' '));
    const text = gen.sentences(t, 300, seededRng(7));
    expect(accentRate(text)).toBeGreaterThan(corpusRate * 1.5);
  });

  test('frasi reali, senza ripetizioni', () => {
    const text = gen.sentences({}, 50, seededRng(8));
    const set = new Set(corpus.sentences.map(([, s]) => s));
    // ricompongo le frasi: ogni frase del corpus termina con . ? ! o "
    let found = 0;
    for (const s of set) if (text.includes(s)) found++;
    expect(found).toBeGreaterThanOrEqual(50);
  });
});

describe('esplorazione', () => {
  test('le unità poco esplorate non soffocano i punti deboli', () => {
    const t = statsWithWeak('bigram:gl');
    for (const bg of ['ab', 'ac', 'ad', 'af', 'ag', 'al', 'am', 'an', 'ap', 'ar', 'as', 'at', 'av', 'az']) {
      t[`bigram:z${bg}`] = stat(300, 0, 2);
    }
    const targets = gen.targets(t);
    const total = targets.reduce((a, x) => a + x.weight, 0);
    const explore = targets.filter((x) => t[x.key].n < 5).reduce((a, x) => a + x.weight, 0);
    expect(explore / total).toBeCloseTo(0.2);
  });
});
