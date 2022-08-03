import { VTKLoader } from "three/examples/jsm/loaders/VTKLoader.js";
import * as THREE from "three";

const vtkLoader = new VTKLoader();

const vtkmaterial = new THREE.MeshLambertMaterial({
  wireframe: false,
  side: THREE.DoubleSide,
  color: 0xfff000,
});
export function copperVtkLoader(
  url: string,
  scene: THREE.Scene,
  content: THREE.Group
) {
  vtkLoader.load(url, function (geometry) {
    geometry.center();
    geometry.computeVertexNormals();
    // const material = new THREE.MeshLambertMaterial({
    //   color: 0xffffff,
    // });
    const mesh = new THREE.Mesh(geometry, vtkmaterial);
    // mesh.position.set(5, 5, 0);
    mesh.scale.multiplyScalar(0.1);

    content.add(mesh);
    scene.add(content);
  });
}

export function copperMultipleVtk() {
  return { vtkLoader, vtkmaterial };
}
