import type { Resolver } from '../keyboard/resolver';
import { rankAll, unexplored, type StatsTable } from '../analysis/stats';
import { parseUnitKey, unitKey, unitsOf } from '../analysis/units';
import { WeightedTable, pickWeighted, type Rng } from './random';

export interface Corpus {
  words: [string, number][];
  sentences: [number, string][];
}

export interface AdaptiveOptions {
  /** Numero di parole da generare. */
  words: number;
  /** Probabilità che una parola sia maiuscola (0..1). */
  capitals: number;
  /** Probabilità di punteggiatura dopo una parola (0..1). */
  punctuation: number;
  /** Probabilità di un numero tra le parole (0..1). */
  digits: number;
  /** Allenamento mirato su un'unità (chiave `tipo:valore`). */
  focus?: string;
}

export const DEFAULT_ADAPTIVE: AdaptiveOptions = { words: 40, capitals: 0.1, punctuation: 0.15, digits: 0.03 };

/** Quota di parole scelte per contenere un punto debole. */
export const TARGETED_SHARE = 0.7;
export const FOCUS_SHARE = 0.9;
/** Quanti punti deboli considerare. */
export const TOP_WEAK = 12;
/** Quota del peso totale riservata alle unità poco esplorate (n < MIN_SAMPLES). */
export const EXPLORE_SHARE = 0.2;
/** Peso minimo di un punto debole che non supera la media. */
export const MIN_TARGET_WEIGHT = 0.05;

const END_PUNCT = ['.', '?', '!'];
const MID_PUNCT = [',', ';', ':'];
const ELISIONS = ["l'", "dell'", "all'", "nell'", "un'", "d'", "c'"];

interface Target {
  key: string;
  weight: number;
}

export class ExerciseGenerator {
  private readonly general: WeightedTable;
  private readonly wordWeights: number[];
  /** unità → indici delle parole che la contengono */
  private readonly index = new Map<string, number[]>();
  private sentenceUnits: Set<string>[] | null = null;

  constructor(
    readonly corpus: Corpus,
    readonly resolver: Resolver,
  ) {
    this.corpus = {
      words: corpus.words.filter(([w]) => resolver.canTypeAll(w)),
      sentences: corpus.sentences.filter(([, s]) => resolver.canTypeAll(s)),
    };
    // radice della frequenza: le parole comuni restano comuni senza monopolizzare
    this.wordWeights = this.corpus.words.map(([, c]) => Math.sqrt(c));
    this.general = new WeightedTable(this.wordWeights);
    this.corpus.words.forEach(([w], i) => {
      for (const k of this.unitKeysOf(w)) {
        let list = this.index.get(k);
        if (!list) this.index.set(k, (list = []));
        list.push(i);
      }
    });
  }

  private unitKeysOf(text: string): Set<string> {
    const keys = new Set<string>();
    let prev: string | null = null;
    for (const c of text) {
      for (const u of unitsOf(c, prev, this.resolver)) keys.add(unitKey(u));
      prev = c;
    }
    return keys;
  }

  /** Punti deboli pesati, più le unità poco esplorate con peso ridotto. */
  targets(stats: StatsTable): Target[] {
    const weak = rankAll(stats)
      .filter((r) => r.type !== 'finger' || r.score > 1.2)
      .slice(0, TOP_WEAK)
      // peso = quanto l'unità è sopra la media (score 1 ≈ nella mediana, senza errori)
      .map((r) => ({ key: r.key, weight: Math.max(r.score - 1, MIN_TARGET_WEIGHT) }));
    const keys = unexplored(stats);
    if (keys.length === 0) return weak;
    const weakTotal = weak.reduce((a, t) => a + t.weight, 0);
    // senza punti deboli classificati l'esplorazione prende tutto; altrimenti una quota fissa
    const exploreTotal = weakTotal > 0 ? (weakTotal * EXPLORE_SHARE) / (1 - EXPLORE_SHARE) : 1;
    return [...weak, ...keys.map((key) => ({ key, weight: exploreTotal / keys.length }))];
  }

  private wordWith(key: string, rng: Rng): string | null {
    const list = this.index.get(key);
    if (!list?.length) return null;
    const i = pickWeighted(
      list.map((j) => this.wordWeights[j]),
      rng,
    );
    return this.corpus.words[list[i]][0];
  }

  private generalWord(rng: Rng): string {
    return this.corpus.words[this.general.pick(rng)][0];
  }

  /** Carattere scelto tra `options`, pesato sul punteggio di debolezza come carattere. */
  private pickChar(options: string[], scores: Map<string, number>, rng: Rng): string {
    const ok = options.filter((c) => this.resolver.canType(c));
    return ok[pickWeighted(ok.map((c) => 1 + 2 * (scores.get(c) ?? 0)), rng)];
  }

