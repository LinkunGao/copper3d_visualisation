import { describe, expect, it } from 'vitest'
import type { CameraViewPreset } from '../Controls/orbitFraming'
import {
  easeInOutCubic,
  interpolateFlightPose,
  orbitStepPose,
  orbitSwingAngle,
  poseDistance,
  rotateAroundAxis,
  viewPointToPose,
  zoomPose,
} from '../Controls/cameraTransitions'
import type { Pose } from '../Controls/cameraTransitions'

describe('easeInOutCubic', () => {
  it('is pinned at both ends', () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
  })

  it('passes through the midpoint', () => {
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 5)
  })

  it('is monotonically increasing', () => {
    let prev = -1
    for (let t = 0; t <= 1; t += 0.05) {
      const v = easeInOutCubic(t)
      expect(v).toBeGreaterThan(prev)
      prev = v
    }
  })

  it('clamps out-of-range input', () => {
    expect(easeInOutCubic(-1)).toBe(0)
    expect(easeInOutCubic(2)).toBe(1)
  })
})

/** Endpoints, monotonicity, and that a flight actually reaches the target
 *  pose -- all reachable without WebGL, because this is numeric tuples in and
 *  numeric tuples out. */
describe('interpolateFlightPose', () => {
  const from: Pose = { position: [0, 0, 10], up: [0, 1, 0], target: [0, 0, 0] }
  const to: Pose = { position: [10, 0, 0], up: [0, 1, 0], target: [0, 0, 0] }

  it('reproduces the starting pose exactly at t=0', () => {
    const pose = interpolateFlightPose(from, to, 0)
    expect(pose.position[0]).toBeCloseTo(from.position[0], 5)
    expect(pose.position[1]).toBeCloseTo(from.position[1], 5)
    expect(pose.position[2]).toBeCloseTo(from.position[2], 5)
    expect(pose.target).toEqual(from.target)
  })

  it('reaches the target pose exactly at t=1', () => {
    const pose = interpolateFlightPose(from, to, 1)
    expect(pose.position[0]).toBeCloseTo(to.position[0], 5)
    expect(pose.position[1]).toBeCloseTo(to.position[1], 5)
    expect(pose.position[2]).toBeCloseTo(to.position[2], 5)
    expect(pose.target).toEqual(to.target)
  })

  it('clamps out-of-range t to the nearest endpoint', () => {
    expect(interpolateFlightPose(from, to, -1)).toEqual(interpolateFlightPose(from, to, 0))
    expect(interpolateFlightPose(from, to, 2)).toEqual(interpolateFlightPose(from, to, 1))
  })

  it('arcs rather than cutting a straight line through the pivot: the mid-flight distance from the pivot never collapses toward zero', () => {
    // Both endpoints sit at distance 10 from the shared target/pivot. A
    // straight-line lerp between them would swing close to the pivot at
    // t=0.5 (chord length ~14, but passing near the centre for two
    // perpendicular points); the arc, by contrast, holds a near-constant
    // radius throughout.
    for (let t = 0; t <= 1; t += 0.1) {
      const pose = interpolateFlightPose(from, to, t)
      const dx = pose.position[0] - pose.target[0]
      const dy = pose.position[1] - pose.target[1]
      const dz = pose.position[2] - pose.target[2]
      const radius = Math.sqrt(dx * dx + dy * dy + dz * dz)
      expect(radius).toBeCloseTo(10, 1)
    }
  })

  it('interpolates a moving look-target linearly, so the pivot itself lerps from one target to the other', () => {
    const movingTo: Pose = { position: [10, 0, 0], up: [0, 1, 0], target: [4, 0, 0] }
    const pose = interpolateFlightPose(from, movingTo, 0.5)
    expect(pose.target[0]).toBeCloseTo(2, 5)
    expect(pose.target[1]).toBeCloseTo(0, 5)
    expect(pose.target[2]).toBeCloseTo(0, 5)
  })

  it('always returns a normalized up vector', () => {
    const tiltedFrom: Pose = { position: [0, 0, 10], up: [0, 2, 0], target: [0, 0, 0] }
    const tiltedTo: Pose = { position: [10, 0, 0], up: [1, 1, 0], target: [0, 0, 0] }
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const pose = interpolateFlightPose(tiltedFrom, tiltedTo, t)
      const len = Math.hypot(...pose.up)
      expect(len).toBeCloseTo(1, 5)
    }
  })

  // Real preset data routinely ships antipodal up vectors on the same view
  // axis. The pair below is a mammogram/MRI preset pair for one volume:
  // `up: [0,-1,0]` at eye [0,0,2000] and `up: [0,1,0]` at eye [0,0,650].
  // `normalize(lerp(upFrom, upTo, t))` passes through the exact zero vector
  // at t=0.5 (reachable -- easeInOutCubic(0.5) is exactly 0.5) and falls back
  // to an axis parallel to the view direction: the model holds upside-down
  // for the first half of the flight, then snaps 180 degrees in one frame.
  it('rolls smoothly through a 180-degree up-vector flip, never degenerating at the midpoint', () => {
    const mammogram: Pose = { position: [0, 0, 2000], up: [0, -1, 0], target: [0, 0, 0] }
    const mri: Pose = { position: [0, 0, 650], up: [0, 1, 0], target: [0, 0, 0] }

    const samples = [0, 0.25, 0.5, 0.75, 1].map(t => interpolateFlightPose(mammogram, mri, t))

    // Endpoints reproduce the real preset ups exactly.
    expect(samples[0]!.up).toEqual([0, -1, 0])
    expect(samples[4]!.up).toEqual([0, 1, 0])

    // At every sampled t, `up` is a genuine unit vector -- specifically NOT
    // the [0,0,1] degenerate fallback (parallel to the shared view axis,
    // the exact failure mode a collapsing lerp hits at t=0.5).
    for (const pose of samples) {
      expect(Math.hypot(...pose.up)).toBeCloseTo(1, 6)
      expect(pose.up[2]).toBeCloseTo(0, 6) // never tips toward the view axis
    }

    // The roll is monotonic and smooth: this pair rolls 180 degrees about the
    // shared +z view axis, so `up.y` is the cosine of the roll angle at each
    // step. No back-and-forth, no jump.
    expect(samples[0]!.up[1]).toBeCloseTo(-1, 5)
    expect(samples[1]!.up[1]).toBeCloseTo(-0.70710678, 5)
    expect(samples[2]!.up[1]).toBeCloseTo(0, 5)
    expect(samples[3]!.up[1]).toBeCloseTo(0.70710678, 5)
    expect(samples[4]!.up[1]).toBeCloseTo(1, 5)
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]!.up[1]).toBeGreaterThan(samples[i - 1]!.up[1])
    }

    // The view direction itself doesn't change for this pair (both look
    // straight down +z, only distance and roll differ) -- it must not be
    // disturbed by the up-vector roll.
    for (const pose of samples) {
      const dx = pose.position[0] - pose.target[0]
      const dy = pose.position[1] - pose.target[1]
      expect(dx).toBeCloseTo(0, 5)
      expect(dy).toBeCloseTo(0, 5)
    }
  })

  // The same degeneracy hits the POSITION side when two camera directions
  // about one target are antipodal: a vector-pair slerp flips back and forth
  // near t=1 instead of moving smoothly. The up vectors disambiguate the
  // rotation axis, so a basis-derived rotation gives a clean half-turn.
  it('moves smoothly between antipodal camera positions instead of flipping back and forth', () => {
    const from: Pose = { position: [0, 0, 10], up: [0, 1, 0], target: [0, 0, 0] }
    const to: Pose = { position: [0, 0, -10], up: [0, 1, 0], target: [0, 0, 0] }

    const samples = [0, 0.25, 0.5, 0.75, 0.9, 0.999, 1].map(t => interpolateFlightPose(from, to, t))

    // z must move monotonically from +10 to -10 -- no reversal anywhere,
    // and specifically not the old code's back-and-forth pattern near t=1.
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]!.position[2]).toBeLessThan(samples[i - 1]!.position[2])
    }
    expect(samples[0]!.position[2]).toBeCloseTo(10, 5)
    expect(samples[samples.length - 1]!.position[2]).toBeCloseTo(-10, 5)

    // The radius from the target stays ~10 throughout (a rotation, not a
    // path through the origin).
    for (const pose of samples) {
      const radius = Math.hypot(...pose.position.map((v, i) => v - pose.target[i]!) as [number, number, number])
      expect(radius).toBeCloseTo(10, 4)
    }
  })
})

