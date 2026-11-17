import { resolverFor, profileId, type Profile, type Resolver } from '../core/keyboard';
import { ExerciseGenerator, type Corpus } from '../core/exercise/generator';
import type { Lang } from '../core/exercise/languages';
import { sessionProfile } from '../core/data';
import { detectLanguage, i18n, t } from '../i18n/index.svelte';
import type { StatsTable } from '../core/analysis/stats';
import { DEFAULT_SETTINGS, TrainerStore, type ExportData, type Settings, type StoredSession } from '../storage/db';
import { HttpAccountApi, OfflineError, UnauthorizedError, type AccountApi, type AccountUser } from '../sync/api';
import { SyncEngine } from '../sync/engine';

export type View = 'train' | 'stats' | 'settings' | 'about';

/** Oltre questo tempo un'apertura del database ferma va spiegata all'utente. */
const DB_SLOW_MS = 3000;

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
  /** Statistiche del profilo attivo. */
  stats = $state.raw<StatsTable>({});
  /** Tutte le sessioni completate (ogni profilo). */
  sessions = $state.raw<StoredSession[]>([]);
  /** Corpus della lingua degli esercizi caricato (si scaricano solo quelli usati). */
  corpusReady = $state(false);
  interrupted = $state.raw<StoredSession[]>([]);
  /** Unità su cui fare l'allenamento mirato alla prossima sessione. */
  focus = $state<string | null>(null);
  account = $state<AccountState>({
    available: false, user: null, syncing: false, lastSync: null, pending: 0, offline: false, error: null, localOnly: 0,
  });
  /** Dialogo di accesso aperto. */
  loginOpen = $state(false);
  /** L'aggiornamento del database aspetta che si chiuda una scheda con una versione vecchia. */
  dbBlocked = $state(false);
  /** Un'altra scheda ha aggiornato il database: questa va ricaricata. */
  outdated = $state(false);

  store!: TrainerStore;
  api: AccountApi = new HttpAccountApi();
  engine!: SyncEngine;
  private corpora: Partial<Record<Lang, Corpus>> = {};
  private generators = new Map<string, ExerciseGenerator>();
  private settingsTimer: ReturnType<typeof setTimeout> | null = null;

  get profile(): Profile {
    return { keyboard: this.settings.keyboard, layout: this.settings.layout };
  }

  get resolver(): Resolver {
    return resolverFor(this.profile, { deadKeys: this.settings.deadKeys });
  }

  /** Sessioni del profilo attivo, in ordine cronologico. */
  get profileSessions(): StoredSession[] {
    const id = profileId(this.profile);
    return this.sessions.filter((s) => profileId(sessionProfile(s)) === id);
  }

  /** Generatore per lingua degli esercizi e profilo (richiede il corpus caricato). */
  get generator(): ExerciseGenerator {
    const lang = this.settings.exerciseLang;
    const key = `${lang}|${profileId(this.profile)}|${this.settings.deadKeys}`;
    let g = this.generators.get(key);
    if (!g) this.generators.set(key, (g = new ExerciseGenerator(this.corpora[lang]!, this.resolver, lang)));
    return g;
  }

  private async loadCorpus(lang: Lang) {
    if (this.corpora[lang]) return;
    const v = __CORPUS_VERSION__[lang];
    const [words, sentences] = await Promise.all([
      fetch(`./corpus/${lang}/words.json?v=${v}`).then((r) => r.json()),
      fetch(`./corpus/${lang}/sentences.json?v=${v}`).then((r) => r.json()),
    ]);
    this.corpora[lang] = { words: words.words, sentences: sentences.sentences };
  }

  async init() {
    try {
      // Se l'apertura è in coda dietro un'altra richiesta bloccata, il browser non
      // segnala "blocked" a questa pagina: dopo qualche secondo lo diciamo comunque.
      const slow = setTimeout(() => {
        if (!this.ready && !this.error) this.dbBlocked = true;
      }, DB_SLOW_MS);
      const store = await TrainerStore.open(undefined, {
        onBlocked: () => (this.dbBlocked = true),
        onVersionChange: () => (this.outdated = true),
      });
      clearTimeout(slow);
      this.dbBlocked = false;
      this.store = store;
      this.engine = new SyncEngine(this.api, store);
      // utente nuovo: lingue dalla lingua del browser
      const lang = detectLanguage(navigator.languages ?? [navigator.language]);
      const fresh = !(await store.hasSettings());
      this.settings = await store.getSettings(fresh ? { ...DEFAULT_SETTINGS, uiLang: lang, exerciseLang: lang } : DEFAULT_SETTINGS);
      i18n.lang = this.settings.uiLang;
      await this.loadCorpus(this.settings.exerciseLang);
      this.corpusReady = true;
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
    this.stats = await this.store.getStats(this.profile);
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
      if (r.settingsChanged) await this.applySettings(await this.store.getSettings());
    } catch (e) {
      if (e instanceof OfflineError) this.account.offline = true;
      else if (e instanceof UnauthorizedError) {
        // sessione del browser scaduta o revocata: i dati locali restano, si rientra con un nuovo accesso
        this.account.user = null;
        this.account.error = t('account.expired');
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
    await this.applySettings(await this.store.getSettings());
    await this.refresh();
  }

  /** Azzeramento: con accesso cancella anche l'account. */
  async resetAll() {
    if (this.account.user) await this.engine.wipeAccount(this.account.user);
    else await this.store.reset();
    await this.applySettings(await this.store.getSettings());
    await this.refresh();
  }

  /** Importazione: con accesso sostituisce anche l'account. */
  async importFile(data: ExportData) {
    if (this.account.user) await this.engine.importIntoAccount(data, this.account.user);
    else await this.store.importData(data);
    await this.applySettings(await this.store.getSettings());
    await this.refresh();
  }

  async afterSession() {
    await this.refresh();
    await this.syncNow();
  }

  /** Applica impostazioni arrivate da fuori (sincronizzazione, importazione, azzeramento). */
  private async applySettings(s: Settings) {
    const before = profileId(this.profile);
    this.settings = s;
    i18n.lang = s.uiLang;
    await this.loadCorpus(s.exerciseLang);
    if (profileId(this.profile) !== before) this.focus = null;
  }

  async saveSettings(patch: Partial<Settings>) {
    const before = profileId(this.profile);
    if (patch.exerciseLang) await this.loadCorpus(patch.exerciseLang);
    this.settings = { ...this.settings, ...patch };
    i18n.lang = this.settings.uiLang;
    await this.store.saveSettings($state.snapshot(this.settings));
    // un altro profilo ha altre statistiche (e un allenamento mirato non ha più senso)
    if (profileId(this.profile) !== before) {
      this.focus = null;
      await this.refresh();
    }
    if (this.account.user) {
      // più modifiche ravvicinate (es. cursori) in una sola sincronizzazione
      if (this.settingsTimer) clearTimeout(this.settingsTimer);
      this.settingsTimer = setTimeout(() => void this.syncNow(), 2000);
    }
  }

  async resolveInterrupted(s: StoredSession, keep: boolean) {
    if (keep && s.samples.length > 0) await this.store.completeSession(s);
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
