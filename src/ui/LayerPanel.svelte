<script lang="ts">
  import type { BoardKey, ClavisLayer, Modifier, RefKey } from '../core/keyboard';
  import { t } from '../i18n/index.svelte';
  import { PAD, U } from './keyShape';
  import { fnLabel } from './refLabels';

  interface Props {
    layer: ClavisLayer;
    /** Tasti fisici di clavis (geometria). */
    geometry: BoardKey[];
    width: number;
    height: number;
    /** Le 40 posizioni del layer. */
    keys: RefKey[];
    /** Le 40 posizioni del layer BASE: etichetta dei tasti da tenere. */
    baseKeys: RefKey[];
    /** Posizioni da tenere sul layer BASE per attivare questo layer. */
    triggers: number[];
  }

  let { layer, geometry, width, height, keys, baseKeys, triggers }: Props = $props();

  const MOD_LABEL: Record<Modifier, string> = { shift: '⇧', ctrl: 'ctrl', alt: 'alt', gui: 'gui', altgr: 'AltGr' };

  interface Label {
    lines: string[];
    sub: string;
    size: 'char' | 'short' | 'word' | 'long';
  }

  function mainOf(k: RefKey): string {
    if (k.category === 'mod' && k.mod) return MOD_LABEL[k.mod];
    if (k.char) return k.char;
    if (k.fn) return fnLabel(k.fn) ?? '?';
    return '';
  }

  function labelOf(k: RefKey): Label {
    const held = triggers.includes(k.pos);
    // il tasto tenuto mostra quello che è sul layer BASE, se sul layer non fa nulla
    const main = held && k.category === 'none' ? mainOf(baseKeys[k.pos]) : mainOf(k);
    let sub = '';
    if (held) sub = t('kb.hold');
    else if (layer === 'BASE') sub = k.holdLayer ?? (k.mod && k.char ? MOD_LABEL[k.mod] : '');
    const lines = main.split('\n');
    const longest = Math.max(...lines.map((l) => [...l].length));
    const size = longest > 7 ? 'long' : lines.length > 1 || longest > 4 ? 'word' : longest > 2 ? 'short' : 'char';
    return { lines, sub, size };
  }

  const vbW = $derived(width * U + PAD * 2);
  const vbH = $derived(height * U + PAD * 2);
</script>

<svg viewBox="0 0 {vbW} {vbH}" class="panel" role="img" aria-label={t('ref.aria', layer)} data-layer={layer}>
  {#each geometry.filter((g) => g.present) as g (g.pos)}
    {@const k = keys[g.pos]}
    {@const l = labelOf(k)}
    {@const w = g.w * U}
    {@const h = g.h * U}
    {@const lineH = l.size === 'word' || l.size === 'long' ? 13 : 15}
    {@const top = (l.sub ? h / 2 - 2 : h / 2 + 1) - ((l.lines.length - 1) * lineH) / 2}
    <g
      class="key cat-{k.category} size-{l.size}"
      class:held={triggers.includes(g.pos)}
      transform="translate({g.x * U + PAD} {g.y * U + PAD})"
      data-pos={g.pos}
    >
      <rect width={w} height={h} rx="8" />
      <text x={w / 2} y={top} class="main">
        {#each l.lines as line, i (i)}<tspan x={w / 2} dy={i === 0 ? 0 : lineH} dominant-baseline="middle">{line}</tspan>{/each}
      </text>
      {#if l.sub}<text x={w / 2} y={h - 6} class="sub">{l.sub}</text>{/if}
    </g>
  {/each}
</svg>

<style>
  .panel {
    width: 100%;
    display: block;
    user-select: none;
  }
  rect {
    fill: var(--key-bg);
    stroke: var(--key-border);
    stroke-width: 1.5;
  }
  text {
    text-anchor: middle;
    fill: var(--fg);
  }
  .main {
    font-family: var(--mono);
  }
  .size-char .main {
    font-size: 18px;
  }
  .size-short .main {
    font-size: 14px;
  }
  .size-word .main,
  .size-long .main {
    font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
    font-size: 12px;
  }
  .size-long .main {
    font-size: 10.5px;
  }
  .sub {
    font-family: var(--mono);
    font-size: 9px;
    fill: var(--muted);
  }
  .cat-char rect {
    fill: var(--cat-char);
  }
  .cat-mod rect {
    fill: var(--cat-mod);
  }
  .cat-layer rect {
    fill: var(--cat-layer);
  }
  .cat-nav rect {
    fill: var(--cat-nav);
  }
  .cat-media rect {
    fill: var(--cat-media);
  }
  .cat-mouse rect {
    fill: var(--cat-mouse);
  }
  .cat-fkey rect {
    fill: var(--cat-fkey);
  }
  .cat-sys rect {
    fill: var(--cat-sys);
  }
  .cat-none rect {
    fill: transparent;
    stroke-dasharray: 4 3;
    opacity: 0.6;
  }
  .held rect {
    fill: var(--hold);
    stroke: var(--hold);
    stroke-dasharray: none;
    opacity: 1;
  }
  .held text {
    fill: var(--accent-fg);
  }
</style>
