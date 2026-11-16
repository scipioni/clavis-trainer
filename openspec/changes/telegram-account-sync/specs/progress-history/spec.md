# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
