/**
 * Unit Tests for MigrationUtils
 *
 * Tests bidirectional conversion between legacy IPaintImages
 * and MaskVolume storage.
 */

import { describe, it, expect } from 'vitest';
import {
  convertIPaintImagesToVolume,
  convertVolumeToIPaintImages,
  type IPaintImage,
  type IPaintImages,
} from '../MigrationUtils';
import { MaskVolume } from '../MaskVolume';
import type { Dimensions } from '../types';

// ── Helpers ──────────────────────────────────────────────────────────────

/** Create an empty IPaintImages structure. */
function emptyPaintImages(): IPaintImages {
  return { x: [], y: [], z: [] };
}

/**
 * Create an ImageData-like object with specific pixels set.
 * @param width  Image width.
 * @param height Image height.
 * @param fills  Array of { x, y, value } to set in the R channel.
 */
function createImageData(
  width: number,
  height: number,
  fills: Array<{ x: number; y: number; value: number }> = [],
): ImageData {
  const img = new ImageData(width, height);
  for (const { x, y, value } of fills) {
    const idx = (y * width + x) * 4;
    img.data[idx] = value;       // R
    img.data[idx + 1] = value;   // G
    img.data[idx + 2] = value;   // B
    img.data[idx + 3] = value > 0 ? 255 : 0; // A
  }
  return img;
}

// ── Constants ────────────────────────────────────────────────────────────

const DIMS: Dimensions = { width: 10, height: 10, depth: 5 };

// ═════════════════════════════════════════════════════════════════════════
//  convertIPaintImagesToVolume
// ═════════════════════════════════════════════════════════════════════════

