// E2E della pagina Layout (mappa dei layer di clavis) con Chromium di sistema.
// Uso: bun run build && bun run preview --port 4173 &  poi  bun tests/e2e/layout.ts [url]
import { chromium, type BrowserContext, type Page } from 'playwright-core';
import { mkdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dismissGuide } from './dismissGuide';

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

async function context(locale = 'it-IT', opts: { width?: number; colorScheme?: 'light' | 'dark' } = {}): Promise<BrowserContext> {
  return browser.newContext({ viewport: { width: opts.width ?? 1280, height: 900 }, locale, colorScheme: opts.colorScheme ?? 'light' });
}

async function open(ctx: BrowserContext, path = '#layout'): Promise<Page> {
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL + path);
  return page;
}

const panel = (p: Page, layer: string) => p.getByTestId(`ref-panel-${layer}`);
/** Etichette principali delle posizioni `from..to-1` di un pannello (righe unite da spazio). */
async function labels(p: Page, layer: string, from: number, to: number): Promise<string[]> {
  const out: string[] = [];
  for (let pos = from; pos < to; pos++) {
    const text = await panel(p, layer).locator(`[data-pos="${pos}"] text.main`).textContent();
    out.push((text ?? '').trim());
  }
  return out;
}
const sub = (p: Page, layer: string, pos: number) => panel(p, layer).locator(`[data-pos="${pos}"] text.sub`).textContent();
const caption = async (p: Page, layer: string) => ((await panel(p, layer).locator('figcaption').textContent()) ?? '').replace(/\s+/g, ' ').trim();

