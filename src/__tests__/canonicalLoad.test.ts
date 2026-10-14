import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { OrientationError } from "../Utils/orientation";

/**
 * Every NRRD the engine loads arrives in the canonical voxel order (i -> patient Left,
 * j -> Posterior, k -> Superior), whatever order its file stores. So one patient stored three ways
 * must come out of the worker as the same volume and paint the same pixels in every view. A file
 * whose patient orientation cannot be established must be refused, not drawn.
 */

vi.mock("dat.gui", () => ({ GUI: class {} }));

let capturedFrames: ImageData[] = [];

beforeAll(() => {
  (HTMLCanvasElement.prototype as any).getContext = function () {
    return {
      getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: (imageData: ImageData) => { capturedFrames.push(imageData); },
      drawImage: () => {},
    };
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

type Vec3 = [number, number, number];

/** The patient, LPS-ordered: an asymmetric value at every voxel so any flip changes pixels. */
const CANONICAL_DIMS: Vec3 = [5, 4, 3];
const patient = (c0: number, c1: number, c2: number) => (c0 * 31 + c1 * 7 + c2 * 53 + 5) % 251;

interface Stored {
  sizes: Vec3;
  directions: [Vec3, Vec3, Vec3];
  origin: Vec3;
  space?: string;
  value: (i: number, j: number, k: number) => number;
}

const [NX, NY, NZ] = CANONICAL_DIMS;
const STORED: Record<string, Stored> = {
  lps: {
    sizes: [NX, NY, NZ],
    directions: [[1, 0, 0], [0, 1, 0], [0, 0, 2]],
    origin: [10, 20, 30],
    value: (i, j, k) => patient(i, j, k),
  },
  ras: {
    sizes: [NX, NY, NZ],
    directions: [[-1, 0, 0], [0, -1, 0], [0, 0, 2]],
    origin: [10 + NX - 1, 20 + NY - 1, 30],
    value: (i, j, k) => patient(NX - 1 - i, NY - 1 - j, k),
  },
  // A sagittal acquisition: native i -> P, j -> I, k -> L.
  sagittal: {
    sizes: [NY, NZ, NX],
    directions: [[0, 1, 0], [0, 0, -2], [1, 0, 0]],
    origin: [10, 20, 30 + (NZ - 1) * 2],
    value: (i, j, k) => patient(k, i, NZ - 1 - j),
  },
};

function buildNrrd(stored: Stored): ArrayBuffer {
  const [sx, sy, sz] = stored.sizes;
  const vector = (v: number[]) => `(${v.join(",")})`;
  const header =
    "NRRD0004\n" +
    "type: uint8\n" +
    "dimension: 3\n" +
    `space: ${stored.space ?? "left-posterior-superior"}\n` +
    `sizes: ${sx} ${sy} ${sz}\n` +
    `space directions: ${stored.directions.map(vector).join(" ")}\n` +
    "kinds: domain domain domain\n" +
    "encoding: raw\n" +
    "endian: little\n" +
    `space origin: ${vector(stored.origin)}\n` +
    "\n";
  const headerBytes = new TextEncoder().encode(header);
  const out = new Uint8Array(headerBytes.length + sx * sy * sz);
  out.set(headerBytes, 0);
  let n = headerBytes.length;
  for (let k = 0; k < sz; k++) for (let j = 0; j < sy; j++) for (let i = 0; i < sx; i++) out[n++] = stored.value(i, j, k);
  return out.buffer;
}

function okResponse(buffer: ArrayBuffer) {
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { get: (name: string) => (name === "content-length" ? String(buffer.byteLength) : null) },
    body: null,
    arrayBuffer: async () => buffer,
  };
}

function loadingBar() {
  const loadingContainer = document.createElement("div");
  const progress = document.createElement("div");
  loadingContainer.appendChild(progress);
  return { loadingContainer, progress } as any;
}

async function loadThroughWorker(buffer: ArrayBuffer): Promise<any> {
  vi.resetModules();
  const loaderModule = await import("../Loader/copperNrrdLoader");
  const { createInProcessNrrdWorker } = await import("./helpers/fakeNrrdWorker");
  loaderModule.__setNrrdWorkerFactoryForTests(createInProcessNrrdWorker);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse(buffer)));
  return new Promise<any>((resolve, reject) => {
    loaderModule.copperNrrdLoader("v.nrrd", loadingBar(), (v) => resolve(v), {
      openGui: false,
      axes: ["z"],
      onError: reject,
    });
  });
}

