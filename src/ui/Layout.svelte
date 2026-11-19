<script lang="ts">
  import {
    KEY_CATEGORIES,
    OS_MAPS,
    boardFor,
    clavisKeymap,
    layerTriggers,
    referenceKeys,
    type ClavisBase,
    type ClavisLayer,
  } from '../core/keyboard';
  import { t } from '../i18n/index.svelte';
  import { app } from './app.svelte';
  import LayerPanel from './LayerPanel.svelte';

  type Os = 'us' | 'it';
  type Paper = 'A4' | 'A3';
  const PAPER_KEY = 'clavis-trainer.layoutPaper';

  /** Righe della griglia: BASE e BUTTON con la legenda, poi i layer del pollice sinistro e del destro. */
  const ROWS: (ClavisLayer | 'legend')[][] = [
    ['BASE', 'BUTTON', 'legend'],
    ['NAV', 'MOUSE', 'MEDIA'],
    ['SYM', 'NUM', 'FUN'],
  ];

  let base = $state<ClavisBase>('colemakdh');
  let os = $state<Os>('us');
  let touched = $state(false);
  let paper = $state<Paper>(readPaper());

  function readPaper(): Paper {
    try {
      return localStorage.getItem(PAPER_KEY) === 'A3' ? 'A3' : 'A4';
    } catch {
      return 'A4';
    }
  }

  function setPaper(p: Paper) {
    paper = p;
    try {
      localStorage.setItem(PAPER_KEY, p);
    } catch {
      // preferenza solo locale: se il browser non la salva, pazienza
    }
  }

  // preselezione dal profilo salvato, appena il database è pronto, se l'utente non ha già scelto
  $effect(() => {
    if (!app.ready || touched) return;
    const layout = app.settings.layout;
    base = layout === 'colemakdh' ? 'colemakdh' : 'qwerty';
    os = layout === 'it' ? 'it' : 'us';
  });

  function choose(next: { base?: ClavisBase; os?: Os }) {
    touched = true;
    if (next.base) base = next.base;
    if (next.os) os = next.os;
  }

  const board = boardFor({ keyboard: 'clavis', layout: 'colemakdh' });
  const osMap = $derived(OS_MAPS[os]);
  const baseKeys = $derived(referenceKeys(clavisKeymap, 'BASE', base, osMap));

  function holdText(layer: ClavisLayer): string {
    const keys = layerTriggers(clavisKeymap, layer).map((p) => baseKeys[p].char ?? '');
    return keys.length ? t('ref.hold', keys.join(` ${t('ref.or')} `)) : '';
  }

  const pageStyle = $derived(`<style>@page { size: ${paper} landscape; margin: 8mm; }</style>`);
  const site = typeof location === 'undefined' ? '' : `${location.host}${location.pathname}#layout`;
</script>

<svelte:head>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html pageStyle}
</svelte:head>

