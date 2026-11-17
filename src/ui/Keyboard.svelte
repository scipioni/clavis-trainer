<script lang="ts">
  import { SPECIAL_LABELS, type LayerName, type Resolver } from '../core/keyboard';
  import { t } from '../i18n/index.svelte';

  interface Props {
    /** Tastiera (board) e mappa del sistema del profilo. */
    resolver: Resolver;
    layer?: LayerName;
    /** Tasto da battere. */
    tap?: number | null;
    /** Tasti da tenere premuti. */
    holds?: number[];
    /** Valori 0..1 per la mappa di calore (null = nessun dato). */
    heat?: (number | null)[] | null;
    /** Testo del tooltip per posizione. */
    titles?: (string | null)[] | null;
  }

  let { resolver, layer = 'BASE', tap = null, holds = [], heat = null, titles = null }: Props = $props();

  const U = 54;
  const PAD = 6;
  const board = $derived(resolver.board);

  const MOD_LABEL: Record<string, string> = { shift: '⇧', ctrl: 'ctrl', alt: 'alt', gui: 'gui', altgr: 'AltGr' };

  function labelOf(pos: number): { main: string; sub: string } {
    const a = board.actions[layer]?.[pos];
    const base = board.actions.BASE?.[pos];
    if (holds.includes(pos)) {
      if (base?.holdLayer && layer !== 'BASE' && !a?.holdMod) return { main: base.holdLayer, sub: t('kb.hold') };
      const mod = a?.holdMod ?? base?.holdMod;
      if (mod) return { main: MOD_LABEL[mod], sub: t('kb.hold') };
    }
    let main = a?.label ?? '';
    if (a?.code) {
      const ch = resolver.os.keys[a.code]?.[a.shift ? 1 : 0];
      main = ch && ch !== ' ' ? ch : (SPECIAL_LABELS[a.code] ?? a.label);
    }
    // su clavis, sotto l'etichetta: layer o modificatore tenendo premuto
    const sub = board.keyboard === 'clavis' ? (a?.holdLayer ?? (a?.holdMod && a.code ? MOD_LABEL[a.holdMod] : '')) : '';
    return { main, sub };
  }

  function heatColor(v: number): string {
    // verde (veloce/preciso) → giallo → rosso (lento/errori)
    const hue = 130 - 130 * v;
    return `hsl(${hue} 70% 50% / 0.85)`;
  }

  /** Invio ISO a L: parte alta larga 1,5, parte bassa 1,25 allineata a destra. */
  function isoEnterPath(w: number, h: number): string {
    const top = w * U;
    const step = 0.25 * U;
    const mid = 0.95 * U;
    const r = 8;
    return `M${r},0 H${top - r} Q${top},0 ${top},${r} V${h * U - r} Q${top},${h * U} ${top - r},${h * U} H${step + r} Q${step},${h * U} ${step},${h * U - r} V${mid} H${r} Q0,${mid} 0,${mid - r} V${r} Q0,0 ${r},0 Z`;
  }

  const width = $derived(board.width * U + PAD * 2);
  const height = $derived(board.height * U + PAD * 2);
</script>

<svg viewBox="0 0 {width} {height}" class="kb" class:classic={board.keyboard !== 'clavis'} role="img" aria-label={t('kb.aria', layer)}>
  {#each board.keys.filter((k) => k.present) as k (k.pos)}
    {@const l = labelOf(k.pos)}
    {@const h = heat?.[k.pos] ?? null}
    {@const w = k.w * U}
    {@const ht = k.h * U}
    <g
      class="key"
      class:tap={tap === k.pos}
      class:hold={holds.includes(k.pos)}
      class:empty={!l.main}
      transform="translate({k.x * U + PAD} {k.y * U + PAD})"
    >
      {#if titles?.[k.pos]}<title>{titles[k.pos]}</title>{/if}
      {#if k.isoEnter}
        <path d={isoEnterPath(k.w, k.h)} style:fill={h !== null ? heatColor(h) : null} />
      {:else}
        <rect width={w} height={ht} rx="8" style:fill={h !== null ? heatColor(h) : null} />
      {/if}
      <text x={k.isoEnter ? w / 2 + 0.12 * U : w / 2} y={l.sub ? ht / 2 + 1 : (k.isoEnter ? 0.95 * U : ht) / 2 + 6} class="main">{l.main}</text>
      {#if l.sub}<text x={w / 2} y={ht - 7} class="sub">{l.sub}</text>{/if}
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
  .kb.classic {
    max-width: 860px;
  }
  rect,
  path {
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
  .classic .main {
    font-size: 15px;
  }
  .sub {
    font-size: 9px;
    fill: var(--muted);
  }
  .empty rect,
  .empty path {
    opacity: 0.45;
  }
  .tap rect,
  .tap path {
    fill: var(--accent);
    stroke: var(--accent);
  }
  .tap text {
    fill: var(--accent-fg);
  }
  .hold rect,
  .hold path {
    fill: var(--hold);
    stroke: var(--hold);
  }
  .hold text {
    fill: var(--accent-fg);
  }
</style>
