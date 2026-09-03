/**
 * `copperNrrdLoader`'s `axes` option lets a caller extract only the displayed plane up front
 * (LeftPanelCore.vue now passes `axes: ["z"]` for the main case-load pipeline -- each axis
 * skipped is a full pass over the volume plus a geometry/material/canvas-texture retained for
 * the volume's lifetime). The missing planes must still materialise the moment the reader
 * switches to sagittal/coronal (`NrrdTools.setSliceOrientation`), or that view renders nothing.
 *
 * This pins three things with a genuine THREE.Volume/VolumeSlice (not a hand-rolled stand-in),
 * the same way DataLoaderSplit.test.ts does:
 *  - `ensureAxisExtracted` builds a real, correctly-geometried plane on demand, and is a no-op
 *    once the axis already exists
 *  - `DataLoader` (`setContrastOrder`/`headerFromSlice`) no longer assumes every axis is
 *    present -- a z-only slice used to throw on the very first volume of every case load
 *  - the axis-switch path this all exists for (`ensureAxisExtracted` + `resetDisplaySlicesStatus`
 *    -- what `NrrdTools.setSliceOrientation` does) ends with a real, renderable slice at the
 *    new axis, not `undefined`
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Matrix4 } from "three";
import { Volume } from "three/examples/jsm/misc/Volume.js";

import { ensureAxisExtracted } from "../Loader/copperNrrdLoader";
import { DataLoader } from "../Utils/segmentation/tools/DataLoader";
import { SliceRenderPipeline } from "../Utils/segmentation/tools/SliceRenderPipeline";
import type { DataLoaderHostDeps } from "../Utils/segmentation/tools/ToolHost";

beforeAll(() => {
  // jsdom has no real 2D canvas backend; stub just enough for VolumeSlice.repaint(), which
  // extractSlice() runs synchronously as part of building a slice.
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

const DIMS = [64, 80, 50];
const SPACING = [0.7, 0.65, 1.5];
const SPACE_ORIGIN = [-22.4, -26, -37.5];

/** A real THREE.Volume wired up the way NRRDLoader wires a freshly parsed one, wrapped the
 *  same way `axes: ["z"]` leaves it: only "z" extracted, "x"/"y" left `undefined`. */
function makeZOnlySlices(dims = DIMS, spacing = SPACING, spaceOrigin = SPACE_ORIGIN) {
  const voxelCount = dims[0] * dims[1] * dims[2];
  const volume: any = new Volume(dims[0], dims[1], dims[2], "uint8", new Uint8Array(voxelCount).buffer as unknown as ArrayLike<number>);
  // three declares that parameter as ArrayLike<number>, but Volume wraps a raw
  // ArrayBuffer in a typed-array view -- which is exactly what rehydrateVolume does
  // in production, so the test builds its volume the same way.
  volume.dimensions = dims;
  volume.spacing = spacing;
  volume.axisOrder = ["x", "y", "z"];
  volume.header = { space_origin: spaceOrigin };
  volume.matrix = new Matrix4().identity();
  volume.inverseMatrix = new Matrix4().identity();
  volume.RASDimensions = dims.map((d, i) => Math.floor(d * spacing[i]));
  volume.windowLow = 0;
  volume.windowHigh = 255;

  const z = volume.extractSlice("z", Math.floor(dims[2] / 2));
  z.initIndex = Math.floor(dims[2] / 2);
  z.MaxIndex = dims[2] - 1;
  z.RSARatio = spacing[2];
  z.RSAMaxIndex = volume.RASDimensions[2] - 1;

  return { x: undefined, y: undefined, z } as any;
}

