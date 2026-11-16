<script lang="ts">
  import { clavisKeymap, keyGeometry, PRESENT_POSITIONS, type LayerName } from '../core/keyboard';

  interface Props {
    layer: LayerName;
    /** Tasto da battere. */
    tap?: number | null;
    /** Tasti da tenere premuti. */
    holds?: number[];
    /** Valori 0..1 per la mappa di calore (null = nessun dato). */
    heat?: (number | null)[] | null;
    /** Testo del tooltip per posizione. */
    titles?: (string | null)[] | null;
  }

  let { layer, tap = null, holds = [], heat = null, titles = null }: Props = $props();

  const U = 54;
  const KEY = 48;
  const STAGGER = [0.4, 0.15, 0, 0.15, 0.3]; // mignolo → colonna interna
  const GAP = 1.6;

  function place(pos: number) {
    const g = keyGeometry(pos);
    const handCol = g.hand === 'L' ? g.col : 9 - g.col;
    let x: number;
    let y: number;
    if (g.row === 3) {
      // pollici: sotto indice e colonna interna, a ventaglio
      const i = handCol - 2; // 0 esterno, 2 interno
      x = (2.55 + i) * U;
      y = (3.35 + i * 0.12) * U;
    } else {
      x = handCol * U;
      y = (g.row + STAGGER[handCol]) * U;
    }
    if (g.hand === 'R') x = (5 + GAP + 5 - 1) * U - x;
    return { x: x + 6, y: y + 6 };
  }

  const HOLD_LABEL: Record<string, string> = { shift: '⇧', ctrl: 'ctrl', alt: 'alt', gui: 'gui' };

  function labelOf(pos: number): { main: string; sub: string } {
    const a = clavisKeymap.layers[layer][pos];
    const base = clavisKeymap.layers.BASE[pos];
    if (holds.includes(pos)) {
      if (base.holdLayer) return { main: base.holdLayer, sub: 'tieni' };
      const mod = a.holdMod ?? base.holdMod;
      if (mod) return { main: HOLD_LABEL[mod], sub: 'tieni' };
    }
    const sub = a.holdLayer ?? (a.holdMod && a.tap ? HOLD_LABEL[a.holdMod] : '');
    return { main: a.label, sub };
  }

  function heatColor(v: number): string {
    // verde (veloce/preciso) → giallo → rosso (lento/errori)
    const hue = 130 - 130 * v;
    return `hsl(${hue} 70% 50% / 0.85)`;
  }

  const width = (5 + GAP + 5) * U + 12;
  const height = 3.65 * U + KEY + 12;
</script>

<svg viewBox="0 0 {width} {height}" class="kb" role="img" aria-label="Tastiera clavis, layer {layer}">
  {#each PRESENT_POSITIONS as k (k.pos)}
    {@const p = place(k.pos)}
    {@const l = labelOf(k.pos)}
    {@const h = heat?.[k.pos] ?? null}
    <g
      class="key"
      class:tap={tap === k.pos}
      class:hold={holds.includes(k.pos)}
      class:empty={!l.main}
      transform="translate({p.x} {p.y})"
    >
      {#if titles?.[k.pos]}<title>{titles[k.pos]}</title>{/if}
      <rect width={KEY} height={KEY} rx="8" style:fill={h !== null ? heatColor(h) : null} />
      <text x={KEY / 2} y={l.sub ? KEY / 2 + 1 : KEY / 2 + 6} class="main">{l.main}</text>
      {#if l.sub}<text x={KEY / 2} y={KEY - 7} class="sub">{l.sub}</text>{/if}
    </g>
  {/each}
</svg>

<style>
  .kb {
    width: 100%;
    max-width: 640px;
    display: block;
    margin: 0 auto;
    user-select: none;
  }
  rect {
    fill: var(--key-bg);
    stroke: var(--key-border);
    stroke-width: 1.5;
    transition: fill 80ms;
  }
  text {
    text-anchor: middle;
    fill: var(--fg);
    font-family: var(--mono);
  }
  .main {
    font-size: 17px;
  }
  .sub {
    font-size: 9px;
    fill: var(--muted);
  }
  .empty rect {
    opacity: 0.45;
  }
  .tap rect {
    fill: var(--accent);
    stroke: var(--accent);
  }
  .tap text {
    fill: var(--accent-fg);
  }
  .hold rect {
    fill: var(--hold);
    stroke: var(--hold);
  }
  .hold text {
    fill: var(--accent-fg);
  }
</style>
