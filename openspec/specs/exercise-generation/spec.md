# exercise-generation Specification

## Purpose
Costruisce il testo da digitare a partire da un corpus italiano reale, dai
punti deboli dell'utente o da un testo incollato, usando solo caratteri che la
tastiera clavis sa produrre.

## Requirements

### Requirement: Corpus italiano incluso
Il sistema SHALL includere, utilizzabili senza connessione, per l'italiano e
per l'inglese una lista delle parole più frequenti (almeno 5.000) e una
raccolta di frasi reali (almeno 2.000), con attribuzione e licenza delle fonti
visibili nell'applicazione.

#### Scenario: Uso offline
- **WHEN** l'applicazione è aperta senza connessione di rete
- **THEN** tutte le modalità di esercizio funzionano in entrambe le lingue

#### Scenario: Attribuzione
- **WHEN** l'utente apre la sezione informazioni
- **THEN** vede le fonti dei corpus italiano e inglese e le rispettive licenze

### Requirement: Modalità adattiva
Nella modalità adattiva il sistema SHALL comporre una sequenza di parole
italiane in cui circa il 70% contiene almeno una delle unità più deboli, con
probabilità proporzionale al loro punteggio, e il resto è scelto per
frequenza d'uso.

#### Scenario: Insistenza su un bigramma debole
- **WHEN** il bigramma più debole è `gl`
- **THEN** il testo generato contiene parole come `gli`, `figlio`, `meglio` più spesso di quanto accadrebbe scegliendo solo per frequenza

#### Scenario: Nessun dato
- **WHEN** l'utente non ha ancora fatto nessuna sessione
- **THEN** il testo è composto da parole frequenti scelte casualmente

### Requirement: Punteggiatura, maiuscole e cifre nella modalità adattiva
Nella modalità adattiva il sistema SHALL inserire maiuscole, punteggiatura e
cifre in proporzione regolabile dall'utente, così da esercitare home row mod
e layer anche partendo da singole parole.

#### Scenario: Transizione di layer debole
- **WHEN** la transizione BASE→NUM è tra le unità più deboli e le cifre sono abilitate
- **THEN** il testo contiene numeri inseriti tra le parole

#### Scenario: Solo minuscole
- **WHEN** l'utente disattiva maiuscole, punteggiatura e cifre
- **THEN** il testo contiene solo lettere minuscole, lettere accentate e spazi

### Requirement: Modalità frasi
Nella modalità frasi il sistema SHALL proporre frasi italiane reali del
corpus, preferendo quelle che contengono le unità più deboli.

#### Scenario: Frase con accenti
- **WHEN** le sequenze con tasto morto sono tra le unità più deboli
- **THEN** le frasi proposte contengono più lettere accentate e apostrofi della media del corpus

### Requirement: Testo libero
Il sistema SHALL permettere di incollare un testo qualsiasi da digitare,
normalizzando spazi e a capo, sostituendo le varianti tipografiche comuni
(virgolette curve, apostrofo tipografico, trattini lunghi, puntini di
sospensione) con i caratteri digitabili equivalenti e togliendo i caratteri
che il profilo attivo non sa produrre.

#### Scenario: Apostrofo tipografico
- **WHEN** il testo incollato contiene `l’acqua` con apostrofo curvo
- **THEN** il testo da digitare diventa `l'acqua`

#### Scenario: Caratteri non digitabili
- **WHEN** il testo incollato contiene `€` o emoji
- **THEN** il sistema li rimuove e avvisa l'utente di quanti caratteri sono stati tolti

#### Scenario: Dipende dal profilo
- **WHEN** con il profilo classica ANSI + Italiano QWERTY il testo incollato contiene `a < b`
- **THEN** il `<` viene tolto perché il formato ANSI non ha il tasto ISO in più

### Requirement: Solo caratteri digitabili
Il sistema SHALL generare testi composti esclusivamente da caratteri che il
modello della tastiera sa risolvere, scartando parole e frasi che ne
contengono altri.

#### Scenario: Parola con carattere non supportato
- **WHEN** il corpus contiene una parola con un carattere non risolvibile
- **THEN** quella parola non compare mai in un esercizio

### Requirement: Lingua degli esercizi
Il sistema SHALL permettere di scegliere la lingua degli esercizi (italiano o
inglese) indipendentemente dalla lingua dell'interfaccia; al primo avvio è
uguale alla lingua dell'interfaccia. Modalità adattiva e frasi usano il corpus
di quella lingua.

#### Scenario: Esercizi in inglese
- **WHEN** l'utente sceglie gli esercizi in inglese e avvia una sessione adattiva
- **THEN** il testo è composto da parole inglesi del corpus

#### Scenario: Interfaccia e esercizi diversi
- **WHEN** l'interfaccia è in italiano e la lingua degli esercizi è inglese
- **THEN** i testi dell'interfaccia restano in italiano e le frasi da digitare sono inglesi
