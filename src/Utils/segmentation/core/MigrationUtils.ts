/**
 * Migration Utilities for MaskVolume
 *
 * Provides bidirectional conversion between the legacy per-slice
 * ImageData storage (`IPaintImages`) and the new contiguous 3D
 * volumetric storage (`MaskVolume`).
 *
 * These utilities enable:
 *  - **Forward migration**: Import existing annotation data into MaskVolume.
 *  - **Rollback compatibility**: Export MaskVolume back to IPaintImages.
 *
 * @example
 * ```ts
 * // Forward: legacy → volume
 * const volume = convertIPaintImagesToVolume(paintImages, { width: 512, height: 512, depth: 100 });
 *
 * // Backward: volume → legacy
 * const legacy = convertVolumeToIPaintImages(volume);
 * ```
 */

import type { Dimensions } from './types';
import { MaskVolume } from './MaskVolume';

// ── Legacy type mirrors ─────────────────────────────────────────────────
//
// These mirror the legacy interfaces from coreTools/coreType.ts so that
// this module can be used without importing from the legacy codebase.
// They are structurally compatible with the originals.

/**
 * A single painted slice (legacy format).
 */
export interface IPaintImage {
  index: number;
  image: ImageData;
}

/**
 * Per-axis collection of painted slices (legacy format).
 */
export interface IPaintImages {
  x: IPaintImage[];
  y: IPaintImage[];
  z: IPaintImage[];
}

// ── Forward migration: IPaintImages → MaskVolume ────────────────────────

/**
 * Convert legacy per-slice ImageData storage into a MaskVolume.
 *
 * The function iterates over all three axes (`x`, `y`, `z`) and inserts
 * each slice into the volume using `setSliceFromImageData`.
 *
 * **Sparse data handling**: Slices that are absent from the arrays are
 * left as zero (the MaskVolume default). Duplicate indices are
 * overwritten in order (last wins).
 *
 * @param paintImages Legacy per-axis slice collection.
 * @param dimensions  Volume dimensions (must match the ImageData sizes).
 * @param channel     Target channel in the volume (default 0).
 *
 * @returns A new MaskVolume populated with the legacy data.
 *
 * @throws {Error} If a slice's ImageData dimensions don't match the
 *                 expected size for its axis.
 *
 * @example
 * ```ts
 * const volume = convertIPaintImagesToVolume(
 *   maskData.paintImagesLayer1,
 *   { width: 512, height: 512, depth: 100 },
 * );
 * ```
 */
export function convertIPaintImagesToVolume(
  paintImages: IPaintImages,
  dimensions: Dimensions,
  channel = 0,
): MaskVolume {
  if (!paintImages) {
    throw new Error('paintImages is null or undefined');
  }
  if (
    dimensions.width < 1 ||
    dimensions.height < 1 ||
    dimensions.depth < 1
  ) {
    throw new RangeError(
      `Dimensions must be ≥ 1, got (${dimensions.width}, ${dimensions.height}, ${dimensions.depth})`
    );
  }

  const volume = new MaskVolume(
    dimensions.width,
    dimensions.height,
    dimensions.depth,
  );

  // Process each axis
  const axes: Array<{ key: keyof IPaintImages; axis: 'x' | 'y' | 'z' }> = [
    { key: 'z', axis: 'z' },
    { key: 'y', axis: 'y' },
    { key: 'x', axis: 'x' },
  ];

  for (const { key, axis } of axes) {
    const slices = paintImages[key];
    if (!slices || !Array.isArray(slices)) continue;

    for (const paintImage of slices) {
      if (!paintImage || paintImage.image == null) continue;

      const { index, image } = paintImage;

      // Validate slice index bounds
      const maxIndex =
        axis === 'x' ? dimensions.width :
        axis === 'y' ? dimensions.height :
        dimensions.depth;

      if (index < 0 || index >= maxIndex) {
        continue; // Skip out-of-bounds slices silently
      }

      volume.setSliceFromImageData(index, image, axis, channel);
    }
  }

  return volume;
}

// ── Backward migration: MaskVolume → IPaintImages ───────────────────────

/**
 * Convert a MaskVolume back to legacy per-slice ImageData storage.
 *
 * Extracts **all** slices along the Z axis (axial) into an
 * `IPaintImages` structure. X and Y axes are left as empty arrays
 * since the legacy system can reconstruct them on demand.
 *
 * Only non-empty slices (those containing at least one non-zero pixel)
 * are included, matching the sparse behaviour of the original storage.
 *
 * @param volume  The MaskVolume to export.
 * @param channel Channel to extract (default 0).
 * @param options Export options.
 * @param options.includeAllAxes If true, also export X and Y axis slices
 *                               (expensive — use only if needed for full
 *                               backward compatibility). Default: false.
 * @param options.includeEmpty   If true, include slices that are entirely
 *                               zero. Default: false.
 *
 * @returns A legacy IPaintImages structure.
 *
 * @example
 * ```ts
 * const legacy = convertVolumeToIPaintImages(volume);
 * // legacy.z contains non-empty axial slices
 * // legacy.x and legacy.y are empty by default
 * ```
 */
export function convertVolumeToIPaintImages(
  volume: MaskVolume,
  channel = 0,
  options: {
    includeAllAxes?: boolean;
    includeEmpty?: boolean;
  } = {},
): IPaintImages {
  if (!volume) {
    throw new Error('volume is null or undefined');
  }

  const { includeAllAxes = false, includeEmpty = false } = options;
  const dims = volume.getDimensions();

  const result: IPaintImages = { x: [], y: [], z: [] };

  const renderOpts = { channel };

  // Always export Z axis (axial slices — most commonly used)
  for (let z = 0; z < dims.depth; z++) {
    const imageData = volume.getSliceImageData(z, 'z', renderOpts);
    if (includeEmpty || hasNonZeroPixels(imageData)) {
      result.z.push({ index: z, image: imageData });
    }
  }

  // Optionally export X and Y axes
  if (includeAllAxes) {
    for (let y = 0; y < dims.height; y++) {
      const imageData = volume.getSliceImageData(y, 'y', renderOpts);
      if (includeEmpty || hasNonZeroPixels(imageData)) {
        result.y.push({ index: y, image: imageData });
      }
    }

    for (let x = 0; x < dims.width; x++) {
      const imageData = volume.getSliceImageData(x, 'x', renderOpts);
      if (includeEmpty || hasNonZeroPixels(imageData)) {
        result.x.push({ index: x, image: imageData });
      }
    }
  }

  return result;
}

// ── Helpers ──────────────────────────────────────────────────────────────

/**
 * Check whether an ImageData has any non-zero pixel data.
 *
 * Only checks the R channel (index 0 of every 4-byte group) since
 * MaskVolume stores grayscale values in the R channel.
 */
function hasNonZeroPixels(imageData: ImageData): boolean {
  const data = imageData.data;
  // Check R channel of each pixel (stride 4)
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] !== 0) return true;
  }
  return false;
}
