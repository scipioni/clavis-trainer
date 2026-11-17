<script lang="ts">
  import { app } from './app.svelte';
  import { KEYBOARDS, LAYOUTS, type KeyboardId, type LayoutId } from '../core/keyboard';
  import { ALPHABET, LANGS, type Lang } from '../core/exercise/languages';
  import { t } from '../i18n/index.svelte';
  import { keyboardLabel, layoutLabel, showChar } from './labels';

  interface Props {
    /** Forma compatta per la barra dell'allenamento (senza note). */
    compact?: boolean;
  }
  let { compact = false }: Props = $props();

  const unreachable = $derived(app.resolver.unreachable(ALPHABET[app.settings.exerciseLang]));
</script>

<div class="picker" class:compact>
  <label>
    <span>{t('profile.keyboard')}</span>
    <select value={app.settings.keyboard} onchange={(e) => app.saveSettings({ keyboard: e.currentTarget.value as KeyboardId })}>
      {#each KEYBOARDS as k (k)}<option value={k}>{keyboardLabel(k)}</option>{/each}
    </select>
  </label>
  <label>
    <span>{t('profile.layout')}</span>
    <select value={app.settings.layout} onchange={(e) => app.saveSettings({ layout: e.currentTarget.value as LayoutId })}>
      {#each LAYOUTS as l (l)}<option value={l}>{layoutLabel(l)}</option>{/each}
    </select>
  </label>
  <label>
    <span>{t('train.exerciseLang')}</span>
    <select value={app.settings.exerciseLang} onchange={(e) => app.saveSettings({ exerciseLang: e.currentTarget.value as Lang })}>
      {#each LANGS as l (l)}<option value={l}>{t(`lang.${l}`)}</option>{/each}
    </select>
  </label>
</div>

{#if unreachable.length}
  <p class="warn" data-testid="unreachable">{t('profile.unreachable', unreachable.map(showChar).join(' '))}</p>
{:else if !compact}
  <p class="muted small">{t('profile.allReachable')}</p>
{/if}
{#if !compact}
  <p class="muted small">{t('profile.newProfile')}</p>
  {#if app.settings.keyboard === 'clavis'}<p class="muted small">{t('profile.clavisNote')}</p>{/if}
{/if}

<style>
  .picker {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: flex-end;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  label span {
    font-size: 0.8rem;
    color: var(--muted);
  }
  .compact label {
    flex-direction: row;
    align-items: center;
    gap: 0.35rem;
  }
  select {
    font: inherit;
    padding: 0.3rem 0.4rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--panel);
    color: var(--fg);
  }
  .warn {
    margin: 0.25rem 0 0;
    padding: 0.4rem 0.7rem;
    border-left: 3px solid var(--hold);
    background: var(--panel);
    font-size: 0.9rem;
  }
  .small {
    font-size: 0.85rem;
    margin: 0.25rem 0 0;
  }
</style>
