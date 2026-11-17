# Spec Delta

## MODIFIED Requirements

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
