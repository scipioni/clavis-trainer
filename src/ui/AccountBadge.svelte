<script lang="ts">
  import { app } from './app.svelte';
  import { fmtDate, t } from '../i18n/index.svelte';

  const fmtTime = (ts: number) => fmtDate(ts, { hour: '2-digit', minute: '2-digit' });

  const status = $derived.by(() => {
    const a = app.account;
    if (a.syncing) return t('account.syncing');
    const pending = a.pending > 0 ? t('account.pending', a.pending) : '';
    if (a.offline) return `${t('account.offline')}${pending}`;
    if (a.error) return t('account.error');
    return (a.lastSync ? t('account.syncedAt', fmtTime(a.lastSync)) : t('account.notSynced')) + pending;
  });
</script>

{#if app.account.user}
  <button class="badge" onclick={() => (app.view = 'settings')} title={t('account.title')}>
    <span class="dot" class:off={app.account.offline || app.account.error}></span>
    <span class="name">{app.account.user.first_name}</span>
    <span class="status">{status}</span>
  </button>
{:else if app.account.available}
  <button class="login" onclick={() => (app.loginOpen = true)}>{t('account.login')}</button>
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
