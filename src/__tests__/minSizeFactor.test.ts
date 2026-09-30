/**
 * `sizeFactor` has a configurable lower bound (`setMinSizeFactor`), so a host can let a
 * 2D panel shrink an image below its original size when the panel is too small for 1:1.
 * The default minimum is 1, so a host that never calls it keeps the old [1, 8] range.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NrrdTools } from "../Utils/segmentation/NrrdTools";
import { NrrdState } from "../Utils/segmentation/coreTools/NrrdState";
import { ZoomTool } from "../Utils/segmentation/tools/ZoomTool";
import { SliceRenderPipeline } from "../Utils/segmentation/tools/SliceRenderPipeline";

function makeTools() {
  const instance: any = Object.create(NrrdTools.prototype);
  instance.state = { nrrd_states: new NrrdState(1) };
  instance.resizePaintArea = vi.fn();
  instance.resetPaintAreaUIPosition = vi.fn();
  return instance;
}

describe("NrrdTools.setMainAreaSize with a minimum size factor", () => {
  it("defaults the minimum to 1, so a factor below 1 still gives 1", () => {
    const tools = makeTools();
    expect(tools.getMinSizeFactor()).toBe(1);
    tools.setMainAreaSize(0.5);
    expect(tools.state.nrrd_states.view.sizeFactor).toBe(1);
  });

  it("allows factors down to the minimum and clamps below it", () => {
    const tools = makeTools();
    tools.setMinSizeFactor(0.4);
    tools.setMainAreaSize(0.5);
    expect(tools.state.nrrd_states.view.sizeFactor).toBe(0.5);
    tools.setMainAreaSize(0.2);
    expect(tools.state.nrrd_states.view.sizeFactor).toBe(0.4);
    expect(tools.resizePaintArea).toHaveBeenLastCalledWith(0.4);
  });

  it("keeps the upper bound at 8", () => {
    const tools = makeTools();
    tools.setMinSizeFactor(0.4);
    tools.setMainAreaSize(20);
    expect(tools.state.nrrd_states.view.sizeFactor).toBe(8);
  });
});

describe("NrrdTools.setMinSizeFactor", () => {
  it("raises the current factor when the new minimum is above it, and repaints", () => {
    const tools = makeTools();
    tools.setMinSizeFactor(0.2);
    tools.setMainAreaSize(0.3);
    tools.resizePaintArea.mockClear();

    tools.setMinSizeFactor(0.6);

    expect(tools.state.nrrd_states.view.sizeFactor).toBe(0.6);
    expect(tools.resizePaintArea).toHaveBeenCalledWith(0.6);
  });

  it("leaves the current factor alone when the new minimum is below it", () => {
    const tools = makeTools();
    tools.setMainAreaSize(2);
    tools.resizePaintArea.mockClear();

    tools.setMinSizeFactor(0.3);

    expect(tools.state.nrrd_states.view.sizeFactor).toBe(2);
    expect(tools.resizePaintArea).not.toHaveBeenCalled();
  });

  it("updates the Zoom slider metadata to the new minimum", () => {
    const tools = makeTools();
    tools.guiParameterSettings = { advance: { mainAreaSize: { name: "Zoom", min: 1, max: 8 } } };
    tools.setMinSizeFactor(0.3);
    expect(tools.guiParameterSettings.advance.mainAreaSize.min).toBe(0.3);
  });

  it("clamps out-of-range arguments to [0.05, 1]", () => {
    const tools = makeTools();
    tools.setMinSizeFactor(0.001);
    expect(tools.getMinSizeFactor()).toBe(0.05);
    tools.setMinSizeFactor(-3);
    expect(tools.getMinSizeFactor()).toBe(0.05);
    tools.setMinSizeFactor(4);
    expect(tools.getMinSizeFactor()).toBe(1);
    tools.setMinSizeFactor(NaN);
    expect(tools.getMinSizeFactor()).toBe(1);
  });
});

describe("NrrdState.setZoomFactor", () => {
  it("clamps to [minSizeFactor, 8]", () => {
    const s = new NrrdState(1);
    s.setZoomFactor(0.5);
    expect(s.view.sizeFactor).toBe(1);
    s.view.minSizeFactor = 0.25;
    s.setZoomFactor(0.5);
    expect(s.view.sizeFactor).toBe(0.5);
    s.setZoomFactor(0.1);
    expect(s.view.sizeFactor).toBe(0.25);
    s.setZoomFactor(9);
    expect(s.view.sizeFactor).toBe(8);
  });
});

describe("SliceRenderPipeline.resizePaintArea below 1:1", () => {
  function makePipeline(originWidth: number, originHeight: number) {
    const canvas = () => ({ width: 0, height: 0 });
    const ctx: any = {
      nrrd_states: new NrrdState(1),
      protectedData: {
        canvases: {
          originCanvas: canvas(),
          displayCanvas: canvas(),
          drawingCanvas: canvas(),
          drawingCanvasLayerMaster: canvas(),
        },
        layerTargets: new Map(),
      },
    };
    ctx.nrrd_states.image.originWidth = originWidth;
    ctx.nrrd_states.image.originHeight = originHeight;
    const pipeline: any = Object.create(SliceRenderPipeline.prototype);
    pipeline.ctx = ctx;
    pipeline.callbacks = { refreshSphereOverlay: vi.fn(), compositeAllLayers: vi.fn() };
    pipeline.redrawDisplayCanvas = vi.fn();
    pipeline.reloadMasksFromVolume = vi.fn();
    return { pipeline, ctx };
  }

  it("keeps a thin dimension at least 1px instead of flooring it to 0", () => {
    const { pipeline, ctx } = makePipeline(200, 10);
    pipeline.resizePaintArea(0.05);
    expect(ctx.nrrd_states.view.changedWidth).toBe(10);
    expect(ctx.nrrd_states.view.changedHeight).toBe(1);
    expect(ctx.protectedData.canvases.displayCanvas.height).toBe(1);
  });

  it("leaves an unloaded (0x0) image at 0", () => {
    const { pipeline, ctx } = makePipeline(0, 0);
    pipeline.resizePaintArea(0.05);
    expect(ctx.nrrd_states.view.changedWidth).toBe(0);
    expect(ctx.nrrd_states.view.changedHeight).toBe(0);
  });
});

describe("ZoomTool wheel zoom with a minimum size factor", () => {
  let rafQueue: Array<() => void>;

  beforeEach(() => {
    rafQueue = [];
    vi.stubGlobal("requestAnimationFrame", (cb: () => void) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function makeZoom(sizeFactor: number, minSizeFactor: number) {
    const nrrd_states = new NrrdState(sizeFactor);
    nrrd_states.view.minSizeFactor = minSizeFactor;
    nrrd_states.image.originWidth = 200;
    nrrd_states.image.originHeight = 100;
    const ctx: any = {
      nrrd_states,
      gui_states: { mode: { sphereBrush: false, sphereEraser: false } },
      protectedData: {
        isDrawing: false,
        canvases: {
          drawingCanvas: { offsetLeft: 0, offsetTop: 0, offsetWidth: 200, offsetHeight: 100 },
        },
      },
      eventRouter: null,
    };
    const container: any = { getBoundingClientRect: () => ({ left: 0, top: 0 }) };
    const mainArea: any = { offsetLeft: 0, offsetTop: 0 };
    const callbacks = {
      resetPaintAreaUIPosition: vi.fn(),
      resizePaintArea: vi.fn(),
      setIsDrawFalse: vi.fn(),
    };
    const tool = new ZoomTool(ctx, container, mainArea, callbacks as any);
    return { onWheel: tool.configMouseZoomWheel(), nrrd_states, callbacks };
  }

  // `detail > 0` is a wheel-down tick, which zooms out by 10%.
  const wheel = (out: boolean): any => ({
    detail: out ? 3 : -3,
    clientX: 50,
    clientY: 50,
    preventDefault: () => {},
  });

  function spin(onWheel: (e: any) => void, out: boolean, ticks: number) {
    for (let i = 0; i < ticks; i++) {
      onWheel(wheel(out));
      rafQueue.splice(0).forEach((cb) => cb());
    }
  }

  it("stops zooming out at 1 by default", () => {
    const { onWheel, nrrd_states } = makeZoom(1.5, 1);
    spin(onWheel, true, 30);
    expect(nrrd_states.view.sizeFactor).toBe(1);
  });

  it("zooms out below 1 and stops at the minimum", () => {
    const { onWheel, nrrd_states, callbacks } = makeZoom(1, 0.3);
    spin(onWheel, true, 2);
    expect(nrrd_states.view.sizeFactor).toBeCloseTo(0.81, 10);
    spin(onWheel, true, 60);
    expect(nrrd_states.view.sizeFactor).toBe(0.3);
    expect(callbacks.resizePaintArea).toHaveBeenLastCalledWith(0.3);
  });

  it("clamps a pending zoom-out to a minimum raised before the frame flushes", () => {
    const { onWheel, nrrd_states, callbacks } = makeZoom(0.5, 0.3);
    onWheel(wheel(true)); // pending target 0.45, not yet flushed
    nrrd_states.view.minSizeFactor = 0.6; // host raises the minimum in the same frame
    nrrd_states.view.sizeFactor = 0.6;
    rafQueue.splice(0).forEach((cb) => cb());
    expect(nrrd_states.view.sizeFactor).toBe(0.6);
    expect(callbacks.resizePaintArea).toHaveBeenLastCalledWith(0.6);
  });

  it("still stops zooming in at 8", () => {
    const { onWheel, nrrd_states } = makeZoom(0.5, 0.3);
    spin(onWheel, false, 60);
    expect(nrrd_states.view.sizeFactor).toBe(8);
  });
});
