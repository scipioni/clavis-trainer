import { describe, expect, test } from 'vitest';
import { resolverFor, KEYBOARDS, LAYOUTS } from '../keyboard';
import { ALPHABET, LANGS } from './languages';

/**
 * Caratteri delle lingue che ogni profilo non sa produrre (tasti morti attivi
 * dove la mappa lo consente). Valori motivati:
 * - clavis con base QWERTY: il firmware non ha `;` (sulla base Colemak-DH sta
 *   dove QWERTY mette `p`, e il NUM ha `'` al posto di `;`); in italiano lo
 *   stesso keycode dà `ò`, che quindi manca;
 * - mappa italiana: le maiuscole accentate non hanno un tasto.
 */
const EXPECTED: Record<string, string> = {
  'clavis:colemakdh it': '', 'clavis:colemakdh en': '',
  'clavis:us it': ';', 'clavis:us en': ';',
  'clavis:it it': 'òÀÈÉÌÒÙ', 'clavis:it en': '',
  'ansi:colemakdh it': '', 'ansi:colemakdh en': '',
  'ansi:us it': '', 'ansi:us en': '',
  'ansi:it it': 'ÀÈÉÌÒÙ', 'ansi:it en': '',
  'iso:colemakdh it': '', 'iso:colemakdh en': '',
  'iso:us it': '', 'iso:us en': '',
  'iso:it it': 'ÀÈÉÌÒÙ', 'iso:it en': '',
};

describe('caratteri non raggiungibili per profilo e lingua', () => {
  for (const keyboard of KEYBOARDS) for (const layout of LAYOUTS) for (const lang of LANGS) {
    test(`${keyboard}:${layout} ${lang}`, () => {
      const r = resolverFor({ keyboard, layout });
      expect(r.unreachable(ALPHABET[lang]).join('')).toBe(EXPECTED[`${keyboard}:${layout} ${lang}`]);
    });
  }

  test('È non digitabile con classica ISO + Italiano QWERTY', () => {
    expect(resolverFor({ keyboard: 'iso', layout: 'it' }).unreachable(ALPHABET.it)).toContain('È');
  });
});
