import { describe, expect, it } from 'vitest'
import { collectFadeTargets, restoreFade, setFade } from '../Utils/modelCrossfade'

function material(opacity = 1, depthWrite = true, transparent = false) {
  return { opacity, transparent, depthWrite }
}

function mesh(...materials: ReturnType<typeof material>[]) {
  const m = {
    isMesh: true,
    material: materials.length === 1 ? materials[0] : materials,
    traverse(fn: (child: any) => void) { fn(m) },
  }
  return m
}

describe('modelCrossfade', () => {
  it('scales opacity relative to what the material already had', () => {
    // The point of scaling rather than assigning: a 40% translucent layer
    // must not end the fade fully opaque.
    const translucent = material(0.4)
    const targets = collectFadeTargets(mesh(translucent))

    setFade(targets, 0.5)
    expect(translucent.opacity).toBeCloseTo(0.2)

    setFade(targets, 1)
    expect(translucent.opacity).toBeCloseTo(0.4)
  })

  /** A partially transparent mesh that still writes depth occludes whatever
   *  is drawn behind it, so the outgoing model punches holes in the incoming
   *  one for the whole fade. */
  it('suppresses depthWrite until the fade is fully opaque', () => {
    const opaque = material(1)
    const targets = collectFadeTargets(mesh(opaque))

    setFade(targets, 0.99)
    expect(opaque.depthWrite).toBe(false)

    setFade(targets, 1)
    expect(opaque.depthWrite).toBe(true)
  })

  it('never re-enables depthWrite on a material that never had it', () => {
    const shell = material(0.4, false)
    const targets = collectFadeTargets(mesh(shell))
    setFade(targets, 1)
    expect(shell.depthWrite).toBe(false)
  })

  it('restores every captured property exactly', () => {
    const shell = material(0.4, false, true)
    const targets = collectFadeTargets(mesh(shell))
    setFade(targets, 0.3)
    restoreFade(targets)
    expect(shell).toEqual({ opacity: 0.4, transparent: true, depthWrite: false })
  })

  it('collects every material of a multi-material mesh', () => {
    expect(collectFadeTargets(mesh(material(1), material(0.5)))).toHaveLength(2)
  })
})
