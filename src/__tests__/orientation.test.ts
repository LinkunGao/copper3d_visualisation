/**
 * The canonical voxel order (i -> patient Left, j -> Posterior, k -> Superior), and the rule that
 * puts any NRRD into it. The app holds this module to the backend's answers through a shared
 * fixture; these cases keep the engine package's own tests self-contained.
 */
import { describe, expect, it } from "vitest";

import {
  OrientationError,
  canonicalTransform,
  geometryFromNrrd,
  nrrdHeaderText,
  orientationTransform,
  readNrrdOrientationFields,
  reorientVoxels,
  reorientedGeometry,
  viewLabels,
  type NrrdOrientationFields,
  type Vec3,
  type VolumeGeometry,
} from "../Utils/orientation";

const LPS = "left-posterior-superior";
const PLAIN = {
  z: { left: "R", right: "L", top: "A", bottom: "P" },
  y: { left: "R", right: "L", top: "S", bottom: "I" },
  x: { left: "A", right: "P", top: "S", bottom: "I" },
};

function fields(over: Partial<NrrdOrientationFields> = {}): NrrdOrientationFields {
  return {
    space: LPS,
    sizes: [4, 3, 2],
    spaceDirections: [[1, 0, 0], [0, 2, 0], [0, 0, 3]],
    spaceOrigin: [10, 20, 30],
    ...over,
  };
}

/** value(i, j, k) flattened with i fastest -- NRRD's own order. */
function fOrder(dims: Vec3, value: (i: number, j: number, k: number) => number): number[] {
  const out: number[] = [];
  for (let k = 0; k < dims[2]; k++)
    for (let j = 0; j < dims[1]; j++)
      for (let i = 0; i < dims[0]; i++) out.push(value(i, j, k));
  return out;
}

const nativeValue = (i: number, j: number, k: number) => i + 4 * j + 12 * k; // native dims [4,3,2]

function refusalCode(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (err) {
    if (err instanceof OrientationError) {
      expect(err.detail.length).toBeGreaterThan(0);
      return err.code;
    }
    throw err;
  }
  return undefined;
}

function expectClose(actual: number[] | number[][], expected: number[] | number[][], tol = 1e-9) {
  const a = (actual as number[][]).flat();
  const e = (expected as number[][]).flat();
  expect(a.length).toBe(e.length);
  a.forEach((v, n) => expect(Math.abs(v - e[n])).toBeLessThanOrEqual(tol));
}

describe("readNrrdOrientationFields", () => {
  const header = [
    "NRRD0004",
    "# Complete NRRD file format specification at:",
    "type: short",
    "dimension: 3",
    "Space: left-posterior-superior",
    "sizes: 512 512 156",
    "space directions: (-0.625,0,0) (0,-0.625,0) (0,0,1.3999974193548388)",
    "kinds: domain domain domain",
    "endian: little",
    "encoding: raw",
    "space origin: (155.93700000000001,116.562,-70.687600000000003)",
    "space:=not a field, a key/value pair",
    "max:=14518",
  ].join("\r\n");

  it("reads space, sizes, directions and origin; skips comments and key/value pairs", () => {
    const f = readNrrdOrientationFields(header);
    expect(f.space).toBe(LPS);
    expect(f.sizes).toEqual([512, 512, 156]);
    expect(f.spaceDirections).toEqual([[-0.625, 0, 0], [0, -0.625, 0], [0, 0, 1.3999974193548388]]);
    expect(f.spaceOrigin).toEqual([155.93700000000001, 116.562, -70.687600000000003]);
  });

  it("keeps a 'none' direction as null and reports absent fields as null", () => {
    const f = readNrrdOrientationFields("NRRD0004\nsizes: 4 3 2 5\nspace directions: (1,0,0) (0,1,0) (0,0,1) none\n");
    expect(f.space).toBeNull();
    expect(f.spaceOrigin).toBeNull();
    expect(f.spaceDirections).toEqual([[1, 0, 0], [0, 1, 0], [0, 0, 1], null]);
  });
});

