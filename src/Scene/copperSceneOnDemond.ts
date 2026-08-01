import * as THREE from "three";
import { baseScene } from "./baseScene";
import { GLTF } from "three/examples/jsm/loaders/GLTFLoader";
import { copperGltfLoader } from "../Loader/copperGltfLoader";
import type { GltfLoadOpts } from "../Loader/copperGltfLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls";
import { Copper3dTrackballControls } from "../Controls/Copper3dTrackballControls";
import { CameraViewPoint } from "../Controls/copperControls";
import { fitView as fitViewOn } from "../Controls/fitView";
import type { FitViewScene } from "../Controls/fitView";
import type { FitBounds } from "../Controls/orbitFraming";
import { setCameraPose as setCameraPoseOn } from "../Controls/setCameraPose";
import type { PosableScene } from "../Controls/setCameraPose";
import type { Pose } from "../Controls/cameraTransitions";
import { ICopperSceneOpts } from "../types/types";

export class copperSceneOnDemond extends baseScene {
  controls: OrbitControls | Copper3dTrackballControls | TrackballControls;
  renderRequested: boolean | undefined = false;
  isResize: boolean = false;

  /**
   * `opt.controls` picks the controls class, as it already did on
   * `copperScene`. New in 3.9.0 -- this class hardcoded `OrbitControls`
   * before, so passing the option produced no error and no effect.
   *
   * The DEFAULT stays `OrbitControls`, which is what this class has always
   * built. It differs from `copperScene`'s default (`Copper3dTrackballControls`)
   * on purpose: changing it would silently swap the controls under every
   * existing on-demand viewer.
   *
   * Note that the renderer's own `options.controls` is deliberately NOT
   * consulted. It has never had any effect here, so honouring it now would
   * change behaviour for anyone who set it and never noticed.
   */
  constructor(
    container: HTMLDivElement,
    renderer: THREE.WebGLRenderer,
    opt?: ICopperSceneOpts
  ) {
    super(container, renderer, opt);

    if (opt?.controls === "copper3d") {
      const trackball = new Copper3dTrackballControls(
        this.camera,
        renderer.domElement
      );
      // Without this the viewer is dead to the mouse: the trackball
      // dispatches `change` only from inside `update()`, and `update()` only
      // runs inside `render()` -- which nothing schedules until a `change`
      // arrives. See `Copper3dTrackballControls.updateOnInput`.
      trackball.updateOnInput = true;
      this.controls = trackball;
    } else if (opt?.controls === "trackball") {
      // three's own TrackballControls has the same "change only from
      // update()" shape and no equivalent flag, so this combination needs the
      // caller to pump a frame from its own input listeners. Prefer
      // "copper3d" under on-demand rendering.
      this.controls = new TrackballControls(this.camera, renderer.domElement);
    } else {
      this.controls = new OrbitControls(this.camera, renderer.domElement);
    }

    this.controls.addEventListener("change", this.requestRenderIfNotRequested);
    window.addEventListener("resize", this.confirmResize, false);
    requestAnimationFrame(this.render);
  }

  loadGltf(
    url: string,
    callback?: (content: THREE.Group) => void,
    opts?: GltfLoadOpts
  ) {
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
        }

        this.content = gltf.scene;
        this.scene.add(gltf.scene);
        callback && callback(gltf.scene);
      },
      // Slots three and four, in that order. Before 3.9.0 an empty function
      // named `error` sat in the onProgress slot and there was no fourth
      // argument at all, so a failed load invoked nothing.
      opts?.onProgress,
      opts?.onError
    );
  }

  /**
   * Re-frames the camera on `bounds`, keeping the preset's view direction and
   * up and replacing only its distance. Returns false when there is nothing
   * to do -- an orthographic camera (no field of view to fit against), or a
   * preset whose eye sits exactly on its target.
   *
   * Does not render: the caller decides when to draw, which matters here
   * because this scene renders on demand.
   */
  fitView(
    preset: CameraViewPoint,
    aspect: number,
    bounds: FitBounds,
    margin?: number
  ): boolean {
    if (!(this.camera as THREE.PerspectiveCamera).isPerspectiveCamera) {
      return false;
    }
    // `controls` is a union of three classes; only some declare
    // `handleResize`, and `fitView` already treats it as optional.
    return fitViewOn(
      this as unknown as FitViewScene,
      preset,
      aspect,
      bounds,
      margin
    );
  }

  /**
   * Moves the camera to `pose` and syncs the controls' orbit pivot with it.
   * Without that last part the next drag silently undoes the move -- see
   * `Controls/setCameraPose.ts`.
   *
   * Does not render; the caller decides when to draw.
   */
  setCameraPose(pose: Pose) {
    setCameraPoseOn(this as unknown as PosableScene, pose);
  }

  confirmResize = () => {
    this.isResize = true;
    this.requestRenderIfNotRequested();
  };

  /**
   * Releases what this scene attached OUTSIDE itself.
   *
   * The `resize` listener the constructor puts on `window` used to have no
   * counterpart: every scene ever created stayed subscribed for the life of
   * the page, kept alive by the closure, and went on calling
   * `requestRenderIfNotRequested` -- and so `onWindowResize`, which resizes
   * the SHARED renderer -- long after it stopped being displayed. An app that
   * creates a scene per case leaks one of those per case.
   *
   * Does not touch the scene graph or the renderer: what a scene's contents
   * are worth keeping is the caller's decision, and the renderer is shared
   * with every other scene. `disposeScene(renderer, name)` is the one that
   * tears the contents down.
   *
   * Deliberately NOT `controls.dispose()`. That path ends in
   * `domElement.style.touchAction = ""`, and every scene here shares one
   * canvas -- only `connect()` sets it back to `"none"`. Disposing one
   * scene's controls would kill touch rotation on the canvas for the rest of
   * the session. Disabling them is enough.
   *
   * Safe to call twice.
   */
  dispose() {
    window.removeEventListener("resize", this.confirmResize);
    this.controls.enabled = false;
    this.controls.removeEventListener(
      "change",
      this.requestRenderIfNotRequested
    );
    // Nothing in flight can arrive after this: `render` clears the flag, and
    // an already-scheduled frame only draws.
    this.renderRequested = false;
  }

  render = () => {
    this.renderRequested = undefined;

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  requestRenderIfNotRequested = () => {
    if (!this.renderRequested) {
      if (this.isResize) {
        this.isResize = false;
        this.onWindowResize();
      }
      this.renderRequested = true;
      requestAnimationFrame(this.render);
    }
  };
}
