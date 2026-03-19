/**
 * GaussianSmoother — 3D Gaussian smoothing for segmentation masks.
 *
 * Applies a separable 3D Gaussian blur to a single label channel within a
 * MaskVolume, then thresholds the result back to a binary mask. This smooths
 * jagged edges and fills small holes in segmentation annotations.
 *
 * Pure, stateless utility — no DOM/Canvas/GUI dependencies.
 */

import type { MaskVolume } from './MaskVolume';

export class GaussianSmoother {
  /**
   * Smooth a single label channel in-place using separable 3D Gaussian blur.
   *
   * Steps:
   *  1. Extract — create a Float32Array with 1.0 where voxel === channel, 0.0 elsewhere.
   *  2. Blur — apply separable Gaussian (X → Y → Z) on the float buffer.
   *  3. Threshold — binarize at 0.5.
   *  4. Write back — overwrite/erase voxels according to the thresholded result.
   *
   * @param volume  The MaskVolume to operate on (modified in-place).
   * @param channel The label value to smooth (must be > 0).
   * @param sigma   Base Gaussian sigma in voxel units (default 1.0).
   * @param spacing Optional voxel spacing [sx, sy, sz]. When provided, per-axis
   *                sigma is computed as `sigma / spacing[axis]` so that the
   *                physical smoothing radius is isotropic.
   */
  static gaussianSmooth3D(
    volume: MaskVolume,
    channel: number,
    sigma = 1.0,
    spacing?: [number, number, number],
  ): void {
    const dims = volume.getDimensions();
    const { width, height, depth } = dims;
    const totalVoxels = width * height * depth;

    // Compute per-axis sigma (normalized to voxel units)
    const sigmaX = spacing ? sigma / spacing[0] : sigma;
    const sigmaY = spacing ? sigma / spacing[1] : sigma;
    const sigmaZ = spacing ? sigma / spacing[2] : sigma;

    // 1. Extract binary float buffer
    const buffer = new Float32Array(totalVoxels);
    for (let z = 0; z < depth; z++) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = z * height * width + y * width + x;
          buffer[idx] = volume.getVoxel(x, y, z) === channel ? 1.0 : 0.0;
        }
      }
    }

    // 2. Separable Gaussian blur: X → Y → Z
    const kernelX = GaussianSmoother.generateKernel1D(sigmaX);
    const kernelY = GaussianSmoother.generateKernel1D(sigmaY);
    const kernelZ = GaussianSmoother.generateKernel1D(sigmaZ);

    GaussianSmoother.convolve1D(buffer, width, height, depth, 0, kernelX); // X axis
    GaussianSmoother.convolve1D(buffer, width, height, depth, 1, kernelY); // Y axis
    GaussianSmoother.convolve1D(buffer, width, height, depth, 2, kernelZ); // Z axis

    // 3 & 4. Threshold and write back
    for (let z = 0; z < depth; z++) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = z * height * width + y * width + x;
          const smoothed = buffer[idx] >= 0.5 ? 1 : 0;
          const original = volume.getVoxel(x, y, z);

          if (smoothed === 1 && original !== channel) {
            // Smoothed region expands into this voxel — overwrite
            volume.setVoxel(x, y, z, channel);
          } else if (smoothed === 0 && original === channel) {
            // Smoothed region retreats — erase
            volume.setVoxel(x, y, z, 0);
          }
          // Otherwise leave unchanged
        }
      }
    }
  }

  /**
   * Generate a normalized 1D Gaussian kernel truncated at ±3σ.
   *
   * @param sigma Standard deviation (in voxels). Must be > 0.
   * @returns Normalized Float32Array of odd length.
   */
  static generateKernel1D(sigma: number): Float32Array {
    if (sigma <= 0) {
      return new Float32Array([1.0]);
    }

    const radius = Math.ceil(sigma * 3);
    const size = 2 * radius + 1;
    const kernel = new Float32Array(size);
    const twoSigmaSq = 2 * sigma * sigma;

    let sum = 0;
    for (let i = 0; i < size; i++) {
      const x = i - radius;
      kernel[i] = Math.exp(-(x * x) / twoSigmaSq);
      sum += kernel[i];
    }

    // Normalize
    for (let i = 0; i < size; i++) {
      kernel[i] /= sum;
    }

    return kernel;
  }

  /**
   * In-place single-axis convolution with zero-padding at boundaries.
   *
   * @param data   Flat float buffer (width × height × depth).
   * @param width  X dimension.
   * @param height Y dimension.
   * @param depth  Z dimension.
   * @param axis   0 = X, 1 = Y, 2 = Z.
   * @param kernel 1D convolution kernel (odd length).
   */
  private static convolve1D(
    data: Float32Array,
    width: number,
    height: number,
    depth: number,
    axis: number,
    kernel: Float32Array,
  ): void {
    const radius = (kernel.length - 1) / 2;

    // Determine the dimension length along the convolution axis
    // and the stride between consecutive elements along that axis
    let axisLen: number;
    let stride: number;
    let outerCount: number;

    if (axis === 0) {
      // X axis: stride = 1, iterate over all (y, z) lines
      axisLen = width;
      stride = 1;
      outerCount = height * depth;
    } else if (axis === 1) {
      // Y axis: stride = width, iterate over all (x, z) lines
      axisLen = height;
      stride = width;
      outerCount = width * depth;
    } else {
      // Z axis: stride = width * height, iterate over all (x, y) lines
      axisLen = depth;
      stride = width * height;
      outerCount = width * height;
    }

    // Temporary line buffer to avoid read-after-write issues
    const line = new Float32Array(axisLen);

    for (let outer = 0; outer < outerCount; outer++) {
      // Compute the starting index for this line
      let lineStart: number;
      if (axis === 0) {
        // outer = z * height + y → start = (z * height + y) * width
        lineStart = outer * width;
      } else if (axis === 1) {
        // outer iterates: for each z, for each x → outer = z * width + x
        const z = Math.floor(outer / width);
        const x = outer % width;
        lineStart = z * width * height + x;
      } else {
        // outer = y * width + x
        lineStart = outer;
      }

      // Read the line
      for (let i = 0; i < axisLen; i++) {
        line[i] = data[lineStart + i * stride];
      }

      // Convolve and write back
      for (let i = 0; i < axisLen; i++) {
        let sum = 0;
        for (let k = 0; k < kernel.length; k++) {
          const j = i + k - radius;
          if (j >= 0 && j < axisLen) {
            sum += line[j] * kernel[k];
          }
          // else: zero-padding (add nothing)
        }
        data[lineStart + i * stride] = sum;
      }
    }
  }
}
