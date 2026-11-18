<script lang="ts">
  import { t } from '../i18n/index.svelte';
</script>

<section class="about">
  <h2>clavis-trainer</h2>
  <p>
    {t('about.intro')}
    <a href="https://github.com/scipioni/clavis" target="_blank" rel="noreferrer">github.com/scipioni/clavis</a>
  </p>
  <p>{t('about.privacy')}</p>

  <h3>{t('about.how')}</h3>
  <ul>
    <li>{t('about.guide')}</li>
    <li>{t('about.how1')}</li>
    <li>{t('about.how2')}</li>
    <li>{t('about.how3')}</li>
    <li>{t('about.how4')}</li>
    <li>{t('about.windows')}</li>
  </ul>

  <h3>{t('about.sources')}</h3>
  <ul>
    {#each ['it', 'en'] as const as l (l)}
      <li>{t('about.words', t(`lang.${l}`))}</li>
      <li>{t('about.sentences', t(`lang.${l}`))}</li>
    {/each}
    <li>
      <a href="https://github.com/hermitdave/FrequencyWords" target="_blank" rel="noreferrer">FrequencyWords</a> ·
      <a href="https://tatoeba.org" target="_blank" rel="noreferrer">Tatoeba</a> ·
      <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a> ·
      <a href="https://creativecommons.org/licenses/by/2.0/fr/" target="_blank" rel="noreferrer">CC BY 2.0 FR</a>
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
