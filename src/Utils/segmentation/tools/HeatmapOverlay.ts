/**
 * A probability heatmap drawn over a view: a colour scale, a threshold, and slice painting
 * in the layout `MaskVolume.getSliceUint8` uses, so it lines up with the masks.
 */
import { rowsRunUp } from "../contourPaint";
import { sliceDims } from "./MaskMirror";

type Axis = "x" | "y" | "z";

/** Colour stops as [LUT index, r, g, b]; entries between stops are linear in index. */
const STOPS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 0, 0, 128],
  [32, 0, 0, 255],
  [96, 0, 255, 255],
  [159, 255, 255, 0],
  [223, 255, 0, 0],
  [255, 128, 0, 0],
];

function buildColormap(): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256 * 4);
  for (let s = 0; s < STOPS.length - 1; s++) {
    const [i0, r0, g0, b0] = STOPS[s];
    const [i1, r1, g1, b1] = STOPS[s + 1];
    for (let i = i0; i <= i1; i++) {
      const f = (i - i0) / (i1 - i0);
      lut[i * 4] = Math.round(r0 + (r1 - r0) * f);
      lut[i * 4 + 1] = Math.round(g0 + (g1 - g0) * f);
      lut[i * 4 + 2] = Math.round(b0 + (b1 - b0) * f);
      lut[i * 4 + 3] = 255;
    }
  }
  return lut;
}

/** 256 × RGBA: probability byte → colour. */
export const HEATMAP_COLORMAP: Uint8ClampedArray = buildColormap();

/** The same table as one 32-bit word per entry, in the byte order of an RGBA output view. */
const COLORMAP32 = new Uint32Array(HEATMAP_COLORMAP.buffer);

/** The smallest byte drawn for a 0–1 threshold. */
export function heatmapThresholdByte(t: number): number {
  return Math.min(255, Math.max(0, Math.ceil(t * 255)));
}

/** Whether the heatmap view is on. Older state fakes carry no `heatmap`. */
export function isHeatmapShown(state: { gui_states: unknown }): boolean {
  const gui = state.gui_states as { heatmap?: { visible?: boolean } } | undefined;
  return gui?.heatmap?.visible === true;
}

const defaultMakeCanvas = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

/** The most raster pixels per voxel along an axis. */
export const HEATMAP_MAX_UPSAMPLE = 4;

export class HeatmapOverlay {
  readonly dims: [number, number, number];
  private volume: Uint8Array;
  private makeCanvas: (w: number, h: number) => HTMLCanvasElement;
  private cache: { key: string; canvas: HTMLCanvasElement } | null = null;
  /** The offscreen canvas and its pixels, kept while the raster size stays the same. */
  private raster: { size: string; canvas: HTMLCanvasElement; img: ImageData } | null = null;

  constructor(
    volume: Uint8Array,
    dims: [number, number, number],
    makeCanvas: (w: number, h: number) => HTMLCanvasElement = defaultMakeCanvas,
  ) {
    this.volume = volume;
    this.dims = dims;
    this.makeCanvas = makeCanvas;
  }

  /** Raster pixels per voxel along one axis: enough for the displayed size, at most HEATMAP_MAX_UPSAMPLE. */
  static rasterFactor(displayed: number, voxels: number): number {
    return Math.min(HEATMAP_MAX_UPSAMPLE, Math.max(1, Math.ceil(displayed / voxels)));
  }

