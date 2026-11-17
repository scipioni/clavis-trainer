/** Lingue degli esercizi e i caratteri che i loro testi possono contenere. */
export type Lang = 'it' | 'en';
export const LANGS: Lang[] = ['it', 'en'];

const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const PUNCT = ".,;:?!'\"()-";

/** Alfabeto di ogni lingua: lettere (anche maiuscole), cifre, punteggiatura e spazio. */
export const ALPHABET: Record<Lang, string> = {
  it: LOWER + LOWER.toUpperCase() + 'àèéìòùÀÈÉÌÒÙ' + DIGITS + PUNCT + ' ',
  en: LOWER + LOWER.toUpperCase() + DIGITS + PUNCT + ' ',
};

export function isLang(x: unknown): x is Lang {
  return x === 'it' || x === 'en';
}
