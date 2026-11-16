<script lang="ts">
  import { app } from './app.svelte';
  import Keyboard from './Keyboard.svelte';
  import LineChart from './LineChart.svelte';
  import { clavisKeymap, type LayerName } from '../core/keyboard';
  import { byDay, heatmap, summary, type HeatMetric } from '../core/analysis/history';
  import { unexplored, weakest } from '../core/analysis/stats';
  import { UNIT_TYPES, UNIT_TYPE_LABELS, type UnitType } from '../core/analysis/units';
  import { ms, pct, unitLabel } from './labels';

  let grouping = $state<'session' | 'day'>('session');
  let layer = $state<LayerName>('BASE');
  let metric = $state<HeatMetric>('time');
  let unitType = $state<UnitType>('bigram');

  const fmtDate = (t: number) => new Date(t).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });

  const series = $derived.by(() => {
    if (grouping === 'day') {
      const days = byDay(app.sessions);
      return {
        wpm: days.map((d) => ({ label: d.day.slice(5).split('-').reverse().join('/'), value: d.wpm })),
        acc: days.map((d) => ({ label: d.day.slice(5).split('-').reverse().join('/'), value: d.accuracy })),
      };
    }
    return {
      wpm: app.sessions.map((s) => ({ label: fmtDate(s.startedAt), value: s.result.wpm })),
      acc: app.sessions.map((s) => ({ label: fmtDate(s.startedAt), value: s.result.accuracy })),
    };
  });

  const sum = $derived(summary(app.sessions, Date.now()));
  const heat = $derived(heatmap(app.stats, clavisKeymap, layer, metric));
  const ranking = $derived(weakest(app.stats, unitType, 15));
  const fewSamples = $derived(unexplored(app.stats, unitType).length);
  const num = (x: number | null, f: (v: number) => string) => (x === null ? '–' : f(x));
</script>

<section class="stats">
  {#if app.sessions.length === 0}
    <p class="muted">Nessuna sessione completata. Fai qualche sessione di allenamento e torna qui.</p>
  {/if}

  <div class="tiles">
    <div class="tile"><span class="v">{num(sum.lastWpm, (v) => v.toFixed(0))}</span><span class="l">WPM ultima sessione</span></div>
    <div class="tile"><span class="v">{num(sum.avg7Wpm, (v) => v.toFixed(0))}</span><span class="l">WPM media 7 giorni</span></div>
    <div class="tile"><span class="v">{num(sum.lastAccuracy, pct)}</span><span class="l">precisione ultima</span></div>
    <div class="tile"><span class="v">{num(sum.avg7Accuracy, pct)}</span><span class="l">precisione media 7 giorni</span></div>
    <div class="tile"><span class="v">{app.sessions.length}</span><span class="l">sessioni</span></div>
  </div>

  <div class="row">
    <h2>Andamento</h2>
    <div class="group" role="group" aria-label="Raggruppamento">
      <button class:active={grouping === 'session'} onclick={() => (grouping = 'session')}>per sessione</button>
      <button class:active={grouping === 'day'} onclick={() => (grouping = 'day')}>per giorno</button>
    </div>
  </div>
  <div class="charts">
    <LineChart title="WPM" points={series.wpm} min={0} />
    <LineChart title="Precisione" points={series.acc} format={(v) => `${(v * 100).toFixed(1)}%`} max={1} />
  </div>

  <div class="row">
    <h2>Mappa di calore</h2>
    <div class="group" role="group" aria-label="Layer">
      {#each ['BASE', 'NUM', 'SYM'] as const as l (l)}
        <button class:active={layer === l} onclick={() => (layer = l)}>{l}</button>
      {/each}
    </div>
    <div class="group" role="group" aria-label="Metrica">
      <button class:active={metric === 'time'} onclick={() => (metric = 'time')}>tempo</button>
      <button class:active={metric === 'errors'} onclick={() => (metric = 'errors')}>errori</button>
    </div>
  </div>
  <Keyboard {layer} heat={heat.values} titles={heat.titles} />
  <p class="muted small">Verde = veloce o preciso, rosso = lento o con errori, rispetto agli altri tasti del layer. Passa sopra un tasto per i valori.</p>

  <div class="row">
    <h2>Punti deboli</h2>
    <div class="group" role="group" aria-label="Tipo di unità">
      {#each UNIT_TYPES as t (t)}
        <button class:active={unitType === t} onclick={() => (unitType = t)}>{UNIT_TYPE_LABELS[t]}</button>
      {/each}
    </div>
  </div>
  {#if ranking.length === 0}
    <p class="muted">Ancora nessuna unità con almeno 5 campioni.</p>
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th></th><th>unità</th><th>punteggio</th><th>tempo medio</th><th>errori</th><th>mod involontari</th><th>campioni</th><th></th></tr>
        </thead>
        <tbody>
          {#each ranking as r, i (r.key)}
            <tr>
              <td class="muted">{i + 1}</td>
              <td><code>{unitLabel(r.key)}</code></td>
              <td>{r.score.toFixed(2)}</td>
              <td>{ms(r.stats.emaMs)}</td>
              <td>{pct(r.stats.emaErr)}</td>
              <td>{r.stats.misfires}</td>
              <td>{r.stats.n}</td>
              <td><button onclick={() => app.trainFocus(r.key)}>allena questo</button></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
  {#if fewSamples > 0}
    <p class="muted small">{fewSamples} unità di questo tipo hanno meno di 5 campioni: poco esplorate, escluse dalla classifica.</p>
  {/if}
</section>

<style>
  .stats {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
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
  .v {
    font-size: 1.5rem;
    font-family: var(--mono);
  }
  .l {
    color: var(--muted);
    font-size: 0.85rem;
  }
  .row {
    display: flex;
    gap: 1rem;
    align-items: center;
    flex-wrap: wrap;
    margin-top: 1rem;
  }
  h2 {
    margin: 0;
    font-size: 1.2rem;
  }
  .charts {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
    gap: 1.5rem;
  }
  .group {
    display: inline-flex;
    flex-wrap: wrap;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }
  .group button {
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  .group button.active {
    background: var(--accent);
    color: var(--accent-fg);
  }
  .table-wrap {
    overflow-x: auto;
  }
  table {
    border-collapse: collapse;
    width: 100%;
  }
  th,
  td {
    text-align: left;
    padding: 0.35rem 0.6rem;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  th {
    color: var(--muted);
    font-weight: 500;
  }
  .small {
    font-size: 0.85rem;
    margin: 0;
  }
</style>
