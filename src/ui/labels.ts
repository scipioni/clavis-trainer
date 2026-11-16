import { fingerLabel } from '../core/keyboard/geometry';
import { parseUnitKey } from '../core/analysis/units';

/** Carattere leggibile (spazio visibile). */
export function showChar(c: string): string {
  return c === ' ' ? '␣' : c;
}

/** Etichetta leggibile di un'unità `tipo:valore`. */
export function unitLabel(key: string): string {
  const { type, value } = parseUnitKey(key);
  switch (type) {
    case 'layer':
      return value.replace('>', ' → ');
    case 'finger':
      return fingerLabel(value);
    default:
      return [...value].map(showChar).join('');
  }
}

export const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
export const ms = (x: number | null) => (x === null ? '–' : `${Math.round(x)} ms`);
