/**
 * The crosshair selects the voxel under the click and puts the cursor on a voxel's centre.
 *
 * Every conversion used to round up: a click inside voxel n selected n + 1 on every axis, the
 * last voxel selected one past the end, and the converted cursor sat on a voxel's edge.
 *
 * On screen: axial X = i, Y = j; coronal X = i, Y = k reversed; sagittal X = j, Y = k reversed.
 */
import { describe, expect, it } from "vitest";

import { CrosshairTool } from "../Utils/segmentation/tools/CrosshairTool";

const DIMS = [10, 8, 6];
const MM = { x: 9, y: 12, z: 15 }; // nrrd_*_mm: the screen extent of each axis

function crosshair() {
  const ctx: any = {
    nrrd_states: {
      image: {
        dimensions: DIMS,
        ratios: { x: 1, y: 1, z: 1 },
        nrrd_x_mm: MM.x,
        nrrd_y_mm: MM.y,
        nrrd_z_mm: MM.z,
      },
    },
  };
  return new CrosshairTool(ctx);
}

/** Screen coordinate of voxel `v`'s centre (or of `frac` through it) along an axis. */
const along = (v: number, n: number, extent: number, frac = 0.5) => ((v + frac) / n) * extent;
const reversed = (v: number, n: number, extent: number, frac = 0.5) => (1 - (v + frac) / n) * extent;

describe("convertCursorPoint selects the voxel under the cursor", () => {
  for (const frac of [0.5, 0.01, 0.99]) {
    it(`anywhere inside the voxel (at ${frac} of it)`, () => {
      const c = crosshair();
      const [i, j, k] = [3, 5, 2];
      // axial (cursor = i, j) -> sagittal selects i, coronal selects j
      expect(c.convertCursorPoint("z", "x", along(i, 10, MM.x, frac), along(j, 8, MM.y), k)!.currentNewSliceIndex).toBe(i);
      expect(c.convertCursorPoint("z", "y", along(i, 10, MM.x), along(j, 8, MM.y, frac), k)!.currentNewSliceIndex).toBe(j);
      // coronal (cursor = i, k reversed) -> sagittal selects i, axial selects k
      expect(c.convertCursorPoint("y", "x", along(i, 10, MM.x, frac), reversed(k, 6, MM.z), j)!.currentNewSliceIndex).toBe(i);
      expect(c.convertCursorPoint("y", "z", along(i, 10, MM.x), reversed(k, 6, MM.z, frac), j)!.currentNewSliceIndex).toBe(k);
      // sagittal (cursor = j, k reversed) -> coronal selects j, axial selects k
      expect(c.convertCursorPoint("x", "y", along(j, 8, MM.y, frac), reversed(k, 6, MM.z), i)!.currentNewSliceIndex).toBe(j);
      expect(c.convertCursorPoint("x", "z", along(j, 8, MM.y), reversed(k, 6, MM.z, frac), i)!.currentNewSliceIndex).toBe(k);
    });
  }

  it("never selects past the last voxel, even on the image's far edge", () => {
    const c = crosshair();
    expect(c.convertCursorPoint("z", "x", MM.x, 0, 0)!.currentNewSliceIndex).toBe(DIMS[0] - 1);
    expect(c.convertCursorPoint("z", "y", 0, MM.y, 0)!.currentNewSliceIndex).toBe(DIMS[1] - 1);
    // k reversed: the top edge of the image is the last k.
    expect(c.convertCursorPoint("y", "z", 0, 0, 0)!.currentNewSliceIndex).toBe(DIMS[2] - 1);
  });

  it("never selects below the first voxel", () => {
    const c = crosshair();
    expect(c.convertCursorPoint("z", "x", 0, 0, 0)!.currentNewSliceIndex).toBe(0);
    expect(c.convertCursorPoint("y", "z", 0, MM.z, 0)!.currentNewSliceIndex).toBe(0);
  });
});

describe("convertCursorPoint puts the converted cursor on the current slice's centre", () => {
  it("for every conversion", () => {
    const c = crosshair();
    const [i, j, k] = [3, 5, 2];
    // From axial at slice k: the new view's cursor carries k (reversed vertical).
    expect(c.convertCursorPoint("z", "x", 0, 0, k)!.convertCursorNumY).toBeCloseTo(reversed(k, 6, MM.z), 12);
    expect(c.convertCursorPoint("z", "y", 0, 0, k)!.convertCursorNumY).toBeCloseTo(reversed(k, 6, MM.z), 12);
    // From coronal at slice j: sagittal X and axial Y carry j.
    expect(c.convertCursorPoint("y", "x", 0, 0, j)!.convertCursorNumX).toBeCloseTo(along(j, 8, MM.y), 12);
    expect(c.convertCursorPoint("y", "z", 0, 0, j)!.convertCursorNumY).toBeCloseTo(along(j, 8, MM.y), 12);
    // From sagittal at slice i: coronal X and axial X carry i.
    expect(c.convertCursorPoint("x", "y", 0, 0, i)!.convertCursorNumX).toBeCloseTo(along(i, 10, MM.x), 12);
    expect(c.convertCursorPoint("x", "z", 0, 0, i)!.convertCursorNumX).toBeCloseTo(along(i, 10, MM.x), 12);
  });
});
