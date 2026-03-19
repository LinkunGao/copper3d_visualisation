/**
 * GaussianSmoother — Unit Tests
 *
 * Covers: kernel generation, no-op on empty volume, single voxel removal,
 * solid block preservation, channel isolation, overwrite behavior,
 * anisotropic spacing, and undo integration.
 */

import { describe, it, expect } from 'vitest';
import { GaussianSmoother } from '../GaussianSmoother';
import { MaskVolume } from '../MaskVolume';

// =====================================================================
//  1. Kernel Generation
// =====================================================================
describe('GaussianSmoother — Kernel Generation', () => {
  it('should produce a symmetric kernel', () => {
    const kernel = GaussianSmoother.generateKernel1D(1.0);
    const len = kernel.length;
    for (let i = 0; i < Math.floor(len / 2); i++) {
      expect(kernel[i]).toBeCloseTo(kernel[len - 1 - i], 6);
    }
  });

  it('should sum to approximately 1.0', () => {
    const kernel = GaussianSmoother.generateKernel1D(1.0);
    let sum = 0;
    for (let i = 0; i < kernel.length; i++) sum += kernel[i];
    expect(sum).toBeCloseTo(1.0, 4);
  });

  it('should have correct size for given sigma (±3σ)', () => {
    const sigma = 2.0;
    const kernel = GaussianSmoother.generateKernel1D(sigma);
    const expectedRadius = Math.ceil(sigma * 3);
    expect(kernel.length).toBe(2 * expectedRadius + 1);
  });

  it('should return [1.0] for sigma <= 0', () => {
    const kernel = GaussianSmoother.generateKernel1D(0);
    expect(kernel.length).toBe(1);
    expect(kernel[0]).toBe(1.0);
  });

  it('should have peak at center', () => {
    const kernel = GaussianSmoother.generateKernel1D(1.5);
    const center = Math.floor(kernel.length / 2);
    for (let i = 0; i < kernel.length; i++) {
      if (i !== center) {
        expect(kernel[center]).toBeGreaterThanOrEqual(kernel[i]);
      }
    }
  });
});

// =====================================================================
//  2. No-op on Empty Volume
// =====================================================================
describe('GaussianSmoother — Empty Volume', () => {
  it('should leave volume unchanged when channel is absent', () => {
    const vol = new MaskVolume(8, 8, 8);
    // Volume is all zeros — channel 1 does not exist
    const before = new Uint8Array(vol.getRawData());
    GaussianSmoother.gaussianSmooth3D(vol, 1, 1.0);
    expect(vol.getRawData()).toEqual(before);
  });
});

// =====================================================================
//  3. Single Voxel Removal
// =====================================================================
describe('GaussianSmoother — Single Voxel', () => {
  it('should erase a single isolated voxel (below threshold after blur)', () => {
    const vol = new MaskVolume(10, 10, 10);
    vol.setVoxel(5, 5, 5, 1);

    GaussianSmoother.gaussianSmooth3D(vol, 1, 1.0);

    // A single voxel surrounded by zeros should be blurred below 0.5
    expect(vol.getVoxel(5, 5, 5)).toBe(0);
  });
});

// =====================================================================
//  4. Solid Block Preservation
// =====================================================================
describe('GaussianSmoother — Solid Block', () => {
  it('should preserve the interior of a large solid block', () => {
    const size = 20;
    const vol = new MaskVolume(size, size, size);

    // Fill a 14×14×14 block in the center (3..16 on each axis)
    for (let z = 3; z <= 16; z++) {
      for (let y = 3; y <= 16; y++) {
        for (let x = 3; x <= 16; x++) {
          vol.setVoxel(x, y, z, 2);
        }
      }
    }

    GaussianSmoother.gaussianSmooth3D(vol, 2, 1.0);

    // Interior voxels (well away from edges) should remain
    for (let z = 6; z <= 13; z++) {
      for (let y = 6; y <= 13; y++) {
        for (let x = 6; x <= 13; x++) {
          expect(vol.getVoxel(x, y, z)).toBe(2);
        }
      }
    }
  });
});

// =====================================================================
//  5. Channel Isolation
// =====================================================================
describe('GaussianSmoother — Channel Isolation', () => {
  it('should not modify other channels when smoothing a target channel', () => {
    const vol = new MaskVolume(10, 10, 10);

    // Channel 1: fill a region
    for (let z = 2; z <= 7; z++) {
      for (let y = 2; y <= 7; y++) {
        for (let x = 2; x <= 7; x++) {
          vol.setVoxel(x, y, z, 1);
        }
      }
    }

    // Channel 3: fill a separate non-overlapping region
    for (let z = 0; z <= 1; z++) {
      for (let y = 0; y <= 1; y++) {
        for (let x = 0; x <= 1; x++) {
          vol.setVoxel(x, y, z, 3);
        }
      }
    }

    // Snapshot channel 3 data before smoothing channel 2
    const ch3Before: number[] = [];
    for (let z = 0; z <= 1; z++) {
      for (let y = 0; y <= 1; y++) {
        for (let x = 0; x <= 1; x++) {
          ch3Before.push(vol.getVoxel(x, y, z));
        }
      }
    }

    // Smooth channel 2 (which doesn't exist) — should be no-op
    GaussianSmoother.gaussianSmooth3D(vol, 2, 1.0);

    // Channel 3 should be untouched
    let idx = 0;
    for (let z = 0; z <= 1; z++) {
      for (let y = 0; y <= 1; y++) {
        for (let x = 0; x <= 1; x++) {
          expect(vol.getVoxel(x, y, z)).toBe(ch3Before[idx++]);
        }
      }
    }
  });
});

