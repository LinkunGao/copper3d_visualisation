# Rotating Around the Content, Not the Pan

`Copper3dTrackballControls.rotationPivot` decides what a rotate gesture does after
the reader has panned. It is the answer to "why does my model swing off into space
once I've moved it?"

::: tip New in 3.10.0
Additive and opt-in. `rotationPivot` defaults to `null`, which is exactly the
behaviour every earlier version had — leave it alone and nothing changes.
:::

For a drop-in helper that switches between all three behaviours at runtime, and how
to tell them apart on screen, see
[Switching Rotation Behaviour After a Pan](/examples/rotation-pivot-switch).

---

## 1. The problem

`panCamera()` translates the **camera and `target` together**:

```ts
scope.object.position.add(pan);
scope.target.add(pan);          // <- the pivot moves with the camera
```

That is what makes a pan a pan: the view slides sideways and the framing stays put.
But `target` is also the point rotation orbits, because `rotateCamera()` works on
`_eye = position - target` and `update()` puts the camera back at
`target + eye`.

So the moment someone pans, the orbit pivot is no longer on the content. The next
rotate swings the volume through a wide arc around an empty point in space instead
of turning it on the spot. The further they panned, the worse it gets — and nothing
throws, nothing warns, it just feels broken.

## 2. The obvious fix, and what it costs

The usual repair is to snap `target` back onto the content's centre when a rotate
starts. `Copper3dOrbitControls` does exactly this, on the controls' `start` event:

```ts
this._onStart = () => {
  if (isRotateGesture(this.state)) this.target.copy(this._pivot);
};
```

It fixes the axis. It also **throws the pan away**: assigning `target` does not move
the camera — `update()` re-derives the offset from the camera's current position —
but `object.lookAt(target)` re-aims it, so the content slides back to the middle of
the viewport as the rotation begins.

For many viewers that is fine, even desirable. For a reader who panned deliberately
— to put a lesion against the edge of a panel, next to a measurement — it is not.

## 3. `rotationPivot`

```ts
controls.rotationPivot = new THREE.Vector3(cx, cy, cz);   // world space
controls.rotationPivot = null;                            // back to orbiting target
```

| | type | default |
|---|---|---|
| `rotationPivot` | `Vector3 \| null` | `null` |

**Nothing here is on by default.** The default is `null`, which is the stock
trackball behaviour described in section 1 — a pan drags the orbit pivot with it.
That is true in 3.10.0 as much as in every earlier version; you have to set the
pivot for anything to change.

With a pivot set, the frame's rotation `q` is applied to `target - pivot` as well as
to `_eye` and `object.up`. Writing `C` for the pivot:

```
target'   = C + q(target − C)
eye'      = q(eye)
position' = target' + eye'
          = C + q(target − C) + q(position − target)
          = C + q(position − C)
```

The whole camera rig — camera *and* target — rotates rigidly about `C`. Two things
follow:

- **Every distance to `C` is preserved.** The content turns about its own centre.
- **`C`'s projection on screen does not move.** The pan offset survives: the content
  stays exactly where it was dragged to while it rotates.

When nothing has been panned, `target` *is* the pivot, so the offset being rotated
is the zero vector and the whole thing is a no-op. A viewer that never pans cannot
tell the difference.

## 4. Using it

Set the pivot once per piece of content, in world space:

```ts
const box = new THREE.Box3();
box.expandByObject(nrrdMesh.x);
box.expandByObject(nrrdMesh.y);
box.expandByObject(nrrdMesh.z);

controls.rotationPivot = box.getCenter(new THREE.Vector3());
```

::: warning It is world space, and it does not follow anything
Measure it from the objects themselves rather than assuming the origin. Slice planes
carry the volume's own offset and a GLB's bounding box is rarely centred, so the
world origin is usually the wrong point — the same mistake `fitView` avoids with
`bounds.center`.

Recompute it whenever the content changes (a new case, a new volume). Nothing
invalidates it for you.
:::

Clearing it is a normal thing to do, not a teardown step — a scene where the reader
should be able to orbit whatever they panned to still wants `null`.

### With `fitView` / `setCameraPose`

No interaction to manage. Both write `controls.target`, and both aim at the
content's centre, so after a re-frame or a "reset view" the target and the pivot
coincide again and the pan offset is genuinely zero. Set the pivot from the same
box you pass to `fitView` as `bounds.center` and the two agree by construction.

### Feature detection

The property is a plain field initialised in the constructor, so `in` is enough to
tell an older build apart and fall back to the snap-on-rotate pattern:

```ts
if ("rotationPivot" in controls) {
  controls.rotationPivot = centre;
} else {
  // 3.9.x and earlier: snap the target on rotate start instead, accepting that
  // the pan is discarded. Register in the CAPTURE phase — the trackball latches
  // its gesture state in its own bubble-phase pointerdown handler on the canvas.
  container.addEventListener("pointerdown", (event) => {
    if (isRotateButton(event)) controls.target.copy(centre);
  }, true);
}
```

## 5. What it does not change

- **Zoom still moves toward `target`,** not toward the pivot — `zoomCamera()` scales
  `_eye`. That is what keeps the framing steady while zooming a panned view; zooming
  toward the pivot would drag the content back toward the centre.
- **`minDistance` / `maxDistance` still clamp `|position − target|`,** not the
  distance to the pivot. With a large pan those differ slightly; the limits are
  soft-feel bounds, so it does not matter in practice.
- **Damping is handled.** The glide after the pointer is released rotates the target
  too, so the rig cannot come apart over those frames.
- **`noRotate`, `enabled` and `updateOnInput` are untouched.** A locked axis stays
  locked; this only changes *what* a permitted rotation turns about.

## 6. Which one should you use?

There are **three** states, not two — doing nothing is one of them, and it is where
you start:

| | how you get it | rotation axis | a pan the reader made | needs |
|---|---|---|---|---|
| **orbit-target** | do nothing — the default | the panned `target` | kept, but the axis is wrong | — |
| **recentre** | snap `target` on rotate start | content's centre | discarded when rotation starts | any version |
| **keep-pan** | `rotationPivot = centre` | content's centre | kept | 3.10.0+ |

The first row is the behaviour this page exists to fix, so the real choice is
between the last two. Both make "the centre of rotation is the centre of the image"
true; they differ only in what happens to the pan, so pick on that.

**Never run the last two at once** — the snap would discard the very offset the
pivot is preserving, and you would get `recentre` while believing you configured
`keep-pan`.

To see which one a viewer is currently in: pan the content into a corner of the
viewport, then drag to rotate. It swings away on a wide arc (`orbit-target`), snaps
back to the middle and then turns (`recentre`), or stays in the corner and turns
(`keep-pan`).

## 7. Upgrading from 3.9.x

Nothing to do. The default is `null` and the rotation path is byte-identical to
before when it is unset or equal to `target`.

If you are currently snapping `target` on rotate start, **remove that** when you set
a pivot — the snap would throw away the very offset the pivot is preserving.

## 8. Tests

`src/ts/__tests__/trackballRotationPivot.test.ts` pins the rigid-rotation
invariants: distance to the pivot, the pan offset's length, and the camera-to-target
distance all survive a rotate, the camera actually moves, and an un-panned viewer
produces identical output with and without a pivot. These are all silent failures —
each wrong version still renders a plausible picture — so they are worth asserting
rather than eyeballing.
