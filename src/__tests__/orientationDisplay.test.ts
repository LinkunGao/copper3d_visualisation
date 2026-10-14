import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { SliceRenderPipeline, displaySizeOf } from "../Utils/segmentation/tools/SliceRenderPipeline";
import { viewLabels, type VolumeGeometry } from "../Utils/orientation";

/**
 * The orientation letters must name what is really on screen. `viewLabels` states each view's
 * layout as a table; the screen gets its layout from three's slice addressing plus the engine's
 * display transform (`flipDisplayImageByAxis`). This drives the real loader and the real
 * transform, finds which voxel step one screen pixel right and one screen pixel down are, and
 * checks the letters against the patient directions of those steps.
 */

vi.mock("dat.gui", () => ({ GUI: class {} }));

beforeAll(() => {
  (HTMLCanvasElement.prototype as any).getContext = function () {
    return {
      getImageData: (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: () => {},
      drawImage: () => {},
    };
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

type Vec3 = [number, number, number];
const DIMS: Vec3 = [4, 3, 2];
/** Every voxel holds its own index, so a sampled value says which voxel it is. */
const encode = (i: number, j: number, k: number) => i + DIMS[0] * j + DIMS[0] * DIMS[1] * k;
const decode = (v: number): Vec3 => [v % DIMS[0], Math.floor(v / DIMS[0]) % DIMS[1], Math.floor(v / (DIMS[0] * DIMS[1]))];

function buildNrrd(directions: number[][]): ArrayBuffer {
  const vector = (v: number[]) => `(${v.join(",")})`;
  const header =
    "NRRD0004\ntype: uint8\ndimension: 3\nspace: left-posterior-superior\n" +
    `sizes: ${DIMS.join(" ")}\nspace directions: ${directions.map(vector).join(" ")}\n` +
    "kinds: domain domain domain\nencoding: raw\nendian: little\nspace origin: (0,0,0)\n\n";
  const head = new TextEncoder().encode(header);
  const out = new Uint8Array(head.length + DIMS[0] * DIMS[1] * DIMS[2]);
  out.set(head, 0);
  let n = head.length;
  for (let k = 0; k < DIMS[2]; k++) for (let j = 0; j < DIMS[1]; j++) for (let i = 0; i < DIMS[0]; i++) out[n++] = encode(i, j, k);
  return out.buffer;
}

async function load(directions: number[][]): Promise<any> {
  vi.resetModules();
  const loaderModule = await import("../Loader/copperNrrdLoader");
  const { createInProcessNrrdWorker } = await import("./helpers/fakeNrrdWorker");
  loaderModule.__setNrrdWorkerFactoryForTests(createInProcessNrrdWorker);
  const buffer = buildNrrd(directions);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true, status: 200, statusText: "OK", body: null,
    headers: { get: (n: string) => (n === "content-length" ? String(buffer.byteLength) : null) },
    arrayBuffer: async () => buffer,
  }));
  const bar = { loadingContainer: document.createElement("div"), progress: document.createElement("div") } as any;
  return new Promise((resolve, reject) => {
    loaderModule.copperNrrdLoader("v.nrrd", bar, (v) => resolve(v), { openGui: false, axes: ["z"], onError: reject });
  });
}

type Mat = [number, number, number, number, number, number]; // a b c d e f, as a canvas has it
const mul = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];

/**
 * Where pixel (column, row) of three's slice canvas lands on screen. The real
 * `flipDisplayImageByAxis` sets the transform, and the callers then draw three's canvas into
 * the display size, which `displaySizeOf` gives.
 */
function displayTransform(axis: "x" | "y" | "z", columns: number, rows: number) {
  const shown = displaySizeOf(axis, { width: columns, height: rows });
  let m: Mat = [1, 0, 0, 1, 0, 0];
  const recorder = {
    scale: (a: number, b: number) => { m = mul(m, [a, 0, 0, b, 0, 0]); },
    translate: (a: number, b: number) => { m = mul(m, [1, 0, 0, 1, a, b]); },
    transform: (a: number, b: number, c: number, d: number, e: number, f: number) => { m = mul(m, [a, b, c, d, e, f]); },
  };
  const pipeline: any = Object.create(SliceRenderPipeline.prototype);
  pipeline.ctx = {
    protectedData: { axis, ctxes: { displayCtx: recorder } },
    nrrd_states: { view: { changedWidth: shown.width, changedHeight: shown.height } },
  };
  pipeline.flipDisplayImageByAxis();
  return (u: number, v: number): [number, number] => {
    const x = (u * shown.width) / columns;
    const y = (v * shown.height) / rows;
    return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
  };
}

const LETTERS = (d: number[]) =>
  [0, 1, 2]
    .filter((a) => Math.abs(d[a]) > Math.sin(Math.PI / 180))
    .sort((a, b) => Math.abs(d[b]) - Math.abs(d[a]))
    .map((a) => (d[a] > 0 ? "LPS" : "RAI")[a])
    .join("");