// --- link diretto da un nuovo visitatore: 8 pannelli, niente guida
{
  const ctx = await context();
  const p = await open(ctx);
  await panel(p, 'NAV').waitFor();
  check((await p.locator('[data-testid^="ref-panel-"]').count()) === 8, 'link diretto: 8 pannelli');
  await p.waitForTimeout(1200);
  check((await p.getByTestId('guide').count()) === 0, 'link diretto: la guida non si apre da sola');
  check((await labels(p, 'BASE', 0, 10)).join(' ') === 'q w f p b j l u y ;', 'senza profilo: Colemak-DH, riga superiore q w f p b j l u y ;');
  check((await p.getByTestId('ref-os-us').getAttribute('aria-checked')) === 'true', 'senza profilo: sistema US');

  // contenuto dei layer
  check((await labels(p, 'MEDIA', 1, 4)).join(' ') === '7 8 9', 'MEDIA: tastierino 7 8 9 a sinistra');
  check((await labels(p, 'MEDIA', 20, 24)).join(' ') === '0 1 2 3', 'MEDIA: 0 1 2 3 sulla riga inferiore sinistra');
  check((await labels(p, 'MEDIA', 26, 30)).join(' ') === 'BT 0 BT 1 BT 2 BT 3', 'MEDIA: Bluetooth a destra');
  check((await labels(p, 'NAV', 16, 20)).join(' ') === '← ↓ ↑ →', 'NAV: frecce sulla riga base destra');
  check((await labels(p, 'NAV', 21, 24)).join(' ') === 'Taglia Copia Incolla', 'NAV: Ctrl+X/C/V per significato');
  check((await sub(p, 'BASE', 10)) === 'gui' && (await sub(p, 'BASE', 13)) === '⇧', 'BASE: home row mod sotto le lettere');
  check((await sub(p, 'BASE', 33)) === 'NAV', 'BASE: layer sotto i pollici');

  // tasto che attiva il layer
  check(await panel(p, 'NAV').locator('[data-pos="33"]').evaluate((e) => e.classList.contains('held')), 'NAV: pollice sinistro centrale evidenziato');
  check((await caption(p, 'NAV')).includes('tieni ␣'), 'NAV: il titolo dice di tenere spazio');
  const buttonHeld = await panel(p, 'BUTTON').locator('.held').evaluateAll((els) => els.map((e) => e.getAttribute('data-pos')));
  check(buttonHeld.join(',') === '20,29', 'BUTTON: evidenziati i due tasti che lo attivano');
  check((await caption(p, 'BUTTON')).includes('tieni z o /'), 'BUTTON: tieni z o /');

  // legenda e tasti spenti
  check((await p.getByTestId('ref-legend').locator('li').count()) === 10, 'legenda: 9 categorie più il tasto da tenere');
  check(await panel(p, 'NAV').locator('[data-pos="4"]').evaluate((e) => e.classList.contains('cat-none')), 'tasto non disponibile disegnato spento');
  check((await labels(p, 'NAV', 4, 5))[0] === '', 'tasto non disponibile senza etichetta');

  // scelta della base e del sistema
  const navBefore = await panel(p, 'NAV').innerHTML();
  await p.getByTestId('ref-base-qwerty').click();
  check((await labels(p, 'BASE', 0, 10)).join(' ') === 'q w e r t y u i o p', 'QWERTY: riga superiore q w e r t y u i o p');
  check((await panel(p, 'NAV').innerHTML()) === navBefore, 'QWERTY: gli altri pannelli non cambiano');
  check((await labels(p, 'NUM', 0, 1))[0] === '[', 'US: [ in alto a sinistra in NUM');
  await p.getByTestId('ref-os-it').click();
  check((await labels(p, 'NUM', 0, 1))[0] === 'è', 'italiano: è sullo stesso tasto');

  // ordine dei pannelli su schermo largo
  const ys: Record<string, number> = {};
  for (const id of ['ref-panel-BASE', 'ref-panel-BUTTON', 'ref-legend', 'ref-panel-NAV', 'ref-panel-MOUSE', 'ref-panel-MEDIA', 'ref-panel-SYM', 'ref-panel-NUM', 'ref-panel-FUN']) {
    ys[id] = Math.round((await p.getByTestId(id).boundingBox())!.y);
  }
  const row = (ids: string[]) => ids.every((id) => ys[`ref-${id}`] === ys[`ref-${ids[0]}`]);
  check(
    row(['panel-BASE', 'panel-BUTTON', 'legend']) && row(['panel-NAV', 'panel-MOUSE', 'panel-MEDIA']) && row(['panel-SYM', 'panel-NUM', 'panel-FUN']) &&
      ys['ref-panel-BASE'] < ys['ref-panel-NAV'] && ys['ref-panel-NAV'] < ys['ref-panel-SYM'],
    '1280 px: righe BASE/BUTTON/legenda, NAV/MOUSE/MEDIA, SYM/NUM/FUN',
  );

  // stampa: una sola pagina orizzontale del formato scelto, palette chiara anche col tema scuro
  await p.emulateMedia({ colorScheme: 'dark' });
  for (const [paper, w, h] of [['A4', 842, 595], ['A3', 1191, 842]] as const) {
    await p.getByTestId(`ref-paper-${paper}`).click();
    const path = `${OUT}layout-${paper}.pdf`;
    await p.pdf({ path, preferCSSPageSize: true });
    const pdf = readFileSync(path, 'latin1');
    const pages = pdf.match(/\/Type\s*\/Page\b/g)?.length ?? 0;
    const box = /\/MediaBox\s*\[\s*0 0 ([\d.]+) ([\d.]+)\s*\]/.exec(pdf);
    const size = box ? [Math.round(+box[1]), Math.round(+box[2])] : [];
    check(pages === 1 && size[0] === w && size[1] === h, `stampa ${paper}: una pagina orizzontale ${w}×${h} pt (trovate ${pages}, ${size.join('×')})`);
    const text = spawnSync('pdftotext', [path, '-'], { encoding: 'utf8' });
    if (text.status === 0) {
      const s = text.stdout;
      check(['Layout di clavis', 'QWERTY', 'Italiano', 'Legenda', 'Taglia', 'BUTTON', 'FUN'].every((x) => s.includes(x)), `stampa ${paper}: titolo, scelte, legenda ed etichette nel PDF`);
      check(!s.includes('Stampa / PDF') && !s.includes('Allenamento'), `stampa ${paper}: senza controlli né navigazione`);
    } else console.log(`- stampa ${paper}: pdftotext non disponibile, testo non controllato`);
  }
  const printBg = await p.evaluate(async () => {
    return getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  });
  check(printBg === '#16181b', 'a schermo resta il tema scuro (la palette chiara vale solo in stampa)');
  await p.emulateMedia({ media: 'print', colorScheme: 'dark' });
  const inPrint = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check(inPrint === 'rgb(255, 255, 255)', 'in stampa con il tema scuro: sfondo bianco');
  await p.emulateMedia({ media: 'screen', colorScheme: 'light' });

  // scelta del foglio ricordata
  await p.reload();
  await panel(p, 'NAV').waitFor();
  check((await p.getByTestId('ref-paper-A3').getAttribute('aria-checked')) === 'true', 'foglio scelto (A3) ricordato dopo il ricaricamento');

  // screenshot dei pannelli nei due temi, da controllare a vista
  for (const scheme of ['light', 'dark'] as const) {
    await p.emulateMedia({ colorScheme: scheme });
    await p.screenshot({ path: `${OUT}layout-${scheme}.png`, fullPage: true });
  }
  await p.emulateMedia({ colorScheme: 'light' });

  // passando all'allenamento la guida si apre come al primo avvio, e l'indirizzo perde #layout
  await p.getByRole('navigation').getByRole('button', { name: 'Allenamento' }).click();
  await p.getByTestId('guide').waitFor();
  check(true, "passaggio all'allenamento: la guida si apre da sola");
  check(!p.url().includes('#layout'), "ritorno all'allenamento: indirizzo senza #layout");
  await ctx.close();
}

