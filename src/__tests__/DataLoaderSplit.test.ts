/**
 * `setAllSlices` (DataLoader.ts) used to fuse two concerns: deriving the volume's
 * geometry and allocating its MaskVolumes from `allSlicesArray[0]`, and recording
 * the loaded slices themselves. Progressive display needs the first without the
 * second, so it split into `initFromHeader` + `appendSlice`, with `setAllSlices`
 * now a composition of the two.
 *
 * This pins the pre-split behaviour with a genuine THREE.Volume/VolumeSlice
 * (not a hand-rolled stand-in), so the "old" values below are read straight off
 * the same canvases the pre-split code read, including the WebIDL truncation
 * that canvas.width/height apply to a non-integer size.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Matrix4 } from "three";
import { Volume } from "three/examples/jsm/misc/Volume.js";

import { DataLoader, type NrrdHeaderLike } from "../Utils/segmentation/tools/DataLoader";
import type { DataLoaderHostDeps } from "../Utils/segmentation/tools/ToolHost";

beforeAll(() => {
  // jsdom has no real 2D canvas backend; stub just enough for VolumeSlice.repaint(),
  // which extractSlice() runs synchronously as part of building the slice.
  (HTMLCanvasElement.prototype as any).getContext = function () {
    return {
      getImageData: (_x: number, _y: number, w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
      }),
      putImageData: () => {},
      drawImage: () => {},
    };
  };
});

/**
 * Builds a real x/y/z slice triple from an actual THREE.Volume, wired up the
 * same way NRRDLoader wires a freshly parsed volume (identity matrix — the
 * "no space-directions vectors" branch — RASDimensions, axisOrder). This is
 * what `slice.x.volume` / `slice.z.canvas` etc. actually look like at runtime.
 */
function makeRealSlices(dims: number[], spacing: number[], spaceOrigin: number[]) {
  const voxelCount = dims[0] * dims[1] * dims[2];
  const volume: any = new Volume(dims[0], dims[1], dims[2], "uint8", new Uint8Array(voxelCount).buffer);
  volume.dimensions = dims;
  volume.spacing = spacing;
  volume.axisOrder = ["x", "y", "z"];
  volume.header = { space_origin: spaceOrigin };
  volume.matrix = new Matrix4().identity();
  volume.inverseMatrix = new Matrix4().identity();
  volume.RASDimensions = dims.map((d, i) => Math.floor(d * spacing[i]));
  volume.windowLow = 0;
  volume.windowHigh = 255;

  return {
    x: volume.extractSlice("x", Math.floor(dims[0] / 2)),
    y: volume.extractSlice("y", Math.floor(dims[1] / 2)),
    z: volume.extractSlice("z", Math.floor(dims[2] / 2)),
  } as any;
}

function makeCtx() {
  return {
    nrrd_states: {
      image: {
        originWidth: 0,
        originHeight: 0,
        nrrd_x_mm: 0,
        nrrd_y_mm: 0,
        nrrd_z_mm: 0,
        nrrd_x_pixel: 0,
        nrrd_y_pixel: 0,
        nrrd_z_pixel: 0,
        dimensions: [] as number[],
        voxelSpacing: [] as number[],
        spaceOrigin: [] as number[],
        RSARatio: 0,
        ratios: { x: 1, y: 1, z: 1 },
        layers: ["layer1", "layer2", "layer3"],
      },
      sphere: { sphereMaskVolume: null as any },
    },
    protectedData: {
      allSlicesArray: [] as any[],
      maskData: { volumes: {} as Record<string, any> },
    },
  } as any;
}

function makeCallbacks(): DataLoaderHostDeps {
  return {
    invalidateSliceBuffer: vi.fn(),
    setDisplaySlicesBaseOnAxis: vi.fn(),
    afterLoadSlice: vi.fn(),
    setEmptyCanvasSize: vi.fn(),
    syncLayerSliceData: vi.fn(),
    reloadMasksFromVolume: vi.fn(),
    resetZoom: vi.fn(),
  } as unknown as DataLoaderHostDeps;
}

const DIMS = [64, 80, 50];
// x-spacing deliberately non-integer against dims[0] (64 * 0.7 = 44.8) so the
// canvas-width truncation the pre-split code relied on is actually exercised.
const SPACING = [0.7, 0.65, 1.5];
const SPACE_ORIGIN = [-22.4, -26, -37.5];

