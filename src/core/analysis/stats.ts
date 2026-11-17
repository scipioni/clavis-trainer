import type { Resolver } from '../keyboard/resolver';
import type { Sample } from '../session/session';
import { parseUnitKey, unitKey, unitsOf, type UnitType } from './units';
import { EMA_ALPHA, ERROR_WEIGHT, MAX_SAMPLE_MS, MIN_SAMPLES, MISFIRE_WEIGHT } from './weights';

export interface UnitStats {
  /** Campioni totali. */
  n: number;
  /** Campioni con tempo valido. */
  nMs: number;
  /** Media mobile del tempo (ms), null se nessun tempo valido. */
  emaMs: number | null;
  /** Media mobile dell'indicatore di errore (0..1). */
  emaErr: number;
  /** Media mobile dell'indicatore di mod involontario (0..1). */
  emaMisfire: number;
  /** Attivazioni involontarie totali. */
  misfires: number;
}

export type StatsTable = Record<string, UnitStats>;

/**
 * Media mobile con avvio a media aritmetica: finché ci sono meno di 1/α
 * campioni si usa 1/n, così i primi valori non pesano troppo.
 */
function ema(prev: number, value: number, count: number): number {
  const a = Math.max(EMA_ALPHA, 1 / count);
  return prev + a * (value - prev);
}

function emptyStats(): UnitStats {
  return { n: 0, nMs: 0, emaMs: null, emaErr: 0, emaMisfire: 0, misfires: 0 };
}

export function updateUnit(s: UnitStats, sample: Pick<Sample, 'ms' | 'errors' | 'modMisfires'>): void {
  s.n++;
  s.emaErr = ema(s.emaErr, sample.errors > 0 ? 1 : 0, s.n);
  s.emaMisfire = ema(s.emaMisfire, sample.modMisfires > 0 ? 1 : 0, s.n);
  s.misfires += sample.modMisfires;
  if (sample.ms !== null && sample.ms <= MAX_SAMPLE_MS) {
    s.nMs++;
    s.emaMs = s.emaMs === null ? sample.ms : ema(s.emaMs, sample.ms, s.nMs);
  }
}

/** Aggiorna la tabella (in place) con i campioni di una sessione completata. */
export function applySamples(table: StatsTable, samples: Sample[], resolver: Resolver): StatsTable {
  for (const sample of samples) {
    for (const u of unitsOf(sample.char, sample.prev, resolver)) {
      const k = unitKey(u);
      updateUnit((table[k] ??= emptyStats()), sample);
    }
  }
  return table;
}

/**
 * Ricalcola da zero rigiocando le sessioni in ordine. `resolver` può dipendere
 * dalla sessione (profilo e tasti morti con cui è stata fatta).
 */
export function recompute<S extends { samples: Sample[] }>(sessions: S[], resolver: Resolver | ((s: S) => Resolver)): StatsTable {
  const table: StatsTable = {};
  for (const s of sessions) applySamples(table, s.samples, typeof resolver === 'function' ? resolver(s) : resolver);
  return table;
}

export interface RankedUnit {
  key: string;
  type: UnitType;
  value: string;
  score: number;
  stats: UnitStats;
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Mediana del tempo per tipo di unità, sulle unità con abbastanza campioni. */
export function medians(table: StatsTable): Partial<Record<UnitType, number>> {
  const byType: Partial<Record<UnitType, number[]>> = {};
  for (const [k, s] of Object.entries(table)) {
    if (s.n < MIN_SAMPLES || s.emaMs === null) continue;
    (byType[parseUnitKey(k).type] ??= []).push(s.emaMs);
  }
  const out: Partial<Record<UnitType, number>> = {};
  for (const [t, xs] of Object.entries(byType)) {
    const m = median(xs!);
    if (m) out[t as UnitType] = m;
  }
  return out;
}

export function weaknessScore(s: UnitStats, typeMedian: number | undefined): number {
  const timeRatio = s.emaMs !== null && typeMedian ? s.emaMs / typeMedian : 1;
  return timeRatio * (1 + ERROR_WEIGHT * s.emaErr) + MISFIRE_WEIGHT * s.emaMisfire;
}

/** Tutte le unità classificate (n ≥ MIN_SAMPLES), in ordine decrescente di debolezza. */
export function rankAll(table: StatsTable, type?: UnitType): RankedUnit[] {
  const meds = medians(table);
  const out: RankedUnit[] = [];
  for (const [key, stats] of Object.entries(table)) {
    const u = parseUnitKey(key);
    if ((type && u.type !== type) || stats.n < MIN_SAMPLES) continue;
    out.push({ key, ...u, stats, score: weaknessScore(stats, meds[u.type]) });
  }
  return out.sort((a, b) => b.score - a.score);
}

export function weakest(table: StatsTable, type: UnitType, limit = 10): RankedUnit[] {
  return rankAll(table, type).slice(0, limit);
}

/** Unità viste ma con meno di MIN_SAMPLES campioni. */
export function unexplored(table: StatsTable, type?: UnitType): string[] {
  return Object.entries(table)
    .filter(([k, s]) => s.n < MIN_SAMPLES && (!type || parseUnitKey(k).type === type))
    .map(([k]) => k);
}
