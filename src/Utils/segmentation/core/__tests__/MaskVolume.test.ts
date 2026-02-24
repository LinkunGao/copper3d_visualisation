/**
 * MaskVolume — Comprehensive Unit Tests
 *
 * Covers: constructor, voxel access, bounds checking, multi-channel,
 * slice extraction (all axes), slice insertion (all axes), utility methods,
 * and all 4 color rendering modes.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MaskVolume } from '../MaskVolume';
import {
  RenderMode,
  MASK_CHANNEL_COLORS,
} from '../types';
import type { ChannelColorMap, RGBAColor } from '../types';

// ─── Helper: create a small ImageData-like object for jsdom ──────────
function createImageData(width: number, height: number): ImageData {
  return new ImageData(width, height);
}

// =====================================================================
//  1. Constructor
// =====================================================================
describe('MaskVolume — Constructor', () => {
  it('should create a volume with correct dimensions', () => {
    const vol = new MaskVolume(10, 20, 30);
    const dims = vol.getDimensions();
    expect(dims.width).toBe(10);
    expect(dims.height).toBe(20);
    expect(dims.depth).toBe(30);
  });

  it('should default to 1 channel', () => {
    const vol = new MaskVolume(4, 4, 4);
    expect(vol.getChannels()).toBe(1);
  });

  it('should accept custom channel count', () => {
    const vol = new MaskVolume(4, 4, 4, 3);
    expect(vol.getChannels()).toBe(3);
  });

  it('should allocate correct memory size', () => {
    const vol = new MaskVolume(10, 10, 10, 2);
    expect(vol.getMemoryUsage()).toBe(10 * 10 * 10 * 2);
  });

  it('should initialise all voxels to zero', () => {
    const vol = new MaskVolume(5, 5, 5);
    const raw = vol.getRawData();
    for (let i = 0; i < raw.length; i++) {
      expect(raw[i]).toBe(0);
    }
  });

  it('should throw on zero width', () => {
    expect(() => new MaskVolume(0, 5, 5)).toThrow(RangeError);
  });

  it('should throw on zero height', () => {
    expect(() => new MaskVolume(5, 0, 5)).toThrow(RangeError);
  });

  it('should throw on zero depth', () => {
    expect(() => new MaskVolume(5, 5, 0)).toThrow(RangeError);
  });

  it('should throw on negative dimensions', () => {
    expect(() => new MaskVolume(-1, 5, 5)).toThrow(RangeError);
  });

  it('should throw on zero channels', () => {
    expect(() => new MaskVolume(5, 5, 5, 0)).toThrow(RangeError);
  });

  it('should accept a custom color map', () => {
    const custom: ChannelColorMap = {
      1: { r: 100, g: 100, b: 100, a: 200 },
    };
    const vol = new MaskVolume(4, 4, 4, 2, custom);
    const color = vol.getChannelColor(1);
    expect(color.r).toBe(100);
    expect(color.g).toBe(100);
    expect(color.b).toBe(100);
    expect(color.a).toBe(200);
  });

  it('should work with dimensions of 1', () => {
    const vol = new MaskVolume(1, 1, 1);
    expect(vol.getMemoryUsage()).toBe(1);
  });
});

// =====================================================================
//  2. Voxel Access
// =====================================================================
describe('MaskVolume — Voxel Get/Set', () => {
  let vol: MaskVolume;

  beforeEach(() => {
    vol = new MaskVolume(10, 10, 10);
  });

  it('should set and get a voxel', () => {
    vol.setVoxel(5, 5, 5, 200);
    expect(vol.getVoxel(5, 5, 5)).toBe(200);
  });

  it('should default to channel 0', () => {
    vol.setVoxel(0, 0, 0, 42);
    expect(vol.getVoxel(0, 0, 0)).toBe(42);
  });

  it('should handle boundary voxels (0,0,0)', () => {
    vol.setVoxel(0, 0, 0, 1);
    expect(vol.getVoxel(0, 0, 0)).toBe(1);
  });

  it('should handle boundary voxels (max,max,max)', () => {
    vol.setVoxel(9, 9, 9, 255);
    expect(vol.getVoxel(9, 9, 9)).toBe(255);
  });

  it('should clamp values > 255 (Uint8 behaviour)', () => {
    vol.setVoxel(0, 0, 0, 300);
    expect(vol.getVoxel(0, 0, 0)).toBe(44); // 300 & 0xFF = 44
  });

  it('should not affect neighbouring voxels', () => {
    vol.setVoxel(5, 5, 5, 128);
    expect(vol.getVoxel(4, 5, 5)).toBe(0);
    expect(vol.getVoxel(6, 5, 5)).toBe(0);
    expect(vol.getVoxel(5, 4, 5)).toBe(0);
    expect(vol.getVoxel(5, 6, 5)).toBe(0);
    expect(vol.getVoxel(5, 5, 4)).toBe(0);
    expect(vol.getVoxel(5, 5, 6)).toBe(0);
  });
});

// =====================================================================
//  3. Bounds Checking
// =====================================================================
describe('MaskVolume — Bounds Checking', () => {
  let vol: MaskVolume;

  beforeEach(() => {
    vol = new MaskVolume(10, 10, 10, 2);
  });

  it('should throw for x out of bounds (negative)', () => {
    expect(() => vol.getVoxel(-1, 0, 0)).toThrow(RangeError);
  });

  it('should throw for x out of bounds (too large)', () => {
    expect(() => vol.getVoxel(10, 0, 0)).toThrow(RangeError);
  });

  it('should throw for y out of bounds', () => {
    expect(() => vol.getVoxel(0, 10, 0)).toThrow(RangeError);
  });

  it('should throw for z out of bounds', () => {
    expect(() => vol.getVoxel(0, 0, 10)).toThrow(RangeError);
  });

  it('should throw for channel out of bounds', () => {
    expect(() => vol.getVoxel(0, 0, 0, 2)).toThrow(RangeError);
  });

  it('should throw for negative channel', () => {
    expect(() => vol.getVoxel(0, 0, 0, -1)).toThrow(RangeError);
  });

  it('should throw on setVoxel out of bounds', () => {
    expect(() => vol.setVoxel(10, 0, 0, 1)).toThrow(RangeError);
  });
});

// =====================================================================
//  4. Multi-channel Support
// =====================================================================
describe('MaskVolume — Multi-channel', () => {
  let vol: MaskVolume;

  beforeEach(() => {
    vol = new MaskVolume(10, 10, 10, 3);
  });

  it('should store independent values per channel', () => {
    vol.setVoxel(5, 5, 5, 100, 0);
    vol.setVoxel(5, 5, 5, 150, 1);
    vol.setVoxel(5, 5, 5, 200, 2);

    expect(vol.getVoxel(5, 5, 5, 0)).toBe(100);
    expect(vol.getVoxel(5, 5, 5, 1)).toBe(150);
    expect(vol.getVoxel(5, 5, 5, 2)).toBe(200);
  });

  it('should allocate correct memory for multiple channels', () => {
    expect(vol.getMemoryUsage()).toBe(10 * 10 * 10 * 3);
  });

  it('should initialise all channels to zero', () => {
    for (let ch = 0; ch < 3; ch++) {
      expect(vol.getVoxel(0, 0, 0, ch)).toBe(0);
      expect(vol.getVoxel(9, 9, 9, ch)).toBe(0);
    }
  });
});

// =====================================================================
//  5. Slice Extraction — All Axes
// =====================================================================
describe('MaskVolume — Slice Extraction', () => {
  let vol: MaskVolume;
  const W = 8, H = 6, D = 4;

  beforeEach(() => {
    vol = new MaskVolume(W, H, D);
  });

  describe('Z-axis (axial)', () => {
    it('should return ImageData with correct dimensions', () => {
      const img = vol.getSliceImageData(0, 'z');
      expect(img.width).toBe(W);
      expect(img.height).toBe(H);
    });

    it('should read voxel values into the slice', () => {
      vol.setVoxel(3, 2, 1, 200);
      const img = vol.getSliceImageData(1, 'z');
      const px = (2 * W + 3) * 4; // pixel at (3, 2)
      expect(img.data[px]).toBe(200);     // R
      expect(img.data[px + 1]).toBe(200); // G
      expect(img.data[px + 2]).toBe(200); // B
      expect(img.data[px + 3]).toBe(255); // A (non-zero → 255)
    });

    it('should have transparent pixels for zero voxels', () => {
      const img = vol.getSliceImageData(0, 'z');
      expect(img.data[3]).toBe(0); // A = 0
    });

    it('should throw for out-of-bounds slice', () => {
      expect(() => vol.getSliceImageData(D, 'z')).toThrow(RangeError);
      expect(() => vol.getSliceImageData(-1, 'z')).toThrow(RangeError);
    });
  });

  describe('Y-axis (coronal)', () => {
    it('should return ImageData with correct dimensions', () => {
      const img = vol.getSliceImageData(0, 'y');
      expect(img.width).toBe(W);
      expect(img.height).toBe(D);
    });

    it('should read voxel values into the slice', () => {
      vol.setVoxel(2, 3, 1, 180);
      const img = vol.getSliceImageData(3, 'y');
      // y-axis slice: i→x, j→z → pixel(2, 1)
      const px = (1 * W + 2) * 4;
      expect(img.data[px]).toBe(180);
    });

    it('should throw for out-of-bounds slice', () => {
      expect(() => vol.getSliceImageData(H, 'y')).toThrow(RangeError);
    });
  });

  describe('X-axis (sagittal)', () => {
    it('should return ImageData with correct dimensions', () => {
      const img = vol.getSliceImageData(0, 'x');
      expect(img.width).toBe(D);
      expect(img.height).toBe(H);
    });

    it('should read voxel values into the slice', () => {
      vol.setVoxel(4, 2, 1, 160);
      const img = vol.getSliceImageData(4, 'x');
      // x-axis slice: i→z, j→y → pixel(1, 2)
      const px = (2 * D + 1) * 4;
      expect(img.data[px]).toBe(160);
    });

    it('should throw for out-of-bounds slice', () => {
      expect(() => vol.getSliceImageData(W, 'x')).toThrow(RangeError);
    });
  });
});

// =====================================================================
//  6. Slice Insertion — All Axes
// =====================================================================
describe('MaskVolume — Slice Insertion', () => {
  let vol: MaskVolume;
  const W = 8, H = 6, D = 4;

  beforeEach(() => {
    vol = new MaskVolume(W, H, D);
  });

  describe('Z-axis', () => {
    it('should round-trip a slice (extract → insert → extract)', () => {
      // Paint some voxels
      vol.setVoxel(1, 2, 0, 100);
      vol.setVoxel(5, 4, 0, 200);

      // Extract
      const img = vol.getSliceImageData(0, 'z');

      // Clear and re-insert
      vol.clear();
      vol.setSliceFromImageData(0, img, 'z');

      // Verify
      expect(vol.getVoxel(1, 2, 0)).toBe(100);
      expect(vol.getVoxel(5, 4, 0)).toBe(200);
    });

    it('should throw on dimension mismatch', () => {
      const wrongImg = createImageData(W + 1, H);
      expect(() => vol.setSliceFromImageData(0, wrongImg, 'z')).toThrow(/mismatch/i);
    });
  });

  describe('Y-axis', () => {
    it('should round-trip a slice', () => {
      vol.setVoxel(3, 2, 1, 150);
      const img = vol.getSliceImageData(2, 'y');

      vol.clear();
      vol.setSliceFromImageData(2, img, 'y');

      expect(vol.getVoxel(3, 2, 1)).toBe(150);
    });
  });

  describe('X-axis', () => {
    it('should round-trip a slice', () => {
      vol.setVoxel(4, 3, 2, 175);
      const img = vol.getSliceImageData(4, 'x');

      vol.clear();
      vol.setSliceFromImageData(4, img, 'x');

      expect(vol.getVoxel(4, 3, 2)).toBe(175);
    });
  });

  it('should insert into a specific channel', () => {
    const vol2 = new MaskVolume(W, H, D, 2);
    vol2.setVoxel(1, 1, 0, 88, 1);
    const img = vol2.getSliceImageData(0, 'z', {
      mode: RenderMode.GRAYSCALE,
      channel: 1,
    });

    const vol3 = new MaskVolume(W, H, D, 2);
    vol3.setSliceFromImageData(0, img, 'z', 1);

    expect(vol3.getVoxel(1, 1, 0, 1)).toBe(88);
    expect(vol3.getVoxel(1, 1, 0, 0)).toBe(0); // other channel untouched
  });
});

// =====================================================================
//  7. Utility Methods
// =====================================================================
describe('MaskVolume — Utility Methods', () => {
  describe('getRawData', () => {
    it('should return a reference to the backing buffer', () => {
      const vol = new MaskVolume(4, 4, 4);
      vol.setVoxel(0, 0, 0, 42);
      const raw = vol.getRawData();
      expect(raw[0]).toBe(42);
    });

    it('should reflect mutations to the backing buffer', () => {
      const vol = new MaskVolume(4, 4, 4);
      const raw = vol.getRawData();
      raw[0] = 99;
      expect(vol.getVoxel(0, 0, 0)).toBe(99);
    });
  });

  describe('setRawData', () => {
    it('should replace the backing buffer', () => {
      const vol = new MaskVolume(2, 2, 2);
      const newData = new Uint8Array(8);
      newData[0] = 77;
      vol.setRawData(newData);
      expect(vol.getVoxel(0, 0, 0)).toBe(77);
    });

    it('should throw on length mismatch', () => {
      const vol = new MaskVolume(2, 2, 2);
      const bad = new Uint8Array(10);
      expect(() => vol.setRawData(bad)).toThrow(/mismatch/i);
    });
  });

  describe('clone', () => {
    it('should create an independent copy', () => {
      const vol = new MaskVolume(4, 4, 4);
      vol.setVoxel(1, 1, 1, 128);

      const copy = vol.clone();
      expect(copy.getVoxel(1, 1, 1)).toBe(128);

      // Mutating clone should not affect original
      copy.setVoxel(1, 1, 1, 0);
      expect(vol.getVoxel(1, 1, 1)).toBe(128);
    });

    it('should copy dimensions correctly', () => {
      const vol = new MaskVolume(10, 20, 30, 2);
      const copy = vol.clone();
      const dims = copy.getDimensions();
      expect(dims.width).toBe(10);
      expect(dims.height).toBe(20);
      expect(dims.depth).toBe(30);
      expect(copy.getChannels()).toBe(2);
    });

    it('should copy the color map independently', () => {
      const vol = new MaskVolume(4, 4, 4, 2);
      vol.setChannelColor(1, { r: 10, g: 20, b: 30, a: 40 });

      const copy = vol.clone();
      expect(copy.getChannelColor(1)).toEqual({ r: 10, g: 20, b: 30, a: 40 });

      // Mutating original's color should not affect clone
      vol.setChannelColor(1, { r: 255, g: 0, b: 0, a: 255 });
      expect(copy.getChannelColor(1)).toEqual({ r: 10, g: 20, b: 30, a: 40 });
    });
  });

  describe('clear', () => {
    it('should zero all data', () => {
      const vol = new MaskVolume(4, 4, 4);
      vol.setVoxel(0, 0, 0, 255);
      vol.setVoxel(3, 3, 3, 128);
      vol.clear();

      const raw = vol.getRawData();
      for (let i = 0; i < raw.length; i++) {
        expect(raw[i]).toBe(0);
      }
    });

    it('should zero all channels', () => {
      const vol = new MaskVolume(4, 4, 4, 3);
      vol.setVoxel(1, 1, 1, 100, 0);
      vol.setVoxel(1, 1, 1, 150, 1);
      vol.setVoxel(1, 1, 1, 200, 2);
      vol.clear();

      for (let ch = 0; ch < 3; ch++) {
        expect(vol.getVoxel(1, 1, 1, ch)).toBe(0);
      }
    });
  });

  describe('clearSlice', () => {
    it('should zero a specific z-slice', () => {
      const vol = new MaskVolume(4, 4, 4);
      // Paint slice 1 and slice 2
      vol.setVoxel(0, 0, 1, 100);
      vol.setVoxel(0, 0, 2, 200);

      vol.clearSlice(1, 'z');

      expect(vol.getVoxel(0, 0, 1)).toBe(0);
      expect(vol.getVoxel(0, 0, 2)).toBe(200); // untouched
    });

    it('should zero a specific y-slice', () => {
      const vol = new MaskVolume(4, 4, 4);
      vol.setVoxel(0, 1, 0, 100);
      vol.setVoxel(0, 2, 0, 200);

      vol.clearSlice(1, 'y');

      expect(vol.getVoxel(0, 1, 0)).toBe(0);
      expect(vol.getVoxel(0, 2, 0)).toBe(200);
    });

    it('should zero a specific x-slice', () => {
      const vol = new MaskVolume(4, 4, 4);
      vol.setVoxel(1, 0, 0, 100);
      vol.setVoxel(2, 0, 0, 200);

      vol.clearSlice(1, 'x');

      expect(vol.getVoxel(1, 0, 0)).toBe(0);
      expect(vol.getVoxel(2, 0, 0)).toBe(200);
    });

    it('should clear only the specified channel', () => {
      const vol = new MaskVolume(4, 4, 4, 2);
      vol.setVoxel(0, 0, 0, 100, 0);
      vol.setVoxel(0, 0, 0, 200, 1);

      vol.clearSlice(0, 'z', 0);

      expect(vol.getVoxel(0, 0, 0, 0)).toBe(0);   // cleared
      expect(vol.getVoxel(0, 0, 0, 1)).toBe(200);  // untouched
    });

    it('should throw for out-of-bounds slice index', () => {
      const vol = new MaskVolume(4, 4, 4);
      expect(() => vol.clearSlice(4, 'z')).toThrow(RangeError);
      expect(() => vol.clearSlice(-1, 'z')).toThrow(RangeError);
    });
  });

  describe('getMemoryUsage', () => {
    it('should return correct byte count', () => {
      const vol = new MaskVolume(100, 100, 50, 2);
      expect(vol.getMemoryUsage()).toBe(100 * 100 * 50 * 2);
    });
  });
});

// =====================================================================
//  8. Color Mapping — Grayscale Mode
// =====================================================================
describe('MaskVolume — Grayscale Rendering', () => {
  it('should produce correct grayscale output', () => {
    const vol = new MaskVolume(4, 4, 2);
    vol.setVoxel(1, 1, 0, 128);

    const img = vol.getSliceImageData(0, 'z', { mode: RenderMode.GRAYSCALE });
    const px = (1 * 4 + 1) * 4;

    expect(img.data[px]).toBe(128);     // R
    expect(img.data[px + 1]).toBe(128); // G
    expect(img.data[px + 2]).toBe(128); // B
    expect(img.data[px + 3]).toBe(255); // A (non-zero → 255)
  });

  it('should produce transparent output for zero voxels', () => {
    const vol = new MaskVolume(4, 4, 2);
    const img = vol.getSliceImageData(0, 'z', { mode: RenderMode.GRAYSCALE });
    // All zeros
    for (let i = 0; i < img.data.length; i += 4) {
      expect(img.data[i + 3]).toBe(0); // A = 0
    }
  });
});

// =====================================================================
//  9. Color Mapping — Colored Single Mode
// =====================================================================
describe('MaskVolume — Colored Single Rendering', () => {
  it('should apply channel color correctly', () => {
    const vol = new MaskVolume(4, 4, 2, 2);
    vol.setVoxel(1, 1, 0, 255, 1); // full intensity channel 1

    const img = vol.getSliceImageData(0, 'z', {
      mode: RenderMode.COLORED_SINGLE,
      channel: 1,
    });
    const px = (1 * 4 + 1) * 4;

    // Channel 1 default color = Green: {r:0, g:255, b:0, a:153}
    const expected = MASK_CHANNEL_COLORS[1];
    expect(img.data[px]).toBe(expected.r);
    expect(img.data[px + 1]).toBe(expected.g);
    expect(img.data[px + 2]).toBe(expected.b);
    // A = round(153 * (255/255) * 1.0) = 153
    expect(img.data[px + 3]).toBe(expected.a);
  });

  it('should modulate alpha by intensity', () => {
    const vol = new MaskVolume(4, 4, 2, 2);
    vol.setVoxel(0, 0, 0, 128, 1); // half intensity

    const img = vol.getSliceImageData(0, 'z', {
      mode: RenderMode.COLORED_SINGLE,
      channel: 1,
    });

    // A = round(255 * (128/255) * 1.0) = 128
    expect(img.data[3]).toBe(Math.round(255 * (128 / 255)));
  });

  it('should be transparent for zero voxels', () => {
    const vol = new MaskVolume(4, 4, 2, 2);
    const img = vol.getSliceImageData(0, 'z', {
      mode: RenderMode.COLORED_SINGLE,
      channel: 1,
    });

    expect(img.data[3]).toBe(0);
  });
});

// =====================================================================
// 10. Color Mapping — Colored Multi Mode
// =====================================================================
describe('MaskVolume — Colored Multi Rendering', () => {
  it('should show highest-index non-zero channel', () => {
    const vol = new MaskVolume(4, 4, 2, 3);
    // Channel 1 and 2 both have values at the same voxel
    vol.setVoxel(0, 0, 0, 255, 0); // ch 0
    vol.setVoxel(0, 0, 0, 255, 1); // ch 1
    vol.setVoxel(0, 0, 0, 255, 2); // ch 2 — highest

    const img = vol.getSliceImageData(0, 'z', {
      mode: RenderMode.COLORED_MULTI,
    });

    // Should use channel 2 color (Blue: r=0, g=0, b=255, a=153 from index 2+1=3... )
    // Wait — channel indices map to MASK_CHANNEL_COLORS by channel index.
    // Channel 0 → color[0] (transparent), channel 1 → color[1] (green), channel 2 → color[2] (red)
    const expectedColor = MASK_CHANNEL_COLORS[2]; // Red
    expect(img.data[0]).toBe(expectedColor.r); // 255
    expect(img.data[1]).toBe(expectedColor.g); // 0
    expect(img.data[2]).toBe(expectedColor.b); // 0
  });

  it('should skip hidden channels', () => {
    const vol = new MaskVolume(4, 4, 2, 3);
    vol.setVoxel(0, 0, 0, 255, 1);
    vol.setVoxel(0, 0, 0, 255, 2);

    const img = vol.getSliceImageData(0, 'z', {
      mode: RenderMode.COLORED_MULTI,
      visibleChannels: [true, true, false], // ch 2 hidden
    });

    // Should use channel 1 color (Green)
    const expectedColor = MASK_CHANNEL_COLORS[1];
    expect(img.data[0]).toBe(expectedColor.r); // 0
    expect(img.data[1]).toBe(expectedColor.g); // 255
  });

  it('should be transparent when no visible channels have data', () => {
    const vol = new MaskVolume(4, 4, 2, 2);
    // No data set
    const img = vol.getSliceImageData(0, 'z', {
      mode: RenderMode.COLORED_MULTI,
    });

    expect(img.data[3]).toBe(0);
  });
});

// =====================================================================
// 11. Color Mapping — Blended Mode
// =====================================================================
describe('MaskVolume — Blended Rendering', () => {
  it('should blend multiple channels additively', () => {
    const vol = new MaskVolume(4, 4, 2, 3);
    vol.setVoxel(0, 0, 0, 255, 1); // Green channel
    vol.setVoxel(0, 0, 0, 255, 2); // Red channel

    const img = vol.getSliceImageData(0, 'z', {
      mode: RenderMode.BLENDED,
    });

    // Channel 1: Green {r:0, g:255, b:0, a:255} → alpha = (255/255)*1.0*1.0 = 1.0
    // Channel 2: Red   {r:255, g:0, b:0, a:255} → alpha = 1.0
    // totalR = 0*1.0 + 255*1.0 = 255
    // totalG = 255*1.0 + 0*1.0 = 255
    // totalB = 0
    // totalA = 1.0 + 1.0 = 2.0
    expect(img.data[0]).toBe(255); // R
    expect(img.data[1]).toBe(255); // G
    expect(img.data[2]).toBe(0);   // B
    // A = min(255, round(1.2 * 255)) = 255 (clamped)
    expect(img.data[3]).toBe(255);
  });

  it('should skip invisible channels', () => {
    const vol = new MaskVolume(4, 4, 2, 3);
    vol.setVoxel(0, 0, 0, 255, 1);
    vol.setVoxel(0, 0, 0, 255, 2);

    const img = vol.getSliceImageData(0, 'z', {
      mode: RenderMode.BLENDED,
      visibleChannels: [true, true, false], // ch 2 hidden
    });

    // Only channel 1 (Green): totalR = 0, totalG = 255
    expect(img.data[0]).toBe(0);   // R
    expect(img.data[1]).toBe(255); // G
  });

  it('should be transparent when no channels have data', () => {
    const vol = new MaskVolume(4, 4, 2, 2);
    const img = vol.getSliceImageData(0, 'z', {
      mode: RenderMode.BLENDED,
    });

    expect(img.data[3]).toBe(0);
  });
});

// =====================================================================
// 12. Custom Color Map Override
// =====================================================================
describe('MaskVolume — Custom Color Map', () => {
  it('should use custom color map in rendering when passed via options', () => {
    const vol = new MaskVolume(4, 4, 2, 2);
    vol.setVoxel(0, 0, 0, 255, 1);

    const customMap: ChannelColorMap = {
      1: { r: 50, g: 100, b: 150, a: 200 },
    };

    const img = vol.getSliceImageData(0, 'z', {
      mode: RenderMode.COLORED_SINGLE,
      channel: 1,
      colorMap: customMap,
    });

    expect(img.data[0]).toBe(50);  // R
    expect(img.data[1]).toBe(100); // G
    expect(img.data[2]).toBe(150); // B
    expect(img.data[3]).toBe(200); // A = round(200 * 1.0 * 1.0)
  });

  it('should use volume color map when no override in options', () => {
    const custom: ChannelColorMap = {
      1: { r: 10, g: 20, b: 30, a: 100 },
    };
    const vol = new MaskVolume(4, 4, 2, 2, custom);
    vol.setVoxel(0, 0, 0, 255, 1);

    const img = vol.getSliceImageData(0, 'z', {
      mode: RenderMode.COLORED_SINGLE,
      channel: 1,
    });

    expect(img.data[0]).toBe(10);
    expect(img.data[1]).toBe(20);
    expect(img.data[2]).toBe(30);
    expect(img.data[3]).toBe(100);
  });
});

// =====================================================================
// 13. Channel Visibility Filtering
// =====================================================================
describe('MaskVolume — Channel Visibility Filtering', () => {
  it('should render only visible channels in multi mode', () => {
    const vol = new MaskVolume(4, 4, 2, 4);
    vol.setVoxel(0, 0, 0, 255, 1); // Green
    vol.setVoxel(0, 0, 0, 255, 2); // Red
    vol.setVoxel(0, 0, 0, 255, 3); // Blue

    // Only show channel 2 (Red)
    const img = vol.getSliceImageData(0, 'z', {
      mode: RenderMode.COLORED_MULTI,
      visibleChannels: [false, false, true, false],
    });

    const expected = MASK_CHANNEL_COLORS[2]; // Red
    expect(img.data[0]).toBe(expected.r);
    expect(img.data[1]).toBe(expected.g);
    expect(img.data[2]).toBe(expected.b);
  });

  it('should default all channels visible when not specified', () => {
    const vol = new MaskVolume(4, 4, 2, 3);
    vol.setVoxel(0, 0, 0, 255, 2); // highest index

    const img = vol.getSliceImageData(0, 'z', {
      mode: RenderMode.COLORED_MULTI,
      // no visibleChannels → all visible
    });

    const expected = MASK_CHANNEL_COLORS[2]; // Red
    expect(img.data[0]).toBe(expected.r);
  });
});

// =====================================================================
// 14. Opacity Multiplier
// =====================================================================
describe('MaskVolume — Opacity Multiplier', () => {
  it('should scale alpha by opacity in colored single mode', () => {
    const vol = new MaskVolume(4, 4, 2, 2);
    vol.setVoxel(0, 0, 0, 255, 1); // full intensity

    const img = vol.getSliceImageData(0, 'z', {
      mode: RenderMode.COLORED_SINGLE,
      channel: 1,
      opacity: 0.5,
    });

    // A = round(255 * 1.0 * 0.5) = round(127.5) = 128
    expect(img.data[3]).toBe(Math.round(255 * 0.5));
  });

  it('should scale alpha by opacity in multi mode', () => {
    const vol = new MaskVolume(4, 4, 2, 2);
    vol.setVoxel(0, 0, 0, 255, 1);

    const full = vol.getSliceImageData(0, 'z', {
      mode: RenderMode.COLORED_MULTI,
      opacity: 1.0,
    });
    const half = vol.getSliceImageData(0, 'z', {
      mode: RenderMode.COLORED_MULTI,
      opacity: 0.5,
    });

    expect(half.data[3]).toBeLessThan(full.data[3]);
  });

  it('should produce zero alpha when opacity is 0', () => {
    const vol = new MaskVolume(4, 4, 2, 2);
    vol.setVoxel(0, 0, 0, 255, 1);

    const img = vol.getSliceImageData(0, 'z', {
      mode: RenderMode.COLORED_SINGLE,
      channel: 1,
      opacity: 0.0,
    });

    expect(img.data[3]).toBe(0);
  });
});

// =====================================================================
// 15. setChannelColor / getChannelColor
// =====================================================================
describe('MaskVolume — Color Map Management', () => {
  it('should update channel color via setChannelColor', () => {
    const vol = new MaskVolume(4, 4, 4, 3);
    vol.setChannelColor(2, { r: 11, g: 22, b: 33, a: 44 });

    const color = vol.getChannelColor(2);
    expect(color).toEqual({ r: 11, g: 22, b: 33, a: 44 });
  });

  it('should return a copy from getChannelColor (not a reference)', () => {
    const vol = new MaskVolume(4, 4, 4, 2);
    const color = vol.getChannelColor(1);
    color.r = 999;
    // Original should be unchanged
    expect(vol.getChannelColor(1).r).not.toBe(999);
  });

  it('should throw on setChannelColor with out-of-range channel', () => {
    const vol = new MaskVolume(4, 4, 4, 2);
    // Channel range is 0-8 (label-based), so 9 and -1 should throw
    expect(() => vol.setChannelColor(9, { r: 0, g: 0, b: 0, a: 0 })).toThrow(RangeError);
    expect(() => vol.setChannelColor(-1, { r: 0, g: 0, b: 0, a: 0 })).toThrow(RangeError);
  });

  it('should fall back to transparent for undefined channel colors', () => {
    const vol = new MaskVolume(4, 4, 4, 2);
    // Channel 99 doesn't exist in color map
    const fallback = vol.getChannelColor(99);
    expect(fallback).toEqual(MASK_CHANNEL_COLORS[0]); // transparent
  });

  it('should use updated color in rendering', () => {
    const vol = new MaskVolume(4, 4, 2, 2);
    vol.setChannelColor(1, { r: 100, g: 50, b: 25, a: 200 });
    vol.setVoxel(0, 0, 0, 255, 1);

    const img = vol.getSliceImageData(0, 'z', {
      mode: RenderMode.COLORED_SINGLE,
      channel: 1,
    });

    expect(img.data[0]).toBe(100); // R
    expect(img.data[1]).toBe(50);  // G
    expect(img.data[2]).toBe(25);  // B
    expect(img.data[3]).toBe(200); // A = round(200 * 1.0 * 1.0)
  });
});