<section class="layout" data-testid="layout">
  <div class="head">
    <h2>{t('ref.title')}</h2>
    <p class="choice">{t(`ref.base.${base}`)} · {t('ref.os')}: {t(`ref.os.${os}`)}</p>
    <p class="muted intro no-print">{t('ref.intro')}</p>
  </div>

  <div class="controls no-print">
    <div class="group" role="radiogroup" aria-label={t('ref.base')}>
      <span class="label">{t('ref.base')}</span>
      {#each ['colemakdh', 'qwerty'] as const as b (b)}
        <button role="radio" aria-checked={base === b} class:active={base === b} onclick={() => choose({ base: b })} data-testid="ref-base-{b}">{t(`ref.base.${b}`)}</button>
      {/each}
    </div>
    <div class="group" role="radiogroup" aria-label={t('ref.os')}>
      <span class="label">{t('ref.os')}</span>
      {#each ['us', 'it'] as const as o (o)}
        <button role="radio" aria-checked={os === o} class:active={os === o} onclick={() => choose({ os: o })} data-testid="ref-os-{o}">{t(`ref.os.${o}`)}</button>
      {/each}
    </div>
    <div class="group" role="radiogroup" aria-label={t('ref.paper')}>
      <span class="label">{t('ref.paper')}</span>
      {#each ['A4', 'A3'] as const as p (p)}
        <button role="radio" aria-checked={paper === p} class:active={paper === p} onclick={() => setPaper(p)} data-testid="ref-paper-{p}">{p}</button>
      {/each}
      <button class="primary" onclick={() => window.print()} data-testid="ref-print">{t('ref.print')}</button>
    </div>
    <p class="muted note">{t('ref.printNote')}</p>
  </div>

  <div class="grid">
    {#each ROWS.flat() as cell (cell)}
      {#if cell === 'legend'}
        <div class="cell legend" data-testid="ref-legend">
          <h3>{t('ref.legend')}</h3>
          <ul>
            {#each KEY_CATEGORIES as c (c)}
              <li><span class="swatch cat-{c}"></span>{t(`ref.cat.${c}`)}</li>
            {/each}
            <li><span class="swatch held"></span>{t('ref.legend.hold')}</li>
          </ul>
          <p class="muted small">{t('ref.legend.to')}</p>
          <p class="muted small source">{t('ref.source', clavisKeymap.source)}<br /><span class="site">{site}</span></p>
        </div>
      {:else}
        {@const hold = holdText(cell)}
        <figure class="cell" data-testid="ref-panel-{cell}">
          <figcaption>
            <strong>{cell}</strong> <span class="muted">{t(`ref.layer.${cell}`)}</span>
            {#if hold}<span class="hold">{hold}</span>{/if}
          </figcaption>
          <LayerPanel
            layer={cell}
            geometry={board.keys}
            width={board.width}
            height={board.height}
            keys={cell === 'BASE' ? baseKeys : referenceKeys(clavisKeymap, cell, base, osMap)}
            {baseKeys}
            triggers={layerTriggers(clavisKeymap, cell)}
          />
        </figure>
      {/if}
    {/each}
  </div>
</section>

<style>
  .head h2 {
    margin: 0;
    font-family: var(--mono);
  }
  .choice {
    margin: 0.2rem 0 0;
    font-weight: 600;
  }
  .intro {
    margin: 0.4rem 0 0;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1.5rem;
    align-items: center;
    margin: 1rem 0 1.25rem;
  }
  .group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    align-items: center;
  }
  .label {
    color: var(--muted);
    margin-right: 0.2rem;
  }
  .group button.active {
    border-color: var(--accent);
    box-shadow: inset 0 0 0 1px var(--accent);
  }
  .note {
    flex-basis: 100%;
    margin: 0;
    font-size: 0.85rem;
  }
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
  }
  @media (min-width: 760px) {
    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (min-width: 1200px) {
    .grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }
  .cell {
    margin: 0;
    padding: 0.5rem 0.6rem 0.4rem;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--panel);
    min-width: 0;
  }
  figcaption {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 0.5rem;
    align-items: baseline;
    margin-bottom: 0.2rem;
  }
  figcaption strong {
    font-family: var(--mono);
  }
  .hold {
    margin-left: auto;
    padding: 0 0.45rem;
    border-radius: 6px;
    background: var(--hold);
    color: var(--accent-fg);
    font-family: var(--mono);
    font-size: 0.85rem;
  }
  .legend h3 {
    margin: 0 0 0.4rem;
    font-size: 1rem;
  }
  .legend ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.25rem 0.75rem;
    font-size: 0.85rem;
  }
  .legend li {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .swatch {
    flex: none;
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 4px;
    border: 1.5px solid var(--key-border);
    background: var(--key-bg);
  }
  .swatch.cat-char {
    background: var(--cat-char);
  }
  .swatch.cat-mod {
    background: var(--cat-mod);
  }
  .swatch.cat-layer {
    background: var(--cat-layer);
  }
  .swatch.cat-nav {
    background: var(--cat-nav);
  }
  .swatch.cat-media {
    background: var(--cat-media);
  }
  .swatch.cat-mouse {
    background: var(--cat-mouse);
  }
  .swatch.cat-fkey {
    background: var(--cat-fkey);
  }
  .swatch.cat-sys {
    background: var(--cat-sys);
  }
  .swatch.cat-none {
    background: transparent;
    border-style: dashed;
  }
  .swatch.held {
    background: var(--hold);
    border-color: var(--hold);
  }
  .small {
    font-size: 0.8rem;
    margin: 0.5rem 0 0;
  }
  .source {
    overflow-wrap: anywhere;
  }
  .site {
    display: none;
  }

  @media print {
    .no-print {
      display: none;
    }
    .layout {
      font-size: 9pt;
    }
    .head {
      display: flex;
      gap: 1rem;
      align-items: baseline;
      margin-bottom: 3mm;
    }
    .head h2 {
      font-size: 14pt;
    }
    .grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 3mm;
    }
    .cell {
      break-inside: avoid;
      padding: 1.5mm 2mm 1mm;
      border-radius: 2mm;
    }
    .hold,
    .swatch,
    :global(.panel rect) {
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    .legend ul {
      font-size: 8pt;
    }
    .small {
      font-size: 7.5pt;
    }
    .site {
      display: inline;
    }
  }
</style>
