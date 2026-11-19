import { afterEach, describe, expect, test } from 'vitest';
import { fnLabel } from './refLabels';
import { i18n } from '../i18n/index.svelte';
import { clavisKeymap } from '../core/keyboard';

const allFns = [...new Set(Object.values(clavisKeymap.layers).flat().flatMap((a) => (a.fn ? [a.fn] : [])))];

describe('etichette delle funzioni', () => {
  afterEach(() => {
    i18n.lang = 'it';
  });

  test.each(['it', 'en'] as const)('ogni funzione della keymap ha un\'etichetta (%s)', (lang) => {
    i18n.lang = lang;
    expect(allFns.length).toBeGreaterThan(40);
    for (const fn of allFns) {
      const label = fnLabel(fn);
      expect(label, fn).not.toBeNull();
      if (fn !== 'none') expect(label, fn).not.toBe('');
    }
  });

  test('per significato, nella lingua dell\'interfaccia', () => {
    expect(['clip.cut', 'clip.copy', 'clip.paste'].map(fnLabel)).toEqual(['Taglia', 'Copia', 'Incolla']);
    i18n.lang = 'en';
    expect(['clip.cut', 'clip.copy', 'clip.paste'].map(fnLabel)).toEqual(['Cut', 'Copy', 'Paste']);
    expect(fnLabel('btn.2')).toBe('Click 2');
  });

  test('etichette composte e funzioni sconosciute', () => {
    expect(fnLabel('fkey.12')).toBe('F12');
    expect(fnLabel('bt.3')).toBe('BT 3');
    expect(fnLabel('to.SYM')).toBe('→ SYM');
    expect(fnLabel('nav.left')).toBe('←');
    expect(fnLabel('wheel.up')).toBe('Rotella\n↑');
    expect(fnLabel('none')).toBe('');
    expect(fnLabel('unknown')).toBeNull();
    expect(fnLabel('teleport.now')).toBeNull();
  });
});
