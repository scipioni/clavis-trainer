import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { parseKeymap, parseToken, unknownTokens } from './parseKeymap';
import { Resolver } from './resolver';
import { keyGeometry } from './geometry';
import { clavisBoard } from './boards';
import { IT, US, OS_MAPS } from './osmaps';
import { boardFor, osMapFor, resolverFor } from './index';
import versioned from './clavis.keymap.json';
import type { Chord, KeyAction, KeyboardId, LayoutId, Profile } from './types';

const fixture = readFileSync(new URL('../../../tests/fixtures/custom_config.h', import.meta.url), 'utf8');
const keymap = parseKeymap(fixture, 'scipioni/clavis firmware/zmk-timeless/config/custom_config.h');

const P = (keyboard: KeyboardId, layout: LayoutId): Profile => ({ keyboard, layout });
const CLAVIS = P('clavis', 'colemakdh');
const resolver = resolverFor(CLAVIS);
const noDead = resolverFor(CLAVIS, { deadKeys: false });

/** Carattere prodotto dal tasto battuto, al livello normale del sistema. */
const tapChar = (r: Resolver, c: Chord) => {
  const a = r.board.actions[c.layer]![c.tap.pos];
  return a.code ? r.os.keys[a.code]?.[a.shift ? 1 : 0] : undefined;
};
const key = (r: Resolver, c: Chord) => r.board.keys[c.tap.pos];
const holdAction = (r: Resolver, ref: { layer: string; pos: number }): KeyAction =>
  r.board.actions[ref.layer as 'BASE']![ref.pos];

describe('keymap ricavata dal firmware', () => {
  test('con il sistema in US: riga superiore BASE e NUM', () => {
    const chars = (layer: 'BASE' | 'NUM', n: number) =>
      keymap.layers[layer].slice(0, n).map((a) => (a.code ? US.keys[a.code]![a.shift ? 1 : 0] : '')).join(' ');
    expect(chars('BASE', 10)).toBe('q w f p b j l u y ;');
    expect(chars('NUM', 5)).toBe('[ 7 8 9 ]');
  });

  test('il JSON versionato coincide con la rigenerazione dalla fixture', () => {
    expect(versioned).toEqual(keymap);
  });

  test('scambiando due tasti nel firmware cambia la risoluzione', () => {
    const swapped = fixture.replace('&kp Q,                &kp W,', '&kp W,                &kp Q,');
    const r = new Resolver(clavisBoard(parseKeymap(swapped), 'colemakdh'), US);
    expect(r.resolve('q')!.strokes[0].tap.pos).toBe(1);
    expect(r.resolve('w')!.strokes[0].tap.pos).toBe(0);
  });

  test('keycode e shift impliciti: LPAR = Shift+Digit9, RALT = AltGr', () => {
    const par = keymap.layers.SYM.find((a) => a.code === 'Digit9');
    expect(par).toMatchObject({ code: 'Digit9', shift: true });
    expect(keymap.layers.BASE[21]).toMatchObject({ code: 'KeyX', holdMod: 'altgr' });
  });

  test('home row mods e tasti di layer', () => {
    expect(keymap.layers.BASE[13]).toMatchObject({ code: 'KeyT', holdMod: 'shift' });
    expect(keymap.layers.BASE[35]).toMatchObject({ code: 'Enter', holdLayer: 'SYM' });
    expect(keymap.layers.BASE[36]).toMatchObject({ holdLayer: 'NUM' });
    expect(keymap.layers.BASE[30].absent).toBe(true);
  });

  test('base QWERTY: riga superiore q w e r t y u i o p, NUM e SYM del firmware', () => {
    const r = resolverFor(P('clavis', 'us'));
    const top = r.board.actions.BASE!.slice(0, 10).map((a) => US.keys[a.code!]![0]).join(' ');
    expect(top).toBe('q w e r t y u i o p');
    expect(r.board.actions.NUM).toBe(boardFor(CLAVIS).actions.NUM);
  });
});

