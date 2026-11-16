# typing-session Specification

## Purpose
Gestisce lo svolgimento di una sessione di digitazione: mostra il testo,
cattura ciò che l'utente scrive con tempi precisi, gestisce errori e tasti
morti, e produce il risultato della sessione e i dati grezzi per l'analisi.

## Requirements

### Requirement: Avvio e durata della sessione
Il sistema SHALL avviare la sessione al primo carattere digitato e terminarla
quando il testo è completato o quando scade la durata scelta (30, 60 o 120
secondi, oppure "fino alla fine del testo").

#### Scenario: Partenza al primo tasto
- **WHEN** la sessione è pronta e l'utente digita il primo carattere
- **THEN** il cronometro parte da quel momento, non da quando il testo è comparso

#### Scenario: Scadenza del tempo
- **WHEN** è scelta una durata di 60 secondi e trascorrono 60 secondi dall'avvio
- **THEN** la sessione termina e mostra il risultato

### Requirement: Avanzamento solo su carattere corretto
Il sistema SHALL avanzare al carattere successivo solo quando l'utente digita
il carattere atteso. Un carattere sbagliato viene registrato come errore sul
carattere atteso, segnalato visivamente, e non fa avanzare il cursore.

#### Scenario: Carattere sbagliato
- **WHEN** il carattere atteso è `e` e l'utente digita `r`
- **THEN** il cursore resta su `e`, il carattere è segnalato in errore e viene registrato un errore per `e` con il carattere ottenuto `r`

#### Scenario: Correzione
- **WHEN** dopo l'errore l'utente digita `e`
- **THEN** il cursore avanza e il tempo di `e` è misurato dalla pressione corretta del carattere precedente

### Requirement: Misura dei tempi per carattere
Per ogni carattere atteso il sistema SHALL registrare il tempo trascorso dal
completamento corretto del carattere precedente al completamento corretto di
questo, con risoluzione inferiore al millisecondo, e il numero di errori fatti
nel frattempo. Il primo carattere della sessione non ha tempo.

#### Scenario: Dati registrati
- **WHEN** l'utente digita correttamente `ci` con 180 ms tra `c` e `i`
- **THEN** per `i` è registrato il tempo 180 ms, zero errori e il carattere precedente `c`

### Requirement: Caratteri composti con tasti morti
Il sistema SHALL riconoscere come un unico carattere digitato il risultato
della composizione di un tasto morto (per esempio `è` da `` ` `` più `e`) e
non contare il tasto morto, da solo, come errore.

#### Scenario: Lettera accentata
- **WHEN** il carattere atteso è `è` e l'utente batte `` ` `` e poi `e`
- **THEN** il sistema registra `è` come corretto, con tempo misurato fino alla composizione

#### Scenario: Apostrofo composto per sbaglio
- **WHEN** il testo è `l'acqua`, il carattere atteso è `'` e l'utente batte `'` seguito da `a`, ottenendo `á`
- **THEN** il sistema registra un errore su `'` con carattere ottenuto `á` e lo classifica come errore da tasto morto

### Requirement: Rilevazione dei mod attivati involontariamente
Il sistema SHALL riconoscere come attivazione involontaria di un home row mod
ogni pressione con Ctrl, Alt o Meta attivi durante la sessione: la registra
legata al carattere atteso, non la conta come carattere digitato e, quando il
browser lo permette, ne blocca l'effetto.

#### Scenario: Ctrl involontario
- **WHEN** il carattere atteso è `t`, l'utente fa un roll `s`→`t` e il firmware invia Ctrl+T
- **THEN** il sistema registra un'attivazione involontaria di Ctrl su `t` e il cursore non avanza

#### Scenario: Protezione dell'uscita
- **WHEN** è in corso una sessione e una scorciatoia involontaria tenta di chiudere o lasciare la pagina
- **THEN** il browser chiede conferma prima di uscire e i dati della sessione fin lì sono già salvati

### Requirement: Tastiera clavis a schermo
Durante la sessione il sistema SHALL mostrare la tastiera clavis con il
layer necessario al prossimo carattere ed evidenziare il tasto da battere e i
tasti da tenere. L'utente può nascondere la tastiera.

#### Scenario: Prossimo carattere su layer
- **WHEN** il prossimo carattere è `(`
- **THEN** la tastiera mostra il layer SYM, evidenzia `(` sul lato sinistro e il tasto di layer SYM sul pollice destro come tasto da tenere

#### Scenario: Tastiera nascosta
- **WHEN** l'utente nasconde la tastiera
- **THEN** la tastiera non compare nelle sessioni successive finché non la riattiva

### Requirement: Pausa e interruzione
Il sistema SHALL mettere in pausa la sessione se l'utente non digita per più
di 5 secondi o se la pagina perde il focus, senza contare la pausa nei tempi.
La sessione si può abbandonare con Esc: una sessione abbandonata non viene
salvata.

#### Scenario: Pausa per inattività
- **WHEN** l'utente si ferma per 8 secondi e poi riprende
- **THEN** la pausa non entra nel tempo della sessione e il carattere successivo alla pausa non ha tempo

#### Scenario: Abbandono
- **WHEN** l'utente preme Esc durante una sessione
- **THEN** la sessione termina senza essere salvata e senza aggiornare le statistiche

### Requirement: Risultato della sessione
Alla fine il sistema SHALL mostrare WPM (5 caratteri = una parola, solo
caratteri corretti, al netto delle pause), precisione (caratteri corretti al
primo tentativo diviso caratteri attesi completati), numero di errori, attivazioni
involontarie dei mod e i caratteri e bigrammi più lenti della sessione.

#### Scenario: Calcolo WPM
- **WHEN** l'utente completa 300 caratteri in 60 secondi netti
- **THEN** il risultato riporta 60 WPM

#### Scenario: Calcolo precisione
- **WHEN** su 200 caratteri attesi 190 sono giusti al primo tentativo
- **THEN** il risultato riporta precisione 95%
