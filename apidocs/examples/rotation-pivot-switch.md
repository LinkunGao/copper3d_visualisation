# Switching rotation behaviour after a pan

A drop-in helper that lets one viewer switch between the three things a rotate
gesture can do once the reader has panned — plus what each one actually looks like,
so you can tell them apart.

Background and the maths: [Rotation Pivot & Panning](/guide/rotation-pivot).

---

## Nothing is on by default

`Copper3dTrackballControls` ships with `rotationPivot = null`, which is the stock
trackball behaviour: **a pan drags the orbit pivot along with it**, so the next
rotate swings the content through an arc around wherever the pan finished. That is
the default in every version, 3.10.0 included. Both fixes below are opt-in.

It is also worth being precise that there are **three** behaviours here, not two —
`null` is not the same as "recentre":

| mode | how you get it | rotate orbits | a pan the reader made |
|---|---|---|---|
| `orbit-target` | do nothing (the default) | the panned `target` | kept, but the axis is wrong |
| `recentre` | snap `target` on rotate start | content's centre | **discarded** when rotation starts |
| `keep-pan` | `controls.rotationPivot = centre` | content's centre | **kept** |

`recentre` is what `Copper3dOrbitControls` has always done, and what you have to
fall back to on 3.9.x and earlier.

## The helper

```ts
import * as THREE from "three";
import * as Copper from "copper3d";

export type RotationMode = "orbit-target" | "recentre" | "keep-pan";

export interface RotationModeHandle {
  set(mode: RotationMode): void;
  /** The content's centre, in WORLD space. Call again whenever the content
   *  changes; `null` disables both fixes regardless of the mode. */
  setPivot(pivot: THREE.Vector3 | null): void;
  current(): RotationMode;
  dispose(): void;
}

export function attachRotationMode(
  controls: Copper.Copper3dTrackballControls,
  container: HTMLElement,
  initial: RotationMode = "keep-pan",
): RotationModeHandle {
  // `rotationPivot` is a plain field initialised in the constructor, so `in`
  // separates 3.10.0+ from every earlier build.
  const supportsPivot = "rotationPivot" in controls;

  let mode: RotationMode = initial;
  let pivot: THREE.Vector3 | null = null;
  let snapping = false;

  const onPointerDownCapture = (event: PointerEvent) => {
    if (!pivot || !isRotateGesture(controls, event)) return;
    controls.target.copy(pivot);
  };

  function snap(on: boolean) {
    if (on === snapping) return;
    snapping = on;
    // CAPTURE phase, and it is load-bearing: the trackball listens on the canvas
    // below in the bubble phase and latches its gesture state inside its own
    // pointerdown handler, so a bubble-phase listener here lands a whole gesture
    // too late — the first drag would rotate about the stale pivot anyway.
    if (on) container.addEventListener("pointerdown", onPointerDownCapture, true);
    else container.removeEventListener("pointerdown", onPointerDownCapture, true);
  }

  function apply() {
    const effective = mode === "keep-pan" && !supportsPivot ? "recentre" : mode;
    if (supportsPivot) {
      controls.rotationPivot = effective === "keep-pan" ? pivot : null;
    }
    // Never both at once: the snap would throw away the very offset the pivot is
    // there to preserve.
    snap(effective === "recentre" && pivot !== null);
  }

  apply();

  return {
    set(next) { mode = next; apply(); },
    setPivot(next) { pivot = next; apply(); },
    current() { return mode; },
    dispose() {
      snap(false);
      if (supportsPivot) controls.rotationPivot = null;
    },
  };
}

/** Reads the gesture's intent off the controls' own button map rather than
 *  assuming left = rotate, so remapping the buttons cannot leave this
 *  re-pivoting on a pan. */
function isRotateGesture(
  controls: Copper.Copper3dTrackballControls,
  event: PointerEvent,
): boolean {
  // Touch: the first finger rotates. A second finger is never `isPrimary` and
  // turns the gesture into zoom/pan, which must not re-pivot.
  if (event.pointerType === "touch") return event.isPrimary;
  const { LEFT, MIDDLE, RIGHT } = controls.mouseButtons;
  const intent =
    event.button === 0 ? LEFT
    : event.button === 1 ? MIDDLE
    : event.button === 2 ? RIGHT
    : -1;
  return intent === THREE.MOUSE.ROTATE;
}
```

