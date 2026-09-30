/**
 * Attaching a viewer as another's mirror, refreshing it after the source composites, and
 * releasing the link from either end.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NrrdTools } from "../Utils/segmentation/NrrdTools";
import { MaskMirror } from "../Utils/segmentation/tools/MaskMirror";
import { SliceRenderPipeline } from "../Utils/segmentation/tools/SliceRenderPipeline";

/** A viewer with only what the mirror wiring touches. */
function viewer(): any {
  const v: any = Object.create(NrrdTools.prototype);
  v._mirrors = new Set();
  v._mirrorSource = null;
  v._mirrorFrame = null;
  v._sliceRAFId = null;
  v._pendingSliceStep = 0;
  v.state = {};
  v.drawCore = { eventRouter: null, renderer: { mirror: null, compositeAllLayers: vi.fn() } };
  return v;
}

let frames: Array<() => void>;
beforeEach(() => {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (cb: () => void) => { frames.push(cb); return frames.length; });
  vi.stubGlobal("cancelAnimationFrame", () => { frames = []; });
});
afterEach(() => vi.unstubAllGlobals());
const flush = () => frames.splice(0).forEach((cb) => cb());

describe("NrrdTools.setMaskMirror", () => {
  it("attaches a mirror that paints from the source, and repaints", () => {
    const src = viewer(), ref = viewer();
    ref.setMaskMirror(src, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    expect(ref.getMaskMirrorSource()).toBe(src);
    expect(ref.drawCore.renderer.mirror).toBeInstanceOf(MaskMirror);
    expect(ref.drawCore.renderer.mirror.source).toBe(src.state);
    expect(ref.drawCore.renderer.compositeAllLayers).toHaveBeenCalledTimes(1);
  });

  it("refreshes every mirror once, a frame after the source composites", () => {
    const src = viewer(), a = viewer(), b = viewer();
    a.setMaskMirror(src);
    b.setMaskMirror(src);
    a.drawCore.renderer.compositeAllLayers.mockClear();
    b.drawCore.renderer.compositeAllLayers.mockClear();
    src.scheduleMirrorRefresh();
    src.scheduleMirrorRefresh();
    expect(frames).toHaveLength(1);
    flush();
    expect(a.drawCore.renderer.compositeAllLayers).toHaveBeenCalledTimes(1);
    expect(b.drawCore.renderer.compositeAllLayers).toHaveBeenCalledTimes(1);
  });

  it("detaches on null, and the source then schedules nothing", () => {
    const src = viewer(), ref = viewer();
    ref.setMaskMirror(src);
    ref.setMaskMirror(null);
    expect(ref.drawCore.renderer.mirror).toBeNull();
    expect(ref.getMaskMirrorSource()).toBeNull();
    src.scheduleMirrorRefresh();
    expect(frames).toHaveLength(0);
  });

  it("moves to a new source, leaving the old one", () => {
    const one = viewer(), two = viewer(), ref = viewer();
    ref.setMaskMirror(one);
    ref.setMaskMirror(two);
    expect(one._mirrors.has(ref)).toBe(false);
    expect(two._mirrors.has(ref)).toBe(true);
  });

  it("ignores a viewer mirroring itself", () => {
    const v = viewer();
    v.setMaskMirror(v);
    expect(v.getMaskMirrorSource()).toBeNull();
    expect(v._mirrors.size).toBe(0);
  });

  it("a pending refresh skips a mirror detached before it runs", () => {
    const src = viewer(), ref = viewer();
    ref.setMaskMirror(src);
    src.scheduleMirrorRefresh();
    ref.setMaskMirror(null);
    ref.drawCore.renderer.compositeAllLayers.mockClear();
    flush();
    expect(ref.drawCore.renderer.compositeAllLayers).not.toHaveBeenCalled();
  });

  it("disposing the mirror leaves the source; disposing the source releases its mirrors", () => {
    const src = viewer(), a = viewer(), b = viewer();
    a.setMaskMirror(src);
    a.dispose();
    expect(src._mirrors.size).toBe(0);

    b.setMaskMirror(src);
    src.dispose();
    expect(b.getMaskMirrorSource()).toBeNull();
    expect(b.drawCore.renderer.mirror).toBeNull();
  });
});

describe("a real NrrdTools as a mirror source", () => {
  /** A 2D context whose every method is a no-op and every property is settable. */
  function fakeContext(canvas: HTMLCanvasElement): any {
    const props: Record<string | symbol, unknown> = { canvas };
    return new Proxy(props, {
      get: (t, k) => (k in t ? t[k] : () => ({ data: new Uint8ClampedArray(4) })),
      set: (t, k, v) => { t[k] = v; return true; },
    });
  }

  afterEach(() => vi.restoreAllMocks());

  it("queues a refresh of its mirrors whenever it composites", () => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
      return fakeContext(this);
    } as any);
    const real = new NrrdTools(document.createElement("div"), { layers: [] });
    const mirror = viewer();
    mirror.setMaskMirror(real);
    mirror.drawCore.renderer.compositeAllLayers.mockClear();
    frames.length = 0;

    (real as any).drawCore.renderer.compositeAllLayers();
    expect(frames).toHaveLength(1);
    flush();
    expect(mirror.drawCore.renderer.compositeAllLayers).toHaveBeenCalledTimes(1);
    real.dispose();
  });
});

describe("SliceRenderPipeline.reloadMasksFromVolume while mirroring", () => {
  it("composites instead of rendering own layers", () => {
    const p: any = Object.create(SliceRenderPipeline.prototype);
    p.ctx = { gui_states: { mode: { sphere: false } } };
    p.callbacks = { hasMaskMirror: () => true, compositeAllLayers: vi.fn(), getOrCreateSliceBuffer: vi.fn() };
    p.reloadMasksFromVolume();
    expect(p.callbacks.compositeAllLayers).toHaveBeenCalledTimes(1);
    expect(p.callbacks.getOrCreateSliceBuffer).not.toHaveBeenCalled();
  });
});
