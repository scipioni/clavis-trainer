<script lang="ts">
  import type { SessionResult } from '../core/session/result';
  import { pct, ms, showChar } from './labels';
  import { fmtNum, t } from '../i18n/index.svelte';
  import { focusOnShow } from './focusOnShow';

  interface Props {
    result: SessionResult;
    onAgain: () => void;
  }
  let { result, onAgain }: Props = $props();

  const details = $derived([
    { v: String(result.errors), l: t('results.errors'), zero: result.errors === 0 },
    { v: String(result.deadErrors), l: t('results.deadErrors'), zero: result.deadErrors === 0 },
    { v: String(result.modMisfires), l: t('results.misfires'), zero: result.modMisfires === 0 },
    { v: String(result.chars), l: t('results.chars'), zero: false },
    { v: `${(result.activeMs / 1000).toFixed(0)} s`, l: t('results.time'), zero: false },
  ]);

  const rankings = $derived([
    { title: t('results.slowChars'), rows: result.slowestChars.map((x) => ({ ...x, label: showChar(x.key) })) },
    {
      title: t('results.slowBigrams'),
      rows: result.slowestBigrams.map((x) => ({ ...x, label: [...x.key].map(showChar).join('') })),
    },
  ]);
</script>

<section class="results">
  <div class="head">
    <h2>{t('results.title')}</h2>
    <button class="primary again" use:focusOnShow onclick={onAgain}>
      {t('results.again')} <kbd aria-hidden="true">⏎</kbd>
    </button>
  </div>

  <div class="summary">
    <div class="tile hero"><span class="v">{fmtNum(result.wpm)}</span><span class="l">{t('results.wpm')}</span></div>
    <div class="tile hero"><span class="v">{pct(result.accuracy)}</span><span class="l">{t('results.accuracy')}</span></div>
    <div class="details">
      {#each details as d (d.l)}
        <div class="tile small" class:zero={d.zero}><span class="v">{d.v}</span><span class="l">{d.l}</span></div>
      {/each}
    </div>
  </div>

  <div class="rankings">
    {#each rankings as r (r.title)}
      <div class="ranking">
        <h3>{r.title}</h3>
        <ol>
          {#each r.rows as x, i (x.key)}
            <li>
              <span class="n">{i + 1}</span>
              <code>{x.label}</code>
              <span class="ms">{ms(x.avgMs)}</span>
              <span class="count">×{x.count}</span>
            </li>
          {/each}
        </ol>
      </div>
    {/each}
  </div>
</section>

<style>
  .results {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    flex-wrap: wrap;
  }
  h2 {
    margin: 0;
    font-size: 1.25rem;
  }
  .again kbd {
    margin-left: 0.4rem;
    font-family: var(--mono);
    opacity: 0.75;
  }
  .summary {
    display: grid;
    grid-template-columns: 1fr 1fr 2fr;
    gap: 0.75rem;
  }
  .tile {
    display: flex;
    flex-direction: column;
    padding: 0.75rem 1rem;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--panel);
  }
  .hero {
    justify-content: center;
  }
  .hero .v {
    font-size: 2.5rem;
    line-height: 1.1;
    font-family: var(--mono);
  }
  .l {
    color: var(--muted);
    font-size: 0.85rem;
  }
  .details {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
    gap: 0.5rem;
  }
  .small {
    padding: 0.4rem 0.75rem;
  }
  .small .v {
    font-size: 1.15rem;
    font-family: var(--mono);
  }
  .small.zero .v {
    color: var(--muted);
  }
  .rankings {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
  .ranking {
    padding: 0.75rem 1rem;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--panel);
  }
  h3 {
    margin: 0 0 0.5rem;
    font-size: 0.95rem;
  }
  ol {
    margin: 0;
    padding: 0;
    list-style: none;
    font-family: var(--mono);
  }
  li {
    display: grid;
    grid-template-columns: 1.5rem 1fr auto 3rem;
    align-items: baseline;
    gap: 0.5rem;
    padding: 0.15rem 0;
    font-variant-numeric: tabular-nums;
  }
  li + li {
    border-top: 1px solid var(--border);
  }
  .n,
  .count {
    color: var(--muted);
  }
  .ms,
  .count {
    text-align: right;
  }
  @media (max-width: 640px) {
    .summary {
      grid-template-columns: 1fr 1fr;
    }
    .details {
      grid-column: 1 / -1;
    }
    .rankings {
      grid-template-columns: 1fr;
    }
  }
</style>
