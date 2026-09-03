import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `copperNrrdLoader` stages a known min/max in a module-scoped variable, patches
 * `Volume.prototype.computeMinMax` to consume it, and clears it right after the
 * synchronous `NRRDLoader.parse()` call that is the only thing that ever reads it (see
 * `installMinMaxOverride`'s doc comment in `copperNrrdLoader.ts`). This drives the REAL
 * `NRRDLoader` and `Volume` (nothing mocked but `fetch`), because the whole risk of this
 * change is a wrong window making anatomy look different while looking perfectly plausible
 * -- a mock of `parse` would not exercise the actual `computeMinMax` call it makes.
 */

// dat.gui builds DOM at construction; this test never opens a GUI.
vi.mock("dat.gui", () => ({ GUI: class {} }));

/** Every `ImageData` a stubbed canvas's `putImageData` received, in call order -- the actual
 *  rendered pixels `VolumeSlice.repaint()` produced, for the pixel-identity test below. */
let capturedFrames: ImageData[] = [];

beforeAll(() => {
  // jsdom has no real 2D canvas backend; stub just enough for VolumeSlice.repaint(),
  // which extractSlice() runs synchronously as part of building each slice. `putImageData`
  // additionally records what it was given -- the rendered frame -- so a test can compare
  // pixels byte for byte instead of only the volume's windowLow/windowHigh.
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

type Loader = typeof import("../Loader/copperNrrdLoader");

function loadingBar() {
  const loadingContainer = document.createElement("div");
  const progress = document.createElement("div");
  loadingContainer.appendChild(progress);
  return { loadingContainer, progress } as any;
}

/** A real, minimal, valid raw-encoded NRRD document: an 8-voxel uint8 cube. */
function buildNrrd(values: number[]): ArrayBuffer {
  const header =
    "NRRD0004\n" +
    "type: uint8\n" +
    "dimension: 3\n" +
    "sizes: 2 2 2\n" +
    "encoding: raw\n" +
    "endian: little\n" +
    "\n";
  const headerBytes = new TextEncoder().encode(header);
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
    body: null, // no reader -- fetchNrrdArrayBuffer falls back to response.arrayBuffer()
    arrayBuffer: async () => buffer,
  };
}

/** Runs `copperNrrdLoader` against a fetch mock returning `buffer`, and resolves with the
 *  parsed volume once the success callback fires. */
function load(loader: Loader["copperNrrdLoader"], buffer: ArrayBuffer, opts: any): Promise<any> {
  return new Promise((resolve, reject) => {
    loader("v.nrrd", loadingBar(), false, (volume) => resolve(volume), {
      ...opts,
      onError: reject,
    });
  });
}

let copperNrrdLoader: Loader["copperNrrdLoader"];

async function freshLoader() {
  vi.resetModules();
  const loaderModule = await import("../Loader/copperNrrdLoader");
  // jsdom has no real Worker; drive the same worker-core logic in-process instead --
  // see fakeNrrdWorker.ts's doc comment.
  const { createInProcessNrrdWorker } = await import("./helpers/fakeNrrdWorker");
  loaderModule.__setNrrdWorkerFactoryForTests(createInProcessNrrdWorker);
  return loaderModule.copperNrrdLoader;
}

beforeEach(async () => {
  capturedFrames = [];
  copperNrrdLoader = await freshLoader();
});

describe("known min/max override", () => {
  it("fallback: with no knownMinMax, the real per-voxel scan runs and produces the true range", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse(buildNrrd([10, 250, 5, 100, 0, 255, 77, 200]))));

    const volume = await load(copperNrrdLoader, buildNrrd([10, 250, 5, 100, 0, 255, 77, 200]), {
      openGui: false,
    });

    expect(volume.min).toBe(0);
    expect(volume.max).toBe(255);
    expect(volume.windowLow).toBe(0);
    expect(volume.windowHigh).toBe(255);
  });

  it("override: a supplied knownMinMax wins over the real data range", async () => {
    const data = [10, 250, 5, 100, 0, 255, 77, 200]; // true range is [0, 255]
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse(buildNrrd(data))));

    const volume = await load(copperNrrdLoader, buildNrrd(data), {
      openGui: false,
      knownMinMax: [7, 42], // deliberately NOT the real range, so a match proves interception
    });

    expect(volume.min).toBe(7);
    expect(volume.max).toBe(42);
    expect(volume.windowLow).toBe(7);
    expect(volume.windowHigh).toBe(42);
  });

  it("never leaks into a load that supplies no knownMinMax of its own", async () => {
    const overridden = [1, 2, 3, 4, 5, 6, 7, 8];
    const plain = [20, 40, 60, 80, 100, 120, 140, 160]; // true range [20, 160]

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    fetchMock.mockResolvedValueOnce(okResponse(buildNrrd(overridden)));
    const first = await load(copperNrrdLoader, buildNrrd(overridden), {
      openGui: false,
      knownMinMax: [999, 1000],
    });
    expect([first.min, first.max]).toEqual([999, 1000]);

    fetchMock.mockResolvedValueOnce(okResponse(buildNrrd(plain)));
    const second = await load(copperNrrdLoader, buildNrrd(plain), { openGui: false });
    expect([second.min, second.max]).toEqual([20, 160]);
  });

  it("two overlapping loads each keep their own override (no shared-state race)", async () => {
    const dataA = [1, 2, 3, 4, 5, 6, 7, 8];
    const dataB = [9, 10, 11, 12, 13, 14, 15, 16];

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(okResponse(url === "a.nrrd" ? buildNrrd(dataA) : buildNrrd(dataB)))
    );

    const [a, b] = await Promise.all([
      new Promise((resolve) => copperNrrdLoader("a.nrrd", loadingBar(), false, resolve as any, { openGui: false, knownMinMax: [111, 222] })),
      new Promise((resolve) => copperNrrdLoader("b.nrrd", loadingBar(), false, resolve as any, { openGui: false, knownMinMax: [333, 444] })),
    ]);

    expect([(a as any).min, (a as any).max]).toEqual([111, 222]);
    expect([(b as any).min, (b as any).max]).toEqual([333, 444]);
  });

  it("pixel identity: a correct knownMinMax renders exactly the same frame as the real scan", async () => {
    // The actual risk of this whole change: a wrong window makes anatomy look different
    // while looking perfectly plausible. Render the same data twice -- once letting three
    // scan it, once supplying the (correct) answer up front -- and compare the produced
    // pixels byte for byte, not just windowLow/windowHigh.
    const data = [10, 250, 5, 100, 0, 255, 77, 200]; // true range [0, 255]
    const opts = { openGui: false, axes: ["z"] as const };

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse(buildNrrd(data))));
    await load(copperNrrdLoader, buildNrrd(data), opts);
    expect(capturedFrames).toHaveLength(1);
    const withoutOverride = capturedFrames[0]!.data.slice();

    capturedFrames = [];
    copperNrrdLoader = await freshLoader();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(okResponse(buildNrrd(data))));
    await load(copperNrrdLoader, buildNrrd(data), { ...opts, knownMinMax: [0, 255] });
    expect(capturedFrames).toHaveLength(1);
    const withOverride = capturedFrames[0]!.data;

    expect(withOverride).toEqual(withoutOverride);
  });
});

