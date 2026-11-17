import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { clavisResolver } from '../keyboard';
import { normalizeText } from './normalize';

const resolver = clavisResolver();
const load = (f: string, lang = 'it') => JSON.parse(readFileSync(new URL(`../../../public/corpus/${lang}/${f}`, import.meta.url), 'utf8'));

describe('corpus incluso', () => {
  const words: [string, number][] = load('words.json').words;
  const sentences: [number, string][] = load('sentences.json').sentences;

  test('almeno 5.000 parole e 2.000 frasi', () => {
    expect(words.length).toBeGreaterThanOrEqual(5000);
    expect(sentences.length).toBeGreaterThanOrEqual(2000);
  });

  test('tutto digitabile su clavis', () => {
    expect(words.filter(([w]) => !resolver.canTypeAll(w))).toEqual([]);
    expect(sentences.filter(([, s]) => !resolver.canTypeAll(s))).toEqual([]);
  });

  test('parole ordinate per frequenza e con le parole brevi italiane', () => {
    for (let i = 1; i < words.length; i++) expect(words[i - 1][1]).toBeGreaterThanOrEqual(words[i][1]);
    const set = new Set(words.map(([w]) => w));
    for (const w of ['e', 'è', 'gli', 'figlio', 'meglio', 'perché']) expect(set.has(w)).toBe(true);
  });
});

describe('corpus inglese', () => {
  const words: [string, number][] = load('words.json', 'en').words;
  const sentences: [number, string][] = load('sentences.json', 'en').sentences;

  test('almeno 5.000 parole e 2.000 frasi, tutte digitabili', () => {
    expect(words.length).toBeGreaterThanOrEqual(5000);
    expect(sentences.length).toBeGreaterThanOrEqual(2000);
    expect(words.filter(([w]) => !resolver.canTypeAll(w))).toEqual([]);
    expect(sentences.filter(([, s]) => !resolver.canTypeAll(s))).toEqual([]);
  });

  test('contrazioni presenti, I maiuscola, nessun frammento di contrazione', () => {
    const set = new Set(words.map(([w]) => w));
    for (const w of ["don't", "I'm", "it's", 'I', 'the', 'keyboard']) expect(set.has(w)).toBe(true);
    for (const w of ['i', "i'm", 'don', 'didn', 're', 'll']) expect(set.has(w)).toBe(false);
  });

  test('parole ordinate per frequenza', () => {
    for (let i = 1; i < words.length; i++) expect(words[i - 1][1]).toBeGreaterThanOrEqual(words[i][1]);
  });
});

describe('normalizzazione del testo libero', () => {
  test('apostrofo tipografico', () => {
    expect(normalizeText('l’acqua', resolver)).toEqual({ text: "l'acqua", removed: 0 });
  });

  test('virgolette, trattini, puntini, spazi e a capo', () => {
    expect(normalizeText('«Ciao» — disse…\r\n  poi\tbasta', resolver).text).toBe('"Ciao" - disse... poi basta');
  });

  test('caratteri non digitabili rimossi e contati', () => {
    expect(normalizeText('costa 3€ 😀 ok', resolver)).toEqual({ text: 'costa 3 ok', removed: 2 });
  });
});
