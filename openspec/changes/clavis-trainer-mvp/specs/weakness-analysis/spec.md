# Spec Delta

## Purpose

Trasforma i dati grezzi delle sessioni in statistiche per unità di digitazione
(caratteri, bigrammi, transizioni di layer, tasti morti) e in un punteggio di
debolezza che dice dove l'utente perde più tempo o fa più errori.

## ADDED Requirements

### Requirement: Unità di analisi
Il sistema SHALL raccogliere statistiche per queste unità: carattere,
bigramma di caratteri, transizione di layer (layer del carattere precedente →
layer del carattere attuale, se diversi), sequenza con tasto morto, dito.

#### Scenario: Unità alimentate da un carattere
- **WHEN** l'utente digita `(` subito dopo `a`
- **THEN** il campione aggiorna il carattere `(`, il bigramma `a(`, la transizione BASE→SYM e il dito che batte `(`

### Requirement: Statistiche per unità
Per ogni unità il sistema SHALL tenere il numero di campioni, una media
mobile esponenziale del tempo, il tasso di errore e il numero di attivazioni
involontarie dei mod, in modo che i campioni recenti contino più di quelli
vecchi.

#### Scenario: Miglioramento recente
- **WHEN** un bigramma aveva tempo medio 400 ms e nelle ultime 3 sessioni viene digitato in 200 ms
- **THEN** il suo tempo medio scende sensibilmente verso 200 ms senza attendere che i dati vecchi escano da una finestra fissa

### Requirement: Esclusione dei campioni anomali
Il sistema SHALL escludere dal calcolo dei tempi i campioni dopo una pausa e
quelli oltre 2 secondi; gli errori di quei campioni contano comunque.

#### Scenario: Esitazione lunga
- **WHEN** un carattere ha tempo 3500 ms
- **THEN** il tempo non entra nella media del carattere, ma un eventuale errore sì

### Requirement: Punteggio di debolezza
Il sistema SHALL calcolare per ogni unità un punteggio di debolezza che cresce
con il tempo relativo alla mediana dell'utente per quel tipo di unità, con il
tasso di errore e con le attivazioni involontarie dei mod. Le unità con meno
di 5 campioni non sono classificate.

#### Scenario: Ordinamento
- **WHEN** il bigramma `ch` ha tempo pari alla mediana e 1% di errori, e il bigramma `gl` ha tempo doppio della mediana e 8% di errori
- **THEN** `gl` ha un punteggio di debolezza più alto di `ch`

#### Scenario: Pochi campioni
- **WHEN** un bigramma è stato digitato 3 volte
- **THEN** non compare tra i punti deboli e viene segnalato come poco esplorato

### Requirement: Elenco dei punti deboli
Il sistema SHALL fornire, per ciascun tipo di unità, l'elenco ordinato delle
unità più deboli con il loro punteggio, tempo medio, tasso di errore e numero
di campioni.

#### Scenario: Bigrammi peggiori
- **WHEN** si chiedono i 10 bigrammi più deboli
- **THEN** si ottengono al massimo 10 bigrammi con almeno 5 campioni, in ordine decrescente di punteggio

### Requirement: Aggiornamento solo da sessioni completate
Il sistema SHALL aggiornare le statistiche solo con sessioni completate o
scadute, mai con sessioni abbandonate.

#### Scenario: Sessione abbandonata
- **WHEN** l'utente abbandona una sessione con Esc
- **THEN** le statistiche delle unità restano quelle di prima della sessione
