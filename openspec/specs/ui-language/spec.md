# ui-language Specification

## Purpose
Permette di usare clavis-trainer in italiano o in inglese, scegliendo la
lingua dell'interfaccia indipendentemente dalla lingua degli esercizi.

## Requirements

### Requirement: Lingue dell'interfaccia
Il sistema SHALL offrire l'interfaccia completa in italiano e in inglese:
navigazione, allenamento, risultati, statistiche, impostazioni, account,
informazioni, messaggi di errore e conferme.

#### Scenario: Interfaccia in inglese
- **WHEN** l'utente sceglie l'inglese
- **THEN** tutti i testi dell'interfaccia sono in inglese, compresi i dialoghi di conferma e gli errori

### Requirement: Lingua iniziale dal browser
Al primo avvio il sistema SHALL usare l'italiano se la lingua preferita del
browser è l'italiano, altrimenti l'inglese.

#### Scenario: Browser in tedesco
- **WHEN** un utente con il browser in tedesco apre l'app per la prima volta
- **THEN** l'interfaccia e gli esercizi sono in inglese

#### Scenario: Browser in italiano
- **WHEN** un utente con il browser in italiano apre l'app per la prima volta
- **THEN** l'interfaccia e gli esercizi sono in italiano

### Requirement: Cambio di lingua
Il sistema SHALL permettere di cambiare la lingua dell'interfaccia in ogni
momento, senza ricaricare la pagina e senza interrompere una sessione in
corso, e SHALL ricordare la scelta.

#### Scenario: Cambio durante l'uso
- **WHEN** l'utente passa all'inglese dalle impostazioni
- **THEN** l'interfaccia cambia subito lingua e alla riapertura resta in inglese

### Requirement: Formati locali
Il sistema SHALL formattare date, orari, numeri e percentuali secondo la
lingua dell'interfaccia.

#### Scenario: Data in inglese
- **WHEN** l'interfaccia è in inglese e si guarda lo storico
- **THEN** le date sono nel formato inglese e le percentuali usano il punto decimale
