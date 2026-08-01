import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * That `onProgress` and `onError` actually reach `NRRDLoader.load`, in the
 * right argument slots.
 *
 * Worth pinning precisely because the failure is silent: before 3.9.0 there
 * was no fourth argument at all, so a failed volume invoked nothing and was
 * indistinguishable from a slow one -- and the sibling `loadGltf` had an empty
 * function named `error` sitting in the *onProgress* slot, which looks correct
 * at a glance and never fires on an error.
 */

const load = vi.fn();

vi.mock("three/examples/jsm/loaders/NRRDLoader", () => ({
  NRRDLoader: class {
    setSegmentation() {}
    load = load;
  },
}));

// dat.gui builds DOM at construction and this test never opens a GUI.
vi.mock("dat.gui", () => ({ GUI: class {} }));

type Loader = typeof import("../Loader/copperNrrdLoader");

function loadingBar() {
  const loadingContainer = document.createElement("div");
  const progress = document.createElement("div");
  loadingContainer.appendChild(progress);
  return { loadingContainer, progress } as any;
}

/** The three callbacks `copperNrrdLoader` handed to `NRRDLoader.load`. */
function slots() {
  const [, onLoad, onProgress, onError] = load.mock.calls[0]!;
  return { onLoad, onProgress, onError };
}

let copperNrrdLoader: Loader["copperNrrdLoader"];

beforeEach(async () => {
  load.mockClear();
  ({ copperNrrdLoader } = await import("../Loader/copperNrrdLoader"));
});

describe("onError", () => {
  it("is passed as the fourth argument, which used to be missing entirely", () => {
    const onError = vi.fn();
    copperNrrdLoader("v.nrrd", loadingBar(), false, undefined, {
      openGui: false,
      onError,
    });

    const failure = new Error("404");
    slots().onError(failure);

    expect(onError).toHaveBeenCalledWith(failure);
  });

  it("takes the loading bar down, so a failure does not look like a slow load", () => {
    const bar = loadingBar();
    bar.loadingContainer.style.display = "flex";
    copperNrrdLoader("v.nrrd", bar, false, undefined, { openGui: false });

    slots().onError(new Error("404"));

    expect(bar.loadingContainer.style.display).toBe("none");
  });

  it("does not require the caller to supply one", () => {
    copperNrrdLoader("v.nrrd", loadingBar(), false, undefined, {
      openGui: false,
    });

    expect(() => slots().onError(new Error("404"))).not.toThrow();
  });
});

/**
 * `extractSlice` walks the whole volume per call and the result stays on
 * `volume.sliceList` for the volume's lifetime, so an axis nobody displays is
 * a full pass over the buffer plus a geometry, material and canvas texture
 * that nothing frees.
 */
describe("opts.axes", () => {
  function fakeVolume() {
    const extractSlice = vi.fn((axis: string) => ({
      mesh: { axis },
      axis,
      repaint: vi.fn(),
    }));
    return {
      extractSlice,
      RASDimensions: [4, 4, 4],
      dimensions: [4, 4, 4],
      spacing: [1, 1, 1],
      min: 0,
      max: 1,
    };
  }

  /** Runs the loader's onLoad with a stub volume and returns what it built. */
  function loadWith(axes?: readonly ("x" | "y" | "z")[]) {
    const volume = fakeVolume();
    let received: any;
    copperNrrdLoader(
      "v.nrrd",
      loadingBar(),
      false,
      (_v, meshes, slices) => { received = { meshes, slices }; },
      { openGui: false, ...(axes ? { axes } : {}) }
    );
    slots().onLoad(volume);
    return { volume, ...received };
  }

  it("extracts all three axes by default, exactly as before", () => {
    const { volume, slices } = loadWith();

    expect(volume.extractSlice.mock.calls.map(c => c[0]).sort())
      .toEqual(["x", "y", "z"]);
    expect([slices.x, slices.y, slices.z].every(Boolean)).toBe(true);
  });

  it("extracts only what was asked for", () => {
    const { volume } = loadWith(["z"]);

    expect(volume.extractSlice).toHaveBeenCalledTimes(1);
    expect(volume.extractSlice).toHaveBeenCalledWith("z", expect.any(Number));
  });

  it("leaves the omitted axes undefined on both callback objects", () => {
    const { meshes, slices } = loadWith(["z"]);

    expect(slices.z).toBeDefined();
    expect(meshes.z).toBeDefined();
    expect([slices.x, slices.y, meshes.x, meshes.y])
      .toEqual([undefined, undefined, undefined, undefined]);
  });

  it("still annotates the axes it did extract", () => {
    const { slices } = loadWith(["z"]);

    expect(slices.z.initIndex).toBe(2);
    expect(slices.z.MaxIndex).toBe(3);
    expect(slices.z.RSARatio).toBe(1);
    expect(slices.z.RSAMaxIndex).toBe(3);
  });

  it("extracts nothing for an empty list, without throwing", () => {
    const { volume, slices } = loadWith([]);

    expect(volume.extractSlice).not.toHaveBeenCalled();
    expect([slices.x, slices.y, slices.z])
      .toEqual([undefined, undefined, undefined]);
  });
});

describe("onProgress", () => {
  it("fires in addition to the built-in loading bar, not instead of it", () => {
    const bar = loadingBar();
    const onProgress = vi.fn();
    copperNrrdLoader("volume.nrrd", bar, false, undefined, {
      openGui: false,
      onProgress,
    });

    const event = { loaded: 50, total: 200 } as ProgressEvent;
    slots().onProgress(event);

    expect(onProgress).toHaveBeenCalledWith(event);
    // The bar's own text is unchanged behaviour and callers still read it.
    expect(bar.progress.innerText).toBe("File: volume.nrrd 25 % loaded");
  });

  it("works with no opts at all", () => {
    const bar = loadingBar();
    copperNrrdLoader("volume.nrrd", bar, false);

    expect(() =>
      slots().onProgress({ loaded: 1, total: 1 } as ProgressEvent)
    ).not.toThrow();
    expect(bar.loadingContainer.style.display).toBe("none");
  });
});
