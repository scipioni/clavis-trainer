// E2E dell'accesso Telegram e della sincronizzazione, con il bot finto.
// Uso:
//   bun run build
//   TELEGRAM_FAKE=1 COOKIE_SECURE=0 PORT=8099 PUBLIC_URL=http://localhost:8099 DATA_DIR=$(mktemp -d) bun server/main.ts &
//   bun tests/e2e/account.ts http://localhost:8099/
// Ogni contesto del browser è un dispositivo diverso.
import { chromium, type Browser, type Page } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const URL = process.argv[2] ?? 'http://localhost:8099/';
const OUT = new globalThis.URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

let failures = 0;
function check(cond: boolean, msg: string) {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failures++;
}

const browser: Browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/usr/bin/chromium' });
const errors: string[] = [];

async function device(name: string): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, locale: 'it-IT' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  await page.goto(URL);
  await page.getByRole('button', { name: 'Prepara la sessione' }).waitFor();
  return page;
}

/** Il bot finto: l'utente Telegram apre il link e preme Conferma (ok) o Annulla (no). */
async function telegram(page: Page, action: 'ok' | 'no', user = { id: 4242, first_name: 'Prova' }) {
  const href = await page.getByRole('link', { name: 'Apri Telegram' }).getAttribute('href');
  const id = new globalThis.URL(href!).searchParams.get('start');
  const res = await fetch(new globalThis.URL('api/test/telegram', URL), {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-clavis': '1' },
    body: JSON.stringify({ id, action, user }),
  });
  if (!res.ok) throw new Error(`bot finto: ${res.status}`);
}

async function login(page: Page, action: 'ok' | 'no' = 'ok') {
  await page.getByRole('button', { name: 'Accedi con Telegram' }).first().click();
  await page.locator('.code').waitFor();
  await telegram(page, action);
}

/** Una sessione a testo libero, fino alla fine del testo. */
async function typeSession(page: Page, text: string) {
  await page.getByRole('button', { name: 'Allenamento' }).click();
  await page.getByRole('button', { name: 'Testo libero' }).click();
  await page.getByRole('button', { name: 'fino alla fine' }).click();
  await page.locator('textarea.free').fill(text);
  await page.getByRole('button', { name: 'Prepara la sessione' }).click();
  for (const c of text) {
    await page.keyboard.type(c);
    await page.waitForTimeout(40);
  }
  await page.locator('.results').waitFor();
  await page.getByRole('button', { name: 'Nuova sessione' }).waitFor();
}

async function sessionsShown(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Statistiche' }).click();
  return (await page.locator('.tile', { has: page.getByText('sessioni', { exact: true }) }).locator('.v').innerText()).trim();
}

/** Simula il ritorno in primo piano della scheda (in headless resta sempre "visible"). */
async function refocus(page: Page) {
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForFunction(() => !document.querySelector('.badge')?.textContent?.includes('sincronizzazione'));
  await page.waitForTimeout(300);
}

// --- dispositivo A: accesso e prima sessione
const a = await device('A');
check(await page_has(a, 'Accedi con Telegram'), 'A: pulsante di accesso visibile');
await login(a);
await a.locator('.badge .name', { hasText: 'Prova' }).waitFor();
check(true, 'A: connesso dopo la conferma nel bot');
await typeSession(a, 'ciao mondo');
await a.locator('.badge .status', { hasText: 'sincronizzato' }).waitFor();
check(!(await a.locator('.badge .status').innerText()).includes('da inviare'), 'A: sessione inviata, niente in attesa');
await a.screenshot({ path: `${OUT}account-a.png` });

// --- dispositivo B: stesso account, riceve lo storico
const b = await device('B');
await login(b);
await b.locator('.badge .name', { hasText: 'Prova' }).waitFor();
await b.locator('.badge .status', { hasText: 'sincronizzato' }).waitFor();
check((await sessionsShown(b)) === '1', 'B: riceve la sessione fatta su A');

// --- B fa una sessione, A la riceve tornando in primo piano
await typeSession(b, 'perché sì');
await b.locator('.badge .status', { hasText: 'sincronizzato' }).waitFor();
await refocus(a);
check((await sessionsShown(a)) === '2', 'A: riceve la sessione di B al ritorno in primo piano');

// --- impostazioni: A spegne la tastiera, B lo vede
await a.getByRole('button', { name: 'Impostazioni' }).click();
await a.getByRole('checkbox', { name: /Mostra la tastiera/ }).uncheck();
await a.waitForTimeout(2600); // le modifiche alle impostazioni si inviano dopo 2 s
await refocus(b);
await b.getByRole('button', { name: 'Impostazioni' }).click();
check(!(await b.getByRole('checkbox', { name: /Mostra la tastiera/ }).isChecked()), 'B: impostazione cambiata su A applicata');
await b.screenshot({ path: `${OUT}account-settings.png`, fullPage: true });

// --- dispositivo C anonimo: una sessione, poi accesso → confluisce nell'account
const c = await device('C');
await typeSession(c, 'anonima');
await login(c, 'no');
await c.getByText("Hai annullato l'accesso").waitFor();
check(true, 'C: rifiuto nel bot mostrato, nessun accesso');
check((await c.locator('.badge').count()) === 0, 'C: ancora anonimo dopo il rifiuto');
await c.getByRole('button', { name: 'Chiudi' }).click();
await login(c, 'ok');
await c.locator('.badge .status', { hasText: 'sincronizzato' }).waitFor();
check((await sessionsShown(c)) === '3', 'C: storico anonimo unito all\'account (1 + 2 = 3)');
await refocus(a);
check((await sessionsShown(a)) === '3', 'A: riceve anche la sessione anonima di C');

// --- uscita da A: dati tolti dal browser, restano nell'account
await a.getByRole('button', { name: 'Impostazioni' }).click();
await a.getByRole('button', { name: 'Esci…' }).click();
await a.getByRole('button', { name: 'Esci', exact: true }).click();
await a.getByText('Sei uscito').waitFor();
check((await sessionsShown(a)) === '0', 'A: dopo l\'uscita il browser non mostra più lo storico');
check(await page_has(a, 'Accedi con Telegram'), 'A: di nuovo il pulsante di accesso');
await login(a);
await a.locator('.badge .status', { hasText: 'sincronizzato' }).waitFor();
check((await sessionsShown(a)) === '3', 'A: rientrando lo storico ricompare');

check(errors.length === 0, `nessun errore JavaScript ${errors.join('; ')}`);
await browser.close();
console.log(failures ? `\n${failures} controlli falliti` : '\ntutto ok');
process.exit(failures ? 1 : 0);

async function page_has(page: Page, text: string) {
  return page.getByRole('button', { name: text }).first().isVisible();
}
