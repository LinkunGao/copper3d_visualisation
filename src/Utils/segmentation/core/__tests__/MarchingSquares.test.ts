/**
 * MarchingSquares — Unit tests.
 *
 * Works directly on the polygon vertex arrays returned by
 * {@link extractLabelPolygons} (no Canvas dependency, so it runs under jsdom).
 *
 * Point-in-region checks use a tiny ray-casting helper that sums odd/even
 * crossings across all polygons (equivalent to the `nonzero` / `evenodd`
 * fill rule for our CCW-emitted polygons).
 */

import { describe, it, expect } from 'vitest';
import type { ContourPolygon } from '../MarchingSquares';
import {
  extractLabelPolygons,
  findLabelsInSlice,
} from '../MarchingSquares';

/**
 * Point-in-region test for a list of polygons. We treat them as a union:
 * a point is inside if it's inside an **odd** number of polygons by
 * ray-casting. For our emission scheme, polygons are disjoint within a
 * cell and adjacent cells share edges without overlap, so odd-count
 * correctly models the filled region.
 */
function isPointInside(polys: ContourPolygon[], px: number, py: number): boolean {
  let inside = false;
  for (const poly of polys) {
    if (pointInPolygon(poly, px, py)) inside = !inside;
  }
  return inside;
}

function pointInPolygon(poly: ContourPolygon, px: number, py: number): boolean {
  // Ray-casting (horizontal ray to +∞).
  let inside = false;
  const n = poly.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const intersect =
      (yi > py) !== (yj > py) &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// -------------------------------------------------------------------------
// findLabelsInSlice
// -------------------------------------------------------------------------
describe('findLabelsInSlice', () => {
  it('returns empty array for all-zero grid', () => {
    expect(findLabelsInSlice(new Uint8Array(4 * 4), 4, 4)).toEqual([]);
  });

  it('returns sorted distinct non-zero labels', () => {
    const labels = new Uint8Array([
      0, 1, 1, 0,
      0, 2, 2, 0,
      0, 0, 3, 3,
      0, 0, 0, 1,
    ]);
    expect(findLabelsInSlice(labels, 4, 4)).toEqual([1, 2, 3]);
  });

  it('respects bbox', () => {
    const labels = new Uint8Array([
      0, 1, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 2,
      0, 0, 0, 0,
    ]);
    expect(
      findLabelsInSlice(labels, 4, 4, 1, 0, { x0: 0, y0: 0, x1: 2, y1: 2 }),
    ).toEqual([1]);
    expect(
      findLabelsInSlice(labels, 4, 4, 1, 0, { x0: 2, y0: 2, x1: 4, y1: 4 }),
    ).toEqual([2]);
  });

  it('handles stride > 1 (interleaved channels)', () => {
    const labels = new Uint8Array([
      1, 99, 0, 99,
      0, 99, 2, 99,
    ]);
    expect(findLabelsInSlice(labels, 2, 2, 2, 0)).toEqual([1, 2]);
  });
});

// -------------------------------------------------------------------------
// extractLabelPolygons — geometry
// -------------------------------------------------------------------------
describe('extractLabelPolygons', () => {
  it('emits nothing for an all-zero grid', () => {
    expect(extractLabelPolygons(new Uint8Array(4 * 4), 4, 4, 1)).toEqual([]);
  });

  it('single voxel renders as a diamond centered at voxel-square center', () => {
    const labels = new Uint8Array(4 * 4);
    labels[1 * 4 + 1] = 1;
    const polys = extractLabelPolygons(labels, 4, 4, 1);
    // Voxel (1, 1) occupies render square [1, 2] × [1, 2], center (1.5, 1.5).
    // Diamond has radius 0.5 around (1.5, 1.5) → vertices at (1, 1.5), (1.5, 1), (2, 1.5), (1.5, 2).
    expect(isPointInside(polys, 1.5, 1.5)).toBe(true);
    // Corners of the voxel square are cut (diamond's inscribed area < square)
    expect(isPointInside(polys, 1.01, 1.01)).toBe(false);
    expect(isPointInside(polys, 1.99, 1.99)).toBe(false);
    // Neighbors
    expect(isPointInside(polys, 0.5, 1.5)).toBe(false);
    expect(isPointInside(polys, 2.5, 1.5)).toBe(false);
  });

  it('2x2 block fully covers the interior', () => {
    const labels = new Uint8Array(4 * 4);
    labels[1 * 4 + 1] = 1;
    labels[1 * 4 + 2] = 1;
    labels[2 * 4 + 1] = 1;
    labels[2 * 4 + 2] = 1;
    const polys = extractLabelPolygons(labels, 4, 4, 1);
    // All 4 voxel-square centers
    expect(isPointInside(polys, 1.5, 1.5)).toBe(true);
    expect(isPointInside(polys, 2.5, 1.5)).toBe(true);
    expect(isPointInside(polys, 1.5, 2.5)).toBe(true);
    expect(isPointInside(polys, 2.5, 2.5)).toBe(true);
    // Shared interior corner of the 4 voxel squares: (2, 2)
    expect(isPointInside(polys, 2.0, 2.0)).toBe(true);
    // Outer block extends from (1, 1) to (3, 3) in render coords; outer 4 corners
    // are cut at 45° by marching squares.
    expect(isPointInside(polys, 1.01, 1.01)).toBe(false);
    expect(isPointInside(polys, 2.99, 2.99)).toBe(false);
  });

  it('ignores other labels', () => {
    const labels = new Uint8Array(4 * 4);
    labels[1 * 4 + 1] = 1;
    labels[2 * 4 + 2] = 2;
    const polys1 = extractLabelPolygons(labels, 4, 4, 1);
    const polys2 = extractLabelPolygons(labels, 4, 4, 2);
    expect(isPointInside(polys1, 1.5, 1.5)).toBe(true);
    expect(isPointInside(polys1, 2.5, 2.5)).toBe(false);
    expect(isPointInside(polys2, 1.5, 1.5)).toBe(false);
    expect(isPointInside(polys2, 2.5, 2.5)).toBe(true);
  });

  it('closes contour at grid edge (voxel at corner (0,0))', () => {
    const labels = new Uint8Array(4 * 4);
    labels[0] = 1;
    const polys = extractLabelPolygons(labels, 4, 4, 1);
    // Voxel (0, 0) occupies render square [0, 1] × [0, 1], center (0.5, 0.5)
    expect(isPointInside(polys, 0.5, 0.5)).toBe(true);
    expect(isPointInside(polys, -0.5, -0.5)).toBe(false);
  });

  it('saddle case (diagonal voxels) emits two disconnected diamonds', () => {
    // Voxels (0, 0) and (1, 1), label 1; (1, 0) and (0, 1) are background.
    // Diamonds at (0.5, 0.5) and (1.5, 1.5); the saddle gap is between them.
    const labels = new Uint8Array(3 * 3);
    labels[0 * 3 + 0] = 1;
    labels[1 * 3 + 1] = 1;
    const polys = extractLabelPolygons(labels, 3, 3, 1);
    expect(isPointInside(polys, 0.5, 0.5)).toBe(true);
    expect(isPointInside(polys, 1.5, 1.5)).toBe(true);
    // The gap region — close to the (1, 0) voxel center — outside
    expect(isPointInside(polys, 1.5, 0.5)).toBe(false);
    expect(isPointInside(polys, 0.5, 1.5)).toBe(false);
  });

  it('bbox restricts extraction region', () => {
    const labels = new Uint8Array(4 * 4);
    labels[0 * 4 + 0] = 1;
    labels[3 * 4 + 3] = 1;
    const polys = extractLabelPolygons(labels, 4, 4, 1, 1, 0, {
      x0: 0, y0: 0, x1: 2, y1: 2,
    });
    expect(isPointInside(polys, 0.5, 0.5)).toBe(true);
    expect(isPointInside(polys, 3.5, 3.5)).toBe(false);
  });

  it('handles stride > 1 (label in channel 0)', () => {
    const labels = new Uint8Array([
      1, 99, 0, 99,
      0, 99, 0, 99,
    ]);
    const polys = extractLabelPolygons(labels, 2, 2, 1, 2, 0);
    expect(isPointInside(polys, 0.5, 0.5)).toBe(true);
    expect(isPointInside(polys, 1.5, 0.5)).toBe(false);
  });

  it('all-same-label grid covers every voxel-square center', () => {
    const labels = new Uint8Array(3 * 3).fill(1);
    const polys = extractLabelPolygons(labels, 3, 3, 1);
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        expect(isPointInside(polys, x + 0.5, y + 0.5)).toBe(true);
      }
    }
    // Outside the grid is not covered
    expect(isPointInside(polys, -0.5, -0.5)).toBe(false);
    expect(isPointInside(polys, 3.5, 3.5)).toBe(false);
  });
});
