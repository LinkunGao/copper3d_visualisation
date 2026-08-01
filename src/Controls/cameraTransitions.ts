import type { CameraViewPreset } from './orbitFraming'

/**
 * Camera pose interpolation: the math behind flying a camera from one view
 * preset to another, orbiting it a step at a time, and zooming it.
 *
 * Deliberately dependency-free -- plain numbers and `[x, y, z]` tuples, no
 * `three` -- for two reasons. It is unit-testable with no WebGL, and a
 * consumer that has its own copy of three (a bundler that did not dedupe, or
 * an app importing three alongside a bundled build) can use it without any
 * object crossing that boundary.
 */

/** A camera pose. `target` is the look-at point -- the controls' orbit
 *  pivot, not the camera's own position. */
export interface Pose {
  position: [number, number, number]
  up: [number, number, number]
  target: [number, number, number]
}

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t))
}

export function easeInOutCubic(t: number): number {
  const x = clamp01(t)
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2
}

/** Reads a view preset as a `Pose`, so a flight's destination is built from
 *  the same data an instant `loadView` would apply. */
export function viewPointToPose(vp: CameraViewPreset): Pose {
  return {
    position: toTuple(vp.eyePosition),
    up: toTuple(vp.upVector),
    target: toTuple(vp.targetPosition),
  }
}

function toTuple(v: number[]): [number, number, number] {
  return [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0]
}

// ---- plain-tuple vector helpers (no `three`, see header) ----

type Vec3Tuple = [number, number, number]
/** Row-major 3x3: [m00,m01,m02, m10,m11,m12, m20,m21,m22]. */
type Mat3 = [number, number, number, number, number, number, number, number, number]
/** [w, x, y, z]. */
type Quat = [number, number, number, number]

const IDENTITY_QUAT: Quat = [1, 0, 0, 0]

function sub(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function add(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

function scale(v: Vec3Tuple, s: number): Vec3Tuple {
  return [v[0] * s, v[1] * s, v[2] * s]
}

function dot(a: Vec3Tuple, b: Vec3Tuple): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function cross(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

function length(v: Vec3Tuple): number {
  return Math.hypot(v[0], v[1], v[2])
}

/** Falls back to `[0, 0, 1]` for a zero-length input: there is no meaningful
 *  direction to normalize, and a fallback keeps every caller total instead of
 *  propagating NaN into a render. */
function normalize(v: Vec3Tuple): Vec3Tuple {
  const len = length(v)
  return len > 1e-9 ? scale(v, 1 / len) : [0, 0, 1]
}

function lerpScalar(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpVec3(a: Vec3Tuple, b: Vec3Tuple, t: number): Vec3Tuple {
  return [lerpScalar(a[0], b[0], t), lerpScalar(a[1], b[1], t), lerpScalar(a[2], b[2], t)]
}

/**
 * Rodrigues' rotation formula: rotates `v` by `angleRad` around `axis` (which
 * need not be pre-normalized). Unlike slerping between two vectors, this has
 * no degeneracy at any angle including a half turn -- the axis is given, not
 * derived from a dot product between vectors that might be antiparallel.
 */
export function rotateAroundAxis(v: Vec3Tuple, axis: Vec3Tuple, angleRad: number): Vec3Tuple {
  const [ax, ay, az] = normalize(axis)
  const cos = Math.cos(angleRad)
  const sin = Math.sin(angleRad)
  const d = dot(v, [ax, ay, az])
  const axisCross: Vec3Tuple = [ay * v[2] - az * v[1], az * v[0] - ax * v[2], ax * v[1] - ay * v[0]]
  return [
    v[0] * cos + axisCross[0] * sin + ax * d * (1 - cos),
    v[1] * cos + axisCross[1] * sin + ay * d * (1 - cos),
    v[2] * cos + axisCross[2] * sin + az * d * (1 - cos),
  ]
}

/** A unit vector perpendicular to `v`. Picks whichever world axis is least
 *  aligned with it, so the cross product is always well-conditioned. */
function arbitraryPerpendicular(v: Vec3Tuple): Vec3Tuple {
  const nv = normalize(v)
  const axis: Vec3Tuple = Math.abs(nv[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]
  return normalize(cross(axis, nv))
}

/**
 * A right-handed orthonormal basis from a camera's offset-from-target and its
 * (possibly only approximately perpendicular) up vector. Gram-Schmidt against
 * `dir` guarantees the result is exactly orthogonal even when hand-authored
 * preset data is not.
 */
function buildBasis(offset: Vec3Tuple, upRaw: Vec3Tuple): { right: Vec3Tuple, up: Vec3Tuple, dir: Vec3Tuple } {
  const dir = normalize(offset)
  const rightRaw = cross(upRaw, dir)
  const right = length(rightRaw) > 1e-6 ? normalize(rightRaw) : arbitraryPerpendicular(dir)
  const up = cross(dir, right)
  return { right, up, dir }
}

function basisToMatrix(right: Vec3Tuple, up: Vec3Tuple, dir: Vec3Tuple): Mat3 {
  // Columns are the basis vectors, in world coordinates.
  return [
    right[0], up[0], dir[0],
    right[1], up[1], dir[1],
    right[2], up[2], dir[2],
  ]
}

function transposeMat3(m: Mat3): Mat3 {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]
}

function multiplyMat3(a: Mat3, b: Mat3): Mat3 {
  const r = new Array(9) as number[]
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      let sum = 0
      for (let k = 0; k < 3; k++) sum += a[row * 3 + k]! * b[k * 3 + col]!
      r[row * 3 + col] = sum
    }
  }
  return r as Mat3
}

/**
 * Rotation matrix to quaternion, largest-diagonal-term method
 * (Shepperd/Shoemake). No ill-conditioned input: for a valid rotation matrix
 * at least one of `1+trace`, `1+m00-m11-m22`, `1+m11-m00-m22`,
 * `1+m22-m00-m11` is always >= 1, so some branch's divisor is bounded away
 * from zero. That is what makes it safe on the exact antipodal cases -- a
 * 180-degree roll, or two opposite view directions.
 */
function matrixToQuaternion(m: Mat3): Quat {
  const [m00, m01, m02, m10, m11, m12, m20, m21, m22] = m
  const trace = m00 + m11 + m22

  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2
    return [s / 4, (m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s]
  }
  if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2
    return [(m21 - m12) / s, s / 4, (m01 + m10) / s, (m02 + m20) / s]
  }
  if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2
    return [(m02 - m20) / s, (m01 + m10) / s, s / 4, (m12 + m21) / s]
  }
  const s = Math.sqrt(1 + m22 - m00 - m11) * 2
  return [(m10 - m01) / s, (m02 + m20) / s, (m12 + m21) / s, s / 4]
}