describe("canvas-derived mm extents (evidence for initFromHeader's derivation)", () => {
  it("dimensions[i] * spacing[i], floored, equals what the old canvas.width/height reads produced", () => {
    const slices = makeRealSlices(DIMS, SPACING, SPACE_ORIGIN);

    // Old code: nrrd_x_mm = randomSlice.z.canvas.width, nrrd_y_mm = randomSlice.z.canvas.height,
    // nrrd_z_mm = randomSlice.x.canvas.width.
    expect(Math.floor(DIMS[0] * SPACING[0])).toBe(slices.z.canvas.width);
    expect(Math.floor(DIMS[1] * SPACING[1])).toBe(slices.z.canvas.height);
    expect(Math.floor(DIMS[2] * SPACING[2])).toBe(slices.x.canvas.width);

    // Confirms the truncation actually bites for this fixture (44.8 -> 44), not just
    // agreeing by coincidence on an already-integer product.
    expect(DIMS[0] * SPACING[0]).toBe(44.8);
    expect(slices.z.canvas.width).toBe(44);
  });
});

describe("setAllSlices (post-split)", () => {
  it("produces the same nrrd_states.image values and MaskVolume dimensions as the pre-split implementation", () => {
    const slices = makeRealSlices(DIMS, SPACING, SPACE_ORIGIN);

    // Ground truth, read directly off the real canvases/volume the same way the
    // pre-split code did.
    const expected = {
      nrrd_x_mm: slices.z.canvas.width,
      nrrd_y_mm: slices.z.canvas.height,
      nrrd_z_mm: slices.x.canvas.width,
      nrrd_x_pixel: slices.x.volume.dimensions[0],
      nrrd_y_pixel: slices.x.volume.dimensions[1],
      nrrd_z_pixel: slices.x.volume.dimensions[2],
      voxelSpacing: slices.x.volume.spacing,
      spaceOrigin: (slices.x.volume.header.space_origin as number[]).map((v) => v * 1),
    };

    const ctx = makeCtx();
    const callbacks = makeCallbacks();
    const loader = new DataLoader(ctx, callbacks);

    loader.setAllSlices([slices]);

    expect(ctx.nrrd_states.image.nrrd_x_mm).toBe(expected.nrrd_x_mm);
    expect(ctx.nrrd_states.image.nrrd_y_mm).toBe(expected.nrrd_y_mm);
    expect(ctx.nrrd_states.image.nrrd_z_mm).toBe(expected.nrrd_z_mm);
    expect(ctx.nrrd_states.image.nrrd_x_pixel).toBe(expected.nrrd_x_pixel);
    expect(ctx.nrrd_states.image.nrrd_y_pixel).toBe(expected.nrrd_y_pixel);
    expect(ctx.nrrd_states.image.nrrd_z_pixel).toBe(expected.nrrd_z_pixel);
    expect(ctx.nrrd_states.image.voxelSpacing).toEqual(expected.voxelSpacing);
    expect(ctx.nrrd_states.image.ratios).toEqual({
      x: SPACING[0],
      y: SPACING[1],
      z: SPACING[2],
    });
    expect(ctx.nrrd_states.image.dimensions).toEqual(DIMS);
    expect(ctx.nrrd_states.image.spaceOrigin).toEqual(expected.spaceOrigin);

    for (const id of ["layer1", "layer2", "layer3"]) {
      expect(ctx.protectedData.maskData.volumes[id].getDimensions()).toEqual({
        width: DIMS[0],
        height: DIMS[1],
        depth: DIMS[2],
      });
    }
    expect(ctx.nrrd_states.sphere.sphereMaskVolume.getDimensions()).toEqual({
      width: DIMS[0],
      height: DIMS[1],
      depth: DIMS[2],
    });

    expect(ctx.protectedData.allSlicesArray).toEqual([slices]);
    expect(slices.x.contrastOrder).toBe(0);
    expect(slices.y.contrastOrder).toBe(0);
    expect(slices.z.contrastOrder).toBe(0);

    expect(callbacks.invalidateSliceBuffer).toHaveBeenCalledTimes(1);
    expect(callbacks.setDisplaySlicesBaseOnAxis).toHaveBeenCalledTimes(1);
    expect(callbacks.afterLoadSlice).toHaveBeenCalledTimes(1);
  });

  it("replaces, not appends, whatever was in allSlicesArray from a previous case", () => {
    const ctx = makeCtx();
    ctx.protectedData.allSlicesArray = [{ x: {}, y: {}, z: {} }];
    const loader = new DataLoader(ctx, makeCallbacks());

    const slices = makeRealSlices([8, 8, 8], [1, 1, 1], [0, 0, 0]);
    loader.setAllSlices([slices]);

    expect(ctx.protectedData.allSlicesArray).toEqual([slices]);
  });

  it("numbers a multi-slice series 0..N-1 and calls the refresh callbacks exactly once for the whole load", () => {
    const s0 = makeRealSlices([8, 8, 8], [1, 1, 1], [0, 0, 0]);
    const s1 = makeRealSlices([8, 8, 8], [1, 1, 1], [0, 0, 0]);
    const ctx = makeCtx();
    const callbacks = makeCallbacks();
    const loader = new DataLoader(ctx, callbacks);

    loader.setAllSlices([s0, s1]);

    expect(s0.x.contrastOrder).toBe(0);
    expect(s1.x.contrastOrder).toBe(1);
    expect(ctx.protectedData.allSlicesArray).toEqual([s0, s1]);
    // Called once for the whole batch, not once per slice: setDisplaySlicesBaseOnAxis's
    // skipSlicesDic bookkeeping assumes it sees the final allSlicesArray, not a
    // still-growing one (see appendSlice's doc comment).
    expect(callbacks.setDisplaySlicesBaseOnAxis).toHaveBeenCalledTimes(1);
    expect(callbacks.afterLoadSlice).toHaveBeenCalledTimes(1);
  });
});

