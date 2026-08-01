# copper3d — Camera Framing & Transitions

Framing a camera on its content, and moving it from one pose to another. All exported from
the package entry (`copper3d`).

::: tip New in 3.8.0
Additive only. `computeFraming`, `resolveViewPose`, `resolveFarPlane`,
`Copper3dOrbitControls`, `loadView` and `loadGltf`'s own camera handling are unchanged —
call none of the below and the camera behaves exactly as it did in 3.7.x.
:::

---

## 1. `fitDistance()`

How far a perspective camera must sit from an object's centre for the whole object to fit
in frame.

```ts
fitDistance(bounds: FitBounds, aspect: number, fovDeg: number, margin?: number): number
```

| parameter | type | default | meaning |
|---|---|---|---|
| `bounds` | `FitBounds` | — | The object's axis-aligned size and centre, in scene units. |
| `aspect` | `number` | — | Viewport width / height. Zero or non-finite is treated as `1`. |
| `fovDeg` | `number` | — | The camera's **vertical** field of view, in degrees. |
| `margin` | `number` | `0.85` | Multiplier applied at the end. Smaller means larger on screen. |

### How it differs from `computeFraming`

`computeFraming` (unchanged, still used by `Copper3dOrbitControls`) uses the bounding-box
diagonal and the vertical FOV alone. `fitDistance` differs in two ways.

**It takes aspect into account.** Below aspect 1 the *horizontal* field is the narrower of
the two, and it is the narrower one that has to contain the object. A camera framed on
vertical FOV alone under-frames every tall, narrow viewport — which is what happens the
moment a viewer is split into side-by-side panels.

**It fits the bounding sphere, not the box.** Fitting the facing box face plus half the
depth frames each object by whichever dimension happens to point at the camera. A thin
slab (a mammogram volume, 33 slices) barely moves the camera and fills its panel edge to
edge, while a near-cubic MRI volume of comparable overall extent is pushed back far enough
to look half the size beside it. A sphere has no orientation, so comparable objects get
comparable screen size — and orbiting can no longer push a corner out of frame.

### About `margin`

It is deliberately **below 1**. A bounding sphere circumscribes the object — a cube's has
1.73× its half-side — so fitting the sphere exactly leaves the object filling well under
half the frame. Letting the sphere overflow a little is what makes the object itself read
at a sensible size.

This is a tuning knob, not a correctness threshold. `1.35` and `1.05` both read as too
small against real panels; `0.75` was too large, with the volume's bounding cage pressed
against the panel edges.

---

## 2. `fitView()`

Re-frames a scene on its content, keeping the view preset's direction.

```ts
// free function
fitView(
  scene: FitViewScene,
  preset: CameraViewPreset,
  aspect: number,
  bounds: FitBounds,
  margin?: number
): boolean

// or as a method
copperSceneOnDemond.fitView(preset, aspect, bounds, margin?)
```

Returns `false` when there is nothing to do: an orthographic camera (no field of view to
fit against), or a preset whose eye sits exactly on its target. **Does not render** — the
caller decides when to draw, which matters under on-demand rendering.

```ts
const { width, height } = container.getBoundingClientRect();
const [x, y, z] = volume.RASDimensions;

scene.fitView(preset, width / height, {
  width: x, height: y, depth: z,
  center: [0, 0, 0],
});
renderer.render();
```

### What it keeps and what it replaces

A view preset carries a hand-written `eyePosition`, which encodes two different things:
which way a reader should look at the data, and how far away. Only the first is a
decision. The second cannot survive a viewport a third as wide as the one it was authored
against, and hand-written values routinely leave the content filling a quarter of the
frame.

So the preset's **view direction and up vector are kept exactly as authored** — they are
often a clinical decision — and only the distance is recomputed from `fitDistance`.

### It aims at the object's centre, not the preset's target

Presets normally target the origin. That is right for an NRRD volume, whose `RASDimensions`
describe a box centred there, and wrong for a GLB whose bounding box is not: framing one of
those from the origin pushes part of it out of frame, which a narrow viewport makes
obvious. Pass the real centre in `bounds.center` — `[0, 0, 0]` for a volume makes this a
no-op.

### It syncs `controls.target`

