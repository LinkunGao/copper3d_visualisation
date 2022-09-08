import * as THREE from "three";
import { unzipSync } from "fflate";
import { getLut } from "../Loader/copperDicomLoader";
import { copperVolumeType } from "../types/types";
import { GUI } from "dat.gui";
import vert_2d from "../lib/shader/texture2d_vertex.glsl";
import frag_2d from "../lib/shader/texture2d_frag.glsl";

let planeWidth = 80;
let planeHeight = 80;

export function createTexture2D_Zip(url: string, scene: THREE.Scene) {
  new THREE.FileLoader()
    .setResponseType("arraybuffer")
    .load(url, function (data) {
      const zip = unzipSync(new Uint8Array(data as ArrayBuffer));
      const array = new Uint8Array(zip["head256x256x109"].buffer);

      const texture = new THREE.DataArrayTexture(array, 256, 256, 109);
      texture.format = THREE.RedFormat;
      texture.needsUpdate = true;

      const material = new THREE.ShaderMaterial({
        uniforms: {
          diffuse: { value: texture },
          depth: { value: 1 },
          size: { value: new THREE.Vector2(planeWidth, planeHeight) },
        },
        vertexShader: vert_2d,
        fragmentShader: frag_2d,
        glslVersion: THREE.GLSL3,
        side: THREE.DoubleSide,
      });

      const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);

      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = "texture2d_mesh_zip";
      scene.add(mesh);
    });
}

export function createTexture2D_Array(
  copperVolume: copperVolumeType,
  depth: number,
  scene: THREE.Scene,
  gui?: GUI
) {
  planeWidth = copperVolume.width / 2;
  planeHeight = copperVolume.height / 2;

  const state = {
    windowWidth: copperVolume.windowWidth,
    windowCenter: copperVolume.windowCenter,
  };

  const texture = new THREE.DataArrayTexture(
    copperVolume.uint8,
    copperVolume.width,
    copperVolume.height,
    depth
  );
  texture.format = THREE.RedFormat;
  texture.needsUpdate = true;
  if (gui) {
    gui
      .add(state, "windowWidth")
      .min(1)
      .max(copperVolume.windowWidth * 2)
      .step(1)
      .onChange(() => {
        updateTexture();
      });
    gui
      .add(state, "windowCenter")
      .min(1)
      .max(copperVolume.windowCenter * 2)
      .step(1)
      .onChange(() => {
        updateTexture();
      });
  }

  const material = new THREE.ShaderMaterial({
    uniforms: {
      diffuse: { value: texture },
      depth: { value: 1 },
      size: { value: new THREE.Vector2(planeWidth, planeHeight) },
    },
    vertexShader: vert_2d,
    fragmentShader: frag_2d,
    glslVersion: THREE.GLSL3,
    side: THREE.DoubleSide,
  });

  const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);

  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);
  mesh.name = "texture2d_mesh_array";

  function updateTexture() {
    let voiLUT;
    let lut = getLut(
      copperVolume.uint16,
      state.windowWidth,
      state.windowCenter,
      copperVolume.invert,
      voiLUT
    );
    for (let i = 0, len = copperVolume.uint16.length; i < len; i++) {
      copperVolume.uint8[i] = lut.lutArray[copperVolume.uint16[i]];
    }
    texture.needsUpdate = true;
  }
}