// --- dalla navigazione, e indietro del browser
{
  const ctx = await context();
  const p = await open(ctx, '');
  await dismissGuide(p);
  await p.getByRole('navigation').getByRole('button', { name: 'Statistiche' }).click();
  await p.getByRole('navigation').getByRole('button', { name: 'Layout' }).click();
  await panel(p, 'BASE').waitFor();
  check(p.url().endsWith('#layout'), 'dalla navigazione: indirizzo /#layout');
  await p.goBack();
  await p.waitForTimeout(300);
  check((await panel(p, 'BASE').count()) === 0 && !p.url().includes('#layout'), 'indietro: si lascia la pagina Layout');
  check(await p.getByRole('navigation').getByRole('button', { name: 'Statistiche' }).evaluate((e) => e.classList.contains('active')), 'indietro: si torna alla vista precedente (Statistiche)');
  await p.goForward();
  await panel(p, 'BASE').waitFor();
  check(true, 'avanti: di nuovo la pagina Layout');

  // profilo italiano: preselezione; la scelta nella pagina non cambia il profilo
  await p.getByRole('navigation').getByRole('button', { name: 'Impostazioni' }).click();
  await p.getByRole('combobox', { name: 'Tastiera' }).first().selectOption('iso');
  await p.getByRole('combobox', { name: 'Layout' }).first().selectOption('it');
  await p.waitForTimeout(500);
  await p.goto(URL + '#layout');
  await panel(p, 'BASE').waitFor();
  await p.waitForTimeout(500);
  check(
    (await p.getByTestId('ref-base-qwerty').getAttribute('aria-checked')) === 'true' && (await p.getByTestId('ref-os-it').getAttribute('aria-checked')) === 'true',
    'profilo classica ISO + Italiano QWERTY: QWERTY e italiano preselezionati',
  );
  await p.getByTestId('ref-base-colemakdh').click();
  await p.getByTestId('ref-os-us').click();
  await p.getByRole('navigation').getByRole('button', { name: 'Impostazioni' }).click();
  check(
    (await p.getByRole('combobox', { name: 'Tastiera' }).first().inputValue()) === 'iso' && (await p.getByRole('combobox', { name: 'Layout' }).first().inputValue()) === 'it',
    'la scelta nella pagina non cambia il profilo',
  );
  await ctx.close();
}

// --- interfaccia in inglese
{
  const ctx = await context('en-US');
  const p = await open(ctx);
  await panel(p, 'NAV').waitFor();
  check((await labels(p, 'NAV', 21, 24)).join(' ') === 'Cut Copy Paste', 'inglese: Cut Copy Paste');
  check((await caption(p, 'NAV')).includes('hold ␣'), 'inglese: hold ␣');
  await ctx.close();
}

// --- schermo stretto: una colonna nello stesso ordine, niente scorrimento orizzontale
{
  const ctx = await context('it-IT', { width: 400 });
  const p = await open(ctx);
  await panel(p, 'NAV').waitFor();
  const order = await p.locator('.grid > *').evaluateAll((els) => els.map((e) => [e.getAttribute('data-testid'), Math.round(e.getBoundingClientRect().x), Math.round(e.getBoundingClientRect().y)] as const));
  const ids = order.map((o) => o[0]?.replace('ref-', '').replace('panel-', ''));
  check(ids.join(',') === 'BASE,BUTTON,legend,NAV,MOUSE,MEDIA,SYM,NUM,FUN', '400 px: ordine BASE, BUTTON, legenda, NAV, MOUSE, MEDIA, SYM, NUM, FUN');
  check(order.every((o) => o[1] === order[0][1]) && order.every((o, i) => i === 0 || o[2] > order[i - 1][2]), '400 px: una sola colonna');
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(overflow <= 0, `400 px: nessuno scorrimento orizzontale (eccesso ${overflow} px)`);
  await p.screenshot({ path: `${OUT}layout-400.png`, fullPage: true });
  await ctx.close();
}

// --- database bloccato da una scheda con una versione vecchia: la pagina Layout funziona
{
  const ctx = await context();
  const old = await ctx.newPage();
  await old.route('**/old-tab', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><title>vecchia</title>' }));
  await old.goto(URL + 'old-tab');
  await old.evaluate(
    () =>
      new Promise<void>((ok, ko) => {
        const r = indexedDB.open('clavis-trainer', 1);
        r.onupgradeneeded = () => {
          r.result.createObjectStore('sessions', { keyPath: 'id' }).createIndex('startedAt', 'startedAt');
          r.result.createObjectStore('kv');
        };
        // come una build vecchia: non chiude la connessione quando un'altra scheda vuole aggiornare
        r.onsuccess = () => ok();
        r.onerror = () => ko(r.error);
      }),
  );
  const p = await open(ctx);
  await panel(p, 'NAV').waitFor();
  await p.waitForTimeout(500);
  check(!(await p.evaluate(() => document.body.textContent?.includes('Caricamento…'))), 'database bloccato: pagina Layout visibile');
  await p.getByTestId('ref-os-it').click();
  check((await labels(p, 'NUM', 0, 1))[0] === 'è', 'database bloccato: i selettori funzionano');
  await p.getByRole('navigation').getByRole('button', { name: 'Allenamento' }).click();
  await p.getByRole('alert').waitFor({ timeout: 6000 });
  check(true, "database bloccato: l'allenamento mostra l'avviso, come prima");
  await ctx.close();
}

await browser.close();
if (errors.length) console.log('errori della pagina:', errors);
console.log(failures || errors.length ? `${failures} controlli falliti` : 'tutti i controlli passati');
process.exit(failures || errors.length ? 1 : 0);
