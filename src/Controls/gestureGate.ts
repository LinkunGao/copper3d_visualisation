import type { AxisGatedControls } from "./controlsAxes";
import {
  isPanEnabled,
  isRotateEnabled,
  isZoomEnabled,
  setPanEnabled,
  setRotateEnabled,
  setZoomEnabled,
} from "./controlsAxes";

/**
 * Suppresses camera axes for the duration of a gesture that means something
 * else -- scrubbing a slice plane, dragging an annotation anchor, painting on
 * a mesh -- and puts back exactly what was there before.
 *
 * ## Restore what was there, never `true`
 *
 * This is the whole reason to have a helper rather than two assignments. The
 * obvious hand-rolled version disables the axis on pointerdown and re-enables
 * it on pointerup, and it is wrong on any view that was ALREADY locked: a 2D
 * modality with rotation deliberately turned off silently becomes orbitable
 * the first time the reader scrubs it, and nothing ever turns it back off.
 *
 * ## Attach the listener in the CAPTURE phase
 *
 * The gate cannot do this for you, and getting it wrong costs a whole
 * gesture. `Copper3dTrackballControls` listens on the canvas in the bubble
 * phase and latches its rotate state inside its own `pointerdown` handler
 * (`onMouseDown` reads `noRotate` there and copies the pointer position). A
 * listener that opens the gate in the bubble phase runs after that, so the
 * first gesture both scrubs AND orbits:
 *
 * ```ts
 * el.addEventListener("pointerdown", onDown, true);  // <- the `true`
 * ```
 *
 * ## Nesting
 *
 * Gates on the same controls object refcount. The first one captures and
 * suppresses; the last one released restores. Each releaser is idempotent, so
 * calling it from both `pointerup` and `pointercancel` is safe.
 */

export interface GestureAxes {
  /** Default `true` -- rotation is what a drag gesture collides with. */
  rotate?: boolean;
  pan?: boolean;
  zoom?: boolean;
}

interface ActiveGate {
  holders: number;
  rotate?: boolean;
  pan?: boolean;
  zoom?: boolean;
}

const active = new WeakMap<object, ActiveGate>();

/**
 * Suppresses the requested axes and returns the function that restores them.
 *
 * @param controls the scene's controls; trackball or orbit, either spelling
 * @param axes which axes the gesture needs; rotate only by default
 */
export function beginGesture(
  controls: AxisGatedControls,
  axes: GestureAxes = {}
): () => void {
  const wantRotate = axes.rotate ?? true;
  const wantPan = axes.pan ?? false;
  const wantZoom = axes.zoom ?? false;

  let gate = active.get(controls);
  if (!gate) {
    // Captured BEFORE anything is suppressed, which is the point.
    gate = {
      holders: 0,
      rotate: wantRotate ? isRotateEnabled(controls) : undefined,
      pan: wantPan ? isPanEnabled(controls) : undefined,
      zoom: wantZoom ? isZoomEnabled(controls) : undefined,
    };
    active.set(controls, gate);
  } else {
    // A nested gate may ask for an axis the outer one did not. Capture that
    // one too, still from its pre-suppression value.
    if (wantRotate && gate.rotate === undefined)
      gate.rotate = isRotateEnabled(controls);
    if (wantPan && gate.pan === undefined) gate.pan = isPanEnabled(controls);
    if (wantZoom && gate.zoom === undefined) gate.zoom = isZoomEnabled(controls);
  }

  gate.holders += 1;

  if (wantRotate) setRotateEnabled(controls, false);
  if (wantPan) setPanEnabled(controls, false);
  if (wantZoom) setZoomEnabled(controls, false);

  let released = false;
  return function release() {
    if (released) return;
    released = true;

    const current = active.get(controls);
    if (!current) return;

    current.holders -= 1;
    if (current.holders > 0) return;

    if (current.rotate !== undefined) setRotateEnabled(controls, current.rotate);
    if (current.pan !== undefined) setPanEnabled(controls, current.pan);
    if (current.zoom !== undefined) setZoomEnabled(controls, current.zoom);
    active.delete(controls);
  };
}

/** Whether a gesture currently holds this controls object. Mainly for tests. */
export function isGestureActive(controls: AxisGatedControls): boolean {
  return (active.get(controls)?.holders ?? 0) > 0;
}
