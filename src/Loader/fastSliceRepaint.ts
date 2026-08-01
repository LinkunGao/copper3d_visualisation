/**
 * Replaces a `VolumeSlice`'s `repaint` with an equivalent that does not
 * rebuild the world on every scrub step, and can optionally lift its
 * mid-tones.
 *
 * ## What the original does, per slice change
 *
 * Setting `slice.index` sets `geometryNeedsUpdate`, so the next `repaint()`
 * runs `updateGeometry()` first. That method unconditionally:
 *
 *   - assigns `canvas.width` / `canvas.height` and the same on `canvasBuffer`
 *     -- assigning either RESETS the whole 2D backing store even when the
 *     value is unchanged;
 *   - re-fetches both 2D contexts;
 *   - calls `geometry.dispose()` and builds a `new PlaneGeometry(...)`, i.e.
 *     deletes and recreates GPU buffers, every frame.
 *
 * Then `repaint()` calls `ctx.getImageData(...)`, a full canvas read-back
 * that allocates a fresh `Uint8ClampedArray` -- every pixel of which is
 * overwritten by the loop immediately below it, so the read is pure waste.
 *
 * Within one volume and one axis, `planeWidth`, `planeHeight`, `iLength` and
 * `jLength` are the same for every slice; only `sliceAccess` and `matrix`
 * differ. So all of the above is redundant on every scrub step but the first.
 *
 * Measured in a real browser while dragging a slice plane: 59 long tasks
 * (>50ms) in ~2s and a p90 frame time of 61ms, against zero long tasks for
 * the same drag on a scene that rotates but never repaints.
 *
 * `VolumeSlice` comes from three rather than from this library, and there is
 * no option for any of this, so replacing the method per instance is the
 * available lever.
 *
 * ## Fidelity
 *
 * The pixel loop is copied from the original, byte for byte in its
 * arithmetic, threshold and window-level handling included. The differences
 * are the ones above -- cached `ImageData`, geometry work skipped while the
 * plane dimensions are unchanged -- plus the optional exposure LUT, which is
 * the one thing here that changes what a pixel comes out as. `label` volumes
 * are handed back to the original implementation.
 */

/** The parts of three's `VolumeSlice` this needs. */
interface RawSlice {
  axis: string
  index: number
  volume: {
    dataType?: string
    data: ArrayLike<number>
    upperThreshold: number
    lowerThreshold: number
    windowLow: number
    windowHigh: number
    extractPerpendicularPlane: (axis: string, index: number) => {
      sliceAccess: (i: number, j: number) => number
      iLength: number
      jLength: number
      planeWidth: number
      planeHeight: number
      matrix: unknown
    }
  }
  geometryNeedsUpdate: boolean
  sliceAccess: (i: number, j: number) => number
  iLength: number
  jLength: number
  matrix: unknown
  canvas: HTMLCanvasElement
  canvasBuffer: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  ctxBuffer: CanvasRenderingContext2D
  geometry?: { dispose: () => void }
  mesh?: {
    geometry: unknown
    matrix: { identity: () => void }
    applyMatrix4: (m: unknown) => void
    material: { map: { needsUpdate: boolean } }
  }
  repaint: (this: RawSlice) => void
}

const PATCHED = Symbol('fast-repaint')

/** `out = 255 * (in/255) ** exponent`, precomputed. Monotonic with both ends
 *  fixed, so it lifts mid-tones without clipping either end. */
function exposureLut(exponent: number): Uint8Array {
  const lut = new Uint8Array(256)
  for (let v = 0; v < 256; v++) lut[v] = Math.round(255 * (v / 255) ** exponent)
  return lut
}

/**
 * Idempotent: patching an already-patched slice is a no-op.
 *
 * `exposure` is a gamma exponent, normally from `exposureExponent()`; 1
 * leaves greyscale exactly as the original produced it.
 *
 * CALL THIS BEFORE THE FIRST PAINT. The LUT lives in the patched method, so
 * painting first draws one un-lifted frame and corrects it on the reader's
 * first scrub -- a visible colour change.
 *
 * Async only because `PlaneGeometry` is imported on demand, to keep three out
 * of a consumer's initial chunk when nothing scrubs a slice.
 */
export async function installFastSliceRepaint(rawSlice: unknown, exposure = 1): Promise<void> {
  const slice = rawSlice as RawSlice & { [PATCHED]?: true }
  if (!slice || slice[PATCHED]) return
  if (slice.volume?.dataType === 'label') return

  const lut = exposure === 1 ? null : exposureLut(exposure)
  const { PlaneGeometry } = await import('three')

  const original = slice.repaint
  /** Reused across repaints; re-created only when the plane resizes. */
  let buffer: ImageData | null = null

  slice.repaint = function fastRepaint(this: RawSlice) {
    if (this.volume.dataType === 'label') {
      original.call(this)
      return
    }

    if (this.geometryNeedsUpdate) {
      const e = this.volume.extractPerpendicularPlane(this.axis, this.index)
      const resized = this.iLength !== e.iLength
        || this.jLength !== e.jLength
        || this.canvas.width !== e.planeWidth
        || this.canvas.height !== e.planeHeight

      this.sliceAccess = e.sliceAccess
      this.iLength = e.iLength
      this.jLength = e.jLength
      this.matrix = e.matrix

      if (resized) {
        this.canvas.width = e.planeWidth
        this.canvas.height = e.planeHeight
        this.canvasBuffer.width = e.iLength
        this.canvasBuffer.height = e.jLength
        this.ctx = this.canvas.getContext('2d')!
        this.ctxBuffer = this.canvasBuffer.getContext('2d')!
        this.geometry?.dispose()
        const geometry = new PlaneGeometry(e.planeWidth, e.planeHeight)
        this.geometry = geometry as unknown as RawSlice['geometry']
        if (this.mesh) this.mesh.geometry = geometry
        buffer = null
      }

      // Always: the plane's POSITION along the axis is exactly what changed.
      if (this.mesh) {
        this.mesh.matrix.identity()
        this.mesh.applyMatrix4(this.matrix)
      }
      this.geometryNeedsUpdate = false
    }

    const { iLength, jLength, sliceAccess, volume } = this
    if (!buffer || buffer.width !== iLength || buffer.height !== jLength) {
      // `createImageData` allocates zeroed pixels without reading the canvas
      // back, which is the whole point.
      buffer = this.ctxBuffer.createImageData(iLength, jLength)
    }
    const data = buffer.data
    const volumeData = volume.data
    const { upperThreshold, lowerThreshold, windowLow, windowHigh } = volume
    const scale = 255 / (windowHigh - windowLow)

    let pixelCount = 0
    for (let j = 0; j < jLength; j++) {
      for (let i = 0; i < iLength; i++) {
        const raw = volumeData[sliceAccess(i, j)]!
        const alpha = upperThreshold >= raw ? (lowerThreshold <= raw ? 0xFF : 0) : 0
        let value = Math.floor((raw - windowLow) * scale)
        value = value > 255 ? 255 : (value < 0 ? 0 : value | 0)
        if (lut) value = lut[value]!

        const at = 4 * pixelCount
        data[at] = value
        data[at + 1] = value
        data[at + 2] = value
        data[at + 3] = alpha
        pixelCount++
      }
    }

    this.ctxBuffer.putImageData(buffer, 0, 0)
    this.ctx.drawImage(
      this.canvasBuffer,
      0, 0, iLength, jLength,
      0, 0, this.canvas.width, this.canvas.height,
    )
    if (this.mesh) this.mesh.material.map.needsUpdate = true
  }

  slice[PATCHED] = true
}
