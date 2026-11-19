import type { Code } from './osmaps';

/** Layer che producono testo: gli unici usati dalla risoluzione dei caratteri. */
export type LayerName = 'BASE' | 'NUM' | 'SYM';
export const TEXT_LAYERS: LayerName[] = ['BASE', 'NUM', 'SYM'];

/** Tutti i layer di clavis (Miryoku), nell'ordine del firmware. */
export type ClavisLayer = 'BASE' | 'NAV' | 'MOUSE' | 'MEDIA' | 'NUM' | 'SYM' | 'FUN' | 'BUTTON';
export const CLAVIS_LAYERS: ClavisLayer[] = ['BASE', 'NAV', 'MOUSE', 'MEDIA', 'NUM', 'SYM', 'FUN', 'BUTTON'];

export type Modifier = 'shift' | 'ctrl' | 'alt' | 'gui' | 'altgr';
export type Hand = 'L' | 'R';
export type Finger = 'pinky' | 'ring' | 'middle' | 'index' | 'thumb';

export type KeyboardId = 'clavis' | 'ansi' | 'iso';
export type LayoutId = 'colemakdh' | 'us' | 'it';
export const KEYBOARDS: KeyboardId[] = ['clavis', 'ansi', 'iso'];
export const LAYOUTS: LayoutId[] = ['colemakdh', 'us', 'it'];

/** Versione della guida al posizionamento delle dita: clavis o tastiera classica (ANSI/ISO). */
export type GuideKind = 'clavis' | 'classic';
export const GUIDE_KINDS: GuideKind[] = ['clavis', 'classic'];

/** Profilo di digitazione: tastiera fisica × layout. */
export interface Profile {
  keyboard: KeyboardId;
  layout: LayoutId;
}

export const DEFAULT_PROFILE: Profile = { keyboard: 'clavis', layout: 'colemakdh' };
export const profileId = (p: Profile) => `${p.keyboard}:${p.layout}`;

export function parseProfileId(id: string): Profile | null {
  const [keyboard, layout] = id.split(':');
  return KEYBOARDS.includes(keyboard as KeyboardId) && LAYOUTS.includes(layout as LayoutId)
    ? { keyboard: keyboard as KeyboardId, layout: layout as LayoutId }
    : null;
}

/** Azione di un tasto su un layer. */
export interface KeyAction {
  /** Etichetta di riserva per i tasti che non producono testo. */
  label: string;
  /** Keycode emesso battendo il tasto. */
  code?: Code;
  /** Il tasto emette il keycode con Shift già premuto (es. `&kp LPAR` = Shift+9). */
  shift?: boolean;
  /** Modificatore attivo tenendo premuto il tasto (home row mod o tasto modificatore). */
  holdMod?: Modifier;
  /** Layer attivato tenendo premuto il tasto. */
  holdLayer?: string;
  /** Posizione assente sulla tastiera fisica (U_NP). */
  absent?: boolean;
  /**
   * Funzione dei tasti che non emettono testo (`nav.left`, `clip.cut`,
   * `bt.0`, `to.SYM`, `none`...): serve alla mappa di consultazione.
   */
  fn?: string;
  /**
   * Keycode emesso con AltGr già premuto (`&kp RA(SQT)`). Sta fuori da `code`
   * perché la risoluzione dei caratteri non lo usa.
   */
  altgr?: { code: Code; shift?: boolean };
}

export interface Keymap {
  source: string;
  layers: Record<ClavisLayer, KeyAction[]>;
}

/** Riferimento a un tasto fisico letto su un certo layer. */
export interface KeyRef {
  layer: LayerName;
  pos: number;
}

/** Un accordo: tasti tenuti (layer, modificatori) più un tasto battuto. */
export interface Chord {
  layer: LayerName;
  tap: KeyRef;
  holds: KeyRef[];
}

export interface Resolution {
  char: string;
  strokes: Chord[];
  /** Vero se la sequenza passa per un tasto morto. */
  dead: boolean;
}
