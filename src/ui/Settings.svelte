<script lang="ts">
  import { app } from './app.svelte';
  import ProfilePicker from './ProfilePicker.svelte';
  import { ImportError, parseExport, type ExportData } from '../storage/db';
  import { LANGS, type Lang } from '../core/exercise/languages';
  import { fmtDate, t } from '../i18n/index.svelte';

  let pendingImport = $state.raw<ExportData | null>(null);
  let confirmReset = $state(false);
  /** 0 = nessuna conferma, 1 = prima conferma, 2 = seconda (sessioni non inviate). */
  let logoutStep = $state(0);
  let message = $state<{ ok: boolean; text: string } | null>(null);

  const fmt = (ts: number) => fmtDate(ts, { dateStyle: 'short', timeStyle: 'short' });

  const sliders = $derived([
    { key: 'capitals', label: t('settings.capitals'), hint: t('settings.capitalsHint') },
    { key: 'punctuation', label: t('settings.punctuation'), hint: t('settings.punctuationHint') },
    { key: 'digits', label: t('settings.digits'), hint: t('settings.digitsHint') },
  ] as const);

  function importErrorText(e: ImportError): string {
    switch (e.code) {
      case 'version':
        return t('import.version', String(e.detail));
      case 'session':
        return t('import.session', Number(e.detail));
      default:
        return t(`import.${e.code}`);
    }
  }

  async function doLogout() {
    if (logoutStep === 1 && app.account.pending > 0) {
      logoutStep = 2;
      return;
    }
    try {
      await app.logout();
      message = { ok: true, text: t('msg.loggedOut') };
    } catch (e) {
      message = { ok: false, text: t('msg.logoutFailed', (e as Error).message) };
    }
    logoutStep = 0;
  }

  async function exportFile() {
    const data = await app.store.exportData();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `clavis-trainer-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    message = { ok: true, text: t('msg.exported', data.sessions.length) };
  }

  async function chooseFile(e: Event & { currentTarget: HTMLInputElement }) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    try {
      pendingImport = parseExport(await file.text());
      message = null;
    } catch (err) {
      pendingImport = null;
      message = { ok: false, text: t('msg.importInvalid', err instanceof ImportError ? importErrorText(err) : String(err)) };
    }
  }

  async function doImport() {
    if (!pendingImport) return;
    try {
      await app.importFile(pendingImport);
      message = { ok: true, text: t('msg.imported', pendingImport.sessions.length) };
    } catch (e) {
      message = { ok: false, text: t('msg.importFailed', (e as Error).message) };
    }
    pendingImport = null;
  }

  async function doReset() {
    confirmReset = false;
    try {
      const account = app.account.user !== null;
      await app.resetAll();
      message = { ok: true, text: account ? t('msg.resetAccount') : t('msg.resetLocal') };
    } catch (e) {
      message = { ok: false, text: t('msg.resetFailed', (e as Error).message) };
    }
  }
</script>

<section class="settings">
  <h2>{t('settings.languages')}</h2>
  <div class="langs">
    <label>
      <span>{t('settings.uiLang')}</span>
      <select value={app.settings.uiLang} onchange={(e) => app.saveSettings({ uiLang: e.currentTarget.value as Lang })} data-testid="ui-lang">
        {#each LANGS as l (l)}<option value={l}>{t(`lang.${l}`)}</option>{/each}
      </select>
    </label>
  </div>

  <h2>{t('settings.profile')}</h2>
  <ProfilePicker />
  <label class="check">
    <input type="checkbox" checked={app.settings.deadKeys} onchange={(e) => app.saveSettings({ deadKeys: e.currentTarget.checked })} />
    <span>
      {t('settings.deadKeys')}
      <small class="muted">{t('settings.deadKeysHelp')}</small>
    </span>
  </label>
  <label class="check">
    <input type="checkbox" checked={app.settings.showKeyboard} onchange={(e) => app.saveSettings({ showKeyboard: e.currentTarget.checked })} />
    <span>{t('settings.showKeyboard')}</span>
  </label>

  <h2>{t('settings.adaptive')}</h2>
  {#each sliders as s (s.key)}
    <label class="slider">
      <span>{s.label} <small class="muted">{s.hint}</small></span>
      <input
        type="range"
        min="0"
        max="0.5"
        step="0.01"
        value={app.settings[s.key]}
        onchange={(e) => app.saveSettings({ [s.key]: Number(e.currentTarget.value) })}
      />
      <output>{Math.round(app.settings[s.key] * 100)}%</output>
    </label>
  {/each}

  {#if app.account.user || app.account.available}
    <h2>{t('settings.account')}</h2>
    {#if app.account.user}
      <p>
        {t('settings.connectedAs')} <strong>{app.account.user.first_name}</strong>{#if app.account.user.username} (@{app.account.user.username}){/if}.
        {t('settings.followsAccount')}
      </p>
      <p class="muted">
        {#if app.account.syncing}{t('settings.syncing')}
        {:else if app.account.offline}{t('settings.offline', app.account.lastSync ? fmt(app.account.lastSync) : t('settings.never'))}
        {:else if app.account.error}{app.account.error}
        {:else}{t('settings.lastSync', app.account.lastSync ? fmt(app.account.lastSync) : t('settings.never'))}{/if}
        {#if app.account.pending > 0}{t('settings.pending', app.account.pending)}{/if}
        {#if app.account.localOnly > 0}{t('settings.localOnly', app.account.localOnly)}{/if}
      </p>
      <div class="actions">
        <button onclick={() => app.syncNow()} disabled={app.account.syncing}>{t('settings.syncNow')}</button>
        {#if logoutStep === 0}
          <button onclick={() => (logoutStep = 1)}>{t('settings.logout')}</button>
        {/if}
      </div>
      {#if logoutStep > 0}
        <div class="confirm">
          {#if logoutStep === 1}
            {t('settings.logoutConfirm')}
            {#if app.account.pending > 0}<strong>{t('settings.logoutLoses', app.account.pending)}</strong>{/if}
          {:else}
            {t('settings.logoutConfirm2')}
          {/if}
          <div class="actions">
            <button class="danger" onclick={doLogout}>{logoutStep === 1 && app.account.pending > 0 ? t('settings.logoutAnyway') : t('settings.logoutDo')}</button>
            <button onclick={() => (logoutStep = 0)}>{t('common.cancel')}</button>
          </div>
        </div>
      {/if}
    {:else}
      <p class="muted">{t('settings.loginPitch')}</p>
      <div class="actions"><button class="primary" onclick={() => (app.loginOpen = true)}>{t('account.login')}</button></div>
    {/if}
  {/if}

  <h2>{t('settings.data')}</h2>
  <p class="muted">{app.account.user ? t('settings.dataAccount') : t('settings.dataLocal')}</p>
  <div class="actions">
    <button onclick={exportFile}>{t('settings.export')}</button>
    <label class="button">
      {t('settings.import')}
      <input type="file" accept="application/json,.json" onchange={chooseFile} hidden />
    </label>
    {#if !confirmReset}
      <button class="danger" onclick={() => (confirmReset = true)}>{t('settings.reset')}</button>
    {/if}
  </div>

  {#if pendingImport}
    <div class="confirm">
      {t('settings.importConfirm', pendingImport.sessions.length, app.sessions.length, app.account.user !== null)}
      <div class="actions">
        <button class="primary" onclick={doImport}>{t('settings.importDo')}</button>
        <button onclick={() => (pendingImport = null)}>{t('common.cancel')}</button>
      </div>
    </div>
  {/if}

  {#if confirmReset}
    <div class="confirm">
      {t('settings.resetConfirm', app.sessions.length, app.account.user?.first_name ?? null)}
      <div class="actions">
        <button class="danger" onclick={doReset}>{t('settings.resetDo')}</button>
        <button onclick={() => (confirmReset = false)}>{t('common.cancel')}</button>
      </div>
    </div>
  {/if}

  {#if message}<p class:error={!message.ok} class="msg">{message.text}</p>{/if}
</section>

<style>
  .settings {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    max-width: 44rem;
  }
  h2 {
    margin: 1rem 0 0;
    font-size: 1.2rem;
  }
  .langs label {
    display: inline-flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .langs span {
    font-size: 0.8rem;
    color: var(--muted);
  }
  .langs select {
    font: inherit;
    padding: 0.3rem 0.4rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--panel);
    color: var(--fg);
  }
  .check {
    display: flex;
    gap: 0.6rem;
    align-items: flex-start;
  }
  .check span {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .slider {
    display: grid;
    grid-template-columns: 1fr minmax(8rem, 14rem) 3rem;
    gap: 0.75rem;
    align-items: center;
  }
  .slider span {
    display: flex;
    flex-direction: column;
  }
  .actions {
    display: flex;
    gap: 0.6rem;
    flex-wrap: wrap;
  }
  .confirm {
    padding: 0.9rem 1rem;
    border: 1px solid var(--danger);
    border-radius: 10px;
    background: var(--panel);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .msg {
    margin: 0;
    color: var(--ok);
  }
  .msg.error {
    color: var(--danger);
  }
</style>
