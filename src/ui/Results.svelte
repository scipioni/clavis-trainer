<script lang="ts">
  import type { SessionResult } from '../core/session/result';
  import { pct, ms, showChar } from './labels';

  interface Props {
    result: SessionResult;
    onAgain: () => void;
  }
  let { result, onAgain }: Props = $props();
</script>

<section class="results">
  <div class="tiles">
    <div class="tile"><span class="v">{Math.round(result.wpm)}</span><span class="l">WPM</span></div>
    <div class="tile"><span class="v">{pct(result.accuracy)}</span><span class="l">precisione</span></div>
    <div class="tile"><span class="v">{result.errors}</span><span class="l">errori</span></div>
    <div class="tile"><span class="v">{result.deadErrors}</span><span class="l">da tasti morti</span></div>
    <div class="tile"><span class="v">{result.modMisfires}</span><span class="l">mod involontari</span></div>
    <div class="tile"><span class="v">{(result.activeMs / 1000).toFixed(0)} s</span><span class="l">{result.chars} caratteri</span></div>
  </div>

  <div class="cols">
    <div>
      <h3>Caratteri più lenti</h3>
      <ol>
        {#each result.slowestChars as x (x.key)}
          <li><code>{showChar(x.key)}</code> {ms(x.avgMs)} <span class="muted">×{x.count}</span></li>
        {/each}
      </ol>
    </div>
    <div>
      <h3>Bigrammi più lenti</h3>
      <ol>
        {#each result.slowestBigrams as x (x.key)}
          <li><code>{[...x.key].map(showChar).join('')}</code> {ms(x.avgMs)} <span class="muted">×{x.count}</span></li>
        {/each}
      </ol>
    </div>
  </div>

  <button class="primary" onclick={onAgain}>Nuova sessione</button>
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
