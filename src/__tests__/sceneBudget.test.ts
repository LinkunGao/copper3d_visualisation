import { describe, expect, it } from 'vitest'
import { createSceneBudget, defaultBudgetBytes } from '../Renderer/sceneBudget'

const MB = 1024 * 1024

describe('createSceneBudget', () => {
  it('reports nothing resident to start with', () => {
    const budget = createSceneBudget(100 * MB)
    expect(budget.bytes()).toBe(0)
    expect(budget.overflow()).toEqual([])
  })

  it('accumulates registered bytes', () => {
    const budget = createSceneBudget(100 * MB)
    budget.register('a', 30 * MB)
    budget.register('b', 20 * MB)
    expect(budget.bytes()).toBe(50 * MB)
  })

  it('re-registering a key replaces its size rather than adding to it', () => {
    const budget = createSceneBudget(100 * MB)
    budget.register('a', 30 * MB)
    budget.register('a', 10 * MB)
    expect(budget.bytes()).toBe(10 * MB)
  })

  it('names the least-recently-touched key once the limit is passed', () => {
    const budget = createSceneBudget(100 * MB)
    budget.register('a', 40 * MB)
    budget.register('b', 40 * MB)
    budget.register('c', 40 * MB)
    // 120MB registered against a 100MB limit; 'a' is oldest.
    expect(budget.overflow()).toEqual(['a'])
  })

  it('touch moves a key to the back of the queue', () => {
    const budget = createSceneBudget(100 * MB)
    budget.register('a', 40 * MB)
    budget.register('b', 40 * MB)
    budget.touch('a')
    budget.register('c', 40 * MB)
    expect(budget.overflow()).toEqual(['b'])
  })

  it('keeps naming victims until the total is back under the limit', () => {
    const budget = createSceneBudget(100 * MB)
    budget.register('a', 40 * MB)
    budget.register('b', 40 * MB)
    budget.register('c', 40 * MB)
    budget.register('d', 40 * MB)
    expect(budget.overflow()).toEqual(['a', 'b'])
  })

  /**
   * The one that matters when several viewports share a renderer: two or
   * three scenes are on screen at once, and no amount of memory pressure may
   * blank one of them.
   */
  it('never names a pinned key, even when it is the oldest', () => {
    const budget = createSceneBudget(100 * MB)
    budget.register('a', 40 * MB)
    budget.register('b', 40 * MB)
    budget.register('c', 40 * MB)
    budget.pin('a')
    expect(budget.overflow()).toEqual(['b'])
  })

  it('gives up rather than evicting pinned keys when nothing else is left', () => {
    const budget = createSceneBudget(50 * MB)
    budget.register('a', 40 * MB)
    budget.register('b', 40 * MB)
    budget.pin('a')
    budget.pin('b')
    expect(budget.overflow()).toEqual([])
  })

  it('unpin makes a key evictable again', () => {
    const budget = createSceneBudget(50 * MB)
    budget.register('a', 40 * MB)
    budget.register('b', 40 * MB)
    budget.pin('a')
    expect(budget.overflow()).toEqual(['b'])
    budget.unpin('a')
    budget.pin('b')
    expect(budget.overflow()).toEqual(['a'])
  })

  it('release removes a key and its bytes', () => {
    const budget = createSceneBudget(100 * MB)
    budget.register('a', 40 * MB)
    budget.release('a')
    expect(budget.bytes()).toBe(0)
    expect(budget.overflow()).toEqual([])
  })

  it('release and unpin are safe on keys that were never registered', () => {
    const budget = createSceneBudget(100 * MB)
    expect(() => { budget.release('nope'); budget.unpin('nope') }).not.toThrow()
  })

  it('renaming carries the bytes, the position and the pin across', () => {
    // For callers that swap a scene's content and rename it in place.
    const budget = createSceneBudget(100 * MB)
    budget.register('a', 40 * MB)
    budget.register('b', 40 * MB)
    budget.pin('a')
    budget.rename('a', 'a2')
    budget.register('c', 40 * MB)
    expect(budget.bytes()).toBe(120 * MB)
    expect(budget.overflow()).toEqual(['b'])
  })
})

describe('defaultBudgetBytes', () => {
  it('is conservative when the browser will not say how much memory it has', () => {
    // Safari and every iOS browser omit navigator.deviceMemory entirely,
    // and an iPad is the device most likely to be killed for using too
    // much -- so "unknown" must mean the small budget, not the large one.
    expect(defaultBudgetBytes(undefined)).toBe(250 * MB)
  })

  it('is conservative on a low-memory device', () => {
    expect(defaultBudgetBytes(4)).toBe(250 * MB)
  })

  it('allows the full budget on a roomy device', () => {
    expect(defaultBudgetBytes(8)).toBe(500 * MB)
    expect(defaultBudgetBytes(16)).toBe(500 * MB)
  })
})