/** Quaternion slerp. Negates `b` on a negative dot product so the
 *  interpolation takes the shorter path (`q` and `-q` are the same rotation),
 *  and falls back to a normalized lerp where slerp's own division is
 *  ill-conditioned but visually indistinguishable. */
function slerpQuat(a: Quat, b: Quat, t: number): Quat {
  let [bw, bx, by, bz] = b
  const [aw, ax, ay, az] = a
  let cosHalfTheta = aw * bw + ax * bx + ay * by + az * bz

  if (cosHalfTheta < 0) {
    bw = -bw; bx = -bx; by = -by; bz = -bz
    cosHalfTheta = -cosHalfTheta
  }

  if (cosHalfTheta > 1 - 1e-9) {
    const lerped: Quat = [
      lerpScalar(aw, bw, t),
      lerpScalar(ax, bx, t),
      lerpScalar(ay, by, t),
      lerpScalar(az, bz, t),
    ]
    const len = Math.hypot(...lerped) || 1
    return [lerped[0] / len, lerped[1] / len, lerped[2] / len, lerped[3] / len]
  }

  const halfTheta = Math.acos(cosHalfTheta)
  const sinHalfTheta = Math.sqrt(1 - cosHalfTheta * cosHalfTheta)
  const ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta
  const ratioB = Math.sin(t * halfTheta) / sinHalfTheta
  return [
    aw * ratioA + bw * ratioB,
    ax * ratioA + bx * ratioB,
    ay * ratioA + by * ratioB,
    az * ratioA + bz * ratioB,
  ]
}

/** Rotates a vector by a unit quaternion. */
function rotateByQuaternion(v: Vec3Tuple, q: Quat): Vec3Tuple {
  const [qw, qx, qy, qz] = q
  const qv: Vec3Tuple = [qx, qy, qz]
  const t2 = scale(cross(qv, v), 2)
  const t3 = cross(qv, t2)
  return [v[0] + qw * t2[0] + t3[0], v[1] + qw * t2[1] + t3[1], v[2] + qw * t2[2] + t3[2]]
}

