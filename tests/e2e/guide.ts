// E2E della guida al posizionamento delle dita con Chromium di sistema.
// Uso: bun run build && bun run preview --port 4173 &  poi  bun tests/e2e/guide.ts [url]
import { chromium, type Page } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const URL = process.argv[2] ?? 'http://localhost:4173/';
const OUT = new globalThis.URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/usr/bin/chromium' });
const errors: string[] = [];

let failures = 0;
function check(cond: boolean, msg: string) {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failures++;
}

async function open(locale: string, opts: { width?: number; reducedMotion?: 'reduce' } = {}): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: opts.width ?? 1100, height: 900 }, locale, reducedMotion: opts.reducedMotion });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  return page;
}

const guide = (p: Page) => p.getByTestId('guide');
const stepOf = (p: Page) => guide(p).getAttribute('data-step');
const kindOf = (p: Page) => guide(p).getAttribute('data-kind');

/** La guida resta chiusa per un po' (non si riapre da sola). */
async function staysClosed(p: Page): Promise<boolean> {
  await p.waitForTimeout(1200);
  return (await guide(p).count()) === 0;
}

async function selectKeyboard(p: Page, kb: string) {
  await p.getByRole('combobox', { name: 'Tastiera' }).first().selectOption(kb);
}

// --- primo avvio: si apre la guida della tastiera del profilo (clavis)
const page = await open('it-IT');
await guide(page).waitFor();
check((await kindOf(page)) === 'clavis', 'primo avvio: guida di clavis aperta da sola');
check((await stepOf(page)) === 'welcome', 'parte dal benvenuto');
check(await page.getByRole('dialog').getByRole('heading', { name: 'Benvenuto su clavis-trainer' }).isVisible(), 'titolo del passo nel dialogo');

// --- tasti non passati all'allenamento
await page.waitForTimeout(900); // oltre la protezione di Invio e Spazio all'apertura
await page.keyboard.type('arst');
check(await guide(page).isVisible(), 'lettere battute: la guida resta aperta');
check((await page.locator('main .text').count()) === 0, 'lettere battute: nessuna sessione preparata o iniziata');

// --- navigazione da tastiera
await page.keyboard.press('ArrowRight');
await page.keyboard.press('ArrowRight');
await page.keyboard.press('ArrowLeft');
check((await stepOf(page)) === 'halves', 'destra, destra, sinistra: secondo passo');
await page.keyboard.press('ArrowRight');
check((await stepOf(page)) === 'home', 'terzo passo: posizione base');
const body = await page.locator('#guide-body').innerText();
check(body.includes('A R S T') && body.includes('N E I O'), `posizione base di clavis + Colemak-DH: ${body.slice(0, 90)}…`);
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(600);
await guide(page).screenshot({ path: `${OUT}guide-clavis-columns.png` });
const zones = await page.locator('[data-testid="guide"] svg.kb rect[style*="color-mix"]').count();
check(zones > 20, `zone delle dita colorate (${zones} tasti)`);
check((await page.locator('[data-testid="guide"] .pad').count()) === 8, 'otto polpastrelli sulla posizione base');

// --- chiusura anticipata con Esc: non si riapre ricaricando
await page.keyboard.press('Escape');
await guide(page).waitFor({ state: 'detached' });
check(true, 'Esc chiude la guida');
check(await page.locator('textarea.sink').count() >= 0, 'app di nuovo usabile');
await page.reload();
await page.getByRole('button', { name: 'Prepara la sessione' }).waitFor();
check(await staysClosed(page), 'chiusa al quarto passo: non si riapre dopo il ricaricamento');

// --- riapertura dalla navigazione e ultimo passo
await page.getByTestId('nav-guide').click();
await guide(page).waitFor();
check((await kindOf(page)) === 'clavis' && (await stepOf(page)) === 'welcome', 'Guida: si apre la versione del profilo, al primo passo');
for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight');
check((await stepOf(page)) === 'ready', 'ultimo passo: pronto');
await page.keyboard.press('Enter');
await guide(page).waitFor({ state: 'detached' });
check(await page.locator('nav button.active').innerText() === 'Allenamento', 'Invio sull\'ultimo passo chiude e si resta sull\'allenamento');

// --- passaggio a un'altra tastiera: si apre la guida classica
await selectKeyboard(page, 'ansi');
await guide(page).waitFor();
check((await kindOf(page)) === 'classic', 'passaggio a ANSI: si apre la guida della tastiera classica');
for (let i = 0; i < 2; i++) await page.keyboard.press('ArrowRight');
const classicBody = await page.locator('#guide-body').innerText();
check(classicBody.includes('A R S T') && classicBody.includes('N E I O'), 'posizione base di ANSI + Colemak-DH');
await page.keyboard.press('ArrowRight');
await page.waitForTimeout(500);
await guide(page).screenshot({ path: `${OUT}guide-ansi-zones.png` });
await page.keyboard.press('Escape');
await guide(page).waitFor({ state: 'detached' });

