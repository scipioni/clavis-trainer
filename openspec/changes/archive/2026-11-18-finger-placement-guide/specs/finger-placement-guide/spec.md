# Spec Delta

## Purpose

Spiega con una guida visiva a passi dove appoggiare le dita e quale dito
batte ogni tasto, su clavis e sulla tastiera classica, prima di allenarsi e
ogni volta che l'utente vuole ripassarlo.

## ADDED Requirements

### Requirement: Due versioni della guida
Il sistema SHALL offrire due versioni della guida, una per clavis e una per
la tastiera classica (ANSI e ISO). Per la tastiera classica SHALL disegnare
il formato del profilo attivo; se il profilo è su clavis, ISO con il layout
italiano e ANSI con gli altri.

#### Scenario: Profilo su tastiera classica
- **WHEN** il profilo attivo è tastiera ISO + Italiano QWERTY e l'utente apre la guida
- **THEN** si apre la guida della tastiera classica, con la tastiera ISO disegnata

#### Scenario: Profilo su clavis
- **WHEN** il profilo attivo è clavis + Colemak-DH e l'utente apre la guida
- **THEN** si apre la guida di clavis, con i 34 tasti di clavis disegnati

### Requirement: Lettere del layout del profilo
La guida SHALL mostrare sui tasti i caratteri del layout del profilo attivo
e SHALL dedurre mano e dito di ogni tasto dalla tastiera disegnata, compreso
l'angle mod di Colemak-DH sulla tastiera classica.

#### Scenario: Posizione base in Colemak-DH
- **WHEN** il profilo è tastiera ANSI + Colemak-DH e la guida mostra la posizione base
- **THEN** i polpastrelli sinistri sono su A R S T e quelli destri su N E I O

#### Scenario: Posizione base in QWERTY
- **WHEN** il profilo è tastiera ANSI + US QWERTY e la guida mostra la posizione base
- **THEN** i polpastrelli sinistri sono su A S D F e quelli destri su J K L ;

#### Scenario: Angle mod
- **WHEN** il profilo è tastiera ANSI + Colemak-DH e la guida mostra la zona dell'anulare sinistro
- **THEN** la zona comprende il primo tasto lettera della riga inferiore, che con US QWERTY è invece nella zona del mignolo

### Requirement: Passi della guida di clavis
La guida di clavis SHALL avere, in quest'ordine, i passi: benvenuto, le due
metà, posizione base, colonne e dita, pollici, tenere premuto, pronto.

#### Scenario: Tenere premuto
- **WHEN** l'utente arriva al passo "tenere premuto" della guida di clavis
- **THEN** il passo spiega che tenendo premuti i tasti della riga centrale si ottengono i modificatori (Shift con la mano opposta) e che tenendo premuti i pollici si passa ai layer NUM e SYM, e mostra la tastiera di quei layer

#### Scenario: Pollici
- **WHEN** l'utente arriva al passo "pollici" della guida di clavis
- **THEN** sono evidenziati i tre tasti di ogni pollice

### Requirement: Passi della guida della tastiera classica
La guida della tastiera classica SHALL avere, in quest'ordine, i passi:
benvenuto, tacche su F e J, posizione base, zone delle dita, pollici e
Shift, pronto.

#### Scenario: Tacche
- **WHEN** l'utente arriva al passo delle tacche
- **THEN** sono evidenziati i due tasti con il rilievo e il passo spiega che gli indici li trovano senza guardare

#### Scenario: Shift della mano opposta
- **WHEN** l'utente arriva al passo "pollici e Shift"
- **THEN** il passo mostra i pollici sullo spazio e una maiuscola della mano sinistra battuta tenendo lo Shift destro con il mignolo destro

### Requirement: Grafica per dito
La guida SHALL rappresentare ogni dito con un polpastrello, un cerchio con
il colore e la sigla del dito, e SHALL colorare con lo stesso colore la zona
dei tasti di quel dito. Le dita SHALL restare distinguibili anche senza il
colore, grazie alla sigla.

#### Scenario: Zone delle dita
- **WHEN** l'utente arriva al passo delle zone (o delle colonne su clavis)
- **THEN** ogni tasto battuto con le dita ha il colore del suo dito e il polpastrello del dito che si sta spiegando è in evidenza

### Requirement: Animazioni e movimento ridotto
La guida SHALL animare l'arrivo dei polpastrelli e il passaggio tra i passi.
Se il sistema chiede di ridurre il movimento, SHALL mostrare subito lo stato
finale di ogni passo, senza animazioni.

