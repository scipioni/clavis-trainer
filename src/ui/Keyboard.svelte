<script lang="ts">
  import type { Snippet } from 'svelte';
  import { SPECIAL_LABELS, type LayerName, type Resolver } from '../core/keyboard';
  import { t } from '../i18n/index.svelte';
  import { PAD, U, isoEnterPath } from './keyShape';

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
    /** Colore di riempimento per posizione (ha la precedenza sulla mappa di calore). */
    fill?: (string | null)[] | null;
    /** Tasti in evidenza (bordo spesso). */
    marked?: number[];
    /** Disegno sovrapposto ai tasti, nelle stesse coordinate dell'SVG. */
    overlay?: Snippet;
  }

  let { resolver, layer = 'BASE', tap = null, holds = [], heat = null, titles = null, fill = null, marked = [], overlay }: Props = $props();
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

  function fillOf(pos: number): string | null {
    const f = fill?.[pos];
    if (f) return f;
    const h = heat?.[pos] ?? null;
    return h !== null ? heatColor(h) : null;
  }

  const width = $derived(board.width * U + PAD * 2);
  const height = $derived(board.height * U + PAD * 2);
</script>

<svg viewBox="0 0 {width} {height}" class="kb" class:classic={board.keyboard !== 'clavis'} role="img" aria-label={t('kb.aria', layer)}>
  {#each board.keys.filter((k) => k.present) as k (k.pos)}
    {@const l = labelOf(k.pos)}
    {@const f = fillOf(k.pos)}
    {@const w = k.w * U}
    {@const ht = k.h * U}
    <g
      class="key"
      class:tap={tap === k.pos}
      class:hold={holds.includes(k.pos)}
      class:empty={!l.main}
      class:marked={marked.includes(k.pos)}
      transform="translate({k.x * U + PAD} {k.y * U + PAD})"
    >
      {#if titles?.[k.pos]}<title>{titles[k.pos]}</title>{/if}
      {#if k.isoEnter}
        <path d={isoEnterPath(k.w, k.h)} style:fill={f} />
      {:else}
        <rect width={w} height={ht} rx="8" style:fill={f} />
      {/if}
      <text x={k.isoEnter ? w / 2 + 0.12 * U : w / 2} y={l.sub ? ht / 2 + 1 : (k.isoEnter ? 0.95 * U : ht) / 2 + 6} class="main">{l.main}</text>
      {#if l.sub}<text x={w / 2} y={ht - 7} class="sub">{l.sub}</text>{/if}
    </g>
  {/each}
  {@render overlay?.()}
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
  .marked rect,
  .marked path {
    stroke: var(--accent);
    stroke-width: 3.5;
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