describe('orbitSwingAngle', () => {
  it('starts at zero net rotation', () => {
    expect(orbitSwingAngle(0, 0.6)).toBeCloseTo(0, 10)
  })

  it('ends back at zero net rotation, regardless of the swing amplitude', () => {
    expect(orbitSwingAngle(1, 0.6)).toBeCloseTo(0, 5)
  })

  it('peaks at the midpoint at the full swing amplitude, not a net orbit', () => {
    // turns=0.6 is how far the camera swings out and back, not a net
    // 0.6-turn rotation -- the peak angle equals `turns` full circles.
    expect(orbitSwingAngle(0.5, 0.6)).toBeCloseTo(0.6 * Math.PI * 2, 5)
  })

  it('is symmetric around the midpoint', () => {
    expect(orbitSwingAngle(0.3, 0.6)).toBeCloseTo(orbitSwingAngle(0.7, 0.6), 5)
  })
})

describe('rotateAroundAxis', () => {
  it('leaves a vector unchanged at angle 0', () => {
    const v = rotateAroundAxis([1, 0, 0], [0, 1, 0], 0)
    expect(v[0]).toBeCloseTo(1, 5)
    expect(v[1]).toBeCloseTo(0, 5)
    expect(v[2]).toBeCloseTo(0, 5)
  })

  it('rotates a vector 90 degrees around the Y axis into the expected quadrant', () => {
    const [x, y, z] = rotateAroundAxis([1, 0, 0], [0, 1, 0], Math.PI / 2)
    expect(x).toBeCloseTo(0, 5)
    expect(y).toBeCloseTo(0, 5)
    expect(z).toBeCloseTo(-1, 5)
  })

  it('preserves vector length (a rotation is not a scale)', () => {
    const v = rotateAroundAxis([3, 4, 0], [0, 0, 1], 1.2345)
    expect(Math.hypot(...v)).toBeCloseTo(5, 5)
  })

  it('returns to the start after a full 360 degree turn', () => {
    const v = rotateAroundAxis([1, 2, 3], [0, 1, 0], Math.PI * 2)
    expect(v[0]).toBeCloseTo(1, 4)
    expect(v[1]).toBeCloseTo(2, 4)
    expect(v[2]).toBeCloseTo(3, 4)
  })
})

