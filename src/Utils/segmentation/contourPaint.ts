import type { RGBAColor } from "./core/types";
import { extractLabelContours, extractLabelOutline, findLabelsInSlice } from "./core/MarchingSquares";

/** One 2D slice of labels: `width × height` cells, `stride` bytes apart, the label at offset 0. */
export interface LabelSlice {
  data: Uint8Array;
  width: number;
  height: number;
  stride: number;
}

/**
 * Outline stroke width, in screen pixels.
 *
 * Screen pixels rather than voxels so magnifying the image does not thicken the line over the
 * boundary the clinician magnified it to see. Thin enough to sit on an edge, thick enough to
 * stay visible against bright tissue.
 */
export const OUTLINE_WIDTH_PX = 1.5;

/**
 * One slice's contours, in voxel coordinates. Fill and outline paths are built lazily and side
 * by side, so switching mode costs one extraction the first time and is a cache hit after.
 */
export interface ContourEntry {
  key: string;
  W: number;
  H: number;
  labels: number[];
  /** Silhouettes, to fill. Built on first use of fill mode for this slice. */
  fills: Map<number, Path2D>;
  /** Boundaries, to stroke. Built on first use of outline mode for this slice. */
  outlines: Map<number, Path2D>;
}

/**
 * Populate one cache entry's paths for one render mode.
 *
 * Split out because the two modes are built at different times: whichever is in use when
 * a slice is first drawn, and the other one only if the clinician switches while still on
 * that slice. Building both eagerly would make every slice scrub pay for a mode most
 * sessions never turn on.
 */
function buildPaths(entry: ContourEntry, data: Uint8Array, stride: number, outline: boolean): void {
  const target = outline ? entry.outlines : entry.fills;
  for (const lbl of entry.labels) {
    target.set(
      lbl,
      outline
        ? extractLabelOutline(data, entry.W, entry.H, lbl, stride, 0)
        : extractLabelContours(data, entry.W, entry.H, lbl, stride, 0),
    );
  }
}

/**
 * The cached contours for `slot` under `key`, extracting on a miss. One entry per slot: a new
 * key overwrites it. `readSlice` is called only when extraction is needed.
 */
export function contourEntry(
  cache: Map<string, ContourEntry>,
  slot: string,
  key: string,
  readSlice: () => LabelSlice,
  outline: boolean,
): ContourEntry {
  // Cache miss → run the expensive extraction once. Hits (zoom,
  // recomposite, contrast toggle) skip straight to the draw.
  let entry = cache.get(slot);
  if (!entry || entry.key !== key) {
    const slice = readSlice();
    entry = {
      key,
      W: slice.width,
      H: slice.height,
      labels: findLabelsInSlice(slice.data, slice.width, slice.height, slice.stride, 0),
      fills: new Map(),
      outlines: new Map(),
    };
    cache.set(slot, entry);
    buildPaths(entry, slice.data, slice.stride, outline);
  } else if ((outline ? entry.outlines : entry.fills).size !== entry.labels.length) {
    // The mode changed since this slice was last drawn, so the other set of
    // paths is cached and this one is not. Re-read the slice and build it; from
    // here on both are present and toggling is a pure cache hit.
    const slice = readSlice();
    buildPaths(entry, slice.data, slice.stride, outline);
  }
  return entry;
}

/** Paint an entry's visible labels onto `targetCtx`, scaled from voxels to `scaledWidth × scaledHeight`. */
export function paintContours(
  entry: ContourEntry,
  targetCtx: CanvasRenderingContext2D,
  axis: "x" | "y" | "z",
  scaledWidth: number,
  scaledHeight: number,
  outline: boolean,
  colorOf: (label: number) => RGBAColor,
  channelVis?: Record<number, boolean>,
): void {
  if (entry.labels.length === 0) return;

  targetCtx.save();
  // A throw (a missing colour, say) must not leave the transform on the target.
  try {
    drawPaths(entry, targetCtx, axis, scaledWidth, scaledHeight, outline, colorOf, channelVis);
  } finally {
    targetCtx.restore();
  }
}

function drawPaths(
  entry: ContourEntry,
  targetCtx: CanvasRenderingContext2D,
  axis: "x" | "y" | "z",
  scaledWidth: number,
  scaledHeight: number,
  outline: boolean,
  colorOf: (label: number) => RGBAColor,
  channelVis?: Record<number, boolean>,
): void {
  const { W, H, labels } = entry;
  const paths = outline ? entry.outlines : entry.fills;

  // Vector drawing — imageSmoothingEnabled is irrelevant here, but keep
  // it off to match the rest of the pipeline.
  targetCtx.imageSmoothingEnabled = false;

  if (outline) {
    // Stroke on an UNTRANSFORMED context, with the voxel→display mapping carried
    // in the path instead. `lineWidth` is then measured in screen pixels, which
    // is what the other two options get wrong: stroking under `ctx.scale(sx, sy)`
    // thickens the line with the zoom, exactly when the clinician has magnified
    // the image to look at the boundary — and because voxels are rarely isotropic
    // (sx !== sy), it also comes out thicker in one axis than the other.
    const matrix = new DOMMatrix();
    if (axis === "y") {
      matrix.scaleSelf(1, -1);
      matrix.translateSelf(0, -scaledHeight);
    }
    matrix.scaleSelf(scaledWidth / W, scaledHeight / H);

    targetCtx.lineWidth = OUTLINE_WIDTH_PX;
    // Segments are emitted per cell and meet at shared endpoints; round caps
    // close those joins. Canvas composites a whole Path2D in one pass, so the
    // overlap costs no doubled alpha.
    targetCtx.lineJoin = "round";
    targetCtx.lineCap = "round";

    for (const lbl of labels) {
      if (channelVis && channelVis[lbl] === false) continue;
      const path = paths.get(lbl);
      if (!path) continue;
      const color = colorOf(lbl);
      targetCtx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
      const display = new Path2D();
      display.addPath(path, matrix);
      targetCtx.stroke(display);
    }
    return;
  }

  // Coronal (axis='y') Z-flip: mirrors the flip applied by the write
  // path (syncLayerSliceData). Apply BEFORE the voxel→display scale
  // so the flip operates in display coordinates.
  if (axis === "y") {
    targetCtx.scale(1, -1);
    targetCtx.translate(0, -scaledHeight);
  }

  // Voxel coord (x ∈ [0, W], y ∈ [0, H]) → display coord.
  targetCtx.scale(scaledWidth / W, scaledHeight / H);

  for (const lbl of labels) {
    if (channelVis && channelVis[lbl] === false) continue;
    const path = paths.get(lbl);
    if (!path) continue;
    const color = colorOf(lbl);
    targetCtx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
    targetCtx.fill(path, "nonzero");
  }
}
