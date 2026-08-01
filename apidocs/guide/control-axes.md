# Control Axes & Gesture Gating

Turning rotation off — for a 2D view, or just while the user drags something
else — is two lines of code that are wrong more often than they are right. New
in **3.9.0**: a set of small helpers that make both mistakes impossible.

## The naming trap

Two spellings, and they are opposites:

| Class | Rotate | Pan | Zoom |
|---|---|---|---|
| `OrbitControls`, `Copper3dOrbitControls` | `enableRotate` | `enablePan` | `enableZoom` |
| `TrackballControls`, `Copper3dTrackballControls` | `noRotate` | `noPan` | `noZoom` |

Neither class validates the other's property name. Writing `enableRotate` on a
trackball does not throw, does not warn, and does not do anything — it lands as
an extra field nobody reads. The view stays rotatable, and you find out months
later when someone reports that a 2D image spins.

`setRotateEnabled` writes whichever spelling the instance actually has:

```ts
import Copper from "copper3d";

Copper.setRotateEnabled(scene.controls, false);   // trackball or orbit, correct either way
Copper.setPanEnabled(scene.controls, false);
Copper.setZoomEnabled(scene.controls, true);

if (Copper.isRotateEnabled(scene.controls)) { /* ... */ }
```

Also available: `isPanEnabled`, `isZoomEnabled`, `setPanEnabled`,
`setZoomEnabled`.

Three rules they follow:

- An axis with **neither** spelling present reads as enabled and is left alone
  on write. Nothing gates it, and inventing a property the class never reads
  would just be a lie that looks like a fix.
- An instance carrying **both** spellings (a wrapper, or a codebase that once
  wrote the wrong one) gets both written, so it cannot end up disagreeing with
  itself.
- They take any object with those fields, so a controls instance from the
  published bundle works.

## Gesture gating

The other half. When a pointer drag means something other than "move the
camera" — scrubbing a slice plane, dragging an annotation anchor, painting on a
mesh — rotation has to be suppressed for exactly the length of that gesture:

```ts
import Copper from "copper3d";

let release: (() => void) | null = null;

function onPointerDown(event) {
  if (!hitsMyDraggableThing(event)) return;
  release = Copper.beginGesture(scene.controls);
}

function onPointerUp() {
  release?.();
  release = null;
}

// The `true` is load-bearing -- see below.
el.addEventListener("pointerdown", onPointerDown, true);
el.addEventListener("pointerup", onPointerUp);
el.addEventListener("pointercancel", onPointerUp);
el.addEventListener("pointerleave", onPointerUp);
```

By default it suppresses rotation only. Ask for more when the gesture needs it:

```ts
Copper.beginGesture(scene.controls, { rotate: true, pan: true, zoom: true });
Copper.beginGesture(scene.controls, { rotate: false, pan: true });  // pan only
```

### Why not just set it back to enabled

Because the view may have been locked before your gesture started. A 2D
modality that ships with rotation off gets silently unlocked by the first drag,
and nothing ever locks it again — the bug is invisible in the gesture that
causes it and only shows up later, on a view that has no business rotating.

`beginGesture` captures the value **before** it suppresses anything and puts
that same value back. Restoring a locked view leaves it locked.

### Attach in the capture phase

This part the helper cannot do for you, and getting it wrong costs a whole
gesture.

`Copper3dTrackballControls` listens on the canvas in the bubble phase, and its
`pointerdown` handler latches the rotate state right there — it reads
`noRotate` and records the pointer position for the drag. A listener on an
ancestor element in the bubble phase runs *after* that, so the suppression you
just applied arrives too late and the first drag both scrubs and orbits.

Registering with `capture: true` puts your handler ahead of it:

```ts
el.addEventListener("pointerdown", onPointerDown, true);
```

### Releasing

- The returned function is **idempotent**. Wiring it to `pointerup`,
  `pointercancel` and `pointerleave` at once is safe and is what you want:
  `pointerleave` is the only one that fires when the pointer crosses out of the
  element mid-drag, and without it the view stays un-rotatable for good.
- Gates on the same controls object **refcount**. Two overlapping gestures both
  suppress; the axis comes back when the last one releases.
- `isGestureActive(controls)` reports whether anything currently holds it.

## Upgrading from 3.8.x

Purely additive — new exports, no existing behaviour changed. If you already
write `noRotate` directly and it works, it keeps working; the helpers are worth
adopting where the controls class is not known statically, or where a gesture
has to restore what it found.