describe('viewPointToPose', () => {
  it('maps the view-preset field names onto the Pose shape verbatim', () => {
    const vp: CameraViewPreset = {
      farPlane: 1000,
      nearPlane: 0.01,
      eyePosition: [1, 2, 3],
      targetPosition: [4, 5, 6],
      upVector: [0, 1, 0],
    }
    expect(viewPointToPose(vp)).toEqual({
      position: [1, 2, 3],
      up: [0, 1, 0],
      target: [4, 5, 6],
    })
  })
})

describe('poseDistance', () => {
  it('measures the orbit radius from the pivot, not from the world origin', () => {
    // A camera 5 units out from a pivot that is itself nowhere near the
    // origin: measuring from (0,0,0) would report 13, not 5.
    const pose: Pose = { position: [12, 0, 5], up: [0, 1, 0], target: [12, 0, 0] }
    expect(poseDistance(pose)).toBeCloseTo(5, 10)
  })
})

describe('zoomPose', () => {
  const pose: Pose = { position: [0, 0, 10], up: [0, 1, 0], target: [0, 0, 0] }

  it('scales the distance from the pivot and leaves the view direction alone', () => {
    const closer = zoomPose(pose, 0.5)
    expect(poseDistance(closer)).toBeCloseTo(5, 10)
    expect(closer.position[0]).toBeCloseTo(0, 10)
    expect(closer.position[2]).toBeCloseTo(5, 10)
    expect(closer.target).toEqual([0, 0, 0])
  })

  it('keeps the pivot fixed when the pivot is not the origin', () => {
    const offCentre: Pose = { position: [4, 0, 0], up: [0, 1, 0], target: [2, 0, 0] }
    const closer = zoomPose(offCentre, 0.5)
    expect(closer.position[0]).toBeCloseTo(3, 10) // 2 + 2*0.5, not 4*0.5
    expect(closer.target).toEqual([2, 0, 0])
  })

  // A held `-` key applies this dozens of times. Without the floor the
  // radius reaches 0, `normalize` has no direction left to return, and the
  // next frame writes a pose built from an arbitrary fallback axis.
  it('never collapses the orbit radius to zero, however many times it is applied', () => {
    let p = pose
    for (let i = 0; i < 500; i++) p = zoomPose(p, 0.5)
    expect(poseDistance(p)).toBeGreaterThan(0)
    expect(Number.isFinite(p.position[2])).toBe(true)
  })
})

