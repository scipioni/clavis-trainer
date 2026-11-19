# Task

## 1. Keymap con tutti i layer

- [x] 1.1 In `types.ts` aggiungere `ClavisLayer` (8 layer), portare `Keymap.layers` a `Record<ClavisLayer, KeyAction[]>` lasciando `LayerName` ai tre layer di testo, e aggiungere a `KeyAction` i campi `fn` e `altgr`; verifica: `bun run check` pulito e test esistenti di `keyboard.test.ts` verdi senza modifiche
- [x] 1.2 Estendere `parseKeymap`/`parseToken` a tutti gli 8 layer e alle azioni senza testo (design, decisione 1): navigazione, appunti (macro `U_*` e `&kp LC(X/C/V)`), media, Bluetooth e uscita, RGB e alimentazione esterna, mouse e rotella, clic, F1–F12 e Stamp/Bloc Scorr/Pausa/Menu, `&u_to_U_*`, `&u_caps_word`, `U_BOOT`, `U_NA`/`U_NU` → `none`, `RA(...)` → `altgr`, sconosciuti → `unknown`; verifica: unit test sulla fixture `tests/fixtures/custom_config.h` (8 layer da 40 posizioni, nessun `unknown`, NAV con `nav.left/down/up/right` sulla riga base destra, MEDIA con il tastierino a sinistra, NAV `LC(X)` → `clip.cut`) e un test con un token inventato che dà `unknown`
- [x] 1.3 `gen-keymap.ts`: avviso per ogni `unknown`; rigenerare `clavis.keymap.json` con `bun run gen:keymap tests/fixtures/custom_config.h`; verifica: il test che confronta il JSON versionato con la fixture passa, e lo scenario "Risoluzione invariata" (`7` sul layer NUM) è un unit test verde

## 2. Etichette e categorie

- [x] 2.1 Estrarre da `clavisBoard` la sostituzione della base QWERTY in una funzione comune e creare `src/core/keyboard/reference.ts` con `referenceKeys(layer, base, os)` e la ricerca dei tasti che attivano un layer (design, decisione 2); verifica: unit test su categorie di NAV, MEDIA, BASE, `[` con US e `è` con IT sul layer NUM, BASE QWERTY (`q w e r t y u i o p`) con gli altri layer invariati, tasti di attivazione di NAV (uno) e BUTTON (due: `z` e `/`), `RA(SQT)` con e senza livello AltGr nella mappa
- [x] 2.2 Tabella tipizzata `fn` → chiave del catalogo in `src/ui/` e testi in `it.ts` ed `en.ts` (funzioni, nomi dei layer, categorie della legenda, selettori, titolo dei pannelli "tieni …", nota sulla stampa); verifica: `bun run check` pulito e unit test che ogni `fn` del JSON versionato ha un'etichetta nei due cataloghi

## 3. Pagina Layout

- [x] 3.1 Variabili CSS `--cat-*` per le categorie nei due temi in `App.svelte` e componente `LayerPanel.svelte` (geometria di `clavisBoard`, `keyShape.ts`, classi di categoria, tasto tenuto evidenziato, sotto-etichette di home row mod e pollici); verifica: screenshot e2e dei pannelli BASE, NAV e MEDIA in tema chiaro e scuro, controllati a vista
- [x] 3.2 Componente `Layout.svelte`: selettori base e sistema, griglia 3 × 3 (BASE, BUTTON, legenda; NAV, MOUSE, MEDIA; SYM, NUM, FUN), una colonna sotto la larghezza di soglia, legenda; verifica: e2e degli scenari "Scelta della base e del sistema operativo", "Caratteri del sistema operativo", "Etichette dei tasti senza testo" (italiano e inglese), "Ordine dei pannelli" a 1280 e 400 px (nessuno scorrimento orizzontale)

## 4. Indirizzo, caricamento e guida

- [x] 4.1 `View` con `'layout'`, lettura di `location.hash` all'avvio, ascoltatore `hashchange`, hash impostato o tolto con `replaceState` al cambio di vista, voce "Layout" nella navigazione; verifica: e2e "Dalla navigazione", "Ritorno alle altre viste" e indietro del browser che torna alla vista precedente
- [x] 4.2 Vista Layout mostrata prima di `app.ready`, lingua iniziale da `detectLanguage()`, preselezione dal profilo all'arrivo di `app.ready` se i selettori non sono stati toccati; verifica: e2e "Link diretto da un nuovo visitatore", "Profilo italiano" (profilo impostato prima di aprire `#layout`), "La scelta non cambia il profilo" e "Database bloccato" (seconda scheda con una versione di IndexedDB più vecchia aperta, come negli e2e della 0.2.1)
- [x] 4.3 `shouldAutoOpen` con il campo `view`: niente apertura su `'layout'`; verifica: unit test in `guide.test.ts` ed e2e "Primo avvio sulla pagina Layout" e "Passaggio all'allenamento"

## 5. Stampa

- [x] 5.1 Selettore A4/A3 ricordato in `localStorage`, `<style>` con `@page` del formato scelto, pulsante che chiama `window.print()`, nota su "Salva come PDF" e intestazioni del browser; in `@media print` nascondere intestazione, navigazione, controlli e nota, forzare la palette chiara, intestazione del foglio con base, sistema, fonte della keymap e indirizzo del sito; verifica: e2e con `page.pdf({ preferCSSPageSize: true })` in A3 e in A4 con `emulateMedia({ colorScheme: 'dark' })`: una sola pagina orizzontale del formato giusto (dimensioni lette dal PDF) e testo dei pannelli presente
- [x] 5.2 Controllo a vista dei due PDF prodotti dall'e2e (leggibilità delle etichette in A4, colori in stampa); verifica: PDF in `tests/e2e/out/` guardati e, se serve, dimensioni dei caratteri ritoccate

## 6. Documentazione e integrazione

- [x] 6.1 README: sezione sulla pagina Layout con il link `https://clavis.mywire.org/#layout` e come stamparla; voce nella pagina Informazioni se elenca le sezioni; verifica: rilettura e link funzionante con `bun run preview`
- [x] 6.2 Verifica complessiva: `bun run test`, `bun test server`, `bun run check`, e2e `smoke.ts`, `profiles.ts`, `guide.ts` e `layout.ts` contro `bun run preview`, `openspec validate clavis-layout-reference --strict`; verifica: tutti verdi

## Workflow follow-up

- Prova a mano della stampa in Chromium e Firefox, in A4 e A3.
- Rilascio (versione minore in `package.json`, tag, `task docker:publish`), e2e `layout.ts` contro la produzione.
- Nel repository di clavis: link alla pagina nel README e rimozione di `firmware/layout.pdf` (e `layout.odt`), da concordare.
- Archiviare la change dopo il rilascio.
