# Spec Delta

## MODIFIED Requirements

### Requirement: Impostazioni dell'account
Per un utente connesso il sistema SHALL salvare le impostazioni nell'account,
compresi profilo attivo, lingua dell'interfaccia e lingua degli esercizi, e
applicare su ogni dispositivo la versione modificata più di recente.

#### Scenario: Cambio impostazione
- **WHEN** l'utente disattiva la tastiera a schermo sul portatile e poi apre il fisso
- **THEN** anche sul fisso la tastiera a schermo è disattivata

#### Scenario: Lingua dell'interfaccia
- **WHEN** l'utente passa l'interfaccia in inglese sul portatile e poi apre il fisso
- **THEN** anche sul fisso l'interfaccia è in inglese

### Requirement: Validazione sul server
Il server SHALL accettare solo sessioni ben formate, entro limiti di
dimensione per richiesta e per sessione, con tastiera, layout e lingua tra
quelli conosciuti o assenti, e SHALL rifiutare le altre senza modificare i
dati dell'account.

#### Scenario: Sessione malformata
- **WHEN** arriva una richiesta con una sessione priva dei campioni
- **THEN** il server risponde con un errore e l'account resta invariato

#### Scenario: Sessione di una versione precedente
- **WHEN** un browser non ancora aggiornato invia una sessione senza tastiera, layout e lingua
- **THEN** il server la accetta e gli altri dispositivi la attribuiscono a clavis + Colemak-DH in italiano

#### Scenario: Profilo sconosciuto
- **WHEN** arriva una sessione con layout `dvorak`
- **THEN** il server la rifiuta e l'account resta invariato
