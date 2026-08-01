import { describe, expect, it } from "vitest";
import {
  copperGltfLoader,
  setDracoDecoderPath,
  setKTX2TranscoderPath,
} from "../Loader/copperGltfLoader";

/**
 * Asserted on the URLs the loaders would actually FETCH, not on the string
 * that was passed in. Both defaults were broken in ways a
 * "does it store what I set" test would have reported as fine: the Draco path
 * pointed at `examples/js/`, which three deleted long ago, and the KTX2 one
 * had no trailing slash, so the file name ran straight onto the directory.
 *
 * `detectSupport` only reads `renderer.extensions`, so a stub is enough.
 */
const renderer = {
  extensions: {
    has: () => false,
    get: () => ({ getSupportedProfiles: () => [] }),
  },
} as any;

function paths() {
  const loader = copperGltfLoader(renderer) as any;
  return {
    dracoWasm: loader.dracoLoader.decoderPaths.wasm as string,
    dracoJs: loader.dracoLoader.decoderPaths.js as string,
    transcoder: loader.ktx2Loader.transcoderPath as string,
  };
}

/**
 * Read once, at module scope, BEFORE any test calls a setter. The decoder and
 * transcoder are module-level singletons -- that is what lets a late
 * `setDracoDecoderPath` reach a loader built earlier -- so reading the
 * defaults inside a test would make these assertions depend on describe order.
 */
const defaults = paths();

describe("default decoder paths", () => {
  it("fetches the Draco decoder from examples/jsm, where three actually keeps it", () => {
    const { dracoWasm, dracoJs } = defaults;

    expect(dracoWasm).toContain("/examples/jsm/libs/draco/gltf/");
    expect(dracoWasm).not.toContain("/examples/js/libs/");
    expect(dracoWasm).toMatch(/\/draco_decoder\.wasm$/);
    expect(dracoJs).toMatch(/\/draco_wasm_wrapper\.js$/);
  });

  it("ends the transcoder directory with a slash, so the file name is not glued to it", () => {
    const { transcoder } = defaults;

    expect(transcoder).toContain("/examples/jsm/libs/basis/");
    expect(transcoder.endsWith("/")).toBe(true);
  });
});

describe("overriding them", () => {
  it("points Draco at a self-hosted copy, including one under a subpath", () => {
    setDracoDecoderPath("/te-uma/draco/");

    expect(paths().dracoWasm).toBe("/te-uma/draco/draco_decoder.wasm");
  });

  it("reaches loaders that already exist, since the decoder is shared", () => {
    // The order that matters in practice: a scene builds its loader on
    // construction, and the app configures paths afterwards.
    const before = copperGltfLoader(renderer) as any;
    setDracoDecoderPath("/other/draco/");

    expect(before.dracoLoader.decoderPaths.wasm).toBe(
      "/other/draco/draco_decoder.wasm"
    );
  });

  it("points the KTX2 transcoder somewhere else too", () => {
    setKTX2TranscoderPath("/basis/");

    expect(paths().transcoder).toBe("/basis/");
  });
});
