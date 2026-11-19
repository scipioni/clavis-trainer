import { keyGeometry } from './geometry';
import { SPECIAL_LABELS, type Code } from './osmaps';
import type { Finger, Hand, KeyAction, Keymap, KeyboardId, LayerName, LayoutId } from './types';

/** Un tasto fisico: dito che lo batte e posizione per il disegno (in unità di tasto). */
export interface BoardKey {
  pos: number;
  hand: Hand;
  finger: Finger;
  /** Riga logica (0 = la più alta tra quelle con lettere o numeri). */
  row: number;
  /** Colonna interna dell'indice (allungamento verso il centro). */
  inner: boolean;
  present: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Invio ISO a L: si disegna come poligono. */
  isoEnter?: boolean;
}

export interface Board {
  keyboard: KeyboardId;
  keys: BoardKey[];
  /** Layer con testo: BASE, NUM, SYM su clavis; solo BASE sulle tastiere classiche. */
  layers: LayerName[];
  actions: Partial<Record<LayerName, KeyAction[]>>;
  /** Come si tiene Shift: home row mod (clavis) o tasti Shift (classica). */
  shiftMode: 'hrm' | 'keys';
  /** Larghezza e altezza totali in unità di tasto. */
  width: number;
  height: number;
}

// --- clavis -------------------------------------------------------------------

const STAGGER = [0.4, 0.15, 0, 0.15, 0.3]; // mignolo → colonna interna
const GAP = 1.6;

function clavisPlace(pos: number): { x: number; y: number } {
  const g = keyGeometry(pos);
  const handCol = g.hand === 'L' ? g.col : 9 - g.col;
  let x: number;
  let y: number;
  if (g.row === 3) {
    const i = handCol - 2; // 0 esterno, 2 interno
    x = 2.55 + i;
    y = 3.35 + i * 0.12;
  } else {
    x = handCol;
    y = g.row + STAGGER[handCol];
  }
  if (g.hand === 'R') x = 5 + GAP + 5 - 1 - x;
  return { x, y };
}

/** Lettere della base QWERTY di Miryoku sulle 30 posizioni alfanumeriche. */
const MIRYOKU_QWERTY: Code[] = [
  'KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP',
  'KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Quote',
  'KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM', 'Comma', 'Period', 'Slash',
];

/**
 * clavis: layer dal firmware. Con il layout QWERTY la base è quella QWERTY di
 * Miryoku: cambiano i keycode delle 30 posizioni alfanumeriche, restano home row
 * mod e tasti di layer. NUM e SYM restano quelli del firmware.
 */
/** Base di clavis nel firmware (Colemak-DH) o QWERTY di Miryoku. */
export type ClavisBase = 'colemakdh' | 'qwerty';

/**
 * Layer BASE con la base scelta: con QWERTY cambiano i keycode delle 30
 * posizioni alfanumeriche, restano home row mod e tasti di layer.
 */
export function clavisBaseLayer(keymap: Keymap, base: ClavisBase): KeyAction[] {
  return base === 'colemakdh'
    ? keymap.layers.BASE
    : keymap.layers.BASE.map((a, pos) => (pos < 30 ? { ...a, code: MIRYOKU_QWERTY[pos], shift: undefined, label: '' } : a));
}

export function clavisBoard(keymap: Keymap, layout: LayoutId): Board {
  const base = clavisBaseLayer(keymap, layout === 'colemakdh' ? 'colemakdh' : 'qwerty');
  const keys = Array.from({ length: 40 }, (_, pos) => {
    const g = keyGeometry(pos);
    return { pos, hand: g.hand, finger: g.finger, row: g.row, inner: g.inner, present: g.present, ...clavisPlace(pos), w: 0.9, h: 0.9 };
  });
  return {
    keyboard: 'clavis',
    keys,
    layers: ['BASE', 'NUM', 'SYM'],
    actions: { BASE: base, NUM: keymap.layers.NUM, SYM: keymap.layers.SYM },
    shiftMode: 'hrm',
    width: 5 + GAP + 5 - 0.1,
    height: 3.35 + 0.24 + 0.9,
  };
}

// --- tastiera classica ---------------------------------------------------------

type Row = [Code, number][]; // keycode e larghezza in unità

const ROWS_ANSI: Row[] = [
  [['Backquote', 1], ['Digit1', 1], ['Digit2', 1], ['Digit3', 1], ['Digit4', 1], ['Digit5', 1], ['Digit6', 1], ['Digit7', 1], ['Digit8', 1], ['Digit9', 1], ['Digit0', 1], ['Minus', 1], ['Equal', 1], ['Backspace', 2]],
  [['Tab', 1.5], ['KeyQ', 1], ['KeyW', 1], ['KeyE', 1], ['KeyR', 1], ['KeyT', 1], ['KeyY', 1], ['KeyU', 1], ['KeyI', 1], ['KeyO', 1], ['KeyP', 1], ['BracketLeft', 1], ['BracketRight', 1], ['Backslash', 1.5]],
  [['CapsLock', 1.75], ['KeyA', 1], ['KeyS', 1], ['KeyD', 1], ['KeyF', 1], ['KeyG', 1], ['KeyH', 1], ['KeyJ', 1], ['KeyK', 1], ['KeyL', 1], ['Semicolon', 1], ['Quote', 1], ['Enter', 2.25]],
  [['ShiftLeft', 2.25], ['KeyZ', 1], ['KeyX', 1], ['KeyC', 1], ['KeyV', 1], ['KeyB', 1], ['KeyN', 1], ['KeyM', 1], ['Comma', 1], ['Period', 1], ['Slash', 1], ['ShiftRight', 2.75]],
  [['ControlLeft', 1.25], ['MetaLeft', 1.25], ['AltLeft', 1.25], ['Space', 6.25], ['AltRight', 1.25], ['MetaRight', 1.25], ['ContextMenu', 1.25], ['ControlRight', 1.25]],
];

