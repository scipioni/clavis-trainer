import { describe, expect, test } from 'vitest';
import { it } from './it';
import { en } from './en';
import { detectLanguage, fmtPct, i18n, t } from './index.svelte';

describe('cataloghi', () => {
  test('stesse chiavi in italiano e inglese', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(it).sort());
  });

  test('stessi tipi di voce (testo o funzione)', () => {
    for (const k of Object.keys(it) as (keyof typeof it)[]) expect(typeof en[k]).toBe(typeof it[k]);
  });

  test('t() segue la lingua attiva, con parametri', () => {
    i18n.lang = 'en';
    expect(t('nav.train')).toBe('Practice');
    expect(t('msg.imported', 3)).toBe('Imported 3 sessions.');
    i18n.lang = 'it';
    expect(t('msg.imported', 1)).toBe('Importate 1 sessione.');
  });
});

describe('lingua iniziale e formati', () => {
  test('dal browser', () => {
    expect(detectLanguage(['de-DE', 'it'])).toBe('en');
    expect(detectLanguage(['it-IT', 'en'])).toBe('it');
    expect(detectLanguage(['IT'])).toBe('it');
    expect(detectLanguage([])).toBe('en');
  });

  test('percentuali col separatore della lingua', () => {
    i18n.lang = 'en';
    expect(fmtPct(0.955)).toBe('95.5%');
    i18n.lang = 'it';
    expect(fmtPct(0.955)).toMatch(/^95,5\s?%$/);
  });
});
