import * as THREE from "three";
import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

const THREE_PATH = `https://unpkg.com/three@0.${THREE.REVISION}.x`;
const MANAGER = new THREE.LoadingManager();
const DRACO_LOADER = new DRACOLoader(MANAGER).setDecoderPath(
  `${THREE_PATH}/examples/js/libs/draco/gltf/`
);
const KTX2_LOADER = new KTX2Loader(MANAGER).setTranscoderPath(
  `${THREE_PATH}/examples/js/libs/basis`
);

export function copperGltfLoader(renderer: THREE.WebGLRenderer) {
  const loader = new GLTFLoader(MANAGER)
    .setCrossOrigin("anonymous")
    .setDRACOLoader(DRACO_LOADER)
    .setKTX2Loader(KTX2_LOADER.detectSupport(renderer));
  return loader;
}
