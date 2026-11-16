# Task

## 1. Impalcatura

- [x] 1.1 Creare il progetto Vite + Svelte 5 + TypeScript con bun, Vitest e la struttura di cartelle del design (`src/core/*`, `src/storage`, `src/ui`, `scripts`); verifica: `bun run dev` serve una pagina vuota e `bun run test` passa con un test segnaposto
- [x] 1.2 Aggiungere `.gitignore` (node_modules, dist, dati grezzi del corpus), `README.md` con i comandi di avvio, e gli script `dev`, `build`, `preview`, `test`, `check` in `package.json`; verifica: `bun run build` e `bun run check` terminano senza errori

## 2. Modello della tastiera

- [x] 2.1 Scrivere `scripts/gen-keymap.ts` che legge `custom_config.h` (URL GitHub o percorso locale), estrae `MIRYOKU_LAYER_BASE/NUM/SYM` e produce `src/core/keyboard/clavis.keymap.json` con output, output con Shift, hold-tap e tasti di layer per ognuna delle 40 posizioni; verifica: test sul file reale salvato come fixture, con la riga superiore BASE `q w f p b j l u y ;` e la riga superiore NUM `[ 7 8 9 ]`
- [x] 2.2 Implementare geometria e dita (36 tasti, colonna → dito, pollici) con i tipi `Key`, `Chord`, `Layer`; verifica: unit test sugli scenari "Dito dei tasti della riga base" e "Colonna interna"
- [x] 2.3 Implementare il risolutore `resolve(char, { deadKeys })`: BASE, layer NUM/SYM, maiuscole con HRM opposto, Shift dentro un layer, tasti morti e composizioni, caratteri non digitabili; verifica: unit test per ogni scenario di `specs/keyboard-model/spec.md` (`e`, `(`, `5`, `L`, `S`, `"`, `è`, `'` con e senza tasti morti, `€`)
- [x] 2.4 Documentare nel README come rigenerare la keymap dopo una modifica del firmware; verifica: il comando documentato rigenera un JSON identico a quello versionato

## 3. Sessione di digitazione (nucleo)

- [x] 3.1 Implementare la macchina a stati pura della sessione: eventi astratti `char`/`dead`/`mod`, avanzamento solo su carattere corretto, campioni con tempo, errori, carattere ottenuto e precedente; verifica: unit test che simulano la digitazione di `ci`, un errore `r` al posto di `e` e la correzione
- [x] 3.2 Aggiungere pausa per inattività (> 5 s), perdita del focus, durata a tempo, abbandono, classificazione degli errori da tasto morto e delle attivazioni involontarie dei mod; verifica: unit test per gli scenari "Pausa per inattività", "Scadenza del tempo", "Apostrofo composto per sbaglio", "Ctrl involontario"
- [x] 3.3 Implementare il calcolo del risultato (WPM netto, precisione, errori, mod involontari, caratteri e bigrammi più lenti); verifica: unit test sugli scenari "Calcolo WPM" (300 caratteri in 60 s → 60) e "Calcolo precisione" (190/200 → 95%)

## 4. Analisi dei punti deboli

- [x] 4.1 Implementare l'estrazione delle unità da un campione (carattere, bigramma, transizione di layer tramite il risolutore, tasto morto, dito); verifica: unit test sullo scenario `a` → `(`
- [x] 4.2 Implementare EMA per unità, esclusione dei campioni anomali, punteggio relativo alla mediana del tipo, soglia di 5 campioni e classifiche; pesi in un solo modulo di costanti; verifica: unit test per "Miglioramento recente", "Esitazione lunga", "Ordinamento" (`gl` sopra `ch`), "Pochi campioni"
- [x] 4.3 Implementare il ricalcolo completo delle statistiche rigiocando una lista di sessioni; verifica: unit test che confronta aggiornamento incrementale e ricalcolo sugli stessi dati

## 5. Corpus e generazione degli esercizi

