# Loading GLB: Draco & KTX2 Decoders

A Draco-compressed GLB is typically a tenth the size of the same model
uncompressed — one of this project's anatomy models goes from 10.18MB to 598KB.
The catch is that the browser cannot decode it alone: three fetches a separate
WebAssembly decoder at load time, from a path you have to be able to set.

**Before 3.9.0 you could not set it, and the default 404'd.** Both are fixed.

## What was wrong

```ts
// pre-3.9.0, module-level consts, not exported
new DRACOLoader(MANAGER).setDecoderPath(`${THREE_PATH}/examples/js/libs/draco/gltf/`)
new KTX2Loader(MANAGER).setTranscoderPath(`${THREE_PATH}/examples/js/libs/basis`)
```

Three separate problems:

- **`examples/js/` does not exist.** three removed that directory long ago; the
  decoder lives under `examples/jsm/`. Every Draco-compressed GLB failed, and
  what surfaced in the console was a CORS error on the 404 rather than anything
  naming the real cause.
- **The transcoder path had no trailing slash.** three concatenates the file
  name onto the string, so it asked for `libs/basisbasis_transcoder.js`.
- **Neither was reachable.** They were module-level `const`s, and neither they
  nor `copperGltfLoader` were exported, so nothing downstream could correct
  them.

## Setting your own path

```ts
import Copper from "copper3d";

Copper.setDracoDecoderPath("/draco/");
Copper.setKTX2TranscoderPath("/basis/");
```

Both expect a **trailing slash** — three appends `draco_wasm_wrapper.js`,
`draco_decoder.wasm` and `basis_transcoder.js` directly to what you pass.

On a subpath deploy the base URL has to be included. A decoder served from
`/te-uma/draco/` is not found at `/draco/`:

```ts
// e.g. Nuxt
Copper.setDracoDecoderPath(`${useRuntimeConfig().app.baseURL.replace(/\/$/, "")}/draco/`);
```

Call once at startup, before the first GLB loads. Both paths feed shared
loaders, so a call reaches loaders that already exist — but the decoder module
itself is fetched on first use and cached inside `DRACOLoader`, so changing the
path after something has decoded does not re-fetch it.

## Why you probably want to self-host

The default reaches unpkg for the same three revision copper3d was built
against. That works, and it is a hard runtime dependency on a third-party CDN —
which an offline, air-gapped, or firewalled deployment cannot satisfy, and which
a teaching resource used in a hospital very likely cannot either.

Copy the files into your own static directory at build time:

```
public/
  draco/
    draco_wasm_wrapper.js
    draco_decoder.wasm
  basis/
    basis_transcoder.js
    basis_transcoder.wasm
```

They come from `three/examples/jsm/libs/draco/gltf/` and
`three/examples/jsm/libs/basis/` in your `node_modules`. Copy them from the
three version you actually build with — a decoder and a `GLTFLoader` from
different revisions are not guaranteed to agree.

## `copperGltfLoader()` <Badge type="tip" text="3.9.0" />

```ts
copperGltfLoader(renderer: THREE.WebGLRenderer): GLTFLoader
```

Also newly exported: the `GLTFLoader` copper3d builds internally, already wired
to the shared Draco and KTX2 loaders. Use it when you need your own loader — your
own `LoadingManager`, an `onError` handler, or a load that does not go through a
copper3d scene — without rebuilding the decoder wiring and getting the paths
right a second time.

```ts
const loader = Copper.copperGltfLoader(renderer.renderer);
loader.load(url, onLoad, onProgress, onError);
```

Note the fourth argument. `scene.loadGltf()` does not accept one, which is why a
caller that has to report a failed GLB needs its own loader today.

## Upgrading from 3.8.x

Nothing to change. The corrected default paths can only work where the old ones
404'd, and the setters are new exports. If you worked around this by building
your own `GLTFLoader` and `DRACOLoader`, that keeps working — switching to
`setDracoDecoderPath` plus `scene.loadGltf` is optional, and worth it only if
you do not also need the error handling that motivated the workaround.
