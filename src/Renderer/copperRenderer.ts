import baseRenderer from "./baseRenderer";
import copperScene from "../Scene/copperScene";
import {
  preRenderCallbackFunctionType,
  SceneMapType,
  optType,
} from "../types/types";

export default class copperRenderer extends baseRenderer {
  private sceneMap: SceneMapType = {};

  preRenderCallbackFunctions: Array<Function> = [];

  constructor(container: HTMLDivElement, options?: optType) {
    super(container, options);
  }

  getSceneByName(name: string) {
    return this.sceneMap[name];
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
      const new_scene = new copperScene(this.container, this.renderer, alpha);
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
  animate = () => {
    this.render();
    this.stats.update();
    requestAnimationFrame(this.animate);
  };
  render() {
    this.currentScene.render();
    this.preRenderCallbackFunctions.forEach((item) => {
      item.call(null);
    });
  }
}
