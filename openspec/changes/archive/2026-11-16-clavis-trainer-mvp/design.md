# Design

## Contesto

Progetto nuovo e vuoto. Motivazioni e ambito sono in `proposal.md`, il
comportamento richiesto è in `specs/`. I vincoli che determinano le scelte:

- La tastiera fa il lavoro di layout: clavis invia keycode US già in
  Colemak-DH, il sistema è in US International con tasti morti. Il browser vede
  solo il risultato (`KeyboardEvent.key`, eventi `input`), non i layer né gli
  home row mods. Tutto quello che riguarda dita e layer si ricava dal
  carattere atteso tramite il modello della tastiera, non dall'evento.
- La keymap vera sta in `scipioni/clavis`,
  `firmware/zmk-timeless/config/custom_config.h`, macro
  `MIRYOKU_LAYER_BASE/NUM/SYM` con 40 posizioni per layer (le 4 `U_NP` sono
  posizioni assenti).
- Uso personale, locale, senza server.

## Obiettivi / Non obiettivi

**Obiettivi:**
- Nucleo (modello della tastiera, analisi, generazione) in TypeScript puro,
  senza DOM, testabile con unit test.
- Interfaccia sottile sopra il nucleo.
- Si avvia con un comando e si usa anche come build statica aperta in locale.

**Non obiettivi:**
- Rilevare quale tasto fisico è stato premuto: con i layer gestiti dal
  firmware non è possibile, e non serve.
- Modellare il tempo di hold/tap del firmware: si osservano solo gli effetti
  (mod involontari, lentezza).
- PWA installabile, sincronizzazione, multiutente.

## Decisioni

### 1. Stack: Vite + Svelte 5 + TypeScript, bun come runner, Vitest

