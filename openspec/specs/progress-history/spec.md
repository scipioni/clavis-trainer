# progress-history Specification

## Purpose
Conserva nel browser lo storico delle sessioni e le statistiche, e le mostra
come andamento nel tempo, mappa di calore sulla tastiera clavis e classifiche
dei punti deboli, con esportazione e importazione per non perdere i dati.

## Requirements

### Requirement: Salvataggio locale
Il sistema SHALL salvare nel browser ogni sessione completata (data, modalità,
durata, WPM, precisione, errori, attivazioni involontarie dei mod, campioni per
carattere) e le statistiche per unità, in modo che sopravvivano alla chiusura
del browser. Senza accesso i dati non lasciano il browser; con l'accesso
vengono inviati solo al server di clavis-trainer.

#### Scenario: Riapertura
- **WHEN** l'utente completa una sessione, chiude il browser e riapre l'applicazione
- **THEN** la sessione compare nello storico e i punti deboli sono quelli aggiornati

#### Scenario: Nessuna rete
- **WHEN** si osserva il traffico di rete durante l'uso senza accesso
- **THEN** non ci sono richieste verso host diversi da quello del sito e nessun dato di allenamento viene inviato

#### Scenario: Con accesso
- **WHEN** si osserva il traffico di rete durante l'uso con accesso
- **THEN** i dati di allenamento vanno solo all'API dello stesso sito

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

### Requirement: Esportazione e importazione
Il sistema SHALL esportare tutti i dati in un file JSON versionato e
reimportarlo sostituendo i dati presenti, dopo conferma, rifiutando i file
non validi senza modificare i dati esistenti. Con l'accesso attivo
l'importazione sostituisce anche i dati dell'account.

#### Scenario: Ripristino
- **WHEN** l'utente esporta, cancella i dati del sito e reimporta il file
- **THEN** storico e statistiche sono identici a prima

#### Scenario: File non valido
- **WHEN** l'utente importa un file JSON di altro formato
- **THEN** il sistema mostra un errore e i dati esistenti restano invariati

#### Scenario: Importazione con accesso
- **WHEN** l'utente connesso importa un file con 3 sessioni in un account che ne ha 10
- **THEN** dopo conferma l'account e il browser contengono solo le 3 sessioni del file

### Requirement: Azzeramento
Il sistema SHALL permettere di cancellare tutti i dati, con una conferma
esplicita dentro la pagina. Con l'accesso attivo vengono cancellati anche i
dati dell'account, e la conferma lo dice esplicitamente.

#### Scenario: Cancellazione
- **WHEN** l'utente conferma l'azzeramento
- **THEN** storico e statistiche sono vuoti e la modalità adattiva riparte senza dati

#### Scenario: Cancellazione con accesso
- **WHEN** l'utente connesso conferma l'azzeramento
- **THEN** anche l'account è vuoto e gli altri dispositivi, alla sincronizzazione successiva, non ricevono più quelle sessioni

### Requirement: Dati locali all'uscita
All'uscita dall'account il sistema SHALL rimuovere dal browser storico,
statistiche e impostazioni dell'account, dopo una conferma che ricorda che i
dati restano nell'account; le sessioni non ancora inviate vengono segnalate e
l'uscita è permessa solo dopo una seconda conferma.

#### Scenario: Uscita su un computer condiviso
- **WHEN** l'utente connesso esce
- **THEN** il browser non mostra più il suo storico, che ricompare accedendo di nuovo

#### Scenario: Uscita con sessioni non inviate
- **WHEN** l'utente prova a uscire con 2 sessioni non inviate
- **THEN** il sistema avvisa che andrebbero perse e chiede una seconda conferma

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