describe('convertIPaintImagesToVolume', () => {
  describe('basic conversion', () => {
    it('should create an empty volume from empty paint images', () => {
      const volume = convertIPaintImagesToVolume(emptyPaintImages(), DIMS);

      expect(volume).toBeInstanceOf(MaskVolume);
      const dims = volume.getDimensions();
      expect(dims.width).toBe(10);
      expect(dims.height).toBe(10);
      expect(dims.depth).toBe(5);

      // All voxels should be zero
      for (let z = 0; z < 5; z++) {
        for (let y = 0; y < 10; y++) {
          for (let x = 0; x < 10; x++) {
            expect(volume.getVoxel(x, y, z)).toBe(0);
          }
        }
      }
    });

    it('should import Z-axis slices correctly', () => {
      const paintImages = emptyPaintImages();

      // Create a slice at z=2 with pixel (5,5) = 200
      paintImages.z.push({
        index: 2,
        image: createImageData(10, 10, [{ x: 5, y: 5, value: 200 }]),
      });

      const volume = convertIPaintImagesToVolume(paintImages, DIMS);

      expect(volume.getVoxel(5, 5, 2)).toBe(200);
      expect(volume.getVoxel(0, 0, 2)).toBe(0);
      expect(volume.getVoxel(5, 5, 0)).toBe(0);
    });

    it('should import Y-axis slices correctly', () => {
      const paintImages = emptyPaintImages();

      // Y-axis slice at y=3, pixel (2,1) maps to volume (x=2, y=3, z=1)
      // Y-axis slice dimensions: width=10, height=5 (width × depth)
      paintImages.y.push({
        index: 3,
        image: createImageData(10, 5, [{ x: 2, y: 1, value: 150 }]),
      });

      const volume = convertIPaintImagesToVolume(paintImages, DIMS);

      expect(volume.getVoxel(2, 3, 1)).toBe(150);
    });

    it('should import X-axis slices correctly', () => {
      const paintImages = emptyPaintImages();

      // X-axis slice at x=4, pixel (2,3) maps to volume (x=4, y=3, z=2)
      // X-axis slice dimensions: depth=5, height=10 (depth × height)
      paintImages.x.push({
        index: 4,
        image: createImageData(5, 10, [{ x: 2, y: 3, value: 100 }]),
      });

      const volume = convertIPaintImagesToVolume(paintImages, DIMS);

      expect(volume.getVoxel(4, 3, 2)).toBe(100);
    });
  });

  describe('sparse data handling', () => {
    it('should handle sparse slices (gaps in indices)', () => {
      const paintImages = emptyPaintImages();

      // Only slices at z=0 and z=4, leaving z=1,2,3 empty
      paintImages.z.push({
        index: 0,
        image: createImageData(10, 10, [{ x: 1, y: 1, value: 50 }]),
      });
      paintImages.z.push({
        index: 4,
        image: createImageData(10, 10, [{ x: 9, y: 9, value: 250 }]),
      });

      const volume = convertIPaintImagesToVolume(paintImages, DIMS);

      expect(volume.getVoxel(1, 1, 0)).toBe(50);
      expect(volume.getVoxel(9, 9, 4)).toBe(250);
      // Unset slices should remain zero
      expect(volume.getVoxel(1, 1, 2)).toBe(0);
      expect(volume.getVoxel(9, 9, 2)).toBe(0);
    });

    it('should skip out-of-bounds slice indices silently', () => {
      const paintImages = emptyPaintImages();

      paintImages.z.push({
        index: 999, // out of bounds for depth=5
        image: createImageData(10, 10, [{ x: 0, y: 0, value: 100 }]),
      });
      paintImages.z.push({
        index: -1, // negative index
        image: createImageData(10, 10, [{ x: 0, y: 0, value: 100 }]),
      });

      // Should not throw
      const volume = convertIPaintImagesToVolume(paintImages, DIMS);
      expect(volume).toBeInstanceOf(MaskVolume);
    });

    it('should handle duplicate indices (last wins)', () => {
      const paintImages = emptyPaintImages();

      // Two slices at z=2 — second should overwrite first
      paintImages.z.push({
        index: 2,
        image: createImageData(10, 10, [{ x: 0, y: 0, value: 100 }]),
      });
      paintImages.z.push({
        index: 2,
        image: createImageData(10, 10, [{ x: 0, y: 0, value: 200 }]),
      });

      const volume = convertIPaintImagesToVolume(paintImages, DIMS);
      expect(volume.getVoxel(0, 0, 2)).toBe(200);
    });
  });

  describe('multi-axis import', () => {
    it('should import from all three axes', () => {
      const paintImages = emptyPaintImages();

      paintImages.z.push({
        index: 0,
        image: createImageData(10, 10, [{ x: 1, y: 1, value: 10 }]),
      });
      paintImages.y.push({
        index: 5,
        image: createImageData(10, 5, [{ x: 3, y: 2, value: 20 }]),
      });
      paintImages.x.push({
        index: 7,
        image: createImageData(5, 10, [{ x: 3, y: 4, value: 30 }]),
      });

      const volume = convertIPaintImagesToVolume(paintImages, DIMS);

      expect(volume.getVoxel(1, 1, 0)).toBe(10);  // from z-axis
      expect(volume.getVoxel(3, 5, 2)).toBe(20);  // from y-axis
      expect(volume.getVoxel(7, 4, 3)).toBe(30);  // from x-axis
    });
  });

  describe('error handling', () => {
    it('should throw on null paintImages', () => {
      expect(() => {
        convertIPaintImagesToVolume(null as any, DIMS);
      }).toThrow('paintImages is null or undefined');
    });

    it('should throw on invalid dimensions', () => {
      expect(() => {
        convertIPaintImagesToVolume(emptyPaintImages(), { width: 0, height: 10, depth: 5 });
      }).toThrow();
    });

    it('should handle null entries in paint image arrays gracefully', () => {
      const paintImages = emptyPaintImages();
      paintImages.z.push(null as any);
      paintImages.z.push({
        index: 0,
        image: createImageData(10, 10, [{ x: 0, y: 0, value: 42 }]),
      });

      const volume = convertIPaintImagesToVolume(paintImages, DIMS);
      expect(volume.getVoxel(0, 0, 0)).toBe(42);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════
//  convertVolumeToIPaintImages
// ═════════════════════════════════════════════════════════════════════════

describe('convertVolumeToIPaintImages', () => {
  describe('basic export', () => {
    it('should return empty arrays for an empty volume', () => {
      const volume = new MaskVolume(10, 10, 5);
      const result = convertVolumeToIPaintImages(volume);

      expect(result.z).toHaveLength(0);
      expect(result.y).toHaveLength(0);
      expect(result.x).toHaveLength(0);
    });

    it('should export non-empty Z slices', () => {
      const volume = new MaskVolume(10, 10, 5);
      volume.setVoxel(3, 4, 2, 128);

      const result = convertVolumeToIPaintImages(volume);

      // Only z=2 should be non-empty
      expect(result.z).toHaveLength(1);
      expect(result.z[0].index).toBe(2);
      expect(result.z[0].image.width).toBe(10);
      expect(result.z[0].image.height).toBe(10);

      // Check pixel value at (3,4)
      const px = (4 * 10 + 3) * 4;
      expect(result.z[0].image.data[px]).toBe(128); // R channel
    });

    it('should not export X/Y axes by default', () => {
      const volume = new MaskVolume(10, 10, 5);
      volume.setVoxel(5, 5, 2, 255);

      const result = convertVolumeToIPaintImages(volume);

      expect(result.x).toHaveLength(0);
      expect(result.y).toHaveLength(0);
    });
  });

  describe('includeAllAxes option', () => {
    it('should export all three axes when enabled', () => {
      const volume = new MaskVolume(10, 10, 5);
      volume.setVoxel(3, 4, 2, 200);

      const result = convertVolumeToIPaintImages(volume, 0, {
        includeAllAxes: true,
      });

      // Z: slice 2 should have data
      expect(result.z.length).toBeGreaterThan(0);
      expect(result.z.some(s => s.index === 2)).toBe(true);

      // Y: slice 4 should have data
      expect(result.y.length).toBeGreaterThan(0);
      expect(result.y.some(s => s.index === 4)).toBe(true);

      // X: slice 3 should have data
      expect(result.x.length).toBeGreaterThan(0);
      expect(result.x.some(s => s.index === 3)).toBe(true);
    });
  });

  describe('includeEmpty option', () => {
    it('should include empty slices when enabled', () => {
      const volume = new MaskVolume(10, 10, 5);
      // Only z=2 has data
      volume.setVoxel(0, 0, 2, 1);

      const result = convertVolumeToIPaintImages(volume, 0, {
        includeEmpty: true,
      });

      // All 5 Z slices should be included
      expect(result.z).toHaveLength(5);
      expect(result.z.map(s => s.index)).toEqual([0, 1, 2, 3, 4]);
    });
  });

  describe('error handling', () => {
    it('should throw on null volume', () => {
      expect(() => {
        convertVolumeToIPaintImages(null as any);
      }).toThrow('volume is null or undefined');
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════
//  Round-trip conversion
// ═════════════════════════════════════════════════════════════════════════

describe('Round-trip: IPaintImages ↔ MaskVolume', () => {
  it('should preserve data through forward → backward conversion', () => {
    const paintImages = emptyPaintImages();

    // Create a populated slice at z=1
    const fills = [
      { x: 0, y: 0, value: 100 },
      { x: 5, y: 3, value: 200 },
      { x: 9, y: 9, value: 50 },
    ];
    paintImages.z.push({
      index: 1,
      image: createImageData(10, 10, fills),
    });

    // Forward: IPaintImages → MaskVolume
    const volume = convertIPaintImagesToVolume(paintImages, DIMS);

    // Backward: MaskVolume → IPaintImages
    const exported = convertVolumeToIPaintImages(volume);

    // Should have exactly 1 non-empty Z slice at index 1
    expect(exported.z).toHaveLength(1);
    expect(exported.z[0].index).toBe(1);

    // Verify pixel values round-tripped
    const img = exported.z[0].image;
    for (const { x, y, value } of fills) {
      const px = (y * 10 + x) * 4;
      expect(img.data[px]).toBe(value);
    }
  });

  it('should preserve data through backward → forward conversion', () => {
    const volume = new MaskVolume(10, 10, 5);
    volume.setVoxel(2, 3, 1, 180);
    volume.setVoxel(7, 8, 4, 90);

    // Backward: MaskVolume → IPaintImages
    const paintImages = convertVolumeToIPaintImages(volume);

    // Forward: IPaintImages → MaskVolume
    const restored = convertIPaintImagesToVolume(paintImages, DIMS);

    expect(restored.getVoxel(2, 3, 1)).toBe(180);
    expect(restored.getVoxel(7, 8, 4)).toBe(90);
    expect(restored.getVoxel(0, 0, 0)).toBe(0);
  });

  it('should handle multiple non-empty slices in round-trip', () => {
    const volume = new MaskVolume(10, 10, 5);

    // Paint on multiple slices
    for (let z = 0; z < 5; z++) {
      volume.setVoxel(z, z, z, (z + 1) * 50);
    }

    const paintImages = convertVolumeToIPaintImages(volume);
    expect(paintImages.z).toHaveLength(5);

    const restored = convertIPaintImagesToVolume(paintImages, DIMS);

    for (let z = 0; z < 5; z++) {
      expect(restored.getVoxel(z, z, z)).toBe((z + 1) * 50);
    }
  });
});
