# Spec Delta

## MODIFIED Requirements

### Requirement: Keymap ricavata dal firmware
Per la tastiera clavis il sistema SHALL usare come fonte di tutti i layer
(BASE, NAV, MOUSE, MEDIA, SYM, NUM, FUN, BUTTON) la keymap ZMK di
`scipioni/clavis`, convertita in dati versionati che registrano per ogni
posizione il keycode, il comportamento in pressione o l'azione senza testo;
con il layout QWERTY la base è quella QWERTY di Miryoku con gli stessi home row
mod. La risoluzione dei caratteri usa solo i layer BASE, NUM e SYM.

#### Scenario: Rigenerazione dalla keymap
- **WHEN** si esegue la conversione sul file `custom_config.h` attuale
- **THEN** con il sistema in US i dati producono `q w f p b j l u y ;` come riga superiore del layer BASE e `[ 7 8 9 ]` sul lato sinistro della riga superiore del layer NUM

#### Scenario: Keymap modificata
- **WHEN** nel firmware due tasti del layer BASE vengono scambiati e si rigenera
- **THEN** la risoluzione dei caratteri interessati riflette le nuove posizioni

#### Scenario: Base QWERTY
- **WHEN** il profilo è clavis + US QWERTY
- **THEN** la riga superiore del layer BASE è `q w e r t y u i o p` e i layer NUM e SYM restano quelli del firmware

#### Scenario: Layer senza testo
- **WHEN** si esegue la conversione sul file `custom_config.h` attuale
- **THEN** i dati contengono 8 layer da 40 posizioni, e il layer NAV ha le frecce sinistra, giù, su, destra sulla riga base della mano destra

#### Scenario: Risoluzione invariata
- **WHEN** con il profilo clavis + Colemak-DH si risolve `7`, presente anche nel tastierino del layer MEDIA
- **THEN** il risultato è un accordo sul layer NUM, come prima della conversione estesa
