/**
 * Pure camera-framing math for the right panel's OrbitControls.
 *
 * Deliberately free of DOM / copperScene / OrbitControls: every mistake here shows
 * up only as "rotation feels wrong" and never throws, so it must be unit-tested.
 * The wiring lives in Copper3dOrbitControls.ts.
 */
import * as THREE from 'three'

/** Shape of src/assets/nrrd_view*.json. */
export interface CameraViewPreset {
  farPlane: number
  nearPlane: number
  eyePosition: number[]
  targetPosition: number[]
  upVector: number[]
}

export interface Framing {
  /** Rotation pivot = bounding-box centre (decision C4). */
  pivot: THREE.Vector3
  /** Bounding-box diagonal length; view-independent, shared by all three presets. */
  size: number
  /** Camera-to-pivot distance (decision C5 auto-framing). */
  dist: number
}

export interface ViewPose {
  position: THREE.Vector3
  up: THREE.Vector3
  target: THREE.Vector3
}

/** Leave ~30% margin so the model does not touch the panel edge while pan/rotating. */
export const FRAMING_MARGIN = 1.3

/**
 * OrbitControls _STATE values that represent a rotate gesture (OrbitControls.js:31):
 * ROTATE = 0, TOUCH_ROTATE = 3. Excludes DOLLY / PAN and the two-finger pan gesture
 * (TOUCH_DOLLY_PAN = 5, etc.) — those must not reset the rotation pivot.
 */
const ROTATE_STATES: ReadonlySet<number> = new Set([0, 3])

/**
 * Whether this gesture is a pure rotate. Used to decide whether to snap the rotation
 * pivot back to the model centre: OrbitControls' pan moves target with the camera, so
 * after a pan target is off the model and a rotate would orbit an empty point. We snap
 * target back on rotate start, but must NOT on pan/dolly (or the model jumps at pan start).
 *
 * Picking the wrong state constant is a silent bug (rotate not re-pivoting, or pan wrongly
 * re-pivoting), so it is unit-tested.
 */
export function isRotateGesture(state: number): boolean {
  return ROTATE_STATES.has(state)
}

/** Above this |cos| between up and the view direction, up is treated as degenerate. */
const DEGENERATE_DOT = 0.999

/**
 * Bounding box -> pivot + size + framing distance.
 *
 * fovDeg is read from the camera by the caller at runtime (copper3d uses 75); it is
 * not hardcoded here.
 */
export function computeFraming(box: THREE.Box3, fovDeg: number): Framing {
  const pivot = box.getCenter(new THREE.Vector3())
  const size = box.getSize(new THREE.Vector3()).length()
  const halfFov = THREE.MathUtils.degToRad(fovDeg) / 2
  const dist = (size / 2) / Math.tan(halfFov) * FRAMING_MARGIN
  return { pivot, size, dist }
}

/**
 * Preset + pivot + distance -> camera pose.
 *
 * The preset's eyePosition is absolute; only its DIRECTION is taken here, and the
 * distance comes from C5 auto-framing (the implicit 600 in the JSON is ignored).
 *
 * up must be Gram-Schmidt-orthogonalised against the view direction (decision D1):
 * OrbitControls uses camera.up as its polar axis, and nrrd_view_coronal.json's up
 * (0,1,-1) is not perpendicular to its own view direction (0,1,0) — feeding it raw
 * gives a 45-degree-tilted pole. The old trackball path got away with it only because
 * three's lookAt() orthogonalises internally.
 */
export function resolveViewPose(
  preset: CameraViewPreset,
  pivot: THREE.Vector3,
  dist: number,
): ViewPose {
  const eye = new THREE.Vector3().fromArray(preset.eyePosition)
  const presetTarget = new THREE.Vector3().fromArray(preset.targetPosition)
  const dir = new THREE.Vector3().subVectors(eye, presetTarget).normalize()

  const upRaw = new THREE.Vector3().fromArray(preset.upVector).normalize()
  const up = orthogonalize(upRaw, dir)

  return {
    position: new THREE.Vector3().copy(pivot).addScaledVector(dir, dist),
    up,
    target: pivot.clone(),
  }
}