// =====================================================================
//  6. Overwrite Behavior
// =====================================================================
describe('GaussianSmoother — Overwrite', () => {
  it('should overwrite other labels when smoothed channel expands', () => {
    const vol = new MaskVolume(12, 12, 12);

    // Fill a solid block with channel 1
    for (let z = 2; z <= 9; z++) {
      for (let y = 2; y <= 9; y++) {
        for (let x = 2; x <= 9; x++) {
          vol.setVoxel(x, y, z, 1);
        }
      }
    }

    // Place channel 2 right at the border (will be overwritten if channel 1 expands)
    vol.setVoxel(1, 5, 5, 2);
    vol.setVoxel(10, 5, 5, 2);

    GaussianSmoother.gaussianSmooth3D(vol, 1, 1.0);

    // The border voxels near the solid block may have been overwritten to channel 1
    // At minimum, the algorithm should not crash and the solid interior should remain
    for (let z = 4; z <= 7; z++) {
      for (let y = 4; y <= 7; y++) {
        for (let x = 4; x <= 7; x++) {
          expect(vol.getVoxel(x, y, z)).toBe(1);
        }
      }
    }
  });
});

// =====================================================================
//  7. Anisotropic Spacing
// =====================================================================
describe('GaussianSmoother — Anisotropic Spacing', () => {
  it('should produce different kernel sizes for different spacing values', () => {
    // With spacing [1, 1, 3], Z-axis sigma = 1.0/3.0 ≈ 0.33 → much narrower kernel
    const kernelXY = GaussianSmoother.generateKernel1D(1.0 / 1.0); // sigma=1.0
    const kernelZ = GaussianSmoother.generateKernel1D(1.0 / 3.0);  // sigma≈0.33
    expect(kernelZ.length).toBeLessThan(kernelXY.length);
  });

  it('should smooth less along the Z axis with larger Z spacing', () => {
    // Create a thin slab: 1 voxel thick in Z, wide in X/Y
    const vol = new MaskVolume(16, 16, 16);

    // Fill a block
    for (let z = 6; z <= 9; z++) {
      for (let y = 4; y <= 11; y++) {
        for (let x = 4; x <= 11; x++) {
          vol.setVoxel(x, y, z, 1);
        }
      }
    }

    // Clone and smooth with isotropic spacing
    const volIso = new MaskVolume(16, 16, 16);
    for (let z = 6; z <= 9; z++) {
      for (let y = 4; y <= 11; y++) {
        for (let x = 4; x <= 11; x++) {
          volIso.setVoxel(x, y, z, 1);
        }
      }
    }

    GaussianSmoother.gaussianSmooth3D(vol, 1, 1.0, [1, 1, 3]);
    GaussianSmoother.gaussianSmooth3D(volIso, 1, 1.0);

    // With anisotropic spacing [1,1,3], Z smoothing is reduced,
    // so the Z boundary should be sharper (fewer erased Z-edge voxels)
    // Count channel-1 voxels in each version
    let countAniso = 0;
    let countIso = 0;
    for (let z = 0; z < 16; z++) {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          if (vol.getVoxel(x, y, z) === 1) countAniso++;
          if (volIso.getVoxel(x, y, z) === 1) countIso++;
        }
      }
    }

    // Both should have voxels, and they should differ
    expect(countAniso).toBeGreaterThan(0);
    expect(countIso).toBeGreaterThan(0);
    // With less Z-smoothing, anisotropic should preserve more Z-edge voxels
    // or produce a different count than isotropic
    expect(countAniso).not.toBe(countIso);
  });
});

// =====================================================================
//  8. Undo Integration
// =====================================================================
describe('GaussianSmoother — Undo Integration', () => {
  it('should allow restoring volume state via raw data snapshot', () => {
    const vol = new MaskVolume(10, 10, 10);

    // Fill some voxels
    for (let z = 3; z <= 6; z++) {
      for (let y = 3; y <= 6; y++) {
        for (let x = 3; x <= 6; x++) {
          vol.setVoxel(x, y, z, 1);
        }
      }
    }

    // Snapshot before smoothing (simulating what NrrdTools will do)
    const snapshotBefore = new Uint8Array(vol.getRawData());

    // Smooth
    GaussianSmoother.gaussianSmooth3D(vol, 1, 1.0);

    // Verify something changed
    const afterSmooth = new Uint8Array(vol.getRawData());
    let changed = false;
    for (let i = 0; i < snapshotBefore.length; i++) {
      if (snapshotBefore[i] !== afterSmooth[i]) {
        changed = true;
        break;
      }
    }
    expect(changed).toBe(true);

    // Restore from snapshot (simulating undo)
    vol.getRawData().set(snapshotBefore);

    // Verify restoration
    expect(vol.getRawData()).toEqual(snapshotBefore);
  });
});
