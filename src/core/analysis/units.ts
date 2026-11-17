import { fingerId } from '../keyboard/geometry';
import type { Resolver } from '../keyboard/resolver';

export type UnitType = 'char' | 'bigram' | 'layer' | 'dead' | 'finger';
export const UNIT_TYPES: UnitType[] = ['char', 'bigram', 'layer', 'dead', 'finger'];


export interface Unit {
  type: UnitType;
  value: string;
}

export const unitKey = (u: Unit) => `${u.type}:${u.value}`;

export function parseUnitKey(key: string): Unit {
  const i = key.indexOf(':');
  return { type: key.slice(0, i) as UnitType, value: key.slice(i + 1) };
}

/**
 * Unità toccate dalla digitazione di `char` dopo `prev`. I bigrammi con lo
 * spazio sono esclusi: lo spazio ha già la sua unità carattere.
 */
export function unitsOf(char: string, prev: string | null, resolver: Resolver): Unit[] {
  const units: Unit[] = [{ type: 'char', value: char }];
  if (prev !== null && prev !== ' ' && char !== ' ') units.push({ type: 'bigram', value: prev + char });
  const res = resolver.resolve(char);
  if (res) {
    // le transizioni di layer esistono solo su tastiere con layer (clavis)
    if (prev !== null && resolver.hasLayers) {
      const a = resolver.layerOf(prev);
      const b = res.strokes[0].layer;
      if (a && a !== b) units.push({ type: 'layer', value: `${a}>${b}` });
    }
    if (res.dead) units.push({ type: 'dead', value: char });
    units.push({ type: 'finger', value: fingerId(resolver.board.keys[res.strokes[0].tap.pos]) });
  }
  return units;
}
