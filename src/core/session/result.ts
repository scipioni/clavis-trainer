import type { Sample } from './session';

export interface SlowItem {
  key: string;
  avgMs: number;
  count: number;
}

export interface SessionResult {
  chars: number;
  activeMs: number;
  wpm: number;
  /** 0..1 */
  accuracy: number;
  errors: number;
  deadErrors: number;
  modMisfires: number;
  slowestChars: SlowItem[];
  slowestBigrams: SlowItem[];
}

/** WPM netto: 5 caratteri = una parola, sul tempo attivo. */
export function wpm(chars: number, activeMs: number): number {
  return activeMs > 0 ? chars / 5 / (activeMs / 60000) : 0;
}

function slowest(samples: Sample[], keyOf: (s: Sample) => string | null, top: number): SlowItem[] {
  const acc = new Map<string, { sum: number; count: number }>();
  for (const s of samples) {
    const k = keyOf(s);
    if (k === null || s.ms === null) continue;
    const a = acc.get(k) ?? { sum: 0, count: 0 };
    a.sum += s.ms;
    a.count++;
    acc.set(k, a);
  }
  const items = [...acc].map(([key, a]) => ({ key, avgMs: a.sum / a.count, count: a.count }));
  const repeated = items.filter((x) => x.count >= 2);
  return (repeated.length >= top ? repeated : items).sort((a, b) => b.avgMs - a.avgMs).slice(0, top);
}

export function computeResult(samples: Sample[], activeMs: number, top = 5): SessionResult {
  const chars = samples.length;
  const firstTry = samples.filter((s) => s.errors === 0).length;
  return {
    chars,
    activeMs,
    wpm: wpm(chars, activeMs),
    accuracy: chars > 0 ? firstTry / chars : 0,
    errors: samples.reduce((n, s) => n + s.errors, 0),
    deadErrors: samples.reduce((n, s) => n + s.deadErrors, 0),
    modMisfires: samples.reduce((n, s) => n + s.modMisfires, 0),
    slowestChars: slowest(samples, (s) => (s.char === ' ' ? null : s.char), top),
    slowestBigrams: slowest(samples, (s) => (s.prev === null ? null : s.prev + s.char), top),
  };
}