function frame(volume: any, axis: "x" | "y" | "z", index: number): Uint8ClampedArray {
  capturedFrames = [];
  const a = axis === "x" ? 0 : axis === "y" ? 1 : 2;
  volume.extractSlice(axis, index * volume.spacing[a]);
  expect(capturedFrames.length).toBeGreaterThan(0);
  return capturedFrames[capturedFrames.length - 1]!.data.slice();
}

describe("one patient stored three ways loads as one canonical volume", () => {
  it("rewrites every geometry field to the canonical order", async () => {
    const lps = await loadThroughWorker(buildNrrd(STORED.lps));
    for (const storage of ["ras", "sagittal"]) {
      const volume = await loadThroughWorker(buildNrrd(STORED[storage]));
      expect(volume.dimensions).toEqual(CANONICAL_DIMS);
      expect([volume.xLength, volume.yLength, volume.zLength]).toEqual(CANONICAL_DIMS);
      expect(volume.spacing).toEqual([1, 1, 2]);
      expect(volume.axisOrder).toEqual(["x", "y", "z"]);
      expect(volume.RASDimensions).toEqual(lps.RASDimensions);
      expect(Array.from(volume.matrix.elements)).toEqual(Array.from(lps.matrix.elements));
      expect(Array.from(volume.inverseMatrix.elements)).toEqual(Array.from(lps.inverseMatrix.elements));
      expect(volume.header.space).toBe("left-posterior-superior");
      expect(volume.header.sizes).toEqual(CANONICAL_DIMS);
      expect(volume.header.vectors).toEqual([[1, 0, 0], [0, 1, 0], [0, 0, 2]]);
      expect(volume.header.space_origin).toEqual([10, 20, 30]);
      expect(volume.segmentation).toBe(true);
      expect(Array.from(volume.data)).toEqual(Array.from(lps.data));
    }
  });

  it("states the transform each file went through, and keeps the canonical geometry", async () => {
    const lps = await loadThroughWorker(buildNrrd(STORED.lps));
    const ras = await loadThroughWorker(buildNrrd(STORED.ras));
    const sagittal = await loadThroughWorker(buildNrrd(STORED.sagittal));

    expect(lps.orientation.transform.perm).toEqual([0, 1, 2]);
    expect(lps.orientation.transform.flip).toEqual([false, false, false]);
    expect(ras.orientation.transform.flip).toEqual([true, true, false]);
    expect(sagittal.orientation.transform.perm).toEqual([2, 0, 1]);
    expect(sagittal.orientation.transform.flip).toEqual([false, false, true]);
    expect(sagittal.orientation.nativeDims).toEqual([NY, NZ, NX]);
    for (const volume of [lps, ras, sagittal]) {
      expect(volume.orientation.geometry.dims).toEqual(CANONICAL_DIMS);
      expect(volume.orientation.geometry.directions).toEqual([[1, 0, 0], [0, 1, 0], [0, 0, 2]]);
      expect(volume.orientation.geometry.origin).toEqual([10, 20, 30]);
    }
  });

  it.each(["ras", "sagittal"])("paints the same pixels as the LPS-stored copy in every view (%s)", async (storage) => {
    const lps = await loadThroughWorker(buildNrrd(STORED.lps));
    const other = await loadThroughWorker(buildNrrd(STORED[storage]));
    for (const [axis, last] of [["z", NZ - 1], ["y", NY - 1], ["x", NX - 1]] as const) {
      for (const index of [0, last]) {
        expect(frame(other, axis, index), `${axis} slice ${index}`).toEqual(frame(lps, axis, index));
      }
    }
  });
});

describe("slice addressing stays exact on an oblique grid", () => {
  it("reaches the last slice of a tall oblique volume", async () => {
    // k is tilted ~6.6 degrees: its step is 0.503 mm long but only 0.5 mm along S. three turns a
    // slice position (index x step length) back into an index through the inverse matrix; left with
    // these cross terms, the last slice comes out as 399 x 0.503 / 0.5 ~ 401, past the end.
    const a = (0.3 * Math.PI) / 180;
    const nz = 400;
    const stored: Stored = {
      sizes: [3, 3, nz],
      directions: [[Math.cos(a), Math.sin(a), 0], [-Math.sin(a), Math.cos(a), 0], [0.05, 0.03, 0.5]],
      origin: [0, 0, 0],
      value: (i, j, k) => (k * 3 + i + j) % 256,
    };
    const volume = await loadThroughWorker(buildNrrd(stored));
    const plane = volume.extractPerpendicularPlane("z", (nz - 1) * volume.spacing[2]);
    expect(plane.sliceAccess(0, 0)).toBe(volume.access(0, plane.jLength - 1, nz - 1));
  });
});

