import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { parseKeymap } from './parseKeymap';
import { Resolver } from './resolver';
import { keyGeometry } from './geometry';
import versioned from './clavis.keymap.json';
import type { Chord, Keymap } from './types';

const fixture = readFileSync(new URL('../../../tests/fixtures/custom_config.h', import.meta.url), 'utf8');
const keymap = parseKeymap(fixture, 'scipioni/clavis firmware/zmk-timeless/config/custom_config.h');
const resolver = new Resolver(keymap);
const noDead = new Resolver(keymap, { deadKeys: false });

const tapOf = (km: Keymap, c: Chord) => km.layers[c.layer][c.tap.pos].tap;
const geo = (c: Chord) => keyGeometry(c.tap.pos);

describe('keymap ricavata dal firmware', () => {
  test('riga superiore BASE e NUM', () => {
    expect(keymap.layers.BASE.slice(0, 10).map((k) => k.tap).join(' ')).toBe('q w f p b j l u y ;');
    expect(keymap.layers.NUM.slice(0, 5).map((k) => k.tap).join(' ')).toBe('[ 7 8 9 ]');
  });

  test('il JSON versionato coincide con la rigenerazione dalla fixture', () => {
    expect(versioned).toEqual(keymap);
  });

  test('scambiando due tasti nel firmware cambia la risoluzione', () => {
    const swapped = fixture.replace('&kp Q,                &kp W,', '&kp W,                &kp Q,');
    const r = new Resolver(parseKeymap(swapped));
    expect(r.resolve('q')!.strokes[0].tap.pos).toBe(1);
    expect(r.resolve('w')!.strokes[0].tap.pos).toBe(0);
  });

  test('home row mods e tasti di layer', () => {
    expect(keymap.layers.BASE[13]).toMatchObject({ tap: 't', holdMod: 'shift' });
    expect(keymap.layers.BASE[35]).toMatchObject({ tap: '\n', holdLayer: 'SYM' });
    expect(keymap.layers.BASE[36]).toMatchObject({ holdLayer: 'NUM' });
    expect(keymap.layers.BASE[30].absent).toBe(true);
  });
});

describe('geometria e dita', () => {
  test.each([
    ['a', 'L', 'pinky'],
    ['t', 'L', 'index'],
    ['n', 'R', 'index'],
    ['o', 'R', 'pinky'],
  ])('%s → %s %s', (c, hand, finger) => {
    const g = geo(resolver.resolve(c)!.strokes[0]);
    expect([g.hand, g.finger]).toEqual([hand, finger]);
  });

  test('g è in colonna interna, riga base, indice sinistro', () => {
    const g = geo(resolver.resolve('g')!.strokes[0]);
    expect(g).toMatchObject({ hand: 'L', finger: 'index', inner: true, row: 1 });
  });

  test('36 tasti presenti', () => {
    expect(Array.from({ length: 40 }, (_, i) => keyGeometry(i)).filter((k) => k.present)).toHaveLength(36);
  });
});

describe('risoluzione dei caratteri', () => {
  test('minuscola: un accordo senza tasti tenuti', () => {
    const r = resolver.resolve('e')!;
    expect(r.strokes).toHaveLength(1);
    expect(r.strokes[0].holds).toEqual([]);
    expect(tapOf(keymap, r.strokes[0])).toBe('e');
  });

  test('( : SYM tenuto dal pollice destro, battuto a sinistra', () => {
    const [c] = resolver.resolve('(')!.strokes;
    expect(c.layer).toBe('SYM');
    expect(geo(c).hand).toBe('L');
    expect(c.holds).toHaveLength(1);
    const hold = keyGeometry(c.holds[0].pos);
    expect([hold.hand, hold.finger]).toEqual(['R', 'thumb']);
    expect(keymap.layers.BASE[c.holds[0].pos].holdLayer).toBe('SYM');
  });

  test('5 : NUM col pollice destro, medio sinistro sulla riga base', () => {
    const [c] = resolver.resolve('5')!.strokes;
    expect(c.layer).toBe('NUM');
    expect(geo(c)).toMatchObject({ hand: 'L', finger: 'middle', row: 1 });
    expect(keymap.layers.BASE[c.holds[0].pos].holdLayer).toBe('NUM');
  });

  test('L : Shift sull\'indice sinistro (t)', () => {
    const [c] = resolver.resolve('L')!.strokes;
    expect(c.holds.map((h) => keymap.layers.BASE[h.pos].tap)).toEqual(['t']);
    expect(geo(c).hand).toBe('R');
  });

  test('S : Shift sull\'indice destro (n)', () => {
    const [c] = resolver.resolve('S')!.strokes;
    expect(c.holds.map((h) => keymap.layers.BASE[h.pos].tap)).toEqual(['n']);
  });

  test('" : NUM + Shift destro + mignolo sinistro su \'', () => {
    const r = noDead.resolve('"')!;
    const [c] = r.strokes;
    expect(c.layer).toBe('NUM');
    expect(tapOf(keymap, c)).toBe("'");
    expect(geo(c)).toMatchObject({ hand: 'L', finger: 'pinky' });
    const [layerKey, shift] = c.holds;
    expect(keymap.layers.BASE[layerKey.pos].holdLayer).toBe('NUM');
    expect(keymap.layers.NUM[shift.pos].holdMod).toBe('shift');
    expect(keyGeometry(shift.pos).hand).toBe('R');
  });

  test('è : ` sul NUM (mignolo sinistro, riga inferiore) poi e', () => {
    const r = resolver.resolve('è')!;
    expect(r.dead).toBe(true);
    expect(r.strokes).toHaveLength(2);
    expect(r.strokes[0].layer).toBe('NUM');
    expect(tapOf(keymap, r.strokes[0])).toBe('`');
    expect(geo(r.strokes[0])).toMatchObject({ hand: 'L', finger: 'pinky', row: 2 });
    expect(tapOf(keymap, r.strokes[1])).toBe('e');
  });

  test("' con tasti morti: ' sul NUM poi spazio col pollice sinistro", () => {
    const r = resolver.resolve("'")!;
    expect(r.strokes).toHaveLength(2);
    expect(r.strokes[0].layer).toBe('NUM');
    expect(tapOf(keymap, r.strokes[1])).toBe(' ');
    expect(geo(r.strokes[1])).toMatchObject({ hand: 'L', finger: 'thumb' });
  });

  test("' senza tasti morti: un solo accordo", () => {
    const r = noDead.resolve("'")!;
    expect(r.strokes).toHaveLength(1);
    expect(r.strokes[0].layer).toBe('NUM');
  });

  test('senza tasti morti le accentate non sono digitabili', () => {
    expect(noDead.resolve('è')).toBeNull();
  });

  test('€ non è digitabile', () => {
    expect(resolver.resolve('€')).toBeNull();
    expect(resolver.canTypeAll('caffè 3€')).toBe(false);
  });

  test('tutto l\'alfabeto italiano è digitabile', () => {
    expect(resolver.canTypeAll("abcdefghijklmnopqrstuvwxyzàèéìòù ÀÈÉ.,;:?!'\"()-0123456789")).toBe(true);
  });
});
