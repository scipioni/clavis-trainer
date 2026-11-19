/** Etichette tradotte dei tasti senza testo della mappa dei layer (`fn` della keymap). */
import { t } from '../i18n/index.svelte';
import type { Messages } from '../i18n/it';

type Key = keyof Messages;

/** Funzioni con un'etichetta fissa nel catalogo. */
const FN_KEYS = {
  'nav.home': 'ref.fn.nav.home',
  'nav.end': 'ref.fn.nav.end',
  'nav.pgUp': 'ref.fn.nav.pgUp',
  'nav.pgDn': 'ref.fn.nav.pgDn',
  'nav.ins': 'ref.fn.nav.ins',
  'clip.cut': 'ref.fn.clip.cut',
  'clip.copy': 'ref.fn.clip.copy',
  'clip.paste': 'ref.fn.clip.paste',
  'clip.undo': 'ref.fn.clip.undo',
  'clip.redo': 'ref.fn.clip.redo',
  'caps.word': 'ref.fn.caps.word',
  'media.volUp': 'ref.fn.media.volUp',
  'media.volDn': 'ref.fn.media.volDn',
  'media.mute': 'ref.fn.media.mute',
  'out.toggle': 'ref.fn.out.toggle',
  'rgb.toggle': 'ref.fn.rgb.toggle',
  'rgb.effect': 'ref.fn.rgb.effect',
  'rgb.hue': 'ref.fn.rgb.hue',
  'rgb.sat': 'ref.fn.rgb.sat',
  'rgb.bright': 'ref.fn.rgb.bright',
  'ep.toggle': 'ref.fn.ep.toggle',
  'fkey.pscrn': 'ref.fn.fkey.pscrn',
  'fkey.slck': 'ref.fn.fkey.slck',
  'fkey.pause': 'ref.fn.fkey.pause',
  'sys.boot': 'ref.fn.sys.boot',
} as const satisfies Record<string, Key>;

/** Simboli universali, uguali in tutte le lingue. */
const SYMBOLS: Record<string, string> = {
  left: '←',
  right: '→',
  up: '↑',
  down: '↓',
  'media.prev': '⏮',
  'media.next': '⏭',
  'media.stop': '⏹',
  'media.playPause': '⏯',
  'fkey.menu': '☰',
};

/** Etichetta di una funzione; `null` se la funzione non è conosciuta. Le righe sono separate da `\n`. */
export function fnLabel(fn: string): string | null {
  if (fn === 'none') return '';
  const [group, value] = fn.split('.');
  if (fn in FN_KEYS) return t(FN_KEYS[fn as keyof typeof FN_KEYS]);
  if (fn in SYMBOLS) return SYMBOLS[fn];
  switch (group) {
    case 'nav':
      return SYMBOLS[value] ?? null;
    case 'mouse':
      return SYMBOLS[value] ? `${t('ref.fn.mouse')}\n${SYMBOLS[value]}` : null;
    case 'wheel':
      return SYMBOLS[value] ? `${t('ref.fn.wheel')}\n${SYMBOLS[value]}` : null;
    case 'btn':
      return /^\d+$/.test(value) ? t('ref.fn.btn', Number(value)) : null;
    case 'fkey':
      return /^\d+$/.test(value) ? `F${value}` : null;
    case 'bt':
      return /^\d+$/.test(value) ? `BT ${value}` : null;
    case 'to':
      return `→ ${value}`;
    default:
      return null;
  }
}