describe('orbitStepPose', () => {
  const pose: Pose = { position: [0, 0, 10], up: [0, 1, 0], target: [0, 0, 0] }

  it('yaws around the up axis without changing the orbit radius', () => {
    const stepped = orbitStepPose(pose, Math.PI / 2, 0)
    expect(poseDistance(stepped)).toBeCloseTo(10, 8)
    expect(stepped.position[1]).toBeCloseTo(0, 8)
    expect(Math.abs(stepped.position[0])).toBeCloseTo(10, 8)
    expect(stepped.position[2]).toBeCloseTo(0, 8)
  })

  it('pitches out of the horizontal plane without changing the orbit radius', () => {
    const stepped = orbitStepPose(pose, 0, Math.PI / 6)
    expect(poseDistance(stepped)).toBeCloseTo(10, 8)
    expect(Math.abs(stepped.position[1])).toBeCloseTo(10 * Math.sin(Math.PI / 6), 8)
  })

  it('leaves the pivot alone, so a run of key presses cannot walk the camera off its subject', () => {
    const offCentre: Pose = { position: [7, 1, 3], up: [0, 1, 0], target: [7, 1, -4] }
    let p = offCentre
    for (let i = 0; i < 24; i++) p = orbitStepPose(p, Math.PI / 12, Math.PI / 48)
    expect(p.target).toEqual([7, 1, -4])
    expect(poseDistance(p)).toBeCloseTo(poseDistance(offCentre), 6)
  })

  // The pitch axis has to be the YAWED right vector. Pitching about the
  // original one lets a diagonal step leave the sphere: the radius drifts.
  it('pitches about the yawed right vector, so a diagonal step stays on the sphere', () => {
    const stepped = orbitStepPose(pose, Math.PI / 3, Math.PI / 3)
    expect(poseDistance(stepped)).toBeCloseTo(10, 8)
  })

  it('keeps up perpendicular to the view direction', () => {
    const stepped = orbitStepPose(pose, 0.7, -0.4)
    const dir = [
      stepped.position[0] - stepped.target[0],
      stepped.position[1] - stepped.target[1],
      stepped.position[2] - stepped.target[2],
    ]
    const dot = dir[0]! * stepped.up[0] + dir[1]! * stepped.up[1] + dir[2]! * stepped.up[2]
    expect(dot).toBeCloseTo(0, 8)
  })

  it('is a no-op for a zero step', () => {
    const stepped = orbitStepPose(pose, 0, 0)
    expect(stepped.position[0]).toBeCloseTo(0, 10)
    expect(stepped.position[2]).toBeCloseTo(10, 10)
  })
})
