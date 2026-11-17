<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { app } from './app.svelte';
  import { ApiError, OfflineError, type LoginStart } from '../sync/api';
  import { t } from '../i18n/index.svelte';

  type Phase = 'starting' | 'waiting' | 'approved' | 'denied' | 'expired' | 'error';
  let phase = $state<Phase>('starting');
  let login = $state.raw<LoginStart | null>(null);
  let message = $state('');
  let now = $state(Date.now());
  let timer: ReturnType<typeof setTimeout> | null = null;
  let clock: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  async function start() {
    phase = 'starting';
    try {
      login = await app.api.startLogin();
      phase = 'waiting';
      schedule();
    } catch (e) {
      phase = 'error';
      message =
        e instanceof OfflineError ? t('login.offline')
        : e instanceof ApiError && e.status === 429 ? t('login.tooMany')
        : String((e as Error).message);
    }
  }

  function schedule() {
    timer = setTimeout(poll, 2000);
  }

  async function poll() {
    if (closed || !login) return;
    try {
      const r = await app.api.pollLogin(login.id, login.pollSecret);
      if (r.status === 'approved' && r.user) {
        phase = 'approved';
        await app.onLogin(r.user);
        setTimeout(close, 1200);
        return;
      }
      if (r.status === 'denied') phase = 'denied';
      else if (r.status === 'expired' || r.status === 'unknown') phase = 'expired';
      else schedule();
    } catch (e) {
      // rete instabile: si riprova finché la richiesta è valida
      if (e instanceof OfflineError && login && Date.now() < login.expiresAt) schedule();
      else {
        phase = 'error';
        message = String((e as Error).message);
      }
    }
  }

  function close() {
    closed = true;
    app.loginOpen = false;
  }

  onMount(() => {
    void start();
    clock = setInterval(() => (now = Date.now()), 1000);
  });

  onDestroy(() => {
    closed = true;
    if (timer) clearTimeout(timer);
    if (clock) clearInterval(clock);
  });

  const remaining = $derived(login ? Math.max(0, Math.ceil((login.expiresAt - now) / 1000)) : 0);
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" onclick={(e) => e.target === e.currentTarget && close()}>
  <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="login-title">
    <h2 id="login-title">{t('account.login')}</h2>

    {#if phase === 'starting'}
      <p class="muted">{t('login.preparing')}</p>
    {:else if phase === 'waiting' && login}
      <ol>
        <li>{t('login.step1')} <a class="tg" href={login.url} target="_blank" rel="noreferrer">{t('login.open')}</a></li>
        <li>{t('login.step2')}</li>
      </ol>
      <p class="code" aria-label={t('login.code')}>{login.code}</p>
      <ol start="3">
        <li>{t('login.step3')}</li>
      </ol>
      <p class="muted small">{t('login.waiting', mmss(remaining))}</p>
    {:else if phase === 'approved'}
      <p class="ok">{t('login.approved')}</p>
    {:else if phase === 'denied'}
      <p class="err">{t('login.denied')}</p>
      <button onclick={start}>{t('common.retry')}</button>
    {:else if phase === 'expired'}
      <p class="err">{t('login.expired')}</p>
      <button class="primary" onclick={start}>{t('login.newCode')}</button>
    {:else}
      <p class="err">{message}</p>
      <button onclick={start}>{t('common.retry')}</button>
    {/if}

    <p class="muted small note">
      {t('login.privacy')}
    </p>
    <div class="actions"><button onclick={close}>{t('common.close')}</button></div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.45);
    display: grid;
    place-items: center;
    padding: 1rem;
    z-index: 10;
  }
  .dialog {
    background: var(--panel);
    color: var(--fg);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 1.25rem 1.5rem;
    max-width: 28rem;
    width: 100%;
  }
  h2 {
    margin: 0 0 0.75rem;
    font-size: 1.2rem;
  }
  ol {
    margin: 0.25rem 0;
    padding-left: 1.25rem;
  }
  li {
    margin: 0.35rem 0;
  }
  .tg {
    font-weight: 600;
  }
  .code {
    font-family: var(--mono);
    font-size: 2rem;
    letter-spacing: 0.3em;
    text-align: center;
    margin: 0.5rem 0;
    padding: 0.5rem;
    border: 1px dashed var(--border);
    border-radius: 8px;
  }
  .small {
    font-size: 0.85rem;
  }
  .note {
    margin-top: 1rem;
  }
  .ok {
    color: var(--ok);
  }
  .err {
    color: var(--danger);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
  }
</style>
