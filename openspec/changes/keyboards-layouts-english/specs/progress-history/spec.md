# Spec Delta

## MODIFIED Requirements

### Requirement: Andamento nel tempo
Il sistema SHALL mostrare un grafico di WPM e precisione per sessione e per
giorno, con l'ultimo valore e la media degli ultimi 7 giorni, considerando
solo le sessioni del profilo attivo.

#### Scenario: Progressi su più giorni
- **WHEN** l'utente ha sessioni in 10 giorni diversi con il profilo attivo
- **THEN** il grafico per giorno mostra 10 punti con WPM medio e precisione media di ciascun giorno

#### Scenario: Sessioni di un altro profilo
- **WHEN** l'utente ha 5 sessioni con clavis + Colemak-DH e 3 con classica ISO + Italiano QWERTY, e il profilo attivo è il secondo
- **THEN** il grafico per sessione mostra 3 punti

### Requirement: Mappa di calore sulla tastiera
Il sistema SHALL mostrare la tastiera del profilo attivo colorando ogni tasto
secondo il tempo medio o il tasso di errore dei caratteri che produce, a
scelta; per clavis con un layer selezionabile tra BASE, NUM e SYM.

#### Scenario: Tasto lento
- **WHEN** con il profilo clavis + Colemak-DH il carattere `b` ha il tempo medio più alto del layer BASE
- **THEN** sulla mappa del tempo il tasto `b` ha il colore più intenso

#### Scenario: Tasti di layer
- **WHEN** con il profilo clavis + Colemak-DH l'utente seleziona il layer SYM
- **THEN** la mappa mostra i simboli di quel layer con i loro valori e i tasti senza dati appaiono neutri

#### Scenario: Tastiera classica
- **WHEN** il profilo attivo è classica ANSI + US QWERTY
- **THEN** la mappa mostra la tastiera ANSI con un solo livello e la riga dei numeri

### Requirement: Classifiche dei punti deboli
Il sistema SHALL mostrare le unità più deboli del profilo attivo per tipo
(caratteri, bigrammi, transizioni di layer solo per clavis, tasti morti, dita)
con tempo medio, tasso di errore e numero di campioni, e un'azione che avvia
una sessione adattiva concentrata sull'unità scelta.

#### Scenario: Allenamento mirato
- **WHEN** l'utente sceglie il bigramma `gl` dalla classifica e avvia l'allenamento
- **THEN** parte una sessione adattiva in cui la maggior parte delle parole contiene `gl`

#### Scenario: Niente layer sulla tastiera classica
- **WHEN** il profilo attivo è su tastiera classica
- **THEN** la classifica non offre il tipo "transizioni di layer"

## ADDED Requirements

### Requirement: Profilo e lingua delle sessioni
Il sistema SHALL registrare in ogni sessione tastiera, layout e lingua degli
esercizi; le sessioni registrate prima di questa funzione valgono come
clavis + Colemak-DH in italiano, anche quando arrivano da un file esportato.

#### Scenario: Sessioni esistenti
- **WHEN** un utente con 20 sessioni precedenti apre la nuova versione
- **THEN** le 20 sessioni compaiono nel profilo clavis + Colemak-DH con le stesse statistiche di prima

#### Scenario: Importazione di un vecchio file
- **WHEN** l'utente importa un file esportato prima di questa funzione
- **THEN** l'importazione riesce e le sessioni vengono attribuite a clavis + Colemak-DH in italiano
