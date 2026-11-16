import keymapJson from './clavis.keymap.json';
import { Resolver, type ResolveOptions, DEFAULT_RESOLVE_OPTIONS } from './resolver';
import type { Keymap } from './types';

export * from './types';
export * from './geometry';
export * from './resolver';
export * from './deadKeys';

export const clavisKeymap = keymapJson as Keymap;

const resolvers = new Map<boolean, Resolver>();

/** Risolutore condiviso per la keymap di clavis. */
export function clavisResolver(options: ResolveOptions = DEFAULT_RESOLVE_OPTIONS): Resolver {
  let r = resolvers.get(options.deadKeys);
  if (!r) {
    r = new Resolver(clavisKeymap, options);
    resolvers.set(options.deadKeys, r);
  }
  return r;
}
