# Proposta: mappa di consultazione dei layer di clavis

## Perché

Per consultare tutti i layer di clavis oggi c'è solo `firmware/layout.pdf`
nel repository di clavis: un A3 disegnato a mano in LibreOffice nel gennaio
2025, che non corrisponde più al firmware (il layer MEDIA, per esempio, ha
oggi il tastierino numerico a sinistra) e che mostra i keycode, non i
caratteri che escono davvero con il sistema operativo in uso. clavis-trainer
disegna già la tastiera e sa tradurre i keycode in caratteri: una pagina
generata dal firmware non invecchia e si può linkare dal README di clavis.

## Cosa cambia

- **Pagina "Layout"** con indirizzo proprio (`/#layout`), raggiungibile dalla
  navigazione del trainer e da un link diretto. Funziona anche per chi non ha
  mai usato il trainer, senza aspettare il database del browser, e la guida
  al posizionamento delle dita non si apre da sola su questa pagina.
- **Tutti gli 8 layer del firmware** in pannelli con lo stesso disegno della
  tastiera del trainer: BASE, NAV, MOUSE, MEDIA, SYM, NUM, FUN, BUTTON. In
  ogni pannello il tasto da tenere per attivare il layer è evidenziato e
  nominato nel titolo; i pannelli sono raggruppati per riga: BASE e BUTTON
  con la legenda, i layer del pollice sinistro, quelli del pollice destro.
- **Selettori della base (Colemak-DH o QWERTY di Miryoku) e del sistema
  operativo (US o italiano)**, preselezionati dal profilo salvato se c'è,
  altrimenti Colemak-DH e US. I caratteri sui tasti sono quelli che produce il
  sistema scelto (`&kp LBKT` è `[` in US, `è` in italiano).
- **Tasti che non scrivono testo** (navigazione, appunti, media, Bluetooth,
  mouse, F1–F12, modificatori, tasti di layer, sistema) con etichette brevi
  per significato, nella lingua dell'interfaccia, e colori per categoria con
  legenda. Le combinazioni (`Ctrl+X`) si mostrano per significato
  ("Taglia").
- **PDF con la stampa del browser**: selettore A4/A3, pagina orizzontale,
  tutto su un foglio, colori del tema chiaro, senza navigazione né controlli;
  una nota ricorda di scegliere "Salva come PDF" e di togliere intestazioni e
  piè di pagina del browser.
- **Conversione del firmware estesa**: la keymap versionata comprende tutti
  gli 8 layer e le azioni senza testo; i layer usati dagli esercizi (BASE,
  NUM, SYM) e la risoluzione dei caratteri non cambiano.

Fuori ambito: pannelli per le basi alternative EXTRA e TAP di Miryoku (i
tasti che ci portano compaiono solo come etichetta); la tastiera classica
ANSI/ISO; un PDF scaricato con un clic generato nel browser; modifiche al
repository di clavis (link nel README e rimozione di `layout.pdf` si fanno
a parte).

## Capacità

### Nuove capacità

- `layout-reference`: la pagina di consultazione dei layer di clavis:
  indirizzo, selettori, pannelli, etichette e colori, legenda, stampa in
  A4/A3.

### Capacità modificate

- `keyboard-model`: la keymap ricavata dal firmware comprende tutti i layer
  di clavis, non solo BASE, NUM e SYM.

## Impatto

- `src/core/keyboard/`: `parseKeymap.ts` e `types.ts` (layer e azioni senza
  testo), `clavis.keymap.json` rigenerato con `bun run gen:keymap`; il
  resolver resta sui tre layer di testo.
- `src/ui/`: nuova vista e componenti della pagina, riuso del disegno di
  `Keyboard.svelte`, voce di navigazione e indirizzo `#layout` in `App.svelte`
  e `app.svelte.ts`, foglio di stile di stampa.
- `src/i18n/it.ts` e `en.ts`: etichette dei tasti, nomi dei layer, legenda,
  nota sulla stampa.
- Test unitari della conversione ed e2e della pagina (`tests/e2e/`).
- Nessuna dipendenza nuova, nessuna modifica al server, al database né alle
  impostazioni sincronizzate.
