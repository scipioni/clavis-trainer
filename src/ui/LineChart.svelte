<script lang="ts">
  import { t } from '../i18n/index.svelte';
  interface Point {
    label: string;
    value: number;
  }
  interface Props {
    points: Point[];
    /** Formatta i valori sull'asse e nei tooltip. */
    format?: (v: number) => string;
    min?: number;
    max?: number;
    title: string;
  }
  let { points, format = (v) => v.toFixed(0), min, max, title }: Props = $props();

  const W = 640;
  const H = 180;
  const PAD = { l: 48, r: 12, t: 12, b: 24 };

  const scale = $derived.by(() => {
    const vals = points.map((p) => p.value);
    let lo = min ?? Math.min(...vals);
    let hi = max ?? Math.max(...vals);
    if (hi - lo < 1e-9) {
      lo -= 1;
      hi += 1;
    }
    const x = (i: number) => PAD.l + (points.length < 2 ? (W - PAD.l - PAD.r) / 2 : (i * (W - PAD.l - PAD.r)) / (points.length - 1));
    const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
    return { lo, hi, x, y };
  });

  const path = $derived(points.map((p, i) => `${i ? 'L' : 'M'}${scale.x(i).toFixed(1)},${scale.y(p.value).toFixed(1)}`).join(''));
  const ticks = $derived([scale.lo, (scale.lo + scale.hi) / 2, scale.hi]);
</script>

<figure>
  <figcaption>{title}</figcaption>
  {#if points.length === 0}
    <p class="muted">{t('stats.noData')}</p>
  {:else}
    <svg viewBox="0 0 {W} {H}" role="img" aria-label={title}>
      {#each ticks as tick (tick)}
        <line x1={PAD.l} x2={W - PAD.r} y1={scale.y(tick)} y2={scale.y(tick)} class="grid" />
        <text x={PAD.l - 6} y={scale.y(tick) + 4} class="axis">{format(tick)}</text>
      {/each}
      <text x={PAD.l} y={H - 6} class="axis start">{points[0].label}</text>
      {#if points.length > 1}<text x={W - PAD.r} y={H - 6} class="axis end">{points[points.length - 1].label}</text>{/if}
      <path d={path} class="line" />
      {#each points as p, i (i)}
        <circle cx={scale.x(i)} cy={scale.y(p.value)} r="3.5"><title>{p.label}: {format(p.value)}</title></circle>
      {/each}
    </svg>
  {/if}
</figure>

<style>
  figure {
    margin: 0;
  }
  figcaption {
    font-weight: 600;
    margin-bottom: 0.25rem;
  }
  svg {
    width: 100%;
    display: block;
  }
  .grid {
    stroke: var(--border);
    stroke-width: 1;
  }
  .axis {
    fill: var(--muted);
    font-size: 11px;
    text-anchor: end;
  }
  .axis.start {
    text-anchor: start;
  }
  .line {
    fill: none;
    stroke: var(--accent);
    stroke-width: 2;
  }
  circle {
    fill: var(--accent);
  }
</style>