describe("cancellation", () => {
  it("an aborted signal stops the read loop -- no chunk after abort is ever appended", async () => {
    const chunks = [new Uint8Array(10), new Uint8Array(10), new Uint8Array(10)];
    const controller = new AbortController();
    let readCount = 0;
    const appended: number[] = [];

    const response = {
      ok: true,
      status: 200,
      statusText: "OK",
      headers: { get: () => "30" },
      body: {
        getReader: () => ({
          read: async () => {
            if (controller.signal.aborted) {
              const err = new DOMException("aborted", "AbortError");
              throw err;
            }
            const value = chunks[readCount];
            readCount++;
            if (!value) return { done: true, value: undefined };
            appended.push(value.byteLength);
            // Abort right after the first chunk is delivered, mid-stream -- the real
            // scenario this exists for (a superseded case load).
            if (readCount === 1) controller.abort();
            return { done: false, value };
          },
        }),
      },
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    const onError = vi.fn();
    copperNrrdLoader("v.nrrd", loadingBar(), false, undefined, {
      openGui: false,
      signal: controller.signal,
      onError,
    });

    await vi.waitFor(() => expect(onError).toHaveBeenCalled());

    // Only the one chunk delivered before the abort ever reached the buffer -- the loop
    // stopped pulling, it did not keep accumulating bytes after the signal fired.
    expect(appended).toEqual([10]);
    expect(onError.mock.calls[0]![0]).toMatchObject({ name: "AbortError" });
  });
});
