# Proposta: tastiere, layout e lingua inglese

## Perché

clavis-trainer oggi vale per una sola configurazione: clavis con Miryoku
Colemak-DH, sistema in US International, testo e interfaccia in italiano. Chi
scrive su una tastiera classica, in QWERTY o in inglese non può usarlo, e
lo stesso utente non può allenarsi sul portatile (tastiera classica) e su
clavis tenendo le statistiche separate. Il motore (risoluzione dei caratteri,
punti deboli, generazione) non dipende dalla tastiera: basta descrivere altre
tastiere e altri layout.

## Cosa cambia

- **Profilo di digitazione** scelto dall'utente: tastiera × layout, in modo
  indipendente.
  - Tastiere: clavis (36 tasti, Miryoku) e tastiera classica in formato ANSI o
    ISO, con la diteggiatura standard delle dieci dita.
  - Layout: Colemak-DH, US QWERTY (con o senza tasti morti US International),
    Italiano QWERTY (accentate sui tasti dedicati, AltGr per `@ # [ ]`).
  - Su clavis il layout cambia la base di Miryoku (Colemak-DH o QWERTY) e la
    mappa del sistema operativo (US o italiana); sulla tastiera classica è la
    mappa del sistema operativo.
- **Risoluzione dei caratteri per keycode**: la keymap descrive i tasti fisici
  e i keycode; la mappa del sistema operativo trasforma i keycode in caratteri.
  Così la stessa keymap di clavis vale con il sistema in US o in italiano.
- **Maiuscole e modificatori per tastiera**: su clavis Shift viene dall'home row
  mod della mano opposta (come oggi); sulla tastiera classica dallo Shift
  della mano opposta (mignolo), e AltGr dal pollice destro.
- **Tastiera a schermo e mappa di calore** disegnano la tastiera del profilo.
- **Statistiche e storico per profilo**: punti deboli, mappa di calore e grafici
  si riferiscono al profilo attivo; le sessioni registrano tastiera, layout e
  lingua.
- **Lingua inglese**:
  - interfaccia in italiano o inglese (dalla lingua del browser, modificabile);
  - lingua degli esercizi indipendente dall'interfaccia, con un corpus inglese
    di parole e frasi (FrequencyWords `en_50k`, Tatoeba `eng`);
  - il bot Telegram risponde in inglese a chi non ha Telegram in italiano.
- **Compatibilità**: sessioni, impostazioni ed esportazioni esistenti valgono
  come profilo clavis + Colemak-DH + italiano; la sincronizzazione accetta
  sessioni con e senza profilo.

Fuori ambito: macOS (mappa italiana diversa da Linux/Windows), altri layout
(Dvorak, Workman, AZERTY…), tastiere split diverse da clavis, keymap clavis
personalizzate oltre a quella del firmware, altre lingue oltre a italiano e
inglese, statistiche aggregate tra profili diversi.

## Capacità

### Nuove capacità

- `ui-language`: lingua dell'interfaccia (italiano/inglese), scelta iniziale
  dal browser, cambio manuale, persistenza e sincronizzazione con l'account.

### Capacità modificate

- `keyboard-model`: da modello di clavis a modello di tastiere e layout
  (clavis e classica ANSI/ISO; Colemak-DH, US, US International, italiano),
  risoluzione per keycode, Shift e AltGr per tastiera, scelta del profilo.
- `typing-session`: la tastiera a schermo è quella del profilo.
- `weakness-analysis`: statistiche e punti deboli separati per profilo.
- `exercise-generation`: corpus italiano e inglese, lingua degli esercizi
  scelta dall'utente.
- `progress-history`: sessioni etichettate col profilo; andamento, mappa di
  calore e classifiche per profilo.
- `history-sync`: sincronizza profilo e lingua delle sessioni e le nuove
  impostazioni; le sessioni senza profilo sono clavis + Colemak-DH.
- `account-auth`: messaggi del bot in inglese per chi non usa Telegram in
  italiano.

## Impatto

- `src/core/keyboard/`: nuovo formato della keymap (keycode per posizione),
  mappe dei sistemi operativi, geometrie ANSI/ISO, resolver parametrico;
  `clavis.keymap.json` da rigenerare; base QWERTY di Miryoku.
- `src/core/data.ts`: nuovi campi in `StoredSession` e `Settings`, con valori
  predefiniti per i dati esistenti; il server li accetta senza migrazioni (le
  sessioni sono salvate come JSON).
- IndexedDB: le statistiche passano da una tabella a una per profilo (schema
  versione 2, ricalcolo dallo storico).
- Corpus: `public/corpus/` si divide per lingua; circa 400 kB in più per
  l'inglese (con attribuzione in `ATTRIBUTION.md`).
- UI: tutti i testi passano da un catalogo di traduzioni (circa 90 frasi),
  componente tastiera generalizzato, selettore di profilo e di lingua.
- Bot: testi in due lingue.
