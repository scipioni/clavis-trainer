import type { Resolver } from '../keyboard/resolver';

const REPLACEMENTS: [RegExp, string][] = [
  [/[’‘‚‛′ʼ]/g, "'"],
  [/[“”„‟″«»]/g, '"'],
  [/[‐‑‒–—―−]/g, '-'],
  [/…/g, '...'],
  [/[\s\u00a0\u1680\u2000-\u200b\u202f\u205f\u3000\ufeff]+/g, ' '],
];

export interface NormalizeResult {
  text: string;
  /** Caratteri tolti perché non digitabili su clavis. */
  removed: number;
}

/**
 * Prepara un testo qualsiasi per la digitazione: varianti tipografiche →
 * caratteri digitabili, spazi e a capo → uno spazio, rimozione dei caratteri
 * che la tastiera non sa produrre.
 */
export function normalizeText(input: string, resolver: Resolver): NormalizeResult {
  let text = input.normalize('NFC');
  for (const [re, rep] of REPLACEMENTS) text = text.replace(re, rep);
  let removed = 0;
  let out = '';
  for (const c of text) {
    if (resolver.canType(c)) out += c;
    else removed++;
  }
  return { text: out.replace(/ {2,}/g, ' ').trim(), removed };
}
