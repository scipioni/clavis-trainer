# Spec Delta

## MODIFIED Requirements

### Requirement: Geometria e assegnazione delle dita
Il sistema SHALL descrivere la geometria della tastiera del profilo attivo e
assegnare a ogni tasto mano e dito: per clavis i 36 tasti con la diteggiatura
per colonne (mignolo, anulare, medio, indice per le due colonne interne,
pollice); per la tastiera classica la diteggiatura standard delle dieci dita.

#### Scenario: Dito dei tasti della riga base
- **WHEN** con il profilo clavis + Colemak-DH si interroga il modello sulle posizioni dei caratteri `a`, `t`, `n`, `o`
- **THEN** il modello risponde rispettivamente mignolo sinistro, indice sinistro, indice destro, mignolo destro

#### Scenario: Colonna interna
- **WHEN** con il profilo clavis + Colemak-DH si interroga il modello sulla posizione di `g`
- **THEN** il modello risponde indice sinistro, colonna interna, riga base

#### Scenario: Tastiera classica
- **WHEN** con il profilo classica ANSI + US QWERTY si interroga il modello su `f`, `j`, `b`, `5`, `6` e sullo spazio
- **THEN** il modello risponde indice sinistro, indice destro, indice sinistro, indice sinistro, indice destro e pollice

### Requirement: Keymap ricavata dal firmware
Per la tastiera clavis il sistema SHALL usare come fonte dei layer BASE, NUM e
SYM la keymap ZMK di `scipioni/clavis`, convertita in dati versionati che
registrano per ogni posizione il keycode e il comportamento in pressione;
con il layout QWERTY la base è quella QWERTY di Miryoku con gli stessi home row
mod.

#### Scenario: Rigenerazione dalla keymap
- **WHEN** si esegue la conversione sul file `custom_config.h` attuale
- **THEN** con il sistema in US i dati producono `q w f p b j l u y ;` come riga superiore del layer BASE e `[ 7 8 9 ]` sul lato sinistro della riga superiore del layer NUM

#### Scenario: Keymap modificata
- **WHEN** nel firmware due tasti del layer BASE vengono scambiati e si rigenera
- **THEN** la risoluzione dei caratteri interessati riflette le nuove posizioni

#### Scenario: Base QWERTY
- **WHEN** il profilo è clavis + US QWERTY
- **THEN** la riga superiore del layer BASE è `q w e r t y u i o p` e i layer NUM e SYM restano quelli del firmware

### Requirement: Risoluzione di un carattere in pressioni
Per ogni carattere supportato dal profilo attivo il sistema SHALL fornire la
sequenza di accordi che lo produce: tasti tenuti (layer o modificatori) più un
tasto battuto, con il carattere ottenuto applicando ai keycode la mappa del
sistema operativo del layout. Vince l'alternativa con meno pressioni, a
parità quella senza layer.

#### Scenario: Minuscola sul layer base
- **WHEN** con il profilo clavis + Colemak-DH si risolve `e`
- **THEN** il risultato è un solo accordo: battere il tasto di `e`, nessun tasto tenuto

#### Scenario: Simbolo su layer
- **WHEN** con il profilo clavis + Colemak-DH si risolve `(`
- **THEN** il risultato è un accordo con il pollice destro che tiene il tasto di layer SYM e il tasto `(` battuto sul lato sinistro

#### Scenario: Cifra
- **WHEN** con il profilo clavis + Colemak-DH si risolve `5`
- **THEN** il risultato è un accordo con il pollice destro che tiene il tasto di layer NUM e il medio sinistro che batte la riga base

#### Scenario: Stesso keycode, sistema diverso
- **WHEN** con il profilo clavis + Italiano QWERTY si risolve `è`
- **THEN** il risultato è un solo accordo sul layer NUM, sul tasto con il keycode `[`, senza tasti morti

### Requirement: Maiuscole tramite home row mod della mano opposta
Sulla tastiera clavis il sistema SHALL risolvere una lettera maiuscola come
accordo in cui Shift è tenuto con l'home row mod Shift della mano opposta a
quella che batte la lettera.

#### Scenario: Maiuscola della mano destra
- **WHEN** con il profilo clavis + Colemak-DH si risolve `L`
- **THEN** l'accordo tiene lo Shift sull'indice sinistro (posizione di `t`) e batte `l` con la mano destra

#### Scenario: Maiuscola della mano sinistra
- **WHEN** con il profilo clavis + Colemak-DH si risolve `S`
- **THEN** l'accordo tiene lo Shift sull'indice destro (posizione di `n`) e batte `s` con la mano sinistra

#### Scenario: Home row mod con la base QWERTY
- **WHEN** con il profilo clavis + US QWERTY si risolve `K`
- **THEN** l'accordo tiene lo Shift sull'indice sinistro (posizione di `f`) e batte `k` con la mano destra

