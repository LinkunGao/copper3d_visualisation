/**
 * The mask's boundary on its own, so it can be stroked instead of filled.
 *
 * `extractLabelPolygons` emits one polygon per boundary cell plus run-length rectangles for
 * solid interior; their *union* is the silhouette, which is what `fill(nonzero)` draws.
 * Stroking that has no union operation -- it outlines every subpath, internal cell edges
 * included, and the mask comes out covered in a grid. So the boundary is extracted as its own
 * thing.
 *
 * The property that matters most is the last describe block: the boundary this produces and
 * the silhouette the fill produces have to be the SAME edge, or the mask's outline moves when
 * the clinician toggles the mode.
 */
import { describe, expect, it } from "vitest";

import {
  extractLabelBoundarySegments,
  extractLabelPolygons,
  type ContourPolygon,
} from "../MarchingSquares";

/**
 * Build a label grid from an ASCII picture. `.` is background; any other character is its
 * own label, numbered by first appearance, so a test reads as the shape it is testing.
 */
function grid(rows: string[]): { data: Uint8Array; width: number; height: number } {
  const height = rows.length;
  const width = rows[0].length;
  const data = new Uint8Array(width * height);
  const labels = new Map<string, number>();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ch = rows[y][x];
      if (ch === ".") continue;
      if (!labels.has(ch)) labels.set(ch, labels.size + 1);
      data[y * width + x] = labels.get(ch)!;
    }
  }
  return { data, width, height };
}

const segmentsOf = (rows: string[], label = 1, stride = 1, offset = 0) => {
  const g = grid(rows);
  return extractLabelBoundarySegments(g.data, g.width, g.height, label, stride, offset);
};

const key = (p: readonly [number, number]) => `${p[0]},${p[1]}`;

/** How many segments meet at each endpoint. */
function degrees(segments: ContourPolygon[]): Map<string, number> {
  const deg = new Map<string, number>();
  for (const seg of segments) {
    for (const p of seg) deg.set(key(p), (deg.get(key(p)) ?? 0) + 1);
  }
  return deg;
}

describe("extractLabelBoundarySegments", () => {
  it("gives every segment exactly two endpoints", () => {
    // These are line segments, not polygons. A three-point entry would stroke as two joined
    // lines and quietly break the closure property everything below relies on.
    for (const seg of segmentsOf([".....", ".111.", ".111.", ".111.", "....."])) {
      expect(seg).toHaveLength(2);
    }
  });

  it("draws a closed diamond around a single voxel", () => {
    // The four cells touching the voxel each contribute one cut, and together they enclose it.
    // Coordinates are voxel-space with the +0.5 shift the fill path uses.
    const segments = segmentsOf([
      ".....",
      ".....",
      "..1..",
      ".....",
      ".....",
    ]);

    expect(segments).toHaveLength(4);
    const points = new Set(segments.flat().map(key));
    // Midpoints of the voxel square's four sides: the voxel centre is (2.5, 2.5).
    expect([...points].sort()).toEqual(["2,2.5", "2.5,2", "2.5,3", "3,2.5"]);
  });

  it("closes every contour -- no loose ends anywhere", () => {
    // A boundary is a closed loop, so exactly two segments meet at each endpoint. A dangling
    // end means a cell emitted a cut its neighbour did not agree with, which on screen is a
    // gap in the outline.
    const shapes = [
      [".....", ".11..", ".111.", "..11.", "....."],
      [".....", ".1.1.", ".111.", ".1.1.", "....."],
      ["....", ".11.", ".11.", "...."],
    ];
    for (const rows of shapes) {
      for (const [point, degree] of degrees(segmentsOf(rows))) {
        expect(`${point} -> ${degree}`).toBe(`${point} -> 2`);
      }
    }
  });

  it("emits nothing for a label that is not there", () => {
    expect(segmentsOf([".....", ".111.", "....."], 7)).toEqual([]);
    expect(segmentsOf([".....", ".....", "....."])).toEqual([]);
  });

  it("is hollow -- the interior contributes nothing", () => {
    // The whole point. A filled cell surrounded by filled cells (case 15) has no boundary, so
    // doubling the side of a solid block roughly doubles the segment count. Were the interior
    // emitting anything, it would roughly quadruple.
    const solid = (side: number) => {
      const pad = 2;
      const size = side + pad * 2;
      const rows: string[] = [];
      for (let y = 0; y < size; y++) {
        let row = "";
        for (let x = 0; x < size; x++) {
          const inside = x >= pad && x < pad + side && y >= pad && y < pad + side;
          row += inside ? "1" : ".";
        }
        rows.push(row);
      }
      return segmentsOf(rows).length;
    };

    const small = solid(4);
    const large = solid(8);
    expect(large).toBe(small * 2);
  });

  it("gives a shape with a hole two separate loops", () => {
    // Outer boundary and inner boundary. Both closed, and the inner one is the reason an
    // outline is useful at all -- a fill would hide it.
    const segments = segmentsOf([
      ".....",
      ".111.",
      ".1.1.",
      ".111.",
      ".....",
    ]);

    for (const [, degree] of degrees(segments)) expect(degree).toBe(2);
    // The hole's own diamond is four segments, around the voxel centred at (2.5, 2.5).
    const points = new Set(segments.flat().map(key));
    for (const p of ["2,2.5", "2.5,2", "2.5,3", "3,2.5"]) expect(points.has(p)).toBe(true);
  });

  it("closes against the slice edge when the mask runs off it", () => {
    // Outside the grid is background, the same rule the fill path samples by. Without it the
    // contour would simply stop at the border and stroke as an open line.
    const segments = segmentsOf(["11.", "11.", "..."]);

    for (const [, degree] of degrees(segments)) expect(degree).toBe(2);
    expect(segments.length).toBeGreaterThan(0);
  });

  it("takes only the label it was asked for", () => {
    // Two findings touching each other. The boundary between them belongs to both, separately.
    const one = segmentsOf([".....", ".1122", ".1122", "....."], 1);
    const two = segmentsOf([".....", ".1122", ".1122", "....."], 2);

    for (const [, degree] of degrees(one)) expect(degree).toBe(2);
    for (const [, degree] of degrees(two)) expect(degree).toBe(2);
    expect(one.length).toBeGreaterThan(0);
    expect(two.length).toBeGreaterThan(0);
  });

  it("reads interleaved slices through stride and offset", () => {
    // MaskVolume hands out multi-channel slices; the label sits at `channelOffset` within
    // each voxel's channels.
    const plain = grid([".....", ".111.", ".111.", "....."]);
    const interleaved = new Uint8Array(plain.data.length * 3);
    for (let i = 0; i < plain.data.length; i++) {
      interleaved[i * 3 + 1] = plain.data[i];
      interleaved[i * 3] = 99; // a neighbouring channel that must not be read
    }

    const direct = extractLabelBoundarySegments(plain.data, plain.width, plain.height, 1);
    const strided = extractLabelBoundarySegments(
      interleaved, plain.width, plain.height, 1, 3, 1,
    );

    expect(strided).toEqual(direct);
  });
});

