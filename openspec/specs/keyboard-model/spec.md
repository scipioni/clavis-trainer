# keyboard-model Specification

## Purpose
Descrive la tastiera clavis (36 tasti, Miryoku Colemak-DH, home row mods,
sistema in US International con tasti morti) e traduce ogni carattere da
digitare nella sequenza di pressioni fisiche che lo produce, con dito e mano.

## Requirements

### Requirement: Geometria e assegnazione delle dita
Il sistema SHALL descrivere i 36 tasti di clavis (per lato 3 righe da 5 tasti
e 3 tasti per il pollice) e assegnare a ciascuno una mano e un dito, in base
alla diteggiatura standard per colonne: mignolo, anulare, medio, indice per le
due colonne interne, pollice per i tasti del pollice.

#### Scenario: Dito dei tasti della riga base
- **WHEN** si interroga il modello sulle posizioni dei caratteri `a`, `t`, `n`, `o`
- **THEN** il modello risponde rispettivamente mignolo sinistro, indice sinistro, indice destro, mignolo destro

#### Scenario: Colonna interna
- **WHEN** si interroga il modello sulla posizione di `g`
- **THEN** il modello risponde indice sinistro, colonna interna, riga base

### Requirement: Keymap ricavata dal firmware
Il sistema SHALL usare come fonte dei layer BASE, NUM e SYM la keymap ZMK di
`scipioni/clavis` (`firmware/zmk-timeless/config/custom_config.h`), convertita
in un formato dati versionato nel progetto, in modo che una modifica del
firmware si recepisca rigenerando i dati senza modificare il codice.

#### Scenario: Rigenerazione dalla keymap
- **WHEN** si esegue la conversione sul file `custom_config.h` attuale
- **THEN** i dati prodotti contengono `q w f p b j l u y ;` come riga superiore del layer BASE e `[ 7 8 9 ]` sul lato sinistro della riga superiore del layer NUM

#### Scenario: Keymap modificata
- **WHEN** nel firmware due tasti del layer BASE vengono scambiati e si rigenera
- **THEN** la risoluzione dei caratteri interessati riflette le nuove posizioni

### Requirement: Risoluzione di un carattere in pressioni
Per ogni carattere supportato il sistema SHALL fornire la sequenza di accordi
che lo produce. Un accordo è un insieme di tasti tenuti (layer o
modificatore) più un tasto battuto. Tra le alternative si sceglie quella con
meno pressioni, a parità il layer BASE.

#### Scenario: Minuscola sul layer base
- **WHEN** si risolve `e`
- **THEN** il risultato è un solo accordo: battere il tasto di `e`, nessun tasto tenuto

#### Scenario: Simbolo su layer
- **WHEN** si risolve `(`
- **THEN** il risultato è un accordo con il pollice destro che tiene il tasto di layer SYM e il tasto `(` battuto sul lato sinistro

#### Scenario: Cifra
- **WHEN** si risolve `5`
- **THEN** il risultato è un accordo con il pollice destro che tiene il tasto di layer NUM e il medio sinistro che batte la riga base

### Requirement: Maiuscole tramite home row mod della mano opposta
Il sistema SHALL risolvere una lettera maiuscola come accordo in cui Shift è
tenuto con l'home row mod Shift della mano opposta a quella che batte la
lettera (indice su `t` a sinistra, indice su `n` a destra).

#### Scenario: Maiuscola della mano destra
- **WHEN** si risolve `L`
- **THEN** l'accordo tiene lo Shift sull'indice sinistro (posizione di `t`) e batte `l` con la mano destra

#### Scenario: Maiuscola della mano sinistra
- **WHEN** si risolve `S`
- **THEN** l'accordo tiene lo Shift sull'indice destro (posizione di `n`) e batte `s` con la mano sinistra

### Requirement: Caratteri con Shift su un layer
Il sistema SHALL risolvere i caratteri che richiedono Shift dentro un layer
(per esempio `"` come Shift+`'` sul layer NUM) come un accordo che tiene sia
il tasto di layer sia il modificatore Shift disponibile su quel layer.

#### Scenario: Virgolette doppie
- **WHEN** si risolve `"`
- **THEN** l'accordo tiene il layer NUM (pollice destro) e lo Shift del lato destro, e batte il tasto di `'` col mignolo sinistro

### Requirement: Tasti morti di US International
Con l'opzione tasti morti attiva (predefinita) il sistema SHALL trattare `'`,
`"`, `` ` ``, `~` e `^` come tasti morti: una lettera accentata è il tasto
morto seguito dalla lettera; il carattere letterale è il tasto morto seguito
da spazio.

#### Scenario: Lettera accentata grave
- **WHEN** si risolve `è`
- **THEN** il risultato sono due accordi: `` ` `` sul layer NUM (mignolo sinistro, riga inferiore) e poi `e`

#### Scenario: Apostrofo italiano
- **WHEN** si risolve `'` (per esempio in `l'acqua`)
- **THEN** il risultato sono due accordi: `'` sul layer NUM e poi spazio col pollice sinistro

#### Scenario: Tasti morti disattivati
- **WHEN** l'opzione tasti morti è disattivata e si risolve `'`
- **THEN** il risultato è un solo accordo sul layer NUM

### Requirement: Caratteri non supportati
Il sistema SHALL segnalare come non digitabile ogni carattere che non riesce a
risolvere, invece di proporlo in un esercizio.

#### Scenario: Carattere assente dalla keymap
- **WHEN** si risolve `€`
- **THEN** il modello lo segnala come non digitabile
