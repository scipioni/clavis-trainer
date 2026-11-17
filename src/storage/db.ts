import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { applySamples, recompute, type StatsTable } from '../core/analysis/stats';
import { resolverFor } from '../core/keyboard';
import { DEFAULT_PROFILE, profileId, type Profile } from '../core/keyboard/types';
import {
  DEFAULT_SETTINGS,
  EXPORT_FORMAT,
  EXPORT_VERSION,
  sessionProfile,
  type ExportData,
  type Settings,
  type StoredSession,
} from '../core/data';

// compatibilità: tipi e validazione stanno in core/data.ts, condiviso col server
export * from '../core/data';

interface TrainerDB extends DBSchema {
  sessions: { key: string; value: StoredSession; indexes: { startedAt: number } };
  kv: { key: string; value: unknown };
}

/** Versione 1: una sola tabella `stats`. Versione 2: una tabella per profilo. */
const DB_VERSION = 2;
const LEGACY_STATS_KEY = 'stats';
const statsKey = (p: Profile) => `stats:${profileId(p)}`;
const STATS_VERSION_KEY = 'statsVersion';
const SETTINGS_KEY = 'settings';
const SYNC_KEY = 'sync';

/** Risolutore con cui è stata fatta una sessione. */
const resolverOf = (s: StoredSession) => resolverFor(sessionProfile(s), { deadKeys: s.deadKeys });
const sameProfile = (p: Profile) => (s: StoredSession) => profileId(sessionProfile(s)) === profileId(p);

/** Stato della sincronizzazione con l'account, in kv. */
export interface SyncMeta {
  /** Id Telegram dell'account a cui sono legati i dati locali; null = anonimi. */
  account: number | null;
  /** Ultimo `seq` del server già scaricato. */
  cursor: number;
  /** Sessioni completate non ancora confermate dal server (anche da anonimi: salgono al primo accesso). */
  pending: string[];
  /** Ultima modifica locale delle impostazioni (epoch ms). */
  settingsUpdatedAt: number;
  /** Versione delle impostazioni già allineata col server. */
  settingsSynced: number;
  lastSync: number | null;
}

export const EMPTY_SYNC: SyncMeta = { account: null, cursor: 0, pending: [], settingsUpdatedAt: 0, settingsSynced: 0, lastSync: null };

export class TrainerStore {
  private constructor(private readonly db: IDBPDatabase<TrainerDB>) {}

