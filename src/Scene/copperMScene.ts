import * as THREE from "three";
import { GUI } from "dat.gui";
import { Controls, CameraViewPoint } from "../Controls/copperControls";
import { createBackground, customMeshType } from "../lib/three-vignette";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GLTF } from "three/examples/jsm/loaders/GLTFLoader";
import { copperGltfLoader } from "../Loader/copperGltfLoader";
import { objLoader } from "../Loader/copperOBJLoader";
import { isPickedModel, throttle } from "../Utils/raycaster";
import {
  mouseMovePositionType,
  positionType,
  nrrdSliceType,
} from "../types/types";
import { copperNrrdLoader1, getWholeSlices } from "../Loader/copperNrrdLoader";
import { isIOS } from "../Utils/utils";

import commonScene from "./commonSceneMethod";


const IS_IOS = isIOS();

export default class copperMScene extends commonScene {
  gui: GUI = new GUI({
    width: 260,
    autoPlace: false,
  });
  container: HTMLDivElement;
  renderer: THREE.WebGLRenderer;
  sceneName: string = "";
  vignette: customMeshType;
  directionalLight: THREE.DirectionalLight;
  ambientLight: THREE.AmbientLight;
  copperControl: Controls;
  viewPoint: CameraViewPoint = new CameraViewPoint();
  cameraPositionFlag = false;
  content: THREE.Group = new THREE.Group();
  isHalfed: boolean = false;
  controls: TrackballControls | OrbitControls;

  private color1: string = "#5454ad";
  private color2: string = "#18e5a7";
  private lights: any[] = [];
  private renderNrrdVolume: boolean = false;
  private guiContainer: HTMLDivElement = document.createElement("div");

