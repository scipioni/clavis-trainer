# Spec Delta

## MODIFIED Requirements

### Requirement: Impostazioni dell'account
Per un utente connesso il sistema SHALL salvare le impostazioni nell'account,
compresi profilo attivo, lingua dell'interfaccia, lingua degli esercizi e
versioni della guida già viste, e applicare su ogni dispositivo la versione
modificata più di recente.

#### Scenario: Cambio impostazione
- **WHEN** l'utente disattiva la tastiera a schermo sul portatile e poi apre il fisso
- **THEN** anche sul fisso la tastiera a schermo è disattivata

#### Scenario: Lingua dell'interfaccia
- **WHEN** l'utente passa l'interfaccia in inglese sul portatile e poi apre il fisso
- **THEN** anche sul fisso l'interfaccia è in inglese

#### Scenario: Guida già vista su un altro dispositivo
- **WHEN** l'utente connesso chiude la guida di clavis sul portatile e poi apre il fisso, dove ha già fatto l'accesso
- **THEN** sul fisso la guida di clavis non si apre da sola
