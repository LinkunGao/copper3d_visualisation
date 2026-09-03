import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Replacing three's `FileLoader` with a raw `fetch` (see `copperNrrdLoader.ts`'s doc
 * comments) loses `FileLoader`'s own in-flight request dedup for free -- it keys `loading[url]`
 * and attaches every caller's callbacks to the one request instead of starting a second.
 * Real symptom found on this app: `LeftPanelCore` (the 2D slice viewer) and `RightPanelCore`
 * (a separate 3D viewer) both call `scene.loadNrrd` for the same phase's URL around the same
 * time, so without dedup that volume downloads twice (~60 MB extra on the wire).
 *
 * `sharedFetchNrrdArrayBuffer` restores it. These tests pin the two properties that matter:
 * one network request serves every attached caller, and one caller's own cancellation cannot
 * affect another caller sharing the same transfer.
 */

// dat.gui builds DOM at construction; this test never opens a GUI.
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

/** A `fetch` response whose `arrayBuffer()` does not resolve until `release()` is called --
 *  lets a test hold two callers "in flight" together before letting the transfer complete. */
function deferredResponse(buffer: ArrayBuffer) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const response = {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { get: (name: string) => (name === "content-length" ? String(buffer.byteLength) : null) },
    body: null,
    arrayBuffer: async () => { await gate; return buffer; },
  };
  return { response, release };
}

let copperNrrdLoader: Loader["copperNrrdLoader"];

beforeEach(async () => {
  vi.resetModules();
  const loaderModule = await import("../Loader/copperNrrdLoader");
  copperNrrdLoader = loaderModule.copperNrrdLoader;
  // jsdom has no real Worker; drive the same worker-core logic in-process instead --
  // see fakeNrrdWorker.ts's doc comment.
  const { createInProcessNrrdWorker } = await import("./helpers/fakeNrrdWorker");
  loaderModule.__setNrrdWorkerFactoryForTests(createInProcessNrrdWorker);
});

describe("in-flight fetch deduplication", () => {
  it("two concurrent loads of one URL produce exactly one network request, and both callbacks fire", async () => {
    const data = [10, 20, 30, 40, 50, 60, 70, 80];
    const { response, release } = deferredResponse(buildNrrd(data));
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);

    const resultA = new Promise<any>((resolve, reject) => {
      copperNrrdLoader("v.nrrd", loadingBar(), false, resolve, {
        openGui: false, knownMinMax: [1, 2], onError: reject,
      });
    });
    const resultB = new Promise<any>((resolve, reject) => {
      copperNrrdLoader("v.nrrd", loadingBar(), false, resolve, {
        openGui: false, knownMinMax: [3, 4], onError: reject,
      });
    });

    // Let both dispatches reach `fetch()` before the transfer is allowed to complete.
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    release();

    const [volumeA, volumeB] = await Promise.all([resultA, resultB]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Each caller still parses independently and keeps its own known min/max -- dedup shares
    // only the bytes, not the parsed Volume.
    expect([volumeA.min, volumeA.max]).toEqual([1, 2]);
    expect([volumeB.min, volumeB.max]).toEqual([3, 4]);
    expect(volumeA).not.toBe(volumeB);
  });

  it("a later load of the same URL, after the first has settled, starts a fresh request", async () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200, statusText: "OK",
      headers: { get: () => null }, body: null,
      arrayBuffer: async () => buildNrrd(data),
    });
    vi.stubGlobal("fetch", fetchMock);

    await new Promise<void>((resolve, reject) => {
      copperNrrdLoader("v.nrrd", loadingBar(), false, () => resolve(), { openGui: false, onError: reject });
    });
    await new Promise<void>((resolve, reject) => {
      copperNrrdLoader("v.nrrd", loadingBar(), false, () => resolve(), { openGui: false, onError: reject });
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("cancellation with a shared fetch", () => {
  it("aborting one of two sharers leaves the other's data intact", async () => {
    const data = [11, 22, 33, 44, 55, 66, 77, 88];
    const { response, release } = deferredResponse(buildNrrd(data));
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);

    const controllerA = new AbortController();
    let errorA: unknown;
    const resultA = new Promise<any>((resolve, reject) => {
      copperNrrdLoader("v.nrrd", loadingBar(), false, resolve, {
        openGui: false, signal: controllerA.signal,
        onError: (e) => { errorA = e; reject(e); },
      });
    });
    // B supplies no signal at all -- it has no way to give up, and must not be made to.
    const resultB = new Promise<any>((resolve, reject) => {
      copperNrrdLoader("v.nrrd", loadingBar(), false, resolve, { openGui: false, onError: reject });
    });

    await Promise.resolve();
    await Promise.resolve();
    controllerA.abort();
    // A's own promise rejects immediately -- it does not wait for the shared transfer.
    await expect(resultA).rejects.toBeTruthy();
    expect((errorA as any)?.name).toBe("AbortError");

    // The underlying transfer is still alive for B (B never dropped off), so releasing it
    // now must still deliver B's data.
    release();
    const volumeB = await resultB;
    expect(volumeB.data).toBeTruthy();
    expect(Array.from(volumeB.data as Uint8Array)).toEqual(data);
  });

  it("aborting the only attached caller actually stops the underlying transfer", async () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8];
    const { response } = deferredResponse(buildNrrd(data)); // never released
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);

    const controller = new AbortController();
    const onError = vi.fn();
    copperNrrdLoader("v.nrrd", loadingBar(), false, undefined, {
      openGui: false, signal: controller.signal, onError,
    });

    await Promise.resolve();
    await Promise.resolve();
    // The signal actually handed to `fetch()` -- the internal shared controller's, not the
    // caller's own -- must be the one that ends up aborted. If it never gets aborted, the
    // real transfer would keep running (and billing bandwidth) forever after every caller
    // has given up on it.
    const internalSignal = fetchMock.mock.calls[0]![1].signal as AbortSignal;
    expect(internalSignal.aborted).toBe(false);

    controller.abort();
    await vi.waitFor(() => expect(onError).toHaveBeenCalled());
    expect(internalSignal.aborted).toBe(true);
  });
});
