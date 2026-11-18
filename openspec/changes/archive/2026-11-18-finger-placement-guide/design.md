# Design

## Contesto

Motivazioni in `proposal.md`, comportamento in `specs/`. Lo stato attuale del
codice che questa change tocca:

- `boardFor(profile)` (`src/core/keyboard/index.ts`) dà per ogni tasto
  posizione, misure, `hand` e `finger`. Per la classica la diteggiatura e
  l'angle mod di Colemak-DH stanno in `boards.ts`, per clavis in `geometry.ts`
  (con i pollici sulla riga 3). Il `Resolver` aggiunge la mappa del sistema
  operativo, cioè i caratteri da scrivere sui tasti.
- `Keyboard.svelte` disegna una tastiera SVG con `tap`, `holds`, `heat` e
  `titles`. Le misure (`U = 54`, `PAD = 6`) e il percorso dell'Invio ISO
  sono dentro il componente.
- Le impostazioni sono un oggetto nel `kv` di IndexedDB. `normalizeSettings`
  (`src/core/data.ts`) le valida e **scarta i campi sconosciuti**. Lo usano il
  server in `/api/sync` e l'importazione. Sincronizzazione: vince l'oggetto
  intero modificato più di recente.
- `app.init()` riconosce l'utente nuovo (`fresh`) ma oggi lo usa solo per le
  lingue. Le sessioni interrotte stanno in `app.interrupted`.
- La sessione in corso è uno stato locale di `Trainer.svelte`. Cambiare
  vista smonta il Trainer e scarta la sessione.
- L'unico dialogo esistente, `LoginDialog.svelte`, è un `div` con
  `role="dialog"` e `aria-modal`, senza librerie.

## Obiettivi / Non obiettivi

**Obiettivi:**
- Le due guide sono contenuti dichiarativi (passi → cosa evidenziare e quale
  testo), sopra un unico componente di disegno guidato da `boardFor`.
- Nessuna dipendenza nuova, nessun cambio di schema nel database del server
  o in IndexedDB.
- La logica di apertura (quale guida, se aprirla da sola) è in funzioni pure
  testabili con vitest.

**Non obiettivi:**
- Un sistema generico di tour o tutorial riusabile per altre parti dell'app.
- Animazioni con fisica o con librerie: bastano transizioni CSS e SVG.

## Decisioni

### 1. Il flag `guideSeen` nelle impostazioni

`Settings` riceve `guideSeen: GuideKind[]`, con `GuideKind = 'clavis' |
'classic'`. Il valore predefinito è `[]`. `normalizeSettings` accetta il
campo solo se è un array di valori conosciuti, senza duplicati, e altrimenti
lo riporta a `[]` invece di rifiutare tutte le impostazioni. Così un valore
rovinato riapre al massimo la guida, senza bloccare la sincronizzazione.

- Gli utenti attuali hanno impostazioni senza il campo, quindi
  `{...DEFAULT_SETTINGS, ...s}` dà `[]` e vedono la guida una volta, come
  previsto dalla specifica.
- Il campo segue il percorso delle altre impostazioni: si salva con
  `app.saveSettings`, che aggiorna `settingsUpdatedAt`, si sincronizza con
  l'ultima modifica che vince, e viaggia nell'esportazione e
  nell'importazione.
- Non serve una migrazione di IndexedDB: le impostazioni sono un oggetto
  libero nel `kv`.

Alternative scartate:
- *Un booleano unico*: non distingue le due guide, e la decisione è che il
  passaggio a una tastiera nuova riapre la guida giusta.
- *`localStorage` fuori dalle impostazioni*: non si sincronizza, e si è
  deciso di sincronizzare.

### 2. Funzioni pure per la scelta e l'apertura

In `src/core/guide.ts`:

- `guideKind(keyboard)`: `clavis` → `'clavis'`, `ansi`/`iso` →
  `'classic'`.
- `guideBoard(kind, profile)`: il profilo da disegnare. Per `'clavis'` è
  `{ keyboard: 'clavis', layout }`. Per `'classic'` è il formato del profilo
  se è già classico, altrimenti `iso` con il layout `it` e `ansi` con gli
  altri. Il layout è sempre quello del profilo.
- `shouldAutoOpen({ ready, interrupted, sessionActive, kind, seen })`: vera
  se l'app è pronta, non ci sono sessioni interrotte, non c'è una sessione in
  corso e `kind` non è in `seen`.

