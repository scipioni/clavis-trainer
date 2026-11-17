# history-sync Specification

## Purpose
Mantiene allineati tra i dispositivi dell'utente connesso lo storico delle
sessioni e le impostazioni, senza rinunciare al funzionamento locale e offline.

## Requirements

### Requirement: Invio delle sessioni completate
Per un utente connesso il sistema SHALL inviare al server ogni sessione
completata; se il server non è raggiungibile la sessione resta in attesa e
viene inviata alla sincronizzazione successiva.

#### Scenario: Sessione completata online
- **WHEN** l'utente connesso completa una sessione
- **THEN** pochi secondi dopo la sessione è salvata nell'account

#### Scenario: Sessione completata offline
- **WHEN** l'utente connesso completa una sessione senza rete e poi la rete torna
- **THEN** alla sincronizzazione successiva la sessione arriva nell'account, una sola volta

### Requirement: Ricezione dello storico degli altri dispositivi
Il sistema SHALL scaricare le sessioni dell'account non ancora presenti nel
browser all'accesso, all'apertura dell'app, quando la pagina torna in primo
piano e dopo ogni sessione completata, e SHALL ricalcolare le statistiche
dallo storico unito in ordine cronologico.

#### Scenario: Secondo dispositivo
- **WHEN** l'utente ha 20 sessioni fatte sul portatile e accede dal fisso
- **THEN** il fisso mostra le 20 sessioni, gli stessi punti deboli e la stessa mappa di calore

#### Scenario: Ritorno in primo piano
- **WHEN** l'utente completa una sessione sul fisso e poi torna sulla scheda aperta nel portatile
- **THEN** il portatile mostra anche la nuova sessione

### Requirement: Nessun duplicato
Il sistema SHALL identificare ogni sessione con un identificativo univoco e
SHALL conservarla una sola volta per account, qualunque sia il numero di
invii o dispositivi.

#### Scenario: Invio ripetuto
- **WHEN** la stessa sessione viene inviata due volte (per esempio dopo un errore di rete)
- **THEN** l'account contiene quella sessione una volta sola

### Requirement: Fusione dello storico anonimo al primo accesso
Al primo accesso da un browser con storico anonimo il sistema SHALL caricare
quello storico nell'account e unirlo a quello già presente.

#### Scenario: Storico anonimo
- **WHEN** un browser con 5 sessioni fatte senza accesso entra in un account che ne ha 10
- **THEN** l'account e il browser hanno entrambi 15 sessioni

#### Scenario: Browser di un altro account
- **WHEN** un browser che contiene i dati dell'account A accede con l'account B
- **THEN** i dati di A vengono tolti dal browser e compaiono solo quelli di B

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

### Requirement: Stato della sincronizzazione visibile
Il sistema SHALL mostrare all'utente connesso il nome dell'account, l'esito
dell'ultima sincronizzazione e il numero di sessioni in attesa di invio.

#### Scenario: Sessioni in attesa
- **WHEN** due sessioni non sono ancora state inviate per mancanza di rete
- **THEN** l'interfaccia mostra "2 sessioni da inviare"