describe("ensureAxisExtracted", () => {
  it("builds a real, correctly-geometried plane for a missing axis", () => {
    const slices = makeZOnlySlices();
    expect(slices.x).toBeUndefined();

    const sliceX = ensureAxisExtracted(slices, "x");

    expect(slices.x).toBe(sliceX);
    expect(sliceX.canvas).toBeInstanceOf(HTMLCanvasElement);
    expect(sliceX.initIndex).toBe(Math.floor(DIMS[0] / 2));
    expect(sliceX.MaxIndex).toBe(DIMS[0] - 1);
    expect(sliceX.RSARatio).toBe(SPACING[0]);
    expect(sliceX.RSAMaxIndex).toBe(Math.floor(DIMS[0] * SPACING[0]) - 1);
    // Same underlying Volume as the axis that was already extracted -- not a second volume.
    expect(sliceX.volume).toBe(slices.z.volume);
  });

  it("is a no-op once the axis already exists -- returns the same reference, does not re-extract", () => {
    const slices = makeZOnlySlices();
    const first = ensureAxisExtracted(slices, "x");
    const second = ensureAxisExtracted(slices, "x");
    expect(second).toBe(first);
  });

  it("carries over the already-extracted axis's contrastOrder, so a late extraction is stamped like the others", () => {
    const slices = makeZOnlySlices();
    slices.z.contrastOrder = 2;

    const sliceX = ensureAxisExtracted(slices, "x");

    expect(sliceX.contrastOrder).toBe(2);
  });

  it("also updates the mesh set, when given one", () => {
    const slices = makeZOnlySlices();
    const meshes = { x: undefined, y: undefined, z: slices.z.mesh } as any;

    const sliceX = ensureAxisExtracted(slices, "x", meshes);

    expect(meshes.x).toBe(sliceX.mesh);
  });
});

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

describe("DataLoader with a narrowed-axes (z-only) slice", () => {
  it("setAllSlices does not throw, and stamps contrastOrder only on the axis that exists", () => {
    const slices = makeZOnlySlices();
    const loader = new DataLoader(makeCtx(), makeCallbacks());

    expect(() => loader.setAllSlices([slices])).not.toThrow();

    expect(slices.z.contrastOrder).toBe(0);
    expect(slices.x).toBeUndefined();
    expect(slices.y).toBeUndefined();
  });

  it("appendSlice does not throw for a later z-only slice either", () => {
    const s0 = makeZOnlySlices();
    const s1 = makeZOnlySlices();
    const ctx = makeCtx();
    const loader = new DataLoader(ctx, makeCallbacks());
    loader.setAllSlices([s0]);

    expect(() => loader.appendSlice(s1, 1)).not.toThrow();
    expect(s1.z.contrastOrder).toBe(1);
    expect(ctx.protectedData.allSlicesArray).toEqual([s0, s1]);
  });
});

describe("switching to a non-extracted axis (what NrrdTools.setSliceOrientation does)", () => {
  it("without on-demand extraction, the new axis renders nothing (backUpDisplaySlices holds undefined)", () => {
    // Demonstrates the bug this whole mechanism exists to fix: a narrowed-axes load handed
    // straight to the display pipeline with no extraction step in between.
    const slices = makeZOnlySlices();
    const ctx = makeCtx();
    ctx.protectedData.allSlicesArray = [slices];
    ctx.protectedData.axis = "x";
    ctx.protectedData.displaySlices = [];
    ctx.protectedData.backUpDisplaySlices = [];
    ctx.protectedData.skipSlicesDic = {};
    ctx.nrrd_states.view = { contrastNum: 0 };

    const pipeline: any = Object.create(SliceRenderPipeline.prototype);
    pipeline.ctx = ctx;
    pipeline.setDisplaySlicesBaseOnAxis();

    expect(ctx.protectedData.displaySlices).toEqual([undefined]);
  });

  it("with ensureAxisExtracted run first, the new axis is a real, renderable slice", () => {
    const slices = makeZOnlySlices();
    const ctx = makeCtx();
    ctx.protectedData.allSlicesArray = [slices];
    ctx.protectedData.displaySlices = [];
    ctx.protectedData.backUpDisplaySlices = [];
    ctx.protectedData.skipSlicesDic = {};
    ctx.nrrd_states.view = { contrastNum: 0 };

    // What NrrdTools.setSliceOrientation("x") does: extract the target axis for every loaded
    // contrast, THEN flip the current axis and refresh the display pipeline.
    for (const slice of ctx.protectedData.allSlicesArray) {
      ensureAxisExtracted(slice, "x");
    }
    ctx.protectedData.axis = "x";

    const pipeline: any = Object.create(SliceRenderPipeline.prototype);
    pipeline.ctx = ctx;
    pipeline.setDisplaySlicesBaseOnAxis();

    expect(ctx.protectedData.displaySlices).toHaveLength(1);
    const rendered = ctx.protectedData.displaySlices[0];
    expect(rendered).toBeDefined();
    expect(rendered).toBe(slices.x);
    expect(rendered.canvas).toBeInstanceOf(HTMLCanvasElement);
  });
});