  /**
   * One slice as RGBA at `fx × fy` raster pixels per voxel. The probability is interpolated
   * bilinearly between voxel centres; a pixel is drawn, in the colour of that value, where it
   * reaches `thresholdByte`. Elsewhere it is fully transparent. With `out` (exactly
   * `width × height × 4` bytes) the slice is written into it, cleared first, instead of a new array.
   * `fx` and `fy` must be integers of at least 1.
   */
  sliceRGBA(
    axis: Axis,
    index: number,
    thresholdByte: number,
    fx = 1,
    fy = 1,
    outBytes?: Uint8ClampedArray,
  ): { data: Uint8ClampedArray; width: number; height: number } {
    if (!Number.isInteger(fx) || !Number.isInteger(fy) || fx < 1 || fy < 1) {
      throw new Error(`heatmap factors must be integers of at least 1, got ${fx} x ${fy}`);
    }
    const [W, H] = this.dims;
    const [cols, rows] = sliceDims(this.dims, axis);
    const width = cols * fx;
    const height = rows * fy;
    if (outBytes && outBytes.length !== width * height * 4) {
      throw new Error(`heatmap output holds ${outBytes.length} bytes, the slice needs ${width * height * 4}`);
    }
    const data = outBytes ?? new Uint8ClampedArray(width * height * 4);
    const out = new Uint32Array(data.buffer, data.byteOffset, width * height);
    if (outBytes) out.fill(0);
    const vol = this.volume;
    const rowStride = axis === "z" ? W : W * H;
    const colStride = axis === "x" ? W : 1;
    const base = axis === "z" ? index * W * H : axis === "y" ? index * W : index;

    // Per raster column: the weight of its right voxel. `start[c]` is the first raster column
    // whose left voxel is c, so a voxel cell is a contiguous run.
    const wx = new Float64Array(width);
    const start = new Int32Array(cols + 1).fill(width);
    for (let px = width - 1; px >= 0; px--) {
      const u = Math.min(cols - 1, Math.max(0, (px + 0.5) / fx - 0.5));
      const c0 = Math.floor(u);
      wx[px] = u - c0;
      start[c0] = px;
    }

    // The same run table for rows: `rowStart[r]` is the first raster row whose upper voxel row is r.
    const rowStart = new Int32Array(rows + 1).fill(height);
    for (let py = height - 1; py >= 0; py--) {
      rowStart[Math.floor(Math.min(rows - 1, Math.max(0, (py + 0.5) / fy - 0.5)))] = py;
    }

    for (let r = 0; r < rows; r++) {
      const row0 = base + r * rowStride;
      const row1 = base + Math.min(r + 1, rows - 1) * rowStride;
      const pyEnd = rowStart[r + 1];
      for (let c = 0; c < cols; c++) {
        const x0 = c * colStride;
        const x1 = Math.min(c + 1, cols - 1) * colStride;
        const q00 = vol[row0 + x0];
        const q10 = vol[row0 + x1];
        const q01 = vol[row1 + x0];
        const q11 = vol[row1 + x1];
        // The interpolated value never exceeds its four voxels, so a cell of all-low voxels is empty.
        if (q00 < thresholdByte && q10 < thresholdByte && q01 < thresholdByte && q11 < thresholdByte) continue;
        const pxStart = start[c];
        const pxEnd = start[c + 1];
        if (q00 === q10 && q00 === q01 && q00 === q11) {
          // Equal corners interpolate to that value everywhere in the cell.
          const word = COLORMAP32[q00];
          for (let py = rowStart[r]; py < pyEnd; py++) {
            const rowBase = py * width;
            for (let px = pxStart; px < pxEnd; px++) out[rowBase + px] = word;
          }
          continue;
        }
        for (let py = rowStart[r]; py < pyEnd; py++) {
          const v = Math.min(rows - 1, Math.max(0, (py + 0.5) / fy - 0.5));
          const b = v - r;
          const rowBase = py * width;
          for (let px = pxStart; px < pxEnd; px++) {
            const a = wx[px];
            const p = (q00 + (q10 - q00) * a) * (1 - b) + (q01 + (q11 - q01) * a) * b;
            if (p < thresholdByte) continue;
            out[rowBase + px] = COLORMAP32[Math.round(p)];
          }
        }
      }
    }
    return { data, width, height };
  }

  /** Draw a slice scaled to `width × height`; the offscreen slice is reused until its key changes. */
  paint(
    ctx: CanvasRenderingContext2D,
    axis: Axis,
    index: number,
    width: number,
    height: number,
    threshold: number,
    opacity: number,
  ): void {
    const tb = heatmapThresholdByte(threshold);
    const [cols, rows] = sliceDims(this.dims, axis);
    const fx = HeatmapOverlay.rasterFactor(width, cols);
    const fy = HeatmapOverlay.rasterFactor(height, rows);
    const key = `${axis}:${index}:${tb}:${fx}x${fy}`;
    if (!this.cache || this.cache.key !== key) {
      const w = cols * fx;
      const h = rows * fy;
      const size = `${w}x${h}`;
      if (!this.raster || this.raster.size !== size) {
        const canvas = this.makeCanvas(w, h);
        const img = (canvas.getContext("2d") as CanvasRenderingContext2D).createImageData(w, h);
        this.raster = { size, canvas, img };
      }
      const { canvas, img } = this.raster;
      this.sliceRGBA(axis, index, tb, fx, fy, img.data);
      (canvas.getContext("2d") as CanvasRenderingContext2D).putImageData(img, 0, 0);
      this.cache = { key, canvas };
    }
    ctx.save();
    try {
      ctx.imageSmoothingEnabled = true;
      ctx.globalAlpha = opacity;
      if (rowsRunUp(axis)) {
        ctx.translate(0, height);
        ctx.scale(1, -1);
      }
      ctx.drawImage(this.cache.canvas, 0, 0, width, height);
    } finally {
      ctx.restore();
    }
  }
}
