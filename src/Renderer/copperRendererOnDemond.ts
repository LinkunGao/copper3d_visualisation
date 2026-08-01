import * as THREE from "three";
import { baseRenderer } from "./baseRenderer";
import { ICopperRenderOpt, ICopperSceneOpts, SceneMapType } from "../types/types";
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

  /**
   * `opt` is per-scene and new in 3.9.0 -- `{ controls: "copper3d" }` builds
   * the scene with `Copper3dTrackballControls` instead of the default
   * `OrbitControls`. Omit it for exactly the previous behaviour.
   *
   * Deliberately a parameter rather than a read of this renderer's own
   * `options.controls`: that option has never had any effect on on-demand
   * scenes, so honouring it now would swap the controls under anyone who set
   * it and never noticed.
   */
  createScene(name: string, opt?: ICopperSceneOpts) {
    if (this.sceneMap[name] != undefined) {
      return undefined;
    } else {
      const new_scene = new copperSceneOnDemond(
        this.container,
        this.renderer,
        opt
      );
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
