<script lang="ts">
  import { app } from './app.svelte';
  import Keyboard from './Keyboard.svelte';
  import LineChart from './LineChart.svelte';
  import type { LayerName } from '../core/keyboard';
  import { byDay, heatmap, summary, type HeatMetric } from '../core/analysis/history';
  import { unexplored, weakest } from '../core/analysis/stats';
  import { UNIT_TYPES, type UnitType } from '../core/analysis/units';
  import { fmtDate, fmtNum, fmtPct, t } from '../i18n/index.svelte';
  import { ms, pct, profileLabel, unitLabel, unitTypeLabel } from './labels';

  let grouping = $state<'session' | 'day'>('session');
  let layer = $state<LayerName>('BASE');
  let metric = $state<HeatMetric>('time');
  let unitType = $state<UnitType>('bigram');

  const resolver = $derived(app.resolver);
  const sessions = $derived(app.profileSessions);
  // le tastiere classiche non hanno layer
  const layers = $derived(resolver.board.layers);
  const unitTypes = $derived(UNIT_TYPES.filter((u) => u !== 'layer' || resolver.hasLayers));
  $effect(() => {
    if (!layers.includes(layer)) layer = 'BASE';
    if (!unitTypes.includes(unitType)) unitType = 'bigram';
  });

  const short = (ts: number) => fmtDate(ts, { day: '2-digit', month: '2-digit' });
  const series = $derived.by(() => {
    if (grouping === 'day') {
      const days = byDay(sessions);
      const label = (d: string) => short(new Date(`${d}T12:00:00`).getTime());
      return {
        wpm: days.map((d) => ({ label: label(d.day), value: d.wpm })),
        acc: days.map((d) => ({ label: label(d.day), value: d.accuracy })),
      };
    }
    return {
      wpm: sessions.map((s) => ({ label: short(s.startedAt), value: s.result.wpm })),
      acc: sessions.map((s) => ({ label: short(s.startedAt), value: s.result.accuracy })),
    };
  });

  const sum = $derived(summary(sessions, Date.now()));
  const heat = $derived.by(() => {
    const h = heatmap(app.stats, resolver, layer, metric);
    // tooltip nella lingua dell'interfaccia
    const titles = h.titles.map((_, pos) => {
      const c = h.chars[pos];
      if (!c) return null;
      const s = app.stats[`char:${c}`];
      const name = c === ' ' ? t('heat.space') : c;
      return s ? t('heat.title', name, ms(s.emaMs), pct(s.emaErr), s.n) : t('heat.noData', name);
    });
    return { values: h.values, titles };
  });
  const ranking = $derived(weakest(app.stats, unitType, 15));
  const fewSamples = $derived(unexplored(app.stats, unitType).length);
  const num = (x: number | null, f: (v: number) => string) => (x === null ? '–' : f(x));
</script>

<section class="stats">
  <p class="muted note">{t('stats.profileNote', profileLabel(app.profile))}</p>
  {#if sessions.length === 0}
    <p class="muted">{t('stats.empty')}</p>
  {/if}

  <div class="tiles">
    <div class="tile"><span class="v">{num(sum.lastWpm, (v) => fmtNum(v))}</span><span class="l">{t('stats.lastWpm')}</span></div>
    <div class="tile"><span class="v">{num(sum.avg7Wpm, (v) => fmtNum(v))}</span><span class="l">{t('stats.avgWpm')}</span></div>
    <div class="tile"><span class="v">{num(sum.lastAccuracy, pct)}</span><span class="l">{t('stats.lastAcc')}</span></div>
    <div class="tile"><span class="v">{num(sum.avg7Accuracy, pct)}</span><span class="l">{t('stats.avgAcc')}</span></div>
    <div class="tile" data-testid="sessions"><span class="v">{sessions.length}</span><span class="l">{t('stats.sessions')}</span></div>
  </div>

  <div class="row">
    <h2>{t('stats.trend')}</h2>
    <div class="group" role="group" aria-label={t('stats.grouping')}>
      <button class:active={grouping === 'session'} onclick={() => (grouping = 'session')}>{t('stats.bySession')}</button>
      <button class:active={grouping === 'day'} onclick={() => (grouping = 'day')}>{t('stats.byDay')}</button>
    </div>
  </div>
  <div class="charts">
    <LineChart title={t('results.wpm')} points={series.wpm} min={0} format={(v) => fmtNum(v)} />
    <LineChart title={t('stats.accuracy')} points={series.acc} format={(v) => fmtPct(v)} max={1} />
  </div>

  <div class="row">
    <h2>{t('stats.heatmap')}</h2>
    {#if layers.length > 1}
      <div class="group" role="group" aria-label={t('stats.layer')}>
        {#each layers as l (l)}
          <button class:active={layer === l} onclick={() => (layer = l)}>{l}</button>
        {/each}
      </div>
    {/if}
    <div class="group" role="group" aria-label={t('stats.metric')}>
      <button class:active={metric === 'time'} onclick={() => (metric = 'time')}>{t('stats.time')}</button>
      <button class:active={metric === 'errors'} onclick={() => (metric = 'errors')}>{t('stats.errors')}</button>
    </div>
  </div>
  <Keyboard {resolver} {layer} heat={heat.values} titles={heat.titles} />
  <p class="muted small">{t('stats.heatHelp')}</p>

  <div class="row">
    <h2>{t('stats.weak')}</h2>
    <div class="group" role="group" aria-label={t('stats.unitType')}>
      {#each unitTypes as u (u)}
        <button class:active={unitType === u} onclick={() => (unitType = u)}>{unitTypeLabel(u)}</button>
      {/each}
    </div>
  </div>
  {#if ranking.length === 0}
    <p class="muted">{t('stats.noRanking')}</p>
  {:else}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th></th><th>{t('stats.col.unit')}</th><th>{t('stats.col.score')}</th><th>{t('stats.col.time')}</th>
            <th>{t('stats.col.errors')}</th><th>{t('stats.col.misfires')}</th><th>{t('stats.col.samples')}</th><th></th>
          </tr>
        </thead>
        <tbody>
          {#each ranking as r, i (r.key)}
            <tr>
              <td class="muted">{i + 1}</td>
              <td><code>{unitLabel(r.key)}</code></td>
              <td>{fmtNum(r.score, 2)}</td>
              <td>{ms(r.stats.emaMs)}</td>
              <td>{pct(r.stats.emaErr)}</td>
              <td>{r.stats.misfires}</td>
              <td>{r.stats.n}</td>
              <td><button onclick={() => app.trainFocus(r.key)}>{t('stats.trainThis')}</button></td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
  {#if fewSamples > 0}
    <p class="muted small">{t('stats.fewSamples', fewSamples)}</p>
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
  .note {
    margin: 0;
  }
  .small {
    font-size: 0.85rem;
    margin: 0;
  }
</style>