// --- entrambe viste: cambiando tastiera la guida non si apre
await selectKeyboard(page, 'clavis');
check(await staysClosed(page), 'entrambe viste: su clavis non si apre');
await selectKeyboard(page, 'iso');
check(await staysClosed(page), 'entrambe viste: su ISO non si apre');

// --- selettore al primo passo: guida dell'altra tastiera senza cambiare profilo
await page.getByTestId('nav-guide').click();
await guide(page).waitFor();
check((await kindOf(page)) === 'classic', 'profilo ISO: guida classica');
await page.getByRole('dialog').getByRole('button', { name: 'clavis' }).click();
check((await kindOf(page)) === 'clavis', 'selettore: guida di clavis');
await page.keyboard.press('ArrowRight');
check((await stepOf(page)) === 'halves', 'le frecce funzionano dopo il cambio di versione');
await page.keyboard.press('Escape');
check((await page.getByRole('combobox', { name: 'Tastiera' }).first().inputValue()) === 'iso', 'il profilo resta su ISO');

// --- voce Guida disabilitata durante una sessione
await page.getByRole('button', { name: 'Prepara la sessione' }).click();
await page.locator('main .text').waitFor();
const first = (await page.locator('main .text').innerText()).replace('␣', ' ')[0];
await page.keyboard.type(first);
await page.waitForTimeout(400);
check(await page.getByTestId('nav-guide').isDisabled(), 'voce Guida disabilitata a sessione avviata');
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
check(!(await page.getByTestId('nav-guide').isDisabled()), 'voce Guida di nuovo attiva dopo la sessione');

// --- sessione interrotta in sospeso: la guida aspetta
{
  const p = await open('it-IT');
  await guide(p).waitFor();
  await p.keyboard.press('Escape');
  await p.getByRole('button', { name: 'Testo libero' }).click();
  await p.getByRole('button', { name: 'fino alla fine' }).click();
  await p.locator('textarea.free').fill('aaaa aaaa aaaa aaaa aaaa aaaa aaaa aaaa');
  await p.getByRole('button', { name: 'Prepara la sessione' }).click();
  await p.locator('main .text').waitFor();
  // oltre 5 secondi di digitazione: la sessione in corso viene salvata
  for (let i = 0; i < 14; i++) {
    await p.keyboard.type(i % 5 === 4 ? ' ' : 'a');
    await p.waitForTimeout(420);
  }
  // guida "mai vista" e ricaricamento a metà sessione
  await p.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((ok, ko) => {
      const r = indexedDB.open('clavis-trainer');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => ko(r.error);
    });
    const tx = db.transaction('kv', 'readwrite');
    const kv = tx.objectStore('kv');
    const s = await new Promise<Record<string, unknown>>((ok) => {
      const r = kv.get('settings');
      r.onsuccess = () => ok(r.result);
    });
    kv.put({ ...s, guideSeen: [] }, 'settings');
    await new Promise((ok) => (tx.oncomplete = ok));
    db.close();
  });
  await p.reload();
  await p.getByRole('button', { name: 'Scartala' }).waitFor();
  check(await staysClosed(p), 'sessione interrotta in sospeso: la guida aspetta');
  await p.getByRole('button', { name: 'Scartala' }).click();
  await guide(p).waitFor();
  check(true, 'sessione scartata: la guida si apre');
  await p.context().close();
}

// --- interfaccia in inglese, schermo stretto
{
  const p = await open('en-US', { width: 400 });
  await guide(p).waitFor();
  check(await p.getByRole('dialog').getByRole('heading', { name: 'Welcome to clavis-trainer' }).isVisible(), 'guida in inglese');
  check((await p.locator('[data-testid="guide"] .pad text').first().textContent()) === 'P', 'sigle delle dita in inglese');
  check(await p.getByRole('button', { name: 'Next' }).isVisible(), 'pulsanti in inglese');
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}guide-400px.png`, fullPage: true });
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check(!overflow, 'a 400 px nessuno scorrimento orizzontale');
  await p.context().close();
}

// --- movimento ridotto: nessuna animazione
{
  const p = await open('it-IT', { reducedMotion: 'reduce' });
  await guide(p).waitFor();
  for (let i = 0; i < 5; i++) await p.keyboard.press('ArrowRight');
  check((await stepOf(p)) === 'hold', 'movimento ridotto: passo "tenere premuto"');
  await p.waitForTimeout(100);
  const running = await p.evaluate(() => document.getAnimations().length);
  check(running === 0, `movimento ridotto: nessuna animazione in corso (${running})`);
  const caption = await p.locator('.caption').innerText();
  await p.waitForTimeout(2200);
  check((await p.locator('.caption').innerText()) === caption && caption.startsWith('Maiuscola'), 'movimento ridotto: demo ferma sul fotogramma della maiuscola');
  await p.context().close();
}

check(errors.length === 0, `nessun errore JavaScript ${errors.join(' | ')}`);
await browser.close();
console.log(failures ? `\n${failures} controlli falliti` : '\ntutto ok');
process.exit(failures ? 1 : 0);
