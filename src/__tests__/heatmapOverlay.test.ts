import { describe, expect, it, vi } from "vitest";
import {
  HEATMAP_COLORMAP,
  HEATMAP_MAX_UPSAMPLE,
  HeatmapOverlay,
  heatmapThresholdByte,
  isHeatmapShown,
} from "../Utils/segmentation/tools/HeatmapOverlay";
import { MaskVolume } from "../Utils/segmentation/core/MaskVolume";

type Axis = "x" | "y" | "z";

const rgb = (i: number) => Array.from(HEATMAP_COLORMAP.subarray(i * 4, i * 4 + 3));

function fakeCanvas(log: string[] = [], puts: Uint8ClampedArray[] = []) {
  return (w: number, h: number) => {
    const ctx = {
      createImageData: (cw: number, ch: number) => ({
        data: new Uint8ClampedArray(cw * ch * 4),
        width: cw,
        height: ch,
      }),
      putImageData: (img: { data: Uint8ClampedArray }) => {
        log.push("put");
        puts.push(img.data.slice());
      },
    };
    return { width: w, height: h, getContext: () => ctx } as unknown as HTMLCanvasElement;
  };
}

function recordingCtx(opacity?: number) {
  const calls: string[] = [];
  const seen: { smoothing?: boolean; alpha?: number } = {};
  const ctx: Record<string, unknown> = {
    imageSmoothingEnabled: false,
    globalAlpha: 1,
    save: () => calls.push("save"),
    restore: () => calls.push("restore"),
    translate: (x: number, y: number) => calls.push(`translate(${x},${y})`),
    scale: (x: number, y: number) => calls.push(`scale(${x},${y})`),
    drawImage: () => {
      calls.push("drawImage");
      seen.smoothing = ctx.imageSmoothingEnabled as boolean;
      seen.alpha = ctx.globalAlpha as number;
    },
  };
  void opacity;
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, seen };
}

describe("HeatmapOverlay colour scale", () => {
  it("hits its stops", () => {
    expect(rgb(0)).toEqual([0, 0, 128]);
    expect(rgb(32)).toEqual([0, 0, 255]);
    expect(rgb(96)).toEqual([0, 255, 255]);
    expect(rgb(159)).toEqual([255, 255, 0]);
    expect(rgb(223)).toEqual([255, 0, 0]);
    expect(rgb(255)).toEqual([128, 0, 0]);
    const mid = rgb(64);
    expect(mid[0]).toBe(0);
    expect([127, 128]).toContain(mid[1]);
    expect(mid[2]).toBe(255);
    expect(HEATMAP_COLORMAP.length).toBe(256 * 4);
    for (let i = 0; i < 256; i++) expect(HEATMAP_COLORMAP[i * 4 + 3]).toBe(255);
  });

  it("threshold byte", () => {
    expect(heatmapThresholdByte(0)).toBe(0);
    expect(heatmapThresholdByte(0.1)).toBe(26);
    expect(heatmapThresholdByte(1)).toBe(255);
  });

  it("isHeatmapShown reads gui_states.heatmap.visible", () => {
    expect(isHeatmapShown({ gui_states: {} })).toBe(false);
    expect(isHeatmapShown({ gui_states: { heatmap: { visible: false } } })).toBe(false);
    expect(isHeatmapShown({ gui_states: { heatmap: { visible: true } } })).toBe(true);
  });
});

describe("HeatmapOverlay slices", () => {
  it("uses MaskVolume's slice layout", () => {
    const [W, H, D] = [5, 4, 3];
    const vox: [number, number, number] = [1, 2, 0];
    const mv = new MaskVolume(W, H, D, 1);
    mv.setVoxel(vox[0], vox[1], vox[2], 1);
    const vol = new Uint8Array(W * H * D);
    vol[vox[2] * W * H + vox[1] * W + vox[0]] = 255;
    const overlay = new HeatmapOverlay(vol, [W, H, D], fakeCanvas());
    const index: Record<Axis, number> = { x: vox[0], y: vox[1], z: vox[2] };
    for (const axis of ["x", "y", "z"] as Axis[]) {
      const ref = mv.getSliceUint8(index[axis], axis);
      const out = overlay.sliceRGBA(axis, index[axis], 1);
      expect([out.width, out.height]).toEqual([ref.width, ref.height]);
      const want = ref.data.findIndex((v) => v !== 0);
      const opaque: number[] = [];
      for (let p = 0; p < out.width * out.height; p++) if (out.data[p * 4 + 3] !== 0) opaque.push(p);
      expect(opaque).toEqual([want]);
    }
  });

  it("draws nothing below the threshold", () => {
    const vol = new Uint8Array(2 * 2 * 1);
    vol[0] = 20;
    const overlay = new HeatmapOverlay(vol, [2, 2, 1], fakeCanvas());
    expect(overlay.sliceRGBA("z", 0, 26).data[3]).toBe(0);
    expect(overlay.sliceRGBA("z", 0, 20).data[3]).toBe(255);
    expect(overlay.sliceRGBA("z", 0, 0).data[7]).toBe(255);
  });
});

