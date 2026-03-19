/**
 * GaussianSmoother — 3D Gaussian smoothing for segmentation masks.
 *
 * Applies a separable 3D Gaussian blur to a single label channel within a
 * MaskVolume, then thresholds the result back to a binary mask. This smooths
 * jagged edges and fills small holes in segmentation annotations.
 *
 * Pure, stateless utility — no DOM/Canvas/GUI dependencies.
 *
 * Performance: uses direct typed-array access (bypassing getVoxel/setVoxel
 * boundary checks) and branch-free convolution for the interior region.
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

    // Direct access to underlying buffer — bypasses getVoxel/setVoxel
    // boundary checks for ~10x speedup in hot loops.
    const rawData = volume.getRawData();
    const channels = volume.getChannels();
    const bytesPerSlice = volume.getBytesPerSlice();
    const rowStride = width * channels;

    // Compute per-axis sigma (normalized to voxel units)
    const sigmaX = spacing ? sigma / spacing[0] : sigma;
    const sigmaY = spacing ? sigma / spacing[1] : sigma;
    const sigmaZ = spacing ? sigma / spacing[2] : sigma;

    // 1. Extract binary float buffer — direct array access
    const buffer = new Float32Array(totalVoxels);
    for (let z = 0; z < depth; z++) {
      const zOffset = z * bytesPerSlice;
      for (let y = 0; y < height; y++) {
        const zyOffset = zOffset + y * rowStride;
        for (let x = 0; x < width; x++) {
          const bufIdx = z * height * width + y * width + x;
          buffer[bufIdx] = rawData[zyOffset + x * channels] === channel ? 1.0 : 0.0;
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

    // 3 & 4. Threshold and write back — direct array access
    for (let z = 0; z < depth; z++) {
      const zOffset = z * bytesPerSlice;
      for (let y = 0; y < height; y++) {
        const zyOffset = zOffset + y * rowStride;
        for (let x = 0; x < width; x++) {
          const bufIdx = z * height * width + y * width + x;
          const smoothed = buffer[bufIdx] >= 0.5 ? 1 : 0;
          const rawIdx = zyOffset + x * channels;
          const original = rawData[rawIdx];

          if (smoothed === 1 && original !== channel) {
            // Smoothed region expands into this voxel — overwrite
            rawData[rawIdx] = channel;
          } else if (smoothed === 0 && original === channel) {
            // Smoothed region retreats — erase
            rawData[rawIdx] = 0;
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
   * Uses a 3-segment approach: left boundary (with bounds check),
   * middle interior (branch-free, ~95% of work), right boundary
   * (with bounds check). This eliminates per-element branching
   * in the hot inner loop.
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
    const kLen = kernel.length;
    const radius = (kLen - 1) / 2;

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

    // Precompute middle segment bounds
    const midStart = radius;
    const midEnd = axisLen - radius;

    // Temporary line buffer to avoid read-after-write issues
    const line = new Float32Array(axisLen);

    for (let outer = 0; outer < outerCount; outer++) {
      // Compute the starting index for this line
      let lineStart: number;
      if (axis === 0) {
        lineStart = outer * width;
      } else if (axis === 1) {
        const z = Math.floor(outer / width);
        const x = outer % width;
        lineStart = z * width * height + x;
      } else {
        lineStart = outer;
      }

      // Read the line
      for (let i = 0; i < axisLen; i++) {
        line[i] = data[lineStart + i * stride];
      }

      // Left boundary segment (i = 0 .. radius-1): lower bound check
      for (let i = 0; i < midStart; i++) {
        let sum = 0;
        for (let k = 0; k < kLen; k++) {
          const j = i + k - radius;
          if (j >= 0) {
            sum += line[j] * kernel[k];
          }
        }
        data[lineStart + i * stride] = sum;
      }

      // Middle segment (i = radius .. axisLen-radius-1): NO bounds check
      for (let i = midStart; i < midEnd; i++) {
        let sum = 0;
        const lineOffset = i - radius;
        for (let k = 0; k < kLen; k++) {
          sum += line[lineOffset + k] * kernel[k];
        }
        data[lineStart + i * stride] = sum;
      }

      // Right boundary segment (i = axisLen-radius .. axisLen-1): upper bound check
      for (let i = midEnd; i < axisLen; i++) {
        let sum = 0;
        for (let k = 0; k < kLen; k++) {
          const j = i + k - radius;
          if (j < axisLen) {
            sum += line[j] * kernel[k];
          }
        }
        data[lineStart + i * stride] = sum;
      }
    }
  }
}
