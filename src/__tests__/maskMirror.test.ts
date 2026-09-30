/**
 * A mirror draws the source's masks as the source draws them: its colours, its channel and
 * layer visibility, its opacity and its render mode, for the mirror's own slice.
 */
import { describe, expect, it, vi } from "vitest";
import { MaskVolume } from "../Utils/segmentation/core/MaskVolume";
import { MaskMirror } from "../Utils/segmentation/tools/MaskMirror";
import { RenderingUtils } from "../Utils/segmentation/RenderingUtils";

function sourceState(vol: MaskVolume, over: Partial<{ visible: boolean; opacity: number; mode: string; channelVis: Record<number, boolean> }> = {}) {
  return {
    nrrd_states: { image: { layers: ["findings1"] } },
    protectedData: { maskData: { volumes: { findings1: vol } } },
    gui_states: {
      mode: { sphere: false },
      drawing: { maskRenderMode: over.mode ?? "fill" },
      layerChannel: {
        layerVisibility: { findings1: over.visible ?? true },
        layerOpacity: { findings1: over.opacity ?? 0.5 },
        channelVisibility: { findings1: over.channelVis ?? {} },
      },
    },
  } as any;
}

function mirrorState(dims: number[], axis: "x" | "y" | "z" = "z", index = 0) {
  return {
    nrrd_states: { image: { dimensions: dims }, view: { currentSliceIndex: index } },
    protectedData: { axis },
  } as any;
}

function ctx() {
  const c: any = { fills: [] as { style: string; alpha: number }[], strokes: 0, globalAlpha: 1 };
  Object.assign(c, {
    save: vi.fn(), restore: vi.fn(), scale: vi.fn(), translate: vi.fn(),
    fill: vi.fn(() => c.fills.push({ style: c.fillStyle, alpha: c.globalAlpha })),
    stroke: vi.fn(() => { c.strokes += 1; }),
  });
  return c;
}

function finding() {
  const v = new MaskVolume(4, 4, 4, 1);
  v.setVoxel(1, 1, 0, 1);
  v.setVoxel(2, 2, 0, 2);
  v.setChannelColor(1, { r: 255, g: 0, b: 0, a: 255 });
  v.setChannelColor(2, { r: 0, g: 255, b: 0, a: 255 });
  return v;
}

