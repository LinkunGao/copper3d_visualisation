/**
 * The heatmap view on a real NrrdTools: while it is visible the composite paints the heatmap
 * instead of every mask layer, slice and axis changes repaint only the heatmap, and the
 * public setters validate and repaint.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NrrdTools } from "../Utils/segmentation/NrrdTools";
import { HeatmapOverlay } from "../Utils/segmentation/tools/HeatmapOverlay";

/** A 2D context whose every method is a no-op and every property is settable. */
function fakeContext(canvas: HTMLCanvasElement): any {
  const props: Record<string | symbol, unknown> = { canvas };
  return new Proxy(props, {
    get: (t, k) => (k in t ? t[k] : () => ({ data: new Uint8ClampedArray(4) })),
    set: (t, k, v) => { t[k] = v; return true; },
  });
}

const DIMS: [number, number, number] = [4, 3, 2];
const voxels = () => new Uint8Array(DIMS[0] * DIMS[1] * DIMS[2]);

let tools: NrrdTools;
let t: any;
let renderer: any;
let master: any;
let paint: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    return fakeContext(this);
  } as any);
  tools = new NrrdTools(document.createElement("div"));
  t = tools as any;
  renderer = t.drawCore.renderer;
  master = t.state.protectedData.ctxes.drawingLayerMasterCtx;
  master.drawImage = vi.fn();
  renderer.onComposited = vi.fn();
  t.state.nrrd_states.image.dimensions = [...DIMS];
  t.state.nrrd_states.view.changedWidth = 8;
  t.state.nrrd_states.view.changedHeight = 6;
  t.state.nrrd_states.view.currentSliceIndex = 1;
  paint = vi.spyOn(HeatmapOverlay.prototype, "paint").mockImplementation(() => {});
});

afterEach(() => {
  tools.dispose();
  vi.restoreAllMocks();
});

