# Design

## Contesto

Motivazioni in `proposal.md`, comportamento in `specs/`. Lo stato attuale del
codice che questa change tocca:

- `scripts/gen-keymap.ts` legge `custom_config.h` (ramo `zmk-timeless`) e
  scrive `src/core/keyboard/clavis.keymap.json` con `parseKeymap`, che estrae
  solo `MIRYOKU_LAYER_BASE`, `_NUM` e `_SYM`. `parseToken` riconosce `&kp`,
  `U_MT*` e `U_LT*`; tutto il resto (`U_RDO`, `&kp LC(X)`, `&u_bt_sel_0`,
  `U_MS_L`...) diventa `{ label: '' }`, e i keycode sconosciuti a `&kp`
  (`LEFT`, `C_VOL_UP`, `F7`) finiscono come etichetta in minuscolo.
- `LayerName = 'BASE' | 'NUM' | 'SYM'` serve sia ai dati sia al `Resolver`,
  che scorre `board.layers`. `clavisBoard` prende da `keymap.layers` solo
  quei tre: altri layer nel JSON non cambiano la risoluzione.
- `Keyboard.svelte` disegna l'SVG con le misure di `keyShape.ts` (`U`,
  `PAD`) e ricava le etichette da un `Resolver` (board + mappa del sistema).
  Ha già `fill`, `holds` e `marked`.
- Le mappe in `osmaps.ts` hanno quattro livelli (normale, Shift, AltGr,
  AltGr+Shift); `OS_MAPS.us` e `OS_MAPS.it` sono quelle che servono qui.
- Le viste sono `app.view` (`'train' | 'stats' | 'settings' | 'about'`),
  senza indirizzo. `App.svelte` mostra le viste solo con `app.ready`; prima
  mostra "Caricamento…" o l'avviso del database bloccato. `i18n.lang` vale
  `'it'` finché `app.init()` non legge le impostazioni.
- L'apertura automatica della guida è `shouldAutoOpen` in
  `src/core/guide.ts` (funzione pura), usata da `app.guideDue`.
- Nel firmware i nomi dei layer e le macro sono quelle di Miryoku
  (`firmware/zmk-timeless/miryoku/`): `U_NA`/`U_NU` = nessuna azione,
  `&u_to_U_X` = passa al layer X in modo fisso, `U_BOOT` = bootloader.

## Obiettivi / Non obiettivi

**Obiettivi:**
- Un solo punto che conosce i token del firmware (`parseKeymap`), che dà a
  ogni posizione un'azione con significato; la pagina non legge mai il testo
  del firmware.
- Etichette e categorie ricavate da funzioni pure, testabili con vitest; i
  componenti si limitano a tradurre e disegnare.
- Stessa griglia per schermo e stampa: la stampa cambia solo formato del
  foglio, palette e cosa si nasconde.

**Non obiettivi:**
- Un router generico: serve solo `#layout`.
- Rendere configurabili le macro di Miryoku dipendenti dalla piattaforma
  (`miryoku_clipboard.h`): si etichettano per significato, che non cambia.

## Decisioni

### 1. Dati: 8 layer, azioni con un identificativo di funzione

- Nuovo tipo `ClavisLayer` con gli 8 layer; `LayerName` resta il sottoinsieme
  dei layer di testo, così `Resolver`, `Chord` e statistiche non cambiano.
  `Keymap.layers` diventa `Record<ClavisLayer, KeyAction[]>`.
- `KeyAction` riceve `fn?: string`, un identificativo stabile della funzione
  per i tasti che non emettono testo: `nav.left`, `nav.home`, `clip.cut`,
  `media.volUp`, `bt.0`, `out.toggle`, `mouse.left`, `wheel.up`,
  `btn.1`, `fkey.7`, `sys.boot`, `to.SYM`, `caps.word`... `U_NA` e `U_NU`
  diventano `{ label: '', fn: 'none' }`.
