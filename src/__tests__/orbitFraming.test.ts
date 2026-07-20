import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import {
  computeFraming,
  resolveViewPose,
  resolveFarPlane,
  isRotateGesture,
  FRAMING_MARGIN,
  type CameraViewPreset,
} from '../Controls/orbitFraming'

// Real presets (verbatim from src/assets/nrrd_view*.json)
const AXIAL: CameraViewPreset = {
  farPlane: 1000, nearPlane: 0.01,
  targetPosition: [0, 0, 0], upVector: [0, -1, 0], eyePosition: [0, 0, -600],
}
const SAGITTAL: CameraViewPreset = {
  farPlane: 1000, nearPlane: 0.01,
  targetPosition: [0, 0, 0], upVector: [0, -1, 0], eyePosition: [500, 0, 0],
}
const CORONAL: CameraViewPreset = {
  farPlane: 1000, nearPlane: 0.01,
  targetPosition: [0, 0, 0], upVector: [0, 1, -1], eyePosition: [0, 500, 0],
}

describe('computeFraming', () => {
  it('pivot is bounding-box center, not the world origin', () => {
    // Box offset from origin — the real case caused by nrrdBias (issue 3)
    const box = new THREE.Box3(
      new THREE.Vector3(10, 20, 30),
      new THREE.Vector3(110, 220, 330),
    )
    const { pivot } = computeFraming(box, 75)
    expect(pivot.x).toBeCloseTo(60)
    expect(pivot.y).toBeCloseTo(120)
    expect(pivot.z).toBeCloseTo(180)
  })

  it('size is bounding-box diagonal length', () => {
    const box = new THREE.Box3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(3, 4, 0),
    )
    const { size } = computeFraming(box, 75)
    expect(size).toBeCloseTo(5) // 3-4-5
  })

  it('dist = (size/2)/tan(fov/2) * FRAMING_MARGIN', () => {
    const box = new THREE.Box3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 100),
    )
    const { size, dist } = computeFraming(box, 75)
    expect(size).toBeCloseTo(100)
    const expected = (100 / 2) / Math.tan(THREE.MathUtils.degToRad(75) / 2) * FRAMING_MARGIN
    expect(dist).toBeCloseTo(expected)
  })

  it('dist scales linearly with size (auto-framing, decision C5)', () => {
    const small = computeFraming(
      new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 10)), 75)
    const big = computeFraming(
      new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, 100)), 75)
    expect(big.dist / small.dist).toBeCloseTo(10)
  })
})

