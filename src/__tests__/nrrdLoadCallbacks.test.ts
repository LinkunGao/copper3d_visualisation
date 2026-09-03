import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * That `onProgress` and `onError` actually reach the caller, in the right shape, and that
 * `opts.axes` still narrows which slices get extracted -- now that fetch, gunzip and
 * `NRRDLoader.parse()` all run inside a worker (`nrrdWorkerCore.ts`) instead of on the main
 * thread (see `copperNrrdLoader.ts`'s `loadViaWorker`).
 *
 * Drives the REAL `NRRDLoader`/`Volume` through the in-process fake worker
 * (`__tests__/helpers/fakeNrrdWorker.ts`), not a stubbed `parse()` return value -- the worker
 * now serializes the parsed `Volume` into a plain payload and the main thread rehydrates a
 * real `Volume` from it (see `nrrdWorkerCore.ts`'s `buildPayload` / `copperNrrdLoader.ts`'s
 * `rehydrateVolume`), so a bare mock object standing in for a `Volume` would not survive that
 * round trip. `Volume.prototype.extractSlice` is spied on (not replaced) to inspect calls
 * while still exercising the real extraction/repaint path.
 */

// dat.gui builds DOM at construction and this test never opens a GUI.
vi.mock("dat.gui", () => ({ GUI: class {} }));

beforeAll(() => {
  // jsdom has no real 2D canvas backend; stub just enough for VolumeSlice.repaint().
  (HTMLCanvasElement.prototype as any).getContext = function () {
    return {
      getImageData: (_x: number, _y: number, w: number, h: number) => ({
        data: new Uint8ClampedArray(w * h * 4),
      }),
      putImageData: () => {},
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

/** A real, minimal, valid raw-encoded NRRD document: a 4x4x4 uint8 cube (64 voxels). */
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
  const values = Array.from({ length: 64 }, (_, i) => i);
  const out = new Uint8Array(headerBytes.length + values.length);
  out.set(headerBytes, 0);
  out.set(values, headerBytes.length);
  return out.buffer;
}

/** A `fetch` response whose body streams `chunks` one at a time, with a `content-length`
 *  header set from their combined size -- enough for the worker's progress loop. */
function streamedResponse(chunks: Uint8Array[]) {
  const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
  let i = 0;
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { get: (name: string) => (name === "content-length" ? String(total) : null) },
    body: {
      getReader: () => ({
        read: async () => {
          if (i < chunks.length) return { done: false, value: chunks[i++] };
          return { done: true, value: undefined };
        },
      }),
    },
  };
}

let copperNrrdLoader: Loader["copperNrrdLoader"];
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  vi.resetModules();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  ({ copperNrrdLoader } = await import("../Loader/copperNrrdLoader"));
  const { __setNrrdWorkerFactoryForTests } = await import("../Loader/copperNrrdLoader");
  const { createInProcessNrrdWorker } = await import("./helpers/fakeNrrdWorker");
  __setNrrdWorkerFactoryForTests(createInProcessNrrdWorker);
});

describe("onError", () => {
  it("fires when the fetch itself rejects (network failure, or an aborted transfer)", async () => {
    const onError = vi.fn();
    fetchMock.mockRejectedValue(new Error("network down"));

    copperNrrdLoader("v.nrrd", loadingBar(), false, undefined, {
      openGui: false,
      onError,
    });
    await vi.waitFor(() => expect(onError).toHaveBeenCalled());

    expect(onError.mock.calls[0]![0]).toBeInstanceOf(Error);
  });

  it("fires when the response is not ok, and takes the loading bar down with it", async () => {
    const bar = loadingBar();
    bar.loadingContainer.style.display = "flex";
    fetchMock.mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" });

    copperNrrdLoader("v.nrrd", bar, false, undefined, { openGui: false });
    await vi.waitFor(() => expect(bar.loadingContainer.style.display).toBe("none"));
  });

  it("does not require the caller to supply one", async () => {
    fetchMock.mockRejectedValue(new Error("404"));
    expect(() =>
      copperNrrdLoader("v.nrrd", loadingBar(), false, undefined, { openGui: false })
    ).not.toThrow();
  });
});

/**
 * `extractSlice` walks the whole volume per call and the result stays on
 * `volume.sliceList` for the volume's lifetime, so an axis nobody displays is
 * a full pass over the buffer plus a geometry, material and canvas texture
 * that nothing frees.
 */
describe("opts.axes", () => {
  /** Runs the loader end to end against a real 4x4x4 NRRD cube and returns what it built,
   *  plus a spy on the real `Volume.prototype.extractSlice` calls this load made. */
  async function loadWith(axes?: readonly ("x" | "y" | "z")[]) {
    const { Volume } = await import("three/examples/jsm/misc/Volume.js");
    const extractSliceSpy = vi.spyOn(Volume.prototype as any, "extractSlice");
    fetchMock.mockResolvedValue(streamedResponse([new Uint8Array(buildNrrd())]));

    let received: any;
    copperNrrdLoader(
      "v.nrrd",
      loadingBar(),
      false,
      (volume, meshes, slices) => { received = { volume, meshes, slices }; },
      { openGui: false, ...(axes ? { axes } : {}) }
    );
    await vi.waitFor(() => expect(received).toBeDefined());
    // Copy the calls out before restoring -- `mockRestore()` also clears `.mock.calls`.
    const extractSliceCalls = extractSliceSpy.mock.calls.slice();
    extractSliceSpy.mockRestore();
    return { ...received, extractSliceCalls };
  }

  it("extracts all three axes by default, exactly as before", async () => {
    const { extractSliceCalls, slices } = await loadWith();

    expect(extractSliceCalls.map((c: any) => c[0]).sort()).toEqual(["x", "y", "z"]);
    expect([slices.x, slices.y, slices.z].every(Boolean)).toBe(true);
  });

  it("extracts only what was asked for", async () => {
    const { extractSliceCalls } = await loadWith(["z"]);

    expect(extractSliceCalls).toHaveLength(1);
    expect(extractSliceCalls[0]![0]).toBe("z");
  });

  it("leaves the omitted axes undefined on both callback objects", async () => {
    const { meshes, slices } = await loadWith(["z"]);

    expect(slices.z).toBeDefined();
    expect(meshes.z).toBeDefined();
    expect([slices.x, slices.y, meshes.x, meshes.y])
      .toEqual([undefined, undefined, undefined, undefined]);
  });

  it("still annotates the axes it did extract", async () => {
    const { slices } = await loadWith(["z"]);

    expect(slices.z.initIndex).toBe(2);
    expect(slices.z.MaxIndex).toBe(3);
    expect(slices.z.RSARatio).toBe(1);
    expect(slices.z.RSAMaxIndex).toBe(3);
  });

  it("extracts nothing for an empty list, without throwing", async () => {
    const { extractSliceCalls, slices } = await loadWith([]);

    expect(extractSliceCalls).toHaveLength(0);
    expect([slices.x, slices.y, slices.z])
      .toEqual([undefined, undefined, undefined]);
  });
});

describe("onProgress", () => {
  it("fires in addition to the built-in loading bar, not instead of it", async () => {
    const bar = loadingBar();
    const onProgress = vi.fn();
    // Two chunks of 50 bytes each, against a 100-byte total -- one 50% event, one 100%.
    fetchMock.mockResolvedValue(
      streamedResponse([new Uint8Array(50), new Uint8Array(50)])
    );

    copperNrrdLoader("volume.nrrd", bar, false, undefined, {
      openGui: false,
      onProgress,
    });
    await vi.waitFor(() => expect(onProgress).toHaveBeenCalled());

    const events = onProgress.mock.calls.map((c) => c[0] as ProgressEvent);
    expect(events.map((e) => e.loaded)).toEqual([50, 100]);
    expect(events.every((e) => e.total === 100)).toBe(true);
    // The bar's own text is unchanged behaviour and callers still read it.
    expect(bar.progress.innerText).toBe("File: volume.nrrd 100 % loaded");
  });

  it("works with no opts at all", async () => {
    const bar = loadingBar();
    fetchMock.mockResolvedValue(streamedResponse([new Uint8Array(buildNrrd())]));

    expect(() => copperNrrdLoader("volume.nrrd", bar, false)).not.toThrow();
    await vi.waitFor(() => expect(bar.loadingContainer.style.display).toBe("none"));
  });
});
