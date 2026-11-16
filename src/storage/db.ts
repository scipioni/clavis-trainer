import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Resolver } from '../core/keyboard/resolver';
import { applySamples, recompute, type StatsTable } from '../core/analysis/stats';
import {
  DEFAULT_SETTINGS,
  EXPORT_FORMAT,
  EXPORT_VERSION,
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

const STATS_KEY = 'stats';
const SETTINGS_KEY = 'settings';
const SYNC_KEY = 'sync';

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
    const meta = { ...EMPTY_SYNC, ...((await kv.get(SYNC_KEY)) as Partial<SyncMeta> | undefined) };
    if (!meta.pending.includes(s.id)) meta.pending = [...meta.pending, s.id];
    await Promise.all([
      tx.objectStore('sessions').put({ ...s, status: 'completed' }),
      kv.put(table, STATS_KEY),
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

  /** Ricalcola le statistiche da tutto lo storico in ordine cronologico. */
  async recomputeStats(resolver: Resolver): Promise<StatsTable> {
    const table = recompute(await this.listSessions(), resolver);
    await this.db.put('kv', table, STATS_KEY);
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
  async importData(data: ExportData, resolver: Resolver): Promise<void> {
    const sessions = [...data.sessions].sort((a, b) => a.startedAt - b.startedAt);
    const table = recompute(sessions, resolver);
    const tx = this.db.transaction(['sessions', 'kv'], 'readwrite');
    const store = tx.objectStore('sessions');
    const kv = tx.objectStore('kv');
    const prev = { ...EMPTY_SYNC, ...((await kv.get(SYNC_KEY)) as Partial<SyncMeta> | undefined) };
    await store.clear();
    await kv.clear();
    for (const s of sessions) await store.put(s);
    await kv.put(table, STATS_KEY);
    await kv.put({ ...DEFAULT_SETTINGS, ...data.settings }, SETTINGS_KEY);
    // lo storico importato è tutto da inviare; l'account resta quello del browser
    const meta: SyncMeta = { ...EMPTY_SYNC, account: prev.account, pending: sessions.map((s) => s.id), settingsUpdatedAt: Date.now() };
    await kv.put(meta, SYNC_KEY);
    await tx.done;
  }

  async reset(): Promise<void> {
    const tx = this.db.transaction(['sessions', 'kv'], 'readwrite');
    await Promise.all([tx.objectStore('sessions').clear(), tx.objectStore('kv').clear(), tx.done]);
  }
}
