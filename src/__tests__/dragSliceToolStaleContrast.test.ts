/**
 * `DragSliceTool.updateIndex` can be scheduled well before it runs:
 * `NrrdTools.setSliceMoving` defers the actual move to a `requestAnimationFrame` callback.
 * If something else -- an axis switch (`NrrdTools.setSliceOrientation`), a contrast
 * toggle -- rebuilds `displaySlices` before that callback fires, `contrastNum` can point past
 * the end of the (now shorter, or differently-keyed) array. `updateCurrentContrastSlice()`
 * then returns `undefined`, and the unguarded `needToUpdateSlice.repaint.call(...)` throws
 * `TypeError: Cannot read properties of undefined (reading 'repaint')` -- reproduced against
 * a real running case by switching to Sagittal while a case is still progressively loading.
 *
 * This is not exclusive to the narrowed-axes change (nothing about it is axis-specific --
 * `contrastNum`/`displaySlices` size mismatch is the whole story), but switching axis during
 * a load is the concrete path that surfaced it while verifying that change.
 */
import { describe, expect, it, vi } from "vitest";
import { DragSliceTool } from "../Utils/segmentation/tools/DragSliceTool";
import type { DragSliceHostDeps } from "../Utils/segmentation/tools/ToolHost";

function makeCtx(displaySlicesLength: number, contrastNum: number) {
  return {
    nrrd_states: {
      view: {
        showContrast: false,
        contrastNum,
        currentSliceIndex: 100,
        maxIndex: 200,
        minIndex: 0,
        switchSliceFlag: false,
        preSliceIndex: 0,
        changedWidth: 64,
        changedHeight: 64,
      },
      image: { RSARatio: 1, originWidth: 64, originHeight: 64 },
    },
    gui_states: { mode: { sphere: false } },
    protectedData: {
      axis: "z",
      displaySlices: new Array(displaySlicesLength).fill(0).map((_, i) => ({
        index: 0,
        repaint: vi.fn(),
        canvas: {},
      })),
      mainPreSlices: { index: 0 },
      currentShowingSlice: undefined,
      allSlicesArray: [],
      ctxes: {
        displayCtx: { save: vi.fn(), restore: vi.fn(), drawImage: vi.fn() },
        emptyCtx: {},
      },
      canvases: {
        drawingCanvasLayerMaster: {},
        displayCanvas: {},
        emptyCanvas: {},
      },
      layerTargets: new Map(),
    },
  } as any;
}

function makeCallbacks(): DragSliceHostDeps {
  return {
    setSyncsliceNum: vi.fn(),
    setIsDrawFalse: vi.fn(),
    flipDisplayImageByAxis: vi.fn(),
    setEmptyCanvasSize: vi.fn(),
    getOrCreateSliceBuffer: vi.fn(() => null),
    renderSliceToCanvas: vi.fn(),
    refreshSphereOverlay: vi.fn(),
    compositeAllLayers: vi.fn(),
  } as unknown as DragSliceHostDeps;
}

describe("DragSliceTool.updateIndex with a stale contrastNum", () => {
  it("does not throw when contrastNum points past the end of displaySlices", () => {
    // displaySlices has 2 entries (0, 1); contrastNum is 2 -- exactly the mismatch measured
    // live (axis switch mid-load left contrastNum=2 against displaySlices.length=2).
    const ctx = makeCtx(2, 2);
    const tool = new DragSliceTool(
      ctx,
      makeCallbacks(),
      document.createElement("div"),
      { drawingCanvasLayerMaster: document.createElement("canvas"), displayCanvas: document.createElement("canvas"), layerTargets: new Map() }
    );

    expect(() => tool.updateIndex(5)).not.toThrow();
  });

  it("still updates the slice normally when contrastNum is in range", () => {
    const ctx = makeCtx(3, 1);
    const tool = new DragSliceTool(
      ctx,
      makeCallbacks(),
      document.createElement("div"),
      { drawingCanvasLayerMaster: document.createElement("canvas"), displayCanvas: document.createElement("canvas"), layerTargets: new Map() }
    );

    tool.updateIndex(5);

    expect(ctx.nrrd_states.view.currentSliceIndex).toBe(105);
    expect(ctx.protectedData.displaySlices[1].repaint).toHaveBeenCalledTimes(1);
  });
});
