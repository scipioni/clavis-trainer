import { it, type Messages } from './it';
import { en } from './en';
import type { Lang } from '../core/exercise/languages';

const CATALOGS: Record<Lang, Messages> = { it, en };
const LOCALES: Record<Lang, string> = { it: 'it-IT', en: 'en-US' };

/** Lingua dell'interfaccia: `$state`, così i testi si aggiornano senza ricaricare. */
export const i18n = $state<{ lang: Lang }>({ lang: 'it' });

type Args<K extends keyof Messages> = Messages[K] extends (...a: infer A) => string ? A : [];

/** Testo tradotto; le voci con parametri sono funzioni nel catalogo. */
export function t<K extends keyof Messages>(key: K, ...args: Args<K>): string {
  const m = CATALOGS[i18n.lang][key] as string | ((...a: unknown[]) => string);
  return typeof m === 'function' ? m(...args) : m;
}

/** Lingua iniziale: italiano se il browser preferisce l'italiano, altrimenti inglese. */
export function detectLanguage(languages: readonly string[]): Lang {
  return languages[0]?.toLowerCase().startsWith('it') ? 'it' : 'en';
}

export const locale = () => LOCALES[i18n.lang];

export function fmtDate(t: number, opts: Intl.DateTimeFormatOptions): string {
  return new Date(t).toLocaleString(locale(), opts);
}

export function fmtPct(x: number, digits = 1): string {
  return new Intl.NumberFormat(locale(), { style: 'percent', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(x);
}

export function fmtNum(x: number, digits = 0): string {
  return new Intl.NumberFormat(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(x);
}