  constructor(container: HTMLDivElement, renderer: THREE.WebGLRenderer) {
    super(container);
    this.container = container;
    this.renderer = renderer;
    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      500
    );
    this.ambientLight = new THREE.AmbientLight(0x202020, 1);
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 2.5);

    this.vignette = createBackground({
      aspect: this.container.clientWidth / this.container.clientHeight,
      // grainScale: IS_IOS ? 0 : 0.001,
      grainScale: 0,
      colors: [this.color1, this.color2],
    });
    this.vignette.mesh.name = "Vignette";
    this.vignette.mesh.renderOrder = -1;

    this.copperControl = new Controls(this.camera);
    this.controls = new TrackballControls(this.camera, this.container);
    this.controls.rotateSpeed = 0.02;
    this.controls.staticMoving = true
    // this.controls = new OrbitControls(this.camera, this.container);
    this.preRenderCallbackFunctions = {
      index: 0,
      cache: [],
      add(fn) {
        if (!fn.id) {
          fn.id = ++this.index;
          this.cache[fn.id] = fn;
          return;
        }
      },
      remove(id) {
        if (this.cache[id]) delete this.cache[id];
      },
    };
    this.init();
  }
  init() {
    this.copperControl.setCameraViewPoint();
    this.camera.position.z = 2;
    this.guiContainer.style.position = "fixed";
    this.guiContainer.style.top = "0";
    this.guiContainer.style.right = "0";
    this.guiContainer.style.zIndex = "100";
    this.guiContainer.appendChild(this.gui.domElement);
    this.container.appendChild(this.guiContainer);

    this.guiContainer.addEventListener(
      "pointerover",
      throttle(() => {
        this.controls.enabled = false;
      }, 100),
      false
    );
    this.guiContainer.addEventListener(
      "pointerleave",
      () => {
        this.controls.enabled = true;
      },
      false
    );

    this.addLights();

    // window.addEventListener("resize", this.onWindowResize, false);
  }
  setControls(type: number) {
    /**
     * type:
     *      0: Orbit
     *      other: Trackball
     */
    switch (type) {
      case 0:
        this.controls = new OrbitControls(this.camera, this.container);
        break;
      default:
        this.controls = new TrackballControls(this.camera, this.container);
        this.controls.rotateSpeed = 0.01;
        this.controls.staticMoving = true
        break;
    }
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
          this.viewPoint = this.setViewPoint(
            this.camera as THREE.PerspectiveCamera,
            [center.x, center.y, center.z]
          );
          if (this.subCamera) {
            this.subCamera?.position.copy(this.camera.position);
            this.subCamera?.lookAt(this.subScene.position);
            this.subCamera.near = size / 100;
            this.subCamera.far = size * 100;
            this.subCamera?.updateProjectionMatrix();
            const copy = new THREE.Group().copy(gltf.scene);
            copy.scale.set(size, size, size);
            this.subScene.add(copy);
          }
        }

        // this.mixer = new THREE.AnimationMixer(gltf.scene);
        // gltf.animations.forEach((a: THREE.AnimationClip, index: number) => {
        //   if (index === 0) this.clipAction = this.mixer?.clipAction(a).play();
        //   else this.mixer?.clipAction(a).play();
        // });
        this.content = gltf.scene;

        this.scene.add(gltf.scene);
        // this.modelReady = true;
        callback && callback(gltf.scene);
      },
      (error) => {
        // console.log(error);
      }
    );
  }

  // pickSpecifiedModel(
  //   content: THREE.Mesh | Array<THREE.Mesh>,
  //   mousePosition: mouseMovePositionType
  // ) {
  //   if (Array.isArray(content)) {
  //     this.pickableObjects = content;
  //   } else {
  //     this.pickableObjects.push(content);
  //   }
  //   return isPickedModel(
  //     this.camera as THREE.PerspectiveCamera,
  //     this.container,
  //     this.pickableObjects,
  //     mousePosition
  //   );
  // }

  setViewPoint(
    camera: THREE.PerspectiveCamera,
    target?: number[]
  ): CameraViewPoint {
    const viewPoint = new CameraViewPoint();
    viewPoint.farPlane = camera.far;
    viewPoint.nearPlane = camera.near;
    viewPoint.eyePosition = [
      camera.position.x,
      camera.position.y,
      camera.position.z,
    ];
    if (target) {
      viewPoint.targetPosition = [target[0], target[1], target[2]];
    } else {
      viewPoint.targetPosition = [0, 0, 0];
    }
    viewPoint.upVector = [camera.up.x, camera.up.y, camera.up.z];
    this.viewPoint = viewPoint;
    return viewPoint;
  }

  loadNrrd1(url: string, callback?: (volume: any, gui?: GUI) => void) {
    // const h = 512; // frustum height
    const h = 1024;
    const aspect = window.innerWidth / window.innerHeight;

    this.camera = new THREE.OrthographicCamera(
      (-h * aspect) / 2,
      (h * aspect) / 2,
      h / 2,
      -h / 2,
      1,
      1000
    );

    this.camera.position.set(0, 0, 128);

    // this.camera.position.set(-64, -64, 128);
    this.camera.up.set(0, 0, 1);
    this.controls.dispose();
    this.controls = new OrbitControls(this.camera, this.container);
    this.controls.target.set(64, 64, 128);
    this.controls.minZoom = 0.5;
    this.controls.maxZoom = 4;
    this.controls.enablePan = false;
    this.renderNrrdVolume = true;
    copperNrrdLoader1(url, this.scene, this.container, callback);
  }

  loadOBJ(url: string, callback?: (mesh: THREE.Group) => void) {
    objLoader.load(
      url,
      (obj) => {
        obj.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            // (child as THREE.Mesh).material = new THREE.MeshStandardMaterial({
            //   side: THREE.DoubleSide,
            //   color: 0xffffff,
            // });
            // ((child as THREE.Mesh).material as THREE.MeshPhongMaterial).color =
            //   new THREE.Color(0xffffff);
          }
        });
        const box = new THREE.Box3().setFromObject(obj);
        const size = box.getSize(new THREE.Vector3()).length();
        const center = box.getCenter(new THREE.Vector3());

        this.controls.maxDistance = size * 10;
        obj.position.x += obj.position.x - center.x;
        obj.position.y += obj.position.y - center.y;
        obj.position.z += obj.position.z - center.z;

        if (!this.cameraPositionFlag) {
          this.camera.position.copy(center);
          this.camera.position.x += size / 2.0;
          this.camera.position.y += size / 5.0;
          this.camera.position.z += size / 2.0;
          this.camera.lookAt(center);
          this.viewPoint = this.setViewPoint(
            this.camera as THREE.PerspectiveCamera,
            [center.x, center.y, center.z]
          );
        }
        this.scene.add(obj);
        !!callback && callback(obj);
      }, // called when loading is in progresses
      (xhr: any) => {
        // console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
      },
      // called when loading has errors
      (error: any) => {
        console.log("An error happened");
      }
    );
  }

  drawWholeNrrd(nrrdSlices: nrrdSliceType) {
    getWholeSlices(
      nrrdSlices,
      this.scene,
      this.gui,
      this.controls as TrackballControls
    );
  }

  updateBackground(color1: string, color2: string) {
    this.vignette.style({
      colors: [color1, color2],
    });
  }

  addLights() {
    const hemiLight = new THREE.HemisphereLight();
    hemiLight.name = "hemi_light";
    this.scene.add(hemiLight);
    this.ambientLight.name = "ambient_light";
    this.directionalLight.name = "main_light";
    this.directionalLight.position.set(0.5, 0, 0.866);
    this.camera.add(this.ambientLight);
    this.camera.add(this.directionalLight);
    this.lights.push(hemiLight);
    this.lights.push(this.ambientLight);
    this.lights.push(this.directionalLight);
  }
  removeLights() {
    if (this.lights) {
      this.lights.forEach((light) => light.parent.remove(light));
      this.lights.length = 0;
    }
  }

  loadViewUrl(url: string) {
    const xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = () => {
      if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
        const viewpointData = JSON.parse(xmlhttp.responseText);
        this.loadView(viewpointData);
      }
    };
    xmlhttp.open("GET", url, true);
    xmlhttp.send();
  }

  loadView(viewpointData: CameraViewPoint) {
    this.cameraPositionFlag = true;
    this.viewPoint = viewpointData;
    const viewpoint = new CameraViewPoint();
    viewpoint.farPlane = viewpointData.farPlane;
    viewpoint.nearPlane = viewpointData.nearPlane;
    viewpoint.eyePosition = viewpointData.eyePosition;
    viewpoint.targetPosition = viewpointData.targetPosition;
    viewpoint.upVector = viewpointData.upVector;
    this.copperControl.updateCameraViewPoint(viewpoint);
    if (this.subCopperControl) {
      this.subCopperControl.updateCameraViewPoint(viewpoint);
    }
  }
  updateCamera(viewpoint: CameraViewPoint) {
    this.cameraPositionFlag = true;
    this.copperControl.updateCameraViewPoint(viewpoint);
  }

  setCameraPosition(position: positionType) {
    if (typeof position.x === "number") this.camera.position.x = position.x;
    if (typeof position.y === "number") this.camera.position.y = position.y;
    if (typeof position.z === "number") this.camera.position.z = position.z;

    this.setViewPoint(this.camera as THREE.PerspectiveCamera);
  }
  removePreRenderCallbackFunction(id: number) {
    this.preRenderCallbackFunctions.remove(id);
  }

  resetView() {
    this.controls.reset();
    this.updateCamera(this.viewPoint);
  }

  onWindowResize = () => {
    const { width, height } = this.container.getBoundingClientRect();
    const aspect = width / height;
    if (this.renderNrrdVolume) {
      const volumeCamera = this.camera as THREE.OrthographicCamera;
      const frustumHeight = volumeCamera.top - volumeCamera.bottom;

      volumeCamera.left = (-frustumHeight * aspect) / 2;
      volumeCamera.right = (frustumHeight * aspect) / 2;
    } else {
      (this.camera as THREE.PerspectiveCamera).aspect = aspect;
    }
    this.camera.updateProjectionMatrix();

    if (this.subDiv && this.subCamera && this.subRender) {
      this.subCamera.aspect =
        this.subDiv.clientWidth / this.subDiv.clientHeight;
      this.subCamera.updateProjectionMatrix();
      this.subRender.setSize(this.subDiv.clientWidth, this.subDiv.clientHeight);
    }

    this.controls.update();
  };

  render() {
    this.controls.update();
    this.onWindowResize();
    // if (this.modelReady) {
    //   this.mixer && this.mixer.update(this.clock.getDelta() * this.playRate);
    // }
    this.renderer.render(this.scene, this.camera);
    Object.values(this.preRenderCallbackFunctions.cache).forEach((item) => {
      item && item.call(null);
    });
    if (this.subDiv && this.subCamera && this.subRender) {
      this.subCamera.position.copy(this.camera.position);
      this.subCamera.lookAt(this.subScene.position);
      this.subRender.render(this.subScene, this.subCamera);
    }
  }
}
