/**
 * Drawing another viewer's masks, read live through a voxel-to-voxel transform.
 *
 * The transform is a row-major 4×4 from this viewer's voxel (x, y, z, 1) to the source's
 * voxel. Slices are built in `MaskVolume.getSliceUint8`'s layout for this viewer's own grid,
 * so the source's paint code draws them unchanged, flips included.
 */
import type { MaskVolume } from "../core/index";
import type { CanvasState } from "../CanvasState";
import { contourEntry, paintContours, type ContourEntry, type LabelSlice } from "../contourPaint";

export type Axis = "x" | "y" | "z";

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

/** A slice's width and height for `axis`, as `getSliceUint8` lays it out. */
export function sliceDims(dims: ArrayLike<number>, axis: Axis): [number, number] {
  const [w, h, d] = [dims[0], dims[1], dims[2]];
  return axis === "z" ? [w, h] : axis === "y" ? [w, d] : [d, h];
}

/** Whether `m` is the identity within `tol`. No matrix counts as the identity. */
export function isIdentity(m: ArrayLike<number> | null | undefined, tol = 1e-9): boolean {
  if (!m) return true;
  for (let i = 0; i < 16; i++) {
    if (Math.abs(m[i] - IDENTITY[i]) > tol) return false;
  }
  return true;
}

/** Whether the 3×3 part of a row-major 4×4 is diagonal: each axis maps onto its own axis. */
function isDiagonal(m: ArrayLike<number>, tol = 1e-9): boolean {
  for (const i of [1, 2, 4, 6, 8, 9]) {
    if (Math.abs(m[i]) > tol) return false;
  }
  return true;
}

/**
 * For each mirror index along one axis, the inclusive source index range it covers, clamped
 * to the source's extent; `lo > hi` when it covers none. A mirror voxel no larger than a
 * source voxel covers the one nearest its centre; a larger one covers every source voxel
 * whose centre lies within it.
 */
function coveredRanges(s: number, t: number, count: number, extent: number): { lo: Int32Array; hi: Int32Array } {
  const lo = new Int32Array(count);
  const hi = new Int32Array(count);
  const half = Math.abs(s) / 2;
  for (let i = 0; i < count; i++) {
    const c = s * i + t;
    let a: number, b: number;
    if (Math.abs(s) <= 1) {
      a = b = Math.round(c);
    } else {
      a = Math.ceil(c - half - 1e-9);
      b = Math.floor(c + half - 1e-9);
    }
    lo[i] = Math.max(a, 0);
    hi[i] = Math.min(b, extent - 1);
  }
  return { lo, hi };
}

/**
 * The source's labels on this viewer's slice `index` along `axis`. A cell mapping outside
 * the source is 0. On the same grid with the identity, it is the source's own slice.
 *
 * With a diagonal transform (the axes agree, only scale and offset differ), a mirror voxel
 * coarser than the source shows the first label found among every source voxel it spans, so
 * a finding thinner than the mirror's slice still appears on the slice that contains it.
 * Any other transform samples the nearest source voxel.
 */
