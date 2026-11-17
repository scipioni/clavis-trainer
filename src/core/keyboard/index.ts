import keymapJson from './clavis.keymap.json';
import { Resolver, type ResolveOptions, DEFAULT_RESOLVE_OPTIONS } from './resolver';
import { classicBoard, clavisBoard, type Board } from './boards';
import { OS_MAPS, type OsMap } from './osmaps';
import { DEFAULT_PROFILE, profileId, type Keymap, type Profile } from './types';

export * from './types';
export * from './geometry';
export * from './resolver';
export * from './deadKeys';
export * from './boards';
export * from './osmaps';

export const clavisKeymap = keymapJson as Keymap;

const boards = new Map<string, Board>();
const resolvers = new Map<string, Resolver>();

/** Tastiera fisica del profilo (con la diteggiatura del layout, es. angle mod). */
export function boardFor(p: Profile): Board {
  const id = profileId(p);
  let b = boards.get(id);
  if (!b) {
    b = p.keyboard === 'clavis' ? clavisBoard(clavisKeymap, p.layout) : classicBoard(p.keyboard, p.layout);
    boards.set(id, b);
  }
  return b;
}

/** Mappa del sistema operativo: su clavis Colemak-DH e QWERTY stanno nel firmware, il sistema è US. */
export function osMapFor(p: Profile): OsMap {
  if (p.layout === 'it') return OS_MAPS.it;
  if (p.layout === 'colemakdh' && p.keyboard !== 'clavis') return OS_MAPS[p.keyboard === 'iso' ? 'colemakdh-iso' : 'colemakdh-ansi'];
  return OS_MAPS.us;
}

/** Risolutore condiviso per profilo e opzioni. */
export function resolverFor(p: Profile, options: ResolveOptions = DEFAULT_RESOLVE_OPTIONS): Resolver {
  const key = `${profileId(p)}|${options.deadKeys}`;
  let r = resolvers.get(key);
  if (!r) {
    r = new Resolver(boardFor(p), osMapFor(p), options);
    resolvers.set(key, r);
  }
  return r;
}

/** Risolutore del profilo predefinito (clavis + Colemak-DH). */
export function clavisResolver(options: ResolveOptions = DEFAULT_RESOLVE_OPTIONS): Resolver {
  return resolverFor(DEFAULT_PROFILE, options);
}