describe("NrrdTools heatmap view", () => {
  it("starts hidden at threshold 0.10 and opacity 0.5", () => {
    expect(t.state.gui_states.heatmap).toEqual({ visible: false, threshold: 0.1, opacity: 0.5 });
    expect(tools.isHeatmapVisible()).toBe(false);
    expect(renderer.heatmap).toBeNull();
  });

  it("a visible heatmap is painted instead of every layer", () => {
    tools.setHeatmap(voxels(), DIMS);
    tools.setHeatmapVisible(true);
    expect(tools.isHeatmapVisible()).toBe(true);

    paint.mockClear();
    master.drawImage.mockClear();
    renderer.onComposited.mockClear();
    renderer.compositeAllLayers();
    expect(paint).toHaveBeenCalledTimes(1);
    // The context is a Proxy, so compare it by identity rather than structurally.
    expect(paint.mock.calls[0][0]).toBe(master);
    expect(paint.mock.calls[0].slice(1)).toEqual(["z", 1, 8, 6, 0.1, 0.5]);
    expect(master.drawImage).not.toHaveBeenCalled();
    expect(renderer.onComposited).toHaveBeenCalledTimes(1);

    tools.setHeatmapVisible(false);
    expect(tools.isHeatmapVisible()).toBe(false);
    paint.mockClear();
    master.drawImage.mockClear();
    renderer.compositeAllLayers();
    expect(paint).not.toHaveBeenCalled();
    const layerCanvases = [...t.state.protectedData.layerTargets.values()].map((l: any) => l.canvas);
    expect(layerCanvases).toHaveLength(3);
    expect(master.drawImage.mock.calls.map((c: unknown[]) => c[0])).toEqual(layerCanvases);
  });

  it("hiding the heatmap re-renders the layers", () => {
    tools.setHeatmap(voxels(), DIMS);
    tools.setHeatmapVisible(true);
    vi.spyOn(renderer, "getOrCreateSliceBuffer").mockReturnValue({});
    const render = vi.spyOn(renderer, "renderSliceToCanvas").mockImplementation(() => {});
    tools.setHeatmapVisible(false);
    expect(render).toHaveBeenCalledTimes(3);
  });

  it("a slice or axis change repaints only the heatmap", () => {
    tools.setHeatmap(voxels(), DIMS);
    tools.setHeatmapVisible(true);
    vi.spyOn(renderer, "getOrCreateSliceBuffer").mockReturnValue({});
    const render = vi.spyOn(renderer, "renderSliceToCanvas").mockImplementation(() => {});
    const composite = vi.spyOn(renderer, "compositeAllLayers");
    paint.mockClear();

    t.state.nrrd_states.view.currentSliceIndex = 0;
    t.reloadMasksFromVolume();
    t.state.protectedData.axis = "x";
    t.state.nrrd_states.view.currentSliceIndex = 3;
    t.reloadMasksFromVolume();

    expect(composite).toHaveBeenCalledTimes(2);
    expect(render).not.toHaveBeenCalled();
    expect(paint.mock.calls.map((c: unknown[]) => [c[1], c[2]])).toEqual([["z", 0], ["x", 3]]);
  });

  it("paints the slice index clamped to the current axis", () => {
    tools.setHeatmap(voxels(), DIMS);
    tools.setHeatmapVisible(true);
    paint.mockClear();
    // Just after an axis switch the index may still belong to the previous axis.
    t.state.nrrd_states.view.currentSliceIndex = 3;
    renderer.compositeAllLayers();
    t.state.nrrd_states.view.currentSliceIndex = -1;
    renderer.compositeAllLayers();
    expect(paint.mock.calls.map((c: unknown[]) => c[2])).toEqual([1, 0]);
  });

  it("a visible heatmap view with no volume draws nothing", () => {
    vi.spyOn(renderer, "getOrCreateSliceBuffer").mockReturnValue({});
    const render = vi.spyOn(renderer, "renderSliceToCanvas").mockImplementation(() => {});
    for (const set of [false, true]) {
      if (set) {
        tools.setHeatmap(voxels(), DIMS);
        tools.setHeatmap(null);
      }
      tools.setHeatmapVisible(true);
      paint.mockClear();
      master.drawImage.mockClear();
      renderer.onComposited.mockClear();
      renderer.compositeAllLayers();
      expect(master.drawImage).not.toHaveBeenCalled();
      expect(renderer.onComposited).toHaveBeenCalledTimes(1);

      const composite = vi.spyOn(renderer, "compositeAllLayers");
      t.reloadMasksFromVolume();
      expect(composite).toHaveBeenCalledTimes(1);
      expect(render).not.toHaveBeenCalled();
      expect(master.drawImage).not.toHaveBeenCalled();
      expect(paint).not.toHaveBeenCalled();
      composite.mockRestore();
    }
  });

  it("setHeatmap refuses dimensions other than the image's", () => {
    expect(() => tools.setHeatmap(voxels(), [2, 3, 4])).toThrow(/heatmap/);
    expect(() => tools.setHeatmap(voxels())).toThrow(/heatmap/);
    expect(() => tools.setHeatmap(new Uint8Array(5), DIMS)).toThrow(/heatmap/);
    expect(renderer.heatmap).toBeNull();

    t.state.nrrd_states.image.dimensions = [];
    expect(() => tools.setHeatmap(voxels(), DIMS)).toThrow(/heatmap/);
    expect(renderer.heatmap).toBeNull();
  });

  it("setHeatmap(null) clears", () => {
    tools.setHeatmap(voxels(), DIMS);
    expect(renderer.heatmap).toBeInstanceOf(HeatmapOverlay);
    expect(renderer.heatmap.dims).toEqual(DIMS);

    tools.setHeatmapVisible(true);
    tools.setHeatmap(null);
    expect(renderer.heatmap).toBeNull();
    paint.mockClear();
    master.drawImage.mockClear();
    renderer.compositeAllLayers();
    expect(paint).not.toHaveBeenCalled();
  });

  it("threshold and opacity are clamped to 0–1 and repaint", () => {
    tools.setHeatmap(voxels(), DIMS);
    tools.setHeatmapVisible(true);
    const composite = vi.spyOn(renderer, "compositeAllLayers");

    tools.setHeatmapThreshold(1.5);
    expect(t.state.gui_states.heatmap.threshold).toBe(1);
    tools.setHeatmapThreshold(-0.2);
    expect(t.state.gui_states.heatmap.threshold).toBe(0);
    tools.setHeatmapOpacity(2);
    expect(t.state.gui_states.heatmap.opacity).toBe(1);
    tools.setHeatmapOpacity(-1);
    expect(t.state.gui_states.heatmap.opacity).toBe(0);
    expect(composite).toHaveBeenCalledTimes(4);

    tools.setHeatmapThreshold(0.3);
    tools.setHeatmapOpacity(0.7);
    const last = paint.mock.calls[paint.mock.calls.length - 1];
    expect(last.slice(5)).toEqual([0.3, 0.7]);
  });
});