  /**
   * Apre (e se serve aggiorna) il database del browser.
   * - `onBlocked`: un'altra scheda con una versione vecchia tiene aperto il
   *   database e l'aggiornamento aspetta che la chiuda;
   * - `onVersionChange`: un'altra scheda con una versione più nuova vuole
   *   aggiornarlo: questa connessione si chiude subito per non bloccarla.
   */
  static async open(
    name = 'clavis-trainer',
    hooks: { onBlocked?: () => void; onVersionChange?: () => void } = {},
  ): Promise<TrainerStore> {
    const db = await openDB<TrainerDB>(name, DB_VERSION, {
      blocked() {
        hooks.onBlocked?.();
      },
      blocking() {
        db.close();
        hooks.onVersionChange?.();
      },
      async upgrade(db, oldVersion, _newVersion, tx) {
        if (oldVersion < 1) {
          const sessions = db.createObjectStore('sessions', { keyPath: 'id' });
          sessions.createIndex('startedAt', 'startedAt');
          db.createObjectStore('kv');
        }
        if (oldVersion === 1) {
          // le statistiche di prima sono tutte di clavis + Colemak-DH
          const kv = tx.objectStore('kv');
          const old = await kv.get(LEGACY_STATS_KEY);
          if (old !== undefined) await kv.put(old, statsKey(DEFAULT_PROFILE));
          await kv.delete(LEGACY_STATS_KEY);
        }
      },
    });
    const store = new TrainerStore(db);
    // al primo avvio dopo l'aggiornamento: statistiche ricalcolate dallo storico, profilo per profilo
    if ((await db.get('kv', STATS_VERSION_KEY)) !== DB_VERSION) {
      await store.recomputeStats();
      await db.put('kv', DB_VERSION, STATS_VERSION_KEY);
    }
    return store;
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

  /** Registra una sessione completata e aggiorna le statistiche del suo profilo nella stessa transazione. */
  async completeSession(s: StoredSession): Promise<StatsTable> {
    const key = statsKey(sessionProfile(s));
    const tx = this.db.transaction(['sessions', 'kv'], 'readwrite');
    const kv = tx.objectStore('kv');
    const table = ((await kv.get(key)) as StatsTable | undefined) ?? {};
    applySamples(table, s.samples, resolverOf(s));
    const meta = { ...EMPTY_SYNC, ...((await kv.get(SYNC_KEY)) as Partial<SyncMeta> | undefined) };
    if (!meta.pending.includes(s.id)) meta.pending = [...meta.pending, s.id];
    await Promise.all([
      tx.objectStore('sessions').put({ ...s, status: 'completed' }),
      kv.put(table, key),
      kv.put(meta, SYNC_KEY),
      tx.done,
    ]);
    return table;
  }

  async getSync(): Promise<SyncMeta> {
    return { ...EMPTY_SYNC, ...((await this.db.get('kv', SYNC_KEY)) as Partial<SyncMeta> | undefined) };
  }

  async patchSync(patch: Partial<SyncMeta>): Promise<SyncMeta> {
    const tx = this.db.transaction('kv', 'readwrite');
    const next = { ...EMPTY_SYNC, ...((await tx.store.get(SYNC_KEY)) as Partial<SyncMeta> | undefined), ...patch };
    await Promise.all([tx.store.put(next, SYNC_KEY), tx.done]);
    return next;
  }

  async getSessions(ids: string[]): Promise<StoredSession[]> {
    const out: StoredSession[] = [];
    for (const id of ids) {
      const s = await this.db.get('sessions', id);
      if (s?.status === 'completed') out.push(s);
    }
    return out;
  }

  /** Aggiunge le sessioni scaricate che mancano; restituisce quante sono nuove. */
  async addSessions(sessions: StoredSession[]): Promise<number> {
    const tx = this.db.transaction('sessions', 'readwrite');
    let added = 0;
    for (const s of sessions) {
      const cur = await tx.store.get(s.id);
      if (cur?.status === 'completed') continue;
      await tx.store.put({ ...s, status: 'completed' });
      added++;
    }
    await tx.done;
    return added;
  }

  /** Ricalcola da tutto lo storico, in ordine cronologico, le statistiche di ogni profilo. */
  async recomputeStats(): Promise<void> {
    const tables = this.computeAll(await this.listSessions());
    const tx = this.db.transaction('kv', 'readwrite');
    for (const key of await tx.store.getAllKeys()) {
      if (String(key).startsWith('stats:') && !tables.has(String(key))) await tx.store.delete(key);
    }
    for (const [key, table] of tables) await tx.store.put(table, key);
    await tx.done;
  }

  private computeAll(sessions: StoredSession[]): Map<string, StatsTable> {
    const byProfile = new Map<string, StoredSession[]>();
    for (const s of sessions) {
      const key = statsKey(sessionProfile(s));
      let list = byProfile.get(key);
      if (!list) byProfile.set(key, (list = []));
      list.push(s);
    }
    return new Map([...byProfile].map(([key, list]) => [key, recompute(list, resolverOf)]));
  }

  async findInProgress(): Promise<StoredSession[]> {
    return (await this.db.getAll('sessions')).filter((s) => s.status === 'in-progress');
  }

  /** Sessioni completate in ordine cronologico, eventualmente solo di un profilo. */
  async listSessions(profile?: Profile): Promise<StoredSession[]> {
    const all = (await this.db.getAllFromIndex('sessions', 'startedAt')).filter((s) => s.status === 'completed');
    return profile ? all.filter(sameProfile(profile)) : all;
  }

  /** Statistiche del profilo (predefinito: clavis + Colemak-DH). */
  async getStats(profile: Profile = DEFAULT_PROFILE): Promise<StatsTable> {
    return ((await this.db.get('kv', statsKey(profile))) as StatsTable | undefined) ?? {};
  }

  /** Impostazioni salvate, completate con `defaults` (per un utente nuovo: lingue dal browser). */
  async getSettings(defaults: Settings = DEFAULT_SETTINGS): Promise<Settings> {
    const s = (await this.db.get('kv', SETTINGS_KEY)) as Partial<Settings> | undefined;
    return { ...defaults, ...s };
  }

  async hasSettings(): Promise<boolean> {
    return (await this.db.get('kv', SETTINGS_KEY)) !== undefined;
  }

  /** Salva le impostazioni; `updatedAt` serve a far vincere l'ultima modifica tra dispositivi. */
  async saveSettings(s: Settings, updatedAt: number | null = Date.now()): Promise<void> {
    await this.db.put('kv', s, SETTINGS_KEY);
    if (updatedAt !== null) await this.patchSync({ settingsUpdatedAt: updatedAt });
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
  async importData(data: ExportData): Promise<void> {
    const sessions = [...data.sessions].sort((a, b) => a.startedAt - b.startedAt);
    const tables = this.computeAll(sessions);
    const tx = this.db.transaction(['sessions', 'kv'], 'readwrite');
    const store = tx.objectStore('sessions');
    const kv = tx.objectStore('kv');
    const prev = { ...EMPTY_SYNC, ...((await kv.get(SYNC_KEY)) as Partial<SyncMeta> | undefined) };
    await store.clear();
    await kv.clear();
    for (const s of sessions) await store.put(s);
    for (const [key, table] of tables) await kv.put(table, key);
    await kv.put(DB_VERSION, STATS_VERSION_KEY);
    await kv.put({ ...DEFAULT_SETTINGS, ...data.settings }, SETTINGS_KEY);
    // lo storico importato è tutto da inviare; l'account resta quello del browser
    const meta: SyncMeta = { ...EMPTY_SYNC, account: prev.account, pending: sessions.map((s) => s.id), settingsUpdatedAt: Date.now() };
    await kv.put(meta, SYNC_KEY);
    await tx.done;
  }

  async reset(): Promise<void> {
    const tx = this.db.transaction(['sessions', 'kv'], 'readwrite');
    const kv = tx.objectStore('kv');
    await Promise.all([tx.objectStore('sessions').clear(), kv.clear(), kv.put(DB_VERSION, STATS_VERSION_KEY), tx.done]);
  }
}
