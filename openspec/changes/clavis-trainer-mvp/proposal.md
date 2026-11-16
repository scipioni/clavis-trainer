# Proposta: clavis-trainer MVP

## Perché

I trainer di digitazione esistenti (keybr, monkeytype) presumono una tastiera
tradizionale. Non sanno che su clavis, una split a 36 tasti con Miryoku
Colemak-DH, metà dei caratteri richiede di tenere premuto un tasto di layer
col pollice, che le maiuscole passano per gli home row mods e che con US
International a tasti morti un apostrofo italiano davanti a vocale si scrive
`'` + spazio. Per chi scrive già a 10 dita, la lentezza si nasconde proprio in
queste combinazioni e nei bigrammi difficili. Serve un trainer che conosca la
tastiera vera, misuri dove si perde tempo ed esercitazioni su testo italiano
che insistano proprio lì.

## Cosa cambia

- Nuova web app locale (si apre nel browser, nessun server, nessun account)
  per l'allenamento alla digitazione.
- Un modello della tastiera clavis (posizioni, dita, layer, home row mods,
  tasti morti US Intl) che per ogni carattere sa quale sequenza di pressioni
  fisiche serve. È ricavato dalla keymap ZMK del repository
  `scipioni/clavis`.
- Sessioni di digitazione con misura dei tempi per carattere, cattura corretta
  dei caratteri composti con tasti morti e rilevazione delle attivazioni
  involontarie degli home row mods.
- Analisi dei punti deboli: tasti, bigrammi, transizioni di layer e sequenze
  con tasti morti, ordinati per un punteggio di debolezza che cambia mentre si
  migliora.
- Generazione di esercizi da un corpus italiano reale (parole frequenti e
  frasi), pesati sui punti deboli, oltre a un testo libero incollato
  dall'utente.
- Storico delle sessioni con grafici di WPM e precisione nel tempo, mappa di
  calore sulla tastiera clavis, classifica dei bigrammi peggiori ed
  esportazione/importazione dei dati.

Fuori ambito per l'MVP: lezioni progressive per principianti, esercizi su
codice e simboli di programmazione, altri layout o tastiere, sincronizzazione
tra dispositivi, multiutente, layer NAV/MOUSE/MEDIA/FUN (non producono testo).

## Capacità

### Nuove capacità

- `keyboard-model`: descrizione della tastiera clavis e risoluzione di ogni
  carattere nella sequenza di pressioni (layer, modificatori, tasti morti),
  con dito e mano per ogni pressione.
- `typing-session`: svolgimento di una sessione: testo da digitare, cattura
  dell'input con i tempi, gestione degli errori, tastiera a schermo che mostra
  il prossimo carattere e risultato finale.
- `weakness-analysis`: statistiche per unità (carattere, bigramma, transizione
  di layer, tasto morto) e punteggio di debolezza che guida gli esercizi.
- `exercise-generation`: costruzione del testo da digitare a partire dal
  corpus italiano, dai punti deboli o da un testo incollato.
- `progress-history`: salvataggio locale delle sessioni, grafici dei
  progressi, mappa di calore ed esportazione/importazione.

### Capacità modificate

Nessuna: è il primo cambiamento del progetto.

## Impatto

- Progetto nuovo in `/lab/clavis-trainer`: applicazione frontend
  TypeScript, nessun backend.
- Dipendenze esterne di dati: lista di frequenza delle parole italiane
  (FrequencyWords, CC BY-SA 4.0) e frasi italiane di Tatoeba (CC BY 2.0 FR),
  preelaborate una volta e versionate nel repository, con attribuzione.
- Dipendenza dal repository `scipioni/clavis`: se la keymap cambia, il modello
  della tastiera va rigenerato.
- I dati dell'utente restano nel browser (IndexedDB). Se si cancellano i dati
  del sito si perdono, salvo esportazione.
