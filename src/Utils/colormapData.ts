/**
 * Blue -> orange transfer function for ultrasound volume rendering.
 *
 * Dependency-free (no three.js) so it can be unit-tested under Node.
 * The ALPHA channel is load-bearing: three's VolumeRenderShader1 samples this
 * ramp as RGBA, so alpha is what turns low-intensity speckle transparent and
 * gives the volume its cloud-like appearance.
 */

/** Linear interpolation between two RGB stops. */
function mix(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

const DEEP_BLUE: [number, number, number] = [30, 60, 120];
const PALE_BLUE: [number, number, number] = [150, 190, 230];
const WARM_ORANGE: [number, number, number] = [255, 170, 90];

/**
 * Fraction of the ramp spent going blue -> pale blue before turning orange.
 * Tuned against the data: under the default clim window a typical MIP sample lands
 * around 0.63 of the ramp, so a 0.6 span turned the whole cloud orange. At 0.75 only
 * the brightest ~0.1% of samples (raw > 139, the p99.9) read as warm highlights.
 */
const BLUE_SPAN = 0.75;

/** Alpha curve exponent. >1 keeps the low-intensity speckle transparent. */
const ALPHA_GAMMA = 1.6;

export function buildBlueOrangeRGBA(size = 256): Uint8Array {
  const out = new Uint8Array(size * 4);
  for (let i = 0; i < size; i++) {
    const t = i / (size - 1);
    const [r, g, b] =
      t < BLUE_SPAN
        ? mix(DEEP_BLUE, PALE_BLUE, t / BLUE_SPAN)
        : mix(PALE_BLUE, WARM_ORANGE, (t - BLUE_SPAN) / (1 - BLUE_SPAN));
    out[i * 4 + 0] = Math.round(r);
    out[i * 4 + 1] = Math.round(g);
    out[i * 4 + 2] = Math.round(b);
    out[i * 4 + 3] = Math.round(Math.pow(t, ALPHA_GAMMA) * 255);
  }
  return out;
}