- [x] 5.1 Scrivere `scripts/build-corpus.ts`: scarica FrequencyWords `it_50k` e le frasi italiane di Tatoeba, filtra con il risolutore, normalizza, applica una lista di esclusione e scrive `public/corpus/words.json`, `public/corpus/sentences.json` e `ATTRIBUTION.md`; verifica: almeno 5.000 parole e 2.000 frasi, tutte risolvibili (test che carica i file generati)
- [x] 5.2 Implementare la normalizzazione del testo libero (spazi, a capo, virgolette e apostrofi tipografici, trattini, puntini, rimozione dei non digitabili con conteggio); verifica: unit test su `l’acqua` → `l'acqua` e su un testo con `€` ed emoji
- [x] 5.3 Implementare il generatore adattivo (indice unità → parole, 70% mirato con esplorazione, resto per frequenza, allenamento mirato su un'unità al 90%) e l'inserimento regolabile di maiuscole, punteggiatura e cifre; verifica: unit test statistico con generatore casuale a seme fisso: con `gl` come unità più debole, la frequenza di `gl` supera chiaramente quella del campionamento per frequenza; scenari "Nessun dato" e "Solo minuscole"
- [x] 5.4 Implementare la modalità frasi con preferenza per le unità deboli; verifica: unit test con seme fisso: con i tasti morti deboli, la quota di accentate e apostrofi supera la media del corpus

## 6. Persistenza

- [x] 6.1 Implementare lo strato IndexedDB (`sessions`, `unitStats`, impostazioni) con salvataggio incrementale della sessione in corso e recupero all'avvio; verifica: test con `fake-indexeddb` su salvataggio, riapertura e sessione `in-progress` rimasta
- [x] 6.2 Implementare esportazione e importazione JSON versionata con validazione, sostituzione dopo conferma e ricalcolo delle statistiche, più l'azzeramento; verifica: test di andata e ritorno (esporta → azzera → importa → dati identici) e rifiuto di un file non valido senza modifiche

## 7. Interfaccia

- [x] 7.1 Componente tastiera clavis in SVG (due metà, pollici, etichette per layer) riutilizzabile sia come guida sia come mappa di calore; verifica: a schermo il layer BASE corrisponde alla keymap generata e il layer SYM mostra `{ & * ( }` sulla riga superiore sinistra
- [x] 7.2 Schermata di allenamento: scelta di modalità e durata, testo con cursore ed errori, textarea nascosta con `keydown`/`input`, tastiera guida con layer, tasto e tasti da tenere, mostra/nascondi persistente, `beforeunload` attivo solo in sessione, Esc per abbandonare; verifica manuale con clavis: frase con `è`, `l'acqua`, una maiuscola e una parentesi digitata senza falsi errori, e un Ctrl+T simulato registrato come mod involontario
- [x] 7.3 Schermata dei risultati di fine sessione; verifica: dopo una sessione di 30 s i valori coincidono con quelli calcolati dal nucleo per gli stessi campioni
- [x] 7.4 Schermata statistiche: grafico WPM/precisione per sessione e per giorno con media a 7 giorni, mappa di calore per tempo o errori con scelta del layer, classifiche per tipo di unità con il pulsante "allena questo"; verifica: con dati di prova caricati da un file di esportazione di esempio, grafico, mappa e classifiche mostrano i valori attesi
- [x] 7.5 Impostazioni (tasti morti, proporzioni di maiuscole/punteggiatura/cifre, esportazione, importazione, azzeramento con conferma dentro la pagina) e pagina informazioni con l'attribuzione del corpus; verifica: le impostazioni sopravvivono a un ricaricamento e l'attribuzione è visibile

## 8. Verifica d'insieme

- [x] 8.1 Prova completa con clavis su build di produzione (`bun run build && bun run preview`), senza rete: tre sessioni adattive, chiusura e riapertura del browser, controllo che storico, punti deboli e generazione mirata siano coerenti e che nel pannello di rete non ci siano richieste esterne