- Le combinazioni con un significato noto si mappano alla funzione
  (`&kp LC(X)` → `clip.cut`, e le macro `U_UND/U_CUT/U_CPY/U_PST/U_RDO`
  idem). `&kp RA(SQT)` e `&kp RA(DQT)` vanno in un campo separato
  `altgr: { code, shift? }`, non in `code`: il `Resolver` legge solo `code`, e
  così questi tasti non entrano nella risoluzione dei caratteri. Il carattere
  viene dal livello AltGr della mappa del sistema; se il livello manca
  l'etichetta è `AltGr+'`.
- Un token non riconosciuto diventa `fn: 'unknown'` con il token come
  `label`; `gen-keymap` stampa un avviso e un test verifica che il
  `custom_config.h` versionato non ne abbia. Così un cambio del firmware non
  rompe la pagina e si vede subito cosa manca.
- Il JSON resta versionato e rigenerato a mano con `bun run gen:keymap`, come
  oggi.

*Alternativa scartata:* leggere `custom_config.h` nel browser al volo. Serve
la rete verso GitHub, e una modifica a metà del firmware romperebbe il sito.

### 2. Etichette e categorie: funzione pura

`src/core/keyboard/reference.ts` espone
`referenceKeys(layer, base, os)` che per ogni posizione restituisce
`{ category, char?, fn?, mod?, holdLayer? }`:

- `base` (`'colemakdh' | 'qwerty'`) decide solo il layer BASE, riusando la
  sostituzione già fatta da `clavisBoard` (`MIRYOKU_QWERTY`), che si estrae in
  una funzione comune.
- `char` è il carattere della mappa `os` (`OS_MAPS.us` o `OS_MAPS.it`),
  con le etichette speciali esistenti (`␣ ⏎ ⌫ ⇥`).
- Categoria: `char` → `char`; `holdMod` o `&kp LSHFT` → `mod`; `holdLayer` o
  `to.*` → `layer`; `nav.*`, `clip.*`, `caps.word` → `nav`; `media.*`, `bt.*`,
  `out.*`, `rgb.*`, `ep.*` → `media`; `mouse.*`, `wheel.*`, `btn.*` → `mouse`;
  `fkey.*` e i tasti come Stamp/Bloc Scorr/Pausa → `fkey`; `sys.*` → `sys`;
  `none` → `none`.
- Il tasto che attiva un layer si trova cercando nel layer BASE le posizioni
  con `holdLayer` uguale al layer (due per BUTTON).

L'etichetta visibile di una funzione è `t('ref.fn.<id>')`: una tabella
tipizzata in `src/ui/` associa ogni `fn` alla chiave del catalogo, così
`bun run check` segnala le chiavi mancanti nei due cataloghi. Le funzioni
`fkey.N`, `bt.N` e `btn.N` hanno l'etichetta composta (`F7`, `BT 2`,
`Clic 1`) e non una chiave per numero.

### 3. Disegno: componente nuovo sulle misure comuni

`LayerPanel.svelte` disegna un layer con `keyShape.ts` e la geometria di
`clavisBoard(...).keys`, con le classi di categoria e il tasto tenuto. Non si
estende `Keyboard.svelte`: quello è legato a un `Resolver` e alla mappa di
calore, e piegarlo a etichette e categorie esterne complicherebbe
l'allenamento per un caso solo. Le parti comuni (misure, raggi, font) restano
in `keyShape.ts` e nelle variabili CSS, così l'aspetto è lo stesso.

I colori di categoria sono variabili CSS (`--cat-char`, `--cat-mod`...) in
`App.svelte`, definite per il tema chiaro e ridefinite per lo scuro come le
`--finger-*` della guida. Sotto le lettere di BASE compare il modificatore
dell'home row mod e sotto i pollici il layer, come nel trainer.

### 4. Indirizzo `#layout` e caricamento

- `View` riceve `'layout'`. All'avvio `app` legge `location.hash`; un
  ascoltatore di `hashchange` tiene allineata la vista (indietro e avanti del
  browser, link). Scegliendo `Layout` si imposta `#layout`, scegliendo
  un'altra vista si toglie l'hash con `history.replaceState`, senza
  aggiungere voci alla cronologia.
- In `App.svelte` la vista Layout si mostra prima del controllo su
  `app.ready`: non dipende dal database. La pagina non legge
  `app.settings` finché `app.ready` è falso; quando diventa vero, preseleziona
  base e sistema dal profilo solo se l'utente non li ha già toccati.
