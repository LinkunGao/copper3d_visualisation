/**
 * setMasksFromNIfTI used to compare only `rawData.length` against the MaskVolume's
 * expected length: a longer buffer was `.slice()`d, a shorter one zero-padded. Both
 * branches accepted a mask from a completely different voxel grid and rendered it
 * silently offset onto the wrong voxels -- no error, no warning. The fix compares the
 * NIfTI's own grid (registered out of band via `registerNiftiMaskGrid`, since
 * NrrdTools.setMasksFromNIfTI forwards a plain `Map<string, Uint8Array>` with no
 * second channel) against the loaded NRRD's grid and refuses a mismatch instead of
 * ever truncating or padding.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const toastSpies = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  show: vi.fn(),
}));
vi.mock("@/composables/useToast", () => ({
  useToast: () => toastSpies,
}));

import { DataLoader, registerNiftiMaskGrid } from "../Utils/segmentation/tools/DataLoader";
import type { DataLoaderHostDeps } from "../Utils/segmentation/tools/ToolHost";

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

// The loaded NRRD's grid: 4x4x4 = 64 voxels, single channel.
const NRRD_DIMS = [4, 4, 4];

function makeLoader() {
  const ctx = makeCtx();
  const callbacks = makeCallbacks();
  const loader = new DataLoader(ctx, callbacks);
  loader.initFromHeader({ dimensions: NRRD_DIMS, spacing: [1, 1, 1], space_origin: [0, 0, 0] });
  return { ctx, callbacks, loader };
}

beforeEach(() => vi.clearAllMocks());

describe("setMasksFromNIfTI grid validation", () => {
  it("refuses a mask whose own grid disagrees with the NRRD grid: no data copied, toast names both grids", () => {
    const { ctx, loader } = makeLoader();
    const volume = ctx.protectedData.maskData.volumes["layer1"];
    const before = new Uint8Array(volume.getRawData());

    // A mask actually stored on a 4x4x5 grid (80 voxels) -- a different volume
    // entirely, not merely a byte-count coincidence.
    const mismatched = new Uint8Array(80).fill(9);
    registerNiftiMaskGrid(mismatched, [4, 4, 5]);

    loader.setMasksFromNIfTI(new Map([["layer1", mismatched]]));

    // The old truncate/pad behaviour always overwrote the buffer; refusing means
    // it is untouched.
    expect(volume.getRawData()).toEqual(before);
    expect(toastSpies.error).toHaveBeenCalledTimes(1);
    const message = toastSpies.error.mock.calls[0][0] as string;
    expect(message).toContain("4x4x5"); // the mask's own grid
    expect(message).toContain("4x4x4"); // the NRRD grid it was checked against
  });

  it("refuses a mask with no registered grid at all, rather than assuming it matches", () => {
    const { ctx, loader } = makeLoader();
    const volume = ctx.protectedData.maskData.volumes["layer2"];
    const before = new Uint8Array(volume.getRawData());

    // Exactly the right byte length, but never registered -- the old code would
    // have accepted this on length alone.
    const unregistered = new Uint8Array(volume.getRawData().length).fill(3);

    loader.setMasksFromNIfTI(new Map([["layer2", unregistered]]));

    expect(volume.getRawData()).toEqual(before);
    expect(toastSpies.error).toHaveBeenCalledTimes(1);
  });

  it("loads a mask whose grid matches the NRRD grid, and fires no toast", () => {
    const { ctx, loader, callbacks } = makeLoader();
    const volume = ctx.protectedData.maskData.volumes["layer3"];

    const matched = new Uint8Array(volume.getRawData().length).fill(5);
    registerNiftiMaskGrid(matched, [4, 4, 4]);

    loader.setMasksFromNIfTI(new Map([["layer3", matched]]));

    expect(volume.getRawData()).toEqual(matched);
    expect(toastSpies.error).not.toHaveBeenCalled();
    expect(callbacks.reloadMasksFromVolume).toHaveBeenCalledTimes(1);
  });
});
