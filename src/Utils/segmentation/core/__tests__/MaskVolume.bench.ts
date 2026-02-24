/**
 * Performance Benchmark Suite for MaskVolume
 *
 * Measures operation timing and memory usage for the MaskVolume class
 * and compares against an ImageData-per-slice baseline.
 *
 * Run with: npx vitest bench
 */

import { describe, bench } from 'vitest';
import { MaskVolume } from '../MaskVolume';
import { RenderMode } from '../types';

// ── Volume sizes used in benchmarks ──────────────────────────────────────

const SIZES = {
  small:  { w: 64,  h: 64,  d: 20,  label: '64×64×20' },
  medium: { w: 256, h: 256, d: 50,  label: '256×256×50' },
  large:  { w: 512, h: 512, d: 100, label: '512×512×100' },
};

// ═════════════════════════════════════════════════════════════════════════
//  Constructor Benchmarks
// ═════════════════════════════════════════════════════════════════════════

describe('Constructor - MaskVolume allocation', () => {
  bench(`MaskVolume ${SIZES.small.label}`, () => {
    new MaskVolume(SIZES.small.w, SIZES.small.h, SIZES.small.d);
  });

  bench(`MaskVolume ${SIZES.medium.label}`, () => {
    new MaskVolume(SIZES.medium.w, SIZES.medium.h, SIZES.medium.d);
  });

  bench(`MaskVolume ${SIZES.large.label}`, () => {
    new MaskVolume(SIZES.large.w, SIZES.large.h, SIZES.large.d);
  });
});

