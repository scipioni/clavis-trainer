# Task

## 1. Modello per keycode

- [x] 1.1 Introdurre i tipi `Board`, `OsMap` e `Profile` e le mappe dei sistemi US, US International (tasti morti) e italiana (XKB `it`) con i livelli normale/Shift/AltGr/AltGr+Shift; verifica: unit test che controllano a campione i quattro livelli (`Digit9` → `9 ( ] }` in italiano, `Quote` → `' "` in US)
- [x] 1.2 Cambiare `parseKeymap` perché registri keycode e shift impliciti (`LPAR` = Shift+`Digit9`), rigenerare `clavis.keymap.json` e costruire la base QWERTY di Miryoku; verifica: i test esistenti di `keyboard-model` passano con il profilo `clavis:colemakdh` e un nuovo test controlla la riga superiore `q w e r t y u i o p` con `clavis:us`
- [x] 1.3 Rendere `Resolver` parametrico su `Board` + `OsMap` (Shift come home row mod su clavis, tasti morti solo sulle mappe basate su US); verifica: unit test per gli scenari "Stesso keycode, sistema diverso" (`è` su `clavis:it`), "Home row mod con la base QWERTY" (`K`) e "Layout italiano" (`'` senza spazio)

## 2. Tastiera classica

- [x] 2.1 Geometria ANSI e ISO con keycode, larghezze e dita standard; mappa Colemak-DH per la tastiera classica con angle mod e la sua tabella delle dita (controllata con la documentazione di colemakmods); verifica: unit test per "Tastiera classica" (`f j b 5 6` e spazio) e "Colemak-DH sulla tastiera classica"
- [x] 2.2 Shift della mano opposta e AltGr col pollice destro sulla tastiera classica, `IntlBackslash` solo in ISO; verifica: unit test per "Maiuscola", "Chiocciola in italiano", "Tasto ISO in più" e "Carattere solo ISO in ANSI"
- [x] 2.3 Funzione dei caratteri non raggiungibili per profilo e lingua; verifica: unit test per "Maiuscola accentata in italiano" (`È` con `iso:it`) e la matrice completa 3 × 3 × 2 confrontata con valori attesi in una fixture

## 3. Dati e compatibilità

- [x] 3.1 Aggiungere `keyboard`, `layout`, `lang` a `StoredSession` e `keyboard`, `layout`, `uiLang`, `exerciseLang` a `Settings` in `src/core/data.ts`, con i valori predefiniti per i dati esistenti e la validazione dei valori conosciuti; verifica: unit test su vecchia sessione accettata, `dvorak` rifiutato, impostazioni vecchie completate
- [x] 3.2 IndexedDB versione 2: statistiche per profilo (`stats:<profilo>`), migrazione da v1 e ricalcolo al primo avvio, `completeSession`/`recomputeStats`/importazione per profilo, sincronizzazione che ricalcola i profili toccati; verifica: test con `fake-indexeddb` che apre un database v1 con 20 sessioni e ritrova le stesse statistiche in `clavis:colemakdh`, più i test di sincronizzazione esistenti
- [x] 3.3 Analisi per profilo: unità `layer` solo per clavis, dita dal profilo della sessione; verifica: unit test per "Tastiera classica senza layer" e "Due profili"
- [x] 3.4 Server: aggiornare i test per sessioni con e senza profilo e per un profilo sconosciuto; verifica: `bun test server` copre "Sessione di una versione precedente" e "Profilo sconosciuto"

## 4. Corpus e generazione

- [x] 4.1 `build-corpus.ts` per lingua (`it`, `en`), file in `public/corpus/<lingua>/`, lista di esclusione inglese, attribuzione aggiornata in `ATTRIBUTION.md` e nella pagina informazioni; verifica: test sul corpus inglese (almeno 5.000 parole e 2.000 frasi, contrazioni presenti, `I` maiuscola) e sul corpus italiano spostato
- [x] 4.2 Generatore per lingua e profilo (elisioni solo in italiano), hash di versione per lingua, caricamento del solo corpus della lingua attiva; verifica: unit test "Esercizi in inglese" e test del generatore con profilo `ansi:us` che non produce caratteri non raggiungibili

## 5. Interfaccia in due lingue

- [x] 5.1 Cataloghi `it`/`en`, `t()` reattivo, formati con `Intl`, lingua iniziale dal browser; verifica: test che confronta le chiavi dei cataloghi e test di `detectLanguage` (`de-DE` → `en`, `it-IT` → `it`)
- [x] 5.2 Spostare tutti i testi dei componenti nei cataloghi (allenamento, risultati, statistiche, impostazioni, account, accesso, informazioni, errori) e aggiungere il selettore della lingua; verifica: script che non trova testi italiani fuori catalogo nei `.svelte` e e2e con interfaccia in inglese
- [x] 5.3 Bot bilingue (messaggi da `language_code`, presentazione con `language_code` `it` e predefinita in inglese); verifica: `bun test server` con utente `en` e `it` e controllo della presentazione per entrambe le lingue

## 6. Interfaccia per i profili

- [x] 6.1 `Keyboard.svelte` generalizzato su `Board` (clavis, ANSI, ISO con Invio a L) ed etichette dalla `OsMap`; verifica: screenshot e2e delle tre tastiere con QWERTY italiano e confronto delle etichette con la mappa
- [x] 6.2 Selettore di profilo (impostazioni e barra dell'allenamento) con l'avviso dei caratteri non raggiungibili; statistiche, mappa di calore e classifiche filtrate per profilo, senza layer sulle tastiere classiche; verifica: e2e che allena due profili e controlla che grafici e classifiche restino separati
- [x] 6.3 README (profili, lingua, rollback con IndexedDB v2) e pagina informazioni (nota sulla mappa italiana di Windows); verifica: i comandi del README eseguiti così come sono scritti

## 7. Verifica d'insieme

- [x] 7.1 Suite complete (`bun run test`, `bun test server`, `bun run check`, e2e smoke, account e profili) contro l'immagine locale, poi rilascio e smoke test contro la produzione; verifica: tutte verdi e `update.log` su cubo riporta la nuova versione
