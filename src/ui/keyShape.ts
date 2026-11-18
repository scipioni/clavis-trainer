/** Misure comuni per disegnare le tastiere SVG (tastiera a schermo, mappa di calore, guida). */
import type { BoardKey } from '../core/keyboard';

/** Lato di un tasto da 1 unità, in px del viewBox. */
export const U = 54;
/** Margine attorno alla tastiera. */
export const PAD = 6;

/** Invio ISO a L: parte alta larga 1,5, parte bassa 1,25 allineata a destra. */
export function isoEnterPath(w: number, h: number): string {
  const top = w * U;
  const step = 0.25 * U;
  const mid = 0.95 * U;
  const r = 8;
  return `M${r},0 H${top - r} Q${top},0 ${top},${r} V${h * U - r} Q${top},${h * U} ${top - r},${h * U} H${step + r} Q${step},${h * U} ${step},${h * U - r} V${mid} H${r} Q0,${mid} 0,${mid - r} V${r} Q0,0 ${r},0 Z`;
}

/** Riquadro di un tasto nelle coordinate dell'SVG (per l'Invio ISO: la parte alta, dove sta l'etichetta). */
export function keyBox(k: BoardKey): { x: number; y: number; w: number; h: number } {
  return { x: k.x * U + PAD, y: k.y * U + PAD, w: k.w * U, h: k.isoEnter ? 0.95 * U : k.h * U };
}