/** Which voxel step one screen pixel right and one screen pixel down are, in an axis's view. */
function screenSteps(volume: any, axis: "x" | "y" | "z") {
  const a = axis === "x" ? 0 : axis === "y" ? 1 : 2;
  const plane = volume.extractPerpendicularPlane(axis, Math.floor(volume.dimensions[a] / 2) * volume.spacing[a]);
  const toScreen = displayTransform(axis, plane.iLength, plane.jLength);
  // `sliceAccess` gives the index into the (canonical) data; the value there is the voxel's
  // index in the FILE, which is what the file's directions describe.
  const voxel = (c: number, r: number) => decode(volume.data[plane.sliceAccess(c, r)]);
  const step = (from: Vec3, to: Vec3, sign: number): Vec3 => [0, 1, 2].map((n) => (to[n] - from[n]) * sign) as Vec3;

  const [x0, y0] = toScreen(0, 0);
  const [xc, yc] = toScreen(1, 0);
  const [xr, yr] = toScreen(0, 1);
  // Rounded: the display size can scale a step by a ratio that is 1 only up to float error.
  const alongColumn: [number, number] = [Math.round(xc - x0), Math.round(yc - y0)];
  const alongRow: [number, number] = [Math.round(xr - x0), Math.round(yr - y0)];
  const right = Math.abs(alongColumn[0]) === 1
    ? step(voxel(0, 0), voxel(1, 0), alongColumn[0])
    : step(voxel(0, 0), voxel(0, 1), alongRow[0]);
  const down = Math.abs(alongRow[1]) === 1
    ? step(voxel(0, 0), voxel(0, 1), alongRow[1])
    : step(voxel(0, 0), voxel(1, 0), alongColumn[1]);
  return { right, down };
}

function patientDirection(geometry: VolumeGeometry, voxelStep: Vec3): number[] {
  const unit = geometry.directions.map((d) => d.map((c) => c / Math.hypot(...d)));
  return [0, 1, 2].map((x) => voxelStep[0] * unit[0][x] + voxelStep[1] * unit[1][x] + voxelStep[2] * unit[2][x]);
}

const a10 = (10 * Math.PI) / 180;
describe.each([
  ["an axis-aligned volume", [[1, 0, 0], [0, 1, 0], [0, 0, 2]]],
  ["a volume 10 degrees oblique about S", [[Math.cos(a10), Math.sin(a10), 0], [-Math.sin(a10), Math.cos(a10), 0], [0, 0, 2]]],
])("orientation letters on %s", (_name, directions) => {
  it.each(["z", "y", "x"] as const)("name the patient directions actually on screen in the %s view", async (axis) => {
    const volume = await load(directions);
    const geometry: VolumeGeometry = volume.orientation.geometry;
    const { right, down } = screenSteps(volume, axis);
    const toRight = patientDirection(geometry, right);
    const toBottom = patientDirection(geometry, down);

    expect(viewLabels(axis, geometry)).toEqual({
      right: LETTERS(toRight),
      left: LETTERS(toRight.map((c) => -c)),
      bottom: LETTERS(toBottom),
      top: LETTERS(toBottom.map((c) => -c)),
    });
  });
});

describe("the radiological convention, read off the screen", () => {
  it("puts patient Left on screen-right and Anterior at the top in the axial view", async () => {
    const volume = await load([[1, 0, 0], [0, 1, 0], [0, 0, 2]]);
    const { right, down } = screenSteps(volume, "z");
    expect(LETTERS(patientDirection(volume.orientation.geometry, right))).toBe("L");
    expect(LETTERS(patientDirection(volume.orientation.geometry, down))).toBe("P");
  });

  it("puts patient Left on screen-right and Superior at the top in the coronal view", async () => {
    const volume = await load([[1, 0, 0], [0, 1, 0], [0, 0, 2]]);
    const { right, down } = screenSteps(volume, "y");
    expect(LETTERS(patientDirection(volume.orientation.geometry, right))).toBe("L");
    expect(LETTERS(patientDirection(volume.orientation.geometry, down))).toBe("I");
  });

  // The sagittal marker: the same volume stored LPS, RAS and as a sagittal acquisition. The
  // loader canonicalises each, so the screen must come out the same way round for all three.
  // Each voxel holds its index in the FILE, so a screen step is read in the file's own axes
  // and turned into a patient direction with the file's own directions.
  it.each([
    ["LPS", [[1, 0, 0], [0, 1, 0], [0, 0, 2]]],
    ["RAS", [[-1, 0, 0], [0, -1, 0], [0, 0, 2]]],
    ["a sagittal acquisition", [[0, 1, 0], [0, 0, -2], [1, 0, 0]]],
  ])("puts Anterior on screen-left and Superior at the top in the sagittal view, stored %s", async (_name, directions) => {
    const volume = await load(directions);
    const { right, down } = screenSteps(volume, "x");
    const file = { directions } as unknown as VolumeGeometry;
    expect(LETTERS(patientDirection(file, right))).toBe("P");
    expect(LETTERS(patientDirection(file, down))).toBe("I");
  });
});
