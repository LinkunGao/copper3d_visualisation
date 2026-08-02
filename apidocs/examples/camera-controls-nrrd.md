# copper3d in practice: camera framing, controls, and NRRD single-slice dragging

This document records how the **breast-educational-resource** app builds its imaging viewer
on copper3d 3.9.0 — every snippet is real code running in that repo, together with **why it
is written that way**. The traps are left in place, because most of them never raise an
error; they just quietly behave wrong.

The scenario it targets: on-demand rendering + several viewers sharing one canvas + dragging
a single axial slice.

**Contents**

1. [Scenes and controls: build it right the first time](#_1-scenes-and-controls)
2. [Automatic camera framing: `fitView`](#_2-automatic-camera-framing)
3. [Moving the camera programmatically: `setCameraPose`](#_3-moving-the-camera-programmatically)
4. [Loading NRRD: extract only the slice you need](#_4-loading-nrrd)
5. [Single-slice dragging: gesture vs. camera](#_5-dragging-a-single-slice)
6. [Volume bounding box](#_6-volume-bounding-box)
7. [Disposal and a residency budget](#_7-disposal-and-a-residency-budget)
8. [Quick reference](#quick-reference)

---

## 1. Scenes and controls

### Build it right the first time

```ts
const renderer = new Copper.copperRendererOnDemond(container)

const scene = renderer.createScene(name, { controls: 'copper3d' })
if (!scene) throw new Error(`copper3d refused to create scene "${name}"`)

scene.controls.staticMoving = true                    // stop on release, no inertia
scene.controls.rotateSpeed = 3.0                      // trackball units
scene.controls.panSpeed = is3dModel ? 0.2 : 0.5
```

`{ controls: 'copper3d' }` is new in 3.9.0. Before that, `copperSceneOnDemond` hard-coded
`new OrbitControls(...)`, and the renderer's `options.controls` was only read by its sibling
class `copperScene` — **passing it raised no error and had no effect whatsoever**. Older
code had no choice but to construct the scene and then swap `scene.controls` out wholesale.

> **`rotateSpeed = 3.0` is a trackball number, not an OrbitControls one.**
> That same 3.0 is 3× the OrbitControls default, and the feel goes flying. Tuning values
> like this cannot be carried across when you change controls class.

### Why on-demand rendering needs `'copper3d'` and not `'trackball'`

`Copper3dTrackballControls`' pointer handlers **only record positions**; the camera actually
moves inside `update()`, and that is also the only place the `change` event is dispatched.
Under on-demand rendering this closes into a loop you can never enter:

> no render → no `update()` → camera does not move → no `change` dispatched → nobody
> requests a render

The viewer is completely unresponsive to the mouse — and it **throws nothing, warns nothing,
and every unit test still passes**, because the controls' internal state really is being
updated correctly. It simply never reaches the camera.

3.9.0 fixes this with `updateOnInput`, and `{ controls: 'copper3d' }` **turns that switch on
for you**. three's own `'trackball'` has no such switch: same deadlock, and you have to pump
frames yourself.

This failure mode is invisible to unit tests, so it is worth one browser-level test:

```ts
// test-browser/camera-drag.spec.ts — screenshot pixel diff, touches no library internals
const changed = await pixelChange(stage, async () => {
  await page.mouse.move(box.x + box.width * 0.35, midY)
  await page.mouse.down()
  for (let i = 1; i <= 8; i++)
    await page.mouse.move(box.x + box.width * (0.35 + 0.04 * i), midY)
  await page.mouse.up()
})
expect(changed, 'the drag did not move the camera').toBeGreaterThan(0.02)
```

### Several scenes sharing one canvas

All scenes under one renderer **share a single canvas**, and `setCurrentScene` does **not**
disable the controls of the scene it switches away from. So one drag drives the controls of
every cached scene at once, and the last one created draws last — regardless of which one is
actually on screen. Toggle them by hand on every switch:

```ts
function activateScene(renderer, next) {
  const current = renderer.getCurrentScene()
  if (current !== next) current.controls.enabled = false   // if there is one
  next.controls.enabled = true
  renderer.setCurrentScene(next)
}
```

> **Do not use `controls.dispose()` to "turn a scene off".** That path leads to
> `domElement.style.touchAction = ''`, and only `connect()` ever sets it back to `'none'`.
> Evicting one scene kills touch rotation on the whole canvas for the rest of the session.
> `enabled = false` is enough.

### Container resize

The trackball **caches** the canvas' page-relative box in `screen` and recomputes it only in
`handleResize()` — unlike OrbitControls, which measures on every event. Without that call,
every pointer position after a resize is wrong, and the model rotates about a skewed axis.

Use a `ResizeObserver` rather than `window.resize`: it is a strict superset, and it also
catches layout changes such as a collapsing panel, which fire no window resize event at all.

```ts
const ro = new ResizeObserver(() => {
  renderer.getCurrentScene().onWindowResize()   // calls handleResize() internally
  onResize?.({ width, height })                 // re-frame while we are here, see §2
})
ro.observe(host)
```

---

## 2. Automatic camera framing

### The problem

Every modality shipped with a hand-written view preset (`eyePosition` / `targetPosition` /
`upVector`). A preset encodes two things: **which direction to look from** (a clinical
judgement), and **how far away to sit** (an artefact of whatever viewport existed at the
time).

The second one does not survive. When a panel is a third of its original width, a fixed
distance is guaranteed to fall out of frame; and hand-written distances often left the
content occupying a quarter of the view.

### `fitView`

```ts
import { fitView } from 'copper3d'

function refit(aspect: number) {
  const bounds = boundsByScene.get(name)     // { width, height, depth, center }
  const preset = viewpointByScene.get(name)
  if (!bounds || !preset) return
  if (fitView(scene, preset, aspect, bounds)) renderer.render()
}
```

It **keeps** the preset's view direction and up vector, and replaces only the distance with
a computed one. Three things matter:

**① It fits the bounding sphere, not the box.** The box lets a slab-shaped volume (a 33-slice
mammogram) fill the panel while a near-cubic MRI of comparable extent is pushed back to half
the size. A sphere has no orientation, so objects of comparable volume get comparable screen
size.

**② It takes `aspect`, and uses the smaller of the horizontal and vertical half-angles.** On
a narrow panel, vertical FOV is not the binding constraint.

**③ It aims at the object's own centre, not the preset's target.** The presets all target the
origin, which is right for NRRD (`RASDimensions` describes a box centred on the origin) but
wrong for GLB — a model's bounding box can sit well away from the origin, and framing from
the origin pushes it half out of view, which shows up the moment a panel gets narrow.

`margin` defaults to 0.85 and is **deliberately below 1**: a bounding sphere circumscribes
its object, so fitting the sphere exactly means the object fills well under half the frame.
This is a tuning knob, not a correctness threshold.

**It does not render** — when to draw is the caller's decision, which matters under on-demand
rendering because this may be only one of several changes in a frame.

### When to frame

- after the content has loaded and the preset has been applied
- on every container resize (inside the `ResizeObserver` callback)
- when switching back to a cached scene

**But skip scenes the reader has posed themselves**, or a resize will steal their viewpoint:

```ts
const posedScenes = new Set<string>()   // added on the first real gesture, removed on "reset view"
if (posedScenes.has(name)) return
```

---

## 3. Moving the camera programmatically

```ts
import { setCameraPose, viewPointToPose } from 'copper3d'

scene.setCameraPose(viewPointToPose(preset))   // or setCameraPose(scene, pose)
renderer.render()
```

It is four assignments, and the fourth is the one everybody forgets:

```ts
camera.position.set(...)
camera.up.set(...)        // before lookAt — lookAt builds the camera basis from up
camera.lookAt(...)
controls.target.set(...)  // ← this line
```

Nothing anywhere in copper3d syncs the controls' orbit centre with `camera.lookAt()`. **Miss
that last line and everything looks right until the user touches the mouse**: the first drag
calls `controls.update()`, which re-aims the camera at the stale `target`, silently undoing
your move. The symptom is "the camera jumps back as soon as I drag", which points at the
controls rather than at the actual cause.

### Camera flights

When animating between two presets, the `cameraTransitions` family of pure functions is
dependency-free (just numbers and `[x,y,z]` tuples, no three):

```ts
import { easeInOutCubic, interpolateFlightPose, viewPointToPose } from 'copper3d'

const from = viewPointToPose(currentPreset)
const to = viewPointToPose(nextPreset)

run(durationMs, (t) => {
  scene.setCameraPose(interpolateFlightPose(from, to, easeInOutCubic(t)))
  renderer.render()
})
```

> **Why not just lerp `up`.** When two presets have opposite up vectors (in this project the
> mammogram is `[0,-1,0]` and the MRI `[0,1,0]`, along the same +z view axis), lerping passes
> through the zero vector at t=0.5: the camera rolls over and then snaps 180°.
> `interpolateFlightPose` goes "two orthonormal bases → relative rotation matrix → quaternion
> slerp", which has no degenerate point.

---

## 4. Loading NRRD

```ts
scene.loadNrrd(
  url,
  Copper.loading(),          // progress bar DOM
  true,                      // segmentation
  (volume, meshes, slices) => {
    scene.addObject(meshes.z)
    meshes.z.name = 'z'
    /* ... */
  },
  {
    openGui: false,
    axes: ['z'],             // ← 3.9.0
    onProgress,              // ← 3.9.0
    onError,                 // ← 3.9.0
  },
)
```

### `axes: ['z']`: extract only the slice you will show

`loadNrrd` has always extracted **all three** of x, y and z, whether you display them or not.
Each `extractSlice` call walks the whole volume, and the result is attached to
`volume.sliceList`, living as long as the volume does.

This app shows one axial slice (and `useSliceControl` raycasts against that one only). On a
50 MB MRI, the other two axes cost **two full passes over the buffer**, plus two sets of
geometry + material + canvas textures that nothing ever frees.

Previously the only option was "extract, then dispose immediately" — paying for the scans for
nothing. Now they are never built at all.

> ⚠️ Axes you did not extract are `undefined` on `meshes` / `slices`, while their types still
> declare all three (making them optional would break every existing caller's compile). If
> you narrow `axes`, read only what you asked for.

### Stall detection: do not use a fixed timeout

A 53 MB NRRD on a shared 6 Mbps network takes over a minute in the normal case. A fixed
deadline will eventually fail a perfectly healthy download. What you want is **no progress
for N seconds**:

```ts
const STALL_MS = 15_000
let stallTimer: ReturnType<typeof setTimeout>

function armStallTimer() {
  clearTimeout(stallTimer)
  stallTimer = setTimeout(() => {
    reject(new Error(`Stalled loading ${id} (no progress for ${STALL_MS}ms): ${url}`))
  }, STALL_MS)
}

function onProgress(event: ProgressEvent) {
  if (token === currentToken) {
    // total of 0 = the server sent no Content-Length (gzip / chunked). Bytes are still
    // arriving, there is just no fraction to express it with — NaN says "unknown", which
    // is more honest than freezing at the previous value (0).
    progress.value = event.total > 0 ? event.loaded / event.total : Number.NaN
  }
  armStallTimer()   // re-arm even if this load has been superseded, or it never settles
}

armStallTimer()      // start the clock before the first progress event
```

`onProgress` fires **in addition to** the built-in progress bar; the bar keeps working as
before.

> Before 3.9.0 the only liveness signal copper3d exposed was the **text** of its own progress
> bar, so this had to be done with a `MutationObserver` watching that DOM node and a regex
> digging the number out of `File: x 42 % loaded`.

### Race: a superseded load

Users kick off several loads in a row while switching modalities. Use a monotonically
increasing token:

```ts
const token = ++loadToken
// ...
if (token !== loadToken) return   // superseded by a newer load
```

Three things that are easy to miss:

- **Re-arm the stall timer unconditionally**, even for a superseded load — it still has to
  settle eventually, or the failure-path cleanup never runs.
- **Only write the `progress` ref while this is still the current load**, or late events from
  a superseded load make the progress ring bounce between two unrelated downloads.
- **A superseded load that succeeded must still finish its bookkeeping** (scene name, bounds,
  preset, budget registration). Otherwise, switching back to that modality yields a "cache
  hit but half-built" scene: no slice state, no camera preset — and `getSceneByName` short-
  circuits on it forever.

### Slice textures are not painted for you

`loadNrrd` builds the slice objects and their canvas textures, but **never paints them**.
Until something moves the slice, that plane renders pure black. Measured: after a fully
successful load, **0** of the texture canvas' 1,161,405 pixels are non-transparent.

```ts
slices.z.repaint.call(slices.z)   // .call to bind this back
```

### Exposure: patch first, then paint the first frame

The client reported that the MRIs were too dark to read. copper3d windows on the volume's own
min/max, and these MRIs' maxima are a few isolated bright points, with the tissue crowded at
the bottom of the range.

```ts
import { exposureExponent, installFastSliceRepaint } from 'copper3d'

const exposure = modality.id === 'mri' ? exposureExponent(volume) : 1

// must be awaited: the exposure LUT lives inside the patched repaint
const painted = installFastSliceRepaint(slices.z, exposure)
  .catch(() => {})                              // patch failure degrades to no lift
  .then(() => { slices.z.repaint.call(slices.z) })
```

> **The order is a hard requirement.** Painting before patching draws one dark frame and
> corrects it on the reader's first drag — exactly the colour change the client explicitly
> asked not to see. So the `painted` promise gates `resolve`, and the whole load draws its
> single frame only after it.

`exposureExponent` uses Otsu to find the foreground/background split from the shape of the
histogram itself, rather than taking a fixed percentile — which is what makes one target
produce comparable images across the whole case library. It is guaranteed **not to clip**
(`out = 255 * (in/255) ** e`, with e < 1 being a lift).

---

## 5. Dragging a single slice

On one shared canvas, two gestures compete for the same pointer: **dragging the slice** and
**orbiting the camera**.

### Gate on a raycast

```ts
function hitsSlicePlane(event: PointerEvent, el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect()
  const hit = scene.pickSpecifiedModel([sliceMesh], {
    x: event.clientX - rect.left,     // container-relative, which is what copper3d's raycast divides by
    y: event.clientY - rect.top,
  })
  return Boolean(hit.intersectedObject)
}
```

**Decide once per gesture, at pointerdown.** The old implementation re-tested on every move,
so it would change its mind halfway through a drag.

### Suppress the camera for the duration of the gesture

```ts
import { beginGesture } from 'copper3d'

let releaseCamera: (() => void) | null = null

function onPointerDown(event: PointerEvent) {
  if (!hitsSlicePlane(event, el)) return
  dragging = true
  releaseCamera = beginGesture(scene.controls)   // suppresses rotate only, by default
}

function endDrag() {
  releaseCamera?.()
  releaseCamera = null
}

// ↓ this `true` is the crux
el.addEventListener('pointerdown', onPointerDown, true)
el.addEventListener('pointermove', onPointerMove)
el.addEventListener('pointerup', endDrag)
el.addEventListener('pointercancel', endDrag)
el.addEventListener('pointerleave', onPointerLeave)
```

Three traps, each of them silent:

**① The listener must be on the capture phase.** The trackball listens on the canvas (a
descendant of `host`) during the bubble phase, and it **latches** its rotate state inside its
own `pointerdown` handler. A listener on an ancestor in the bubble phase runs after it, so
the suppression arrives a whole gesture too late — the first drag both scrolls slices and
orbits the camera.

**② On release, restore the previous value, not `true`.** This project's 2D ultrasound
modality ships with rotation disabled. Restoring unconditionally silently unlocks it, and
nothing ever locks it back. `beginGesture` records the value **before** suppressing and puts
it back verbatim on release — which is the entire reason the function exists.

**③ `pointerleave` must be wired up.** When the pointer is dragged out of the element,
`pointermove` stops immediately, so nothing clears the cursor or releases the suppression —
the viewer becomes permanently un-orbitable, stuck under a grab cursor.

Incidentally: the function `beginGesture` returns is **idempotent**, so wiring `pointerup` /
`pointercancel` / `pointerleave` all at once is safe.

### Do not compete for pointer capture

```ts
// no setPointerCapture in onPointerDown — deliberately
```

The controls call capture on the canvas during the same gesture, and **whoever captures last
wins**. Their capture still delivers move events to the canvas, and those events bubble up to
`host` anyway — so competing only loses to them, with nothing to gain.

### Drive the slice directly from drag distance

```ts
const SENSITIVITY = 0.25   // slices per pixel

function onPointerMove(event: PointerEvent) {
  if (!dragging) return
  const dy = event.clientY - lastY
  lastY = event.clientY
  target = clamp(target + dy * SENSITIVITY, max)
  scheduleIndex(target)
}
```

The old implementation stepped a fixed ±1 slice per `pointermove`, regardless of how far the
pointer actually travelled — completely decoupling the feel from the gesture.

Do not add eased following here either. It was tried: it looks smooth in isolation and feels
wrong in the hand, with the image visibly lagging the pointer — on an instrument a reader is
using to look for something. **Dragging must be direct.**

### repaint is expensive: once per frame

```ts
let pending: number | null = null
let coalesceRaf: number | null = null

function scheduleIndex(next: number) {
  pending = next
  if (coalesceRaf !== null) return
  coalesceRaf = requestAnimationFrame(() => {
    coalesceRaf = null
    if (pending === null) return
    applyIndex(pending)
    pending = null
  })
}

function applyIndex(next: number) {
  const clamped = Math.round(clamp(next, max))     // ← round
  if (clamped === current) return                  // ← no change, no paint
  current = clamped
  slice.index = clamped * slice.volume.spacing[2]  // ← world coordinate, not a slice number
  slice.repaint.call(slice)
}
```

`repaint()` re-extracts the whole plane from the volume in JS, redraws its canvas, and the
texture is re-uploaded on the next frame. On a larger MRI that is hundreds of thousands of
iterations per call — **how often you call it is the whole of drag performance**.

Three things hold it down:

- **Coalesce to once per frame.** A high-polling-rate mouse fires well over a hundred move
  events a second, and only the last one in each frame is ever visible.
- **Round the slice number.** Only whole slices exist (copper3d rounds at its entry point), so
  a fractional index pays for a full repaint to display the image already on screen. At
  `SENSITIVITY = 0.25`, 3 out of every 4 pixels are pure waste.
- **No change, no paint.**

> `slice.index` is a **world coordinate**, not a slice number. Multiply by
> `volume.spacing[2]`.

### Exactly one copy of "the current slice"

```ts
// SliceState deliberately has no index field
current = slice.raw.index / slice.raw.volume.spacing[2]
```

There used to be an `index` field: computed once at load and never written again (dragging
and "locate lesion" both change `raw.index`). So the moment you switched back to a cached
scene it was a stale copy of the truth — and both the readout and the follower started from
it. **`raw.index` is the single home of the current slice.** With only one copy, the bug is
not expressible.

### Under on-demand rendering, repaint ≠ a frame

```ts
function jumpTo(sliceNumber: number) {
  applyIndex(sliceNumber)
  scene.requestRenderIfNotRequested()   // ← without this line, nothing happens
}
```

`applyIndex` redrew the texture, but **a redraw is not a frame**. The other paths that write
the slice index happen to ride on some render source (dragging has the controls' `change`,
keyboard stepping has an animation-driven lease), but a "locate lesion" button has neither.
The symptom: clicking does nothing, until you nudge the view and it jumps to that slice.

---

## 6. Volume bounding box

```ts
import { addVolumeBoundingBox } from 'copper3d'

addVolumeBoundingBox(scene, volume.RASDimensions, { color: 0x8A7F84 })
```

It is the only thing that gives a lone slice plane any spatial reference — without it, the
plane floats in unbounded void and the reader has no idea where in the volume they have
scrolled to.

`color` defaults to white, which is the colour that reads on a **dark** viewer. This app's
stage background is light, where white lines are invisible, so it passes the design system's
own border colour.

> The old `addBoxHelper` is deprecated as of 3.9.0. Its **two-argument form is simply
> unusable**: without a third argument it boxes a module-level `cube` that
> `copperNrrdLoader` only ever declares and never assigns — i.e. `new THREE.BoxHelper(undefined)`.
> Its type is also hard-coded to `copperScene`, so `copperSceneOnDemond` cannot be passed in.

---

## 7. Disposal and a residency budget

### Cache scenes, but with a ceiling

Switching back to an already-built scene beats re-downloading 10–50 MB of volume data by a
wide margin. But decoded NRRD is a raw typed array, larger than its compressed size — the
worst pair in the catalogue (mammogram + MRI) is ~75 MB. So there has to be a byte budget:

```ts
import { createSceneBudget, defaultBudgetBytes } from 'copper3d'

const budget = createSceneBudget(defaultBudgetBytes(navigator.deviceMemory))

// after the load completes
budget.register(name, volume.data.byteLength)
budget.pin(name)                       // it is on screen
for (const victim of budget.overflow()) {
  renderer.disposeScene(victim)
  budget.release(victim)
}
```

`pin` is the **only** thing standing between a soft memory ceiling and the panel the reader
is looking at going blank. The on-screen scene must survive any budget, however small.

### `disposeScene`

```ts
import { disposeScene } from 'copper3d'
disposeScene(renderer, name)      // or renderer.disposeScene(name)
```

It unregisters the scene, disables its controls, detaches the `change` listener, calls the
scene's own `dispose()` (the only way to free the window resize listener attached at
construction), and then walks its children freeing each one's geometry / material / textures.

Before 3.8.0 there was **no exit at all** — nothing ever removed an entry from `sceneMap`, so
a long-lived renderer accumulated every scene it had ever built, decoded volumes and all.

Two things you must know:

- **`Material.dispose()` does not cascade to `material.map`.** The slice plane's canvas
  texture and a GLB's baseColor map both have to be freed separately. `disposeMaterial` walks
  the 12 texture slots used by three's built-in materials.
- **Walk `scene.children`; do not clear by name.** A list of names is guaranteed to miss
  whatever someone later adds under a different one.

### GLB cross-fade

```ts
import { collectFadeTargets, restoreFade, setFade } from 'copper3d'

const outgoing = collectFadeTargets(previousModel)
const incoming = collectFadeTargets(nextModel)

// per frame
setFade(outgoing, 1 - t)
setFade(incoming, t)

// at the end
restoreFade(incoming)
scene.scene.remove(previousModel)
disposeObject3D(previousModel)
```

Fading must **scale** opacity proportionally rather than assign it — otherwise a material
that was already semi-transparent (such as this app's 40% fat layer) ends the fade fully
opaque. `depthWrite` must also be suppressed throughout: translucent faces writing depth
punch holes in the models behind them.

---

## Quick reference

### Things that go quietly wrong

| symptom | cause |
|---|---|
| viewer completely unresponsive to the mouse | on-demand + trackball without `updateOnInput` (use `{ controls: 'copper3d' }`) |
| camera jumps back as soon as you drag | `controls.target` not synced when moving the camera (use `setCameraPose`) |
| camera orbits while dragging a slice | the `pointerdown` listener is not on the capture phase |
| a 2D view rotates when it should be locked | wrote `enableRotate` instead of `noRotate` (use `setRotateEnabled`) |
| a 2D view becomes rotatable after one slice drag | rotation restored to `true` on release instead of its previous value |
| one drag drives every cached scene | no `controls.enabled = false` on switch |
| model rotates about a skewed axis after a resize | `handleResize()` never called |
| slice plane is pure black | `loadNrrd` never paints; call `repaint.call(slice)` yourself |
| a button does nothing until you nudge the view | missing `requestRenderIfNotRequested()` under on-demand rendering |
| viewer permanently un-orbitable + grab cursor | no `pointerleave`; the pointer was dragged out |
| compressed GLB fails to load (CORS error) | draco path — use `setDracoDecoderPath('/draco/')` |
| touch rotation dies after evicting a scene | called `controls.dispose()` (shared canvas) |
| memory climbs steadily | no `disposeScene`; or `material.map` not freed separately |

### The 3.9.0 API used here

```ts
import {
  // camera
  fitView, fitDistance, setCameraPose,
  viewPointToPose, interpolateFlightPose, easeInOutCubic,
  orbitStepPose, zoomPose, poseDistance, rotateAroundAxis, orbitSwingAngle,

  // controls
  setRotateEnabled, setPanEnabled, setZoomEnabled,
  isRotateEnabled, isPanEnabled, isZoomEnabled,
  beginGesture, isGestureActive,

  // volume
  exposureExponent, installFastSliceRepaint, addVolumeBoundingBox,

  // loading
  setDracoDecoderPath, setKTX2TranscoderPath, copperGltfLoader,

  // resources
  disposeScene, removeSceneFromMap, disposeObject3D, disposeMaterial,
  createSceneBudget, defaultBudgetBytes,
  collectFadeTargets, setFade, restoreFade,
} from 'copper3d'
```

`scene.loadNrrd`'s `opts`: `{ openGui, axes, onProgress, onError }`.
`scene.loadGltf`'s third argument: `{ onProgress, onError }`.
`renderer.createScene`'s second argument: `{ controls: 'copper3d' | 'orbit' | 'trackball' }`.
