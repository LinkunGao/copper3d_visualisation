/**
 * Showing one slice of a volume before the volume has loaded: a depth-1 slice shown as slice
 * `index` of the full stack, slice moves handed to the host while previewing, and the full
 * volume taking over at the same index.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NrrdTools } from "../Utils/segmentation/NrrdTools";

/** A 2D context whose every method is a no-op and every property is settable. */
function fakeContext(canvas: HTMLCanvasElement): any {
  const props: Record<string | symbol, unknown> = { canvas };
  return new Proxy(props, {
    get: (t, k) => (k in t ? t[k] : () => ({ data: new Uint8ClampedArray(4) })),
    set: (t, k, v) => { t[k] = v; return true; },
  });
}

let frames: Array<() => void>;
beforeEach(() => {
  frames = [];
  vi.stubGlobal("requestAnimationFrame", (cb: () => void) => { frames.push(cb); return frames.length; });
  vi.stubGlobal("cancelAnimationFrame", () => { frames = []; });
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (this: HTMLCanvasElement) {
    return fakeContext(this);
  } as any);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const flushFrames = () => frames.splice(0).forEach((cb) => cb());

function makeTools(): NrrdTools {
  return new NrrdTools(document.createElement("div"), { layers: [] });
}

/** A slice triple the engine can display: a canvas-backed z plane plus x/y stand-ins. */
function sliceTriple(depth: number, index = 0, rsa = 1) {
  const plane = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 8; canvas.height = 6;
    return { canvas, index, initIndex: index, MaxIndex: depth - 1, RSARatio: rsa, RSAMaxIndex: depth * rsa - 1,
      repaint: vi.fn(), contrastOrder: 0, volume: { dimensions: [8, 6, depth], spacing: [1, 1, rsa], header: { space_origin: [0, 0, 0] } } };
  };
  return { x: plane(), y: plane(), z: plane() } as any;
}
const header = { dimensions: [8, 6, 50], spacing: [1, 1, 1], space_origin: [0, 0, 0] };

describe("NrrdTools.showPreviewSlice", () => {
  it("shows a depth-1 slice as slice `index` of the full stack", () => {
    const t = makeTools();
    t.showPreviewSlice(header, sliceTriple(50, 25), 40, vi.fn());
    expect(t.getCurrentSlicesNumAndContrastNum().currentSliceIndex).toBe(40);
    expect(t.getCurrentImageDimension()).toEqual([8, 6, 50]);
    expect(t.isPreviewing()).toBe(true);
  });

  it("a second preview moves the index and leaves the depth-1 slice's own index alone", () => {
    const t = makeTools();
    t.showPreviewSlice(header, sliceTriple(50, 25), 40, vi.fn());
    const next = sliceTriple(50, 25);
    t.showPreviewSlice(header, next, 41, vi.fn());
    expect(t.getCurrentSlicesNumAndContrastNum().currentSliceIndex).toBe(41);
    expect(next.z.index).toBe(25); // never set to the full-stack index
  });

  it("re-initialises geometry only when it changes", () => {
    const t = makeTools();
    const init = vi.spyOn((t as any).dataLoader, "initFromHeader");
    t.showPreviewSlice(header, sliceTriple(50), 10, vi.fn());
    t.showPreviewSlice(header, sliceTriple(50), 11, vi.fn());
    expect(init).toHaveBeenCalledTimes(1);
    t.showPreviewSlice({ ...header, dimensions: [8, 6, 60] }, sliceTriple(60), 11, vi.fn());
    expect(init).toHaveBeenCalledTimes(2);
  });

  it("hands a slice move to onSliceMove while previewing, clamped, without moving", () => {
    const t = makeTools();
    const onMove = vi.fn();
    t.showPreviewSlice(header, sliceTriple(50), 48, onMove);
    t.setSliceMoving(5);
    flushFrames();
    expect(onMove).toHaveBeenLastCalledWith(49);
    expect(t.getCurrentSlicesNumAndContrastNum().currentSliceIndex).toBe(48);
  });

  it("a preview over a shown volume keeps its index and zoom", () => {
    const t = makeTools();
    t.setAllSlices([sliceTriple(50, 33)]);
    t.setMainAreaSize(2);
    expect(t.getCurrentSlicesNumAndContrastNum().currentSliceIndex).toBe(33);
    expect(t.getNrrdToolsSettings().view.sizeFactor).toBe(2);

    t.showPreviewSlice(header, sliceTriple(50, 0), 33, vi.fn());
    expect(t.getCurrentSlicesNumAndContrastNum().currentSliceIndex).toBe(33);
    expect(t.getNrrdToolsSettings().view.sizeFactor).toBe(2);
    expect(t.isPreviewing()).toBe(true);
  });

  it("the full volume keeps the preview's index and ends previewing", () => {
    const t = makeTools();
    t.showPreviewSlice(header, sliceTriple(50), 41, vi.fn());
    t.switchSlicesPreservingView([sliceTriple(50, 25)]);
    expect(t.getCurrentSlicesNumAndContrastNum().currentSliceIndex).toBe(41);
    expect(t.isPreviewing()).toBe(false);
    t.setSliceMoving(1);
    flushFrames();
    expect(t.getCurrentSlicesNumAndContrastNum().currentSliceIndex).toBe(42);
  });
});
