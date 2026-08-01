import * as THREE from "three";
import { baseRenderer } from "./baseRenderer";
import { ICopperRenderOpt, SceneMapType } from "../types/types";
import { copperSceneOnDemond } from "../Scene/copperSceneOnDemond";
import { disposeScene as disposeSceneFrom } from "./disposeScene";
import type { SceneDisposalHost } from "./disposeScene";

export class copperRendererOnDemond extends baseRenderer {
  /** Public so `disposeScene` can unregister an entry. Nothing else removes
   *  one, so a long-lived renderer otherwise accumulates every scene it has
   *  ever built, decoded volumes included. */
  sceneMap: SceneMapType = {};
  constructor(container: HTMLDivElement, options?: ICopperRenderOpt) {
    super(container, options);
  }

  getSceneByName(name: string) {
    return this.sceneMap[name];
  }

  /**
   * Unregisters a scene and frees its geometries, materials and textures.
   * Returns the scene that was disposed, or undefined if there was none.
   */
  disposeScene(name: string) {
    // `SceneMapType` predates `copperSceneOnDemond` and does not list it, so
    // its element type has no `controls`/`requestRenderIfNotRequested`. The
    // map this renderer actually fills only ever holds `copperSceneOnDemond`.
    return disposeSceneFrom(this as unknown as SceneDisposalHost, name);
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

  animate = () => {
    this.render();
    this.stats.update();
    // requestAnimationFrame(this.animate);
  };
  render() {
    this.currentScene.render();
  }
}