describe("nrrdHeaderText", () => {
  const bytes = (text: string, tail: number[] = []) => {
    const head = new TextEncoder().encode(text);
    const out = new Uint8Array(head.length + tail.length);
    out.set(head, 0);
    out.set(tail, head.length);
    return out.buffer;
  };

  it("returns the header up to the blank line, leaving binary data out", () => {
    const text = nrrdHeaderText(bytes("NRRD0004\nspace: left-posterior-superior\n\n", [0x1f, 0x8b, 0x0a, 0x0a, 0xff]));
    expect(text).toBe("NRRD0004\nspace: left-posterior-superior");
  });

  it("accepts CRLF line endings", () => {
    expect(nrrdHeaderText(bytes("NRRD0004\r\nsizes: 2 2 2\r\n\r\n", [1, 2]))).toBe("NRRD0004\r\nsizes: 2 2 2");
  });

  it("refuses a document that is not an NRRD", () => {
    expect(() => nrrdHeaderText(bytes("PK\u0003\u0004 not an nrrd\n\n"))).toThrow(/not an NRRD/);
    expect(() => nrrdHeaderText(bytes("NRRD0004\nsizes: 2 2 2\n"))).toThrow(/header/);
  });
});

describe("geometryFromNrrd", () => {
  it("takes an LPS header as it is", () => {
    const g = geometryFromNrrd(fields());
    expect(g.dims).toEqual([4, 3, 2]);
    expect(g.directions).toEqual([[1, 0, 0], [0, 2, 0], [0, 0, 3]]);
    expect(g.origin).toEqual([10, 20, 30]);
  });

  it.each([
    ["right-anterior-superior", [[-0.5, 0, 0], [0, -0.5, 0], [0, 0, 2]], [10, 20, 30]],
    ["RAS", [[-0.5, 0, 0], [0, -0.5, 0], [0, 0, 2]], [10, 20, 30]],
    ["left-anterior-superior", [[0.5, 0, 0], [0, -0.5, 0], [0, 0, 2]], [-10, 20, 30]],
  ])("converts a %s header into LPS", (space, directions, origin) => {
    const g = geometryFromNrrd(fields({ space, spaceDirections: [[0.5, 0, 0], [0, 0.5, 0], [0, 0, 2]], spaceOrigin: [-10, -20, 30] }));
    expectClose(g.directions, directions as number[][]);
    expectClose(g.origin, origin);
  });

  it("accepts space names in any case", () => {
    expect(geometryFromNrrd(fields({ space: "LPS" })).origin).toEqual([10, 20, 30]);
    expect(geometryFromNrrd(fields({ space: "Left-Posterior-Superior" })).origin).toEqual([10, 20, 30]);
  });

  it.each<[string, Partial<NrrdOrientationFields>]>([
    ["no_space", { space: null }],
    ["no_space", { space: "  " }],
    ["time_space", { space: "right-anterior-superior-time" }],
    ["time_space", { space: "LPST" }],
    ["scanner_space", { space: "scanner-xyz" }],
    ["non_anatomical_space", { space: "3D-right-handed" }],
    ["unknown_space", { space: "patient-xyz" }],
    ["no_directions", { spaceDirections: null }],
    ["not_3d", { sizes: [4, 3, 2, 5], spaceDirections: [[1, 0, 0], [0, 1, 0], [0, 0, 1], null] }],
    ["not_3d", { spaceDirections: [[1, 0, 0], [0, 1, 0], null] }],
    ["no_origin", { spaceOrigin: null }],
    ["degenerate", { spaceDirections: [[1, 0, 0], [0, 0, 0], [0, 0, 1]] }],
    ["degenerate", { spaceOrigin: [0, Number.NaN, 0] }],
  ])("refuses with %s", (code, over) => {
    expect(refusalCode(() => geometryFromNrrd(fields(over)))).toBe(code);
  });
});