const ROWS_ISO: Row[] = [
  ROWS_ANSI[0],
  [['Tab', 1.5], ['KeyQ', 1], ['KeyW', 1], ['KeyE', 1], ['KeyR', 1], ['KeyT', 1], ['KeyY', 1], ['KeyU', 1], ['KeyI', 1], ['KeyO', 1], ['KeyP', 1], ['BracketLeft', 1], ['BracketRight', 1], ['Enter', 1.5]],
  [['CapsLock', 1.75], ['KeyA', 1], ['KeyS', 1], ['KeyD', 1], ['KeyF', 1], ['KeyG', 1], ['KeyH', 1], ['KeyJ', 1], ['KeyK', 1], ['KeyL', 1], ['Semicolon', 1], ['Quote', 1], ['Backslash', 1]],
  [['ShiftLeft', 1.25], ['IntlBackslash', 1], ['KeyZ', 1], ['KeyX', 1], ['KeyC', 1], ['KeyV', 1], ['KeyB', 1], ['KeyN', 1], ['KeyM', 1], ['Comma', 1], ['Period', 1], ['Slash', 1], ['ShiftRight', 2.75]],
  ROWS_ANSI[4],
];

/** Diteggiatura standard delle dieci dita. */
const FINGERS: Record<string, [Hand, Finger]> = {};
const assign = (hand: Hand, finger: Finger, codes: string) => {
  for (const c of codes.split(' ')) FINGERS[c] = [hand, finger];
};
assign('L', 'pinky', 'Backquote Digit1 Tab KeyQ CapsLock KeyA ShiftLeft IntlBackslash KeyZ ControlLeft');
assign('L', 'ring', 'Digit2 KeyW KeyS KeyX');
assign('L', 'middle', 'Digit3 KeyE KeyD KeyC');
assign('L', 'index', 'Digit4 Digit5 KeyR KeyT KeyF KeyG KeyV KeyB');
assign('R', 'index', 'Digit6 Digit7 KeyY KeyU KeyH KeyJ KeyN KeyM');
assign('R', 'middle', 'Digit8 KeyI KeyK Comma');
assign('R', 'ring', 'Digit9 KeyO KeyL Period');
assign('R', 'pinky', 'Digit0 Minus Equal Backspace KeyP BracketLeft BracketRight Backslash Semicolon Quote Enter Slash ShiftRight ControlRight ContextMenu');
assign('L', 'thumb', 'MetaLeft AltLeft');
assign('R', 'thumb', 'Space AltRight MetaRight');

/** Angle mod di Colemak-DH: la riga inferiore sinistra si batte con le dita spostate di un tasto. */
const ANGLE_MOD: Record<string, [Hand, Finger]> = {
  IntlBackslash: ['L', 'pinky'],
  KeyZ: ['L', 'ring'],
  KeyX: ['L', 'middle'],
  KeyC: ['L', 'index'],
  KeyV: ['L', 'index'],
  KeyB: ['L', 'index'],
};

const INNER = new Set(['Digit5', 'KeyT', 'KeyG', 'KeyB', 'Digit6', 'KeyY', 'KeyH', 'KeyN']);

function classicAction(code: Code): KeyAction {
  if (code === 'ShiftLeft' || code === 'ShiftRight') return { label: '⇧', holdMod: 'shift' };
  if (code === 'AltRight') return { label: 'AltGr', holdMod: 'altgr' };
  if (code === 'Enter' || code === 'Tab' || code === 'Backspace' || code === 'CapsLock' || code.startsWith('Control') || code.startsWith('Meta') || code === 'AltLeft' || code === 'ContextMenu') {
    return { label: SPECIAL_LABELS[code] ?? code };
  }
  return { code, label: SPECIAL_LABELS[code] ?? '' };
}

/** Tastiera classica sfalsata: righe standard, larghezze in unità, dita standard (angle mod con Colemak-DH). */
export function classicBoard(format: 'ansi' | 'iso', layout: LayoutId): Board {
  const rows = format === 'ansi' ? ROWS_ANSI : ROWS_ISO;
  const keys: BoardKey[] = [];
  const actions: KeyAction[] = [];
  rows.forEach((row, r) => {
    let x = 0;
    for (const [code, w] of row) {
      let [hand, finger] = FINGERS[code] ?? ['R', 'pinky'];
      if (layout === 'colemakdh' && ANGLE_MOD[code]) [hand, finger] = ANGLE_MOD[code];
      const isoEnter = format === 'iso' && code === 'Enter';
      keys.push({ pos: keys.length, hand, finger, row: r, inner: INNER.has(code), present: true, x, y: r, w: w - 0.1, h: isoEnter ? 1.9 : 0.9, ...(isoEnter ? { isoEnter } : {}) });
      actions.push(classicAction(code));
      x += w;
    }
  });
  return { keyboard: format, keys, layers: ['BASE'], actions: { BASE: actions }, shiftMode: 'keys', width: 15 - 0.1, height: 4.9 };
}
