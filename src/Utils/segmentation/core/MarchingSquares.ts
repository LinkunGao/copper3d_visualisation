/**
 * MarchingSquares — Extract vector contours from a 2D voxel label grid.
 *
 * For each label, produces a `Path2D` whose subpaths are small per-cell
 * polygons. The polygons tile the region occupied by the target label; the
 * union (via `ctx.fill(path, 'nonzero')`) is the label's silhouette on the
 * voxel grid.
 *
 * Coordinate convention:
 *   - Voxel (i, j) occupies the unit square [i, i+1] × [j, j+1] in render
 *     space, with its center at (i+0.5, j+0.5). This matches ITK-SNAP /
 *     standard imaging viewers and the existing `renderSliceToCanvas`
 *     `scale(scaledW / W, scaledH / H)` mapping.
 *   - Marching squares treats voxels as point samples at their centers:
 *     cell (i, j) has corners at voxel centers (i+0.5, j+0.5),
 *     (i+1.5, j+0.5), (i+1.5, j+1.5), (i+0.5, j+1.5).
 *   - This produces 45°-cut contours (diamonds for isolated voxels, rounded
 *     corners for connected regions) that stay within the voxel-square
 *     bounds, so the rendered silhouette is a slightly-inset version of the
 *     ITK-SNAP silhouette with smooth diagonals.
 *
 * Saddle cases (5 and 10) use a fixed convention: the two in-corners are
 * treated as disconnected within the cell (4-connectivity interpretation).
 */

type Vertex = readonly [number, number];

/**
 * Per-cell polygon lookup for the 16 marching-squares cases.
 *
 * Corner bit layout:  TL=8, TR=4, BR=2, BL=1
 *
 * Coordinates are within the unit cell, 0 ≤ x ≤ 1, 0 ≤ y ≤ 1,
 * where (0, 0) is the TL corner of the cell. Add (i, j) to get absolute.
 *
 * Each case may emit 0, 1, or 2 polygons (saddles → 2).
 * Polygon vertices are listed in a CCW order in screen space (y-down),
 * which corresponds to CW in math coords. Path2D `fill(nonzero)` handles
 * this consistently.
 */
const CELL_POLYGONS: readonly (readonly Vertex[])[][] = [
  /* 0  (empty) */              [],
  /* 1  (BL)    */              [[[0, 0.5], [0.5, 1], [0, 1]]],
  /* 2  (BR)    */              [[[0.5, 1], [1, 0.5], [1, 1]]],
  /* 3  (BR+BL) */              [[[0, 0.5], [1, 0.5], [1, 1], [0, 1]]],
  /* 4  (TR)    */              [[[0.5, 0], [1, 0], [1, 0.5]]],
  /* 5  (TR+BL saddle) */       [
    [[0.5, 0], [1, 0], [1, 0.5]],
    [[0, 0.5], [0.5, 1], [0, 1]],
  ],
  /* 6  (TR+BR) */              [[[0.5, 0], [1, 0], [1, 1], [0.5, 1]]],
  /* 7  (TR+BR+BL, !TL) */      [[[0.5, 0], [1, 0], [1, 1], [0, 1], [0, 0.5]]],
  /* 8  (TL)    */              [[[0, 0], [0.5, 0], [0, 0.5]]],
  /* 9  (TL+BL) */              [[[0, 0], [0.5, 0], [0.5, 1], [0, 1]]],
  /* 10 (TL+BR saddle) */       [
    [[0, 0], [0.5, 0], [0, 0.5]],
    [[0.5, 1], [1, 0.5], [1, 1]],
  ],
  /* 11 (TL+BR+BL, !TR) */      [[[0, 0], [0.5, 0], [1, 0.5], [1, 1], [0, 1]]],
  /* 12 (TL+TR) */              [[[0, 0], [1, 0], [1, 0.5], [0, 0.5]]],
  /* 13 (TL+TR+BL, !BR) */      [[[0, 0], [1, 0], [1, 0.5], [0.5, 1], [0, 1]]],
  /* 14 (TL+TR+BR, !BL) */      [[[0, 0], [1, 0], [1, 1], [0.5, 1], [0, 0.5]]],
  /* 15 (full)  */              [[[0, 0], [1, 0], [1, 1], [0, 1]]],
];

export interface ContourBBox {
  /** Inclusive left voxel (0 ≤ x0 ≤ width). */
  x0: number;
  /** Inclusive top voxel (0 ≤ y0 ≤ height). */
  y0: number;
  /** Exclusive right voxel (x1 > x0). */
  x1: number;
  /** Exclusive bottom voxel (y1 > y0). */
  y1: number;
}

/** A single polygon's vertices in voxel-space coordinates. */
export type ContourPolygon = ReadonlyArray<readonly [number, number]>;

