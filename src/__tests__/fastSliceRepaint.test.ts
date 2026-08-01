import { describe, expect, it, vi } from 'vitest'
import { installFastSliceRepaint } from '../Loader/fastSliceRepaint'

/**
 * A `VolumeSlice` in miniature: a 2x2 plane over a four-voxel volume, with
 * every canvas call spied on. The point of the patch is what it does NOT do
 * per scrub step, so the spies matter as much as the pixels.
 */
function fakeSlice(options: {
  data?: number[]
  windowLow?: number
  windowHigh?: number
  lowerThreshold?: number
  upperThreshold?: number
  dataType?: string
} = {}) {
  const data = options.data ?? [0, 85, 170, 255]
  const imageData = { width: 0, height: 0, data: new Uint8ClampedArray(16) }

  const ctxBuffer = {
    createImageData: vi.fn((w: number, h: number) => {
      imageData.width = w
      imageData.height = h
      return imageData
    }),
    putImageData: vi.fn(),
  }
  const ctx = { drawImage: vi.fn(), getImageData: vi.fn() }
  const canvas = { width: 2, height: 2, getContext: vi.fn(() => ctx) }
  const canvasBuffer = { width: 2, height: 2, getContext: vi.fn(() => ctxBuffer) }

  const plane = {
    sliceAccess: (i: number, j: number) => j * 2 + i,
    iLength: 2,
    jLength: 2,
    planeWidth: 2,
    planeHeight: 2,
    matrix: {},
  }

  const slice = {
    axis: 'z',
    index: 0,
    volume: {
      dataType: options.dataType,
      data,
      lowerThreshold: options.lowerThreshold ?? Number.NEGATIVE_INFINITY,
      upperThreshold: options.upperThreshold ?? Number.POSITIVE_INFINITY,
      windowLow: options.windowLow ?? 0,
      windowHigh: options.windowHigh ?? 255,
      extractPerpendicularPlane: vi.fn(() => plane),
    },
    geometryNeedsUpdate: true,
    sliceAccess: plane.sliceAccess,
    iLength: 2,
    jLength: 2,
    matrix: {},
    canvas,
    canvasBuffer,
    ctx,
    ctxBuffer,
    geometry: { dispose: vi.fn() },
    mesh: {
      geometry: {} as unknown,
      matrix: { identity: vi.fn() },
      applyMatrix4: vi.fn(),
      material: { map: { needsUpdate: false } },
    },
    repaint: vi.fn(),
  }
  return { slice, imageData, ctx, ctxBuffer, canvas }
}

/** The grey each of the four voxels came out as. */
function greys(imageData: { data: Uint8ClampedArray }) {
  return [0, 1, 2, 3].map(p => imageData.data[p * 4]!)
}

describe('installFastSliceRepaint', () => {
  it('reproduces the original window mapping when no exposure is asked for', async () => {
    const { slice, imageData } = fakeSlice()
    await installFastSliceRepaint(slice)
    slice.repaint.call(slice as never)
    expect(greys(imageData)).toEqual([0, 85, 170, 255])
  })

  it('lifts mid-tones through the exposure curve without moving either end', async () => {
    const { slice, imageData } = fakeSlice()
    await installFastSliceRepaint(slice, 0.5)
    slice.repaint.call(slice as never)

    const out = greys(imageData)
    expect(out[0]).toBe(0)
    expect(out[3]).toBe(255)
    // 85 -> 255*(85/255)**0.5 = 147; 170 -> 208.
    expect(out[1]).toBeGreaterThan(85)
    expect(out[2]).toBeGreaterThan(170)
    expect(out[2]).toBeLessThan(255)
  })

  it('honours the alpha thresholds exactly as the original does', async () => {
    const { slice, imageData } = fakeSlice({ lowerThreshold: 80, upperThreshold: 200 })
    await installFastSliceRepaint(slice)
    slice.repaint.call(slice as never)
    const alphas = [0, 1, 2, 3].map(p => imageData.data[p * 4 + 3]!)
    expect(alphas).toEqual([0, 255, 255, 0])
  })

  /** The whole point: on a scrub step the plane's dimensions are unchanged,
   *  so nothing may be reallocated. */
  it('does not rebuild geometry or reallocate the buffer on a same-size scrub step', async () => {
    const { slice, ctxBuffer } = fakeSlice()
    await installFastSliceRepaint(slice)
    slice.repaint.call(slice as never)

    const geometry = slice.geometry
    ctxBuffer.createImageData.mockClear()

    slice.index = 1
    slice.geometryNeedsUpdate = true
    slice.repaint.call(slice as never)

    expect(slice.geometry).toBe(geometry)
    expect(geometry.dispose).not.toHaveBeenCalled()
    expect(ctxBuffer.createImageData).not.toHaveBeenCalled()
  })

  /** The original reads the whole canvas back and then overwrites every
   *  pixel it just read. */
  it('never reads the canvas back', async () => {
    const { slice, ctx } = fakeSlice()
    await installFastSliceRepaint(slice)
    slice.repaint.call(slice as never)
    slice.repaint.call(slice as never)
    expect(ctx.getImageData).not.toHaveBeenCalled()
  })

  it('still moves the plane along its axis on every step', async () => {
    const { slice } = fakeSlice()
    await installFastSliceRepaint(slice)
    slice.repaint.call(slice as never)
    slice.geometryNeedsUpdate = true
    slice.repaint.call(slice as never)
    expect(slice.mesh.applyMatrix4).toHaveBeenCalledTimes(2)
    expect(slice.mesh.material.map.needsUpdate).toBe(true)
  })

  it('is idempotent', async () => {
    const { slice } = fakeSlice()
    await installFastSliceRepaint(slice)
    const patched = slice.repaint
    await installFastSliceRepaint(slice, 0.5)
    expect(slice.repaint).toBe(patched)
  })

  it('leaves label volumes to the original implementation', async () => {
    const { slice } = fakeSlice({ dataType: 'label' })
    const original = slice.repaint
    await installFastSliceRepaint(slice)
    expect(slice.repaint).toBe(original)
  })

  it('is safe on nothing', async () => {
    await expect(installFastSliceRepaint(undefined)).resolves.toBeUndefined()
  })
})
