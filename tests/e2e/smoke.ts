// Smoke test dell'interfaccia con Chromium di sistema.
// Uso: bun run build && bun run preview --port 4173 &  poi  bun tests/e2e/smoke.ts [url]
// Simula i tasti morti con eventi di composizione, come fa il browser con US International.
import { chromium, type Page } from 'playwright-core';
import { mkdirSync, readFileSync } from 'node:fs';
import { computeResult } from '../../src/core/session/result';

const URL = process.argv[2] ?? 'http://localhost:4173/';
const OUT = new globalThis.URL('./out/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/usr/bin/chromium' });
const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, locale: 'it-IT' });
page.setDefaultTimeout(8000);
const external: string[] = [];
page.on('request', (r) => {
  const u = new globalThis.URL(r.url());
  if (u.host !== new globalThis.URL(URL).host && u.protocol.startsWith('http')) external.push(r.url());
});
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(e.message));

let failures = 0;
function check(cond: boolean, msg: string) {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failures++;
}

/** Tasto morto seguito dalla composizione `out`, come un vero XKB con US Intl. */
async function deadCompose(p: Page, out: string) {
  await p.evaluate((out) => {
    const ta = document.querySelector<HTMLTextAreaElement>('textarea.sink')!;
    ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Dead', bubbles: true }));
    ta.dispatchEvent(new CompositionEvent('compositionstart', { data: '', bubbles: true }));
    ta.value = out;
    ta.dispatchEvent(new InputEvent('input', { data: out, isComposing: true, inputType: 'insertCompositionText', bubbles: true }));
    ta.dispatchEvent(new CompositionEvent('compositionend', { data: out, bubbles: true }));
  }, out);
}

async function typeText(p: Page, text: string) {
  for (const c of text) {
    if ('àèéìòù'.includes(c) || c === "'") await deadCompose(p, c);
    else await p.keyboard.type(c);
    await p.waitForTimeout(60);
  }
}

await page.goto(URL);
await page.getByRole('button', { name: 'Prepara la sessione' }).waitFor();
check(true, 'app avviata');

// --- sessione a testo libero con accenti, apostrofo, maiuscola, parentesi, cifra
await page.getByRole('button', { name: 'Testo libero' }).click();
await page.getByRole('button', { name: 'fino alla fine' }).click();
await page.locator('textarea.free').fill('Perché l’acqua (5) è fresca.  ');
await page.getByRole('button', { name: 'Prepara la sessione' }).click();
const shown = (await page.locator('.text').innerText()).replace('␣', ' ');
check(shown === "Perché l'acqua (5) è fresca.", `testo normalizzato: ${JSON.stringify(shown)}`);

// tastiera guida sul primo carattere (P maiuscola: Shift tenuto)
check((await page.locator('svg.kb .key.tap').count()) === 1, 'tastiera: un tasto da battere evidenziato');
check((await page.locator('svg.kb .key.hold').count()) === 1, 'tastiera: Shift da tenere per la P');
await page.screenshot({ path: `${OUT}trainer.png` });

await typeText(page, 'Perché l');
// apostrofo composto per sbaglio: ' + a → á
await deadCompose(page, 'á');
check((await page.locator('.text .cur.wrong').count()) === 1, "errore da tasto morto sull'apostrofo segnalato");
await page.waitForTimeout(60);
await typeText(page, "'acqua ");
// prima della parentesi: la guida mostra il layer SYM
const symShown = await page.locator('svg.kb').getAttribute('aria-label');
check(symShown?.includes('SYM') ?? false, `tastiera guida sul layer SYM per "(": ${symShown}`);
await page.screenshot({ path: `${OUT}trainer-sym.png` });
await typeText(page, '(5) è');
await page.waitForTimeout(400);
const live = await page.locator('.live .num').first().innerText();
check(parseInt(live) > 0, `WPM dal vivo durante la sessione: ${live}`);
// mod involontario: Ctrl+F (bloccabile) al posto di f
await page.keyboard.press('Control+f');
await page.waitForTimeout(60);
await typeText(page, ' fresca.');

await page.getByText('WPM', { exact: true }).first().waitFor();
const tile = async (label: string) =>
  (await page.locator('.tile', { has: page.getByText(label, { exact: true }) }).locator('.v').innerText()).trim();
check((await tile('errori')) === '1', `errori: ${await tile('errori')}`);
check((await tile('da tasti morti')) === '1', `errori da tasti morti: ${await tile('da tasti morti')}`);
check((await tile('mod involontari')) === '1', `mod involontari: ${await tile('mod involontari')}`);
check(Number(await tile('WPM')) > 0, `WPM: ${await tile('WPM')}`);
await page.screenshot({ path: `${OUT}results.png` });

// --- sessione adattiva da 30 s abbandonata con Esc: non salvata
await page.getByRole('button', { name: 'Adattivo' }).click();
await page.getByRole('button', { name: '30 s' }).click();
await page.getByRole('button', { name: 'Prepara la sessione' }).click();
const first = (await page.locator('.text span').first().innerText()).replace('␣', ' ');
await page.keyboard.type(first);
await page.keyboard.press('Escape');
check(await page.getByText('Sessione abbandonata').isVisible(), 'sessione abbandonata con Esc');