describe('keymap: tutti i layer e le azioni senza testo', () => {
  const fns = (layer: keyof typeof keymap.layers, from: number, to: number) =>
    keymap.layers[layer].slice(from, to).map((a) => a.fn ?? a.code);

  test('8 layer da 40 posizioni, nessun token sconosciuto', () => {
    expect(Object.keys(keymap.layers)).toEqual(['BASE', 'NAV', 'MOUSE', 'MEDIA', 'NUM', 'SYM', 'FUN', 'BUTTON']);
    for (const l of Object.values(keymap.layers)) expect(l).toHaveLength(40);
    expect(unknownTokens(fixture)).toEqual([]);
    expect(Object.values(keymap.layers).flat().filter((a) => a.fn === 'unknown')).toEqual([]);
  });

  test('NAV: frecce sulla riga base destra, Ctrl+X = Taglia', () => {
    expect(fns('NAV', 16, 20)).toEqual(['nav.left', 'nav.down', 'nav.up', 'nav.right']);
    expect(fns('NAV', 21, 24)).toEqual(['clip.cut', 'clip.copy', 'clip.paste']);
    expect(fns('NAV', 5, 10)).toEqual(['clip.redo', 'clip.paste', 'clip.copy', 'clip.cut', 'clip.undo']);
  });

  test('MEDIA: tastierino a sinistra, volume e Bluetooth a destra', () => {
    expect(fns('MEDIA', 1, 4)).toEqual(['Numpad7', 'Numpad8', 'Numpad9']);
    expect(fns('MEDIA', 20, 24)).toEqual(['Numpad0', 'Numpad1', 'Numpad2', 'Numpad3']);
    expect(fns('MEDIA', 16, 20)).toEqual(['media.prev', 'media.volDn', 'media.volUp', 'media.next']);
    expect(fns('MEDIA', 25, 30)).toEqual(['out.toggle', 'bt.0', 'bt.1', 'bt.2', 'bt.3']);
    expect(keymap.layers.MEDIA[0].fn).toBe('none');
  });

  test('altri layer: F-keys, mouse, clic, cambio layer, boot', () => {
    expect(fns('FUN', 0, 4)).toEqual(['fkey.12', 'fkey.7', 'fkey.8', 'fkey.9']);
    expect(fns('MOUSE', 16, 20)).toEqual(['mouse.left', 'mouse.down', 'mouse.up', 'mouse.right']);
    expect(fns('BUTTON', 32, 35)).toEqual(['btn.3', 'btn.1', 'btn.2']);
    expect(fns('SYM', 6, 10)).toEqual(['to.BASE', 'to.EXTRA', 'to.TAP', 'sys.boot']);
  });

  test('AltGr + keycode fuori dalla risoluzione', () => {
    expect(keymap.layers.NUM[26]).toEqual({ label: '', altgr: { code: 'Quote' } });
    expect(keymap.layers.NUM[27]).toEqual({ label: '', altgr: { code: 'Quote', shift: true } });
    expect(keymap.layers.NUM[26].code).toBeUndefined();
  });

  test('token inventato: sconosciuto, senza rompere la conversione', () => {
    expect(parseToken('&u_teleport')).toEqual({ label: '', fn: 'unknown' });
    expect(parseToken('&kp WARP_DRIVE').fn).toBe('unknown');
    const broken = fixture.replace('&kp C_MUTE', '&u_teleport');
    expect(unknownTokens(broken)).toEqual(['MEDIA: &u_teleport']);
    expect(parseKeymap(broken).layers.MEDIA[37].fn).toBe('unknown');
  });

  test('risoluzione invariata: 7 sul layer NUM, non sul tastierino di MEDIA', () => {
    const r = resolver.resolve('7')!;
    expect(r.strokes).toHaveLength(1);
    expect(r.strokes[0].layer).toBe('NUM');
  });
});

describe('mappe dei sistemi operativi', () => {
  test('quattro livelli', () => {
    expect(IT.keys.Digit9).toEqual(['9', ')', ']']);
    expect(US.keys.Quote).toEqual(["'", '"']);
    expect(IT.keys.BracketLeft).toEqual(['è', 'é', '[', '{']);
    expect(OS_MAPS['colemakdh-ansi'].keys.KeyB).toEqual(['z', 'Z']);
    expect(OS_MAPS['colemakdh-iso'].keys.KeyB).toEqual(['\\', '|']);
    expect(OS_MAPS['colemakdh-iso'].keys.IntlBackslash).toEqual(['z', 'Z']);
  });

  test('profilo → mappa', () => {
    expect(osMapFor(P('clavis', 'colemakdh')).id).toBe('us');
    expect(osMapFor(P('clavis', 'it')).id).toBe('it');
    expect(osMapFor(P('ansi', 'colemakdh')).id).toBe('colemakdh-ansi');
    expect(osMapFor(P('iso', 'colemakdh')).id).toBe('colemakdh-iso');
  });
});

