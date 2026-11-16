/**
 * Formato dei dati persistenti (sessioni, impostazioni, esportazione) e loro
 * validazione. Modulo puro: lo usano il browser (IndexedDB) e il server.
 */
import type { Sample } from './session/session';
import type { SessionResult } from './session/result';

export type ExerciseMode = 'adaptive' | 'sentences' | 'free';

export interface StoredSession {
  id: string;
  /** Data di inizio (epoch ms). */
  startedAt: number;
  mode: ExerciseMode;
  /** Durata scelta in ms, null = fino alla fine del testo. */
  durationMs: number | null;
  status: 'in-progress' | 'completed';
  focus?: string;
  deadKeys: boolean;
  samples: Sample[];
  result: SessionResult;
}

export interface Settings {
  mode: ExerciseMode;
  /** Secondi; null = fino alla fine del testo. */
  durationSec: number | null;
  deadKeys: boolean;
  showKeyboard: boolean;
  capitals: number;
  punctuation: number;
  digits: number;
}

export const DEFAULT_SETTINGS: Settings = {
  mode: 'adaptive',
  durationSec: 60,
  deadKeys: true,
  showKeyboard: true,
  capitals: 0.1,
  punctuation: 0.15,
  digits: 0.03,
};

export const EXPORT_FORMAT = 'clavis-trainer';
export const EXPORT_VERSION = 1;

export interface ExportData {
  format: typeof EXPORT_FORMAT;
  version: typeof EXPORT_VERSION;
  exportedAt: string;
  sessions: StoredSession[];
  settings: Settings;
}

/** Dimensione massima di una sessione serializzata (circa 10 volte una sessione da 120 s). */
export const MAX_SESSION_BYTES = 500_000;

export class ImportError extends Error {}

const isNum = (x: unknown) => typeof x === 'number' && Number.isFinite(x);

export function validSample(x: unknown): x is Sample {
  const s = x as Sample;
  return (
    typeof s === 'object' && s !== null &&
    typeof s.char === 'string' &&
    (s.prev === null || typeof s.prev === 'string') &&
    (s.ms === null || isNum(s.ms)) &&
    isNum(s.errors) && isNum(s.modMisfires) && isNum(s.deadErrors) &&
    Array.isArray(s.wrong)
  );
}

/** Sessione completata ben formata e non troppo grande. */
export function validSession(x: unknown): x is StoredSession {
  const s = x as StoredSession;
  const ok =
    typeof s === 'object' && s !== null &&
    typeof s.id === 'string' && s.id.length > 0 && s.id.length <= 64 &&
    isNum(s.startedAt) &&
    ['adaptive', 'sentences', 'free'].includes(s.mode) &&
    s.status === 'completed' &&
    Array.isArray(s.samples) && s.samples.every(validSample) &&
    typeof s.result === 'object' && s.result !== null && isNum(s.result.wpm);
  return ok && JSON.stringify(s).length <= MAX_SESSION_BYTES;
}

/** Impostazioni plausibili (i campi mancanti prendono i valori predefiniti). */
export function normalizeSettings(x: unknown): Settings | null {
  if (typeof x !== 'object' || x === null) return null;
  const s = { ...DEFAULT_SETTINGS, ...(x as Partial<Settings>) };
  const frac = (v: unknown) => isNum(v) && (v as number) >= 0 && (v as number) <= 1;
  const valid =
    ['adaptive', 'sentences', 'free'].includes(s.mode) &&
    (s.durationSec === null || isNum(s.durationSec)) &&
    typeof s.deadKeys === 'boolean' && typeof s.showKeyboard === 'boolean' &&
    frac(s.capitals) && frac(s.punctuation) && frac(s.digits);
  if (!valid) return null;
  const { mode, durationSec, deadKeys, showKeyboard, capitals, punctuation, digits } = s;
  return { mode, durationSec, deadKeys, showKeyboard, capitals, punctuation, digits };
}

/** Valida il contenuto di un file di esportazione; lancia ImportError se non è valido. */
export function parseExport(text: string): ExportData {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportError('il file non è JSON valido');
  }
  const d = data as ExportData;
  if (typeof d !== 'object' || d === null || d.format !== EXPORT_FORMAT) {
    throw new ImportError('non è un file di esportazione di clavis-trainer');
  }
  if (d.version !== EXPORT_VERSION) throw new ImportError(`versione ${String(d.version)} non supportata`);
  if (!Array.isArray(d.sessions)) throw new ImportError('elenco delle sessioni mancante');
  const bad = d.sessions.findIndex((s) => !validSession(s));
  if (bad >= 0) throw new ImportError(`sessione ${bad + 1} non valida`);
  const settings = d.settings === undefined ? DEFAULT_SETTINGS : normalizeSettings(d.settings);
  if (!settings) throw new ImportError('impostazioni non valide');
  return { ...d, settings };
}
