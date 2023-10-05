import { baseRenderer } from "./baseRenderer";
import { copperScene } from "../Scene/copperScene";
import {
  preRenderCallbackFunctionType,
  SceneMapType,
  ICopperRenderOpt,
} from "../types/types";
import * as THREE from "three";

export class copperRenderer extends baseRenderer {
  private sceneMap: SceneMapType = {};
  private fps: number = 30;
  private renderClock: THREE.Clock = new THREE.Clock();
  private delta: number = 0;
  private interval: number = 1 / this.fps;

  preRenderCallbackFunctions: Array<Function> = [];

  constructor(container: HTMLDivElement, options?: ICopperRenderOpt) {
    super(container, options);
  }

  getSceneByName(name: string) {
    return this.sceneMap[name];
  }

  setFPS(fps: number) {
    this.fps = fps;
  }

  setCurrentScene(sceneIn: copperScene) {
    if (sceneIn) {
      this.currentScene = sceneIn;
      if (this.options?.guiOpen) {
        this.updateGui();
      }
      this.onWindowResize();
    }
  }

  createScene(name: string) {
    if (this.sceneMap[name] != undefined) {
      return undefined;
    } else {
      const alpha = !!this.options?.alpha;
      const new_scene = new copperScene(this.container, this.renderer, {
        camera: this.options?.cameraType,
        controls: this.options?.controls,
        alpha: alpha,
      });
      new_scene.sceneName = name;
      this.updateEnvironment(new_scene.vignette);
      this.sceneMap[name] = new_scene;
      return new_scene;
    }
  }

  addPreRenderCallbackFunction(callbackFunction: Function) {
    this.preRenderCallbackFunctions.push(callbackFunction);
  }

  onWindowResize() {}

  animate = (time?: number) => {
    switch (this.options?.fpsMode) {
      case "1":
        // fpsControl one: 30fps
        setTimeout(() => {
          requestAnimationFrame(this.animate);
        }, 1000 / this.fps);
        this.render();
        if (this.options?.performanceGui) this.stats.update();
        break;
      default:
        // fpsControl two: 30fps
        requestAnimationFrame(this.animate);
        if (this.delta === 0) {
          this.render();
        }
        this.delta += this.renderClock.getDelta();
        if (this.delta > this.interval) {
          this.render();
          if (this.options?.performanceGui) this.stats.update();
          this.delta = this.delta % this.interval;
        }
    }
  };

  render() {
    this.currentScene.render();
    this.preRenderCallbackFunctions.forEach((item) => {
      item.call(null);
    });
  }
}
