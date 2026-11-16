<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { app } from './app.svelte';
  import Keyboard from './Keyboard.svelte';
  import Results from './Results.svelte';
  import { TypingSession, type SessionEvent } from '../core/session/session';
  import { computeResult, wpm, type SessionResult } from '../core/session/result';
  import { normalizeText } from '../core/exercise/normalize';
  import type { Chord } from '../core/keyboard';
  import type { ExerciseMode, StoredSession } from '../storage/db';
  import { showChar, unitLabel } from './labels';

  const DURATIONS: { label: string; sec: number | null }[] = [
    { label: '30 s', sec: 30 },
    { label: '60 s', sec: 60 },
    { label: '120 s', sec: 120 },
    { label: 'fino alla fine', sec: null },
  ];
  const MODES: { id: ExerciseMode; label: string }[] = [
    { id: 'adaptive', label: 'Adattivo' },
    { id: 'sentences', label: 'Frasi' },
    { id: 'free', label: 'Testo libero' },
  ];

  let session = $state.raw<TypingSession | null>(null);
  /** Contatore per far ridisegnare la vista dopo ogni evento (la sessione non è reattiva). */
  let version = $state(0);
  let now = $state(0);
  let freeText = $state('');
  let notice = $state<string | null>(null);
  let result = $state.raw<SessionResult | null>(null);
  let input: HTMLTextAreaElement | undefined = $state();
  let textBox: HTMLDivElement | undefined = $state();

  let stored: StoredSession | null = null;
  let composing = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let lastSave = 0;

  function generate(): string {
    const s = app.settings;
    const focus = app.focus ?? undefined;
    if (s.mode === 'free') {
      const { text, removed } = normalizeText(freeText, app.resolver);
      notice = removed > 0 ? `Tolti ${removed} caratteri non digitabili su clavis.` : null;
      return text;
    }
    notice = null;
    if (s.mode === 'sentences') {
      const count = s.durationSec ? Math.ceil(s.durationSec / 4) : 6;
      return app.generator.sentences(app.stats, count, Math.random, focus);
    }
    const words = s.durationSec ? Math.ceil(s.durationSec * 2) : 40;
    return app.generator.adaptive(app.stats, {
      words,
      capitals: s.capitals,
      punctuation: s.punctuation,
      digits: s.digits,
      focus,
    });
  }

  async function prepare() {
    stop();
    result = null;
    const text = generate();
    if (!text) {
      notice = 'Il testo è vuoto: incolla qualcosa da digitare.';
      session = null;
      return;
    }
    const sec = app.settings.durationSec;
    session = new TypingSession(text, { durationMs: sec ? sec * 1000 : null });
    stored = null;
    version++;
    await tick();
    input?.focus();
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    window.removeEventListener('beforeunload', onBeforeUnload);
  }

  function onBeforeUnload(e: BeforeUnloadEvent) {
    e.preventDefault();
    e.returnValue = '';
  }

  function snapshot(s: TypingSession): StoredSession {
    stored ??= {
      id: crypto.randomUUID(),
      startedAt: Date.now(),
      mode: app.settings.mode,
      durationMs: s.options.durationMs,
      status: 'in-progress',
      deadKeys: app.settings.deadKeys,
      focus: app.focus ?? undefined,
      samples: [],
      result: computeResult([], 0),
    };
    return { ...stored, samples: [...s.samples], result: computeResult(s.samples, s.activeMs) };
  }

  async function send(ev: SessionEvent) {
    const s = session;
    if (!s || s.done) return;
    const wasReady = s.status === 'ready';
    s.handle(ev);
    version++;
    if (wasReady && s.status === 'running') {
      timer = setInterval(() => send({ type: 'tick', t: performance.now() }), 200);
      window.addEventListener('beforeunload', onBeforeUnload);
      lastSave = ev.t;
    }
    if (s.status === 'running' && ev.t - lastSave > 5000) {
      lastSave = ev.t;
      void app.store.saveInProgress(snapshot(s));
    }
    if (s.status === 'finished') await finish(s);
    else if (s.status === 'aborted') await abort();
    scrollToCursor();
  }

  async function finish(s: TypingSession) {
    stop();
    const record = { ...snapshot(s), status: 'completed' as const };
    result = record.result;
    await app.store.completeSession(record, app.resolver);
    app.focus = null;
    await app.afterSession(); // aggiorna e, con l'accesso, invia la sessione all'account
  }

  async function abort() {
    stop();
    if (stored) await app.store.discardSession(stored.id);
    stored = null;
    session = null;
    notice = 'Sessione abbandonata: non è stata salvata.';
  }

  /** Legge ciò che il campo nascosto ha ricevuto e lo passa alla sessione. */
  function flush(t: number) {
    if (!input || composing) return;
    const text = input.value;
    input.value = '';
    for (const c of text) void send({ type: 'char', data: c, t });
  }

  const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Meta', 'Shift', 'AltGraph', 'OS', 'Hyper', 'Super']);

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      void send({ type: 'abort', t: e.timeStamp });
      return;
    }
    if (MODIFIER_KEYS.has(e.key)) return;
    const altGr = e.getModifierState?.('AltGraph');
    if ((e.ctrlKey || e.altKey || e.metaKey) && !altGr) {
      // home row mod scattato per sbaglio: blocco la scorciatoia (dove il browser lo permette)
      e.preventDefault();
      const mod = e.ctrlKey ? 'ctrl' : e.altKey ? 'alt' : 'gui';
      void send({ type: 'mod', mod, key: e.key, t: e.timeStamp });
      return;
    }
    if (e.key === 'Dead') {
      void send({ type: 'dead', t: e.timeStamp });
      return;
    }
    if (['Tab', 'Enter', 'Backspace', 'Delete'].includes(e.key) || e.key.startsWith('Arrow')) e.preventDefault();
  }

  function onInput(e: Event) {
    if ((e as InputEvent).isComposing) return;
    flush(e.timeStamp);
  }

  function onCompositionEnd(e: CompositionEvent) {
    composing = false;
    flush(e.timeStamp);
  }

  function onBlur() {
    if (session?.status === 'running') void send({ type: 'blur', t: performance.now() });
  }

  async function scrollToCursor() {
    await tick();
    textBox?.querySelector('.cur')?.scrollIntoView({ block: 'nearest' });
  }

  onDestroy(() => {
    stop();
    // uscendo dalla schermata a metà sessione la si abbandona
    if (session && !session.done && stored) void app.store.discardSession(stored.id);
  });

  $effect(() => {
    const id = setInterval(() => (now = performance.now()), 250);
    return () => clearInterval(id);
  });

  // allenamento mirato richiesto dalle statistiche: prepara subito la sessione
  $effect(() => {
    if (app.focus && app.settings.mode !== 'free' && !session) void prepare();
  });

  // derivati per la vista
  const view = $derived.by(() => {
    void version;
    void now;
    const s = session;
    if (!s) return null;
    const expected = s.expected;
    const res = expected ? app.resolver.resolve(expected) : null;
    let stroke: Chord | null = null;
    if (res) stroke = res.dead && s.pendingDead ? res.strokes[1] : res.strokes[0];
    const t = s.status === 'running' ? now : 0;
    const elapsed = s.elapsedAt(t);
    return {
      s,
      stroke,
      elapsed,
      remaining: s.remainingAt(t),
      liveWpm: elapsed > 1000 ? wpm(s.samples.length, elapsed) : 0,
      errored: new Set(s.samples.filter((x) => x.errors > 0).map((x) => x.i)),
    };
  });

  function chooseMode(m: ExerciseMode) {
    void app.saveSettings({ mode: m });
    session = null;
    result = null;
  }

  function chooseDuration(sec: number | null) {
    void app.saveSettings({ durationSec: sec });
    session = null;
  }