#### Scenario: Movimento ridotto
- **WHEN** il sistema operativo chiede di ridurre il movimento e l'utente apre la guida
- **THEN** i polpastrelli compaiono già al loro posto e i passi cambiano senza transizioni

### Requirement: Navigazione della guida
La guida SHALL aprirsi in un dialogo sopra l'app, con pulsanti Indietro e
Avanti e l'indicazione del passo. Freccia destra o Invio SHALL andare
avanti, freccia sinistra indietro, Esc o il pulsante di chiusura SHALL
chiudere la guida.

#### Scenario: Navigazione da tastiera
- **WHEN** la guida è aperta e l'utente preme freccia destra due volte e poi freccia sinistra
- **THEN** la guida è al secondo passo

#### Scenario: Ultimo passo
- **WHEN** l'utente preme Invio sul passo "pronto"
- **THEN** la guida si chiude e si torna all'allenamento

#### Scenario: Tasti non passati all'allenamento
- **WHEN** la guida è aperta sopra l'allenamento e l'utente preme dei tasti
- **THEN** nessuna sessione parte e nessun carattere viene registrato

### Requirement: Solo spiegazione
La guida SHALL limitarsi a spiegare: non SHALL contenere esercizi, né
registrare sessioni, né modificare statistiche o profilo.

#### Scenario: Guida completata
- **WHEN** l'utente percorre la guida fino alla fine
- **THEN** lo storico e le statistiche sono invariati e il profilo attivo è lo stesso

### Requirement: Scelta della versione nella guida
Al primo passo la guida SHALL permettere di passare alla versione dell'altra
tastiera, senza cambiare il profilo attivo.

#### Scenario: Guida classica da un profilo clavis
- **WHEN** il profilo è su clavis e l'utente, al primo passo della guida, sceglie la tastiera classica
- **THEN** prosegue la guida della tastiera classica e il profilo resta su clavis

### Requirement: Riapertura dalla navigazione
Il sistema SHALL offrire nella navigazione una voce "Guida" che apre la
guida della tastiera del profilo attivo, dal primo passo, in ogni momento
tranne durante una sessione in corso.

#### Scenario: Riapertura
- **WHEN** l'utente, che ha già visto la guida, sceglie "Guida" nella navigazione
- **THEN** si apre la guida della tastiera del profilo attivo, al primo passo

### Requirement: Apertura automatica una volta per tastiera
Il sistema SHALL aprire da solo la guida di un tipo di tastiera (clavis o
classica) quando il profilo attivo usa quel tipo e l'utente non ne ha ancora
vista la guida. SHALL considerare vista una versione quando l'utente la
chiude, in qualunque passo.

#### Scenario: Primo avvio
- **WHEN** un utente nuovo apre l'app
- **THEN** a caricamento finito si apre la guida della tastiera del profilo attivo

#### Scenario: Utente che usa già il sito
- **WHEN** un utente che ha già impostazioni salvate apre per la prima volta la versione con la guida
- **THEN** la guida si apre una volta, e alla riapertura dell'app non si apre più

#### Scenario: Chiusura anticipata
- **WHEN** l'utente chiude la guida al secondo passo e ricarica la pagina
- **THEN** la guida non si riapre da sola

#### Scenario: Passaggio a un'altra tastiera
- **WHEN** un utente che ha visto solo la guida di clavis cambia il profilo su tastiera ANSI
- **THEN** si apre la guida della tastiera classica

#### Scenario: Entrambe viste
- **WHEN** un utente che dalla guida ha visto sia la versione di clavis sia quella classica cambia tastiera
- **THEN** la guida non si apre

### Requirement: Momento dell'apertura automatica
L'apertura automatica SHALL aspettare che l'app abbia finito di caricarsi e
che non restino sessioni interrotte da recuperare o scartare, e non SHALL
avvenire durante una sessione in corso.

#### Scenario: Sessione interrotta in sospeso
- **WHEN** all'avvio c'è una sessione interrotta da recuperare e la guida non è ancora stata vista
- **THEN** la guida si apre solo dopo che l'utente ha recuperato o scartato la sessione

#### Scenario: Cambio di tastiera durante una sessione
- **WHEN** il profilo cambia tastiera mentre una sessione è in corso
- **THEN** la guida non interrompe la sessione e si apre solo dopo la sua fine

### Requirement: Guida nelle due lingue
La guida SHALL seguire la lingua dell'interfaccia, in italiano o in inglese,
e SHALL cambiare lingua subito se la lingua dell'interfaccia cambia.

#### Scenario: Guida in inglese
- **WHEN** l'interfaccia è in inglese e l'utente apre la guida
- **THEN** titoli, spiegazioni, pulsanti e sigle delle dita sono in inglese
