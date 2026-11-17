import type { Board } from './boards';
import { DECOMPOSE, isDeadKey } from './deadKeys';
import type { OsMap } from './osmaps';
import type { Chord, KeyRef, LayerName, Modifier, Resolution } from './types';

export interface ResolveOptions {
  /** Il sistema usa i tasti morti di US International (vale solo per le mappe basate su US). */
  deadKeys: boolean;
}

export const DEFAULT_RESOLVE_OPTIONS: ResolveOptions = { deadKeys: true };

/**
 * Traduce caratteri in accordi: per ogni tasto della tastiera e ogni livello
 * (normale, Shift, AltGr, AltGr+Shift) applica la mappa del sistema operativo
 * al keycode emesso. Costruisce l'indice una volta; `resolve` è poi una lettura.
 */
export class Resolver {
  private readonly direct = new Map<string, Chord>();
  private readonly cache = new Map<string, Resolution | null>();
  readonly deadKeysActive: boolean;

  constructor(
    readonly board: Board,
    readonly os: OsMap,
    readonly options: ResolveOptions = DEFAULT_RESOLVE_OPTIONS,
  ) {
    this.deadKeysActive = options.deadKeys && os.usBased;
    this.buildIndex();
  }

  private layerHold(layer: LayerName): KeyRef[] | null {
    if (layer === 'BASE') return [];
    const pos = (this.board.actions.BASE ?? []).findIndex((k) => k.holdLayer === layer);
    return pos < 0 ? null : [{ layer: 'BASE', pos }];
  }

  /**
   * Tasto da tenere per un modificatore mentre si batte `pos` sul layer: su clavis
   * l'home row mod (o il modificatore del layer), sulla classica i tasti Shift e
   * AltGr. Si preferisce la mano opposta a quella che batte.
   */
  private modHold(mod: Modifier, layer: LayerName, pos: number, exclude: KeyRef[]): KeyRef | null {
    // sulla tastiera classica i modificatori stanno solo sul livello base
    const where: LayerName = this.board.shiftMode === 'keys' ? 'BASE' : layer;
    const hand = this.board.keys[pos].hand;
    const candidates = (this.board.actions[where] ?? [])
      .map((k, p) => ({ k, p }))
      .filter(({ k, p }) => k.holdMod === mod && p !== pos && this.board.keys[p].present && !exclude.some((e) => e.pos === p));
    const opposite = candidates.filter(({ p }) => this.board.keys[p].hand !== hand);
    // Shift come home row mod sul BASE di clavis: solo la mano opposta
    const strict = mod === 'shift' && this.board.shiftMode === 'hrm' && layer === 'BASE';
    const pick = strict ? opposite[0] : (opposite[0] ?? candidates[0]);
    return pick ? { layer: where, pos: pick.p } : null;
  }

  private buildIndex() {
    const cost = (c: Chord) => 1 + c.holds.length;
    const offer = (char: string, chord: Chord) => {
      const prev = this.direct.get(char);
      // meno pressioni vince; a parità resta il primo trovato (BASE prima, poi ordine di posizione)
      if (!prev || cost(chord) < cost(prev)) this.direct.set(char, chord);
    };
    for (const layer of this.board.layers) {
      const layerHolds = this.layerHold(layer);
      if (layerHolds === null) continue;
      (this.board.actions[layer] ?? []).forEach((a, pos) => {
        if (a.absent || !a.code || !this.board.keys[pos].present) return;
        const levels = this.os.keys[a.code];
        if (!levels) return;
        const tap: KeyRef = { layer, pos };
        levels.forEach((char, level) => {
          if (!char) return;
          const needShift = (level & 1) === 1;
          const needAltGr = (level & 2) === 2;
          // un tasto con Shift implicito (es. &kp LPAR) dà solo i livelli con Shift
          if (a.shift && !needShift) return;
          const holds = [...layerHolds];
          if (needShift && !a.shift) {
            const s = this.modHold('shift', layer, pos, holds);
            if (!s) return;
            holds.push(s);
          }
          if (needAltGr) {
            const g = this.modHold('altgr', layer, pos, holds);
            if (!g) return;
            holds.push(g);
          }
          offer(char, { layer, tap, holds });
        });
      });
    }
  }

  resolve(char: string): Resolution | null {
    if (this.cache.has(char)) return this.cache.get(char)!;
    const r = this.compute(char);
    this.cache.set(char, r);
    return r;
  }

  private compute(char: string): Resolution | null {
    const chord = this.direct.get(char);
    if (chord) {
      if (this.deadKeysActive && isDeadKey(char)) {
        const space = this.direct.get(' ');
        return space ? { char, strokes: [chord, space], dead: true } : null;
      }
      return { char, strokes: [chord], dead: false };
    }
    const decomposed = this.deadKeysActive ? DECOMPOSE[char] : undefined;
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

  /** Ha senso parlare di layer solo con più layer (clavis). */
  get hasLayers(): boolean {
    return this.board.layers.length > 1;
  }

  /** Layer del primo accordo: quello che conta per le transizioni di layer. */
  layerOf(char: string): LayerName | null {
    return this.resolve(char)?.strokes[0].layer ?? null;
  }

  /** Tasto fisico (mano, dito) che batte il primo accordo del carattere. */
  keyOf(char: string) {
    const r = this.resolve(char);
    return r ? this.board.keys[r.strokes[0].tap.pos] : null;
  }

  /** Caratteri di `alphabet` che questo profilo non sa produrre. */
  unreachable(alphabet: Iterable<string>): string[] {
    const out: string[] = [];
    for (const c of alphabet) if (!this.canType(c) && !out.includes(c)) out.push(c);
    return out;
  }
}
