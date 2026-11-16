import { keyGeometry } from './geometry';
import { DECOMPOSE, isDeadKey } from './deadKeys';
import { TEXT_LAYERS, type Chord, type Keymap, type KeyRef, type LayerName, type Resolution } from './types';

export interface ResolveOptions {
  /** Il sistema usa i tasti morti di US International (predefinito: sì). */
  deadKeys: boolean;
}

export const DEFAULT_RESOLVE_OPTIONS: ResolveOptions = { deadKeys: true };

/**
 * Traduce caratteri in accordi sulla keymap. Costruisce l'indice una volta;
 * `resolve` è poi una lettura.
 */
export class Resolver {
  private readonly direct = new Map<string, Chord>();
  private readonly cache = new Map<string, Resolution | null>();

  constructor(
    readonly keymap: Keymap,
    readonly options: ResolveOptions = DEFAULT_RESOLVE_OPTIONS,
  ) {
    this.buildIndex();
  }

  private layerHold(layer: LayerName): KeyRef[] | null {
    if (layer === 'BASE') return [];
    const pos = this.keymap.layers.BASE.findIndex((k) => k.holdLayer === layer);
    return pos < 0 ? null : [{ layer: 'BASE', pos }];
  }

  /** Shift da tenere per battere `pos` con Shift sul layer indicato. */
  private shiftHold(layer: LayerName, pos: number, exclude: KeyRef[]): KeyRef | null {
    const hand = keyGeometry(pos).hand;
    const candidates = this.keymap.layers[layer]
      .map((k, p) => ({ k, p }))
      .filter(({ k, p }) => k.holdMod === 'shift' && p !== pos && !exclude.some((e) => e.pos === p));
    // Sul BASE lo Shift è un home row mod: si usa quello della mano opposta.
    const opposite = candidates.filter(({ p }) => keyGeometry(p).hand !== hand);
    const pick = layer === 'BASE' ? opposite[0] : (opposite[0] ?? candidates[0]);
    return pick ? { layer, pos: pick.p } : null;
  }

  private buildIndex() {
    const cost = (c: Chord) => 1 + c.holds.length;
    const offer = (char: string, chord: Chord) => {
      const prev = this.direct.get(char);
      // Meno pressioni vince; a parità resta il primo trovato (BASE prima, poi ordine di posizione).
      if (!prev || cost(chord) < cost(prev)) this.direct.set(char, chord);
    };
    for (const layer of TEXT_LAYERS) {
      const holds = this.layerHold(layer);
      if (holds === null) continue;
      this.keymap.layers[layer].forEach((k, pos) => {
        if (k.absent || !keyGeometry(pos).present) return;
        const tap: KeyRef = { layer, pos };
        if (k.tap) offer(k.tap, { layer, tap, holds });
        if (k.shiftTap) {
          const shift = this.shiftHold(layer, pos, holds);
          if (shift) offer(k.shiftTap, { layer, tap, holds: [...holds, shift] });
        }
      });
    }
  }

  private literalSpace(): Chord | null {
    return this.direct.get(' ') ?? null;
  }

  resolve(char: string): Resolution | null {
    if (this.cache.has(char)) return this.cache.get(char)!;
    const r = this.compute(char);
    this.cache.set(char, r);
    return r;
  }

  private compute(char: string): Resolution | null {
    const { deadKeys } = this.options;
    const chord = this.direct.get(char);
    if (chord) {
      if (deadKeys && isDeadKey(char)) {
        const space = this.literalSpace();
        return space ? { char, strokes: [chord, space], dead: true } : null;
      }
      return { char, strokes: [chord], dead: false };
    }
    const decomposed = deadKeys ? DECOMPOSE[char] : undefined;
    if (decomposed) {
      const [dead, letter] = decomposed;
      const d = this.direct.get(dead);
      const l = this.direct.get(letter);
      if (d && l) return { char, strokes: [d, l], dead: true };
    }
    return null;
  }

  canType(char: string): boolean {
    return this.resolve(char) !== null;
  }

  canTypeAll(text: string): boolean {
    for (const c of text) if (!this.canType(c)) return false;
    return true;
  }

  /** Layer del primo accordo: quello che conta per le transizioni di layer. */
  layerOf(char: string): LayerName | null {
    return this.resolve(char)?.strokes[0].layer ?? null;
  }
}