Svelte produce un bundle piccolo e un'interfaccia reattiva con poco codice,
ed è già usato in `led-grabber`. bun è installato e veloce sia per installare
che per gli script di preparazione dati. Vitest condivide la configurazione di
Vite.
Alternative: React (più codice di contorno per un'app così piccola); vanilla
TS (si finisce a riscrivere la reattività).

### 2. Modello della tastiera generato dal firmware

Uno script `scripts/gen-keymap.ts` legge `custom_config.h` (scaricato da
GitHub o da un percorso locale), estrae le tre macro, divide in 40 token e
mappa ogni token in `{ output, shiftOutput }` usando una tabella dei keycode ZMK
(`&kp N7` → `7`/`&`, `U_MTL(LSHFT, T)` → tasto `t` con hold Shift,
`U_LTR(U_SYM, RET)` → tasto di layer SYM). Il risultato è
`src/core/keyboard/clavis.keymap.json`, versionato. Geometria e dita sono
fisse nel codice (colonna → dito), perché non stanno nella keymap.

Il risolutore (`resolve(char, options) → Chord[]`) costruisce in avvio un
indice carattere → alternative e sceglie quella con meno pressioni (a parità
BASE). Regole:
- Shift sul layer BASE: home row mod Shift della mano opposta.
- Shift su un layer: lo Shift che quel layer offre (sul NUM/SYM è sulla mano
  destra, posizione di `n`).
- Tasti morti (`'` `"` `` ` `` `~` `^`): carattere letterale = accordo +
  spazio; lettere accentate = tasto morto + lettera, con una tabella fissa
  delle composizioni US Intl usate in italiano (`è à ì ò ù é` più maiuscole).

Alternativa scartata: keymap scritta a mano. È più veloce all'inizio, ma va a
pezzi alla prima modifica del firmware.

### 3. Cattura dell'input: textarea nascosta con focus + `keydown` e `input`

Una `<textarea>` invisibile tiene il focus. Si usa:
- `keydown` per i tempi (`event.timeStamp`, alta risoluzione), per
  riconoscere `Dead`, per vedere i mod (`ctrlKey`, `altKey`, `metaKey`) e
  bloccare con `preventDefault` le scorciatoie dove il browser lo permette.
- `input` (con `data`) per il carattere effettivamente prodotto, che con i
  tasti morti arriva composto. Il tempo del carattere è quello dell'evento che
  completa la composizione.

Dopo ogni evento il campo si svuota. Questo regge sia i tasti morti di XKB sia
eventuali IME, a differenza del solo `keydown.key`, che su alcuni browser
Linux non segnala la composizione in modo coerente.

Ctrl+W, Ctrl+T e Ctrl+N non si possono bloccare in Chrome: si mitiga con
`beforeunload` attivo solo durante la sessione e con il salvataggio
incrementale della sessione in corso (decisione 5).

### 4. Analisi: medie mobili esponenziali per unità e punteggio relativo

Per ogni unità: `n`, `emaMs` (α = 0,1), `emaErr` (tasso di errore come EMA
di 0/1), `modMisfires`. Il punteggio è
`score = (emaMs / mediana_tipo) · (1 + 10 · emaErr) + 0,5 · misfireRate`, con
la mediana per tipo di unità (caratteri, bigrammi, …) così che i bigrammi non
vengano confrontati con i singoli caratteri. Unità con `n < 5` escluse dalle
classifiche e marcate "poco esplorate". I pesi sono costanti in un solo modulo,
così si tarano dopo l'uso reale.

Alternativa: finestra fissa delle ultime N occorrenze. È più precisa ma
richiede di conservare tutti i campioni per unità; l'EMA ha stato costante.

### 5. Persistenza: IndexedDB tramite `idb`

Due store: `sessions` (una riga per sessione con i campioni grezzi) e
`unitStats` (stato aggregato). Le statistiche aggregate si possono ricalcolare
da zero rigiocando le sessioni: questo serve per l'importazione e per cambiare
i pesi in futuro. La sessione in corso si scrive ogni 5 secondi con stato
`in-progress`; all'avvio una sessione rimasta così si offre di scartarla o di
chiuderla come completata.

Esportazione: JSON `{ format: "clavis-trainer", version: 1, sessions, settings }`;
le statistiche non si esportano, si ricalcolano.

Alternativa: `localStorage`. È più semplice, ma ha un limite di circa 5 MB e
serializza tutto in un'unica stringa; con i campioni grezzi si satura in poche
settimane.

### 6. Corpus: preparato offline, versionato

`scripts/build-corpus.ts` scarica una volta:
- `it_50k.txt` da FrequencyWords (hermitdave, CC BY-SA 4.0, dai sottotitoli
  di OpenSubtitles), filtrato su parole tutte minuscole, solo caratteri
  risolvibili, lunghezza 2–14, tenendo le prime circa 10.000;
- frasi italiane di Tatoeba (CC BY 2.0 FR), filtrate per lunghezza 20–120
  caratteri e caratteri risolvibili, normalizzate come il testo libero,
  campionate a circa 5.000.

Output `public/corpus/words.json` e `sentences.json` (stima: meno di 1 MB in
tutto), più `ATTRIBUTION.md`. I dati grezzi scaricati vanno in una cartella
ignorata da git.

### 7. Generazione adattiva

Indice inverso unità → parole costruito in avvio. Per ogni parola: con
probabilità 0,7 si estrae un'unità debole e una parola che la contiene, pesata
per radice della frequenza; altrimenti si estrae una parola per radice della
frequenza (la frequenza pura darebbe solo "e non che di").

Il peso di un punto debole è l'eccesso del punteggio sulla media
(`score − 1`, minimo 0,05), tra le prime 12 unità: con il punteggio pieno le
unità nella media (≈ 1) diluiscono quella davvero debole. Le unità poco
esplorate ricevono insieme il 20% del peso totale, diviso tra loro, perché con
dati reali sono centinaia. Per le transizioni verso il NUM, con le cifre
attive, metà delle volte si inserisce un numero e metà si sceglie una parola
con accenti.
Maiuscole, punteggiatura (`, . ; : ? ! ( ) ' "`) e cifre si inseriscono dopo,
con le proporzioni scelte dall'utente, e si orientano verso i caratteri e le
transizioni deboli di quei tipi. L'allenamento mirato su un'unità forza la
probabilità a 0,9 su quell'unità.

### 8. Struttura

```
src/core/keyboard/   modello, keymap.json generato, risolutore
src/core/session/    macchina a stati della sessione (pura, eventi → campioni)
src/core/analysis/   unità, EMA, punteggio
src/core/exercise/   corpus, generatore, normalizzazione testo libero
src/storage/         IndexedDB, export/import
src/ui/              componenti Svelte (Trainer, Keyboard, Results, Stats)
scripts/             gen-keymap, build-corpus
```

La macchina a stati della sessione riceve eventi astratti
(`{ type: 'char'|'dead'|'mod', data, t }`), così i test simulano la
digitazione senza browser.

### 9. Grafici: SVG scritto a mano

Servono un grafico a linee (WPM/precisione) e la mappa di calore sulla
tastiera, che è un SVG comunque. Una libreria di grafici non vale la
dipendenza.

## Rischi / Compromessi

- [Le composizioni dei tasti morti dipendono dalla variante XKB e dal
  sistema] → tabella delle composizioni in un solo file e opzione per
  disattivare i tasti morti; verifica manuale su questa macchina in un task.
- [Un roll veloce con HRM può far partire scorciatoie del browser non
  bloccabili, come Ctrl+W] → `beforeunload` durante la sessione e salvataggio
  incrementale; le attivazioni registrate segnalano all'utente dove i roll
  sono imprecisi.
- [Il corpus da sottotitoli contiene parlato, nomi propri e qualche
  volgarità] → filtro sulle minuscole e una lista di esclusione modificabile.
- [La licenza CC BY-SA del corpus di parole si estende al file derivato] →
  attribuzione e licenza in `ATTRIBUTION.md` e nella pagina informazioni; il
  codice resta sotto una licenza a scelta dell'utente.
- [I pesi del punteggio sono arbitrari] → costanti in un modulo e statistiche
  ricalcolabili rigiocando le sessioni.
- [`event.timeStamp` è ridotto a 0,1 ms o peggio con le protezioni anti
  fingerprinting] → resta molto sotto i tempi da misurare (decine di ms).

## Piano di avvio

`bun install && bun run dev` per lo sviluppo; `bun run build` produce `dist/`
statico, servibile con `bun run preview` o un qualsiasi server statico. Non
c'è migrazione: la versione del formato di esportazione e lo schema
IndexedDB partono da 1.

## Domande aperte

- Licenza del codice del progetto: si decide prima della pubblicazione, non
  cambia l'implementazione.
- Pesi del punteggio e α dell'EMA: si tarano dopo qualche settimana di uso.
