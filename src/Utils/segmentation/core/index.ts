/**
 * @module segmentation/core
 *
 * Core 3D Volumetric Mask Storage System
 *
 * This module provides a memory-efficient 3D mask storage solution for medical
 * image annotation, replacing the legacy per-slice ImageData approach with a
 * single contiguous {@link MaskVolume} backed by a `Uint8Array`.
 *
 * ## Architecture
 *
 * ```
 * core/
 * ├── types.ts          — Shared type definitions (Dimensions, RenderMode, colors)
 * ├── MaskVolume.ts     — Core volume class (storage, access, rendering)
 * ├── MigrationUtils.ts — Legacy ↔ Volume bidirectional conversion
 * └── index.ts          — Public API barrel export (this file)
 * ```
 *
 * ## Memory Layout
 *
 * The backing buffer uses **slice-major** order: `[z][y][x][channel]`.
 *
 * ```
 * index = z * (width × height × channels)
 *       + y * (width × channels)
 *       + x * channels
 *       + channel
 * ```
 *
 * For a 512×512×100 single-channel volume this allocates ~25 MB,
 * compared to ~100 MB for ImageData-per-slice (Z only) or ~524 MB
 * for all three axes.
 *
 * ## Quick Start
 *
 * ```ts
 * import { MaskVolume, RenderMode } from './core';
 *
 * // Create a volume matching the NRRD dimensions
 * const vol = new MaskVolume(512, 512, 100);
 *
 * // Paint a voxel
 * vol.setVoxel(256, 256, 50, 255);
 *
 * // Extract a slice for Canvas rendering
 * const slice = vol.getSliceImageData(50, 'z');
 * ctx.putImageData(slice, 0, 0);
 *
 * // Colored rendering
 * const colored = vol.getSliceImageData(50, 'z', {
 *   mode: RenderMode.COLORED_SINGLE,
 *   channel: 0,
 *   opacity: 0.6,
 * });
 * ```
 *
 * ## Migration from Legacy Storage
 *
 * ```ts
 * import { convertIPaintImagesToVolume, convertVolumeToIPaintImages } from './core';
 *
 * // Forward: legacy IPaintImages → MaskVolume
 * const volume = convertIPaintImagesToVolume(paintImages, { width: 512, height: 512, depth: 100 });
 *
 * // Backward: MaskVolume → legacy IPaintImages (for rollback)
 * const legacy = convertVolumeToIPaintImages(volume);
 * ```
 */

// ── Types ──────────────────────────────────────────────────────────────────
export type {
  Dimensions,
  RGBAColor,
  ChannelColorMap,
  SliceRenderOptions,
  LayerId,
  ChannelValue,
} from './types';

export {
  RenderMode,
  MASK_CHANNEL_COLORS,
  MASK_CHANNEL_CSS_COLORS,
  CHANNEL_COLORS,
  CHANNEL_HEX_COLORS,
  rgbaToHex,
  rgbaToCss,
} from './types';

// ── Core volume ────────────────────────────────────────────────────────────
export { MaskVolume } from './MaskVolume';

// ── Migration utilities ────────────────────────────────────────────────────
export type { IPaintImage, IPaintImages } from './MigrationUtils';

export {
  convertIPaintImagesToVolume,
  convertVolumeToIPaintImages,
} from './MigrationUtils';

// ── Undo/Redo Manager ──────────────────────────────────────────────────────
export type { MaskDelta } from './UndoManager';
export { UndoManager } from './UndoManager';
