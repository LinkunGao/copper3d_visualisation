/**
 * How much to lift a volume's mid-tones so its tissue is actually readable.
 *
 * A slice is painted with `(raw - windowLow) * 255 / (windowHigh - windowLow)`
 * and the NRRD loader sets that window to the volume's own min/max. When the
 * max is a handful of bright outliers -- normal on a contrast-enhanced MRI --
 * the tissue ends up in the bottom of the range and the image reads as dark.
 *
 * The answer here is a gamma curve, `out = 255 * (in / 255) ** exponent`,
 * applied on top of that window rather than replacing it. Narrowing the window
 * instead cannot work: any linear window bright enough to lift the tissue
 * saturates the top of the range, and on a contrast-enhanced study the lesion
 * IS the top of the range. Gamma is monotonic and fixes both ends, so nothing
 * clips however far the middle is raised.
 */

/** The parts of a loaded volume this reads. Structural rather than the
 *  loader's own type, so it is testable without building one. */
export interface ExposureVolume {
  data: ArrayLike<number>
  min: number
  max: number
}

/** Where the median tissue voxel should land on the 0-255 greyscale. */
export const DEFAULT_TARGET_GREY = 75

const BINS = 4096
/** Volumes run to ~35M voxels and a full pass costs ~100ms. A uniform stride
 *  is unbiased for the intensity distribution. */
const MAX_SAMPLES = 4_000_000

/**
 * Otsu's threshold: the bin that best separates the histogram into two
 * classes. Used to tell air from tissue.
 *
 * A fraction of the range would be simpler, but the range is exactly what
 * volumes disagree on -- maxima two orders of magnitude apart are ordinary --
 * so any threshold derived from `max` lands somewhere different in each.
 */
function otsuBin(hist: Uint32Array, total: number): number {
  let sum = 0
  for (let b = 0; b < BINS; b++) sum += b * hist[b]!

  let sumBelow = 0
  let countBelow = 0
  let bestVariance = 0
  let threshold = 0
  for (let b = 0; b < BINS; b++) {
    countBelow += hist[b]!
    if (countBelow === 0) continue
    const countAbove = total - countBelow
    if (countAbove === 0) break

    sumBelow += b * hist[b]!
    const meanBelow = sumBelow / countBelow
    const meanAbove = (sum - sumBelow) / countAbove
    const spread = meanBelow - meanAbove
    const variance = countBelow * countAbove * spread * spread
    if (variance > bestVariance) {
      bestVariance = variance
      threshold = b
    }
  }
  return threshold
}

/**
 * The gamma exponent that puts `volume`'s median tissue voxel on
 * `targetGrey`, or 1 when it needs no lift or cannot be measured.
 *
 * Solving per volume is what makes volumes with wildly different maxima come
 * out looking alike.
 */
export function exposureExponent(
  volume: ExposureVolume,
  targetGrey: number = DEFAULT_TARGET_GREY,
): number {
  const { data, min, max } = volume
  if (!data || data.length === 0 || !(max > min)) return 1

  const scale = BINS / (max - min)
  const stride = Math.max(1, Math.floor(data.length / MAX_SAMPLES))
  const hist = new Uint32Array(BINS)
  let sampled = 0
  for (let i = 0; i < data.length; i += stride) {
    let bin = ((data[i]! - min) * scale) | 0
    if (bin >= BINS) bin = BINS - 1
    else if (bin < 0) bin = 0
    hist[bin]!++
    sampled++
  }

  const air = otsuBin(hist, sampled)
  let tissue = 0
  for (let b = air + 1; b < BINS; b++) tissue += hist[b]!
  if (tissue === 0) return 1 // nothing above the split: not an image we can read

  let seen = 0
  let medianBin = air + 1
  for (let b = air + 1; b < BINS; b++) {
    seen += hist[b]!
    if (seen * 2 >= tissue) {
      medianBin = b
      break
    }
  }

  const median = min + (medianBin + 0.5) / scale
  const grey = (median - min) * 255 / (max - min)
  // Only ever brighten: this exists to answer "too dark", and darkening a
  // volume nobody complained about is not in its remit.
  if (!(grey > 0) || grey >= targetGrey) return 1

  return Math.log(targetGrey / 255) / Math.log(grey / 255)
}
