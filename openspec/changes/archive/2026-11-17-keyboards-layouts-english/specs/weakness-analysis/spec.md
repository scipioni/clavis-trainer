# Spec Delta

## MODIFIED Requirements

### Requirement: Unità di analisi
Il sistema SHALL raccogliere statistiche per queste unità: carattere,
bigramma di caratteri, transizione di layer (layer del carattere precedente →
layer del carattere attuale, se diversi; solo per clavis), sequenza con tasto
morto, dito. Mano e dito vengono dal profilo con cui la sessione è stata
fatta.

#### Scenario: Unità alimentate da un carattere
- **WHEN** con il profilo clavis + Colemak-DH l'utente digita `(` subito dopo `a`
- **THEN** il campione aggiorna il carattere `(`, il bigramma `a(`, la transizione BASE→SYM e il dito che batte `(`

#### Scenario: Tastiera classica senza layer
- **WHEN** con il profilo classica ANSI + US QWERTY l'utente digita `(` subito dopo `a`
- **THEN** il campione aggiorna carattere, bigramma e dito, e nessuna transizione di layer

## ADDED Requirements

### Requirement: Statistiche separate per profilo
Il sistema SHALL tenere statistiche e punti deboli separati per ogni
combinazione di tastiera e layout, calcolati solo dalle sessioni fatte con
quel profilo.

#### Scenario: Due profili
- **WHEN** l'utente si allena con clavis + Colemak-DH e con classica ISO + Italiano QWERTY
- **THEN** i punti deboli mostrati con un profilo non includono i campioni dell'altro

#### Scenario: Profilo senza sessioni
- **WHEN** l'utente passa a un profilo mai usato
- **THEN** la modalità adattiva riparte senza dati, mentre le statistiche degli altri profili restano intatte
