/**
 * OrbitControls with medical-viewer defaults, a stable model-centre orbit pivot,
 * per-view pole refresh, and auto-framing.
 *
 * Drop-in swappable with Copper3dTrackballControls: same new X(camera, domElement)
 * signature and the same core surface (update / dispose / reset / target /
 * mouseButtons / enabled, inherited from OrbitControls), plus setPivot / frameBox /
 * applyView for the medical features.
 *
 * Seam: copperScene.render() calls controls.update() every frame, so assigning an
 * instance to copperScene.controls lets copper's own loop drive it — no extra rAF loop.
 *
 * Never drive the camera via copperScene.loadView(): it unconditionally touches
 * controls.up0, which OrbitControls does not have. applyView() replaces it.
 */
import * as THREE from 'three'
// The .js suffix is required: three@0.170 has a literal exports map and this repo uses
// moduleResolution: bundler, so the extensionless specifier fails to resolve (TS2307).
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  computeFraming,
  resolveViewPose,
  resolveFarPlane,
  isRotateGesture,
  type CameraViewPreset,
} from './orbitFraming'

/** Zoom limits as a factor of the volume's bounding-box diagonal. */
const MIN_DISTANCE_FACTOR = 0.15
const MAX_DISTANCE_FACTOR = 5

/** OrbitControls expresses its orbit pole in "+Y is up" space; matches its constructor. */
const POLE_UP = new THREE.Vector3(0, 1, 0)

export class Copper3dOrbitControls extends OrbitControls {
  private _pivot = new THREE.Vector3()
  private _dist = 600
  private _currentPreset: CameraViewPreset | null = null
  private readonly _onStart: () => void

  constructor(
    camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
    domElement: HTMLElement,
  ) {
    super(camera, domElement)

    // Damping off — medical annotation wants 1:1, release-to-stop (decision C6).
    this.enableDamping = false
    // rotateSpeed / panSpeed / zoomSpeed stay at 1.0: rotate = "drag one screen height
    // for a full turn"; pan is FOV-aware screen-exact and does not drift with zoom.
    this.screenSpacePanning = true
    // zoomToCursor stays false (C7): true feels nicer but moves target, reintroducing
    // the pivot drift this class removes.
    this.zoomToCursor = false
    // Preserve existing muscle memory: left = rotate, right = pan.
    this.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.ROTATE,
      RIGHT: THREE.MOUSE.PAN,
    }
    // iPad: one finger rotates, two fingers pinch-zoom + pan.
    this.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }

    // Re-pivot rotation onto the model centre at the start of each rotate gesture.
    // OrbitControls' pan moves target with the camera (OrbitControls.js:361), so after a
    // pan target sits off the model and a rotate would orbit that empty point. On a
    // rotate 'start' (state is already assigned by then, OrbitControls.js:1253/1289) we
    // snap target back to the stored pivot. Changing target alone does not move the
    // camera (update() recomputes the offset from the current position), so there is no
    // pop. Only rotate gestures, never pan/dolly (which would jump the model at pan start).
    this._onStart = () => {
      const state = (this as unknown as { state: number }).state
      if (isRotateGesture(state)) this.target.copy(this._pivot)
    }
    this.addEventListener('start', this._onStart)
  }

  /** The point rotation orbits; a rotate gesture snaps target back to it. */
  setPivot(pivot: THREE.Vector3): void {
    this._pivot.copy(pivot)
  }

  /**
   * Frame a bounding box: pivot = box centre, auto distance from box size and the
   * camera's fov, min/max zoom limits, then re-apply the current view so near/far are
   * recomputed for the new size. The caller supplies the box (e.g. the union of the
   * three orthogonal NRRD slice planes) so this class stays engine-agnostic.
   *
   * Perspective cameras only: auto-framing derives the distance from the vertical fov,
   * which an OrthographicCamera does not have. Rather than silently produce a NaN camera
   * position (model vanishes), we warn and skip for a non-perspective camera.
   */
  frameBox(box: THREE.Box3): void {
    if (box.isEmpty()) return
    const camera = this.object as THREE.PerspectiveCamera
    if (!camera.isPerspectiveCamera) {
      console.warn(
        'Copper3dOrbitControls.frameBox: only a PerspectiveCamera is supported; ' +
        'skipping auto-framing for a non-perspective camera.',
      )
      return
    }
    const fov = camera.fov
    const framing = computeFraming(box, fov)
    this._pivot.copy(framing.pivot)
    this._dist = framing.dist
    this.minDistance = framing.size * MIN_DISTANCE_FACTOR
    this.maxDistance = framing.size * MAX_DISTANCE_FACTOR
    // far is owned by applyView (decision D2); maxDistance is fresh now, so re-applying
    // the current view recomputes far correctly.
    if (this._currentPreset) this.applyView(this._currentPreset)
  }

  /**
   * Apply a view preset. Equivalent to copperScene.loadView but never touches up0.
   * Authoritative + idempotent: saveState() at the end makes reset() mean "back to this
   * view's initial framing".
   */
  applyView(preset: CameraViewPreset): void {
    this._currentPreset = preset
    const camera = this.object as THREE.PerspectiveCamera
    const pose = resolveViewPose(preset, this._pivot, this._dist)
    camera.near = preset.nearPlane
    camera.far = resolveFarPlane(preset.farPlane, this.maxDistance, this._dist)
    camera.position.copy(pose.position)
    camera.up.copy(pose.up)
    camera.updateProjectionMatrix()

    this.target.copy(pose.target)
    // The pole must follow this view's up or coronal rotation gimbal-locks (decision D1).
    this.refreshPole(camera.up)
    this.update()
    this.saveState()
  }

  override dispose(): void {
    this.removeEventListener('start', this._onStart)
    super.dispose()
  }

  /**
   * Rewrite OrbitControls' cached orbit-pole quaternion from the given up.
   *
   * r170 caches _quat once in the constructor from object.up and never recomputes it in
   * update() (OrbitControls.js:132 sets it; :299/:388 only consume it), so after a view
   * change the pole would be stale. Writing these private fields is acceptable: three is
   * version-pinned to 0.170.0.
   */
  private refreshPole(up: THREE.Vector3): void {
    const poled = this as unknown as {
      _quat: THREE.Quaternion
      _quatInverse: THREE.Quaternion
    }
    poled._quat.setFromUnitVectors(up, POLE_UP)
    poled._quatInverse.copy(poled._quat).invert()
  }
}