/**
 * A2: the outline must sit exactly where the fill's edge sits.
 *
 * Both are derived from the same 16-case table, so this is structural rather than lucky --
 * but the two tables are written out separately, and a typo in one cell of either is exactly
 * the kind of thing that ships looking almost right.
 */
describe("the outline and the fill agree on where the mask ends", () => {
  const shapes = [
    [".....", "..1..", "....."],                       // single voxel
    [".....", ".11..", ".111.", "..11.", "....."],     // a blob
    [".....", ".111.", ".1.1.", ".111.", "....."],     // a ring
    [".....", ".1.1.", "..1..", ".1.1.", "....."],     // both saddle cases
    ["11.", "11.", "..."],                             // against the slice edge
  ];

  /** Every edge of every fill polygon, as an unordered point pair. */
  function fillEdges(rows: string[]): Set<string> {
    const g = grid(rows);
    const polygons = extractLabelPolygons(g.data, g.width, g.height, 1);
    const edges = new Set<string>();
    for (const poly of polygons) {
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        edges.add([key(a), key(b)].sort().join("|"));
      }
    }
    return edges;
  }

  it("puts every boundary segment on an edge the fill also has", () => {
    // The fill's polygons tile the silhouette, so its outer edge is made of polygon edges.
    // A boundary segment that is not one of them is a line drawn somewhere the fill does not
    // end -- the outline would be offset from the filled shape it replaces.
    for (const rows of shapes) {
      const edges = fillEdges(rows);
      for (const seg of segmentsOf(rows)) {
        const edge = [key(seg[0]), key(seg[1])].sort().join("|");
        // Named in the assertion so a failure says which shape and which edge, rather than
        // "expected false to be true" five shapes deep.
        expect(edges.has(edge) ? edge : `${rows.join("/")} has no fill edge ${edge}`).toBe(edge);
      }
    }
  });

  it("agrees with the fill on both saddle cases", () => {
    // Cases 5 and 10 are ambiguous: the two in-corners can be read as joined or separate.
    // `CELL_POLYGONS` reads them as separate (4-connectivity), and a table that chose the
    // other reading would draw a boundary through solid mask.
    const rows = [".....", ".1.1.", "..1..", ".1.1.", "....."];
    const edges = fillEdges(rows);
    const segments = segmentsOf(rows);

    for (const seg of segments) {
      expect(edges.has([key(seg[0]), key(seg[1])].sort().join("|"))).toBe(true);
    }
    for (const [, degree] of degrees(segments)) expect(degree).toBe(2);
  });
});
