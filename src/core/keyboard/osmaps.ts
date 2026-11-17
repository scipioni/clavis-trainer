/**
 * Mappe dei sistemi operativi: keycode (nomi di `KeyboardEvent.code`, cioè la
 * posizione sulla tastiera US) → caratteri ai quattro livelli
 * [normale, Shift, AltGr, AltGr+Shift].
 *
 * Fonti: XKB `us`, `us(colemak_dh)`, `us(colemak_dh_iso)`, `it` (basic +
 * latin(type4)). Della mappa italiana si tengono solo ASCII, accentate e pochi
 * simboli comuni: niente AltGr "latin" sulle lettere (AltGr+q = @ esiste solo
 * su Linux; su Windows @ è AltGr+ò come qui).
 */
export type Code = string;
export type Levels = readonly [string?, string?, string?, string?];

export type OsMapId = 'us' | 'it' | 'colemakdh-ansi' | 'colemakdh-iso';

export interface OsMap {
  id: OsMapId;
  keys: Readonly<Record<Code, Levels>>;
  /** Mappa basata sul layout US: i tasti morti di US International si possono attivare. */
  usBased: boolean;
}

const letters = 'abcdefghijklmnopqrstuvwxyz';
const letterKeys = (map: Record<string, string> = {}): Record<Code, Levels> =>
  Object.fromEntries(
    [...letters].map((l) => {
      const out = map[l] ?? l;
      return [`Key${l.toUpperCase()}`, [out, out.toUpperCase()]];
    }),
  );

const NUMPAD: Record<Code, Levels> = {
  ...Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`Numpad${i}`, [String(i)]])),
  NumpadDecimal: ['.'],
  NumpadSubtract: ['-'],
  NumpadAdd: ['+'],
  NumpadMultiply: ['*'],
  NumpadDivide: ['/'],
};

const US_SYMBOLS: Record<Code, Levels> = {
  Backquote: ['`', '~'],
  Digit1: ['1', '!'],
  Digit2: ['2', '@'],
  Digit3: ['3', '#'],
  Digit4: ['4', '$'],
  Digit5: ['5', '%'],
  Digit6: ['6', '^'],
  Digit7: ['7', '&'],
  Digit8: ['8', '*'],
  Digit9: ['9', '('],
  Digit0: ['0', ')'],
  Minus: ['-', '_'],
  Equal: ['=', '+'],
  BracketLeft: ['[', '{'],
  BracketRight: [']', '}'],
  Backslash: ['\\', '|'],
  Semicolon: [';', ':'],
  Quote: ["'", '"'],
  Comma: [',', '<'],
  Period: ['.', '>'],
  Slash: ['/', '?'],
  Space: [' ', ' '],
  ...NUMPAD,
};

export const US: OsMap = { id: 'us', usBased: true, keys: { ...US_SYMBOLS, ...letterKeys() } };

/** Colemak-DH sulla tastiera classica (angle mod): cambiano solo le lettere e `;`. */
const COLEMAK_DH: Record<string, string> = {
  e: 'f', r: 'p', t: 'b', y: 'j', u: 'l', i: 'u', o: 'y',
  s: 'r', d: 's', f: 't', h: 'm', j: 'n', k: 'e', l: 'i',
  z: 'x', x: 'c', c: 'd', b: 'z', n: 'k', m: 'h',
};

const colemakKeys = (): Record<Code, Levels> => ({
  ...US_SYMBOLS,
  ...letterKeys(COLEMAK_DH),
  KeyP: [';', ':'],
  Semicolon: ['o', 'O'],
});

export const COLEMAK_DH_ANSI: OsMap = { id: 'colemakdh-ansi', usBased: true, keys: colemakKeys() };

export const COLEMAK_DH_ISO: OsMap = {
  id: 'colemakdh-iso',
  usBased: true,
  keys: { ...colemakKeys(), KeyB: ['\\', '|'], IntlBackslash: ['z', 'Z'] },
};

export const IT: OsMap = {
  id: 'it',
  usBased: false,
  keys: {
    ...letterKeys(),
    KeyE: ['e', 'E', '€'],
    Backquote: ['\\', '|'],
    Digit1: ['1', '!'],
    Digit2: ['2', '"'],
    Digit3: ['3', '£'],
    Digit4: ['4', '$'],
    Digit5: ['5', '%'],
    Digit6: ['6', '&'],
    Digit7: ['7', '/', '{'],
    Digit8: ['8', '(', '['],
    Digit9: ['9', ')', ']'],
    Digit0: ['0', '=', '}'],
    Minus: ["'", '?', '`'],
    Equal: ['ì', '^', '~'],
    BracketLeft: ['è', 'é', '[', '{'],
    BracketRight: ['+', '*', ']', '}'],
    Semicolon: ['ò', 'ç', '@'],
    Quote: ['à', '°', '#'],
    Backslash: ['ù', '§'],
    IntlBackslash: ['<', '>', '«', '»'],
    Comma: [',', ';'],
    Period: ['.', ':'],
    Slash: ['-', '_'],
    Space: [' ', ' '],
    ...NUMPAD,
  },
};

export const OS_MAPS: Record<OsMapId, OsMap> = {
  us: US,
  it: IT,
  'colemakdh-ansi': COLEMAK_DH_ANSI,
  'colemakdh-iso': COLEMAK_DH_ISO,
};

/** Etichette dei tasti che non producono testo. */
export const SPECIAL_LABELS: Record<Code, string> = {
  Space: '␣',
  Enter: '⏎',
  Tab: '⇥',
  Backspace: '⌫',
  Delete: '⌦',
  Escape: 'Esc',
  CapsLock: '⇪',
  ShiftLeft: '⇧',
  ShiftRight: '⇧',
  ControlLeft: 'Ctrl',
  ControlRight: 'Ctrl',
  AltLeft: 'Alt',
  AltRight: 'AltGr',
  MetaLeft: '◆',
  MetaRight: '◆',
  ContextMenu: '☰',
};
