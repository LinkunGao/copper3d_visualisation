import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * The entire risk of moving fetch/gunzip/parse into a worker: a subtle difference in how the
 * worker's payload gets rehydrated into a `Volume` on the main thread (wrong dtype, wrong
 * byte order, a transposed matrix) would change what a clinician sees while looking
 * perfectly plausible. This compares the actual rendered pixels -- not just `min`/`max` or
 * `dimensions` -- between a direct `NRRDLoader.parse()` (what ran on the main thread before
 * this change) and the full worker round trip through `copperNrrdLoader` (what runs now).
 */

// dat.gui builds DOM at construction; this test never opens a GUI.
vi.mock("dat.gui", () => ({ GUI: class {} }));

let capturedFrames: ImageData[] = [];

beforeAll(() => {
  // jsdom has no real 2D canvas backend; stub just enough for VolumeSlice.repaint(), and
  // record every frame `putImageData` receives -- the actual rendered pixels.
  (HTMLCanvasElement.prototype as any).getContext = function () {
    return {
      getImageData: (_x: number, _y: number, w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
      }),
      putImageData: (imageData: ImageData) => { capturedFrames.push(imageData); },
      drawImage: () => {},
    };
  };
});

function loadingBar() {
  const loadingContainer = document.createElement("div");
  const progress = document.createElement("div");
  loadingContainer.appendChild(progress);
  return { loadingContainer, progress } as any;
}

/** A real, valid raw-encoded NRRD document: a 4x4x4 uint8 cube (64 voxels) with a
 *  non-trivial value spread, so a byte-order or dtype mistake would visibly change pixels. */
function buildNrrd(): ArrayBuffer {
  const header =
    "NRRD0004\n" +
    "type: uint8\n" +
    "dimension: 3\n" +
    "sizes: 4 4 4\n" +
    "encoding: raw\n" +
    "endian: little\n" +
    "\n";
  const headerBytes = new TextEncoder().encode(header);
  const values = Array.from({ length: 64 }, (_, i) => (i * 37 + 11) % 256);
  const out = new Uint8Array(headerBytes.length + values.length);
  out.set(headerBytes, 0);
  out.set(values, headerBytes.length);
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

describe("pixel identity: worker round trip vs direct parse", () => {
  it("renders byte-identical pixels through copperNrrdLoader's worker path and a direct NRRDLoader.parse", async () => {
    const nrrd = buildNrrd();

    // Reference: a direct, synchronous parse -- exactly what ran on the main thread before
    // fetch/gunzip/parse moved into a worker.
    const { NRRDLoader } = await import("three/examples/jsm/loaders/NRRDLoader");
    const referenceLoader = new (NRRDLoader as any)();
    referenceLoader.setSegmentation(false);
    const referenceVolume = referenceLoader.parse(nrrd.slice(0));

    capturedFrames = [];
    const zIndex = Math.floor(referenceVolume.dimensions[2] / 2);
    // `extractSlice` already repaints once internally (VolumeSlice's constructor calls it) --
    // that alone is enough to capture a frame.
    referenceVolume.extractSlice("z", zIndex * referenceVolume.spacing[2]);
    expect(capturedFrames.length).toBeGreaterThan(0);
    const referenceFrame = capturedFrames[capturedFrames.length - 1]!.data.slice();

    // New path: fetch -> gunzip -> parse all happen inside the (in-process, for tests) NRRD
    // worker; the main thread only rehydrates the Volume and extracts/repaints the slice.
    capturedFrames = [];
    vi.resetModules();
    const loaderModule = await import("../Loader/copperNrrdLoader");
    const { createInProcessNrrdWorker } = await import("./helpers/fakeNrrdWorker");
    loaderModule.__setNrrdWorkerFactoryForTests(createInProcessNrrdWorker);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse(nrrd.slice(0))));

    const volume = await new Promise<any>((resolve, reject) => {
      loaderModule.copperNrrdLoader("v.nrrd", loadingBar(), false, (v) => resolve(v), {
        openGui: false,
        axes: ["z"],
        onError: reject,
      });
    });

    expect(capturedFrames.length).toBeGreaterThan(0);
    const workerFrame = capturedFrames[capturedFrames.length - 1]!.data;

    // Geometry/metadata parity first (easier to debug a mismatch here than in raw pixels)...
    expect(volume.dimensions).toEqual(referenceVolume.dimensions);
    expect(volume.spacing).toEqual(referenceVolume.spacing);
    expect(volume.min).toBe(referenceVolume.min);
    expect(volume.max).toBe(referenceVolume.max);
    expect(Array.from(volume.data as Uint8Array)).toEqual(Array.from(referenceVolume.data as Uint8Array));

    // ...then the actual rendered bytes, which is the real risk of this change.
    expect(workerFrame).toEqual(referenceFrame);
  });
});
