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

/**
 * Per-cell boundary segments for the same 16 cases — the region's edge, without the region.
 *
 * Each entry is the cut line of the corresponding `CELL_POLYGONS` entry: the one edge of that
 * polygon which does not lie on the cell's border. Filling the polygons and stroking these
 * therefore describe the same silhouette, which is what lets the renderer swap fill for
 * outline without the mask's edge appearing to move.
 *
 * Endpoints are the midpoints of the cell's sides —
 *   T = (0.5, 0)   R = (1, 0.5)   B = (0.5, 1)   L = (0, 0.5)
 * — in the same cell-local 0..1 space as `CELL_POLYGONS`, so the caller adds (i, j) + SHIFT
 * identically for both.
 *
 * Cases 0 and 15 emit nothing. 15 is the whole reason an outline is cheap: solid interior has
 * no boundary, so the segment count follows the perimeter rather than the area.
 *
 * Saddles (5 and 10) follow `CELL_POLYGONS`' convention — the two in-corners are disconnected
 * (4-connectivity) — because the other reading would run a boundary straight through mask the
 * fill considers solid.
 */
const CELL_SEGMENTS: readonly (readonly [Vertex, Vertex])[][] = [
  /* 0  (empty) */              [],
  /* 1  (BL)    */              [[[0, 0.5], [0.5, 1]]],
  /* 2  (BR)    */              [[[0.5, 1], [1, 0.5]]],
  /* 3  (BR+BL) */              [[[0, 0.5], [1, 0.5]]],
  /* 4  (TR)    */              [[[0.5, 0], [1, 0.5]]],
  /* 5  (TR+BL saddle) */       [
    [[0.5, 0], [1, 0.5]],
    [[0, 0.5], [0.5, 1]],
  ],
  /* 6  (TR+BR) */              [[[0.5, 0], [0.5, 1]]],
  /* 7  (TR+BR+BL, !TL) */      [[[0.5, 0], [0, 0.5]]],
  /* 8  (TL)    */              [[[0.5, 0], [0, 0.5]]],
  /* 9  (TL+BL) */              [[[0.5, 0], [0.5, 1]]],
  /* 10 (TL+BR saddle) */       [
    [[0.5, 0], [0, 0.5]],
    [[0.5, 1], [1, 0.5]],
  ],
  /* 11 (TL+BR+BL, !TR) */      [[[0.5, 0], [1, 0.5]]],
  /* 12 (TL+TR) */              [[[1, 0.5], [0, 0.5]]],
  /* 13 (TL+TR+BL, !BR) */      [[[1, 0.5], [0.5, 1]]],
  /* 14 (TL+TR+BR, !BL) */      [[[0.5, 1], [0, 0.5]]],
  /* 15 (full)  */              [],
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
 * Emit polygons covering the voxels where `labels === targetLabel`.
 * Pure geometry function — no Canvas dependency. Consumers can build a Path2D
 * (see {@link extractLabelContours}) or walk the vertex arrays directly
 * (tests, export, stroke rendering).
 *
 * Boundary cells (marching-squares cases 1–14) emit their cut polygon as
 * usual. Solid interior (case 15) is **coalesced into horizontal run-length
 * rectangles** instead of one unit square per cell, collapsing the subpath
 * count from O(area) to ≈ O(perimeter + rows). The filled region is
 * pixel-identical (contiguous full-cell squares tile exactly into a rectangle
 * with the same TL→TR→BR→BL winding), which is what keeps slice-scrubbing
 * fast on large masks without changing the rendered silhouette.
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

  // Emit a single rectangle covering a contiguous run of full (code 15)
  // cells [runStart .. runEnd] on row j. A full cell i covers render square
  // [i+0.5, i+1.5] × [j+0.5, j+1.5]; consecutive full cells tile perfectly,
  // so the run is pixel-identical to the per-cell squares it replaces.
  // Vertices use the same TL→TR→BR→BL (CCW screen-space) winding as the
  // case-15 unit square, so the nonzero fill matches at shared edges.
  const pushFullRun = (runStart: number, runEnd: number, j: number): void => {
    const x0 = runStart + SHIFT;
    const x1 = runEnd + 1 + SHIFT;
    const y0 = j + SHIFT;
    const y1 = j + 1 + SHIFT;
    out.push([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);
  };

  for (let j = j0; j < j1; j++) {
    // Index where the current contiguous run of full (code 15) cells began,
    // or -1 when no run is open. Coalescing the solid interior into row runs
    // drops the per-cell square count from O(area) to O(rows + perimeter),
    // which is what keeps fast slice-scrubbing smooth on large masks.
    let runStart = -1;

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

      if (code === 15) {
        // Extend (or open) the current full-cell run; defer emission.
        if (runStart === -1) runStart = i;
        continue;
      }

      // Non-full cell ends any open run — flush it as one rectangle.
      if (runStart !== -1) {
        pushFullRun(runStart, i - 1, j);
        runStart = -1;
      }

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

    // Flush a run that reached the end of the row (last visited cell is i1-1).
    if (runStart !== -1) {
      pushFullRun(runStart, i1 - 1, j);
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
 * Emit the boundary of the region where `labels === targetLabel`, as open two-point segments.
 *
 * The counterpart to {@link extractLabelPolygons}: that one covers the region, this one traces
 * its edge. Both walk the same cells with the same sampling, the same out-of-bounds rule and
 * the same `+0.5` shift, so a renderer can fill one and stroke the other and have the mask end
 * in exactly the same place either way.
 *
 * Segments are emitted per cell and left unjoined. Canvas rasterises a whole `Path2D` in one
 * compositing pass, so segments meeting at a shared endpoint produce no seam and no doubled
 * alpha where their round caps overlap — joining them into polylines would buy nothing and
 * cost a chaining pass.
 *
 * Cost follows the perimeter, not the area: solid interior is case 15, which has no boundary.
 *
 * Parameters match {@link extractLabelContours}.
 */
export function extractLabelBoundarySegments(
  labels: Uint8Array,
  width: number,
  height: number,
  targetLabel: number,
  stride: number = 1,
  channelOffset: number = 0,
  bbox?: ContourBBox,
): ContourPolygon[] {
  const out: ContourPolygon[] = [];

  const i0 = Math.max(-1, (bbox?.x0 ?? 0) - 1);
  const j0 = Math.max(-1, (bbox?.y0 ?? 0) - 1);
  const i1 = Math.min(width, bbox?.x1 ?? width);
  const j1 = Math.min(height, bbox?.y1 ?? height);

  const sample = (x: number, y: number): boolean => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    return labels[(y * width + x) * stride + channelOffset] === targetLabel;
  };

  // Same convention as extractLabelPolygons: samples sit at voxel centres.
  const SHIFT = 0.5;

  for (let j = j0; j < j1; j++) {
    for (let i = i0; i < i1; i++) {
      const code =
        (sample(i, j) ? 8 : 0) |
        (sample(i + 1, j) ? 4 : 0) |
        (sample(i + 1, j + 1) ? 2 : 0) |
        (sample(i, j + 1) ? 1 : 0);

      // Nothing here, or nothing but mask: neither has an edge in this cell.
      if (code === 0 || code === 15) continue;

      const segments = CELL_SEGMENTS[code];
      for (let s = 0; s < segments.length; s++) {
        const [a, b] = segments[s];
        out.push([
          [i + a[0] + SHIFT, j + a[1] + SHIFT],
          [i + b[0] + SHIFT, j + b[1] + SHIFT],
        ]);
      }
    }
  }

  return out;
}

/**
 * {@link extractLabelBoundarySegments} as a `Path2D`, ready to stroke.
 *
 * The outline counterpart to {@link extractLabelContours}. Stroke this; do not stroke the
 * contour path — that one is per-cell polygons whose union is the silhouette, and stroking it
 * draws every internal cell edge as well, covering the mask in a grid.
 */
export function extractLabelOutline(
  labels: Uint8Array,
  width: number,
  height: number,
  targetLabel: number,
  stride: number = 1,
  channelOffset: number = 0,
  bbox?: ContourBBox,
): Path2D {
  const segments = extractLabelBoundarySegments(
    labels, width, height, targetLabel, stride, channelOffset, bbox,
  );
  const path = new Path2D();
  for (let s = 0; s < segments.length; s++) {
    const [a, b] = segments[s];
    path.moveTo(a[0], a[1]);
    path.lineTo(b[0], b[1]);
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