// --- persistenza e statistiche dopo il ricaricamento
await page.reload();
await page.getByRole('button', { name: 'Statistiche' }).click();
const sessions = await page.locator('.tile', { has: page.getByText('sessioni', { exact: true }) }).locator('.v').innerText();
check(sessions.trim() === '1', `dopo il ricaricamento: ${sessions.trim()} sessione salvata (l'abbandonata no)`);
check((await page.locator('svg.kb').count()) === 1, 'mappa di calore presente');
await page.screenshot({ path: `${OUT}stats.png`, fullPage: true });

// --- sessione adattiva da 30 s: il risultato a schermo coincide con quello ricalcolato dal nucleo
await page.getByRole('button', { name: 'Allenamento' }).click();
await page.getByRole('button', { name: 'Adattivo' }).click();
await page.getByRole('button', { name: '30 s' }).click();
await page.getByRole('button', { name: 'Prepara la sessione' }).click();
{
  const t0 = Date.now();
  while (Date.now() - t0 < 40_000 && (await page.locator('.text').count()) > 0) {
    const cur = await page.locator('.text .cur').innerText().catch(() => null);
    if (cur === null) break;
    const c = cur === '␣' ? ' ' : cur;
    if (/[àèéìòù']/.test(c)) await deadCompose(page, c);
    else await page.keyboard.type(c);
    await page.waitForTimeout(70);
  }
}
await page.locator('.results').waitFor();
const shownWpm = Number(await tile('WPM'));
const shownChars = await tile('caratteri');
await page.getByRole('button', { name: 'Impostazioni' }).click();
const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Esporta JSON' }).click()]);
const exported = JSON.parse(readFileSync(await download.path(), 'utf8'));
const timed = exported.sessions.find((x: { durationMs: number | null }) => x.durationMs === 30_000);
const recomputed = computeResult(timed.samples, timed.result.activeMs);
check(timed.result.activeMs === 30_000, `sessione da 30 s: tempo attivo ${timed.result.activeMs} ms`);
check(Math.round(recomputed.wpm) === shownWpm, `WPM a schermo ${shownWpm} = ricalcolato ${recomputed.wpm.toFixed(1)}`);
check(shownChars === String(recomputed.chars), `caratteri a schermo ${shownChars} = ricalcolati ${recomputed.chars}`);

// --- le impostazioni sopravvivono al ricaricamento
const deadBox = page.getByRole('checkbox', { name: /Tasti morti/ });
await deadBox.uncheck();
await page.waitForTimeout(300); // il salvataggio in IndexedDB è asincrono
await page.reload();
await page.getByRole('button', { name: 'Impostazioni' }).click();
check(!(await deadBox.isChecked()), 'impostazione "tasti morti" conservata dopo il ricaricamento');
await deadBox.check();

// --- importazione del file d'esempio: grafico, mappa e classifiche
await page.locator('input[type=file]').setInputFiles(new globalThis.URL('../fixtures/example-export.json', import.meta.url).pathname);
await page.getByRole('button', { name: 'Sostituisci i dati' }).click();
await page.getByText('Importate 20 sessioni.').waitFor();
await page.locator('input[type=file]').setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"format":"altro"}') });
check(await page.getByText(/File non valido/).isVisible(), 'file non valido rifiutato');
await page.getByRole('button', { name: 'Statistiche' }).click();
const total = await page.locator('.tile', { has: page.getByText('sessioni', { exact: true }) }).locator('.v').innerText();
check(total.trim() === '20', `sessioni importate: ${total.trim()}`);
check((await page.locator('figure').first().locator('circle').count()) === 20, 'grafico per sessione: 20 punti');
await page.getByRole('button', { name: 'per giorno' }).click();
check((await page.locator('figure').first().locator('circle').count()) === 10, 'grafico per giorno: 10 punti');
const topBigram = await page.locator('tbody tr').first().locator('code').innerText();
check(topBigram === 'gl', `bigramma più debole: ${topBigram}`);
const posL = await page.locator('svg.kb .key').filter({ has: page.locator('text.main', { hasText: /^l$/ }) }).first().locator('rect').getAttribute('style');
// l è il carattere più lento (per via di gl): deve avere il rosso pieno, hsl(0 70% 50%)
check(posL?.includes('217, 38, 38') ?? false, `mappa di calore: tasto l al massimo (${posL})`);
await page.screenshot({ path: `${OUT}stats-example.png`, fullPage: true });

// --- allenamento mirato dalla classifica
await page.locator('tbody tr').first().getByRole('button', { name: 'allena questo' }).click();
await page.locator('.text').waitFor();
check(await page.getByText('Allenamento mirato su').isVisible(), 'allenamento mirato avviato');
const focusText = (await page.locator('.text').innerText()).replace('␣', ' ');
const fw = focusText.split(' ');
const glShare = fw.filter((w) => w.includes('gl')).length / fw.length;
check(glShare > 0.6, `parole con "gl" nell'allenamento mirato: ${(glShare * 100).toFixed(0)}%`);
await page.screenshot({ path: `${OUT}focus.png` });

// --- informazioni con le fonti
await page.getByRole('button', { name: 'Informazioni' }).click();
check(await page.getByText('CC BY-SA 4.0').first().isVisible(), 'attribuzione del corpus visibile');

check(external.length === 0, `nessuna richiesta esterna (${external.length})`);
check(errors.length === 0, `nessun errore JavaScript ${errors.join('; ')}`);

await browser.close();
console.log(failures ? `\n${failures} controlli falliti` : '\ntutto ok');
process.exit(failures ? 1 : 0);