describe('resolveViewPose', () => {
  const pivot = new THREE.Vector3(5, 6, 7)
  const dist = 200

  it('target is the pivot', () => {
    const { target } = resolveViewPose(AXIAL, pivot, dist)
    expect(target.equals(pivot)).toBe(true)
  })

  it('camera lands at pivot + preset direction * dist (ignoring the implicit 600 in the preset)', () => {
    const { position } = resolveViewPose(AXIAL, pivot, dist)
    // AXIAL: eye(0,0,-600) - target(0,0,0) => dir (0,0,-1)
    expect(position.x).toBeCloseTo(5)
    expect(position.y).toBeCloseTo(6)
    expect(position.z).toBeCloseTo(7 - 200)
  })

  it('camera-to-pivot distance is always dist, regardless of the preset\'s eyePosition magnitude', () => {
    for (const preset of [AXIAL, SAGITTAL, CORONAL]) {
      const { position } = resolveViewPose(preset, pivot, dist)
      expect(position.distanceTo(pivot)).toBeCloseTo(dist)
    }
  })

  it('up is always a unit vector', () => {
    for (const preset of [AXIAL, SAGITTAL, CORONAL]) {
      const { up } = resolveViewPose(preset, pivot, dist)
      expect(up.length()).toBeCloseTo(1)
    }
  })

  // -- Supplement D1: this is the core of this task
  it('up is orthogonal to the view direction (supplement D1)', () => {
    for (const preset of [AXIAL, SAGITTAL, CORONAL]) {
      const { position, up, target } = resolveViewPose(preset, pivot, dist)
      const dir = new THREE.Vector3().subVectors(position, target).normalize()
      expect(up.dot(dir)).toBeCloseTo(0) // polar axis must be perpendicular to the view direction
    }
  })

  it('coronal\'s non-orthogonal up (0,1,-1) is orthogonalized to (0,0,-1)', () => {
    // The original up has a 0.707 component along the view direction (0,1,0) — feeding it directly to OrbitControls
    // would give a 45° tilted polar axis. After Gram-Schmidt, we should get a clean (0,0,-1).
    const { up } = resolveViewPose(CORONAL, pivot, dist)
    expect(up.x).toBeCloseTo(0)
    expect(up.y).toBeCloseTo(0)
    expect(up.z).toBeCloseTo(-1)
  })

  it('axial / sagittal\'s already-orthogonal up is unchanged (identity transformation)', () => {
    for (const preset of [AXIAL, SAGITTAL]) {
      const { up } = resolveViewPose(preset, pivot, dist)
      expect(up.x).toBeCloseTo(0)
      expect(up.y).toBeCloseTo(-1)
      expect(up.z).toBeCloseTo(0)
    }
  })

  it('when up is nearly parallel to the view direction, fall back to a perpendicular axis, not a zero vector (degenerate protection)', () => {
    const degenerate: CameraViewPreset = {
      farPlane: 1000, nearPlane: 0.01,
      targetPosition: [0, 0, 0], upVector: [0, 0, -1], eyePosition: [0, 0, -600],
    }
    const { position, up, target } = resolveViewPose(degenerate, pivot, dist)
    expect(up.length()).toBeCloseTo(1)
    const dir = new THREE.Vector3().subVectors(position, target).normalize()
    expect(up.dot(dir)).toBeCloseTo(0)
  })

  it('is a pure function: does not mutate the input pivot', () => {
    const p = new THREE.Vector3(5, 6, 7)
    resolveViewPose(AXIAL, p, dist)
    expect(p.equals(new THREE.Vector3(5, 6, 7))).toBe(true)
  })
})

describe('resolveFarPlane', () => {
  it('when maxDistance is Infinity, fall back to the preset\'s far (the real case on first applyView)', () => {
    // After installOrbitControls and before setVolumeFraming, OrbitControls.
    // maxDistance is still the default Infinity. Without the guard, far becomes Infinity,
    // and the projection matrix breaks directly.
    expect(resolveFarPlane(1000, Infinity, 600)).toBe(1000)
  })

  it('when the zoom limit is within the preset far, use the preset far', () => {
    expect(resolveFarPlane(1000, 300, 200)).toBe(1000) // 300+200=500 < 1000
  })

  it('when the zoom limit exceeds the preset far, far follows maxDistance (supplement D2)', () => {
    // Typical data: size=300 -> maxDistance=1500. When the user zooms to the limit, if far is still
    // 1000, the model will be clipped by the far plane.
    expect(resolveFarPlane(1000, 1500, 254)).toBe(1754)
  })

  it('result is always finite', () => {
    for (const maxD of [Infinity, 0, 1500]) {
      expect(Number.isFinite(resolveFarPlane(1000, maxD, 200))).toBe(true)
    }
  })
})

describe('isRotateGesture', () => {
  // OrbitControls _STATE (OrbitControls.js:31): NONE=-1, ROTATE=0, DOLLY=1,
  // PAN=2, TOUCH_ROTATE=3, TOUCH_PAN=4, TOUCH_DOLLY_PAN=5, TOUCH_DOLLY_ROTATE=6.
  it('left mouse button rotate (ROTATE=0) counts as rotate', () => {
    expect(isRotateGesture(0)).toBe(true)
  })

  it('single-finger rotate (TOUCH_ROTATE=3) counts as rotate', () => {
    expect(isRotateGesture(3)).toBe(true)
  })

  it('pan / dolly does not count as rotate (otherwise the model would jump at the start of pan)', () => {
    expect(isRotateGesture(1)).toBe(false) // DOLLY
    expect(isRotateGesture(2)).toBe(false) // PAN
    expect(isRotateGesture(4)).toBe(false) // TOUCH_PAN
  })

  it('two-finger gesture with pan does not count as rotate', () => {
    expect(isRotateGesture(5)).toBe(false) // TOUCH_DOLLY_PAN (our touches.TWO value)
  })

  it('idle (NONE=-1) does not count as rotate', () => {
    expect(isRotateGesture(-1)).toBe(false)
  })
})
