<script lang="ts">
  // componente statico
</script>

<section class="about">
  <h2>clavis-trainer</h2>
  <p>
    Trainer di digitazione per la tastiera split
    <a href="https://github.com/scipioni/clavis" target="_blank" rel="noreferrer">clavis</a>
    (36 tasti, Miryoku Colemak-DH con home row mods), con il sistema in US International a tasti morti.
    Tutto resta in questo browser: nessun dato viene inviato altrove.
  </p>

  <h3>Come funziona</h3>
  <ul>
    <li>Il cursore avanza solo col carattere giusto; gli errori restano segnati.</li>
    <li>Per ogni carattere si misura il tempo dal carattere precedente. Dopo 5 secondi senza digitare la sessione va in pausa.</li>
    <li>Ctrl, Alt o Meta premuti durante la sessione contano come <em>mod involontari</em>: di solito un roll troppo veloce sugli home row mods.</li>
    <li>Le statistiche per carattere, bigramma, transizione di layer, tasto morto e dito decidono cosa proporre negli esercizi adattivi.</li>
  </ul>

  <h3>Fonti del corpus</h3>
  <ul>
    <li>
      Parole: <a href="https://github.com/hermitdave/FrequencyWords" target="_blank" rel="noreferrer">FrequencyWords</a>
      di Hermit Dave (lista <code>it_50k</code>, 2018, da OpenSubtitles), licenza
      <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a>.
      Prime 10.000 parole in minuscolo, con alcune escluse.
    </li>
    <li>
      Frasi: <a href="https://tatoeba.org" target="_blank" rel="noreferrer">Tatoeba</a>, frasi in italiano, licenza
      <a href="https://creativecommons.org/licenses/by/2.0/fr/" target="_blank" rel="noreferrer">CC BY 2.0 FR</a>.
      Campione di 5.000 frasi normalizzate.
    </li>
  </ul>
</section>

<style>
  .about {
    max-width: 44rem;
  }
  h2 {
    margin-top: 0;
  }
</style>