describe("MaskMirror.paint", () => {
  it("paints the source's visible labels in the source's colours at the source's opacity", () => {
    const m = new MaskMirror(mirrorState([4, 4, 4]), sourceState(finding()), null);
    const c = ctx();
    m.paint(c, 8, 8);
    expect(c.fills.map((f: any) => f.style).sort()).toEqual(["rgba(0, 255, 0, 1)", "rgba(255, 0, 0, 1)"]);
    expect(c.fills.every((f: any) => f.alpha === 0.5)).toBe(true);
  });

  it("hides a layer the source hides and a channel the source hides", () => {
    const hiddenLayer = new MaskMirror(mirrorState([4, 4, 4]), sourceState(finding(), { visible: false }), null);
    const c1 = ctx();
    hiddenLayer.paint(c1, 8, 8);
    expect(c1.fill).not.toHaveBeenCalled();

    const hiddenChannel = new MaskMirror(mirrorState([4, 4, 4]), sourceState(finding(), { channelVis: { 2: false } }), null);
    const c2 = ctx();
    hiddenChannel.paint(c2, 8, 8);
    expect(c2.fills.map((f: any) => f.style)).toEqual(["rgba(255, 0, 0, 1)"]);
  });

  it("strokes when the source draws outlines", () => {
    const m = new MaskMirror(mirrorState([4, 4, 4]), sourceState(finding(), { mode: "outline" }), null);
    const c = ctx();
    m.paint(c, 8, 8);
    expect(c.strokes).toBe(2);
    expect(c.fill).not.toHaveBeenCalled();
  });

  it("resamples once per source version, not on every paint", () => {
    const vol = finding();
    const raw = vi.spyOn(vol, "getRawData");
    // A coarser mirror grid forces the resampling path.
    const m = new MaskMirror(mirrorState([2, 2, 2]), sourceState(vol), [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1]);
    m.paint(ctx(), 8, 8);
    m.paint(ctx(), 16, 16); // a zoom
    expect(raw).toHaveBeenCalledTimes(1);
    vol.setVoxel(0, 0, 0, 1); // an edit bumps the version
    m.paint(ctx(), 16, 16);
    expect(raw).toHaveBeenCalledTimes(2);
  });

  it("drops the cache when the source volume object changes", () => {
    const first = finding();
    const state = sourceState(first);
    const m = new MaskMirror(mirrorState([4, 4, 4]), state, null);
    m.paint(ctx(), 8, 8);
    // A case load replaces the volume; the fresh one may share the old version number.
    const next = new MaskVolume(4, 4, 4, 1);
    while (next.getVersion() < first.getVersion()) next.setVoxel(3, 3, 3, 0);
    expect(next.getVersion()).toBe(first.getVersion());
    state.protectedData.maskData.volumes.findings1 = next;
    const c = ctx();
    m.paint(c, 8, 8);
    expect(c.fill).not.toHaveBeenCalled(); // the new, empty volume — not the old contours
  });

  it("resamples for the mirror's own axis and slice", () => {
    const vol = finding();
    const slice = vi.spyOn(vol, "getSliceUint8");
    const m = new MaskMirror(mirrorState([4, 4, 4], "x", 2), sourceState(vol), null);
    m.paint(ctx(), 8, 8);
    expect(slice).toHaveBeenCalledWith(2, "x");
  });

  it("writes nothing to the source's masks", () => {
    const vol = finding();
    const before = vol.getVersion();
    const m = new MaskMirror(mirrorState([2, 2, 2]), sourceState(vol), [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 1]);
    m.paint(ctx(), 8, 8);
    expect(vol.getVersion()).toBe(before);
  });

  it("paints nothing while the source is in sphere mode, as the source hides its own layers then", () => {
    const state = sourceState(finding());
    const m = new MaskMirror(mirrorState([4, 4, 4]), state, null);
    state.gui_states.mode.sphere = true;
    const c = ctx();
    m.paint(c, 8, 8);
    expect(c.fill).not.toHaveBeenCalled();
    state.gui_states.mode.sphere = false;
    m.paint(c, 8, 8);
    expect(c.fill).toHaveBeenCalled();
  });

  it("restores the context even when painting a layer throws", () => {
    const vol = finding();
    vi.spyOn(vol, "getChannelColor").mockImplementation(() => { throw new Error("no colour"); });
    const m = new MaskMirror(mirrorState([4, 4, 4]), sourceState(vol), null);
    const c = ctx();
    m.paint(c, 8, 8);
    expect(c.save).toHaveBeenCalled();
    expect(c.restore).toHaveBeenCalledTimes(c.save.mock.calls.length);
  });

  it("paints nothing before the mirror has an image", () => {
    const m = new MaskMirror(mirrorState([]), sourceState(finding()), null);
    const c = ctx();
    expect(() => m.paint(c, 8, 8)).not.toThrow();
    expect(c.fill).not.toHaveBeenCalled();
  });
});

describe("RenderingUtils.compositeAllLayers with a mirror", () => {
  function renderer() {
    const master = ctx();
    master.clearRect = vi.fn();
    master.drawImage = vi.fn();
    const state: any = {
      nrrd_states: { image: { layers: [] }, view: { changedWidth: 8, changedHeight: 8 } },
      gui_states: { layerChannel: { layerVisibility: {}, layerOpacity: {} } },
      protectedData: { ctxes: { drawingLayerMasterCtx: master }, layerTargets: new Map() },
    };
    return { ru: new RenderingUtils(state), master };
  }

  it("paints the mirror onto the master after the viewer's own layers, then reports the composite", () => {
    const { ru, master } = renderer();
    const paint = vi.fn();
    ru.mirror = { paint } as any;
    const done = vi.fn();
    ru.onComposited = done;
    ru.compositeAllLayers();
    expect(master.clearRect).toHaveBeenCalled();
    expect(paint).toHaveBeenCalledWith(master, 8, 8);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("composites as before without a mirror", () => {
    const { ru } = renderer();
    expect(() => ru.compositeAllLayers()).not.toThrow();
  });
});
