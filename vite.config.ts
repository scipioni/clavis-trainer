/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

/** Hash del contenuto del corpus: entra negli URL, così la cache si invalida solo se cambia. */
function corpusVersion(): string {
  const h = createHash('sha256');
  for (const f of ['words.json', 'sentences.json']) h.update(readFileSync(`public/corpus/${f}`));
  return h.digest('hex').slice(0, 12);
}

export default defineConfig({
  base: './',
  plugins: [svelte()],
  define: {
    __CORPUS_VERSION__: JSON.stringify(corpusVersion()),
  },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
});
