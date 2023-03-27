import {
  preRenderCallbackFunctionType,
  nrrdMeshesType,
  nrrdSliceType,
  vtkModels,
  copperVolumeType,
  loadingBarType,
  dicomLoaderOptsType,
} from "../types/types";
import * as THREE from "three";
import { GUI } from "dat.gui";
import { copperDicomLoader } from "../Loader/copperDicomLoader";
import { createTexture2D_Array } from "../Utils/texture2d";
import { copperNrrdLoader, optsType } from "../Loader/copperNrrdLoader";
import { pickModelDefault } from "../Utils/raycaster";
import { Controls } from "../Controls/copperControls";
import { objLoader } from "../Loader/copperOBJLoader";

export default class commonScene {
  container: HTMLDivElement;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera;

  subDiv: HTMLDivElement | null = null;
  subScene: THREE.Scene = new THREE.Scene();
  subCamera: THREE.PerspectiveCamera | null = null;
  protected subRender: THREE.WebGLRenderer | null = null;
  protected subCopperControl: Controls | null = null;

  protected preRenderCallbackFunctions: preRenderCallbackFunctionType;
  protected sort: boolean = true; //default ascending order
  protected depthStep: number = 0.4;

  protected pickableObjects: THREE.Mesh[] = [];

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      500
    );
    this.preRenderCallbackFunctions = {
      index: 0,
      cache: [],
      add(fn) {
        if (!fn.id) {
          fn.id = this.cache.length;
          this.cache.push(fn);
          return;
        }
      },
      remove(id) {
        if (this.cache[id]) {
          this.cache.splice(id, 1);
        }
      },
    };
  }

  createDemoMesh() {
    const geometry = new THREE.BoxGeometry();
    const material = new THREE.MeshPhongMaterial({
      color: 0xff00ff,
      wireframe: true,
    });

    const cube = new THREE.Mesh(geometry, material);
    this.scene.add(cube);
    this.scene.add(new THREE.AxesHelper(5));
  }
  addObject(obj: any) {
    this.scene.add(obj);
  }

  setDepth(value: number) {
    this.depthStep = value;
  }
  setDicomFilesOrder(value: "ascending" | "descending") {
    if (value === "ascending") {
      this.sort = true;
    } else if (value === "descending") {
      this.sort = false;
    }
  }

  addPreRenderCallbackFunction(callbackFunction: Function) {
    this.preRenderCallbackFunctions.add(callbackFunction);
    const id = this.preRenderCallbackFunctions.index;
    return id;
  }

  removePreRenderCallbackFunction(id: number) {
    this.preRenderCallbackFunctions.remove(id);
  }

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
      this.camera as THREE.PerspectiveCamera,
      this.container,
      this.pickableObjects,
      callback
    );
  }

  /**
   * create a new sub view to display models
   */
  addSubView() {
    this.subDiv = document.createElement("div");
    this.container.appendChild(this.subDiv);
    this.subDiv.classList.add("copper3D_sub_axes");

    const { clientWidth, clientHeight } = this.subDiv;
    this.subCamera = new THREE.PerspectiveCamera(
      50,
      clientWidth / clientHeight,
      0.1,
      10
    );
    this.subScene.add(this.subCamera);

    this.subCopperControl = new Controls(this.subCamera);
    this.subRender = new THREE.WebGLRenderer({ alpha: true });
    this.subRender.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.subRender.setSize(this.subDiv.clientWidth, this.subDiv.clientWidth);
    this.subCamera.up = this.camera.up;
    this.subDiv.appendChild(this.subRender.domElement);
    return this.subDiv;
  }

  // dicom
  loadDicom(urls: string | Array<string>, opts?: dicomLoaderOptsType) {
    let gui: GUI;
    if (opts) {
      gui = opts.gui as GUI;
    }
    if (Array.isArray(urls)) {
      const depth: number = urls.length;

      const copperVolumes: Array<copperVolumeType> = [];
      let unit8Arrays: Array<Uint8ClampedArray> = [];
      let unit16Arrays: Array<Uint16Array> = [];
      urls.forEach((url) => {
        copperDicomLoader(url, (copperVolume) => {
          copperVolumes.push(copperVolume);

          if (copperVolumes.length === depth) {
            // reorder each dicom file
            copperVolumes.sort((a: copperVolumeType, b: copperVolumeType) => {
              if (this.sort) {
                return a.order - b.order;
              } else {
                return b.order - a.order;
              }
            });
            copperVolumes.forEach((volume) => {
              unit8Arrays.push(volume.uint8);
              unit16Arrays.push(volume.uint16);
            });

            const uint8 = new Uint8ClampedArray(
              copperVolume.width * copperVolume.height * depth
            );
            const uint16 = new Uint16Array(uint8.length);
            let base8Index = 0;
            let base16Index = 0;

            unit8Arrays.forEach((array, index) => {
              base8Index = index * copperVolume.width * copperVolume.height;
              for (let i = 0; i < array.length; i++) {
                uint8[i + base8Index] = array[i];
              }
            });
            unit16Arrays.forEach((array, index) => {
              base16Index = index * copperVolume.width * copperVolume.height;
              for (let i = 0; i < array.length; i++) {
                uint16[i + base16Index] = array[i];
              }
            });

            copperVolume.uint8 = uint8;
            copperVolume.uint16 = uint16;

            finishLoad(copperVolume);
          }
        });
      });

      const finishLoad = (copperVolume: copperVolumeType) => {
        if (gui)
          gui
            .add(this as any, "depthStep")
            .min(0.01)
            .max(1)
            .step(0.01);
        const texture2d = createTexture2D_Array(
          copperVolume,
          depth,
          this.scene as THREE.Scene,
          gui
        );

        if (opts?.getMesh) {
          opts.getMesh(texture2d.mesh);
        }
        if (opts?.getCopperVolume) {
          opts.getCopperVolume(texture2d.copperVolume, texture2d.updateTexture);
        }

        let value = (texture2d.mesh.material as any).uniforms["depth"].value;

        const render_texture2d = () => {
          // if (value > depth) {
          //   value = 0;
          // }
          // eval(
          //   "value += this.depthStep;if (value > depth) {value = 0;}"
          // );

          if (opts?.setAnimation) {
            value = opts.setAnimation(
              value,
              depth,
              this.depthStep,
              copperVolume
            );
          } else {
            value += this.depthStep;
            if (value > depth || value < 0.0) {
              if (value > 1.0) value = depth * 2.0 - value;
              if (value < 0.0) value = -value;
              this.depthStep = -this.depthStep;
            }
          }

          (texture2d.mesh.material as any).uniforms["depth"].value = value;
        };
        this.addPreRenderCallbackFunction(render_texture2d);
      };
    } else {
      const url = urls;
      copperDicomLoader(url, (copperVolume) => {
        createTexture2D_Array(copperVolume, 1, this.scene as THREE.Scene);
      });
    }
  }
  //   load nrrd
  loadNrrd(
    url: string,
    loadingBar: loadingBarType,
    segmentation: boolean,
    callback?: (
      volume: any,
      nrrdMeshes: nrrdMeshesType,
      nrrdSlices: nrrdSliceType,
      gui?: GUI
    ) => void,
    opts?: optsType
  ) {
    copperNrrdLoader(url, loadingBar, segmentation, callback, opts);
  }

  loadOBJ(url: string, callback?: (mesh: THREE.Group) => void) {
    objLoader.load(
      url,
      (obj) => {
        obj.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            (child as THREE.Mesh).material = new THREE.MeshStandardMaterial({
              side: THREE.DoubleSide,
              color: 0xfff000,
            });
          }
        });
        this.scene.add(obj);
        !!callback && callback(obj);
      }, // called when loading is in progresses
      (xhr: any) => {
        console.log((xhr.loaded / xhr.total) * 100 + "% loaded");
      },
      // called when loading has errors
      (error: any) => {
        console.log("An error happened");
      }
    );
  }
}
