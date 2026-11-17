/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

/** Hash del contenuto del corpus di ogni lingua: entra negli URL, così la cache si invalida solo se cambia. */
function corpusVersion(lang: string): string {
  const h = createHash('sha256');
  for (const f of ['words.json', 'sentences.json']) h.update(readFileSync(`public/corpus/${lang}/${f}`));
  return h.digest('hex').slice(0, 12);
}

export default defineConfig({
  base: './',
  plugins: [svelte()],
  // in sviluppo l'API gira a parte: bun run server (porta 8080)
  server: { proxy: { '/api': 'http://localhost:8080' } },
  define: {
    __CORPUS_VERSION__: JSON.stringify({ it: corpusVersion('it'), en: corpusVersion('en') }),
  },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
});