describe("NrrdTools heatmap view on screen", () => {
  /** One loaded slice, enough for draw(), a slice step and a resize to run. */
  function primeSlices(): void {
    const pd = t.state.protectedData;
    const slice = { index: 0, initIndex: 0, RSARatio: 1, MaxIndex: 1, repaint: () => {}, canvas: document.createElement("canvas") };
    pd.displaySlices.push(slice);
    pd.mainPreSlices = slice;
    pd.currentShowingSlice = slice;
    const origin = document.createElement("canvas");
    origin.width = 4;
    origin.height = 3;
    pd.canvases.originCanvas = origin;
    t.state.nrrd_states.image.originWidth = 4;
    t.state.nrrd_states.image.originHeight = 3;
    t.state.nrrd_states.view.maxIndex = 1;
    t.state.nrrd_states.view.currentSliceIndex = 0;
  }

  /** Records paints and clears of the master canvas, in order. */
  function masterLog(): string[] {
    const log: string[] = [];
    paint.mockImplementation(() => { log.push("paint"); });
    master.clearRect = vi.fn(() => { log.push("clear"); });
    return log;
  }

  it("the heatmap is drawn at its own opacity, whatever the mask opacity", () => {
    primeSlices();
    tools.draw();
    const drawing = t.state.protectedData.ctxes.drawingCtx;
    const masterCanvas = t.state.protectedData.canvases.drawingCanvasLayerMaster;
    const alphaAtMaster: number[] = [];
    drawing.drawImage = vi.fn((src: unknown) => {
      if (src === masterCanvas) alphaAtMaster.push(drawing.globalAlpha);
    });
    t.state.gui_states.drawing.globalAlpha = 0.6;

    tools.setHeatmap(voxels(), DIMS);
    tools.setHeatmapVisible(true);
    t.drawCore.renderFrame();
    // What is drawn after the master keeps the mask opacity.
    expect(drawing.globalAlpha).toBe(0.6);
    tools.setHeatmapVisible(false);
    t.drawCore.renderFrame();
    expect(alphaAtMaster).toEqual([1, 0.6]);
  });

  it("a slice step repaints the heatmap and renders no layer", () => {
    primeSlices();
    tools.setHeatmap(voxels(), DIMS);
    tools.setHeatmapVisible(true);
    // DragOperator holds renderSliceToCanvas bound at construction; its body still calls drawSlice.
    const render = vi.spyOn(renderer, "drawSlice").mockImplementation(() => {});
    paint.mockClear();
    t.dragOperator.updateIndex(1);
    expect(render).not.toHaveBeenCalled();
    expect(paint.mock.calls.map((c: unknown[]) => [c[1], c[2]])).toEqual([["z", 1]]);
  });

  it("with Sphere or Calculator selected, a slice step repaints the heatmap", () => {
    primeSlices();
    tools.setHeatmap(voxels(), DIMS);
    tools.setHeatmapVisible(true);
    t.state.gui_states.mode.sphere = true;
    paint.mockClear();
    t.dragOperator.updateIndex(1);
    expect(paint.mock.calls.map((c: unknown[]) => [c[1], c[2]])).toEqual([["z", 1]]);
  });

  it("with Sphere or Calculator selected, an axis switch repaints the heatmap", () => {
    primeSlices();
    tools.setHeatmap(voxels(), DIMS);
    tools.setHeatmapVisible(true);
    t.state.gui_states.mode.sphere = true;
    paint.mockClear();
    t.state.protectedData.axis = "x";
    tools.resizePaintArea(1);
    expect(paint.mock.calls.map((c: unknown[]) => c[1])).toContain("x");
    expect(paint.mock.calls[paint.mock.calls.length - 1][1]).toBe("x");
  });

  it("with Sphere or Calculator selected, hiding removes the heatmap from the master", () => {
    tools.setHeatmap(voxels(), DIMS);
    const log = masterLog();
    tools.setHeatmapVisible(true);
    t.state.gui_states.mode.sphere = true;
    tools.setHeatmapVisible(false);
    expect(log[log.length - 1]).toBe("clear");
    expect(log.lastIndexOf("paint")).toBeLessThan(log.lastIndexOf("clear"));
  });

  it("in a viewer with no layers and no mirror, hiding removes the heatmap", () => {
    tools.dispose();
    tools = new NrrdTools(document.createElement("div"), { layers: [] });
    t = tools as any;
    renderer = t.drawCore.renderer;
    master = t.state.protectedData.ctxes.drawingLayerMasterCtx;
    t.state.nrrd_states.image.dimensions = [...DIMS];
    tools.setHeatmap(voxels(), DIMS);
    const log = masterLog();
    tools.setHeatmapVisible(true);
    tools.setHeatmapVisible(false);
    expect(log[log.length - 1]).toBe("clear");
    expect(log.lastIndexOf("paint")).toBeLessThan(log.lastIndexOf("clear"));
  });
});
