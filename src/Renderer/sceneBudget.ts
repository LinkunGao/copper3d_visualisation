/**
 * How much decoded scene data may stay resident, as a byte budget with LRU
 * eviction and pinning.
 *
 * Bytes rather than a scene count, because a count is not the thing at risk:
 * an NRRD volume can be 51KB or 53MB on disk and decodes to a typed array
 * larger still, so "three scenes" is anywhere from 150KB to 250MB.
 *
 * Whatever is on screen should be pinned and is never a victim, however far
 * over the limit that puts the total. Blanking a view the reader is looking
 * at is strictly worse than the memory it saves -- and with several viewports
 * sharing one renderer, more than one scene is visible at a time.
 */

const MB = 1024 * 1024

/** Roomy devices get this. */
const FULL_BUDGET = 500 * MB
/** Low-memory devices, and any browser that will not say, get this. */
const CONSERVATIVE_BUDGET = 250 * MB
/** `navigator.deviceMemory` in GiB, at or above which the full budget applies. */
const ROOMY_DEVICE_GIB = 8

export interface SceneBudget {
  /** Records (or re-records) a resident scene's decoded size and marks it
   *  most-recently-used. */
  register: (key: string, bytes: number) => void
  /** Marks an already-registered scene most-recently-used. No-op if absent. */
  touch: (key: string) => void
  /** Protects a scene from eviction while it is on screen. */
  pin: (key: string) => void
  unpin: (key: string) => void
  /** Forgets a scene entirely. Call after its GPU resources are freed. */
  release: (key: string) => void
  /** Carries bytes, queue position and pin state to a new key, for callers
   *  that rename a scene in place. */
  rename: (from: string, to: string) => void
  /** Keys to evict, least-recently-used first, never pinned. Empty when the
   *  total is within budget or nothing evictable is left. */
  overflow: () => string[]
  bytes: () => number
}

/**
 * `deviceMemory` is a Chromium-only hint in GiB, absent in Safari and every
 * iOS browser. Absent must mean the SMALL budget: an iPad is both the device
 * that omits the API and the one most likely to have its tab killed for using
 * too much.
 */
export function defaultBudgetBytes(deviceMemoryGiB?: number): number {
  return typeof deviceMemoryGiB === 'number' && deviceMemoryGiB >= ROOMY_DEVICE_GIB
    ? FULL_BUDGET
    : CONSERVATIVE_BUDGET
}

export function createSceneBudget(limitBytes: number): SceneBudget {
  /** Insertion order is LRU order: Map preserves it, and re-inserting a key
   *  after deleting it moves it to the back. */
  const sizes = new Map<string, number>()
  const pinned = new Set<string>()

  function total(): number {
    let sum = 0
    for (const bytes of sizes.values()) sum += bytes
    return sum
  }

  return {
    register(key, bytes) {
      sizes.delete(key)
      sizes.set(key, bytes)
    },
    touch(key) {
      const bytes = sizes.get(key)
      if (bytes === undefined) return
      sizes.delete(key)
      sizes.set(key, bytes)
    },
    pin(key) { pinned.add(key) },
    unpin(key) { pinned.delete(key) },
    release(key) {
      sizes.delete(key)
      pinned.delete(key)
    },
    rename(from, to) {
      const bytes = sizes.get(from)
      if (bytes === undefined) return
      sizes.delete(from)
      sizes.set(to, bytes)
      if (pinned.delete(from)) pinned.add(to)
    },
    overflow() {
      const victims: string[] = []
      let remaining = total()
      for (const [key, bytes] of sizes) {
        if (remaining <= limitBytes) break
        if (pinned.has(key)) continue
        victims.push(key)
        remaining -= bytes
      }
      return victims
    },
    bytes: total,
  }
}
