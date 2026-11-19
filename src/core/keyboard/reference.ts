/**
 * Mappa di consultazione dei layer di clavis: per ogni posizione di un layer
 * dice che cosa mostrare (carattere del sistema operativo o funzione) e in
 * quale categoria colorarlo. Funzioni pure: le etichette tradotte le mette la UI.
 */
import { clavisBaseLayer, type ClavisBase } from './boards';
import { SPECIAL_LABELS, type OsMap } from './osmaps';
import type { ClavisLayer, KeyAction, Keymap, Modifier } from './types';

export type KeyCategory = 'char' | 'mod' | 'layer' | 'nav' | 'media' | 'mouse' | 'fkey' | 'sys' | 'none';

/** Categorie nell'ordine della legenda. */
export const KEY_CATEGORIES: KeyCategory[] = ['char', 'mod', 'layer', 'nav', 'media', 'mouse', 'fkey', 'sys', 'none'];

export interface RefKey {
  pos: number;
  category: KeyCategory;
  /** Carattere (o simbolo del tasto speciale) da mostrare. */
  char?: string;
  /** Funzione del tasto senza testo, da tradurre (`nav.left`, `bt.2`...). */
  fn?: string;
  /** Modificatore ottenuto tenendo il tasto: da solo (`mod`) o sotto il carattere (home row mod). */
  mod?: Modifier;
  /** Layer attivato tenendo il tasto. */
  holdLayer?: string;
  /** Posizione assente sulla tastiera fisica. */
  absent?: boolean;
}

/** Tasti che emettono un keycode ma non un carattere stampabile: si colorano come navigazione. */
const EDIT_CODES = new Set(['Enter', 'Backspace', 'Delete', 'Tab', 'Escape', 'Space']);

function fnCategory(fn: string): KeyCategory {
  const group = fn.split('.')[0];
  switch (group) {
    case 'none':
      return 'none';
    case 'to':
      return 'layer';
    case 'nav':
    case 'clip':
    case 'caps':
      return 'nav';
    case 'media':
    case 'bt':
    case 'out':
    case 'rgb':
    case 'ep':
      return 'media';
    case 'mouse':
    case 'wheel':
    case 'btn':
      return 'mouse';
    case 'fkey':
      return 'fkey';
    default:
      return 'sys';
  }
}

/** Carattere che il sistema `os` produce per un keycode (con Shift e AltGr impliciti). */
function osChar(os: OsMap, code: string, shift: boolean, altgr: boolean): string | undefined {
  const ch = os.keys[code]?.[(shift ? 1 : 0) + (altgr ? 2 : 0)];
  if (ch && ch !== ' ') return ch;
  if (!altgr) return SPECIAL_LABELS[code];
  // livello AltGr assente nella mappa: si mostra la combinazione
  const plain = os.keys[code]?.[shift ? 1 : 0];
  return plain ? `AltGr+${plain}` : undefined;
}

function refKey(a: KeyAction, pos: number, os: OsMap): RefKey {
  if (a.absent) return { pos, category: 'none', absent: true };
  const k: RefKey = { pos, category: 'none' };
  if (a.code) k.char = osChar(os, a.code, !!a.shift, false) ?? a.label;
  else if (a.altgr) k.char = osChar(os, a.altgr.code, !!a.altgr.shift, true);
  else if (a.label && !a.fn) k.char = a.label;
  if (a.fn) k.fn = a.fn;
  if (a.holdMod) k.mod = a.holdMod;
  if (a.holdLayer) k.holdLayer = a.holdLayer;

  const printable = !!a.code && !EDIT_CODES.has(a.code) && !!k.char;
  // tasti di layer: i pollici (␣ ⏎ ⌫...); `z` e `/` che attivano BUTTON restano lettere
  if (a.holdLayer && !printable) k.category = 'layer';
  else if (a.holdMod && !a.code) k.category = 'mod';
  else if (a.fn) k.category = fnCategory(a.fn);
  else if (a.code && EDIT_CODES.has(a.code)) k.category = 'nav';
  else if (k.char) k.category = 'char';
  return k;
}

/** Azioni di un layer, con la base scelta per il layer BASE. */
export function referenceLayer(keymap: Keymap, layer: ClavisLayer, base: ClavisBase): KeyAction[] {
  return layer === 'BASE' ? clavisBaseLayer(keymap, base) : keymap.layers[layer];
}

/** Le 40 posizioni di un layer pronte da disegnare. */
export function referenceKeys(keymap: Keymap, layer: ClavisLayer, base: ClavisBase, os: OsMap): RefKey[] {
  return referenceLayer(keymap, layer, base).map((a, pos) => refKey(a, pos, os));
}

/** Posizioni del layer BASE che, tenute, attivano `layer` (nessuna per BASE). */
export function layerTriggers(keymap: Keymap, layer: ClavisLayer): number[] {
  if (layer === 'BASE') return [];
  return keymap.layers.BASE.flatMap((a, pos) => (a.holdLayer === layer ? [pos] : []));
}
