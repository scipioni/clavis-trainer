export type LayerName = 'BASE' | 'NUM' | 'SYM';
export const TEXT_LAYERS: LayerName[] = ['BASE', 'NUM', 'SYM'];

export type Modifier = 'shift' | 'ctrl' | 'alt' | 'gui';
export type Hand = 'L' | 'R';
export type Finger = 'pinky' | 'ring' | 'middle' | 'index' | 'thumb';

/** Azione di una posizione della keymap (una delle 40 posizioni Miryoku). */
export interface KeyAction {
  /** Etichetta breve da mostrare sul tasto. */
  label: string;
  /** Carattere prodotto battendo il tasto senza Shift. */
  tap?: string;
  /** Carattere prodotto battendo il tasto con Shift. */
  shiftTap?: string;
  /** Modificatore attivo tenendo premuto il tasto (home row mod o tasto modificatore). */
  holdMod?: Modifier;
  /** Layer attivato tenendo premuto il tasto. */
  holdLayer?: string;
  /** Posizione assente sulla tastiera fisica (U_NP). */
  absent?: boolean;
}

export interface Keymap {
  source: string;
  layers: Record<LayerName, KeyAction[]>;
}

/** Riferimento a un tasto fisico (0..39) letto su un certo layer. */
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