  adaptive(stats: StatsTable, opts: AdaptiveOptions, rng: Rng = Math.random): string {
    const targets = opts.focus ? [{ key: opts.focus, weight: 1 }] : this.targets(stats);
    const share = opts.focus ? FOCUS_SHARE : TARGETED_SHARE;
    const charScores = new Map<string, number>();
    for (const r of rankAll(stats, 'char')) charScores.set(r.value, r.score);

    const tokens: string[] = [];
    let capitalizeNext = false;
    for (let n = 0; n < opts.words; n++) {
      let word: string | null = null;
      let inject: string | null = null;
      if (targets.length && rng() < share) {
        const t = targets[pickWeighted(targets.map((x) => x.weight), rng)];
        // verso il NUM si passa sia con gli accenti sia con le cifre: metà e metà
        const numbers = t.key.endsWith('>NUM') && opts.digits > 0 && rng() < 0.5;
        word = numbers ? null : this.wordWith(t.key, rng);
        if (!word) inject = t.key; // unità senza parole (cifre, simboli, maiuscole): si inserisce
      }
      word ??= this.generalWord(rng);

      if (inject) {
        const injected = this.injectUnit(inject, word, opts, rng);
        if (injected) {
          tokens.push(injected);
          continue;
        }
      }

      if (opts.punctuation > 0 && rng() < opts.punctuation * 0.3 && /^[aeiouàèéìòù]/.test(word)) {
        word = ELISIONS[Math.floor(rng() * ELISIONS.length)] + word;
      }
      if (capitalizeNext || (opts.capitals > 0 && rng() < opts.capitals)) word = capitalize(word);
      capitalizeNext = false;
      if (opts.punctuation > 0 && rng() < opts.punctuation) {
        const r = rng();
        if (r < 0.15) word = `(${word})`;
        else if (r < 0.3) word = `"${word}"`;
        else if (r < 0.65) word += this.pickChar(MID_PUNCT, charScores, rng);
        else {
          word += this.pickChar(END_PUNCT, charScores, rng);
          capitalizeNext = opts.capitals > 0;
        }
      }
      tokens.push(word);
      if (opts.digits > 0 && rng() < opts.digits) tokens.push(this.number(charScores, rng));
    }
    return tokens.join(' ');
  }

  private number(scores: Map<string, number>, rng: Rng): string {
    const len = 1 + Math.floor(rng() * 4);
    let s = '';
    for (let i = 0; i < len; i++) s += this.pickChar([...'0123456789'], scores, rng);
    return s;
  }

  /** Esercita un'unità che nessuna parola contiene, se le opzioni lo permettono. */
  private injectUnit(key: string, word: string, opts: AdaptiveOptions, rng: Rng): string | null {
    const { type, value } = parseUnitKey(key);
    const chars = type === 'char' ? [value] : type === 'bigram' ? [...value] : [];
    if (type === 'layer') {
      const to = value.split('>')[1];
      if (to === 'NUM' && opts.digits > 0) return `${word} ${this.number(new Map(), rng)}`;
      if (to === 'SYM' && opts.punctuation > 0) return `(${word})`;
      return null;
    }
    if (chars.length === 0) return null;
    const c = chars[chars.length - 1];
    if (/[0-9]/.test(c)) return opts.digits > 0 ? `${word} ${chars.join('')}` : null;
    if (/[A-ZÀÈÉÌÒÙ]/.test(c)) {
      if (opts.capitals <= 0) return null;
      const w = this.wordWith(`char:${c.toLowerCase()}`, rng) ?? word;
      return capitalize(w);
    }
    if (/[a-zàèéìòù ]/.test(c)) return null;
    if (opts.punctuation <= 0 || !this.resolver.canType(c)) return null;
    if (c === '(' || c === ')') return `(${word})`;
    if (c === '"') return `"${word}"`;
    if (c === "'") return ELISIONS[0] + (this.wordWith('char:a', rng) ?? word);
    return word + c;
  }

  sentences(stats: StatsTable, count: number, rng: Rng = Math.random, focus?: string): string {
    if (!this.sentenceUnits) this.sentenceUnits = this.corpus.sentences.map(([, s]) => this.unitKeysOf(s));
    const targets = focus ? [{ key: focus, weight: 3 }] : this.targets(stats);
    const weights = this.sentenceUnits.map((units) => {
      let w = 1;
      for (const t of targets) if (units.has(t.key)) w += t.weight;
      return w * w;
    });
    const table = new WeightedTable(weights);
    const out: string[] = [];
    const used = new Set<number>();
    for (let tries = 0; out.length < count && tries < count * 20; tries++) {
      const i = table.pick(rng);
      if (used.has(i)) continue;
      used.add(i);
      out.push(this.corpus.sentences[i][1]);
    }
    return out.join(' ');
  }
}

function capitalize(w: string): string {
  const i = w.search(/[a-zàèéìòù]/);
  return i < 0 ? w : w.slice(0, i) + w[i].toUpperCase() + w.slice(i + 1);
}
