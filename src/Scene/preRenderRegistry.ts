/**
 * Registry of per-frame callbacks, keyed by a stable id.
 *
 * Deliberately dependency-free (no three.js) so it can be unit-tested under
 * `node --experimental-strip-types --test`.
 *
 * It replaces an object literal that was duplicated across `commonSceneMethod` and
 * `copperMScene` and carried three bugs, one of which silently corrupted callers:
 *
 *  1. `index` was never incremented, so `addPreRenderCallbackFunction` always returned 0.
 *     Callers who stored that value and later removed it deleted somebody else's callback.
 *  2. `add` guarded with `if (!fn.id)`, and the very first id was 0 — falsy — so the first
 *     callback looked unregistered forever and could be added twice.
 *  3. `remove(id)` spliced `cache` at the raw id, treating the id as an array index. Removing
 *     one callback shifted every later one down, so every previously handed-out id then
 *     pointed at its neighbour.
 *
 * Here ids come from a monotonic counter, are never reused, and are held in an array parallel
 * to `cache` — so a removal cannot invalidate anyone else's id.
 */

export interface PreRenderRegistry {
  /** Monotonic counter for the next id. NOT an index into `cache`. */
  index: number;
  /** Callbacks, in insertion order. Consumers iterate this each frame. */
  cache: Function[];
  /** Ids, parallel to `cache`. Stable across removals. */
  ids: number[];
  /** Registers `fn` and returns its id. Idempotent: re-adding returns the existing id. */
  add: (fn: Function) => number;
  /** Removes the callback with this id. A no-op for an unknown id. */
  remove: (id: number) => void;
}

export function createPreRenderRegistry(): PreRenderRegistry {
  return {
    index: 0,
    cache: [],
    ids: [],
    add(fn: Function): number {
      const existing = this.cache.indexOf(fn);
      if (existing !== -1) return this.ids[existing];
      const id = this.index++;
      this.cache.push(fn);
      this.ids.push(id);
      return id;
    },
    remove(id: number): void {
      const at = this.ids.indexOf(id);
      if (at === -1) return;
      this.cache.splice(at, 1);
      this.ids.splice(at, 1);
    },
  };
}
