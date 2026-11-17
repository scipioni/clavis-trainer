import { parseUnitKey, type UnitType } from '../core/analysis/units';
import type { Finger, Hand, KeyboardId, LayoutId, Profile } from '../core/keyboard/types';
import { fmtNum, fmtPct, t } from '../i18n/index.svelte';

/** Carattere leggibile (spazio visibile). */
export function showChar(c: string): string {
  return c === ' ' ? '␣' : c;
}

export function fingerLabel(id: string): string {
  const [hand, finger] = id.split('-') as [Hand, Finger];
  return `${t(`finger.${finger}`)} ${t(`hand.${hand}`)}`;
}

export const unitTypeLabel = (type: UnitType) => t(`unit.${type}`);

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

export const keyboardLabel = (k: KeyboardId) => t(`keyboard.${k}`);
export const layoutLabel = (l: LayoutId) => t(`layout.${l}`);
export const profileLabel = (p: Profile) => `${keyboardLabel(p.keyboard)} + ${layoutLabel(p.layout)}`;

export const pct = (x: number) => fmtPct(x);
export const ms = (x: number | null) => (x === null ? '–' : `${fmtNum(x)} ms`);
