/**
 * Switching view redraws the masks, even when the canvas keeps its size.
 *
 * `resizePaintArea` reloads the layer canvases from the mask volumes only when the canvas size
 * changes; otherwise it recomposites what the layers already hold, which is right for a contrast
 * toggle. Sagittal (W = j, H = k) and coronal (W = i, H = k) are the same size whenever i and j
 * have the same extent, so a switch between them recomposited the previous view's masks onto the
 * new view: the mask sat where the lesion had been in the other view. Through axial the size
 * changed, which is why going via axial looked fine.
 */
import { describe, expect, it, vi } from "vitest";

import { NrrdState } from "../Utils/segmentation/coreTools/NrrdState";
import { SliceRenderPipeline } from "../Utils/segmentation/tools/SliceRenderPipeline";

function makePipeline() {
  const canvas = () => ({ width: 0, height: 0 });
  const ctx: any = {
    nrrd_states: new NrrdState(1),
    protectedData: {
      axis: "x",
      canvases: {
        originCanvas: canvas(),
        displayCanvas: canvas(),
        drawingCanvas: canvas(),
        drawingCanvasLayerMaster: canvas(),
      },
      layerTargets: new Map(),
    },
  };
  ctx.nrrd_states.image.originWidth = 340;
  ctx.nrrd_states.image.originHeight = 200;
  const pipeline: any = Object.create(SliceRenderPipeline.prototype);
  pipeline.ctx = ctx;
  pipeline.callbacks = { refreshSphereOverlay: vi.fn(), compositeAllLayers: vi.fn() };
  pipeline.redrawDisplayCanvas = vi.fn();
  pipeline.reloadMasksFromVolume = vi.fn();
  return { pipeline, ctx };
}

describe("SliceRenderPipeline.resizePaintArea across a view switch", () => {
  it("redraws the masks when the view changes but the size does not (sagittal -> coronal)", () => {
    const { pipeline, ctx } = makePipeline();
    pipeline.resizePaintArea(1); // sagittal, first draw
    pipeline.reloadMasksFromVolume.mockClear();

    ctx.protectedData.axis = "y"; // coronal, same width and height
    pipeline.resizePaintArea(1);

    expect(pipeline.reloadMasksFromVolume).toHaveBeenCalledTimes(1);
  });

  it("and back again (coronal -> sagittal)", () => {
    const { pipeline, ctx } = makePipeline();
    ctx.protectedData.axis = "y";
    pipeline.resizePaintArea(1);
    pipeline.reloadMasksFromVolume.mockClear();

    ctx.protectedData.axis = "x";
    pipeline.resizePaintArea(1);

    expect(pipeline.reloadMasksFromVolume).toHaveBeenCalledTimes(1);
  });

  it("still only recomposites when nothing but the contrast changed", () => {
    const { pipeline } = makePipeline();
    pipeline.resizePaintArea(1);
    pipeline.reloadMasksFromVolume.mockClear();
    pipeline.callbacks.compositeAllLayers.mockClear();

    pipeline.resizePaintArea(1); // same view, same size

    expect(pipeline.reloadMasksFromVolume).not.toHaveBeenCalled();
    expect(pipeline.callbacks.compositeAllLayers).toHaveBeenCalledTimes(1);
  });
});