describe("canonicalTransform and reorientedGeometry", () => {
  it("is the identity for an LPS-stored grid", () => {
    const g = geometryFromNrrd(fields());
    const t = canonicalTransform(g);
    expect(t.perm).toEqual([0, 1, 2]);
    expect(t.flip).toEqual([false, false, false]);
    expect(reorientedGeometry(g, t)).toEqual(g);
  });

  it("flips i and j of a RAS-stored grid and moves the origin to the new first voxel", () => {
    const g = geometryFromNrrd(fields({ spaceDirections: [[-0.5, 0, 0], [0, -0.5, 0], [0, 0, 2]] }));
    const t = canonicalTransform(g);
    expect(t.perm).toEqual([0, 1, 2]);
    expect(t.flip).toEqual([true, true, false]);
    const c = reorientedGeometry(g, t);
    expect(c.dims).toEqual([4, 3, 2]);
    expectClose(c.directions, [[0.5, 0, 0], [0, 0.5, 0], [0, 0, 2]]);
    expectClose(c.origin, [8.5, 19, 30]);
  });

  it("permutes a sagittal acquisition", () => {
    // native i -> P, j -> I (i.e. -S), k -> L
    const g = geometryFromNrrd(fields({ spaceDirections: [[0, 0.5, 0], [0, 0, -0.8], [2, 0, 0]] }));
    const t = canonicalTransform(g);
    expect(t.perm).toEqual([2, 0, 1]);
    expect(t.flip).toEqual([false, false, true]);
    const c = reorientedGeometry(g, t);
    expect(c.dims).toEqual([2, 4, 3]);
    expectClose(c.directions, [[2, 0, 0], [0, 0.5, 0], [0, 0, 0.8]]);
    expectClose(c.origin, [10, 20, 28.4]);
  });

  it("keeps obliquity instead of snapping it, and reports it per axis", () => {
    const a = (10 * Math.PI) / 180;
    const directions = [[Math.cos(a), Math.sin(a), 0], [-Math.sin(a), Math.cos(a), 0], [0, 0, 1]];
    const g = geometryFromNrrd(fields({ spaceDirections: directions }));
    const t = canonicalTransform(g);
    expectClose(t.obliquityDeg, [10, 10, 0], 1e-6);
    expectClose(reorientedGeometry(g, t).directions, directions);
  });

  it("accepts 44 degrees and refuses 45, where no axis is nearest", () => {
    const rotated = (deg: number) => {
      const a = (deg * Math.PI) / 180;
      return geometryFromNrrd(fields({ spaceDirections: [[Math.cos(a), Math.sin(a), 0], [-Math.sin(a), Math.cos(a), 0], [0, 0, 1]] }));
    };
    expect(canonicalTransform(rotated(44)).perm).toEqual([0, 1, 2]);
    expect(refusalCode(() => canonicalTransform(rotated(45)))).toBe("ambiguous_oblique");
  });

  it("keeps every voxel at its patient position", () => {
    const grids = [
      fields({ spaceDirections: [[-0.5, 0, 0], [0, -0.5, 0], [0, 0, 2]] }),
      fields({ spaceDirections: [[0, 0.5, 0], [0, 0, -0.8], [2, 0, 0]] }),
      fields({ spaceDirections: [[0.98, 0.17, 0.01], [-0.17, 0.98, 0], [0, -0.02, -1.5]] }),
    ];
    for (const f of grids) {
      const g = geometryFromNrrd(f);
      const t = canonicalTransform(g);
      const c = reorientedGeometry(g, t);
      for (const corner of [[0, 0, 0], [c.dims[0] - 1, c.dims[1] - 1, c.dims[2] - 1], [c.dims[0] - 1, 0, c.dims[2] - 1]]) {
        const n = [0, 0, 0];
        t.perm.forEach((native, axis) => {
          n[native] = t.flip[axis] ? g.dims[native] - 1 - corner[axis] : corner[axis];
        });
        const before = [0, 1, 2].map((x) => g.origin[x] + n[0] * g.directions[0][x] + n[1] * g.directions[1][x] + n[2] * g.directions[2][x]);
        const after = [0, 1, 2].map((x) => c.origin[x] + corner[0] * c.directions[0][x] + corner[1] * c.directions[1][x] + corner[2] * c.directions[2][x]);
        expectClose(after, before);
      }
    }
  });

  it("can target the opposite order too", () => {
    const g = geometryFromNrrd(fields());
    const t = orientationTransform(g, "RAI");
    expect(t.perm).toEqual([0, 1, 2]);
    expect(t.flip).toEqual([true, true, true]);
    expect(() => orientationTransform(g, "LPX")).toThrow();
    expect(() => orientationTransform(g, "LLS")).toThrow();
  });
});