describe('Constructor - ImageData baseline allocation', () => {
  bench(`ImageData slices ${SIZES.small.label} (Z-axis)`, () => {
    const slices: ImageData[] = [];
    for (let z = 0; z < SIZES.small.d; z++) {
      slices.push(new ImageData(SIZES.small.w, SIZES.small.h));
    }
  });

  bench(`ImageData slices ${SIZES.medium.label} (Z-axis)`, () => {
    const slices: ImageData[] = [];
    for (let z = 0; z < SIZES.medium.d; z++) {
      slices.push(new ImageData(SIZES.medium.w, SIZES.medium.h));
    }
  });

  bench(`ImageData slices ${SIZES.large.label} (Z-axis)`, () => {
    const slices: ImageData[] = [];
    for (let z = 0; z < SIZES.large.d; z++) {
      slices.push(new ImageData(SIZES.large.w, SIZES.large.h));
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════
//  Voxel Access Benchmarks
// ═════════════════════════════════════════════════════════════════════════

describe('Voxel access - 512×512×100', () => {
  const vol = new MaskVolume(512, 512, 100);
  // Pre-populate some data
  for (let i = 0; i < 1000; i++) {
    vol.setVoxel(
      Math.floor(Math.random() * 512),
      Math.floor(Math.random() * 512),
      Math.floor(Math.random() * 100),
      Math.floor(Math.random() * 256),
    );
  }

  // Pre-generate random coordinates to avoid measuring RNG overhead
  const coords = Array.from({ length: 1000 }, () => ({
    x: Math.floor(Math.random() * 512),
    y: Math.floor(Math.random() * 512),
    z: Math.floor(Math.random() * 100),
  }));

  bench('getVoxel (1000 random reads)', () => {
    let sum = 0;
    for (const c of coords) {
      sum += vol.getVoxel(c.x, c.y, c.z);
    }
    void sum; // prevent dead-code elimination
  });

  bench('setVoxel (1000 random writes)', () => {
    for (const c of coords) {
      vol.setVoxel(c.x, c.y, c.z, 128);
    }
  });
});

describe('Voxel access - ImageData baseline (Z-only)', () => {
  // Simulate ImageData-per-slice storage
  const slices: ImageData[] = [];
  for (let z = 0; z < 100; z++) {
    slices.push(new ImageData(512, 512));
  }

  const coords = Array.from({ length: 1000 }, () => ({
    x: Math.floor(Math.random() * 512),
    y: Math.floor(Math.random() * 512),
    z: Math.floor(Math.random() * 100),
  }));

  bench('ImageData read (1000 random reads, Z-axis only)', () => {
    let sum = 0;
    for (const c of coords) {
      const px = (c.y * 512 + c.x) * 4;
      sum += slices[c.z].data[px];
    }
    void sum;
  });

  bench('ImageData write (1000 random writes, Z-axis only)', () => {
    for (const c of coords) {
      const px = (c.y * 512 + c.x) * 4;
      slices[c.z].data[px] = 128;
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════
//  Slice Extraction Benchmarks
// ═════════════════════════════════════════════════════════════════════════

describe('getSliceImageData - 512×512×100', () => {
  const vol = new MaskVolume(512, 512, 100);
  // Write some data so slices aren't trivially empty
  for (let z = 0; z < 100; z++) {
    for (let x = 200; x < 300; x++) {
      vol.setVoxel(x, 256, z, 255);
    }
  }

  bench('Z-axis (axial) slice', () => {
    vol.getSliceImageData(50, 'z');
  });

  bench('Y-axis (coronal) slice', () => {
    vol.getSliceImageData(256, 'y');
  });

  bench('X-axis (sagittal) slice', () => {
    vol.getSliceImageData(256, 'x');
  });
});

describe('getSliceImageData - render modes (512×512, Z-axis)', () => {
  const vol = new MaskVolume(512, 512, 100, 4);
  // Write some data across channels
  for (let x = 200; x < 300; x++) {
    for (let y = 200; y < 300; y++) {
      vol.setVoxel(x, y, 50, 200, 0);
      vol.setVoxel(x, y, 50, 150, 1);
    }
  }

  bench('GRAYSCALE', () => {
    vol.getSliceImageData(50, 'z', { mode: RenderMode.GRAYSCALE, channel: 0 });
  });

  bench('COLORED_SINGLE', () => {
    vol.getSliceImageData(50, 'z', { mode: RenderMode.COLORED_SINGLE, channel: 0 });
  });

  bench('COLORED_MULTI', () => {
    vol.getSliceImageData(50, 'z', { mode: RenderMode.COLORED_MULTI });
  });

  bench('BLENDED', () => {
    vol.getSliceImageData(50, 'z', { mode: RenderMode.BLENDED });
  });
});

// ═════════════════════════════════════════════════════════════════════════
//  Slice Insertion Benchmark
// ═════════════════════════════════════════════════════════════════════════

describe('setSliceFromImageData - 512×512', () => {
  const vol = new MaskVolume(512, 512, 100);
  const img = new ImageData(512, 512);
  // Fill with some data
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = 128;
  }

  bench('Z-axis insert', () => {
    vol.setSliceFromImageData(50, img, 'z');
  });

  bench('Y-axis insert', () => {
    const imgY = new ImageData(512, 100);
    for (let i = 0; i < imgY.data.length; i += 4) {
      imgY.data[i] = 128;
    }
    vol.setSliceFromImageData(256, imgY, 'y');
  });

  bench('X-axis insert', () => {
    const imgX = new ImageData(512, 100);
    for (let i = 0; i < imgX.data.length; i += 4) {
      imgX.data[i] = 128;
    }
    vol.setSliceFromImageData(256, imgX, 'x');
  });
});

// ═════════════════════════════════════════════════════════════════════════
//  Clone Benchmark
// ═════════════════════════════════════════════════════════════════════════

describe('clone()', () => {
  bench(`clone ${SIZES.small.label}`, () => {
    const vol = new MaskVolume(SIZES.small.w, SIZES.small.h, SIZES.small.d);
    vol.clone();
  });

  bench(`clone ${SIZES.medium.label}`, () => {
    const vol = new MaskVolume(SIZES.medium.w, SIZES.medium.h, SIZES.medium.d);
    vol.clone();
  });

  bench(`clone ${SIZES.large.label}`, () => {
    const vol = new MaskVolume(SIZES.large.w, SIZES.large.h, SIZES.large.d);
    vol.clone();
  });
});

// ═════════════════════════════════════════════════════════════════════════
//  Memory Usage Comparison (test, not bench — captures metrics)
// ═════════════════════════════════════════════════════════════════════════

describe('Memory usage comparison', () => {
  bench('MaskVolume 512×512×100 memory', () => {
    const vol = new MaskVolume(512, 512, 100);
    void vol.getMemoryUsage(); // 26,214,400 bytes (~25 MB)
  });

  bench('ImageData 512×512×100 slices (Z only) memory', () => {
    // Z-axis: 100 slices × 512×512×4 = 104,857,600 bytes (~100 MB)
    let totalBytes = 0;
    for (let z = 0; z < 100; z++) {
      totalBytes += 512 * 512 * 4;
    }
    void totalBytes;
  });

  bench('ImageData 512×512×100 slices (all axes) memory', () => {
    // Z: 100 slices × 512×512×4
    // Y: 512 slices × 512×100×4
    // X: 512 slices × 512×100×4
    let totalBytes = 0;
    totalBytes += 100 * 512 * 512 * 4;  // Z
    totalBytes += 512 * 512 * 100 * 4;  // Y
    totalBytes += 512 * 512 * 100 * 4;  // X
    void totalBytes; // ~524 MB for 1 layer
  });
});