describe("initFromHeader", () => {
  it("sizes image metadata and MaskVolumes from geometry alone, leaving allSlicesArray empty", () => {
    const header: NrrdHeaderLike = {
      dimensions: [32, 40, 20],
      spacing: [1, 1, 2],
      space_origin: [0, 0, 0],
    };
    const ctx = makeCtx();
    const callbacks = makeCallbacks();
    const loader = new DataLoader(ctx, callbacks);

    loader.initFromHeader(header);

    expect(ctx.protectedData.allSlicesArray).toEqual([]);
    expect(ctx.nrrd_states.image.dimensions).toEqual(header.dimensions);
    expect(ctx.nrrd_states.image.nrrd_x_pixel).toBe(32);
    expect(ctx.nrrd_states.image.nrrd_y_pixel).toBe(40);
    expect(ctx.nrrd_states.image.nrrd_z_pixel).toBe(20);
    expect(ctx.nrrd_states.image.nrrd_x_mm).toBe(32);
    expect(ctx.nrrd_states.image.nrrd_y_mm).toBe(40);
    expect(ctx.nrrd_states.image.nrrd_z_mm).toBe(40); // 20 * 2

    for (const id of ["layer1", "layer2", "layer3"]) {
      expect(ctx.protectedData.maskData.volumes[id].getDimensions()).toEqual({
        width: 32,
        height: 40,
        depth: 20,
      });
    }
    expect(ctx.nrrd_states.sphere.sphereMaskVolume.getDimensions()).toEqual({
      width: 32,
      height: 40,
      depth: 20,
    });
    expect(callbacks.invalidateSliceBuffer).toHaveBeenCalledTimes(1);
    // initFromHeader must not touch the slice list or trigger a display refresh —
    // there is nothing to display yet.
    expect(callbacks.setDisplaySlicesBaseOnAxis).not.toHaveBeenCalled();
    expect(callbacks.afterLoadSlice).not.toHaveBeenCalled();
  });
});

describe("appendSlice", () => {
  it("pushes onto allSlicesArray and numbers two calls' contrastOrder 0 and 1", () => {
    const ctx = makeCtx();
    const callbacks = makeCallbacks();
    const loader = new DataLoader(ctx, callbacks);

    const s0: any = { x: {}, y: {}, z: {} };
    const s1: any = { x: {}, y: {}, z: {} };

    loader.appendSlice(s0, 0);
    loader.appendSlice(s1, 1);

    expect(ctx.protectedData.allSlicesArray).toEqual([s0, s1]);
    expect(s0.x.contrastOrder).toBe(0);
    expect(s0.y.contrastOrder).toBe(0);
    expect(s0.z.contrastOrder).toBe(0);
    expect(s1.x.contrastOrder).toBe(1);
    expect(s1.y.contrastOrder).toBe(1);
    expect(s1.z.contrastOrder).toBe(1);
    expect(callbacks.setDisplaySlicesBaseOnAxis).toHaveBeenCalledTimes(2);
    expect(callbacks.afterLoadSlice).toHaveBeenCalledTimes(2);
  });
});
