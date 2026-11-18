<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import { fly } from 'svelte/transition';
  import { prefersReducedMotion } from 'svelte/motion';
  import { app } from './app.svelte';
  import { GUIDE_KINDS, resolverFor, type GuideKind } from '../core/keyboard';
  import { GUIDE_STEPS, bumpKeys, guideProfile, homePads } from '../core/guide';
  import { t } from '../i18n/index.svelte';
  import GuideKeyboard from './GuideKeyboard.svelte';
  import { focusOnShow } from './focusOnShow';

  let index = $state(0);
  let dir = $state(1);
  let dialog: HTMLDivElement | undefined = $state();
  /** Elemento con il focus prima dell'apertura, a cui restituirlo. */
  const previous = document.activeElement as HTMLElement | null;

  const kind = $derived<GuideKind>(app.guideOpen ?? 'classic');
  const steps = $derived(GUIDE_STEPS[kind]);
  const step = $derived(steps[Math.min(index, steps.length - 1)]);
  const last = $derived(index >= steps.length - 1);
  const profile = $derived(guideProfile(kind, app.profile));
  const resolver = $derived(resolverFor(profile));
  const reduced = $derived(prefersReducedMotion.current);

  /** Lettera sul tasto `pos` nel layout disegnato. */
  function label(pos: number): string {
    const code = resolver.board.actions.BASE?.[pos]?.code;
    return (code && resolver.os.keys[code]?.[0]?.toUpperCase()) || '';
  }

  function homeLetters(hand: 'L' | 'R'): string {
    const b = resolver.board;
    return homePads(b)
      .filter((p) => p.hand === hand)
      .sort((a, c) => b.keys[a.pos].x - b.keys[c.pos].x)
      .map((p) => label(p.pos))
      .join(' ');
  }

  const body = $derived.by(() => {
    const prefix = `guide.${kind}.${step.id}` as const;
    if (step.id === 'home') return t(`guide.${kind}.home.body`, homeLetters('L'), homeLetters('R'));
    if (step.id === 'bumps') {
      const [f, j] = bumpKeys(resolver.board).map(label);
      return t('guide.classic.bumps.body', f ?? 'F', j ?? 'J');
    }
    return t(`${prefix}.body` as Parameters<typeof t>[0]);
  });

  function go(delta: number) {
    const next = index + delta;
    if (next < 0) return;
    if (next >= steps.length) {
      void close();
      return;
    }
    dir = delta;
    index = next;
  }

  async function close() {
    await app.closeGuide();
  }

  function choose(k: GuideKind) {
    if (k !== kind) app.showGuide(k);
  }

  /** Il focus resta sul pulsante "Avanti" se l'elemento che lo aveva sparisce. */
  $effect(() => {
    void index;
    void tick().then(() => {
      if (dialog && !dialog.contains(document.activeElement)) dialog.querySelector<HTMLElement>('[data-testid="guide-next"]')?.focus();
    });
  });

  /** Elementi raggiungibili con Tab dentro il dialogo. */
  function focusables(): HTMLElement[] {
    return dialog ? [...dialog.querySelectorAll<HTMLElement>('button:not([disabled])')] : [];
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      void close();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(-1);
    } else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
      // su un pulsante Invio lo attiva (e "Avanti" ha già il focus)
      e.preventDefault();
      go(1);
    } else if (e.key === 'Tab') {
      // il focus resta dentro il dialogo
      const els = focusables();
      if (!els.length) return;
      const i = els.indexOf(document.activeElement as HTMLElement);
      const to = e.shiftKey ? (i <= 0 ? els.length - 1 : i - 1) : i === els.length - 1 ? 0 : i + 1;
      e.preventDefault();
      els[to].focus();
    } else {
      return;
    }
    e.stopPropagation();
  }

  /** Il focus non esce dal dialogo (per esempio verso un pulsante dell'allenamento che compare sotto). */
  function onFocusIn(e: FocusEvent) {
    if (dialog && e.target instanceof Node && !dialog.contains(e.target)) focusables().at(-1)?.focus();
  }

  // tasti ascoltati sulla finestra (in cattura): funzionano anche quando il
  // pulsante col focus sparisce, e non arrivano all'allenamento sotto
  onMount(() => {
    document.addEventListener('focusin', onFocusIn);
    window.addEventListener('keydown', onKeydown, true);
  });

  onDestroy(() => {
    document.removeEventListener('focusin', onFocusIn);
    window.removeEventListener('keydown', onKeydown, true);
    void tick().then(() => previous?.focus?.({ preventScroll: true }));
  });

  const flyIn = (node: Element) => fly(node, { x: 30 * dir, duration: reduced ? 0 : 220 });
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" onclick={(e) => e.target === e.currentTarget && close()}>
  <div
    class="dialog"
    role="dialog"
    aria-modal="true"
    aria-labelledby="guide-title"
    aria-describedby="guide-body"
    tabindex="-1"
    bind:this={dialog}
    data-testid="guide"
    data-kind={kind}
    data-step={step.id}
  >
    <div class="top">
      <span class="muted small">{t('guide.label')} · {t('guide.step', index + 1, steps.length)}</span>
      <button class="x" aria-label={t('common.close')} onclick={close}>✕</button>
    </div>

    {#key `${kind}:${step.id}`}
      <div class="text" in:flyIn>
        <h2 id="guide-title">{t(`guide.${kind}.${step.id}.title` as Parameters<typeof t>[0])}</h2>
        <p id="guide-body">{body}</p>
        {#if step.id === 'zones' && profile.layout === 'colemakdh'}<p class="muted small">{t('guide.classic.zones.angle')}</p>{/if}
      </div>
    {/key}

    {#if index === 0}
      <div class="kinds" role="group" aria-label={t('guide.version')}>
        <span class="muted small">{t('guide.version')}</span>
        {#each GUIDE_KINDS as k (k)}
          <button class:active={k === kind} aria-pressed={k === kind} onclick={() => choose(k)}>{t(`guide.kind.${k}`)}</button>
        {/each}
      </div>
    {/if}

    <GuideKeyboard {profile} {step} />
    {#if step.pads !== 'none'}<p class="muted small legend">{t('guide.legend')}</p>{/if}

    <div class="actions">
      <button onclick={() => go(-1)} disabled={index === 0}>{t('guide.back')}</button>
      <div class="dots" aria-hidden="true">
        {#each steps as s, i (s.id)}<span class:on={i === index}></span>{/each}
      </div>
      <!-- aperta da sola: un Invio battuto un attimo prima non salta il primo passo -->
      <button class="primary" use:focusOnShow={app.guideAuto ? 800 : 0} onclick={() => go(1)} data-testid="guide-next">{last ? t('guide.start') : t('guide.next')}</button>
    </div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.5);
    display: grid;
    justify-items: center;
    align-items: start;
    padding: max(1rem, 6vh) 1rem 1rem;
    z-index: 20;
    overflow-y: auto;
  }
  .dialog {
    background: var(--panel);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 1rem 1.5rem 1.25rem;
    max-width: 920px;
    width: 100%;
    box-shadow: 0 20px 60px rgb(0 0 0 / 0.3);
    outline: none;
  }
  .top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .x {
    border: 0;
    background: none;
    font-size: 1.1rem;
    padding: 0.2rem 0.5rem;
  }
  .text {
    min-height: 7.5rem;
  }
  h2 {
    margin: 0.4rem 0 0.4rem;
    font-size: 1.35rem;
  }
  p {
    margin: 0 0 0.6rem;
    max-width: 62ch;
  }
  .small {
    font-size: 0.85rem;
  }
  .legend {
    text-align: center;
    max-width: none;
  }
  .kinds {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 0.6rem;
  }
  .kinds button.active {
    border-color: var(--accent);
    background: var(--bg);
    font-weight: 600;
  }
  .actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    margin-top: 0.5rem;
  }
  .dots {
    display: flex;
    gap: 0.4rem;
  }
  .dots span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--border);
    transition: background 200ms, transform 200ms;
  }
  .dots span.on {
    background: var(--accent);
    transform: scale(1.3);
  }
  @media (prefers-reduced-motion: reduce) {
    .dots span {
      transition: none;
    }
  }
</style>
