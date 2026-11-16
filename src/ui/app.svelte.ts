import { clavisResolver, type Resolver } from '../core/keyboard';
import { ExerciseGenerator, type Corpus } from '../core/exercise/generator';
import type { StatsTable } from '../core/analysis/stats';
import { DEFAULT_SETTINGS, TrainerStore, type ExportData, type Settings, type StoredSession } from '../storage/db';
import { HttpAccountApi, OfflineError, UnauthorizedError, type AccountApi, type AccountUser } from '../sync/api';
import { SyncEngine } from '../sync/engine';

export type View = 'train' | 'stats' | 'settings' | 'about';

/** Ogni quanto sincronizzare mentre la pagina è visibile. */
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

export interface AccountState {
  /** Il server offre l'accesso con Telegram. */
  available: boolean;
  user: AccountUser | null;
  syncing: boolean;
  lastSync: number | null;
  /** Sessioni completate non ancora inviate all'account. */
  pending: number;
  /** Ultima sincronizzazione fallita per mancanza di rete. */
  offline: boolean;
  error: string | null;
  /** Sessioni rimaste solo nel browser perché il server le rifiuterebbe. */
  localOnly: number;
}

/** Stato globale dell'applicazione (runes di Svelte 5). */
class AppState {
  view = $state<View>('train');
  ready = $state(false);
  error = $state<string | null>(null);
  settings = $state<Settings>({ ...DEFAULT_SETTINGS });
  stats = $state.raw<StatsTable>({});
  sessions = $state.raw<StoredSession[]>([]);
  interrupted = $state.raw<StoredSession[]>([]);
  /** Unità su cui fare l'allenamento mirato alla prossima sessione. */
  focus = $state<string | null>(null);
  account = $state<AccountState>({
    available: false, user: null, syncing: false, lastSync: null, pending: 0, offline: false, error: null, localOnly: 0,
  });
  /** Dialogo di accesso aperto. */
  loginOpen = $state(false);

  store!: TrainerStore;
  corpus!: Corpus;
  api: AccountApi = new HttpAccountApi();
  engine!: SyncEngine;
  private generators = new Map<boolean, ExerciseGenerator>();
  private settingsTimer: ReturnType<typeof setTimeout> | null = null;

  get resolver(): Resolver {
    return clavisResolver({ deadKeys: this.settings.deadKeys });
  }

  get generator(): ExerciseGenerator {
    const k = this.settings.deadKeys;
    let g = this.generators.get(k);
    if (!g) this.generators.set(k, (g = new ExerciseGenerator(this.corpus, this.resolver)));
    return g;
  }

  async init() {
    try {
      const [store, words, sentences] = await Promise.all([
        TrainerStore.open(),
        fetch(`./corpus/words.json?v=${__CORPUS_VERSION__}`).then((r) => r.json()),
        fetch(`./corpus/sentences.json?v=${__CORPUS_VERSION__}`).then((r) => r.json()),
      ]);
      this.store = store;
      this.engine = new SyncEngine(this.api, store, () => this.resolver);
      this.corpus = { words: words.words, sentences: sentences.sentences };
      this.settings = await store.getSettings();
      await this.refresh();
      this.interrupted = await store.findInProgress();
      this.ready = true;
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      return;
    }
    // l'account non blocca l'avvio: senza server l'app resta locale
    void this.initAccount();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.syncNow();
    });
    setInterval(() => {
      if (document.visibilityState === 'visible') void this.syncNow();
    }, SYNC_INTERVAL_MS);
  }

  private async initAccount() {
    try {
      const cfg = await this.api.config();
      this.account.available = cfg.telegram;
    } catch {
      this.account.available = false;
    }
    try {
      const user = await this.api.me();
      await this.onLogin(user);
    } catch (e) {
      if (!(e instanceof UnauthorizedError) && !(e instanceof OfflineError)) console.warn(e);
    }
  }

  async refresh() {
    this.stats = await this.store.getStats();
    this.sessions = await this.store.listSessions();
    const meta = await this.store.getSync();
    this.account.pending = meta.pending.length;
    this.account.lastSync = meta.lastSync;
  }

  /** Dopo la conferma nel bot (o all'avvio con cookie valido). */
  async onLogin(user: AccountUser) {
    this.account.user = user;
    await this.engine.bindAccount(user);
    await this.refresh();
    await this.syncNow();
  }

  async syncNow() {
    if (!this.account.user || !this.store) return;
    this.account.syncing = true;
    try {
      const r = await this.engine.sync();
      this.account.offline = false;
      this.account.error = null;
      this.account.localOnly += r.localOnly;
      if (r.settingsChanged) this.settings = await this.store.getSettings();
    } catch (e) {
      if (e instanceof OfflineError) this.account.offline = true;
      else if (e instanceof UnauthorizedError) {
        // sessione del browser scaduta o revocata: i dati locali restano, si rientra con un nuovo accesso
        this.account.user = null;
        this.account.error = 'Sessione scaduta: accedi di nuovo per sincronizzare.';
      } else this.account.error = e instanceof Error ? e.message : String(e);
    } finally {
      this.account.syncing = false;
      await this.refresh();
    }
  }

  /** Esce: invalida la sessione sul server e toglie i dati dell'account dal browser. */
  async logout() {
    await this.api.logout();
    await this.store.reset();
    this.account.user = null;
    this.account.localOnly = 0;
    this.settings = await this.store.getSettings();
    await this.refresh();
  }

  /** Azzeramento: con accesso cancella anche l'account. */
  async resetAll() {
    if (this.account.user) await this.engine.wipeAccount(this.account.user);
    else await this.store.reset();
    this.settings = await this.store.getSettings();
    await this.refresh();
  }

  /** Importazione: con accesso sostituisce anche l'account. */
  async importFile(data: ExportData) {
    if (this.account.user) await this.engine.importIntoAccount(data, this.account.user);
    else await this.store.importData(data, this.resolver);
    this.settings = await this.store.getSettings();
    await this.refresh();
  }

  async afterSession() {
    await this.refresh();
    await this.syncNow();
  }

  async saveSettings(patch: Partial<Settings>) {
    this.settings = { ...this.settings, ...patch };
    await this.store.saveSettings($state.snapshot(this.settings));
    if (this.account.user) {
      // più modifiche ravvicinate (es. cursori) in una sola sincronizzazione
      if (this.settingsTimer) clearTimeout(this.settingsTimer);
      this.settingsTimer = setTimeout(() => void this.syncNow(), 2000);
    }
  }

  async resolveInterrupted(s: StoredSession, keep: boolean) {
    if (keep && s.samples.length > 0) await this.store.completeSession(s, clavisResolver({ deadKeys: s.deadKeys }));
    else await this.store.discardSession(s.id);
    this.interrupted = this.interrupted.filter((x) => x.id !== s.id);
    await this.afterSession();
  }

  trainFocus(key: string) {
    this.focus = key;
    this.view = 'train';
  }
}

export const app = new AppState();