describe("a slice plane and the other planes' textures put a voxel in the same place", () => {
  // Spacings whose n·s is not whole along x and z, as in real data (384 × 0.885 mm). three places
  // the plane for slice index k·s at k·s − (RASDimensions − 1)/2, and a texture spans n·s centred
  // on 0, so it draws voxel k's centre at (k + ½)·s − n·s/2. They agree only when
  // RASDimensions = (n − 1)·s + 1; ⌊n·s⌋ put them up to half a millimetre apart.
  const SPACING: Vec3 = [0.885, 1.5, 2.2];
  const anisotropic: Stored = {
    sizes: [NX, NY, NZ],
    directions: [[SPACING[0], 0, 0], [0, SPACING[1], 0], [0, 0, SPACING[2]]],
    origin: [0, 0, 0],
    value: (i, j, k) => patient(i, j, k),
  };
  const AXES = ["x", "y", "z"] as const;

  it("for the first and last voxel on every axis", async () => {
    const volume = await loadThroughWorker(buildNrrd(anisotropic));
    AXES.forEach((axis, a) => {
      const n = CANONICAL_DIMS[a];
      const s = SPACING[a];
      for (const k of [0, n - 1]) {
        const plane = volume.extractPerpendicularPlane(axis, k * s);
        const textureCentre = (k + 0.5) * s - (n * s) / 2;
        expect(plane.matrix.elements[12 + a], `${axis} voxel ${k}`).toBeCloseTo(textureCentre, 9);
      }
    });
  });

  it("the textures really do span n·s", async () => {
    const volume = await loadThroughWorker(buildNrrd(anisotropic));
    const z = volume.extractPerpendicularPlane("z", 0);
    const y = volume.extractPerpendicularPlane("y", 0);
    expect(z.planeWidth).toBeCloseTo(NX * SPACING[0], 9);
    expect(z.planeHeight).toBeCloseTo(NY * SPACING[1], 9);
    expect(y.planeHeight).toBeCloseTo(NZ * SPACING[2], 9);
  });

  it("the slice range ends exactly on the last voxel", async () => {
    const volume = await loadThroughWorker(buildNrrd(anisotropic));
    AXES.forEach((_axis, a) => {
      expect(volume.RASDimensions[a] - 1).toBeCloseTo((CANONICAL_DIMS[a] - 1) * SPACING[a], 9);
    });
  });
});

describe("a volume without a patient orientation is refused", () => {
  it.each([
    ["no_space", "NRRD0004\ntype: uint8\ndimension: 3\nsizes: 2 2 2\nencoding: raw\nendian: little\n\n"],
    [
      "scanner_space",
      "NRRD0004\ntype: uint8\ndimension: 3\nspace: scanner-xyz\nsizes: 2 2 2\nspace directions: (1,0,0) (0,1,0) (0,0,1)\nencoding: raw\nendian: little\nspace origin: (0,0,0)\n\n",
    ],
    [
      "no_directions",
      "NRRD0004\ntype: uint8\ndimension: 3\nspace: left-posterior-superior\nsizes: 2 2 2\nencoding: raw\nendian: little\nspace origin: (0,0,0)\n\n",
    ],
  ])("%s", async (code, header) => {
    const headerBytes = new TextEncoder().encode(header);
    const buffer = new Uint8Array(headerBytes.length + 8);
    buffer.set(headerBytes, 0);
    let caught: unknown;
    try {
      await loadThroughWorker(buffer.buffer);
    } catch (err) {
      caught = err;
    }
    // The error crosses the worker boundary; the main thread gets the engine's own class back.
    expect((caught as Error)?.name).toBe("OrientationError");
    expect((caught as OrientationError).code).toBe(code);
    expect((caught as OrientationError).detail.length).toBeGreaterThan(0);
  });
});