- La lingua: se la pagina si apre prima di `app.ready`, `i18n.lang` parte da
  `detectLanguage()` invece che da `'it'`, poi `app.init()` la sovrascrive
  con quella salvata.
- `shouldAutoOpen` riceve il campo `view` e non apre la guida quando vale
  `'layout'`. Il resto delle condizioni non cambia, quindi passando
  all'allenamento la guida si apre come al primo avvio.
- Le scelte di base e sistema restano nello stato della pagina: non si
  salvano e non toccano il profilo.

### 5. Stampa

- Un `<style>` gestito dal componente contiene `@page { size: A4 landscape;
  margin: 8mm }` oppure `A3`, secondo il selettore. Il pulsante chiama
  `window.print()`. La scelta A4/A3 si ricorda in `localStorage` (preferenza
  locale, non un'impostazione sincronizzata).
- In `@media print`: si nascondono intestazione, navigazione, controlli e
  nota; la palette diventa quella chiara anche con il tema scuro; la griglia
  3 × 3 occupa la larghezza del foglio. Ogni tastiera ha proporzioni di circa
  2,3 : 1, quindi tre righe usano circa il 43% della larghezza in altezza e
  stanno nel 70% di un foglio orizzontale, con lo spazio per i titoli. Si
  impone `break-inside: avoid` sui pannelli.
- In cima al foglio: "clavis", base e sistema scelti, la fonte della keymap
  (`keymap.source`) e l'indirizzo del sito.
- A4 e A3 hanno le stesse proporzioni, quindi cambia solo `@page`: il
  contenuto in SVG scala da solo.

*Alternativa scartata:* PDF generato nel browser (jsPDF + svg2pdf),
decisione presa con l'utente: dipendenza da circa 300 kB, font da
incorporare e un secondo disegno da mantenere.

### 6. Test

- Vitest: `parseKeymap` su `custom_config.h` versionato in un fixture (8
  layer da 40 posizioni, nessun `unknown`, NAV con le frecce), `referenceKeys`
  (categorie, `[`/`è` con US/IT, BASE QWERTY, tasti che attivano NAV e
  BUTTON), `shouldAutoOpen` con `view: 'layout'`.
- E2e `tests/e2e/layout.ts`: link diretto senza guida, selettori, etichette
  in italiano e inglese, schermo stretto senza scorrimento orizzontale, e
  `page.pdf({ preferCSSPageSize: true })` in A4 e A3, con il tema scuro
  emulato, controllando che esca una sola pagina del formato giusto.

## Rischi / Compromessi

- [Le intestazioni e i margini del browser possono far uscire una seconda
  pagina] → margini contenuti nel `@page`, nota accanto al pulsante, ed e2e
  che controlla una pagina sola su Chromium.
- [Firefox e Safari applicano `@page size` in modo meno uniforme] → si
  verifica a mano in Firefox; se non rispetta il formato, la nota dice di
  sceglierlo nel dialogo.
- [Una nuova macro nel firmware non riconosciuta] → `fn: 'unknown'` con il
  token visibile, avviso di `gen-keymap` e test che fallisce prima del
  rilascio.
- [Le macro degli appunti dipendono dalla piattaforma scelta in Miryoku] →
  etichette per significato ("Copia"), valide qualunque sia la combinazione.
- [La vista Layout durante una sessione la interrompe, come le altre voci
  della navigazione] → comportamento invariato rispetto alle altre viste.

## Piano di rilascio

Rilascio normale (versione minore, tag, `task docker:publish`). Nessuna
migrazione: il JSON della keymap è nel bundle. Il link dal README di clavis
e la rimozione di `firmware/layout.pdf` si fanno nel repository di clavis
dopo il rilascio.

## Domande aperte

- Il firmware ha il "doppio tocco" su `U_BOOT` e `&u_to_*` solo con
  `MIRYOKU_KLUDGE_DOUBLETAPBOOT`; se è attivo nella build di clavis si può
  aggiungere un "2×" all'etichetta senza cambiare il resto.
