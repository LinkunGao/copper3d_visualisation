import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("dat.gui", () => ({ GUI: class {} }));
// paintContours only needs to be called; the paths it fills are opaque here. What is checked
// is the transform it fills them under.
vi.mock("../Utils/segmentation/core/MarchingSquares", () => ({
  findLabelsInSlice: vi.fn(() => [1]),
  extractLabelContours: vi.fn(() => ({})),
  extractLabelOutline: vi.fn(() => ({})),
}));

import { SliceRenderPipeline, displaySizeOf } from "../Utils/segmentation/tools/SliceRenderPipeline";
import { DrawingTool } from "../Utils/segmentation/tools/DrawingTool";
import { SphereBrushTool } from "../Utils/segmentation/tools/SphereBrushTool";
import { SphereTool } from "../Utils/segmentation/tools/SphereTool";
import { AiAssistTool } from "../Utils/segmentation/tools/AiAssistTool";
import { CrosshairTool } from "../Utils/segmentation/tools/CrosshairTool";
import { ImageStoreHelper } from "../Utils/segmentation/tools/ImageStoreHelper";
import { MaskVolume } from "../Utils/segmentation/core/MaskVolume";
import { MASK_CHANNEL_COLORS } from "../Utils/segmentation/core/types";
import { contourEntry, paintContours } from "../Utils/segmentation/contourPaint";

/**
 * Painting on the sagittal view writes the voxel the clinician is looking at.
 *
 * "Looking at" is taken from the image itself: the real loader lays the volume out, three's own
 * slice addressing says which voxel each pixel of its sagittal canvas holds, and the real
 * `flipDisplayImageByAxis` puts that canvas on screen. Every tool that turns a pointer into a
 * voxel is held to it, as are the mask overlay drawn back over the image, the pencil/eraser
 * bake, and the slice layout sent to the backend.
 */

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
/** Distinct sizes and spacings, so a swapped axis cannot pass by coincidence. */
const DIMS: Vec3 = [5, 7, 6];
const SPACING: Vec3 = [1, 2, 3];
const SLICE = 3;
const SIZE_FACTOR = 2;
const encode = (i: number, j: number, k: number) => i + DIMS[0] * j + DIMS[0] * DIMS[1] * k;
const decode = (v: number): Vec3 => [v % DIMS[0], Math.floor(v / DIMS[0]) % DIMS[1], Math.floor(v / (DIMS[0] * DIMS[1]))];

function buildNrrd(): ArrayBuffer {
  const header =
    "NRRD0004\ntype: uint8\ndimension: 3\nspace: left-posterior-superior\n" +
    `sizes: ${DIMS.join(" ")}\nspace directions: (${SPACING[0]},0,0) (0,${SPACING[1]},0) (0,0,${SPACING[2]})\n` +
    "kinds: domain domain domain\nencoding: raw\nendian: little\nspace origin: (0,0,0)\n\n";
  const head = new TextEncoder().encode(header);
  const out = new Uint8Array(head.length + DIMS[0] * DIMS[1] * DIMS[2]);
  out.set(head, 0);
  let n = head.length;
  for (let k = 0; k < DIMS[2]; k++) for (let j = 0; j < DIMS[1]; j++) for (let i = 0; i < DIMS[0]; i++) out[n++] = encode(i, j, k);
  return out.buffer;
}

