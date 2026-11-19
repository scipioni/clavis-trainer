import { describe, expect, test } from 'vitest';
import { clavisKeymap as keymap } from './index';
import { IT, US } from './osmaps';
import { layerTriggers, referenceKeys, type RefKey } from './reference';
import type { OsMap } from './osmaps';

const chars = (keys: RefKey[], from: number, to: number) => keys.slice(from, to).map((k) => k.char ?? '');
const cats = (keys: RefKey[], from: number, to: number) => keys.slice(from, to).map((k) => k.category);

describe('mappa di consultazione', () => {
  test('BASE Colemak-DH e QWERTY, gli altri layer non cambiano', () => {
    const colemak = referenceKeys(keymap, 'BASE', 'colemakdh', US);
    const qwerty = referenceKeys(keymap, 'BASE', 'qwerty', US);
    expect(chars(colemak, 0, 10).join(' ')).toBe('q w f p b j l u y ;');
    expect(chars(qwerty, 0, 10).join(' ')).toBe('q w e r t y u i o p');
    expect(referenceKeys(keymap, 'NAV', 'qwerty', US)).toEqual(referenceKeys(keymap, 'NAV', 'colemakdh', US));
  });

  test('BASE: home row mod sotto le lettere, layer sui pollici', () => {
    const k = referenceKeys(keymap, 'BASE', 'colemakdh', US);
    expect(k.slice(10, 14).map((x) => [x.char, x.mod, x.category])).toEqual([
      ['a', 'gui', 'char'], ['r', 'alt', 'char'], ['s', 'ctrl', 'char'], ['t', 'shift', 'char'],
    ]);
    expect(k.slice(32, 38).map((x) => [x.char, x.holdLayer, x.category])).toEqual([
      ['Esc', 'MEDIA', 'layer'], ['␣', 'NAV', 'layer'], ['⇥', 'MOUSE', 'layer'],
      ['⏎', 'SYM', 'layer'], ['⌫', 'NUM', 'layer'], ['⌦', 'FUN', 'layer'],
    ]);
    // z e / attivano BUTTON ma restano lettere
    expect([k[20].char, k[20].holdLayer, k[20].category]).toEqual(['z', 'BUTTON', 'char']);
    expect(k[30]).toEqual({ pos: 30, category: 'none', absent: true });
  });

  test('NUM: [ in US, è in italiano', () => {
    expect(referenceKeys(keymap, 'NUM', 'colemakdh', US)[0].char).toBe('[');
    expect(referenceKeys(keymap, 'NUM', 'colemakdh', IT)[0].char).toBe('è');
  });

  test('categorie di NAV e MEDIA', () => {
    const nav = referenceKeys(keymap, 'NAV', 'colemakdh', US);
    expect(cats(nav, 10, 14)).toEqual(['mod', 'mod', 'mod', 'mod']);
    expect(cats(nav, 15, 20)).toEqual(['nav', 'nav', 'nav', 'nav', 'nav']);
    expect(cats(nav, 0, 4)).toEqual(['sys', 'layer', 'layer', 'layer']);
    expect(cats(nav, 35, 38)).toEqual(['nav', 'nav', 'nav']);
    expect(nav[4].category).toBe('none');
    const media = referenceKeys(keymap, 'MEDIA', 'colemakdh', US);
    expect(chars(media, 1, 5)).toEqual(['7', '8', '9', '-']);
    expect(cats(media, 1, 5)).toEqual(['char', 'char', 'char', 'char']);
    expect(cats(media, 25, 30)).toEqual(['media', 'media', 'media', 'media', 'media']);
    const fun = referenceKeys(keymap, 'FUN', 'colemakdh', US);
    expect(fun[0]).toMatchObject({ fn: 'fkey.12', category: 'fkey' });
    const mouse = referenceKeys(keymap, 'MOUSE', 'colemakdh', US);
    expect(cats(mouse, 16, 20)).toEqual(['mouse', 'mouse', 'mouse', 'mouse']);
  });

  test('AltGr + keycode: livello AltGr della mappa o combinazione', () => {
    const withAltGr: OsMap = { ...US, keys: { ...US.keys, Quote: ["'", '"', '´', '¨'] } };
    expect(referenceKeys(keymap, 'NUM', 'colemakdh', withAltGr).slice(26, 28).map((k) => k.char)).toEqual(['´', '¨']);
    expect(referenceKeys(keymap, 'NUM', 'colemakdh', US).slice(26, 28).map((k) => k.char)).toEqual(["AltGr+'", 'AltGr+"']);
  });

  test('tasti che attivano un layer', () => {
    expect(layerTriggers(keymap, 'BASE')).toEqual([]);
    expect(layerTriggers(keymap, 'NAV')).toEqual([33]);
    expect(layerTriggers(keymap, 'BUTTON')).toEqual([20, 29]);
    for (const l of ['MOUSE', 'MEDIA', 'NUM', 'SYM', 'FUN'] as const) expect(layerTriggers(keymap, l)).toHaveLength(1);
  });
});
