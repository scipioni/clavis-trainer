// E2E di profili (tastiera × layout) e lingue.
// Uso: server avviato come per account.ts (porta 8099), poi
//   bun tests/e2e/profiles.ts http://localhost:8099/
import { dismissGuide } from './dismissGuide';
import { chromium, type Page } from 'playwright-core';
import { mkdirSync, readFileSync } from 'node:fs';

const URL = process.argv[2] ?? 'http://localhost:8099/';
const OUT = new globalThis.URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const EN_WORDS = new Set(
  (JSON.parse(readFileSync(new globalThis.URL('../../public/corpus/en/words.json', import.meta.url), 'utf8')).words as [string, number][]).map(([w]) => w),
);

let failures = 0;
function check(cond: boolean, msg: string) {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failures++;
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/usr/bin/chromium' });
const errors: string[] = [];
const ctx = await browser.newContext({ viewport: { width: 1200, height: 950 }, locale: 'en-US' });
const page = await ctx.newPage();
await dismissGuide(page);
page.setDefaultTimeout(8000);
page.on('pageerror', (e) => errors.push(e.message));

const nav = (p: Page, name: string) => p.locator('nav').getByRole('button', { name, exact: true }).click();

/** Sessione a testo libero "fino alla fine": digita il testo mostrato. */
async function freeSession(p: Page, text: string, labels: { train: string; free: string; untilEnd: string; prepare: string }) {
  await nav(p, labels.train);
  await p.getByRole('button', { name: labels.free }).click();
  await p.getByRole('button', { name: labels.untilEnd }).click();
  await p.locator('textarea.free').fill(text);
  await p.getByRole('button', { name: labels.prepare }).click();
  const shown = (await p.locator('.text').innerText()).replace('␣', ' ');
  for (const c of shown) {
    await p.keyboard.type(c);
    await p.waitForTimeout(30);
  }
  await p.locator('.results').waitFor();
}

// --- browser in inglese: interfaccia ed esercizi in inglese
await page.goto(URL);
await page.getByRole('button', { name: 'Prepare the session' }).waitFor();
check(await page.locator('nav').getByRole('button', { name: 'Practice' }).isVisible(), 'browser in English: interface in English');
await page.getByRole('button', { name: 'Adaptive' }).click();
await page.getByRole('button', { name: 'Prepare the session' }).click();
const text = (await page.locator('.text').innerText()).replace(/␣/g, ' ');
const words = text.split(' ').map((w) => w.replace(/^[("]+|[)".,;:?!]+$/g, '')).filter((w) => w && !/^\d+$/.test(w));
const english = words.filter((w) => EN_WORDS.has(w) || EN_WORDS.has(w.toLowerCase())).length / words.length;
check(english > 0.95, `adaptive exercise in English (${(english * 100).toFixed(0)}% corpus words)`);
await page.keyboard.press('Escape');
check(await page.getByText('Session abandoned').isVisible(), 'messages in English');

// --- cambio della lingua dell'interfaccia senza ricaricare
await nav(page, 'Settings');
await page.getByTestId('ui-lang').selectOption('it');
await page.locator('nav').getByRole('button', { name: 'Allenamento' }).waitFor();
check(true, "interfaccia passata all'italiano senza ricaricare");
await page.reload();
check(await page.locator('nav').getByRole('button', { name: 'Allenamento' }).isVisible(), 'dopo il ricaricamento resta in italiano');
await page.getByRole('combobox', { name: 'Lingua degli esercizi' }).first().selectOption('it');

const IT = { train: 'Allenamento', free: 'Testo libero', untilEnd: 'fino alla fine', prepare: 'Prepara la sessione' };

// --- tre tastiere con Italiano QWERTY: etichette dalla mappa italiana
await nav(page, 'Impostazioni');
await page.getByRole('combobox', { name: 'Layout' }).first().selectOption('it');
for (const kb of ['clavis', 'ansi', 'iso'] as const) {
  await nav(page, 'Impostazioni');
  await page.getByRole('combobox', { name: 'Tastiera' }).first().selectOption(kb);
  await nav(page, 'Statistiche');
  await page.locator('svg.kb').waitFor();
  const labels = await page.locator('svg.kb text.main').allTextContents();
  await page.locator('svg.kb').screenshot({ path: `${OUT}kb-${kb}-it.png` });
  if (kb === 'clavis') {
    check(labels.includes('ù') || labels.length > 0, 'clavis + italiano disegnata');
  } else {
    check(['ò', 'à', 'è', 'ù', 'ì'].every((c) => labels.includes(c)), `${kb}: tasti con le accentate italiane`);
    check(labels.includes('<') === (kb === 'iso'), `${kb}: tasto < ${kb === 'iso' ? 'presente (ISO)' : 'assente (ANSI)'}`);
    check(await page.getByRole('group', { name: 'Layer' }).count() === 0, `${kb}: niente selettore di layer nella mappa di calore`);
  }
}

// --- avviso dei caratteri non raggiungibili (iso + italiano, esercizi in italiano)
await nav(page, 'Impostazioni');
const warn = await page.getByTestId('unreachable').first().innerText();
check(warn.includes('È'), `avviso: ${warn}`);

// --- due profili, statistiche separate
await freeSession(page, 'perché @ àèìòù', IT);
await nav(page, 'Statistiche');
check((await page.getByTestId('sessions').locator('.v').innerText()) === '1', 'iso + italiano: 1 sessione');
check((await page.getByRole('button', { name: 'Transizioni di layer' }).count()) === 0, 'classifiche senza transizioni di layer sulla tastiera classica');
await page.screenshot({ path: `${OUT}stats-iso-it.png`, fullPage: true });

await nav(page, 'Impostazioni');
await page.getByRole('combobox', { name: 'Tastiera' }).first().selectOption('clavis');
await page.getByRole('combobox', { name: 'Layout' }).first().selectOption('colemakdh');
await nav(page, 'Statistiche');
check((await page.getByTestId('sessions').locator('.v').innerText()) === '0', 'clavis + Colemak-DH: 0 sessioni (le statistiche non si mescolano)');
await freeSession(page, 'ciao mondo', IT);
await freeSession(page, 'gli figli', IT);
await nav(page, 'Statistiche');
check((await page.getByTestId('sessions').locator('.v').innerText()) === '2', 'clavis + Colemak-DH: 2 sessioni');
check((await page.locator('figure').first().locator('circle').count()) === 2, 'grafico di clavis: 2 punti');
check(await page.getByRole('group', { name: 'Layer' }).isVisible(), 'clavis: selettore di layer presente');

await nav(page, 'Impostazioni');
await page.getByRole('combobox', { name: 'Tastiera' }).first().selectOption('iso');
await page.getByRole('combobox', { name: 'Layout' }).first().selectOption('it');
await nav(page, 'Statistiche');
check((await page.getByTestId('sessions').locator('.v').innerText()) === '1', 'di nuovo iso + italiano: sempre 1 sessione');
check((await page.locator('figure').first().locator('circle').count()) === 1, 'grafico di iso: 1 punto');

// --- tastiera guida della classica durante la sessione
await nav(page, 'Allenamento');
await page.getByRole('button', { name: 'Testo libero' }).click();
await page.locator('textarea.free').fill('@');
await page.getByRole('button', { name: 'Prepara la sessione' }).click();
const tapLabel = (await page.locator('svg.kb .key.tap text.main').textContent())?.trim();
const holdLabel = (await page.locator('svg.kb .key.hold text.main').textContent())?.trim();
check(tapLabel === 'ò' && holdLabel === 'AltGr', `guida per @: battere ${tapLabel}, tenere ${holdLabel}`);
await page.screenshot({ path: `${OUT}trainer-iso-it.png` });

check(errors.length === 0, `nessun errore JavaScript ${errors.join('; ')}`);
await browser.close();
console.log(failures ? `\n${failures} controlli falliti` : '\ntutto ok');
process.exit(failures ? 1 : 0);
