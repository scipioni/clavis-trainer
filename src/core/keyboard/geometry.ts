import type { Finger, Hand } from './types';

/**
 * Le 40 posizioni Miryoku: righe 0..2 da 10 colonne (5 per lato), riga 3 coi
 * pollici. Sulla riga 3 le colonne 0, 1, 8, 9 non esistono su clavis (U_NP).
 */
export interface KeyGeometry {
  pos: number;
  row: number;
  col: number;
  hand: Hand;
  finger: Finger;
  /** Colonna interna (indice allungato verso il centro). */
  inner: boolean;
  /** Il tasto esiste sulla tastiera fisica. */
  present: boolean;
}

const COL_FINGERS: Finger[] = ['pinky', 'ring', 'middle', 'index', 'index'];

export function keyGeometry(pos: number): KeyGeometry {
  if (pos < 0 || pos >= 40) throw new RangeError(`posizione ${pos} fuori da 0..39`);
  const row = Math.floor(pos / 10);
  const col = pos % 10;
  const hand: Hand = col < 5 ? 'L' : 'R';
  const handCol = hand === 'L' ? col : 9 - col; // 0 = mignolo, 4 = colonna interna
  if (row === 3) {
    return { pos, row, col, hand, finger: 'thumb', inner: handCol === 4, present: handCol >= 2 };
  }
  return { pos, row, col, hand, finger: COL_FINGERS[handCol], inner: handCol === 4, present: true };
}

export const ALL_POSITIONS: KeyGeometry[] = Array.from({ length: 40 }, (_, i) => keyGeometry(i));
export const PRESENT_POSITIONS = ALL_POSITIONS.filter((k) => k.present);

export const FINGER_LABELS: Record<Finger, string> = {
  pinky: 'mignolo',
  ring: 'anulare',
  middle: 'medio',
  index: 'indice',
  thumb: 'pollice',
};

export function fingerId(g: Pick<KeyGeometry, 'hand' | 'finger'>): string {
  return `${g.hand}-${g.finger}`;
}

export function fingerLabel(id: string): string {
  const [hand, finger] = id.split('-') as [Hand, Finger];
  return `${FINGER_LABELS[finger]} ${hand === 'L' ? 'sinistro' : 'destro'}`;
}
