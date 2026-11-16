import { clavisResolver, type Resolver } from '../core/keyboard';
import { ExerciseGenerator, type Corpus } from '../core/exercise/generator';
import type { StatsTable } from '../core/analysis/stats';
import { DEFAULT_SETTINGS, TrainerStore, type Settings, type StoredSession } from '../storage/db';

export type View = 'train' | 'stats' | 'settings' | 'about';

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

  store!: TrainerStore;
  corpus!: Corpus;
  private generators = new Map<boolean, ExerciseGenerator>();

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
        fetch('./corpus/words.json').then((r) => r.json()),
        fetch('./corpus/sentences.json').then((r) => r.json()),
      ]);
      this.store = store;
      this.corpus = { words: words.words, sentences: sentences.sentences };
      this.settings = await store.getSettings();
      await this.refresh();
      this.interrupted = await store.findInProgress();
      this.ready = true;
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
    }
  }

  async refresh() {
    this.stats = await this.store.getStats();
    this.sessions = await this.store.listSessions();
  }

  async saveSettings(patch: Partial<Settings>) {
    this.settings = { ...this.settings, ...patch };
    await this.store.saveSettings($state.snapshot(this.settings));
  }

  async resolveInterrupted(s: StoredSession, keep: boolean) {
    if (keep && s.samples.length > 0) await this.store.completeSession(s, clavisResolver({ deadKeys: s.deadKeys }));
    else await this.store.discardSession(s.id);
    this.interrupted = this.interrupted.filter((x) => x.id !== s.id);
    await this.refresh();
  }

  trainFocus(key: string) {
    this.focus = key;
    this.view = 'train';
  }
}

export const app = new AppState();
