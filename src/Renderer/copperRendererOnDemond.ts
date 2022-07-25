import * as THREE from "three";
import baseRenderer from "./baseRenderer";
import copperScene from "../Scene/copperScene";
import { optType, SceneMapType } from "../types/types";
import copperSceneOnDemond from "../Scene/copperSceneOnDemond";

export default class copperRendererOnDemond extends baseRenderer {
  private sceneMap: SceneMapType = {};
  constructor(container: HTMLDivElement, options?: optType) {
    super(container, options);
  }

  getSceneByName(name: string) {
    return this.sceneMap[name];
  }

  setCurrentScene(sceneIn: copperSceneOnDemond) {
    if (sceneIn) {
      this.currentScene = sceneIn;
      if (this.options?.guiOpen) {
        this.updateGui();
      }
    }
  }

  createScene(name: string) {
    if (this.sceneMap[name] != undefined) {
      return undefined;
    } else {
      const new_scene = new copperSceneOnDemond(this.container, this.renderer);
      new_scene.sceneName = name;
      this.updateEnvironment(new_scene.vignette);
      this.sceneMap[name] = new_scene;
      return new_scene;
    }
  }

  // addGui(): void {
  //   console.log("hello");
  // }

  animate = () => {
    this.render();
    this.stats.update();
    // requestAnimationFrame(this.animate);
  };
  render() {
    this.currentScene.render();
  }
}
