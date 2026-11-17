import { describe, expect, test } from 'vitest';
import { MAX_SESSION_BYTES, normalizeSettings, validSession, DEFAULT_SETTINGS, type StoredSession } from './data';
import { computeResult } from './session/result';
import type { Sample } from './session/session';

const sample = (i: number): Sample => ({ i, char: 'a', prev: i ? 'a' : null, ms: i ? 150 : null, errors: 0, wrong: [], deadErrors: 0, modMisfires: 0 });

function session(n: number, id = 's1'): StoredSession {
  const samples = Array.from({ length: n }, (_, i) => sample(i));
  return { id, startedAt: 1, mode: 'adaptive', durationMs: null, status: 'completed', deadKeys: true, samples, result: computeResult(samples, 1000) };
}

describe('validazione delle sessioni', () => {
  test('sessione normale', () => expect(validSession(session(300))).toBe(true));

  test('sessione oltre il limite di dimensione', () => {
    const big = session(6000);
    expect(JSON.stringify(big).length).toBeGreaterThan(MAX_SESSION_BYTES);
    expect(validSession(big)).toBe(false);
  });

  test('id mancante o troppo lungo, sessione in corso, campioni assenti', () => {
    expect(validSession(session(3, ''))).toBe(false);
    expect(validSession(session(3, 'x'.repeat(65)))).toBe(false);
    expect(validSession({ ...session(3), status: 'in-progress' })).toBe(false);
    expect(validSession({ ...session(3), samples: undefined })).toBe(false);
  });
});

describe('impostazioni', () => {
  test('campi mancanti presi dai predefiniti, campi estranei scartati', () => {
    expect(normalizeSettings({ deadKeys: false, intruso: 1 })).toEqual({ ...DEFAULT_SETTINGS, deadKeys: false });
  });

  test('valori fuori dai limiti rifiutati', () => {
    expect(normalizeSettings({ capitals: 3 })).toBeNull();
    expect(normalizeSettings({ mode: 'altro' })).toBeNull();
    expect(normalizeSettings('x')).toBeNull();
  });
});

describe('profilo e lingua', () => {
  test('sessione di una versione precedente (senza profilo) accettata e attribuita a clavis + Colemak-DH in italiano', async () => {
    const { sessionProfile, sessionLang } = await import('./data');
    const old = session(3);
    expect(validSession(old)).toBe(true);
    expect(sessionProfile(old)).toEqual({ keyboard: 'clavis', layout: 'colemakdh' });
    expect(sessionLang(old)).toBe('it');
  });

  test('profilo conosciuto accettato, sconosciuto rifiutato', () => {
    expect(validSession({ ...session(3), keyboard: 'iso', layout: 'it', lang: 'en' })).toBe(true);
    expect(validSession({ ...session(3), layout: 'dvorak' })).toBe(false);
    expect(validSession({ ...session(3), keyboard: 'ergodox' })).toBe(false);
    expect(validSession({ ...session(3), lang: 'de' })).toBe(false);
  });

  test('impostazioni vecchie completate con profilo e lingue predefiniti', () => {
    const old = { mode: 'adaptive', durationSec: 60, deadKeys: true, showKeyboard: false, capitals: 0.1, punctuation: 0.1, digits: 0 };
    expect(normalizeSettings(old)).toMatchObject({ keyboard: 'clavis', layout: 'colemakdh', uiLang: 'it', exerciseLang: 'it', showKeyboard: false });
    expect(normalizeSettings({ ...old, layout: 'dvorak' })).toBeNull();
  });
});
