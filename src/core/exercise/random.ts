/** Generatore pseudocasuale con seme (mulberry32): riproducibile nei test. */
export type Rng = () => number;

export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Estrazione pesata: restituisce l'indice scelto, -1 se tutti i pesi sono zero. */
export function pickWeighted(weights: number[], rng: Rng): number {
  let total = 0;
  for (const w of weights) total += w;
  if (total <= 0) return -1;
  let r = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

/** Tabella cumulativa per estrazioni pesate ripetute in O(log n). */
export class WeightedTable {
  private readonly cum: Float64Array;
  readonly total: number;

  constructor(weights: number[]) {
    this.cum = new Float64Array(weights.length);
    let acc = 0;
    weights.forEach((w, i) => (this.cum[i] = acc += w));
    this.total = acc;
  }

  pick(rng: Rng): number {
    const r = rng() * this.total;
    let lo = 0;
    let hi = this.cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] > r) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  }
}
