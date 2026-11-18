import { describe, expect, test } from 'vitest';
import { boardFor, osMapFor, KEYBOARDS, LAYOUTS, type Board, type Profile } from './keyboard';
import {
  GUIDE_STEPS, bumpKeys, demoFrames, guideKind, guideProfile, homePads, markSeen, shouldAutoOpen, thumbKeys, thumbPads,
  type AutoOpenState,
} from './guide';
import { it as itCatalog } from '../i18n/it';

/** Carattere (minuscolo) scritto sul tasto nel layout del profilo. */
function char(p: Profile, board: Board, pos: number): string {
  const a = board.actions.BASE?.[pos];
  return a?.code ? (osMapFor(p).keys[a.code]?.[0] ?? '') : '';
}

function home(p: Profile): string[] {
  const b = boardFor(p);
  const pads = homePads(b);
  const side = (h: 'L' | 'R') => pads.filter((x) => x.hand === h).sort((a, c) => b.keys[a.pos].x - b.keys[c.pos].x).map((x) => char(p, b, x.pos));
  return [side('L').join(' '), side('R').join(' ')];
}

const PROFILES: Profile[] = KEYBOARDS.flatMap((keyboard) => LAYOUTS.map((layout) => ({ keyboard, layout })));

describe('versione della guida', () => {
  test.each(PROFILES)('$keyboard + $layout', (p) => {
    const kind = guideKind(p.keyboard);
    expect(kind).toBe(p.keyboard === 'clavis' ? 'clavis' : 'classic');
    expect(guideProfile(kind, p)).toEqual(p);
    const other = guideProfile(kind === 'clavis' ? 'classic' : 'clavis', p);
    expect(other.layout).toBe(p.layout);
    if (p.keyboard === 'clavis') expect(other.keyboard).toBe(p.layout === 'it' ? 'iso' : 'ansi');
    else expect(other.keyboard).toBe('clavis');
  });
});

describe('apertura automatica', () => {
  const base: AutoOpenState = { ready: true, interrupted: 0, sessionActive: false, open: false, kind: 'clavis', seen: [] };
  test.each<[string, Partial<AutoOpenState>, boolean]>([
    ['da aprire', {}, true],
    ['app non pronta', { ready: false }, false],
    ['sessione interrotta in sospeso', { interrupted: 1 }, false],
    ['sessione in corso', { sessionActive: true }, false],
    ['già aperta', { open: true }, false],
    ['già vista', { seen: ['clavis'] }, false],
    ['vista solo l\'altra', { seen: ['classic'] }, true],
  ])('%s', (_, patch, expected) => {
    expect(shouldAutoOpen({ ...base, ...patch })).toBe(expected);
  });

  test('chiusura: si aggiungono le versioni mostrate', () => {
    expect(markSeen([], ['clavis'])).toEqual(['clavis']);
    expect(markSeen(['classic'], ['clavis', 'classic'])).toEqual(['clavis', 'classic']);
  });
});

describe('posizione base', () => {
  test('ANSI + Colemak-DH', () => expect(home({ keyboard: 'ansi', layout: 'colemakdh' })).toEqual(['a r s t', 'n e i o']));
  test('ANSI + US QWERTY', () => expect(home({ keyboard: 'ansi', layout: 'us' })).toEqual(['a s d f', 'j k l ;']));
  test('ISO + Italiano QWERTY', () => expect(home({ keyboard: 'iso', layout: 'it' })).toEqual(['a s d f', 'j k l ò']));
  test('clavis + Colemak-DH', () => expect(home({ keyboard: 'clavis', layout: 'colemakdh' })).toEqual(['a r s t', 'n e i o']));
  test('clavis + US QWERTY', () => expect(home({ keyboard: 'clavis', layout: 'us' })).toEqual(['a s d f', 'j k l \'']));

  test.each(PROFILES)('otto dita su $keyboard + $layout', (p) => {
    expect(homePads(boardFor(p))).toHaveLength(8);
  });
});

describe('pollici, tacche e angle mod', () => {
  test('sei pollici su clavis, uno a riposo per mano', () => {
    const b = boardFor({ keyboard: 'clavis', layout: 'colemakdh' });
    expect(thumbKeys(b)).toHaveLength(6);
    expect(thumbPads(b).map((p) => p.hand)).toEqual(['L', 'R']);
  });

  test('pollici sullo spazio nella classica', () => {
    const p: Profile = { keyboard: 'iso', layout: 'it' };
    const b = boardFor(p);
    expect(thumbKeys(b).map((k) => b.actions.BASE?.[k.pos]?.code)).toEqual(['Space']);
    expect(thumbPads(b)).toHaveLength(2);
  });

  test('tacche su F e J fisici, qualunque layout', () => {
    const p: Profile = { keyboard: 'ansi', layout: 'colemakdh' };
    const b = boardFor(p);
    expect(bumpKeys(b).map((pos) => char(p, b, pos))).toEqual(['t', 'n']);
    expect(bumpKeys(boardFor({ keyboard: 'clavis', layout: 'us' }))).toEqual([]);
  });

  test('angle mod: primo tasto lettera in basso a sinistra all\'anulare con Colemak-DH, al mignolo con US', () => {
    const first = (p: Profile) => {
      const b = boardFor(p);
      return b.keys.filter((k) => k.row === 3 && b.actions.BASE?.[k.pos]?.code?.startsWith('Key')).sort((a, c) => a.x - c.x)[0];
    };
    expect(first({ keyboard: 'ansi', layout: 'colemakdh' }).finger).toBe('ring');
    expect(first({ keyboard: 'ansi', layout: 'us' }).finger).toBe('pinky');
  });
});

describe('passi', () => {
  test('ordine dei passi', () => {
    expect(GUIDE_STEPS.clavis.map((s) => s.id)).toEqual(['welcome', 'halves', 'home', 'columns', 'thumbs', 'hold', 'ready']);
    expect(GUIDE_STEPS.classic.map((s) => s.id)).toEqual(['welcome', 'bumps', 'home', 'zones', 'thumbs', 'ready']);
  });

  test('testi di ogni passo nel catalogo', () => {
    const cat = itCatalog as Record<string, unknown>;
    for (const kind of ['clavis', 'classic'] as const) {
      for (const s of GUIDE_STEPS[kind]) {
        expect(cat[`guide.${kind}.${s.id}.title`], `${kind}.${s.id}`).toBeTruthy();
        expect(cat[`guide.${kind}.${s.id}.body`], `${kind}.${s.id}`).toBeTruthy();
      }
    }
  });

  test('demo: maiuscola con lo Shift destro, layer NUM e SYM su clavis', () => {
    const clavis = boardFor({ keyboard: 'clavis', layout: 'colemakdh' });
    const hold = demoFrames(clavis, GUIDE_STEPS.clavis.find((s) => s.id === 'hold')!);
    expect(hold.map((f) => f.caption)).toEqual(['rest', 'shift', 'num', 'sym']);
    expect(hold.map((f) => f.layer)).toEqual(['BASE', 'BASE', 'NUM', 'SYM']);
    const ansi = boardFor({ keyboard: 'ansi', layout: 'us' });
    const shift = demoFrames(ansi, GUIDE_STEPS.classic.find((s) => s.id === 'thumbs')!);
    expect(shift[1].holds.map((p) => ansi.actions.BASE?.[p]?.label)).toEqual(['⇧']);
    expect(ansi.keys[shift[1].holds[0]].hand).toBe('R');
    expect(shift[1].moves[0]).toMatchObject({ hand: 'R', finger: 'pinky' });
  });
});
