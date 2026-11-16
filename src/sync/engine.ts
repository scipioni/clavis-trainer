import type { Resolver } from '../core/keyboard/resolver';
import { validSession, type ExportData } from '../core/data';
import type { TrainerStore } from '../storage/db';
import type { AccountApi, AccountUser } from './api';

/** Sessioni inviate per richiesta (il server ne accetta al massimo 50). */
export const UPLOAD_BATCH = 50;

export interface SyncOutcome {
  uploaded: number;
  downloaded: number;
  settingsChanged: boolean;
  /** Sessioni che il server rifiuterebbe (es. troppo grandi): restano solo nel browser. */
  localOnly: number;
}

/**
 * Allinea IndexedDB con l'account. Le sessioni sono immutabili e identificate
 * dall'id: si caricano quelle in `pending`, si scaricano quelle oltre il
 * cursore, e se ne arrivano di nuove si ricalcolano le statistiche.
 */
export class SyncEngine {
  private running: Promise<SyncOutcome> | null = null;

  constructor(
    private readonly api: AccountApi,
    private readonly store: TrainerStore,
    private readonly resolver: () => Resolver,
  ) {}

  /**
   * Lega i dati locali all'account appena entrato. Dati anonimi: confluiscono
   * nell'account (tutti in `pending`). Dati di un altro account: si cancellano.
   */
  async bindAccount(user: AccountUser): Promise<void> {
    const meta = await this.store.getSync();
    if (meta.account === user.id) return;
    if (meta.account === null) {
      const all = (await this.store.listSessions()).map((s) => s.id);
      await this.store.patchSync({ account: user.id, cursor: 0, pending: [...new Set([...meta.pending, ...all])] });
      return;
    }
    await this.store.reset();
    await this.store.patchSync({ account: user.id });
  }

  /** Una sincronizzazione alla volta: le chiamate concorrenti aspettano quella in corso. */
  sync(): Promise<SyncOutcome> {
    this.running ??= this.run().finally(() => (this.running = null));
    return this.running;
  }

  private async run(): Promise<SyncOutcome> {
    const out: SyncOutcome = { uploaded: 0, downloaded: 0, settingsChanged: false, localOnly: 0 };
    for (let round = 0; round < 1000; round++) {
      const meta = await this.store.getSync();
      const batchIds = meta.pending.slice(0, UPLOAD_BATCH);
      const found = await this.store.getSessions(batchIds);
      const upload = found.filter((s) => validSession(s));
      out.localOnly += found.length - upload.length;
      const sendSettings = meta.settingsUpdatedAt > meta.settingsSynced;
      const res = await this.api.sync({
        upload,
        cursor: meta.cursor,
        ...(sendSettings ? { settings: { value: await this.store.getSettings(), updatedAt: meta.settingsUpdatedAt } } : {}),
      });
      out.uploaded += upload.length;
      out.downloaded += await this.store.addSessions(res.sessions);

      const patch: Parameters<TrainerStore['patchSync']>[0] = { cursor: res.cursor };
      // rileggo pending: nel frattempo può essersi aggiunta una sessione appena completata
      const now = await this.store.getSync();
      patch.pending = now.pending.filter((id) => !batchIds.includes(id));
      if (res.settings && res.settings.updatedAt > now.settingsUpdatedAt) {
        await this.store.saveSettings(res.settings.value, null);
        patch.settingsUpdatedAt = res.settings.updatedAt;
        out.settingsChanged = true;
      }
      patch.settingsSynced = Math.max(res.settings?.updatedAt ?? 0, sendSettings ? meta.settingsUpdatedAt : 0, now.settingsSynced);
      await this.store.patchSync(patch);

      if (patch.pending.length === 0 && !res.hasMore) break;
    }
    if (out.downloaded > 0) await this.store.recomputeStats(this.resolver());
    await this.store.patchSync({ lastSync: Date.now() });
    return out;
  }

  /** Azzeramento con accesso: cancella l'account sul server e poi il browser. */
  async wipeAccount(user: AccountUser): Promise<void> {
    await this.api.deleteData();
    await this.store.reset();
    await this.store.patchSync({ account: user.id });
  }

  /** Importazione con accesso: il contenuto del file sostituisce l'account e il browser. */
  async importIntoAccount(data: ExportData, user: AccountUser): Promise<SyncOutcome> {
    await this.api.deleteData();
    await this.store.importData(data, this.resolver());
    await this.store.patchSync({ account: user.id, cursor: 0 });
    return this.sync();
  }
}