### Requirement: Tasti morti di US International
Con il layout US e l'opzione tasti morti attiva (predefinita) il sistema SHALL
trattare `'`, `"`, `` ` ``, `~` e `^` come tasti morti: una lettera accentata è
il tasto morto seguito dalla lettera; il carattere letterale è il tasto morto
seguito da spazio. Il layout italiano non ha tasti morti.

#### Scenario: Lettera accentata grave
- **WHEN** con il profilo clavis + Colemak-DH si risolve `è`
- **THEN** il risultato sono due accordi: `` ` `` sul layer NUM (mignolo sinistro, riga inferiore) e poi `e`

#### Scenario: Apostrofo italiano
- **WHEN** con il profilo clavis + Colemak-DH si risolve `'`
- **THEN** il risultato sono due accordi: `'` sul layer NUM e poi spazio col pollice sinistro

#### Scenario: Tasti morti disattivati
- **WHEN** l'opzione tasti morti è disattivata e con il profilo clavis + Colemak-DH si risolve `'`
- **THEN** il risultato è un solo accordo sul layer NUM

#### Scenario: Layout italiano
- **WHEN** con il profilo classica ISO + Italiano QWERTY si risolve `'`
- **THEN** il risultato è un solo accordo, senza spazio aggiuntivo

## ADDED Requirements

### Requirement: Scelta del profilo di digitazione
Il sistema SHALL permettere di scegliere in modo indipendente la tastiera
(clavis, classica ANSI, classica ISO) e il layout (Colemak-DH, US QWERTY,
Italiano QWERTY), ricordare la scelta e usare clavis + Colemak-DH quando non
c'è una scelta salvata.

#### Scenario: Primo avvio
- **WHEN** un utente apre l'app per la prima volta
- **THEN** il profilo attivo è clavis + Colemak-DH

#### Scenario: Cambio di profilo
- **WHEN** l'utente sceglie classica ISO + Italiano QWERTY e ricarica la pagina
- **THEN** il profilo attivo è ancora classica ISO + Italiano QWERTY

### Requirement: Tastiera classica ANSI e ISO
Il sistema SHALL descrivere la tastiera classica sfalsata con riga dei numeri,
tre righe di lettere, spazio, Shift sinistro e destro e AltGr; nel formato ISO
SHALL aggiungere il tasto tra Shift sinistro e la prima lettera della riga
inferiore e il tasto accanto all'Invio a L.

#### Scenario: Tasto ISO in più
- **WHEN** con il profilo classica ISO + Italiano QWERTY si risolve `<`
- **THEN** il risultato è un accordo sul tasto tra Shift sinistro e `z`, battuto dal mignolo sinistro

#### Scenario: Carattere solo ISO in ANSI
- **WHEN** con il profilo classica ANSI + Italiano QWERTY si risolve `<`
- **THEN** il modello lo segnala come non digitabile

### Requirement: Maiuscole e AltGr sulla tastiera classica
Sulla tastiera classica il sistema SHALL risolvere i caratteri con Shift
tenendo lo Shift della mano opposta a quella che batte il tasto, e i caratteri
con AltGr tenendo AltGr con il pollice destro.

#### Scenario: Maiuscola
- **WHEN** con il profilo classica ANSI + US QWERTY si risolve `A`
- **THEN** l'accordo tiene lo Shift destro (mignolo destro) e batte `a` col mignolo sinistro

#### Scenario: Chiocciola in italiano
- **WHEN** con il profilo classica ISO + Italiano QWERTY si risolve `@`
- **THEN** l'accordo tiene AltGr col pollice destro e batte il tasto `ò` con il mignolo destro

### Requirement: Mappe dei sistemi operativi
Il sistema SHALL tradurre i keycode in caratteri con la mappa del layout: US
(con o senza tasti morti), italiana come su Linux e Windows (accentate sui tasti
dedicati, `é` con Shift, AltGr per `@ # [ ] { }`), Colemak-DH sulla tastiera
classica (variante ANSI/ISO con angle mod), Colemak-DH di Miryoku su clavis.

#### Scenario: Accentate italiane dirette
- **WHEN** con il profilo classica ISO + Italiano QWERTY si risolvono `à`, `ò`, `ù`, `ì`, `é`
- **THEN** ciascuna è un solo accordo, e `é` tiene lo Shift della mano sinistra

#### Scenario: Colemak-DH sulla tastiera classica
- **WHEN** con il profilo classica ANSI + Colemak-DH si risolvono `t` e `d`
- **THEN** `t` è sull'indice sinistro della riga base e `d` sull'indice sinistro della riga inferiore

### Requirement: Caratteri non raggiungibili nel profilo
Il sistema SHALL elencare, per il profilo attivo e la lingua degli esercizi, i
caratteri della lingua che il profilo non sa produrre, e SHALL mostrarli
all'utente quando sceglie il profilo.

#### Scenario: Maiuscola accentata in italiano
- **WHEN** l'utente sceglie classica ISO + Italiano QWERTY con esercizi in italiano
- **THEN** il sistema avvisa che `È` non è digitabile con quel profilo e gli esercizi non la contengono
