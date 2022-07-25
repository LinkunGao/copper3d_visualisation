import * as THREE from "three";
import baseScene from "./baseScene";
import { GLTF } from "three/examples/jsm/loaders/GLTFLoader";
import { copperGltfLoader } from "../Loader/copperGltfLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { pickModelDefault } from "../Utils/raycaster";

export default class copperSceneOnDemond extends baseScene {
  controls: OrbitControls;
  renderRequested: boolean | undefined = false;
  isResize: boolean = false;
  private pickableObjects: THREE.Mesh[] = [];

  constructor(container: HTMLDivElement, renderer: THREE.WebGLRenderer) {
    super(container, renderer);
    this.controls = new OrbitControls(this.camera, renderer.domElement);

    this.controls.addEventListener("change", this.requestRenderIfNotRequested);
    window.addEventListener("resize", this.confirmResize, false);
    requestAnimationFrame(this.render);
  }

  loadGltf(url: string, callback?: (content: THREE.Group) => void) {
    const loader = copperGltfLoader(this.renderer);

    loader.load(
      url,
      (gltf: GLTF) => {
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = box.getSize(new THREE.Vector3()).length();
        const center = box.getCenter(new THREE.Vector3());

        this.controls.maxDistance = size * 10;
        gltf.scene.position.x += gltf.scene.position.x - center.x;
        gltf.scene.position.y += gltf.scene.position.y - center.y;
        gltf.scene.position.z += gltf.scene.position.z - center.z;

        if (!this.cameraPositionFlag) {
          this.camera.position.copy(center);
          this.camera.position.x += size / 2.0;
          this.camera.position.y += size / 5.0;
          this.camera.position.z += size / 2.0;
          this.camera.lookAt(center);
          this.viewPoint = this.setViewPoint(this.camera, [
            center.x,
            center.y,
            center.z,
          ]);
        }

        this.content = gltf.scene;
        this.scene.add(gltf.scene);
        callback && callback(gltf.scene);
      },
      (error) => {
        // console.log(error);
      }
    );
  }
  // pickModel
  pickModel(
    content: THREE.Group,
    callback: (selectMesh: THREE.Mesh | undefined) => void,
    options?: string[]
  ) {
    content.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        if (!(options && options.includes(m.name))) {
          this.pickableObjects.push(m);
        }
      }
    });
    pickModelDefault(
      this.camera,
      this.container,
      this.pickableObjects,
      callback
    );
  }

  confirmResize = () => {
    this.isResize = true;
    this.requestRenderIfNotRequested();
  };

  render = () => {
    this.renderRequested = undefined;

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  requestRenderIfNotRequested = () => {
    if (!this.renderRequested) {
      if (this.isResize) {
        this.isResize = false;
        this.onWindowResize();
      }
      this.renderRequested = true;
      requestAnimationFrame(this.render);
    }
  };
}