describe('clavis: geometria e dita', () => {
  test.each([
    ['a', 'L', 'pinky'],
    ['t', 'L', 'index'],
    ['n', 'R', 'index'],
    ['o', 'R', 'pinky'],
  ])('%s → %s %s', (c, hand, finger) => {
    const g = key(resolver, resolver.resolve(c)!.strokes[0]);
    expect([g.hand, g.finger]).toEqual([hand, finger]);
  });

  test('g è in colonna interna, riga base, indice sinistro', () => {
    expect(key(resolver, resolver.resolve('g')!.strokes[0])).toMatchObject({ hand: 'L', finger: 'index', inner: true, row: 1 });
  });

  test('36 tasti presenti', () => {
    expect(Array.from({ length: 40 }, (_, i) => keyGeometry(i)).filter((k) => k.present)).toHaveLength(36);
  });
});

describe('clavis + Colemak-DH: risoluzione', () => {
  test('minuscola: un accordo senza tasti tenuti', () => {
    const r = resolver.resolve('e')!;
    expect(r.strokes).toHaveLength(1);
    expect(r.strokes[0].holds).toEqual([]);
    expect(tapChar(resolver, r.strokes[0])).toBe('e');
  });

  test('( : SYM tenuto dal pollice destro, battuto a sinistra', () => {
    const [c] = resolver.resolve('(')!.strokes;
    expect(c.layer).toBe('SYM');
    expect(key(resolver, c).hand).toBe('L');
    expect(c.holds).toHaveLength(1);
    const hold = resolver.board.keys[c.holds[0].pos];
    expect([hold.hand, hold.finger]).toEqual(['R', 'thumb']);
    expect(holdAction(resolver, c.holds[0]).holdLayer).toBe('SYM');
  });

  test('5 : NUM col pollice destro, medio sinistro sulla riga base', () => {
    const [c] = resolver.resolve('5')!.strokes;
    expect(c.layer).toBe('NUM');
    expect(key(resolver, c)).toMatchObject({ hand: 'L', finger: 'middle', row: 1 });
    expect(holdAction(resolver, c.holds[0]).holdLayer).toBe('NUM');
  });

  test("L : Shift sull'indice sinistro (t)", () => {
    const [c] = resolver.resolve('L')!.strokes;
    expect(c.holds.map((h) => holdAction(resolver, h).code)).toEqual(['KeyT']);
    expect(key(resolver, c).hand).toBe('R');
  });

  test("S : Shift sull'indice destro (n)", () => {
    const [c] = resolver.resolve('S')!.strokes;
    expect(c.holds.map((h) => holdAction(resolver, h).code)).toEqual(['KeyN']);
  });

  test('" : NUM + Shift destro + mignolo sinistro su \'', () => {
    const [c] = noDead.resolve('"')!.strokes;
    expect(c.layer).toBe('NUM');
    expect(tapChar(noDead, c)).toBe("'");
    expect(key(noDead, c)).toMatchObject({ hand: 'L', finger: 'pinky' });
    const [layerKey, shift] = c.holds;
    expect(holdAction(noDead, layerKey).holdLayer).toBe('NUM');
    expect(holdAction(noDead, shift).holdMod).toBe('shift');
    expect(noDead.board.keys[shift.pos].hand).toBe('R');
  });

  test('è : ` sul NUM (mignolo sinistro, riga inferiore) poi e', () => {
    const r = resolver.resolve('è')!;
    expect(r.dead).toBe(true);
    expect(r.strokes).toHaveLength(2);
    expect(r.strokes[0].layer).toBe('NUM');
    expect(tapChar(resolver, r.strokes[0])).toBe('`');
    expect(key(resolver, r.strokes[0])).toMatchObject({ hand: 'L', finger: 'pinky', row: 2 });
    expect(tapChar(resolver, r.strokes[1])).toBe('e');
  });

  test("' con tasti morti: ' sul NUM poi spazio col pollice sinistro", () => {
    const r = resolver.resolve("'")!;
    expect(r.strokes).toHaveLength(2);
    expect(r.strokes[0].layer).toBe('NUM');
    expect(tapChar(resolver, r.strokes[1])).toBe(' ');
    expect(key(resolver, r.strokes[1])).toMatchObject({ hand: 'L', finger: 'thumb' });
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

  test("tutto l'alfabeto italiano è digitabile", () => {
    expect(resolver.canTypeAll("abcdefghijklmnopqrstuvwxyzàèéìòù ÀÈÉ.,;:?!'\"()-0123456789")).toBe(true);
  });
});

describe('clavis con altri layout', () => {
  test('stesso keycode, sistema diverso: è con clavis + Italiano QWERTY', () => {
    const r = resolverFor(P('clavis', 'it'));
    const res = r.resolve('è')!;
    expect(res.dead).toBe(false);
    expect(res.strokes).toHaveLength(1);
    expect(res.strokes[0].layer).toBe('NUM');
    expect(r.board.actions.NUM![res.strokes[0].tap.pos].code).toBe('BracketLeft');
  });

  test('stesso tasto del SYM: ( in US, ) in italiano', () => {
    const us = resolverFor(CLAVIS);
    const it = resolverFor(P('clavis', 'it'));
    const pos = us.resolve('(')!.strokes[0].tap.pos;
    expect(it.os.keys[it.board.actions.SYM![pos].code!]![1]).toBe(')');
  });

  test('home row mod con la base QWERTY: K tiene Shift su f', () => {
    const r = resolverFor(P('clavis', 'us'));
    const [c] = r.resolve('K')!.strokes;
    expect(c.holds.map((h) => r.board.actions.BASE![h.pos].code)).toEqual(['KeyF']);
    expect(key(r, c).hand).toBe('R');
  });
});

describe('tastiera classica', () => {
  test('dita standard: f j b 5 6 e spazio (ANSI, US)', () => {
    const r = resolverFor(P('ansi', 'us'));
    const f = (c: string) => {
      const k = r.keyOf(c)!;
      return `${k.hand}-${k.finger}`;
    };
    expect(['f', 'j', 'b', '5', '6', ' '].map(f)).toEqual(['L-index', 'R-index', 'L-index', 'L-index', 'R-index', 'R-thumb']);
  });

  test('Colemak-DH: t indice sinistro in riga base, d indice sinistro in riga inferiore', () => {
    for (const kb of ['ansi', 'iso'] as const) {
      const r = resolverFor(P(kb, 'colemakdh'));
      expect(r.keyOf('t')).toMatchObject({ hand: 'L', finger: 'index', row: 2 });
      expect(r.keyOf('d')).toMatchObject({ hand: 'L', finger: 'index', row: 3 });
    }
    // angle mod ISO: z sul tasto in più col mignolo
    expect(resolverFor(P('iso', 'colemakdh')).keyOf('z')).toMatchObject({ hand: 'L', finger: 'pinky' });
  });

  test('maiuscola: Shift destro col mignolo, a col mignolo sinistro', () => {
    const r = resolverFor(P('ansi', 'us'));
    const [c] = r.resolve('A')!.strokes;
    expect(key(r, c)).toMatchObject({ hand: 'L', finger: 'pinky' });
    expect(c.holds).toHaveLength(1);
    expect(r.board.keys[c.holds[0].pos]).toMatchObject({ hand: 'R', finger: 'pinky' });
    expect(r.board.actions.BASE![c.holds[0].pos].holdMod).toBe('shift');
  });

  test('chiocciola in italiano: AltGr col pollice destro + ò col mignolo destro', () => {
    const r = resolverFor(P('iso', 'it'));
    const [c] = r.resolve('@')!.strokes;
    expect(r.board.actions.BASE![c.tap.pos].code).toBe('Semicolon');
    expect(key(r, c)).toMatchObject({ hand: 'R', finger: 'pinky' });
    expect(r.board.actions.BASE![c.holds[0].pos].holdMod).toBe('altgr');
    expect(r.board.keys[c.holds[0].pos]).toMatchObject({ hand: 'R', finger: 'thumb' });
  });

  test('tasto ISO in più: < col mignolo sinistro; in ANSI non digitabile', () => {
    const iso = resolverFor(P('iso', 'it'));
    const [c] = iso.resolve('<')!.strokes;
    expect(iso.board.actions.BASE![c.tap.pos].code).toBe('IntlBackslash');
    expect(key(iso, c)).toMatchObject({ hand: 'L', finger: 'pinky' });
    expect(resolverFor(P('ansi', 'it')).resolve('<')).toBeNull();
  });

  test('accentate italiane dirette; é con lo Shift sinistro', () => {
    const r = resolverFor(P('iso', 'it'));
    for (const c of ['à', 'ò', 'ù', 'ì', 'é']) expect(r.resolve(c)!.strokes).toHaveLength(1);
    const [e] = r.resolve('é')!.strokes;
    expect(r.board.keys[e.holds[0].pos].hand).toBe('L');
  });

  test("layout italiano: ' senza tasti morti", () => {
    const r = resolverFor(P('iso', 'it'));
    expect(r.resolve("'")!.strokes).toHaveLength(1);
    expect(r.deadKeysActive).toBe(false);
  });

  test('niente layer sulla tastiera classica', () => {
    const r = resolverFor(P('ansi', 'us'));
    expect(r.hasLayers).toBe(false);
    expect(r.layerOf('(')).toBe('BASE');
  });
});
