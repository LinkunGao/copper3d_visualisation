import { VTKLoader } from "three/examples/jsm/loaders/VTKLoader.js";
import * as THREE from "three";
import { IOptVTKLoader } from "../types/types";

const vtkLoader = new VTKLoader();

const materialConfig = {
  wireframe: false,
  side: THREE.DoubleSide,
  color: 0xfff000,
};

export function copperVtkLoader(
  url: string,
  scene: THREE.Scene,
  content: THREE.Group,
  opts?: IOptVTKLoader
) {
  vtkLoader.load(url, function (geometry) {
    geometry.center();
    geometry.computeVertexNormals();
    const vtkmaterial = new THREE.MeshStandardMaterial(materialConfig);
    if (opts) {
      configOpts(vtkmaterial, opts);
    }

    const mesh = new THREE.Mesh(geometry, vtkmaterial);
    mesh.scale.multiplyScalar(0.1);

    content.add(mesh);
    scene.add(content);
  });
}

export function copperMultipleVtk(opts?: IOptVTKLoader) {
  const vtkmaterial = new THREE.MeshStandardMaterial(materialConfig);
  if (opts) {
    configOpts(vtkmaterial, opts);
  }
  return { vtkLoader, vtkmaterial };
}

function configOpts(
  vtkmaterial: THREE.MeshStandardMaterial,
  opts: IOptVTKLoader
) {
  if (opts.wireframe) {
    vtkmaterial.wireframe = opts.wireframe;
  }
  if (opts.color) {
    vtkmaterial.color.set(opts.color);
  }
  if (opts.transparent) {
    vtkmaterial.transparent = opts.transparent;
  }
  if (opts.opacity) {
    vtkmaterial.opacity = opts.opacity;
  }
}