/**
 * Emit all per-cell polygons covering the voxels where `labels === targetLabel`.
 * Pure geometry function — no Canvas dependency. Consumers can build a Path2D
 * (see {@link extractLabelContours}) or walk the vertex arrays directly
 * (tests, export, stroke rendering).
 */
export function extractLabelPolygons(
  labels: Uint8Array,
  width: number,
  height: number,
  targetLabel: number,
  stride: number = 1,
  channelOffset: number = 0,
  bbox?: ContourBBox,
): ContourPolygon[] {
  const out: ContourPolygon[] = [];

  const cx0 = (bbox?.x0 ?? 0) - 1;
  const cy0 = (bbox?.y0 ?? 0) - 1;
  const cx1 = bbox?.x1 ?? width;
  const cy1 = bbox?.y1 ?? height;

  const i0 = Math.max(-1, cx0);
  const j0 = Math.max(-1, cy0);
  const i1 = Math.min(width, cx1);
  const j1 = Math.min(height, cy1);

  const sample = (x: number, y: number): boolean => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    return labels[(y * width + x) * stride + channelOffset] === targetLabel;
  };

  // Shift output by +0.5 so that marching-squares samples (voxel positions)
  // map to voxel-square CENTERS in render space. Voxel (i, j) occupies
  // render square [i, i+1] × [j, j+1]; its center is (i+0.5, j+0.5).
  const SHIFT = 0.5;

  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      const tl = sample(i, j);
      const tr = sample(i + 1, j);
      const br = sample(i + 1, j + 1);
      const bl = sample(i, j + 1);

      const code =
        (tl ? 8 : 0) |
        (tr ? 4 : 0) |
        (br ? 2 : 0) |
        (bl ? 1 : 0);

      if (code === 0) continue;

      const polygons = CELL_POLYGONS[code];
      for (let p = 0; p < polygons.length; p++) {
        const poly = polygons[p];
        const abs: [number, number][] = new Array(poly.length);
        for (let k = 0; k < poly.length; k++) {
          abs[k] = [i + poly[k][0] + SHIFT, j + poly[k][1] + SHIFT];
        }
        out.push(abs);
      }
    }
  }
  return out;
}

/**
 * Extract a `Path2D` covering all voxels equal to `targetLabel`.
 *
 * @param labels      Flat label array. Addressed as
 *                    `labels[(y * width + x) * stride + channelOffset]`.
 * @param width       Grid width in voxels.
 * @param height      Grid height in voxels.
 * @param targetLabel Label value to extract (1..255; 0 is background).
 * @param stride      Bytes per voxel (default 1). Use MaskVolume.numChannels
 *                    when reading interleaved slices.
 * @param channelOffset Offset within each voxel's channels to sample.
 *                    Default 0 (first channel = label id).
 * @param bbox        Optional voxel-space bbox to limit extraction.
 *                    Cells in a 1-voxel halo around the bbox are still
 *                    visited so the contour closes correctly at the bbox edges.
 */
export function extractLabelContours(
  labels: Uint8Array,
  width: number,
  height: number,
  targetLabel: number,
  stride: number = 1,
  channelOffset: number = 0,
  bbox?: ContourBBox,
): Path2D {
  const polygons = extractLabelPolygons(
    labels, width, height, targetLabel, stride, channelOffset, bbox,
  );
  const path = new Path2D();
  for (let p = 0; p < polygons.length; p++) {
    const poly = polygons[p];
    path.moveTo(poly[0][0], poly[0][1]);
    for (let k = 1; k < poly.length; k++) {
      path.lineTo(poly[k][0], poly[k][1]);
    }
    path.closePath();
  }
  return path;
}

/**
 * Detect the distinct non-zero labels present in a slice region.
 *
 * @param labels        Flat label array (see {@link extractLabelContours}).
 * @param width         Grid width.
 * @param height        Grid height.
 * @param stride        Bytes per voxel.
 * @param channelOffset Offset within each voxel.
 * @param bbox          Optional region to scan (defaults to full grid).
 * @returns Sorted array of distinct label values (0 omitted).
 */
export function findLabelsInSlice(
  labels: Uint8Array,
  width: number,
  height: number,
  stride: number = 1,
  channelOffset: number = 0,
  bbox?: ContourBBox,
): number[] {
  const x0 = bbox?.x0 ?? 0;
  const y0 = bbox?.y0 ?? 0;
  const x1 = bbox?.x1 ?? width;
  const y1 = bbox?.y1 ?? height;

  const seen = new Set<number>();
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const v = labels[(y * width + x) * stride + channelOffset];
      if (v !== 0) seen.add(v);
    }
  }
  return Array.from(seen).sort((a, b) => a - b);
}
