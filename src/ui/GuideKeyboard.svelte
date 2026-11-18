<script lang="ts">
  import { prefersReducedMotion } from 'svelte/motion';
  import { resolverFor, type Finger, type Hand, type Profile } from '../core/keyboard';
  import {
    FINGER_CYCLE, bumpKeys, demoFrames, fingerKey, highlightedKeys, homePads, thumbPads, type DemoFrame, type GuideStep, type Pad,
  } from '../core/guide';
  import { t } from '../i18n/index.svelte';
  import Keyboard from './Keyboard.svelte';
  import { keyBox } from './keyShape';

  interface Props {
    /** Profilo da disegnare (tastiera e layout). */
    profile: Profile;
    step: GuideStep;
  }
  let { profile, step }: Props = $props();

  const resolver = $derived(resolverFor(profile));
  const board = $derived(resolver.board);
  const reduced = $derived(prefersReducedMotion.current);

  /** Lettera maiuscola sul tasto `pos` nel layout del profilo. */
  function upper(pos: number): string {
    const code = board.actions.BASE?.[pos]?.code;
    return (code && resolver.os.keys[code]?.[0]?.toUpperCase()) || '';
  }

  // --- demo e ciclo delle dita: un contatore che avanza finché il passo resta lo stesso
  let tick = $state(0);
  const PERIOD_MS = 1800;
  $effect(() => {
    void step.id;
    tick = 0;
    if (!step.demo && step.zones !== 'cycle') return;
    const id = setInterval(() => tick++, PERIOD_MS);
    return () => clearInterval(id);
  });

  const frames = $derived(demoFrames(board, step));
  // con il movimento ridotto la demo resta sul fotogramma più significativo
  const frame = $derived<DemoFrame | null>(frames.length ? (reduced ? frames[Math.min(1, frames.length - 1)] : frames[tick % frames.length]) : null);
  const active = $derived(step.zones === 'cycle' ? FINGER_CYCLE[tick % FINGER_CYCLE.length] : null);

  const pads = $derived.by<Pad[]>(() => {
    if (step.pads === 'none') return [];
    const base = step.pads === 'all' ? [...homePads(board), ...thumbPads(board)] : homePads(board);
    const moves = frame?.moves ?? [];
    return base.map((p) => moves.find((m) => m.hand === p.hand && m.finger === p.finger) ?? p);
  });

  const COLOR: Record<Finger, string> = {
    pinky: 'var(--finger-pinky)',
    ring: 'var(--finger-ring)',
    middle: 'var(--finger-middle)',
    index: 'var(--finger-index)',
    thumb: 'var(--finger-thumb)',
  };
  const tint = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, var(--key-bg))`;

  /** Tasti che appartengono a una zona: quelli con un keycode (sulla classica solo i tasti che scrivono) e gli Shift. */
  function typing(pos: number): boolean {
    const a = board.actions.BASE?.[pos];
    return !!a && (!!a.code || a.holdMod === 'shift');
  }

  const fill = $derived.by<(string | null)[] | null>(() => {
    if (step.zones === 'none') return null;
    return board.keys.map((k) => {
      if (!k.present || !typing(k.pos)) return null;
      if (step.zones === 'hands') return tint(k.hand === 'L' ? 'var(--finger-index)' : 'var(--finger-ring)', 30);
      const mine = active && k.hand === active.hand && k.finger === active.finger;
      if (step.zones === 'cycle' && active) return tint(COLOR[k.finger], mine ? 70 : 18);
      return tint(COLOR[k.finger], 38);
    });
  });

  // su un altro layer i tasti evidenziati del BASE non hanno più senso: resta il pollice tenuto
  const marked = $derived(frame && frame.layer !== 'BASE' ? [] : highlightedKeys(board, step));
  const bumps = $derived(bumpKeys(board));

  const caption = $derived.by<string | null>(() => {
    if (frame) {
      if (frame.caption === 'shift') {
        const letter = frame.tap !== null ? upper(frame.tap) : '';
        return board.keyboard === 'clavis' ? t('guide.demo.shift.clavis', letter) : t('guide.demo.shift.classic', letter);
      }
      return t(`guide.demo.${frame.caption}`);
    }
    if (active) return `${t(`guide.fingerName.${active.finger as Finger}`)} ${t(`guide.hand.${active.hand}`)}`;
    if (step.zones === 'hands') return `${t('guide.handZone.L')} | ${t('guide.handZone.R')}`;
    return null;
  });

  const R = 12;
  function padCenter(p: Pad): { x: number; y: number } {
    const b = keyBox(board.keys[p.pos]);
    return { x: b.x + b.w * p.at, y: b.y + b.h - 4 };
  }
  const isActive = (hand: Hand, finger: Finger) => !reduced && active?.hand === hand && active.finger === finger;
</script>

<div class="guide-kb" class:reduced>
  <Keyboard
    {resolver}
    layer={frame?.layer ?? 'BASE'}
    tap={frame?.tap ?? null}
    holds={frame?.holds ?? []}
    {fill}
    {marked}
  >
    {#snippet overlay()}
      {#each bumps as pos (pos)}
        {@const b = keyBox(board.keys[pos])}
        <rect class="bump" x={b.x + b.w / 2 - 9} y={b.y + b.h - 13} width="18" height="3" rx="1.5" />
      {/each}
      {#each pads as p, i (fingerKey(p.hand, p.finger))}
        {@const c = padCenter(p)}
        <g class="pad" style:transform="translate({c.x}px, {c.y}px)" style:--delay="{i * 60}ms" data-finger={fingerKey(p.hand, p.finger)}>
          <g class="drop">
            <circle r={R} class:active={isActive(p.hand, p.finger)} style:fill={COLOR[p.finger]} />
            <text y="4">{t(`guide.finger.${p.finger}`)}</text>
          </g>
        </g>
      {/each}
    {/snippet}
  </Keyboard>
  <p class="caption" aria-live="polite">{caption ?? ''}</p>
</div>

<style>
  .guide-kb :global(rect),
  .guide-kb :global(path) {
    transition: fill 250ms, stroke 250ms;
  }
  .bump {
    fill: var(--muted);
    stroke: none;
  }
  .pad {
    transition: transform 450ms cubic-bezier(0.3, 1.3, 0.6, 1);
  }
  .drop {
    animation: drop 500ms cubic-bezier(0.25, 1.4, 0.5, 1) both;
    animation-delay: var(--delay);
  }
  circle {
    stroke: var(--panel);
    stroke-width: 2;
    transform-box: fill-box;
    transform-origin: center;
  }
  circle.active {
    animation: pulse 1s ease-in-out infinite;
  }
  .pad text {
    text-anchor: middle;
    font: 600 11px system-ui, sans-serif;
    fill: var(--finger-fg);
    pointer-events: none;
  }
  .caption {
    min-height: 1.5em;
    margin: 0.4rem 0 0;
    text-align: center;
    color: var(--muted);
    font-size: 0.9rem;
  }
  @keyframes drop {
    from {
      transform: translateY(-40px);
      opacity: 0;
    }
    to {
      transform: none;
      opacity: 1;
    }
  }
  @keyframes pulse {
    50% {
      transform: scale(1.3);
    }
  }
  /* movimento ridotto: tutto già al suo posto, nessuna animazione */
  .reduced :global(*) {
    animation: none !important;
    transition: none !important;
  }
</style>
