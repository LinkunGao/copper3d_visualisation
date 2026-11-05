/**
 * Undo and redo say which channels they changed.
 *
 * They used to report the active channel for every delta. Undoing the delete of finding 10
 * while channel 9 was selected therefore told the app that channel 9 changed: finding 9 was
 * stamped "Mask edited" though none of its voxels moved, and finding 10 waited for an unrelated
 * rescan to come back. A delta holds the slice before and after, and in a label volume a voxel's
 * value is its channel, so the channels it changed are the labels that differ.
 */
import { describe, expect, it, vi } from "vitest";
import { DrawToolCore } from "../Utils/segmentation/DrawToolCore";

/** A 2×2 slice whose voxel values are channel labels. */
const slice = (...labels: number[]) => new Uint8Array(labels);

function makeCore(delta: { oldSlice: Uint8Array; newSlice: Uint8Array }, activeChannel = 8) {
  let current = delta.newSlice;
  const volume = {
    setSliceUint8: vi.fn((_i: number, data: Uint8Array) => { current = data; }),
    getSliceUint8: vi.fn(() => ({ data: current, width: 2, height: 2 })),
  };
  const entry = [{ layerId: "layer3", axis: "z" as const, sliceIndex: 4, ...delta }];

  const core: any = Object.create(DrawToolCore.prototype);
  core.undoManager = { undo: () => entry, redo: () => entry };
  core.renderer = { getVolumeForLayer: () => volume };
  core.setIsDrawFalse = vi.fn();
  core.state = {
    protectedData: { isDrawing: false, axis: "x" },
    nrrd_states: { view: { currentSliceIndex: 0 }, flags: { loadingMaskData: false } },
    gui_states: { layerChannel: { activeChannel } },
    annotationCallbacks: { onMaskChanged: vi.fn() },
  };
  return core;
}

const historyOf = (core: any) => core.state.annotationCallbacks.onMaskChanged.mock.calls.map((c: unknown[]) => c[8]);

describe("undo and redo report the channels they changed", () => {
  it("names the channel the delta changed, not the active one", () => {
    // Channel 7's voxels came and went while channel 8 was selected.
    const core = makeCore({ oldSlice: slice(0, 0, 0, 0), newSlice: slice(7, 7, 0, 0) });
    core.undoLastPainting();
    core.redoLastPainting();
    expect(historyOf(core)).toEqual([{ channels: [7] }, { channels: [7] }]);
  });

  it("names every channel a delta touched", () => {
    const core = makeCore({ oldSlice: slice(3, 0, 5, 9), newSlice: slice(0, 0, 0, 9) });
    core.undoLastPainting();
    expect(historyOf(core)).toEqual([{ channels: [3, 5] }]);
  });

  it("names both channels when one label replaced another", () => {
    const core = makeCore({ oldSlice: slice(2, 2, 0, 0), newSlice: slice(4, 2, 0, 0) });
    core.undoLastPainting();
    expect(historyOf(core)).toEqual([{ channels: [2, 4] }]);
  });

  it("names none for a delta that changed nothing", () => {
    const core = makeCore({ oldSlice: slice(1, 0, 0, 0), newSlice: slice(1, 0, 0, 0) });
    core.undoLastPainting();
    expect(historyOf(core)).toEqual([{ channels: [] }]);
  });
});
