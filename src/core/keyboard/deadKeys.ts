/**
 * Tasti morti di US International (XKB "us intl") e composizioni. Se le
 * composizioni del sistema sono diverse, è l'unico file da adattare.
 */
export const DEAD_KEYS = ["'", '"', '`', '~', '^'] as const;
export type DeadKey = (typeof DEAD_KEYS)[number];

const BASE_COMPOSE: Record<DeadKey, Record<string, string>> = {
  "'": { a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', y: 'ý', c: 'ç' },
  '`': { a: 'à', e: 'è', i: 'ì', o: 'ò', u: 'ù' },
  '"': { a: 'ä', e: 'ë', i: 'ï', o: 'ö', u: 'ü', y: 'ÿ' },
  '~': { a: 'ã', o: 'õ', n: 'ñ' },
  '^': { a: 'â', e: 'ê', i: 'î', o: 'ô', u: 'û' },
};

/** dead → lettera → carattere composto, maiuscole comprese. */
export const COMPOSE: Record<DeadKey, Record<string, string>> = Object.fromEntries(
  DEAD_KEYS.map((d) => {
    const table: Record<string, string> = {};
    for (const [letter, out] of Object.entries(BASE_COMPOSE[d])) {
      table[letter] = out;
      table[letter.toUpperCase()] = out.toUpperCase();
    }
    return [d, table];
  }),
) as Record<DeadKey, Record<string, string>>;

/** Carattere composto → [tasto morto, lettera]. */
export const DECOMPOSE: Record<string, [DeadKey, string]> = {};
for (const d of DEAD_KEYS) {
  for (const [letter, out] of Object.entries(COMPOSE[d])) DECOMPOSE[out] = [d, letter];
}

export function isDeadKey(c: string): c is DeadKey {
  return (DEAD_KEYS as readonly string[]).includes(c);
}
