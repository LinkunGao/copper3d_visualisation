import { describe, expect, it } from 'vitest'
import type { ExposureVolume } from '../Utils/volumeExposure'
import { exposureExponent } from '../Utils/volumeExposure'

/**
 * The property under test is both-ended: the tissue comes up AND nothing
 * clips. Every rejected attempt at this failed the second half -- a narrower
 * window lifts the tissue by throwing away the bright end, which on a
 * contrast-enhanced study is the lesion and the white box drawn over it.
 */

function volumeOf(data: number[]): ExposureVolume {
  return { data, min: Math.min(...data), max: Math.max(...data) }
}

/** The greyscale a voxel comes out as: the loader's linear window, then the
 *  exposure curve applied on top of it. */
function grey(v: ExposureVolume, value: number, exponent: number): number {
  const linear = Math.min(255, Math.max(0, Math.floor((value - v.min) * 255 / (v.max - v.min))))
  return Math.round(255 * (linear / 255) ** exponent)
}

/** A real volume's shape in miniature: a large block of air, a tissue band,
 *  and a 1% bright tail -- vessels, and the enhancing lesion. */
function realistic(airVoxels = 600) {
  return [
    ...Array.from({ length: airVoxels }, () => 0),
    ...Array.from({ length: 390 }, (_, i) => 100 + (i % 21)),
    ...Array.from({ length: 10 }, (_, i) => 130 + i * 52),
  ]
}
/** The median tissue voxel, which is what the exposure is anchored to. */
const TISSUE = 110
/** Halfway up the bright tail -- a lesion, not a noise spike. */
const LESION = 390

describe('exposureExponent', () => {
  it('lifts the tissue out of the shadows', () => {
    const v = volumeOf(realistic())
    expect(grey(v, TISSUE, 1)).toBeLessThan(55)

    const e = exposureExponent(v)
    expect(grey(v, TISSUE, e)).toBeGreaterThan(65)
    expect(grey(v, TISSUE, e)).toBeLessThan(85)
  })

  it('cannot clip, however far it lifts', () => {
    const data = realistic()
    const v = volumeOf(data)
    const e = exposureExponent(v)
    // The curve fixes both ends, so the only voxel that reaches white is the
    // one that was already white.
    expect(grey(v, v.max, e)).toBe(255)
    expect(data.filter(x => x < v.max && grey(v, x, e) >= 255)).toEqual([])
  })

  it('keeps the lesion clear of the white bounding box drawn over it', () => {
    const v = volumeOf(realistic())
    const e = exposureExponent(v)
    expect(grey(v, LESION, e)).toBeLessThan(240)
    expect(grey(v, LESION, e) - grey(v, TISSUE, e)).toBeGreaterThan(40)
  })

  /** Air is 48-85% of a volume depending on the case, so an exposure that
   *  moved with it would be a different exposure per case. */
  it('does not move when there is more air around the same tissue', () => {
    const sparse = exposureExponent(volumeOf(realistic(600)))
    const roomy = exposureExponent(volumeOf(realistic(4000)))
    // Otsu's split shifts a little as the class weights change; what matters
    // is that 6.7x the air does not drag the exposure with it.
    expect(roomy / sparse).toBeGreaterThan(0.95)
    expect(roomy / sparse).toBeLessThan(1.05)
  })

  it('is scale-free -- real volumes\' maxima span two orders of magnitude', () => {
    const small = exposureExponent(volumeOf(realistic()))
    const large = exposureExponent(volumeOf(realistic().map(x => x * 1000)))
    expect(large).toBeCloseTo(small, 2)
  })

  it('leaves a volume alone when it is already bright enough', () => {
    const v = volumeOf([
      ...Array.from({ length: 100 }, () => 0),
      ...Array.from({ length: 100 }, () => 240),
    ])
    expect(exposureExponent(v)).toBe(1)
  })

  it('honours a caller-supplied target', () => {
    const v = volumeOf(realistic())
    expect(grey(v, TISSUE, exposureExponent(v, 120))).toBeGreaterThan(
      grey(v, TISSUE, exposureExponent(v, 75)),
    )
  })

  it('declines to measure a volume it cannot read', () => {
    expect(exposureExponent({ data: [], min: 0, max: 7 })).toBe(1)
    expect(exposureExponent(volumeOf([5, 5, 5]))).toBe(1)
  })
})