::: tip Building against the published 3.9.0 typings?
`rotationPivot` is not in them yet, so the two assignments need a cast:

```ts
const pivotable = controls as unknown as { rotationPivot?: THREE.Vector3 | null };
```

The `supportsPivot` check already handles the runtime side, so the same file works
against both builds.
:::

## Wiring it up

```ts
const scene = renderer.createScene("case-1", { controls: "copper3d" });
const controls = scene.controls as Copper.Copper3dTrackballControls;

const rotation = attachRotationMode(controls, container, "keep-pan");
```

Give it a pivot once the content exists, measured from the objects themselves:

```ts
scene.loadNrrd(url, Copper.loading(), true, (volume, meshes) => {
  scene.addObject(meshes.x);
  scene.addObject(meshes.y);
  scene.addObject(meshes.z);

  // The union of the three orthogonal planes is the volume box. Measured, not
  // assumed to be the origin: the planes carry the volume's own offset.
  const box = new THREE.Box3()
    .expandByObject(meshes.x)
    .expandByObject(meshes.y)
    .expandByObject(meshes.z);

  rotation.setPivot(box.getCenter(new THREE.Vector3()));
});
```

And switch it at runtime from whatever UI you like:

```ts
modeSelect.addEventListener("change", () => {
  rotation.set(modeSelect.value as RotationMode);
});
```

### Re-run `setPivot` when the content changes

Nothing invalidates the pivot for you. Call it again on a new case, a new volume,
or anything that moves the content in world space — a stale pivot rotates about
where the *previous* case used to be, which looks exactly like the bug this fixes.

`fitView` and `setCameraPose` need no coordination: both write `controls.target`
aimed at the content's centre, so after a re-frame or a "reset view" the target and
the pivot coincide again and the pan offset is genuinely zero. Derive the pivot from
the same box you pass to `fitView` as `bounds.center` and the two agree by
construction.

## If you only ever need two of them

A whole switchable handle is overkill when the viewer has one intended behaviour
and you just want to compare during development. One constant and two call sites
does it:

```ts
/** Both modes make rotation orbit the content's centre; they differ only in what
 *  becomes of the pan. Flip to compare. */
const ROTATE_AFTER_PAN: "keep-pan" | "recentre" = "keep-pan";

const usingPivot =
  ROTATE_AFTER_PAN === "keep-pan" && "rotationPivot" in controls;

// after the content loads
controls.rotationPivot = usingPivot ? centre : null;

container.addEventListener("pointerdown", (event) => {
  if (usingPivot) return;                       // the controls handle it
  if (!isRotateGesture(controls, event)) return;
  controls.target.copy(centre);
}, true);
```

## Telling them apart

Every one of these renders a plausible picture, so "it looks fine" proves nothing.
The gesture that separates them:

1. Pan the content well off centre — into a corner of the viewport.
2. Without releasing anything else, drag to rotate.

| what you see | mode you are in |
|---|---|
| content swings away on a wide arc, possibly out of frame | `orbit-target` |
| content snaps back to the middle, then turns on the spot | `recentre` |
| content stays in the corner and turns on the spot | `keep-pan` |

The further you pan in step 1, the more obvious the difference. A pan of a few
pixels tells you nothing.

For an automated check, assert the invariants rather than pixels:
`camera.position.distanceTo(pivot)` and `controls.target.distanceTo(pivot)` are both
unchanged across a rotate in `keep-pan`, and `controls.target` has moved. See
`src/ts/__tests__/trackballRotationPivot.test.ts`.

## Gotchas

- **Never run both fixes at once.** The snap would discard the offset the pivot is
  preserving; you would get `recentre` while believing you configured `keep-pan`.
  The helper's `apply()` is written so that cannot happen.
- **The snap listener must be capture phase.** Bubble phase is one gesture too late.
- **`dispose()` matters if the controls outlive the helper.** It removes the
  listener and clears `rotationPivot`; leaving a stale pivot behind on a shared
  controls object rotates the next scene about the wrong point.
- **Zoom still moves toward `target`**, not the pivot, in all three modes. That is
  deliberate — it is what keeps a panned view's framing steady while zooming.
