import * as THREE from "three";
import { getLut } from "../Loader/copperDicomLoader";
import { copperVolumeType, planeCorners } from "../types/types";
import { GUI } from "dat.gui";
import vert_2d from "../lib/shader/texture2d_vertex.glsl";
import frag_2d from "../lib/shader/texture2d_frag.glsl";

let planeWidth = 80;
let planeHeight = 80;

export interface texture2dResult {
  mesh: THREE.Mesh;
  copperVolume: copperVolumeType;
  updateTexture: (copperVolume: copperVolumeType) => void;
  setFrame: (i: number) => void;
  setWindow: (center: number, width: number) => void;
}

// Build a quad from the 4 world-space image-plane corners (preserves real pose).
function buildAlignedQuad(c: planeCorners): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  // two triangles: tl,bl,tr / tr,bl,br
  g.setAttribute(
    "position",
    new THREE.BufferAttribute(
      new Float32Array([...c.tl, ...c.bl, ...c.tr, ...c.tr, ...c.bl, ...c.br]),
      3
    )
  );
  // vertex order is tl, bl, tr, tr, bl, br. The fragment shader flips v (vUv.y = 1-uv.y)
  // and DataArrayTexture has no flipY, so the image-top (data row 0) must map to the
  // top world corner: tl/tr get uv.y = 1.
  g.setAttribute(
    "uv",
    new THREE.BufferAttribute(
      new Float32Array([0, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 0]),
      2
    )
  );
  g.computeVertexNormals();
  return g;
}

export function createTexture2D_NRRD(
  data: Uint8Array,
  width: number,
  height: number,
  depth: number,
  callback: (mesh: THREE.Mesh) => void
) {
  const texture = new THREE.DataArrayTexture(data, width, height, depth);
  texture.format = THREE.RedFormat;
  texture.needsUpdate = true;

  const material = new THREE.ShaderMaterial({
    uniforms: {
      diffuse: { value: texture },
      depth: { value: 1 },
      uOpacity: { value: 1 },
    },
    vertexShader: vert_2d,
    fragmentShader: frag_2d,
    glslVersion: THREE.GLSL3,
    side: THREE.DoubleSide,
  });

  const geometry = new THREE.PlaneGeometry(planeWidth, planeHeight);

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "texture2d_mesh_zip";
  callback(mesh);
}

export function createTexture2D_Array(
  copperVolume: copperVolumeType,
  depth: number,
  scene: THREE.Scene,
  gui?: GUI,
  aligned: boolean = false
): texture2dResult {
  planeWidth = copperVolume.width / 2;
  planeHeight = copperVolume.height / 2;

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
      .add(copperVolume as any, "windowWidth")
      .min(1)
      .max(copperVolume.windowWidth * 2)
      .step(1)
      .onChange((value) => {
        copperVolume.windowWidth = value;
        updateTexture(copperVolume);
      });
    gui
      .add(copperVolume as any, "windowCenter")
      .min(1)
      .max(copperVolume.windowCenter * 2)
      .step(1)
      .onChange((value) => {
        copperVolume.windowCenter = value;
        updateTexture(copperVolume);
      });
  }

  const material = new THREE.ShaderMaterial({
    uniforms: {
      diffuse: { value: texture },
      depth: { value: 0 },
      uOpacity: { value: 1 },
    },
    vertexShader: vert_2d,
    fragmentShader: frag_2d,
    glslVersion: THREE.GLSL3,
    side: THREE.DoubleSide,
  });

  // Aligned world-space quad only when explicitly requested and geometry tags exist;
  // otherwise the legacy centred plane (keeps existing loadDicom behaviour unchanged).
  const geometry =
    aligned && copperVolume.corners
      ? buildAlignedQuad(copperVolume.corners)
      : new THREE.PlaneGeometry(planeWidth, planeHeight);

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "texture2d_mesh_array";
  scene.add(mesh);

  function updateTexture(copperVolumeUp: copperVolumeType) {
    if (!!copperVolumeUp) {
      let voiLUT;
      let lut = getLut(
        copperVolumeUp.uint16,
        copperVolumeUp.windowWidth,
        copperVolumeUp.windowCenter,
        copperVolumeUp.invert,
        voiLUT
      );
      for (let i = 0, len = copperVolumeUp.uint16.length; i < len; i++) {
        copperVolumeUp.uint8[i] = lut.lutArray[copperVolumeUp.uint16[i]];
      }
      texture.needsUpdate = true;
    }
  }

  function setFrame(i: number) {
    (material.uniforms.depth.value as number) = i;
  }

  function setWindow(center: number, width: number) {
    copperVolume.windowCenter = center;
    copperVolume.windowWidth = width;
    updateTexture(copperVolume);
  }

  return { mesh, copperVolume, updateTexture, setFrame, setWindow };
}
