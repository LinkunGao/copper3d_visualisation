/**
 * A read-only engine (`new NrrdTools(host, { layers: [] })`) has no mask layers by design.
 * Moving its slice must not read a mask volume, and must not report its own legitimate state
 * as an "unknown layer" warning. An unknown id on an engine that does have layers still warns.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { RenderingUtils } from "../Utils/segmentation/RenderingUtils";
import { SliceRenderPipeline } from "../Utils/segmentation/tools/SliceRenderPipeline";

function renderingUtils(volumes: Record<string, unknown>, layers: string[], active?: string) {
  return new RenderingUtils({
    protectedData: { maskData: { volumes } },
    nrrd_states: { image: { layers } },
    gui_states: { layerChannel: { layer: active } },
  } as any);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RenderingUtils.getVolumeForLayer", () => {
  it("returns undefined without warning when the engine has no layers", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ru = renderingUtils({}, []);

    expect(ru.getCurrentVolume()).toBeUndefined();
    expect(ru.getVolumeForLayer("layer1")).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it("still warns and falls back to the first layer for an unknown id", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const first = { id: "first" };
    const ru = renderingUtils({ layer1: first }, ["layer1"]);

    expect(ru.getVolumeForLayer("nope")).toBe(first);
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe("SliceRenderPipeline.reloadMasksFromVolume on a layerless engine", () => {
  function pipeline(mirror: boolean) {
    const callbacks = {
      hasMaskMirror: vi.fn(() => mirror),
      compositeAllLayers: vi.fn(),
      getVolumeForLayer: vi.fn(),
      getOrCreateSliceBuffer: vi.fn(),
      renderSliceToCanvas: vi.fn(),
    };
    const p: any = Object.create(SliceRenderPipeline.prototype);
    p.callbacks = callbacks;
    p.ctx = {
      gui_states: { mode: { sphere: false } },
      protectedData: { axis: "z", layerTargets: new Map() },
      nrrd_states: { image: { layers: [] }, view: { currentSliceIndex: 3, changedWidth: 10, changedHeight: 10 } },
    };
    return { p, callbacks };
  }

  it("reads no mask volume", () => {
    const { p, callbacks } = pipeline(false);
    p.reloadMasksFromVolume();

    expect(callbacks.getVolumeForLayer).not.toHaveBeenCalled();
    expect(callbacks.getOrCreateSliceBuffer).not.toHaveBeenCalled();
  });

  it("still composites when it mirrors another viewer's mask", () => {
    const { p, callbacks } = pipeline(true);
    p.reloadMasksFromVolume();

    expect(callbacks.compositeAllLayers).toHaveBeenCalledOnce();
  });
});
