# Spec Delta

## Purpose

Costruisce il testo da digitare a partire da un corpus italiano reale, dai
punti deboli dell'utente o da un testo incollato, usando solo caratteri che la
tastiera clavis sa produrre.

## ADDED Requirements

### Requirement: Corpus italiano incluso
Il sistema SHALL includere, utilizzabili senza connessione, una lista delle
parole italiane più frequenti (almeno 5.000) e una raccolta di frasi italiane
reali (almeno 2.000), con attribuzione e licenza delle fonti visibili
nell'applicazione.

#### Scenario: Uso offline
- **WHEN** l'applicazione è aperta senza connessione di rete
- **THEN** tutte le modalità di esercizio funzionano

#### Scenario: Attribuzione
- **WHEN** l'utente apre la sezione informazioni
- **THEN** vede le fonti del corpus e le rispettive licenze

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
normalizzando spazi e a capo e sostituendo le varianti tipografiche comuni
(virgolette curve, apostrofo tipografico, trattini lunghi, puntini di
sospensione) con i caratteri digitabili equivalenti.

#### Scenario: Apostrofo tipografico
- **WHEN** il testo incollato contiene `l’acqua` con apostrofo curvo
- **THEN** il testo da digitare diventa `l'acqua`

#### Scenario: Caratteri non digitabili
- **WHEN** il testo incollato contiene `€` o emoji
- **THEN** il sistema li rimuove e avvisa l'utente di quanti caratteri sono stati tolti

### Requirement: Solo caratteri digitabili
Il sistema SHALL generare testi composti esclusivamente da caratteri che il
modello della tastiera sa risolvere, scartando parole e frasi che ne
contengono altri.

#### Scenario: Parola con carattere non supportato
- **WHEN** il corpus contiene una parola con un carattere non risolvibile
- **THEN** quella parola non compare mai in un esercizio
