# account-auth Specification

## Purpose
Permette di accedere a clavis-trainer con il proprio account Telegram tramite
un bot, senza password, così che lo storico possa seguire l'utente tra
dispositivi.

## Requirements

### Requirement: Avvio dell'accesso con codice
Quando l'utente chiede di accedere, il sistema SHALL mostrare un codice breve
leggibile e un link `https://t.me/<bot>?start=<richiesta>` legati a una
richiesta di accesso valida 10 minuti e utilizzabile una sola volta.

#### Scenario: Richiesta di accesso
- **WHEN** l'utente preme "Accedi con Telegram"
- **THEN** il sito mostra un codice di 6 caratteri, il link al bot e l'attesa della conferma

#### Scenario: Richiesta scaduta
- **WHEN** passano più di 10 minuti senza conferma
- **THEN** il sito segnala la scadenza e la richiesta non può più essere confermata

### Requirement: Conferma nel bot
Quando l'utente apre il link, il bot SHALL rispondere con lo stesso codice
mostrato dal sito e un pulsante di conferma, avvertendo di non confermare
richieste non proprie; solo la pressione del pulsante completa l'accesso. I
messaggi sono in italiano se la lingua di Telegram dell'utente è l'italiano,
altrimenti in inglese.

#### Scenario: Conferma
- **WHEN** l'utente apre il link, il bot mostra il codice e l'utente preme "Conferma"
- **THEN** entro pochi secondi il sito risulta connesso a quell'account Telegram e il messaggio del bot diventa "accesso confermato"

#### Scenario: Rifiuto
- **WHEN** l'utente preme "Annulla" nel bot
- **THEN** il sito mostra che l'accesso è stato rifiutato e non crea nessuna sessione

#### Scenario: Link già usato
- **WHEN** qualcuno apre di nuovo un link di una richiesta già confermata o scaduta
- **THEN** il bot risponde che il link non è più valido

#### Scenario: Utente non italiano
- **WHEN** un utente con Telegram in inglese apre il link
- **THEN** il messaggio con il codice e i pulsanti ("Confirm", "Cancel") è in inglese

### Requirement: Sessione del browser
Dopo la conferma il sistema SHALL tenere il browser connesso con un cookie
HttpOnly, Secure, SameSite=Lax valido 180 giorni, rinnovato con l'uso, e
SHALL conservare sul server solo un'impronta del token.

#### Scenario: Riapertura
- **WHEN** l'utente connesso chiude e riapre il browser dopo una settimana
- **THEN** il sito lo riconosce senza chiedere un nuovo accesso

#### Scenario: Più dispositivi
- **WHEN** l'utente accede con lo stesso account Telegram da due browser
- **THEN** entrambi restano connessi allo stesso account, indipendentemente

### Requirement: Uscita
Il sistema SHALL permettere all'utente di uscire: la sessione del browser viene
invalidata sul server e il cookie rimosso.

#### Scenario: Uscita
- **WHEN** l'utente esce
- **THEN** quel browser non è più connesso e le richieste con il vecchio cookie sono rifiutate

### Requirement: Protezione delle richieste
Il server SHALL rifiutare le richieste che modificano dati senza
l'intestazione dell'applicazione o con un'origine diversa dal sito, e SHALL
limitare il numero di richieste di accesso per indirizzo.

#### Scenario: Richiesta da un altro sito
- **WHEN** una pagina di un altro dominio invia una POST all'API con il cookie dell'utente
- **THEN** il server la rifiuta e nessun dato cambia

#### Scenario: Troppe richieste di accesso
- **WHEN** dallo stesso indirizzo arrivano più di 10 richieste di accesso in un minuto
- **THEN** le successive sono rifiutate con un errore di troppe richieste

### Requirement: Accesso disponibile solo con il bot configurato
Il sistema SHALL mostrare l'accesso con Telegram solo se il server ha un
token valido del bot; senza token, o senza server raggiungibile, l'app
funziona in sola modalità locale senza errori.

#### Scenario: Token assente
- **WHEN** il server parte senza token del bot
- **THEN** il sito non mostra il pulsante di accesso e tutto il resto funziona

#### Scenario: Token aggiunto
- **WHEN** il token viene aggiunto alla configurazione di produzione
- **THEN** entro il ciclo di aggiornamento successivo il pulsante di accesso compare, senza altri interventi

### Requirement: Presentazione del bot
All'avvio con un token valido il server SHALL impostare nome, descrizione,
descrizione breve e comandi del bot in italiano per gli utenti italiani e in
inglese per tutti gli altri, e SHALL rispondere a `/start` senza codice
spiegando come accedere dal sito, nella lingua dell'utente.

#### Scenario: Start senza codice
- **WHEN** un utente scrive `/start` al bot senza passare dal sito
- **THEN** il bot risponde con il link al sito e le istruzioni per accedere

#### Scenario: Descrizione in inglese
- **WHEN** un utente con Telegram in inglese apre il profilo del bot
- **THEN** vede la descrizione in inglese
