<script lang="ts">
  import { onMount } from 'svelte';
  import { app, type View } from './app.svelte';
  import Trainer from './Trainer.svelte';
  import Stats from './Stats.svelte';
  import Settings from './Settings.svelte';
  import About from './About.svelte';
  import AccountBadge from './AccountBadge.svelte';
  import LoginDialog from './LoginDialog.svelte';
  import Guide from './Guide.svelte';
  import { fmtDate, i18n, t } from '../i18n/index.svelte';

  const TABS = $derived<{ id: View; label: string }[]>([
    { id: 'train', label: t('nav.train') },
    { id: 'stats', label: t('nav.stats') },
    { id: 'settings', label: t('nav.settings') },
    { id: 'about', label: t('nav.about') },
  ]);

  // lingua del documento allineata all'interfaccia
  $effect(() => {
    document.documentElement.lang = i18n.lang;
  });

  onMount(() => {
    void app.init();
  });

  // guida al primo avvio e alla prima volta su un tipo di tastiera: aspetta
  // il caricamento, le sessioni interrotte e la fine di una sessione in corso
  $effect(() => {
    if (app.guideDue) app.openGuide(undefined, true);
  });

  const fmt = (ts: number) => fmtDate(ts, { dateStyle: 'short', timeStyle: 'short' });
</script>

<header>
  <h1>clavis<span>trainer</span></h1>
  <nav>
    {#each TABS as t (t.id)}
      <button class:active={app.view === t.id} onclick={() => (app.view = t.id)}>{t.label}</button>
    {/each}
    <button onclick={() => app.openGuide()} disabled={!app.ready || app.sessionActive} data-testid="nav-guide">{t('nav.guide')}</button>
  </nav>
  {#if app.ready}<div class="account"><AccountBadge /></div>{/if}
</header>

{#if app.loginOpen}<LoginDialog />{/if}
{#if app.guideOpen}<Guide />{/if}

<main>
  {#if app.outdated}
    <div class="banner" role="alert">
      {t('app.outdated')}
      <button class="primary" onclick={() => location.reload()}>{t('app.reload')}</button>
    </div>
  {/if}
  {#if app.error}
    <p class="error">{t('app.startError', app.error)}</p>
  {:else if !app.ready}
    {#if app.dbBlocked}
      <p class="banner" role="alert">{t('app.blocked')}</p>
    {:else}
      <p class="muted">{t('app.loading')}</p>
    {/if}
  {:else}
    {#each app.interrupted as s (s.id)}
      <div class="banner">
        {t('app.interrupted', fmt(s.startedAt), s.samples.length)}
        <button onclick={() => app.resolveInterrupted(s, true)}>{t('app.keepInterrupted')}</button>
        <button onclick={() => app.resolveInterrupted(s, false)}>{t('app.discardInterrupted')}</button>
      </div>
    {/each}

    {#if app.view === 'train'}
      <Trainer />
    {:else if app.view === 'stats'}
      <Stats />
    {:else if app.view === 'settings'}
      <Settings />
    {:else}
      <About />
    {/if}
  {/if}
</main>

<style>
  :global(:root) {
    color-scheme: light;
    --bg: #f7f6f2;
    --panel: #ffffff;
    --fg: #1d1f21;
    --muted: #6b6f76;
    --border: #d9d7d0;
    --accent: #2f6fdb;
    --accent-fg: #ffffff;
    --hold: #c2410c;
    --danger: #c62828;
    --ok: #2e7d32;
    --cursor: #ffe08a;
    --key-bg: #ffffff;
    --key-border: #b9b6ad;
    --finger-pinky: #d6336c;
    --finger-ring: #c76a00;
    --finger-middle: #2b8a3e;
    --finger-index: #1c64d4;
    --finger-thumb: #7c4dcc;
    --finger-fg: #ffffff;
    --mono: ui-monospace, 'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :global(:root) {
      color-scheme: dark;
      --bg: #16181b;
      --panel: #1f2226;
      --fg: #e6e6e3;
      --muted: #9a9ea6;
      --border: #34383e;
      --accent: #5b93f0;
      --accent-fg: #0f1114;
      --hold: #f08a4b;
      --danger: #ef5350;
      --ok: #66bb6a;
      --cursor: #6b5a1e;
      --key-bg: #262a2f;
      --key-border: #4a4f57;
      --finger-pinky: #f06595;
      --finger-ring: #ffa94d;
      --finger-middle: #69db7c;
      --finger-index: #74a7f7;
      --finger-thumb: #b197fc;
      --finger-fg: #0f1114;
    }
  }
  :global(body) {
    margin: 0;
    background: var(--bg);
    color: var(--fg);
    font: 15px/1.5 system-ui, -apple-system, 'Segoe UI', sans-serif;
  }
  :global(button),
  :global(label.button) {
    font: inherit;
    padding: 0.4rem 0.8rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--panel);
    color: var(--fg);
    cursor: pointer;
  }
  :global(button:hover),
  :global(label.button:hover) {
    border-color: var(--accent);
  }
  :global(button.primary) {
    background: var(--accent);
    color: var(--accent-fg);
    border-color: var(--accent);
  }
  :global(button.danger) {
    color: var(--danger);
    border-color: var(--danger);
  }
  :global(button.link) {
    border: 0;
    background: none;
    color: var(--accent);
    padding: 0;
    text-decoration: underline;
  }
  :global(.muted) {
    color: var(--muted);
  }
  :global(code) {
    font-family: var(--mono);
  }
  :global(a) {
    color: var(--accent);
  }
  header {
    display: flex;
    align-items: center;
    gap: 2rem;
    flex-wrap: wrap;
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid var(--border);
    background: var(--panel);
  }
  h1 {
    margin: 0;
    font-size: 1.2rem;
    font-family: var(--mono);
  }
  h1 span {
    color: var(--accent);
    margin-left: 0.2rem;
  }
  .account {
    margin-left: auto;
  }
  nav {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }
  nav button {
    border-color: transparent;
    background: transparent;
  }
  nav button.active {
    background: var(--bg);
    border-color: var(--border);
  }
  main {
    max-width: 960px;
    margin: 0 auto;
    padding: 1.5rem 1.25rem 3rem;
  }
  .banner {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    flex-wrap: wrap;
    padding: 0.6rem 0.9rem;
    margin-bottom: 1rem;
    border: 1px solid var(--hold);
    border-radius: 10px;
    background: var(--panel);
  }
  .error {
    color: var(--danger);
  }
</style>