async function load(): Promise<any> {
  vi.resetModules();
  const loaderModule = await import("../Loader/copperNrrdLoader");
  const { createInProcessNrrdWorker } = await import("./helpers/fakeNrrdWorker");
  loaderModule.__setNrrdWorkerFactoryForTests(createInProcessNrrdWorker);
  const buffer = buildNrrd();
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

// --- a 2D canvas transform, composed the way a canvas composes it ---------------------------

type Mat = [number, number, number, number, number, number]; // a b c d e f
const IDENTITY: Mat = [1, 0, 0, 1, 0, 0];
const mul = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const apply = (m: Mat, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const invert = (m: Mat): Mat => {
  const det = m[0] * m[3] - m[1] * m[2];
  return [m[3] / det, -m[1] / det, -m[2] / det, m[0] / det, (m[2] * m[5] - m[3] * m[4]) / det, (m[1] * m[4] - m[0] * m[5]) / det];
};

/** A context that keeps the current transform, and the transform each fill happened under. */
function recordingContext() {
  let m: Mat = IDENTITY;
  const stack: Mat[] = [];
  const fills: Mat[] = [];
  const ctx: any = {
    fills,
    get matrix() { return m; },
    save: () => { stack.push(m); },
    restore: () => { m = stack.pop() ?? IDENTITY; },
    scale: (x: number, y: number) => { m = mul(m, [x, 0, 0, y, 0, 0]); },
    translate: (x: number, y: number) => { m = mul(m, [1, 0, 0, 1, x, y]); },
    transform: (a: number, b: number, c: number, d: number, e: number, f: number) => { m = mul(m, [a, b, c, d, e, f]); },
    rotate: (t: number) => { const c = Math.cos(t), s = Math.sin(t); m = mul(m, [c, s, -s, c, 0, 0]); },
    fill: () => { fills.push(m); },
  };
  return ctx;
}

// --- the scene: one loaded volume on its sagittal view --------------------------------------

interface Scene {
  W: number;
  H: number;
  state: any;
  /** The canonical voxel the image shows at a display point. */
  imageVoxelAt: (x: number, y: number) => Vec3;
}

async function sagittalScene(): Promise<Scene> {
  const volume = await load();
  const plane = volume.extractPerpendicularPlane("x", SLICE * volume.spacing[0]);
  const shown = displaySizeOf("x", { width: Math.floor(plane.planeWidth), height: Math.floor(plane.planeHeight) });
  const W = shown.width * SIZE_FACTOR;
  const H = shown.height * SIZE_FACTOR;

  const display = recordingContext();
  const pipeline: any = Object.create(SliceRenderPipeline.prototype);
  pipeline.ctx = {
    protectedData: { axis: "x", ctxes: { displayCtx: display } },
    nrrd_states: { view: { changedWidth: W, changedHeight: H } },
  };
  pipeline.flipDisplayImageByAxis();
  // The callers then draw three's canvas into (0, 0, W, H) under this transform.
  const toDest = invert(display.matrix);

  const imageVoxelAt = (x: number, y: number): Vec3 => {
    const [dx, dy] = apply(toDest, x, y);
    const column = Math.floor((dx / W) * plane.iLength);
    const row = Math.floor((dy / H) * plane.jLength);
    return decode(plane.sliceAccess(column, row));
  };

  const mm = DIMS.map((n, a) => Math.floor(n * SPACING[a]));
  const state = {
    protectedData: { axis: "x" },
    nrrd_states: {
      view: { changedWidth: W, changedHeight: H, currentSliceIndex: SLICE, sizeFactor: SIZE_FACTOR },
      image: {
        nrrd_x_pixel: DIMS[0], nrrd_y_pixel: DIMS[1], nrrd_z_pixel: DIMS[2],
        nrrd_x_mm: mm[0], nrrd_y_mm: mm[1], nrrd_z_mm: mm[2],
        dimensions: [...DIMS],
        ratios: { x: SPACING[0], y: SPACING[1], z: SPACING[2] },
      },
    },
  };
  return { W, H, state, imageVoxelAt };
}

/** The centre of every display pixel. Voxel edges fall on whole pixels, so none is ambiguous. */
function* displayPixels(scene: Scene) {
  for (let y = 0; y < scene.H; y++) for (let x = 0; x < scene.W; x++) yield [x + 0.5, y + 0.5] as const;
}

function tool<T>(proto: T, state: any, extra: Record<string, unknown> = {}): any {
  const t: any = Object.create((proto as any).prototype);
  t.ctx = state;
  Object.assign(t, extra);
  return t;
}

describe("the sagittal view", () => {
  it("is the image's anteroposterior extent wide and its craniocaudal extent tall", async () => {
    const { W, H } = await sagittalScene();
    expect([W, H]).toEqual([DIMS[1] * SPACING[1] * SIZE_FACTOR, DIMS[2] * SPACING[2] * SIZE_FACTOR]);
  });

  it("shows anterior on screen-left and superior at the top", async () => {
    const scene = await sagittalScene();
    const [, jLeft, kTop] = scene.imageVoxelAt(0.5, 0.5);
    const [, jRight, kBottom] = scene.imageVoxelAt(scene.W - 0.5, scene.H - 0.5);
    expect([jLeft, jRight]).toEqual([0, DIMS[1] - 1]); // j increases toward Posterior
    expect([kTop, kBottom]).toEqual([DIMS[2] - 1, 0]); // k increases toward Superior
  });
});

describe("a pointer on the sagittal view addresses the voxel under it", () => {
  it("brush", async () => {
    const scene = await sagittalScene();
    const brush = tool(DrawingTool, scene.state);
    for (const [x, y] of displayPixels(scene)) {
      const v = brush.canvasToVoxel3D(x, y);
      expect([v.x, Math.floor(v.y), Math.floor(v.z)]).toEqual(scene.imageVoxelAt(x, y));
    }
  });

  it("sphere brush", async () => {
    const scene = await sagittalScene();
    const brush = tool(SphereBrushTool, scene.state);
    for (const [x, y] of displayPixels(scene)) {
      const v = brush.canvasToVoxelCenter(x, y, SLICE, "x");
      expect([v.x, Math.floor(v.y), Math.floor(v.z)]).toEqual(scene.imageVoxelAt(x, y));
    }
  });

  it("calculator sphere, which works in millimetres", async () => {
    const scene = await sagittalScene();
    const sphere = tool(SphereTool, scene.state);
    for (const [x, y] of displayPixels(scene)) {
      const v = sphere.canvasToVoxelCenter(x / SIZE_FACTOR, y / SIZE_FACTOR, SLICE, "x");
      expect([v.x, Math.floor(v.y), Math.floor(v.z)]).toEqual(scene.imageVoxelAt(x, y));
    }
  });

  it("AI Assist prompts, within its own half-voxel rounding", async () => {
    const scene = await sagittalScene();
    const ai = tool(AiAssistTool, scene.state, { scratchVol: new MaskVolume(DIMS[0], DIMS[1], DIMS[2], 1) });
    for (const [x, y] of displayPixels(scene)) {
      const hit = ai.toVoxel({ offsetX: x, offsetY: y });
      if (!hit) {
        // toVoxel rounds, so the outer half of the last column and row round off the slice.
        expect(x > scene.W - scene.W / DIMS[1] / 2 || y > scene.H - scene.H / DIMS[2] / 2).toBe(true);
        continue;
      }
      // The prompt is a cell of the slice the backend receives; find its voxel through the
      // real slice layout rather than restating it here.
      const cell = new Uint8Array(hit.w * hit.h);
      cell[hit.vy * hit.w + hit.vx] = 1;
      const vol = new MaskVolume(DIMS[0], DIMS[1], DIMS[2], 1);
      vol.setSliceUint8(SLICE, cell, "x");
      const [i, j, k] = scene.imageVoxelAt(x, y);
      const near = (a: number, b: number) => Math.abs(a - b) <= 1;
      const at = [...Array(DIMS[1] * DIMS[2]).keys()]
        .map((n): Vec3 => [SLICE, n % DIMS[1], Math.floor(n / DIMS[1])])
        .find(([vi, vj, vk]) => vol.getVoxel(vi, vj, vk) === 1)!;
      expect(at[0]).toBe(i);
      expect(near(at[1], j) && near(at[2], k)).toBe(true);
      // And the marker drawn for the prompt sits on it.
      const back = ai.voxelToScreen(hit.vx, hit.vy);
      expect(Math.abs(back.x - x)).toBeLessThanOrEqual(scene.W / DIMS[1]);
      expect(Math.abs(back.y - y)).toBeLessThanOrEqual(scene.H / DIMS[2]);
    }
  });
});

describe("what is painted on the sagittal view", () => {
  it("is drawn back over the voxel it was painted on", async () => {
    const scene = await sagittalScene();
    for (const [j, k] of [[0, 0], [1, 5], [6, 2], [3, 3], [6, 5]] as const) {
      const vol = new MaskVolume(DIMS[0], DIMS[1], DIMS[2], 1);
      vol.setVoxel(SLICE, j, k, 1);
      const entry = contourEntry(new Map(), "l", `${j}:${k}`, () => ({ ...vol.getSliceUint8(SLICE, "x"), stride: 1 }), false);
      const target = recordingContext();
      paintContours(entry, target, "x", scene.W, scene.H, false, () => ({ r: 1, g: 2, b: 3, a: 255 }));
      expect(target.fills).toHaveLength(1);

      const slice = vol.getSliceUint8(SLICE, "x");
      const n = slice.data.indexOf(1);
      const [u, v] = [n % slice.width, Math.floor(n / slice.width)];
      const [x, y] = apply(target.fills[0], u + 0.5, v + 0.5); // the cell's centre, on screen
      expect(scene.imageVoxelAt(x, y)).toEqual([SLICE, j, k]);
    }
  });

  it("is baked by pencil and eraser into the voxel under the stroke, and sent in the backend's layout", async () => {
    const scene = await sagittalScene();
    const empty = { width: 0, height: 0 };
    const pipeline: any = Object.create(SliceRenderPipeline.prototype);
    pipeline.ctx = { protectedData: { axis: "x", canvases: { emptyCanvas: empty } }, nrrd_states: scene.state.nrrd_states };
    pipeline.setEmptyCanvasSize();
    // The bake canvas is the layer canvas shrunk to one pixel per voxel.
    expect([empty.width, empty.height]).toEqual([DIMS[1], DIMS[2]]);

    const colour = MASK_CHANNEL_COLORS[1];
    for (const [c, r] of [[0, 0], [6, 5], [2, 4], [5, 1]] as const) {
      const pixels = new ImageData(empty.width, empty.height);
      pixels.data.set([colour.r, colour.g, colour.b, 255], (r * empty.width + c) * 4);
      const vol = new MaskVolume(DIMS[0], DIMS[1], DIMS[2], 1);
      const sent: any[] = [];
      const state = {
        ...scene.state,
        protectedData: {
          ...scene.state.protectedData,
          canvases: { emptyCanvas: empty },
          ctxes: { emptyCtx: { getImageData: () => pixels } },
          layerTargets: new Map([["layer1", { canvas: {} }]]),
          maskData: { volumes: { layer1: vol } },
        },
        nrrd_states: { ...scene.state.nrrd_states, flags: { loadingMaskData: false, clearAllFlag: false } },
        gui_states: { mode: { sphere: false }, layerChannel: { activeChannel: 1, channelVisibility: {} } },
        callbacks: { onMaskChanged: (...args: any[]) => sent.push(args) },
      };
      const bake = tool(ImageStoreHelper, state, { callbacks: { setEmptyCanvasSize: () => {}, drawImageOnEmptyImage: () => {} } });
      bake.syncLayerSliceData(SLICE, "layer1");

      // The bake pixel covers this part of the display; its centre is under the stroke.
      const x = ((c + 0.5) * scene.W) / empty.width;
      const y = ((r + 0.5) * scene.H) / empty.height;
      const [i, j, k] = scene.imageVoxelAt(x, y);
      expect(vol.getVoxel(i, j, k)).toBe(1);
      expect(vol.getRawData().reduce((s, b) => s + b, 0)).toBe(1);

      // The backend receives (rows, columns) = (k, j) for a sagittal slice.
      expect(sent).toHaveLength(1);
      const [data, , , index, axis, width, height] = sent[0];
      expect([index, axis, width, height]).toEqual([SLICE, "x", DIMS[1], DIMS[2]]);
      expect(data[k * DIMS[1] + j]).toBe(1);
    }
  });
});

describe("the crosshair carries the same anatomy between sagittal and the other views", () => {
  const within = (a: number, b: number) => a === b; // exact: `convertCursorPoint` works in voxel centres

  it("from sagittal", async () => {
    const scene = await sagittalScene();
    const crosshair = tool(CrosshairTool, scene.state);
    const { nrrd_x_mm, nrrd_y_mm, nrrd_z_mm } = scene.state.nrrd_states.image;
    for (const [x, y] of [[3, 3], [25, 4], [9, 33], [27, 35]]) {
      const [i, j, k] = scene.imageVoxelAt(x, y);
      const [cx, cy] = [x / SIZE_FACTOR, y / SIZE_FACTOR];

      const axial = crosshair.convertCursorPoint("x", "z", cx, cy, SLICE);
      expect(within(axial.currentNewSliceIndex, k)).toBe(true);
      expect(within(Math.floor((axial.convertCursorNumX / nrrd_x_mm) * DIMS[0]), i)).toBe(true);
      expect(within(Math.floor((axial.convertCursorNumY / nrrd_y_mm) * DIMS[1]), j)).toBe(true);

      const coronal = crosshair.convertCursorPoint("x", "y", cx, cy, SLICE);
      expect(within(coronal.currentNewSliceIndex, j)).toBe(true);
      expect(within(Math.floor((coronal.convertCursorNumX / nrrd_x_mm) * DIMS[0]), i)).toBe(true);
      expect(within(Math.floor((1 - coronal.convertCursorNumY / nrrd_z_mm) * DIMS[2]), k)).toBe(true);
    }
  });

  it("to sagittal", async () => {
    const scene = await sagittalScene();
    const crosshair = tool(CrosshairTool, scene.state);
    const { nrrd_x_mm, nrrd_y_mm, nrrd_z_mm } = scene.state.nrrd_states.image;
    for (const [i, j, k] of [[1, 1, 1], [3, 5, 4], [4, 0, 5], [2, 6, 0]]) {
      // A cursor on the centre of voxel (i, j, k) in the axial and the coronal view.
      const fromAxial = crosshair.convertCursorPoint("z", "x", ((i + 0.5) / DIMS[0]) * nrrd_x_mm, ((j + 0.5) / DIMS[1]) * nrrd_y_mm, k);
      const fromCoronal = crosshair.convertCursorPoint("y", "x", ((i + 0.5) / DIMS[0]) * nrrd_x_mm, (1 - (k + 0.5) / DIMS[2]) * nrrd_z_mm, j);
      for (const to of [fromAxial, fromCoronal]) {
        expect(within(to.currentNewSliceIndex, i)).toBe(true);
        // The conversion puts the cursor on the voxel's centre, never on an edge.
        const [, sj, sk] = scene.imageVoxelAt(to.convertCursorNumX * SIZE_FACTOR, to.convertCursorNumY * SIZE_FACTOR);
        expect(within(sj, j) && within(sk, k)).toBe(true);
      }
    }
  });
});
