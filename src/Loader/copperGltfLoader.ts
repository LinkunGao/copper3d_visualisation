import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

/**
 * Where the Draco decoder and Basis transcoder are fetched from.
 *
 * The default reaches unpkg for the same three revision this build uses. It is
 * `examples/jsm/`, NOT `examples/js/` -- three removed the latter long ago, so
 * the path this defaulted to before 3.9.0 404'd, and every Draco-compressed
 * GLB failed to load with a CORS error on the 404 rather than anything that
 * named the real problem.
 *
 * Point these at your own copy with `setDracoDecoderPath` /
 * `setKTX2TranscoderPath`. A CDN at runtime is a hard dependency an offline,
 * air-gapped or firewalled deployment cannot satisfy, and the decoder is a few
 * hundred KB you can ship yourself.
 */
const THREE_PATH = `https://unpkg.com/three@0.${THREE.REVISION}.x`;

const MANAGER = new THREE.LoadingManager();
const DRACO_LOADER = new DRACOLoader(MANAGER).setDecoderPath(
  `${THREE_PATH}/examples/jsm/libs/draco/gltf/`
);
// Trailing slash, which the pre-3.9.0 value also lacked: three concatenates
// the file name onto this string, so `.../libs/basis` asked for
// `libs/basisbasis_transcoder.js`.
const KTX2_LOADER = new KTX2Loader(MANAGER).setTranscoderPath(
  `${THREE_PATH}/examples/jsm/libs/basis/`
);

/**
 * Points the Draco decoder at `path`, which must end in a slash -- three
 * appends `draco_wasm_wrapper.js` and `draco_decoder.wasm` to it directly.
 *
 * On a subpath deploy the base URL has to be included: a decoder served from
 * `/te-uma/draco/` is not found at `/draco/`.
 *
 * Call once at startup. The decoder module is fetched on first use and cached
 * inside `DRACOLoader`, so a later change does not re-fetch it.
 */
export function setDracoDecoderPath(path: string): void {
  DRACO_LOADER.setDecoderPath(path);
}

/** The same, for the Basis/KTX2 transcoder. Also expects a trailing slash. */
export function setKTX2TranscoderPath(path: string): void {
  KTX2_LOADER.setTranscoderPath(path);
}

/**
 * Optional callbacks for `scene.loadGltf`.
 *
 * Until 3.9.0 there were none, and the third argument every `loadGltf` passed
 * to `GLTFLoader.load` was an empty function NAMED `error` sitting in the
 * *onProgress* slot -- so a failed fetch or a corrupt file invoked nothing at
 * all, and the caller's `callback` simply never fired. A load that fails and a
 * load that is merely slow were indistinguishable from outside.
 */
export interface GltfLoadOpts {
  /** Download progress. Fires only when the server sends a Content-Length. */
  onProgress?: (event: ProgressEvent) => void;
  /** Fetch or parse failure. The one signal that a load is never coming. */
  onError?: (error: unknown) => void;
}

/**
 * A GLTFLoader wired to the shared Draco and KTX2 loaders.
 *
 * Exported so callers who need their own loader -- their own
 * `LoadingManager`, `onError`, or a load not going through a copper3d scene --
 * do not have to rebuild the decoder wiring and get the paths right again.
 */
export function copperGltfLoader(renderer: THREE.WebGLRenderer) {
  const loader = new GLTFLoader(MANAGER)
    .setCrossOrigin("anonymous")
    .setDRACOLoader(DRACO_LOADER)
    .setKTX2Loader(KTX2_LOADER.detectSupport(renderer));
  return loader;
}
