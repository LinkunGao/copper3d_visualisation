import * as THREE from "three";
import { unzipSync } from "fflate";
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
  array: Uint8ClampedArray,
  w: number,
  h: number,
  depth: number,
  scene: THREE.Scene
) {
  planeWidth = w / 2;
  planeHeight = h / 2;

  const texture = new THREE.DataArrayTexture(array, w, h, depth);
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
  scene.add(mesh);
  mesh.name = "texture2d_mesh_array";
}
