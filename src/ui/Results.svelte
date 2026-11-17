<script lang="ts">
  import type { SessionResult } from '../core/session/result';
  import { pct, ms, showChar } from './labels';
  import { fmtNum, t } from '../i18n/index.svelte';

  interface Props {
    result: SessionResult;
    onAgain: () => void;
  }
  let { result, onAgain }: Props = $props();
</script>

<section class="results">
  <div class="tiles">
    <div class="tile"><span class="v">{fmtNum(result.wpm)}</span><span class="l">{t('results.wpm')}</span></div>
    <div class="tile"><span class="v">{pct(result.accuracy)}</span><span class="l">{t('results.accuracy')}</span></div>
    <div class="tile"><span class="v">{result.errors}</span><span class="l">{t('results.errors')}</span></div>
    <div class="tile"><span class="v">{result.deadErrors}</span><span class="l">{t('results.deadErrors')}</span></div>
    <div class="tile"><span class="v">{result.modMisfires}</span><span class="l">{t('results.misfires')}</span></div>
    <div class="tile"><span class="v">{(result.activeMs / 1000).toFixed(0)} s</span><span class="l">{t('results.chars', result.chars)}</span></div>
  </div>

  <div class="cols">
    <div>
      <h3>{t('results.slowChars')}</h3>
      <ol>
        {#each result.slowestChars as x (x.key)}
          <li><code>{showChar(x.key)}</code> {ms(x.avgMs)} <span class="muted">×{x.count}</span></li>
        {/each}
      </ol>
    </div>
    <div>
      <h3>{t('results.slowBigrams')}</h3>
      <ol>
        {#each result.slowestBigrams as x (x.key)}
          <li><code>{[...x.key].map(showChar).join('')}</code> {ms(x.avgMs)} <span class="muted">×{x.count}</span></li>
        {/each}
      </ol>
    </div>
  </div>

  <button class="primary" onclick={onAgain}>{t('results.again')}</button>
</section>

<style>
  .results {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    align-items: flex-start;
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
    gap: 0.75rem;
    width: 100%;
  }
  .tile {
    display: flex;
    flex-direction: column;
    padding: 0.75rem 1rem;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--panel);
  }
  .v {
    font-size: 1.75rem;
    font-family: var(--mono);
  }
  .l {
    color: var(--muted);
    font-size: 0.85rem;
  }
  .cols {
    display: flex;
    gap: 3rem;
    flex-wrap: wrap;
  }
  h3 {
    margin: 0 0 0.5rem;
    font-size: 1rem;
  }
  ol {
    margin: 0;
    padding-left: 1.25rem;
    font-family: var(--mono);
  }
</style>
