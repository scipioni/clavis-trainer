import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Resolver } from '../core/keyboard/resolver';
import type { Sample } from '../core/session/session';
import type { SessionResult } from '../core/session/result';
import { applySamples, recompute, type StatsTable } from '../core/analysis/stats';

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

interface TrainerDB extends DBSchema {
  sessions: { key: string; value: StoredSession; indexes: { startedAt: number } };
  kv: { key: string; value: unknown };
}

const STATS_KEY = 'stats';
const SETTINGS_KEY = 'settings';

export class TrainerStore {
  private constructor(private readonly db: IDBPDatabase<TrainerDB>) {}

  static async open(name = 'clavis-trainer'): Promise<TrainerStore> {
    const db = await openDB<TrainerDB>(name, 1, {
      upgrade(db) {
        const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
        sessions.createIndex('startedAt', 'startedAt');
        db.createObjectStore('kv');
      },
    });
    return new TrainerStore(db);
  }

  close() {
    this.db.close();
  }

  /** Salvataggio incrementale della sessione in corso. */
  async saveInProgress(s: StoredSession): Promise<void> {
    await this.db.put('sessions', { ...s, status: 'in-progress' });
  }

  async discardSession(id: string): Promise<void> {
    await this.db.delete('sessions', id);
  }

  /** Registra una sessione completata e aggiorna le statistiche nella stessa transazione. */
  async completeSession(s: StoredSession, resolver: Resolver): Promise<StatsTable> {
    const tx = this.db.transaction(['sessions', 'kv'], 'readwrite');
    const kv = tx.objectStore('kv');
    const table = ((await kv.get(STATS_KEY)) as StatsTable | undefined) ?? {};
    applySamples(table, s.samples, resolver);
    await Promise.all([tx.objectStore('sessions').put({ ...s, status: 'completed' }), kv.put(table, STATS_KEY), tx.done]);
    return table;
  }

  async findInProgress(): Promise<StoredSession[]> {
    return (await this.db.getAll('sessions')).filter((s) => s.status === 'in-progress');
  }

  /** Sessioni completate in ordine cronologico. */
  async listSessions(): Promise<StoredSession[]> {
    return (await this.db.getAllFromIndex('sessions', 'startedAt')).filter((s) => s.status === 'completed');
  }

  async getStats(): Promise<StatsTable> {
    return ((await this.db.get('kv', STATS_KEY)) as StatsTable | undefined) ?? {};
  }

  async getSettings(): Promise<Settings> {
    const s = (await this.db.get('kv', SETTINGS_KEY)) as Partial<Settings> | undefined;
    return { ...DEFAULT_SETTINGS, ...s };
  }

  async saveSettings(s: Settings): Promise<void> {
    await this.db.put('kv', s, SETTINGS_KEY);
  }

  async exportData(): Promise<ExportData> {
    return {
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      exportedAt: new Date().toISOString(),
      sessions: await this.listSessions(),
      settings: await this.getSettings(),
    };
  }

  /**
   * Sostituisce tutti i dati con quelli importati e ricalcola le statistiche.
   * Va chiamata dopo `parseExport`: un file non valido non arriva qui.
   */
  async importData(data: ExportData, resolver: Resolver): Promise<void> {
    const sessions = [...data.sessions].sort((a, b) => a.startedAt - b.startedAt);
    const table = recompute(sessions, resolver);
    const tx = this.db.transaction(['sessions', 'kv'], 'readwrite');
    const store = tx.objectStore('sessions');
    const kv = tx.objectStore('kv');
    await store.clear();
    await kv.clear();
    for (const s of sessions) await store.put(s);
    await kv.put(table, STATS_KEY);
    await kv.put({ ...DEFAULT_SETTINGS, ...data.settings }, SETTINGS_KEY);
    await tx.done;
  }

  async reset(): Promise<void> {
    const tx = this.db.transaction(['sessions', 'kv'], 'readwrite');
    await Promise.all([tx.objectStore('sessions').clear(), tx.objectStore('kv').clear(), tx.done]);
  }
}

export class ImportError extends Error {}

const isNum = (x: unknown) => typeof x === 'number' && Number.isFinite(x);

function validSample(x: unknown): x is Sample {
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

function validSession(x: unknown): x is StoredSession {
  const s = x as StoredSession;
  return (
    typeof s === 'object' && s !== null &&
    typeof s.id === 'string' && isNum(s.startedAt) &&
    ['adaptive', 'sentences', 'free'].includes(s.mode) &&
    s.status === 'completed' &&
    Array.isArray(s.samples) && s.samples.every(validSample) &&
    typeof s.result === 'object' && s.result !== null && isNum(s.result.wpm)
  );
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
  if (d.settings !== undefined && (typeof d.settings !== 'object' || d.settings === null)) {
    throw new ImportError('impostazioni non valide');
  }
  return { ...d, settings: { ...DEFAULT_SETTINGS, ...d.settings } };
}