describe("HeatmapOverlay.paint", () => {
  const make = () => new HeatmapOverlay(new Uint8Array(3 * 2 * 2).fill(100), [3, 2, 2], fakeCanvas());

  it("runs rows up for coronal and sagittal only", () => {
    for (const axis of ["y", "x"] as Axis[]) {
      const { ctx, calls, seen } = recordingCtx();
      make().paint(ctx, axis, 0, 30, 20, 0.1, 0.4);
      const t = calls.indexOf("translate(0,20)");
      const s = calls.indexOf("scale(1,-1)");
      const d = calls.indexOf("drawImage");
      expect(t).toBeGreaterThanOrEqual(0);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThan(d);
      expect(s).toBeLessThan(d);
      // Smooth drawing supersedes the earlier block drawing; the fake starts with smoothing off.
      expect(seen).toEqual({ smoothing: true, alpha: 0.4 });
      expect(calls[0]).toBe("save");
      expect(calls[calls.length - 1]).toBe("restore");
    }
    const { ctx, calls } = recordingCtx();
    make().paint(ctx, "z", 0, 30, 20, 0.1, 0.4);
    expect(calls.some((c) => c.startsWith("translate") || c.startsWith("scale"))).toBe(false);
    expect(calls).toContain("drawImage");
  });

  it("reuses the slice across zoom and rebuilds on a new threshold", () => {
    const overlay = make();
    const spy = vi.spyOn(overlay, "sliceRGBA");
    const { ctx } = recordingCtx();
    overlay.paint(ctx, "z", 0, 30, 20, 0.1, 0.5);
    overlay.paint(ctx, "z", 0, 60, 40, 0.1, 0.5);
    expect(spy).toHaveBeenCalledTimes(1);
    overlay.paint(ctx, "z", 0, 60, 40, 0.5, 0.5);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("asks for the factors of the displayed size per axis and rebuilds when a factor changes", () => {
    const overlay = make();
    const spy = vi.spyOn(overlay, "sliceRGBA");
    const { ctx } = recordingCtx();
    overlay.paint(ctx, "z", 0, 6, 20, 0.1, 0.5);
    expect(spy).toHaveBeenLastCalledWith("z", 0, 26, 2, 4, expect.anything());
    overlay.paint(ctx, "z", 0, 6, 20, 0.1, 0.5);
    expect(spy).toHaveBeenCalledTimes(1);
    overlay.paint(ctx, "z", 0, 6, 8, 0.1, 0.5);
    expect(spy).toHaveBeenLastCalledWith("z", 0, 26, 2, 4, expect.anything());
    expect(spy).toHaveBeenCalledTimes(1);
    overlay.paint(ctx, "z", 0, 12, 8, 0.1, 0.5);
    expect(spy).toHaveBeenLastCalledWith("z", 0, 26, 4, 4, expect.anything());
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe("HeatmapOverlay buffer reuse", () => {
  it("a rebuild at the same raster size keeps no pixel of the previous slice", () => {
    const [W, H, D] = [3, 2, 2];
    const vol = new Uint8Array(W * H * D);
    vol.fill(200, 0, W * H);
    const puts: Uint8ClampedArray[] = [];
    const overlay = new HeatmapOverlay(vol, [W, H, D], fakeCanvas([], puts));
    const { ctx } = recordingCtx();
    overlay.paint(ctx, "z", 0, 6, 4, 0.1, 1);
    overlay.paint(ctx, "z", 1, 6, 4, 0.1, 1);
    expect(puts).toHaveLength(2);
    expect(puts[0].some((v) => v !== 0)).toBe(true);
    expect(puts[1].every((v) => v === 0)).toBe(true);
    overlay.paint(ctx, "z", 0, 6, 4, 0.9, 1);
    expect(puts[2].every((v) => v === 0)).toBe(true);
  });

  it("sliceRGBA writes into a given buffer, and refuses one of the wrong length", () => {
    const overlay = new HeatmapOverlay(new Uint8Array([0, 255]), [2, 1, 1], fakeCanvas());
    const fresh = overlay.sliceRGBA("z", 0, 0, 4, 4);
    const buf = new Uint8ClampedArray(8 * 4 * 4).fill(7);
    const out = overlay.sliceRGBA("z", 0, 0, 4, 4, buf);
    expect(out.data).toBe(buf);
    expect(Array.from(buf)).toEqual(Array.from(fresh.data));
    expect(() => overlay.sliceRGBA("z", 0, 0, 4, 4, new Uint8ClampedArray(10))).toThrow();
  });
});

describe("HeatmapOverlay interpolation", () => {
  const alphaAt = (out: { data: Uint8ClampedArray }, p: number) => out.data[p * 4 + 3];
  const colourAt = (out: { data: Uint8ClampedArray }, p: number) =>
    Array.from(out.data.subarray(p * 4, p * 4 + 3));

  it("rasterFactor is the displayed-to-voxel ratio, rounded up and capped", () => {
    expect(HEATMAP_MAX_UPSAMPLE).toBe(4);
    expect(HeatmapOverlay.rasterFactor(900, 384)).toBe(3);
    expect(HeatmapOverlay.rasterFactor(384, 384)).toBe(1);
    expect(HeatmapOverlay.rasterFactor(100, 384)).toBe(1);
    expect(HeatmapOverlay.rasterFactor(5000, 384)).toBe(4);
  });

  it("interpolates the probability, not the colours", () => {
    const overlay = new HeatmapOverlay(new Uint8Array([0, 255]), [2, 1, 1], fakeCanvas());
    const out = overlay.sliceRGBA("z", 0, 0, 4, 4);
    expect([out.width, out.height]).toEqual([8, 4]);
    const want = [0, 0, 32, 96, 159, 223, 255, 255];
    for (let px = 0; px < 8; px++) expect(colourAt(out, px)).toEqual(rgb(want[px]));
  });

  it("the edge is where the interpolated value meets the threshold", () => {
    const overlay = new HeatmapOverlay(new Uint8Array([0, 255]), [2, 1, 1], fakeCanvas());
    const out = overlay.sliceRGBA("z", 0, 128, 4, 1);
    for (let px = 0; px < 8; px++) expect(alphaAt(out, px)).toBe(px < 4 ? 0 : 255);
  });

  it("an isolated voxel's peak is centred on its block", () => {
    const [W, H, D] = [5, 4, 3];
    const vox: [number, number, number] = [2, 1, 1];
    const mv = new MaskVolume(W, H, D, 1);
    mv.setVoxel(vox[0], vox[1], vox[2], 255);
    const vol = new Uint8Array(W * H * D);
    vol[vox[2] * W * H + vox[1] * W + vox[0]] = 255;
    const overlay = new HeatmapOverlay(vol, [W, H, D], fakeCanvas());
    const index: Record<Axis, number> = { x: vox[0], y: vox[1], z: vox[2] };
    for (const axis of ["x", "y", "z"] as Axis[]) {
      const ref = mv.getSliceUint8(index[axis], axis);
      const at = ref.data.findIndex((v) => v !== 0);
      const c = at % ref.width;
      const r = Math.floor(at / ref.width);
      const out = overlay.sliceRGBA(axis, index[axis], 190, 4, 4);
      expect([out.width, out.height]).toEqual([ref.width * 4, ref.height * 4]);
      const drawn: number[] = [];
      for (let p = 0; p < out.width * out.height; p++) if (alphaAt(out, p) !== 0) drawn.push(p);
      const middle = [4 * r + 1, 4 * r + 2].flatMap((py) =>
        [4 * c + 1, 4 * c + 2].map((px) => py * out.width + px),
      );
      expect(drawn).toEqual(middle);
      for (const p of middle) expect(colourAt(out, p)).toEqual(colourAt(out, middle[0]));
    }
  });

  it("an isolated voxel's peak is centred at unequal factors on every axis", () => {
    const [W, H, D] = [5, 4, 3];
    const vox: [number, number, number] = [2, 1, 1];
    const mv = new MaskVolume(W, H, D, 1);
    mv.setVoxel(vox[0], vox[1], vox[2], 255);
    const vol = new Uint8Array(W * H * D);
    vol[vox[2] * W * H + vox[1] * W + vox[0]] = 255;
    const overlay = new HeatmapOverlay(vol, [W, H, D], fakeCanvas());
    const index: Record<Axis, number> = { x: vox[0], y: vox[1], z: vox[2] };
    for (const axis of ["x", "y", "z"] as Axis[]) {
      const ref = mv.getSliceUint8(index[axis], axis);
      const at = ref.data.findIndex((v) => v !== 0);
      const c = at % ref.width;
      const r = Math.floor(at / ref.width);
      const out = overlay.sliceRGBA(axis, index[axis], 150, 2, 4);
      expect([out.width, out.height]).toEqual([ref.width * 2, ref.height * 4]);
      const drawn: number[] = [];
      for (let p = 0; p < out.width * out.height; p++) if (alphaAt(out, p) !== 0) drawn.push(p);
      const middle = [4 * r + 1, 4 * r + 2].flatMap((py) =>
        [2 * c, 2 * c + 1].map((px) => py * out.width + px),
      );
      expect(drawn).toEqual(middle);
    }
  });

  it("refuses a factor that is not an integer of at least 1", () => {
    const overlay = new HeatmapOverlay(new Uint8Array([0, 255]), [2, 1, 1], fakeCanvas());
    expect(() => overlay.sliceRGBA("z", 0, 0, 1.5, 1)).toThrow();
    expect(() => overlay.sliceRGBA("z", 0, 0, 1, 0)).toThrow();
  });

  it("the edges clamp", () => {
    const overlay = new HeatmapOverlay(new Uint8Array([10, 200, 60, 250]), [2, 2, 1], fakeCanvas());
    const out = overlay.sliceRGBA("z", 0, 0, 4, 4);
    const corner = (px: number, py: number) => colourAt(out, py * out.width + px);
    expect(corner(0, 0)).toEqual(rgb(10));
    expect(corner(7, 0)).toEqual(rgb(200));
    expect(corner(0, 7)).toEqual(rgb(60));
    expect(corner(7, 7)).toEqual(rgb(250));
  });

  it("threshold 0 draws every pixel", () => {
    const overlay = new HeatmapOverlay(new Uint8Array(3 * 2 * 1), [3, 2, 1], fakeCanvas());
    const out = overlay.sliceRGBA("z", 0, 0, 3, 2);
    expect([out.width, out.height]).toEqual([9, 4]);
    for (let p = 0; p < out.width * out.height; p++) expect(alphaAt(out, p)).toBe(255);
  });

  it("factor 1 is each voxel's own colour, on every axis", () => {
    const [W, H, D] = [5, 4, 3];
    const mv = new MaskVolume(W, H, D, 1);
    const vol = new Uint8Array(W * H * D);
    for (let k = 0; k < D; k++)
      for (let j = 0; j < H; j++)
        for (let i = 0; i < W; i++) {
          const v = (i * 37 + j * 71 + k * 113) % 256;
          vol[k * W * H + j * W + i] = v;
          mv.setVoxel(i, j, k, v);
        }
    const overlay = new HeatmapOverlay(vol, [W, H, D], fakeCanvas());
    const tb = 60;
    const sizes: Record<Axis, number> = { x: W, y: H, z: D };
    for (const axis of ["x", "y", "z"] as Axis[]) {
      for (let i = 0; i < sizes[axis]; i++) {
        const ref = mv.getSliceUint8(i, axis);
        const out = overlay.sliceRGBA(axis, i, tb, 1, 1);
        expect([out.width, out.height]).toEqual([ref.width, ref.height]);
        for (let p = 0; p < ref.data.length; p++) {
          const v = ref.data[p];
          const want = v < tb ? [0, 0, 0, 0] : [...rgb(v), 255];
          expect(Array.from(out.data.subarray(p * 4, p * 4 + 4))).toEqual(want);
        }
      }
    }
  });
});
