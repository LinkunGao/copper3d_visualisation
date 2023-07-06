import * as THREE from "three";
import baseScene from "../Scene/baseScene";
import { customMeshType } from "../lib/three-vignette";
import { environments, environmentType } from "../lib/environment/index";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";
import Stats from "three/examples/jsm/libs/stats.module";
import { GUI, GUIController } from "dat.gui";
import {
  ICopperRenderOpt,
  stateType,
  modelVisualisationDataType,
} from "../types/types";

export default class baseRenderer {
  container: HTMLDivElement;
  renderer: THREE.WebGLRenderer;
  gui: GUI | null;
  stats: Stats;

  currentScene: baseScene;
  pmremGenerator: THREE.PMREMGenerator;

  options: ICopperRenderOpt | undefined;
  private state: stateType;

  // GUI update folder
  private visualiseFolder: GUI | null;
  private visualCtrls: Array<GUIController> = [];
  private cameraFolder: GUI | null;

  constructor(container: HTMLDivElement, options?: ICopperRenderOpt) {
    this.container = container;
    this.options = options;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: !!this.options?.alpha,
      logarithmicDepthBuffer: !!this.options?.logarithmicDepthBuffer,
    });
    if (this.options?.alpha) {
      this.setClearColor();
    }

    this.renderer.useLegacyLights = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.gui = null;
    this.stats = new Stats();
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.pmremGenerator.compileEquirectangularShader();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    if (!!this.options?.alpha) {
      this.currentScene = new baseScene(this.container, this.renderer, {
        alpha: true,
      });
    } else {
      this.currentScene = new baseScene(this.container, this.renderer, {
        alpha: false,
      });
    }

    this.currentScene.sceneName = "default";
    !!this.currentScene.vignette &&
      this.updateEnvironment(this.currentScene.vignette);
    this.state = {
      playbackSpeed: 1.0,
      wireframe: false,
      skeleton: false,
      grid: false,
      // Lights
      addLights: true,
      exposure: 1.0,
      ambientIntensity: 0.3,
      ambientColor: 0x202020,
      directIntensity: 0.8 * Math.PI,
      directColor: 0xffffff,
      bgColor1: "#5454ad",
      bgColor2: "#18e5a7",
    };
    this.visualiseFolder = null;
    this.cameraFolder = null;
    this.init();
  }
  init() {
    if (this.currentScene.sceneName === "")
      this.currentScene.sceneName = "default";
    if (this.options?.guiOpen && !this.gui) {
      this.addGui();
    }
    [].forEach.call(
      this.stats.dom.children,
      (child) => ((child as any).style.display = "")
    );
    this.container.appendChild(this.renderer.domElement);
  }
  updateEnvironment(vignette?: customMeshType) {
    const environment = environments.filter(
      (entry) => entry.name === "Venice Sunset"
    )[0];
    this.getCubeMapTexture(environment).then((envMap) => {
      const currentScene = this.getCurrentScene();
      if (envMap) {
        vignette && currentScene?.scene.add(vignette.mesh);
      }
      currentScene.scene.environment = envMap as THREE.Texture;
      currentScene.scene.background = envMap as THREE.Texture;
    });
  }
  private getCubeMapTexture(environment: environmentType) {
    const { path } = environment;
    if (!path) return Promise.resolve({ envMap: null });
    return new Promise((resolve, reject) => {
      new RGBELoader().load(
        path,
        (texture) => {
          const envMap =
            this.pmremGenerator.fromEquirectangular(texture).texture;
          this.pmremGenerator.dispose();
          resolve(envMap);
        },
        undefined,
        reject
      );
    });
  }

  getCurrentScene() {
    return this.currentScene;
  }
  hideGui() {
    this.gui && this.gui.hide();
  }
  closeGui() {
    this.gui && (this.gui.closed = true);
  }

  setClearColor(clearColor = 0x000000, alpha = 0) {
    this.renderer.setClearColor(clearColor, alpha);
  }

  addGui() {
    const gui = (this.gui = new GUI({
      width: 260,
    }));
    const modelFolder = gui.addFolder("Visualisation settings");
    const wireframeCtrl = modelFolder.add(this.state, "wireframe");
    wireframeCtrl.onChange(() => this.currentScene.updateDisplay(this.state));

    // model visualisation
    this.visualiseFolder = modelFolder.addFolder("ModelVisualisation");
    // bg
    const bgColor1Ctrl = modelFolder.addColor(this.state, "bgColor1");
    const bgColor2Ctrl = modelFolder.addColor(this.state, "bgColor2");
    bgColor1Ctrl.onChange(() =>
      this.currentScene.updateBackground(
        this.state.bgColor1,
        this.state.bgColor2
      )
    );
    bgColor2Ctrl.onChange(() =>
      this.currentScene.updateBackground(
        this.state.bgColor1,
        this.state.bgColor2
      )
    );

    // camera
    if (this.options?.cameraGui) {
      this.cameraFolder = gui.addFolder("Camera");
    }

    // Performance
    if (this.options?.performanceGui) {
      const perfFolder = gui.addFolder("Performance");
      const perfLi = document.createElement("li");
      this.stats.dom.style.position = "static";
      perfLi.appendChild(this.stats.dom);
      perfLi.style.height = "50px";
      (perfFolder as any).__ul.appendChild(perfLi);
    }

    // lights
    if (this.options?.lightGui) {
      const lightFolder = gui.addFolder("LightsFolder");
      [
        lightFolder.add(this.state, "addLights").listen(),
        lightFolder.add(this.state, "ambientIntensity", 0, 2),
        lightFolder.addColor(this.state, "ambientColor"),
        lightFolder.add(this.state, "directIntensity", 0, 4), // TODO(#116)
        lightFolder.addColor(this.state, "directColor"),
      ].forEach((ctrl) =>
        ctrl.onChange(() => this.currentScene.updateLights(this.state))
      );
    }

    // gui.add(this.state, "exportGltf");
  }

  updateGui() {
    if (this.visualCtrls.length !== 0) {
      this.visualCtrls.forEach((ctrl) => {
        this.visualiseFolder?.remove(ctrl);
      });
    }
    this.visualCtrls = [];

    let count = 0;

    const timer = setInterval(() => {
      if (this.currentScene.content.children.length > 0 || count >= 5) {
        count = 0;
        clearInterval(timer);
      }

      let flag: boolean = true;
      let modelChildrenArray: Array<modelVisualisationDataType> = [];
      const modelChildren = this.currentScene.content
        ?.children as Array<THREE.Mesh>;

      const pushChildren = (child: any) => {
        if (child.isMesh) {
          flag = false;
          const temp: modelVisualisationDataType = {
            name: child.name || "Untitled",
            visible: child.visible,
            mesh: child,
          };
          modelChildrenArray.push(temp);
        }
      };

      this.currentScene.content?.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          pushChildren(child);
        }
      });

      modelChildrenArray.forEach((item) => {
        const ctrl = (this.visualiseFolder as GUI)
          .add(item as any, "visible")
          .name(item.name)
          .onChange(() => {
            this.currentScene.updateModelChildrenVisualisation(item.mesh);
          });
        this.visualCtrls.push(ctrl);
      });

      // camera

      if (this.cameraFolder) {
        if (this.cameraFolder.__controllers.length > 0) {
          const controllers: GUIController[] = [];
          this.cameraFolder.__controllers.forEach((c) => {
            controllers.push(c);
          });
          controllers.forEach((c) => {
            this.cameraFolder?.remove(c);
          });
        }

        this.cameraFolder?.add(this.currentScene.camera as any, "near");
        this.cameraFolder?.add(this.currentScene.camera as any, "far");
        const subCameraFolders = this.cameraFolder?.__folders;
        for (let key in subCameraFolders) {
          if (Object.prototype.hasOwnProperty.call(subCameraFolders, key)) {
            const sub = subCameraFolders[key];
            this.cameraFolder?.removeFolder(sub);
          }
        }
        const position = this.cameraFolder?.addFolder("position") as GUI;
        position.add(this.currentScene.camera.position as any, "x");
        position.add(this.currentScene.camera.position as any, "y");
        position.add(this.currentScene.camera.position as any, "z");
        const up = this.cameraFolder?.addFolder("up") as GUI;
        up.add(this.currentScene.camera.up as any, "x");
        up.add(this.currentScene.camera.up as any, "y");
        up.add(this.currentScene.camera.up as any, "z");
      }
      count += 1;
    }, 3000);
  }
}
