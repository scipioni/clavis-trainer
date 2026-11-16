<script lang="ts">
  import { app } from './app.svelte';
  import { ImportError, parseExport, type ExportData } from '../storage/db';

  let pendingImport = $state.raw<ExportData | null>(null);
  let confirmReset = $state(false);
  let message = $state<{ ok: boolean; text: string } | null>(null);

  const sliders = [
    { key: 'capitals', label: 'Maiuscole', hint: 'probabilità che una parola inizi con la maiuscola' },
    { key: 'punctuation', label: 'Punteggiatura', hint: 'virgole, punti, parentesi, virgolette, apostrofi' },
    { key: 'digits', label: 'Cifre', hint: 'numeri inseriti tra le parole' },
  ] as const;

  async function exportFile() {
    const data = await app.store.exportData();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `clavis-trainer-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    message = { ok: true, text: `Esportate ${data.sessions.length} sessioni.` };
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
      message = { ok: false, text: err instanceof ImportError ? `File non valido: ${err.message}. I dati non sono stati toccati.` : String(err) };
    }
  }

  async function doImport() {
    if (!pendingImport) return;
    await app.store.importData(pendingImport, app.resolver);
    message = { ok: true, text: `Importate ${pendingImport.sessions.length} sessioni.` };
    pendingImport = null;
    app.settings = await app.store.getSettings();
    await app.refresh();
  }

  async function doReset() {
    await app.store.reset();
    confirmReset = false;
    app.settings = await app.store.getSettings();
    await app.refresh();
    message = { ok: true, text: 'Tutti i dati sono stati cancellati.' };
  }
</script>

<section class="settings">
  <h2>Tastiera</h2>
  <label class="check">
    <input type="checkbox" checked={app.settings.deadKeys} onchange={(e) => app.saveSettings({ deadKeys: e.currentTarget.checked })} />
    <span>
      Tasti morti di US International
      <small class="muted">Con i tasti morti <code>'</code> <code>"</code> <code>`</code> <code>~</code> <code>^</code> si scrivono seguiti da spazio e le accentate come tasto morto + lettera. Senza, le accentate non sono digitabili e spariscono dagli esercizi.</small>
    </span>
  </label>
  <label class="check">
    <input type="checkbox" checked={app.settings.showKeyboard} onchange={(e) => app.saveSettings({ showKeyboard: e.currentTarget.checked })} />
    <span>Mostra la tastiera durante l'allenamento</span>
  </label>

  <h2>Esercizi adattivi</h2>
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

  <h2>Dati</h2>
  <p class="muted">I dati restano in questo browser. Esportali ogni tanto: cancellando i dati del sito si perdono.</p>
  <div class="actions">
    <button onclick={exportFile}>Esporta JSON</button>
    <label class="button">
      Importa JSON…
      <input type="file" accept="application/json,.json" onchange={chooseFile} hidden />
    </label>
    {#if !confirmReset}
      <button class="danger" onclick={() => (confirmReset = true)}>Cancella tutti i dati…</button>
    {/if}
  </div>

  {#if pendingImport}
    <div class="confirm">
      Il file contiene {pendingImport.sessions.length} sessioni. Importarlo <strong>sostituisce</strong> tutte le sessioni e le statistiche attuali ({app.sessions.length} sessioni).
      <div class="actions">
        <button class="primary" onclick={doImport}>Sostituisci i dati</button>
        <button onclick={() => (pendingImport = null)}>Annulla</button>
      </div>
    </div>
  {/if}

  {#if confirmReset}
    <div class="confirm">
      Cancellare {app.sessions.length} sessioni, le statistiche e le impostazioni? Non si può annullare.
      <div class="actions">
        <button class="danger" onclick={doReset}>Sì, cancella tutto</button>
        <button onclick={() => (confirmReset = false)}>Annulla</button>
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