export function mirrorSliceLabels(
  source: MaskVolume,
  mirrorDims: ArrayLike<number>,
  axis: Axis,
  index: number,
  m: ArrayLike<number> | null,
): LabelSlice {
  const sd = source.getDimensions();
  if (isIdentity(m) && sd.width === mirrorDims[0] && sd.height === mirrorDims[1] && sd.depth === mirrorDims[2]) {
    const s = source.getSliceUint8(index, axis);
    return { data: s.data, width: s.width, height: s.height, stride: source.getChannels() };
  }

  const mat = m ?? IDENTITY;
  const [W, H] = sliceDims(mirrorDims, axis);
  const raw = source.getRawData();
  const nch = source.getChannels();
  const out = new Uint8Array(W * H);

  if (isDiagonal(mat)) {
    const rx = coveredRanges(mat[0], mat[3], mirrorDims[0], sd.width);
    const ry = coveredRanges(mat[5], mat[7], mirrorDims[1], sd.height);
    const rz = coveredRanges(mat[10], mat[11], mirrorDims[2], sd.depth);
    for (let v = 0; v < H; v++) {
      for (let u = 0; u < W; u++) {
        const x = axis === "x" ? index : u;
        const y = axis === "y" ? index : v;
        const z = axis === "z" ? index : axis === "y" ? v : u;
        let label = 0;
        for (let sz = rz.lo[z]; sz <= rz.hi[z] && !label; sz++) {
          for (let sy = ry.lo[y]; sy <= ry.hi[y] && !label; sy++) {
            for (let sx = rx.lo[x]; sx <= rx.hi[x] && !label; sx++) {
              label = raw[((sz * sd.height + sy) * sd.width + sx) * nch];
            }
          }
        }
        out[v * W + u] = label;
      }
    }
    return { data: out, width: W, height: H, stride: 1 };
  }

  for (let v = 0; v < H; v++) {
    for (let u = 0; u < W; u++) {
      // Slice cell (u, v) -> this viewer's voxel, per getSliceUint8's layout.
      const x = axis === "x" ? index : u;
      const y = axis === "y" ? index : v;
      const z = axis === "z" ? index : axis === "y" ? v : u;
      const sx = Math.round(mat[0] * x + mat[1] * y + mat[2] * z + mat[3]);
      const sy = Math.round(mat[4] * x + mat[5] * y + mat[6] * z + mat[7]);
      const sz = Math.round(mat[8] * x + mat[9] * y + mat[10] * z + mat[11]);
      if (sx < 0 || sy < 0 || sz < 0 || sx >= sd.width || sy >= sd.height || sz >= sd.depth) continue;
      out[v * W + u] = raw[((sz * sd.height + sy) * sd.width + sx) * nch];
    }
  }
  return { data: out, width: W, height: H, stride: 1 };
}

/**
 * One viewer drawing another's masks. Holds no mask data: every paint reads the source's
 * volumes and display state. A new transform means a new instance, so the cache never holds
 * contours from another transform.
 */
export class MaskMirror {
  /** One contour entry per source layer, for the slice last painted. */
  private cache = new Map<string, ContourEntry>();
  /** The source volume each cache entry was built from; a case load replaces the object. */
  private cachedVolumes = new Map<string, MaskVolume>();

  constructor(
    private readonly self: CanvasState,
    readonly source: CanvasState,
    private readonly matrix: ArrayLike<number> | null,
  ) {}

  /** Paint every visible source layer onto `ctx` for this viewer's current axis and slice. */
  paint(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    // The source hides its own layers in sphere mode, so the mirror shows none either.
    if (this.source.gui_states.mode.sphere) return;
    const dims = this.self.nrrd_states.image.dimensions;
    if (!dims || dims.length !== 3) return;
    const axis = this.self.protectedData.axis;
    const index = this.self.nrrd_states.view.currentSliceIndex;
    const lc = this.source.gui_states.layerChannel;
    const outline = this.source.gui_states.drawing.maskRenderMode === "outline";

    for (const layerId of this.source.nrrd_states.image.layers) {
      if (!lc.layerVisibility[layerId]) continue;
      const volume = this.source.protectedData.maskData.volumes[layerId];
      if (!volume) continue;
      if (this.cachedVolumes.get(layerId) !== volume) {
        this.cache.delete(layerId);
        this.cachedVolumes.set(layerId, volume);
      }
      try {
        const entry = contourEntry(
          this.cache,
          layerId,
          `${axis}:${index}:${volume.getVersion()}`,
          () => mirrorSliceLabels(volume, dims, axis, index, this.matrix),
          outline,
        );
        ctx.save();
        try {
          ctx.globalAlpha = lc.layerOpacity?.[layerId] ?? 1;
          paintContours(entry, ctx, axis, width, height, outline, (l) => volume.getChannelColor(l), lc.channelVisibility[layerId]);
        } finally {
          // A throw must not leave this layer's alpha or transform on the master canvas.
          ctx.restore();
        }
      } catch {
        // The source is not ready for this slice: nothing to draw for this layer.
      }
    }
  }
}
