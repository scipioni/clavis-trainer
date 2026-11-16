import type { SessionResult } from '../session/result';
import type { Keymap, LayerName } from '../keyboard/types';
import { keyGeometry } from '../keyboard/geometry';
import type { StatsTable } from './stats';

export interface HistoryEntry {
  startedAt: number;
  result: Pick<SessionResult, 'wpm' | 'accuracy' | 'chars'>;
}

export interface DayPoint {
  /** AAAA-MM-GG, ora locale. */
  day: string;
  wpm: number;
  accuracy: number;
  sessions: number;
}

export function dayKey(epochMs: number): string {
  const d = new Date(epochMs);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Media per giorno, pesata sui caratteri digitati in ciascuna sessione. */
export function byDay(entries: HistoryEntry[]): DayPoint[] {
  const acc = new Map<string, { w: number; a: number; chars: number; n: number }>();
  for (const e of entries) {
    const k = dayKey(e.startedAt);
    const x = acc.get(k) ?? { w: 0, a: 0, chars: 0, n: 0 };
    const weight = Math.max(e.result.chars, 1);
    x.w += e.result.wpm * weight;
    x.a += e.result.accuracy * weight;
    x.chars += weight;
    x.n++;
    acc.set(k, x);
  }
  return [...acc]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, x]) => ({ day, wpm: x.w / x.chars, accuracy: x.a / x.chars, sessions: x.n }));
}

export interface Summary {
  lastWpm: number | null;
  lastAccuracy: number | null;
  avg7Wpm: number | null;
  avg7Accuracy: number | null;
}

/** Ultimo valore e media (pesata sui caratteri) degli ultimi 7 giorni rispetto a `now`. */
export function summary(entries: HistoryEntry[], now: number): Summary {
  const last = entries.length ? entries[entries.length - 1].result : null;
  const since = now - 7 * 24 * 3600 * 1000;
  const recent = entries.filter((e) => e.startedAt >= since);
  const weight = recent.reduce((a, e) => a + Math.max(e.result.chars, 1), 0);
  const avg = (f: (r: HistoryEntry['result']) => number) =>
    recent.length ? recent.reduce((a, e) => a + f(e.result) * Math.max(e.result.chars, 1), 0) / weight : null;
  return {
    lastWpm: last?.wpm ?? null,
    lastAccuracy: last?.accuracy ?? null,
    avg7Wpm: avg((r) => r.wpm),
    avg7Accuracy: avg((r) => r.accuracy),
  };
}

export type HeatMetric = 'time' | 'errors';

export interface Heat {
  /** 0..1 per posizione, null = nessun dato (tasto neutro). */
  values: (number | null)[];
  titles: (string | null)[];
}

/** Valori della mappa di calore per i caratteri che ogni tasto produce sul layer scelto. */
export function heatmap(table: StatsTable, keymap: Keymap, layer: LayerName, metric: HeatMetric): Heat {
  const raw: (number | null)[] = keymap.layers[layer].map((k, pos) => {
    if (!k.tap || !keyGeometry(pos).present) return null;
    const s = table[`char:${k.tap}`];
    if (!s) return null;
    return metric === 'time' ? s.emaMs : s.emaErr;
  });
  const vals = raw.filter((v): v is number => v !== null);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const values = raw.map((v) => (v === null ? null : hi - lo < 1e-9 ? 0.5 : (v - lo) / (hi - lo)));
  const titles = keymap.layers[layer].map((k) => {
    const s = k.tap ? table[`char:${k.tap}`] : undefined;
    if (!s) return k.tap ? `${k.tap}: nessun dato` : null;
    const t = s.emaMs === null ? '–' : `${Math.round(s.emaMs)} ms`;
    return `${k.tap === ' ' ? 'spazio' : k.tap}: ${t}, errori ${(s.emaErr * 100).toFixed(1)}%, ${s.n} campioni`;
  });
  return { values, titles };
}
