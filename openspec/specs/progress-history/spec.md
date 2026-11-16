# progress-history Specification

## Purpose
Conserva nel browser lo storico delle sessioni e le statistiche, e le mostra
come andamento nel tempo, mappa di calore sulla tastiera clavis e classifiche
dei punti deboli, con esportazione e importazione per non perdere i dati.

## Requirements

### Requirement: Salvataggio locale
Il sistema SHALL salvare nel browser, senza inviare dati a server esterni,
ogni sessione completata (data, modalità, durata, WPM, precisione, errori,
attivazioni involontarie dei mod, campioni per carattere) e le statistiche per
unità, in modo che sopravvivano alla chiusura del browser.

#### Scenario: Riapertura
- **WHEN** l'utente completa una sessione, chiude il browser e riapre l'applicazione
- **THEN** la sessione compare nello storico e i punti deboli sono quelli aggiornati

#### Scenario: Nessuna rete
- **WHEN** si osserva il traffico di rete durante l'uso
- **THEN** non ci sono richieste verso host esterni

### Requirement: Andamento nel tempo
Il sistema SHALL mostrare un grafico di WPM e precisione per sessione e per
giorno, con l'ultimo valore e la media degli ultimi 7 giorni.

#### Scenario: Progressi su più giorni
- **WHEN** l'utente ha sessioni in 10 giorni diversi
- **THEN** il grafico per giorno mostra 10 punti con WPM medio e precisione media di ciascun giorno

### Requirement: Mappa di calore sulla tastiera
Il sistema SHALL mostrare la tastiera clavis colorando ogni tasto secondo il
tempo medio o il tasso di errore dei caratteri che produce, a scelta, con un
layer selezionabile tra BASE, NUM e SYM.

#### Scenario: Tasto lento
- **WHEN** il carattere `b` ha il tempo medio più alto del layer BASE
- **THEN** sulla mappa del tempo il tasto `b` ha il colore più intenso

#### Scenario: Tasti di layer
- **WHEN** l'utente seleziona il layer SYM
- **THEN** la mappa mostra i simboli di quel layer con i loro valori e i tasti senza dati appaiono neutri

### Requirement: Classifiche dei punti deboli
Il sistema SHALL mostrare le unità più deboli per tipo (caratteri, bigrammi,
transizioni di layer, tasti morti, dita) con tempo medio, tasso di errore e
numero di campioni, e un'azione che avvia una sessione adattiva concentrata
sull'unità scelta.

#### Scenario: Allenamento mirato
- **WHEN** l'utente sceglie il bigramma `gl` dalla classifica e avvia l'allenamento
- **THEN** parte una sessione adattiva in cui la maggior parte delle parole contiene `gl`

### Requirement: Esportazione e importazione
Il sistema SHALL esportare tutti i dati in un file JSON versionato e
reimportarlo sostituendo i dati presenti, dopo conferma, rifiutando i file
non validi senza modificare i dati esistenti.

#### Scenario: Ripristino
- **WHEN** l'utente esporta, cancella i dati del sito e reimporta il file
- **THEN** storico e statistiche sono identici a prima

#### Scenario: File non valido
- **WHEN** l'utente importa un file JSON di altro formato
- **THEN** il sistema mostra un errore e i dati esistenti restano invariati

### Requirement: Azzeramento
Il sistema SHALL permettere di cancellare tutti i dati, con una conferma
esplicita dentro la pagina.

#### Scenario: Cancellazione
- **WHEN** l'utente conferma l'azzeramento
- **THEN** storico e statistiche sono vuoti e la modalità adattiva riparte senza dati
