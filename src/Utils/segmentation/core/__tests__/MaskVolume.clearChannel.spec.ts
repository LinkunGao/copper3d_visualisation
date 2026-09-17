/**
 * Clearing one label, leaving every other label alone.
 *
 * `clear()` and `clearSlice()` are channel-blind — they zero everything in their scope. The
 * third member of that family is the one deleting a single finding needs: its mask is one
 * label inside a volume shared with every other finding on that layer, so anything coarser
 * would take the neighbours with it.
 */
import { describe, expect, it } from "vitest";

import { MaskVolume } from "../MaskVolume";

/** 2x2x2, single plane, so the voxel value IS the label. */
function volume(): MaskVolume {
  return new MaskVolume(2, 2, 2, 1);
}

/** Every voxel's label, z-major, for whole-volume comparisons. */
function labels(v: MaskVolume): number[] {
  return Array.from(v.getRawData());
}

describe("MaskVolume.clearChannel", () => {
  it("zeros only the voxels carrying that label", () => {
    const v = volume();
    v.setVoxel(0, 0, 0, 1);
    v.setVoxel(1, 0, 0, 2);
    v.setVoxel(0, 1, 0, 1);
    v.setVoxel(1, 1, 1, 3);

    v.clearChannel(1);

    expect(labels(v)).toEqual([0, 2, 0, 0, 0, 0, 0, 3]);
  });

  it("leaves a neighbouring label untouched when both share a slice", () => {
    const v = volume();
    v.setVoxel(0, 0, 0, 4);
    v.setVoxel(1, 0, 0, 5);

    v.clearChannel(4);

    expect(v.getVoxel(0, 0, 0)).toBe(0);
    expect(v.getVoxel(1, 0, 0)).toBe(5);
  });

  it("bumps the version when it changed something", () => {
    const v = volume();
    v.setVoxel(0, 0, 0, 1);
    const before = v.getVersion();

    v.clearChannel(1);

    expect(v.getVersion()).toBeGreaterThan(before);
  });

  it("does not bump the version when the label is absent", () => {
    const v = volume();
    v.setVoxel(0, 0, 0, 1);
    const before = v.getVersion();

    v.clearChannel(7);

    // A version bump invalidates every derived cache keyed on it (contours, most of all).
    // Paying that for a clear that changed nothing would redraw the whole layer for free.
    expect(v.getVersion()).toBe(before);
  });

  it("refuses label 0 — that is 'empty', not a channel", () => {
    expect(() => volume().clearChannel(0)).toThrow(RangeError);
  });

  it("refuses a label outside the storable range", () => {
    expect(() => volume().clearChannel(256)).toThrow(RangeError);
    expect(() => volume().clearChannel(-1)).toThrow(RangeError);
  });
});
