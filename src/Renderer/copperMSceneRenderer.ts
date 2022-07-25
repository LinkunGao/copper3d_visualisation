import * as THREE from "three";
import { environments, environmentType } from "../lib/environment/index";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader";
import copperMScene from "../Scene/copperMScene";
import { positionType } from "../types/types";

export default class copperMSceneRenderer {
  numberOfScene: number;
  container: HTMLDivElement;
  elems: Array<HTMLDivElement>;
  scenes: Array<THREE.Scene>;
  cameras: Array<THREE.PerspectiveCamera>;
  renderer: THREE.WebGLRenderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
  });
  canvas: HTMLCanvasElement;
  sceneInfos: Array<copperMScene>;
  pmremGenerator: THREE.PMREMGenerator;

  constructor(
    container: HTMLDivElement,
    numberOfScene: number,
    cameraPosition?: positionType
  ) {
    this.numberOfScene = numberOfScene > 0 ? numberOfScene : 1;
    this.container = container;
    this.elems = [];
    this.scenes = [];
    this.cameras = [];
    this.sceneInfos = [];

    this.canvas = this.renderer.domElement;
    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);

    this.init();
  }

  init() {
    this.renderer.physicallyCorrectLights = true;
    this.renderer.outputEncoding = THREE.sRGBEncoding;

    this.pmremGenerator.compileEquirectangularShader();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.canvas.className = "copper3D_canvas";
    this.container.className = "copper3D_container_root";
    this.container.appendChild(this.canvas);
    for (let i = 0; i < this.numberOfScene; i++) {
      const elem = document.createElement("div");
      elem.className = "copper3D_scene_div";
      this.container.appendChild(elem);

      this.elems.push(elem);

      const newScene: copperMScene = new copperMScene(elem, this.renderer);
      this.updateEnvironment(newScene);
      this.sceneInfos.push(newScene);
    }
  }

  updateEnvironment(sceneIn: copperMScene) {
    const environment = environments.filter(
      (entry) => entry.name === "Venice Sunset"
    )[0];
    this.getCubeMapTexture(environment).then((envMap) => {
      if (envMap) {
        sceneIn.vignette && sceneIn.scene.add(sceneIn.vignette.mesh);
      }
      sceneIn.scene.environment = envMap as THREE.Texture;
      sceneIn.scene.background = envMap as THREE.Texture;
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

  renderSceneInfo = (sceneInfo: copperMScene) => {
    const elem = sceneInfo.container;

    // get the viewpoint relative position of this element
    const { left, right, top, bottom, width, height } =
      elem.getBoundingClientRect();
    const isOffscreen =
      bottom < 0 ||
      top > this.renderer.domElement.clientHeight ||
      right < 0 ||
      left > this.renderer.domElement.clientWidth;

    if (isOffscreen) {
      return;
    }
    const positiveYUpBottom = this.renderer.domElement.clientHeight - bottom;

    this.renderer.setScissor(left, positiveYUpBottom, width, height);
    this.renderer.setViewport(left, positiveYUpBottom, width, height);

    sceneInfo.render();
  };

  resizeRendererToDisplaySize = () => {
    const width = this.renderer.domElement.clientWidth;
    const height = this.renderer.domElement.clientHeight;
    const needResize =
      this.renderer.domElement.width !== width ||
      this.renderer.domElement.height !== height;
    if (needResize) {
      // to create a grid for multiple scenes
      this.elems.map((elem, index) => {
        if (index === this.numberOfScene - 1 && this.numberOfScene % 2 !== 0) {
          elem.style.width = this.container.clientWidth + "px";
        } else {
          elem.style.width = this.container.clientWidth / 2 - 2 + "px";
        }
        elem.style.height =
          this.container.clientHeight / Math.ceil(this.numberOfScene / 2) +
          "px";
      });
      this.renderer.setSize(width, height, false);
    }
  };
  animate = () => {
    const clearColor = new THREE.Color("#000");
    this.renderer.setScissorTest(false);
    this.renderer.setClearColor(clearColor, 0);
    this.renderer.clear(true, true);
    this.renderer.setScissorTest(true);
    this.resizeRendererToDisplaySize();

    this.sceneInfos.forEach((info) => {
      this.renderSceneInfo(info);
    });

    const transform = `translateY(${window.scrollY}px)`;
    this.renderer.domElement.style.transform = transform;

    window.requestAnimationFrame(this.animate);
  };
}
