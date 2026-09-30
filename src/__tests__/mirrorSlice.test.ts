/**
 * A mirror slice is the source's labels seen through the mirror's own voxel grid. The identity
 * on a matching grid is the source's own slice; any other matrix is resampled nearest-neighbour,
 * in the same slice layout, so the same paint code draws both.
 */
import { describe, expect, it } from "vitest";
import { MaskVolume } from "../Utils/segmentation/core/MaskVolume";
import { isIdentity, mirrorSliceLabels, sliceDims } from "../Utils/segmentation/tools/MaskMirror";

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const scale = (s: number, t = 0) => [s, 0, 0, t, 0, s, 0, t, 0, 0, s, t, 0, 0, 0, 1];

function marked() {
  const v = new MaskVolume(6, 5, 4, 1);
  v.setVoxel(1, 2, 3, 7);
  v.setVoxel(4, 0, 1, 2);
  return v;
}

describe("sliceDims", () => {
  it("matches getSliceUint8's layout", () => {
    expect(sliceDims([6, 5, 4], "z")).toEqual([6, 5]);
    expect(sliceDims([6, 5, 4], "y")).toEqual([6, 4]);
    expect(sliceDims([6, 5, 4], "x")).toEqual([4, 5]);
  });
});

describe("isIdentity", () => {
  it("treats a missing matrix as the identity and rejects noise above the tolerance", () => {
    expect(isIdentity(null)).toBe(true);
    expect(isIdentity(I)).toBe(true);
    const noisy = [...I];
    noisy[3] = 1e-6;
    expect(isIdentity(noisy)).toBe(false);
  });
});

describe("mirrorSliceLabels", () => {
  it("is the source's own slice for the identity on the same grid", () => {
    const v = marked();
    for (const [axis, index] of [["z", 3], ["y", 2], ["x", 1]] as const) {
      const s = mirrorSliceLabels(v, [6, 5, 4], axis, index, I);
      const own = v.getSliceUint8(index, axis);
      expect(Array.from(s.data)).toEqual(Array.from(own.data));
      expect([s.width, s.height, s.stride]).toEqual([own.width, own.height, 1]);
    }
  });

  it("resamples to the same layout as the source's slice when the matrix is not exactly the identity", () => {
    const v = marked();
    const nearlyI = [...I];
    nearlyI[3] = 1e-6; // forces the resampling path; rounds to the same voxels
    for (const [axis, index] of [["z", 3], ["z", 1], ["y", 2], ["y", 0], ["x", 1], ["x", 4]] as const) {
      const s = mirrorSliceLabels(v, [6, 5, 4], axis, index, nearlyI);
      expect(Array.from(s.data)).toEqual(Array.from(v.getSliceUint8(index, axis).data));
    }
  });

  it("maps a coarser mirror grid onto the source by the matrix", () => {
    const v = new MaskVolume(8, 8, 8, 1);
    v.setVoxel(2, 4, 6, 5);
    // Mirror voxel (1, 2, 3) is source voxel (2, 4, 6).
    const s = mirrorSliceLabels(v, [4, 4, 4], "z", 3, scale(2));
    expect(s.width).toBe(4);
    expect(s.data[2 * 4 + 1]).toBe(5);
    expect(Array.from(s.data).filter((x) => x !== 0)).toEqual([5]);
  });

  it("a coarser mirror voxel shows a label anywhere in the source voxels it spans", () => {
    // A finding one voxel thick at z = 3, seen through a mirror 3x coarser in z. Mirror
    // slice 1 is centred on source z = 4 and spans z = 3..5; nearest-voxel sampling hits
    // only z = 4 and would miss the finding.
    const v = new MaskVolume(4, 4, 9, 1);
    v.setVoxel(1, 2, 3, 7);
    const thick = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 3, 1, 0, 0, 0, 1];
    const s = mirrorSliceLabels(v, [4, 4, 3], "z", 1, thick);
    expect(s.data[2 * 4 + 1]).toBe(7);
    expect(Array.from(s.data).filter((x) => x !== 0)).toEqual([7]);
    for (const other of [0, 2]) {
      expect(Array.from(mirrorSliceLabels(v, [4, 4, 3], "z", other, thick).data).every((x) => x === 0)).toBe(true);
    }
    // The same coverage holds on an in-plane axis: a sagittal slice through x = 1.
    const sag = mirrorSliceLabels(v, [4, 4, 3], "x", 1, thick);
    expect(Array.from(sag.data).filter((x) => x !== 0)).toEqual([7]);
    expect(sag.data[2 * sag.width + 1]).toBe(7);
  });

  it("draws nothing where the mirror maps outside the source", () => {
    const v = marked();
    const s = mirrorSliceLabels(v, [6, 5, 4], "z", 3, scale(1, 100));
    expect(Array.from(s.data).every((x) => x === 0)).toBe(true);
    const coarse = mirrorSliceLabels(v, [6, 5, 4], "z", 1, scale(3, 100));
    expect(Array.from(coarse.data).every((x) => x === 0)).toBe(true);
  });
});