**This is the load-bearing half.** Nothing syncs the controls' orbit pivot with
`camera.lookAt()`, so without it the user's next drag calls `controls.update()`, which
re-aims the camera at whatever `target` still held — silently undoing everything the
framing just did. `handleResize()` is called too, for the trackball variants that cache
the canvas's page box.

---

## 3. Pose interpolation — `Controls/cameraTransitions`

Pure numeric helpers for moving a camera. **Dependency-free**: plain numbers and
`[x, y, z]` tuples, no three.js objects in or out. That makes them unit-testable with no
WebGL, and usable by a consumer that has its own copy of three without anything crossing
that boundary.

```ts
interface Pose {
  position: [number, number, number];
  up: [number, number, number];
  /** The look-at point — the controls' orbit pivot, not the camera's position. */
  target: [number, number, number];
}
```

| function | signature | purpose |
|---|---|---|
| `easeInOutCubic` | `(t: number) => number` | Standard ease. Clamps out-of-range input. |
| `viewPointToPose` | `(vp: CameraViewPreset) => Pose` | Reads a view preset as a `Pose`. |
| `interpolateFlightPose` | `(from: Pose, to: Pose, t: number) => Pose` | Interpolates a camera between two poses. `t` is expected already eased. |
| `orbitStepPose` | `(pose: Pose, yawRad: number, pitchRad: number) => Pose` | Orbits around the pose's own pivot. |
| `zoomPose` | `(pose: Pose, factor: number, minDistance?: number) => Pose` | Scales the distance from the pivot. |
| `poseDistance` | `(pose: Pose) => number` | The orbit radius. |
| `rotateAroundAxis` | `(v, axis, angleRad) => [number, number, number]` | Rodrigues' rotation. |
| `orbitSwingAngle` | `(t: number, turns: number) => number` | Swing angle for an entrance orbit. |

### Why `interpolateFlightPose` uses a quaternion, not two lerps

The pivot lerps from one target to the other, and the camera's **orientation** — both its
direction from the pivot and its up vector — is carried by a single rotation built from
the two poses' full orthonormal bases. Not by interpolating `dir` and `up` independently.

That is a correctness requirement. Real preset data routinely contains **antipodal up
vectors on the same view axis** — two views of one volume authored from opposite
conventions, e.g. `up: [0,-1,0]` at eye `[0,0,2000]` and `up: [0,1,0]` at eye `[0,0,650]`.
A plain `lerp(upFrom, upTo, t)` passes through the exact zero vector at `t = 0.5`, where
`normalize` has no correct answer and falls back to an axis parallel to the view
direction: **the camera holds upside-down for the first half of the flight, then snaps 180
degrees in a single frame.**

Composing the two bases into a relative rotation and converting that matrix to a
quaternion (largest-diagonal-term method) has no such degeneracy — for a valid rotation
matrix at least one branch's divisor is bounded away from zero. The same case becomes a
well-defined 180-degree roll about the shared axis: a smooth roll through the midpoint.
The same construction also covers two antipodal camera *positions* about one target, where
a vector-pair slerp flips back and forth near `t = 1`.

`from.position` is reproduced exactly at `t = 0` and `to.position` at `t = 1`. `up` is
likewise exact **when** each pose's own `up` is already perpendicular to its own view
direction; one that leans toward the view axis is silently squared up, which is by design
— it is not a meaningful camera roll.

### `orbitStepPose` notes

The pivot and the orbit radius are both untouched, so a run of key presses can never walk
the camera away from what it is looking at. Pitch is applied about the **yawed** right
vector, not the original one — rotating about a stale axis makes a diagonal (left + up)
key combination drift off the sphere instead of tracing it.

### `orbitSwingAngle` notes

`turns` is a **swing amplitude, not a net rotation**. `sin(t·π)` goes out and comes back to
zero, so the camera always ends exactly on the framed preset view (`t = 1` → angle 0)
however large `turns` is. Do not "fix" this into a net rotation; that ends the intro
off-preset.

---

## Types

```ts
interface FitBounds {
  width: number;
  height: number;
  depth: number;
  /** The box's centre in scene units. `[0, 0, 0]` for an NRRD volume. */
  center: [number, number, number];
}
```
