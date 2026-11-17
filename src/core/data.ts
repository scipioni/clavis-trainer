/**
 * Formato dei dati persistenti (sessioni, impostazioni, esportazione) e loro
 * validazione. Modulo puro: lo usano il browser (IndexedDB) e il server.
 */
import type { Sample } from './session/session';
import type { SessionResult } from './session/result';
import { KEYBOARDS, LAYOUTS, DEFAULT_PROFILE, type KeyboardId, type LayoutId, type Profile } from './keyboard/types';
import { isLang, type Lang } from './exercise/languages';

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
  /** Profilo e lingua: assenti nelle sessioni registrate prima dei profili (= clavis, Colemak-DH, italiano). */
  keyboard?: KeyboardId;
  layout?: LayoutId;
  lang?: Lang;
  samples: Sample[];
  result: SessionResult;
}

/** Profilo con cui è stata fatta la sessione. */
export function sessionProfile(s: Pick<StoredSession, 'keyboard' | 'layout'>): Profile {
  return { keyboard: s.keyboard ?? DEFAULT_PROFILE.keyboard, layout: s.layout ?? DEFAULT_PROFILE.layout };
}

export function sessionLang(s: Pick<StoredSession, 'lang'>): Lang {
  return s.lang ?? 'it';
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
  keyboard: KeyboardId;
  layout: LayoutId;
  /** Lingua dell'interfaccia. */
  uiLang: Lang;
  /** Lingua degli esercizi. */
  exerciseLang: Lang;
}

/** Valori predefiniti; le lingue di un utente nuovo vengono poi dalla lingua del browser. */
export const DEFAULT_SETTINGS: Settings = {
  mode: 'adaptive',
  durationSec: 60,
  deadKeys: true,
  showKeyboard: true,
  capitals: 0.1,
  punctuation: 0.15,
  digits: 0.03,
  keyboard: DEFAULT_PROFILE.keyboard,
  layout: DEFAULT_PROFILE.layout,
  uiLang: 'it',
  exerciseLang: 'it',
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

export type ImportErrorCode = 'json' | 'format' | 'version' | 'sessions' | 'session' | 'settings';

/** Errore di importazione con un codice, così l'interfaccia lo traduce. */
export class ImportError extends Error {
  constructor(
    readonly code: ImportErrorCode,
    message: string,
    readonly detail?: string | number,
  ) {
    super(message);
  }
}

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
    (s.keyboard === undefined || KEYBOARDS.includes(s.keyboard)) &&
    (s.layout === undefined || LAYOUTS.includes(s.layout)) &&
    (s.lang === undefined || isLang(s.lang)) &&
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
    frac(s.capitals) && frac(s.punctuation) && frac(s.digits) &&
    KEYBOARDS.includes(s.keyboard) && LAYOUTS.includes(s.layout) && isLang(s.uiLang) && isLang(s.exerciseLang);
  if (!valid) return null;
  const { mode, durationSec, deadKeys, showKeyboard, capitals, punctuation, digits, keyboard, layout, uiLang, exerciseLang } = s;
  return { mode, durationSec, deadKeys, showKeyboard, capitals, punctuation, digits, keyboard, layout, uiLang, exerciseLang };
}

/** Valida il contenuto di un file di esportazione; lancia ImportError se non è valido. */
export function parseExport(text: string): ExportData {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new ImportError('json', 'il file non è JSON valido');
  }
  const d = data as ExportData;
  if (typeof d !== 'object' || d === null || d.format !== EXPORT_FORMAT) {
    throw new ImportError('format', 'non è un file di esportazione di clavis-trainer');
  }
  if (d.version !== EXPORT_VERSION) throw new ImportError('version', `versione ${String(d.version)} non supportata`, String(d.version));
  if (!Array.isArray(d.sessions)) throw new ImportError('sessions', 'elenco delle sessioni mancante');
  const bad = d.sessions.findIndex((s) => !validSession(s));
  if (bad >= 0) throw new ImportError('session', `sessione ${bad + 1} non valida`, bad + 1);
  const settings = d.settings === undefined ? DEFAULT_SETTINGS : normalizeSettings(d.settings);
  if (!settings) throw new ImportError('settings', 'impostazioni non valide');
  return { ...d, settings };
}
