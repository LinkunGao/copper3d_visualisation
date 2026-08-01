import type { Pose } from "./cameraTransitions";

/**
 * Writes a camera pose onto a scene, including the one line everybody forgets.
 *
 * Moving a camera programmatically is three obvious assignments and one
 * non-obvious one:
 *
 *   camera.position.set(...)
 *   camera.up.set(...)
 *   camera.lookAt(...)
 *   controls.target.set(...)   // <- this one
 *
 * Nothing in copper3d syncs the controls' orbit pivot with `camera.lookAt()`.
 * Leave that last line out and everything appears to work until the user
 * touches the mouse: the first drag calls `controls.update()`, which re-aims
 * the camera at whatever `target` still held, silently undoing the move. The
 * symptom -- "the camera jumps back the moment I drag" -- points at the
 * controls rather than at the code that actually caused it.
 *
 * A free function taking the scene first, so it works on a scene instance from
 * a published bundle and is unit-testable without a renderer. The scene class
 * wraps it as a one-line method.
 *
 * `fitView` does the same thing for the specific case of re-framing on
 * content; this is the general one, for a pose you already have.
 */

interface Vec3Like {
  set: (x: number, y: number, z: number) => void;
}

export interface PosableScene {
  camera: {
    position: Vec3Like;
    up: Vec3Like;
    lookAt: (x: number, y: number, z: number) => void;
    updateProjectionMatrix?: () => void;
  };
  controls?: {
    /** OrbitControls / TrackballControls' orbit pivot. */
    target?: Vec3Like;
    /** TrackballControls caches the canvas's page box and recomputes it only
     *  here; OrbitControls measures per event and does not define this. */
    handleResize?: () => void;
  };
}

/**
 * Does NOT render. The caller decides when to draw, which matters under
 * on-demand rendering where this may be one of several changes in a frame.
 */
export function setCameraPose(scene: PosableScene, pose: Pose): void {
  const [px, py, pz] = pose.position;
  const [ux, uy, uz] = pose.up;
  const [tx, ty, tz] = pose.target;

  scene.camera.position.set(px, py, pz);
  // Before `lookAt`, which builds the camera's basis from `up`. Setting it
  // afterwards leaves the roll from the previous pose in place until
  // something else re-aims the camera.
  scene.camera.up.set(ux, uy, uz);
  scene.camera.lookAt(tx, ty, tz);

  scene.controls?.target?.set(tx, ty, tz);
  scene.camera.updateProjectionMatrix?.();
  scene.controls?.handleResize?.();
}
