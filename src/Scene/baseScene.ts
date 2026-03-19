import * as THREE from "three";
import { Controls, CameraViewPoint } from "../Controls/copperControls";
import { createBackground, customMeshType } from "../lib/three-vignette";
import { baseStateType, ICopperSceneOpts } from "../types/types";
import { isIOS, traverseMaterials } from "../Utils/utils";
import { commonScene } from "./commonSceneMethod";
import { Copper3dTrackballControls } from "../Controls/Copper3dTrackballControls";

const IS_IOS = isIOS();

export class baseScene extends commonScene {
  renderer: THREE.WebGLRenderer;
  // scene: THREE.Scene;
  // camera: THREE.PerspectiveCamera;
  sceneName: string = "";
  vignette: customMeshType | undefined;
  directionalLight: THREE.DirectionalLight;
  ambientLight: THREE.AmbientLight;
  copperControl: Controls;
  cameraPositionFlag = false;
  content: THREE.Group = new THREE.Group();
  exportContent: THREE.Group = new THREE.Group();
  isHalfed: boolean = false;
  viewPoint: CameraViewPoint = new CameraViewPoint();

  private color1: string = "#5454ad";
  private color2: string = "#18e5a7";
  private lights: any[] = [];

  constructor(
    container: HTMLDivElement,
    renderer: THREE.WebGLRenderer,
    opt?: ICopperSceneOpts
  ) {
    super(container, opt);
    this.renderer = renderer;

    this.ambientLight = new THREE.AmbientLight(0x606060, 0.8);
    this.directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    if (!opt?.alpha) {
      this.vignette = createBackground({
        aspect: this.container.clientWidth / this.container.clientHeight,
        grainScale: IS_IOS ? 0 : 0.001,
        colors: [this.color1, this.color2],
      });
      this.vignette.mesh.name = "Vignette";
      this.vignette.mesh.renderOrder = -1;
    }

    this.copperControl = new Controls(this.camera as THREE.PerspectiveCamera);

    this.init();
  }
  init() {
    this.copperControl.setCameraViewPoint();
    this.camera.position.z = 2;

    // this.scene.add(this.camera);

    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight
    );

    this.addLights();
  }

  loadMetadataUrl(url: string) {
    const xmlhttp = new XMLHttpRequest();
    xmlhttp.onreadystatechange = () => {
      if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
        const metadata = JSON.parse(xmlhttp.responseText) as any[];
        const numberOfMetadata = metadata.length;
        if (numberOfMetadata === 1) {
        } else if (numberOfMetadata > 1) {
        } else {
          console.error("Empty metadata!");
        }
      }
    };
    xmlhttp.open("GET", url, true);
    xmlhttp.send();
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
    this.camera.updateProjectionMatrix();
  }

  getDefaultViewPoint() {
    return this.viewPoint;
  }

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
    return viewPoint;
  }

  addObject(obj: any) {
    this.scene.add(obj);
  }

  addLights() {
    // Hemisphere light: sky/ground for broad ambient fill
    const hemiLight = new THREE.HemisphereLight(0xddeeff, 0x0f0e0d, 0.6);
    hemiLight.name = "hemi_light";
    this.scene.add(hemiLight);

    // Main key light — front-right, slightly above
    this.ambientLight.name = "ambient_light";
    this.directionalLight.name = "main_light";
    this.directionalLight.position.set(0.5, 0.5, 0.866);
    this.camera.add(this.ambientLight);
    this.camera.add(this.directionalLight);

    // Fill light — opposite side to soften shadows
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.name = "fill_light";
    fillLight.position.set(-0.5, -0.2, -0.866);
    this.camera.add(fillLight);

    // Top light — illuminates the top surface that key/fill lights miss
    const topLight = new THREE.DirectionalLight(0xffffff, 0.5);
    topLight.name = "top_light";
    topLight.position.set(0, 1, 0.2);
    this.camera.add(topLight);

    this.lights.push(this.ambientLight);
    this.lights.push(this.directionalLight);
    this.lights.push(hemiLight);
    this.lights.push(fillLight);
    this.lights.push(topLight);
  }
  removeLights() {
    if (this.lights) {
      this.lights.forEach((light) => light.parent.remove(light));
      this.lights.length = 0;
    }
  }
  updateLights(state: baseStateType) {
    const lights = this.lights;

    if (state.addLights && !lights.length) {
      this.addLights();
    } else if (!state.addLights && lights.length) {
      this.removeLights();
    }

    if (lights.length === 3) {
      lights[0].intensity = state.ambientIntensity;
      lights[0].color.setHex(state.ambientColor);
      lights[1].intensity = state.directIntensity;
      lights[1].color.setHex(state.directColor);
    }
  }

  updateDisplay(state: baseStateType) {
    traverseMaterials(this.content as THREE.Group, (material) => {
      material.wireframe = state.wireframe;
    });
  }
  updateBackground(color1: string, color2: string) {
    this.vignette?.style({
      colors: [color1, color2],
    });
  }
  updateModelChildrenVisualisation(child: THREE.Mesh) {
    child.visible = !child.visible;
    let flags: Array<boolean> = [];
    this.content.traverse((mesh) => {
      flags.push(mesh.visible);
    });
    flags.includes(false) ? (this.isHalfed = true) : (this.isHalfed = false);
  }

  onRenderCameraChange() {
    (this.camera as THREE.PerspectiveCamera).aspect =
      this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
  }

  onWindowResize = () => {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.onRenderCameraChange();
    this.vignette?.style({
      aspect: (this.camera as THREE.PerspectiveCamera).aspect,
    });
    if (this.controls instanceof Copper3dTrackballControls) {
      this.controls.handleResize();
    }

    this.renderer.setSize(
      this.container.clientWidth,
      this.container.clientHeight
    );
  };
  render(time?: number) {
    // this.onWindowResize();
    this.renderer.render(this.scene, this.camera);
  }
}