/**
 * Interpolates a camera between two poses. `t` is expected already eased --
 * this has no timing concerns of its own, which is what makes it testable
 * without a clock.
 *
 * The pivot lerps from one target to the other, and the camera's ORIENTATION
 * (both its direction from the pivot and its up vector) is carried by a
 * single rotation built from the two poses' full orthonormal bases -- not by
 * interpolating `dir` and `up` independently.
 *
 * That is a correctness requirement, not a style choice. Real preset data
 * routinely contains antipodal up vectors on the same view axis (two views
 * of the same volume authored from opposite conventions). A plain
 * `lerp(upFrom, upTo, t)` passes through the zero vector at t=0.5, where
 * `normalize` has no correct answer: the camera holds upside-down, then
 * snaps 180 degrees in one frame. Composing the two bases into a relative
 * rotation makes that case a well-defined 180-degree roll about the shared
 * axis -- a smooth roll through the midpoint. The same construction covers
 * two antipodal camera positions about one target.
 *
 * Reproduces `from.position` exactly at t=0 and `to.position` at t=1. `up` is
 * likewise exact WHEN each pose's own `up` is already perpendicular to its
 * own view direction; one that leans toward the view axis is silently
 * squared up, which is by design -- it is not a meaningful camera roll.
 */
export function interpolateFlightPose(from: Pose, to: Pose, t: number): Pose {
  const u = clamp01(t)
  const pivot = lerpVec3(from.target, to.target, u)

  const fromOffset = sub(from.position, from.target)
  const toOffset = sub(to.position, to.target)
  const len = lerpScalar(length(fromOffset), length(toOffset), u)

  const fromBasis = buildBasis(fromOffset, from.up)
  const toBasis = buildBasis(toOffset, to.up)
  const fromMatrix = basisToMatrix(fromBasis.right, fromBasis.up, fromBasis.dir)
  const toMatrix = basisToMatrix(toBasis.right, toBasis.up, toBasis.dir)
  // The rotation carrying the "from" frame onto the "to" frame. Both matrices
  // are orthonormal, so transpose is inverse.
  const relative = multiplyMat3(toMatrix, transposeMat3(fromMatrix))
  const stepQuat = slerpQuat(IDENTITY_QUAT, matrixToQuaternion(relative), u)

  const dir = rotateByQuaternion(fromBasis.dir, stepQuat)
  const up = rotateByQuaternion(fromBasis.up, stepQuat)

  return { position: add(pivot, scale(dir, len)), up: normalize(up), target: pivot }
}

/** The camera's orbit radius: how far `pose.position` sits from the pivot it
 *  looks at. Lets a push-in be expressed as an absolute target distance
 *  (idempotent) rather than a repeated fractional step. */
export function poseDistance(pose: Pose): number {
  return length(sub(pose.position, pose.target))
}

/**
 * Orbits the camera around its own pivot by `yawRad` about its up vector,
 * then by `pitchRad` about the RESULTING right vector. The pivot and the
 * orbit radius are both untouched, so a run of steps can never walk the
 * camera away from what it is looking at.
 *
 * Pitch about the yawed right vector, not the original: rotating about a
 * stale axis makes a diagonal (left+up) combination drift off the sphere
 * instead of tracing it.
 */
export function orbitStepPose(pose: Pose, yawRad: number, pitchRad: number): Pose {
  const offset = sub(pose.position, pose.target)
  const { right, up } = buildBasis(offset, pose.up)

  // Rotating a vector about itself is the identity, so `up` survives the yaw
  // unchanged and only the pitch has to be applied to it.
  const yawedOffset = rotateAroundAxis(offset, up, yawRad)
  const yawedRight = rotateAroundAxis(right, up, yawRad)

  return {
    position: add(pose.target, rotateAroundAxis(yawedOffset, yawedRight, pitchRad)),
    up: normalize(rotateAroundAxis(up, yawedRight, pitchRad)),
    target: pose.target,
  }
}

/**
 * Scales the camera's distance from its pivot by `factor` along the unchanged
 * view direction. Clamped at `minDistance` because a zero radius has no
 * direction to normalize -- a held zoom-in key would otherwise collapse the
 * pose into NaN one frame after reaching the pivot.
 */
export function zoomPose(pose: Pose, factor: number, minDistance = 1e-3): Pose {
  const offset = sub(pose.position, pose.target)
  const next = Math.max(minDistance, length(offset) * factor)
  return {
    position: add(pose.target, scale(normalize(offset), next)),
    up: pose.up,
    target: pose.target,
  }
}

/**
 * Swing angle for an entrance orbit. `turns` is a SWING AMPLITUDE, not a net
 * rotation: `sin(t*pi)` goes out and comes back to zero, so the camera always
 * ends exactly on the framed preset view (t=1 -> angle 0) however large
 * `turns` is. Do not "fix" this into a net rotation; that ends the intro
 * off-preset.
 */
export function orbitSwingAngle(t: number, turns: number): number {
  return Math.sin(clamp01(t) * Math.PI) * turns * Math.PI * 2
}