`app.svelte.ts` aggiunge `guideOpen: GuideKind | null` e `sessionActive`.
`sessionActive` lo imposta il Trainer quando una sessione parte e quando
finisce o viene scartata. Un `$effect` in `App.svelte` valuta
`shouldAutoOpen` e reagisce da solo a fine caricamento, alla risoluzione
delle sessioni interrotte, alla fine di una sessione, al cambio di profilo e
alle impostazioni arrivate dalla sincronizzazione.

Chiudere la guida, in qualunque passo, aggiunge a `guideSeen` tutte le
versioni mostrate in quell'apertura. Se dal primo passo si passa all'altra
guida e si chiude, risultano viste tutte e due, come dice lo scenario
"Entrambe viste".

### 3. Contenuti dei passi come dati

Ogni guida è un array di passi:

```
{ id, title, body,              // chiavi del catalogo i18n
  layer?: 'BASE'|'NUM'|'SYM',   // layer disegnato (passo "tenere premuto" di clavis)
  pads?: 'home' | 'thumbs' | 'none',   // dove stanno i polpastrelli
  zones?: 'all' | 'cycle' | 'none',    // colori per dito; 'cycle' = un dito alla volta
  highlight?: (k: BoardKey) => boolean // tasti in evidenza (tacche, pollici, Shift…)
  demo?: 'shift' | 'layers' }          // piccola sequenza animata
```

- La posizione base si ricava dal board: per ogni mano e dito non pollice,
  tra i tasti della riga centrale con quel dito che non stanno nella colonna
  interna (`!inner`), quello più vicino al centro della tastiera. Sulla
  classica questo esclude Bloc Maiusc, `'` e Invio per i mignoli. Su clavis
  è la riga 1, sulla classica la riga 2.
- I pollici di clavis sono i tasti `finger === 'thumb'` presenti. Sulla
  classica è lo spazio.
- Le tacche della classica sono i tasti `KeyF` e `KeyJ`, i keycode fisici
  della posizione base degli indici, uguali con tutti i layout.
- Il `demo: 'layers'` di clavis alterna BASE → NUM → SYM tenendo evidenziato
  il pollice che attiva il layer. Il `demo: 'shift'` della classica mostra un
  polpastrello che si stacca dal mignolo destro verso lo Shift destro mentre
  l'indice sinistro batte un tasto.

Così il comportamento di ogni passo è nei dati, e le funzioni che
ricavano posizione base, pollici e zone si testano su tutti i 9 profili.

### 4. Disegno: estendere `Keyboard.svelte` con uno strato di sovrapposizione

Le misure dei tasti e la forma dell'Invio ISO si estraggono da
`Keyboard.svelte` in un piccolo modulo comune, per esempio
`keyGeometry(k) → { x, y, w, h, path? }`. `Keyboard.svelte` riceve due prop
facoltative:
- `fill?: (string | null)[]` per posizione, che generalizza `heat` e serve
  per i colori delle zone;
- uno `snippet` di sovrapposizione disegnato dentro lo stesso `<svg>`, dopo
  i tasti, nelle stesse coordinate.

`GuideKeyboard.svelte` usa queste prop per disegnare polpastrelli, frecce e
tacche. Senza le prop nuove il comportamento attuale resta identico.

Alternativa scartata: *un secondo componente SVG che duplica il disegno*.
Le due tastiere si discosterebbero, per esempio sull'Invio ISO o sulle
etichette di clavis.

### 5. Polpastrelli, colori e animazioni

- Otto colori fissi per le dita (mignolo, anulare, medio, indice, uguali
  nelle due mani, con la mano distinta dalla posizione) più il pollice,
  definiti come variabili CSS (`--finger-pinky`…) nei due temi, chiaro e
  scuro, con un contrasto sufficiente per la sigla.
- Le sigle sono nel catalogo i18n: `Mi An Me In Po` in italiano, `P R M I T`
  in inglese.
- Le zone dei tasti usano lo stesso colore in trasparenza (circa 35%), così
  le lettere restano leggibili.