describe("reorientVoxels", () => {
  const native = fOrder([4, 3, 2], nativeValue);

  it("returns the very same array for the identity transform -- no copy", () => {
    const data = new Int16Array(native);
    const g = geometryFromNrrd(fields());
    expect(reorientVoxels(data, g.dims, canonicalTransform(g))).toBe(data);
  });

  it("reverses i and j of a RAS-stored volume", () => {
    const g = geometryFromNrrd(fields({ spaceDirections: [[-0.5, 0, 0], [0, -0.5, 0], [0, 0, 2]] }));
    const out = reorientVoxels(new Uint16Array(native), g.dims, canonicalTransform(g));
    expect(out).toBeInstanceOf(Uint16Array);
    expect(Array.from(out)).toEqual(fOrder([4, 3, 2], (c0, c1, c2) => nativeValue(3 - c0, 2 - c1, c2)));
  });

  it("permutes a sagittal acquisition", () => {
    const g = geometryFromNrrd(fields({ spaceDirections: [[0, 0.5, 0], [0, 0, -0.8], [2, 0, 0]] }));
    const out = reorientVoxels(new Float32Array(native), g.dims, canonicalTransform(g));
    expect(out).toBeInstanceOf(Float32Array);
    expect(Array.from(out)).toEqual(fOrder([2, 4, 3], (c0, c1, c2) => nativeValue(c1, 2 - c2, c0)));
  });

  it("refuses data that does not fill the grid", () => {
    const g = geometryFromNrrd(fields({ spaceDirections: [[-0.5, 0, 0], [0, -0.5, 0], [0, 0, 2]] }));
    expect(() => reorientVoxels(new Int16Array(5), g.dims, canonicalTransform(g))).toThrow();
  });
});

describe("viewLabels", () => {
  const canonical = (f: NrrdOrientationFields): VolumeGeometry => {
    const g = geometryFromNrrd(f);
    return reorientedGeometry(g, canonicalTransform(g));
  };

  it.each(["z", "y", "x"] as const)("names the plain anatomical directions in the %s view", (axis) => {
    expect(viewLabels(axis, canonical(fields({ spaceDirections: [[-0.5, 0, 0], [0, -0.5, 0], [0, 0, 2]] })))).toEqual(PLAIN[axis]);
  });

  it("keeps single letters below 1 degree of obliquity", () => {
    const a = (0.5 * Math.PI) / 180;
    const g = canonical(fields({ spaceDirections: [[Math.cos(a), Math.sin(a), 0], [-Math.sin(a), Math.cos(a), 0], [0, 0, 1]] }));
    expect(viewLabels("z", g)).toEqual(PLAIN.z);
  });

  it("adds the secondary direction above 1 degree, largest first", () => {
    const a = (10 * Math.PI) / 180;
    const g = canonical(fields({ spaceDirections: [[Math.cos(a), Math.sin(a), 0], [-Math.sin(a), Math.cos(a), 0], [0, 0, 1]] }));
    expect(viewLabels("z", g)).toEqual({ left: "RA", right: "LP", top: "AL", bottom: "PR" });
    expect(viewLabels("y", g)).toEqual({ left: "RA", right: "LP", top: "S", bottom: "I" });
    expect(viewLabels("x", g)).toEqual({ left: "AL", right: "PR", top: "S", bottom: "I" });
  });
});
