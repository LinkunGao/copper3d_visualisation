import * as THREE from "three";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls";
import { CameraViewPoint } from "../Controls/copperControls";
import { GLTF } from "three/examples/jsm/loaders/GLTFLoader";
import { copperGltfLoader } from "../Loader/copperGltfLoader";
import { pickModelDefault } from "../Utils/raycaster";
import { copperNrrdLoader, optsType } from "../Loader/copperNrrdLoader";
import { copperVtkLoader, copperMultipleVtk } from "../Loader/copperVtkLoader";
import baseScene from "./baseScene";
import { GUI } from "dat.gui";
import { nrrdMeshesType, nrrdSliceType, vtkModels } from "../types/types";

export default class copperScene extends baseScene {
  controls: TrackballControls;
  clock: THREE.Clock = new THREE.Clock();
  // isHalfed: boolean = false;

  private mixer: THREE.AnimationMixer | null = null;
  private playRate: number = 1.0;
  private modelReady: boolean = false;
  private clipAction: any;
  // rayster pick
  private pickableObjects: THREE.Mesh[] = [];

  constructor(container: HTMLDivElement, renderer: THREE.WebGLRenderer) {
    super(container, renderer);
    this.controls = new TrackballControls(
      this.camera,
      this.renderer.domElement
    );
    window.addEventListener("resize", this.onWindowResize, false);
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
        this.mixer = new THREE.AnimationMixer(gltf.scene);
        gltf.animations.forEach((a: THREE.AnimationClip, index: number) => {
          if (index === 0) this.clipAction = this.mixer?.clipAction(a).play();
          else this.mixer?.clipAction(a).play();
        });
        this.content = gltf.scene;
        this.exportContent.copy(gltf.scene);
        this.exportContent.animations = gltf.animations;
        this.scene.add(gltf.scene);
        this.modelReady = true;
        callback && callback(gltf.scene);
      },
      (error) => {
        // console.log(error);
      }
    );
  }

  loadNrrd(
    url: string,
    callback?: (
      volume: any,
      nrrdMeshes: nrrdMeshesType,
      nrrdSlices: nrrdSliceType,
      gui?: GUI
    ) => void,
    opts?: optsType
  ) {
    copperNrrdLoader(url, this.scene, this.container, callback, opts);
  }

  loadVtk(url: string) {
    copperVtkLoader(url, this.scene, this.content);
  }

  loadVtks(models: Array<vtkModels>) {
    let count = 0;
    const { vtkLoader, vtkmaterial } = copperMultipleVtk();
    const group = new THREE.Group();

    const finishInterval = setInterval(() => {
      if (count === models.length) {
        this.scene.add(this.exportContent);

        this.mixer = new THREE.AnimationMixer(group);
        this.exportContent.animations.forEach((clip) => {
          const action = this.mixer?.clipAction(clip);
          (action as THREE.AnimationAction).timeScale = 3;
          (action as THREE.AnimationAction).play();
        });

        this.modelReady = true;
        clearInterval(finishInterval);
      }
    }, 100);

    models.forEach((model) => {
      const geometries: Array<THREE.BufferGeometry> = [];
      model.urls.forEach((url) => {
        vtkLoader.load(url, (geometry) => {
          geometry.center();
          geometry.computeVertexNormals();
          geometries.push(geometry);
          if (geometries.length === model.urls.length) {
            finishLoad(geometries, model);
            count += 1;
          }
        });
      });
    });

    const finishLoad = (
      geometries: Array<THREE.BufferGeometry>,
      model: vtkModels
    ) => {
      let geometry = geometries[0];
      geometries.forEach((child, index) => {
        if (index === 0) {
          geometry = child;
          geometry.morphAttributes.position = [];
        } else {
          geometry.morphAttributes.position.push(child.attributes.position);
        }
      });
      const mesh = new THREE.Mesh(geometry, vtkmaterial);
      mesh.scale.multiplyScalar(0.1);

      group.add(mesh);
      this.exportContent.add(group);

      mesh.morphTargetInfluences = [];
      mesh.name = model.name;

      let j = 0;
      let tracks = [];
      let duration = geometries.length - 1;
      for (let i = 0; i < duration; i++) {
        const track = new THREE.KeyframeTrack(
          `${mesh.name}.morphTargetInfluences[${i}]`,
          [j, j + 1, j + 2],
          [0, 1, 0]
        );
        tracks.push(track);
        j = j + 2;
      }
      const clip = new THREE.AnimationClip(
        `copper3d_heart_morph_${mesh.name}`,
        duration,
        tracks
      );
      this.exportContent.animations.push(clip);
    };
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

  getPlayRate() {
    return this.playRate;
  }

  setPlayRate(playRate: number) {
    this.playRate = playRate;
  }

  setModelPosition(
    model: THREE.Group | THREE.Mesh,
    position: { x?: number; y?: number; z?: number }
  ) {
    if (position.x) model.position.x = position.x;
    if (position.y) model.position.y = position.y;
    if (position.z) model.position.z = position.z;
  }

  resetView() {
    this.controls.reset();
    this.updateCamera(this.viewPoint);
  }

  // updateModelChildrenVisualisation(child: THREE.Mesh) {
  //   child.visible = !child.visible;
  //   let flags: Array<boolean> = [];
  //   this.content.traverse((mesh) => {
  //     flags.push(mesh.visible);
  //   });
  //   flags.includes(false) ? (this.isHalfed = true) : (this.isHalfed = false);
  // }

  updateCamera(viewpoint: CameraViewPoint) {
    this.cameraPositionFlag = true;
    this.copperControl.updateCameraViewPoint(viewpoint);
  }

  getCurrentTime() {
    let currentTime = 0;
    if (this.clipAction) {
      currentTime = this.clipAction.time / this.clipAction._clip.duration;
    }
    return currentTime;
  }

  getCurrentMixer() {
    return this.mixer;
  }

  render() {
    this.controls.update();

    if (this.modelReady) {
      this.mixer && this.mixer.update(this.clock.getDelta() * this.playRate);
    }
    this.renderer.render(this.scene, this.camera);
  }
}