- Animazioni:
  - i polpastrelli entrano con `transform: translate` dall'alto verso il tasto
    (CSS `transition`, dita sfasate di circa 60 ms);
  - il dito attivo pulsa con una `@keyframes` sul raggio o sull'opacità;
  - il passo cambia con `fade` e `fly` di `svelte/transition`;
  - le demo sono timeline fatte con `setTimeout` a ciclo, fermate quando si
    cambia passo.
- Movimento ridotto: si legge `matchMedia('(prefers-reduced-motion:
  reduce)')`. Se è attivo, la durata delle transizioni di Svelte è 0, una
  regola CSS globale sotto la media query annulla transizioni e `@keyframes`
  della guida, e le demo mostrano un solo fotogramma statico (lo stato
  finale).

### 6. Dialogo e tastiera

`Guide.svelte` riprende lo schema di `LoginDialog`: un velo e un `div`
con `role="dialog"`, `aria-modal` e `aria-labelledby` sul titolo del passo.

- All'apertura il focus va sul pulsante "Avanti", alla chiusura torna
  all'elemento che l'aveva prima.
- `keydown` è ascoltato sul dialogo. Frecce, Invio ed Esc chiamano
  `preventDefault` e `stopPropagation`. Tab resta dentro il dialogo (trappola
  del focus con il primo e l'ultimo elemento).
- La textarea dell'allenamento perde il focus, quindi nessun tasto arriva
  alla sessione. In più l'apertura automatica avviene solo senza una sessione
  in corso.
- Si riusa `focusOnShow` (ignora Invio e Spazio per 0,8 s) sul pulsante
  "Avanti" all'apertura automatica. Così un Invio battuto un attimo prima non
  salta il primo passo.

### 7. Voce "Guida" nella navigazione

`App.svelte` aggiunge una voce "Guida" dopo "Informazioni". Non è una
`View`: apre il dialogo con `guideKind(app.settings.keyboard)` e lascia la
vista corrente. Quando `app.sessionActive` è vero, la voce è disabilitata,
perché aprire la guida a metà sessione ne falserebbe i tempi.

### 8. Test e2e

Al primo avvio la guida si apre e copre l'app, e gli e2e esistenti partono
da un browser vuoto. Si aggiunge in `tests/e2e/` un aiuto `closeGuide(page)`
da chiamare dopo il caricamento in `smoke.ts`, `profiles.ts` e `account.ts`.
Un nuovo `guide.ts` verifica: apertura al primo avvio, navigazione con le
frecce, chiusura con Esc e nessuna riapertura dopo il ricaricamento,
riapertura dalla navigazione, apertura della guida classica al cambio di
tastiera, movimento ridotto (`page.emulateMedia({ reducedMotion: 'reduce' })`).

## Rischi / Compromessi

- [La sincronizzazione sostituisce l'oggetto intero, quindi una modifica più
  recente fatta su un dispositivo che non sapeva della guida vista altrove
  riporta indietro `guideSeen`.] → La guida si riapre una volta di troppo,
  senza perdita di dati. Accettato: unire i campi uno per uno cambierebbe
  tutta la sincronizzazione delle impostazioni.
- [Un dispositivo nuovo non sa che la guida è già stata vista finché l'utente
  non accede.] → La guida si apre prima dell'accesso. Accettato: è il
  comportamento di un utente nuovo, e dopo l'accesso le impostazioni arrivano
  dall'account.
- [Schede aperte con la versione vecchia del client salvano le impostazioni
  senza conoscere `guideSeen`.] → La versione vecchia legge le impostazioni
  con lo spread e le riscrive intere, quindi il campo sopravvive nel `kv`. Il
  server vecchio non esiste, perché server e client sono nello stesso
  container.
- [Le zone colorate e le sigle su tasti piccoli (clavis a 0,9 U, schermi
  stretti) si leggono male.] → Raggio dei polpastrelli legato a `U`, sigla
  di 1–2 caratteri, e verifica visiva con screenshot e2e a 400 px e a
  1280 px.
- [Gli e2e esistenti si rompono se la guida copre l'app.] → Sono aggiornati
  nella stessa change (decisione 8).

## Piano di migrazione

Non serve una migrazione dei dati. Il rilascio segue la procedura solita
(versione in `package.json`, tag, immagine). In caso di rollback il client
vecchio ignora `guideSeen`, e il server vecchio lo scarta dalla prossima
sincronizzazione. Al ritorno alla versione nuova la guida si riaprirebbe una
volta, senza altri effetti.
