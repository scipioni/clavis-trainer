<script lang="ts">
  import { app } from './app.svelte';

  const fmtTime = (t: number) => new Date(t).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

  const status = $derived.by(() => {
    const a = app.account;
    if (a.syncing) return 'sincronizzazione…';
    const pending = a.pending > 0 ? ` · ${a.pending} ${a.pending === 1 ? 'sessione' : 'sessioni'} da inviare` : '';
    if (a.offline) return `offline${pending}`;
    if (a.error) return 'errore di sincronizzazione';
    return a.lastSync ? `sincronizzato alle ${fmtTime(a.lastSync)}${pending}` : `non ancora sincronizzato${pending}`;
  });
</script>

{#if app.account.user}
  <button class="badge" onclick={() => (app.view = 'settings')} title="Account e sincronizzazione">
    <span class="dot" class:off={app.account.offline || app.account.error}></span>
    <span class="name">{app.account.user.first_name}</span>
    <span class="status">{status}</span>
  </button>
{:else if app.account.available}
  <button class="login" onclick={() => (app.loginOpen = true)}>Accedi con Telegram</button>
{/if}

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    border-color: transparent;
    background: transparent;
    font-size: 0.9rem;
  }
  .dot {
    width: 0.55rem;
    height: 0.55rem;
    border-radius: 50%;
    background: var(--ok);
  }
  .dot.off {
    background: var(--hold);
  }
  .name {
    font-weight: 600;
  }
  .status {
    color: var(--muted);
  }
  .login {
    border-color: var(--accent);
    color: var(--accent);
  }
</style>