</script>

<section class="trainer">
  <div class="toolbar">
    <div class="group" role="group" aria-label="Modalità">
      {#each MODES as m (m.id)}
        <button class:active={app.settings.mode === m.id} onclick={() => chooseMode(m.id)}>{m.label}</button>
      {/each}
    </div>
    <div class="group" role="group" aria-label="Durata">
      {#each DURATIONS as d (d.label)}
        <button class:active={app.settings.durationSec === d.sec} onclick={() => chooseDuration(d.sec)}>{d.label}</button>
      {/each}
    </div>
    <label class="toggle">
      <input
        type="checkbox"
        checked={app.settings.showKeyboard}
        onchange={(e) => app.saveSettings({ showKeyboard: e.currentTarget.checked })}
      />
      tastiera
    </label>
  </div>

  {#if app.focus}
    <p class="focus">
      Allenamento mirato su <strong>{unitLabel(app.focus)}</strong>
      <button class="link" onclick={() => { app.focus = null; session = null; }}>annulla</button>
    </p>
  {/if}

  {#if app.settings.mode === 'free' && !view}
    <textarea class="free" bind:value={freeText} placeholder="Incolla qui il testo da digitare…" rows="6"></textarea>
  {/if}

  {#if notice}<p class="notice">{notice}</p>{/if}

  {#if result}
    <Results {result} onAgain={prepare} />
  {:else if view}
    <div class="live">
      <span>{view.s.status === 'ready' ? 'Comincia a scrivere' : view.s.status === 'paused' ? 'In pausa' : ''}</span>
      <span class="num">{Math.round(view.liveWpm)} WPM</span>
      <span class="num">
        {#if view.remaining !== null}{Math.ceil(view.remaining / 1000)} s{:else}{Math.floor(view.elapsed / 1000)} s{/if}
      </span>
      <button class="link" onclick={() => send({ type: 'abort', t: performance.now() })}>abbandona (Esc)</button>
    </div>

    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="text" bind:this={textBox} onclick={() => input?.focus()}>
      {#each view.s.chars as c, i (i)}
        <span
          class:done={i < view.s.index}
          class:err={view.errored.has(i)}
          class:cur={i === view.s.index}
          class:wrong={i === view.s.index && view.s.currentWrong !== null}
          class:dead={i === view.s.index && view.s.pendingDead}>{c === ' ' && i === view.s.index ? '␣' : c}</span>
      {/each}
    </div>
    <textarea
      class="sink"
      bind:this={input}
      onkeydown={onKeydown}
      oninput={onInput}
      oncompositionstart={() => (composing = true)}
      oncompositionend={onCompositionEnd}
      onblur={onBlur}
      onpaste={(e) => e.preventDefault()}
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      aria-label="Campo di digitazione"
    ></textarea>
    {#if view.s.currentWrong !== null}
      <p class="hint">Hai scritto <code>{showChar(view.s.currentWrong)}</code>, atteso <code>{showChar(view.s.expected ?? '')}</code></p>
    {/if}

    {#if app.settings.showKeyboard && view.stroke}
      <Keyboard layer={view.stroke.layer} tap={view.stroke.tap.pos} holds={view.stroke.holds.map((h) => h.pos)} />
    {/if}
  {:else}
    <div class="start">
      <button class="primary" onclick={prepare}>Prepara la sessione</button>
      <p class="muted">Poi comincia a scrivere: il tempo parte al primo carattere.</p>
    </div>
  {/if}
</section>

<style>
  .trainer {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
  }
  .group {
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }
  .group button {
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  .group button.active {
    background: var(--accent);
    color: var(--accent-fg);
  }
  .toggle {
    display: inline-flex;
    gap: 0.35rem;
    align-items: center;
    color: var(--muted);
  }
  .free {
    width: 100%;
    font: inherit;
  }
  .live {
    display: flex;
    gap: 1.5rem;
    align-items: baseline;
    color: var(--muted);
    flex-wrap: wrap;
  }
  .live .num {
    font-family: var(--mono);
    font-size: 1.25rem;
    color: var(--fg);
  }
  .live .link {
    margin-left: auto;
  }
  .text {
    font-family: var(--mono);
    font-size: 1.5rem;
    line-height: 2.2rem;
    padding: 1rem 1.25rem;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--panel);
    max-height: 8.8rem;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-word;
    cursor: text;
  }
  .text span {
    color: var(--muted);
  }
  .text .done {
    color: var(--fg);
  }
  .text .done.err {
    color: var(--danger);
    text-decoration: underline dotted;
  }
  .text .cur {
    color: var(--fg);
    background: var(--cursor);
    border-radius: 3px;
  }
  .text .cur.wrong {
    background: var(--danger);
    color: var(--accent-fg);
  }
  .text .cur.dead {
    outline: 2px dashed var(--hold);
  }
  .sink {
    position: absolute;
    opacity: 0;
    width: 1px;
    height: 1px;
    pointer-events: none;
  }
  .hint {
    margin: 0;
    color: var(--danger);
  }
  .focus,
  .notice {
    margin: 0;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    background: var(--panel);
  }
  .start {
    text-align: center;
    padding: 2rem 0;
  }
</style>