/**
 * Far clipping plane (decision D2).
 *
 * The preset's farPlane is 1000, but a large volume's maxDistance (= size*5) can
 * exceed it, which would clip the model when the user zooms all the way out.
 *
 * The Number.isFinite guard is required: right after construction and before the first
 * frameBox, OrbitControls' maxDistance is still the default Infinity.
 */
export function resolveFarPlane(
  presetFar: number,
  maxDistance: number,
  dist: number,
): number {
  const zoomOutFar = Number.isFinite(maxDistance) ? maxDistance + dist : 0
  return Math.max(presetFar, zoomOutFar)
}

export interface FitBounds {
  width: number
  height: number
  depth: number
  /** The box's centre in scene units. `[0, 0, 0]` for an NRRD volume, whose
   *  RAS dimensions describe a box centred on the origin; a GLB's is not,
   *  so framing one from the origin leaves part of it out of frame. Not read
   *  by `fitDistance`, which only needs the extents. */
  center: [number, number, number]
}

/** Nothing smaller than this, so a degenerate or not-yet-measured box can
 *  never put the camera at the origin looking at itself. */
const MIN_FIT_DISTANCE = 1e-3

/**
 * How far a perspective camera must sit from an object's centre for the whole
 * object to fit in frame.
 *
 * Unlike `computeFraming` above this takes the viewport's ASPECT into
 * account: below aspect 1 the horizontal field is the narrower of the two,
 * and it is the narrower one that has to contain the object. A camera framed
 * on vertical FOV alone under-frames every tall, narrow viewport.
 *
 * It also fits the bounding SPHERE rather than the box. Fitting the facing
 * box face plus half the depth frames each object by whichever dimension
 * happens to point at the camera, so a thin slab and a near-cubic volume of
 * similar overall extent come out at wildly different sizes on screen. A
 * sphere has no orientation, so comparable objects get comparable screen
 * size -- and orbiting can no longer push a corner out of frame.
 *
 * @param aspect Viewport width / height. Zero or non-finite is treated as 1:
 *               a viewport mid-collapse measures 0 for a frame, and NaN in a
 *               projection matrix is unrecoverable.
 * @param fovDeg The camera's VERTICAL field of view, in degrees.
 * @param margin Multiplier applied at the end, and deliberately BELOW 1. A
 *               bounding sphere circumscribes the object -- a cube's has
 *               1.73x its half-side -- so fitting the sphere exactly leaves
 *               the object filling well under half the frame. Letting the
 *               sphere overflow is what makes the object read at a sensible
 *               size. A tuning knob, not a correctness threshold: smaller
 *               means larger on screen.
 */
export function fitDistance(
  bounds: FitBounds,
  aspect: number,
  fovDeg: number,
  margin = 0.85,
): number {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1
  const vHalf = (fovDeg * Math.PI) / 360
  const hHalf = Math.atan(Math.tan(vHalf) * safeAspect)
  const half = Math.min(vHalf, hHalf)

  const radius = Math.hypot(bounds.width, bounds.height, bounds.depth) / 2
  return Math.max((radius / Math.sin(half)) * margin, MIN_FIT_DISTANCE)
}

/** Project up onto the plane perpendicular to dir; fall back to any perpendicular axis when degenerate. */
function orthogonalize(up: THREE.Vector3, dir: THREE.Vector3): THREE.Vector3 {
  const d = up.dot(dir)
  if (Math.abs(d) > DEGENERATE_DOT) {
    // up is nearly parallel to the view direction — subtraction would give a zero
    // vector. Pick an axis that is not parallel to dir and redo.
    const fallback = Math.abs(dir.x) > 0.9
      ? new THREE.Vector3(0, 1, 0)
      : new THREE.Vector3(1, 0, 0)
    return fallback.sub(dir.clone().multiplyScalar(fallback.dot(dir))).normalize()
  }
  return up.clone().sub(dir.clone().multiplyScalar(d)).normalize()
}
