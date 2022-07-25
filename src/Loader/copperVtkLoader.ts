import { VTKLoader } from "three/examples/jsm/loaders/VTKLoader.js";
import * as THREE from "three";

const vtkmaterial = new THREE.MeshLambertMaterial({
  wireframe: false,
  side: THREE.DoubleSide,
  color: 0xff0000,
});
export function copperVtkLoader(url: string, scene: THREE.Scene) {
  const vtkLoader = new VTKLoader();
  vtkLoader.load(url, function (geometry) {
    const mesh = new THREE.Mesh(geometry, vtkmaterial);
    scene.add(mesh);
  });
}
