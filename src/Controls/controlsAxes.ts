/**
 * One way to ask about, and set, whether a controls instance may rotate, pan
 * or zoom.
 *
 * There are two spellings in play and they are opposites. `OrbitControls` (and
 * `Copper3dOrbitControls`) use positive `enableRotate` / `enablePan` /
 * `enableZoom`; `TrackballControls` and `Copper3dTrackballControls` use
 * negative `noRotate` / `noPan` / `noZoom`. Neither class complains about the
 * other's property name -- it lands as an unread extra field -- so writing the
 * wrong one is a SILENT no-op, and code that has to work with whatever
 * controls a scene happens to be carrying gets it wrong sooner or later.
 *
 * Deliberately structural and free of `three`: a caller holding a controls
 * instance out of a published bundle can still pass it here.
 */

export interface AxisGatedControls {
  /** Trackball spelling. */
  noRotate?: boolean;
  noPan?: boolean;
  noZoom?: boolean;
  /** Orbit spelling. */
  enableRotate?: boolean;
  enablePan?: boolean;
  enableZoom?: boolean;
}

type Axis = "Rotate" | "Pan" | "Zoom";

function read(controls: AxisGatedControls, axis: Axis): boolean {
  const negative = (controls as Record<string, unknown>)[`no${axis}`];
  if (typeof negative === "boolean") return !negative;

  const positive = (controls as Record<string, unknown>)[`enable${axis}`];
  if (typeof positive === "boolean") return positive;

  // Neither spelling present: nothing is gating the axis, so it is on.
  return true;
}

function write(
  controls: AxisGatedControls,
  axis: Axis,
  enabled: boolean
): void {
  const target = controls as Record<string, unknown>;
  // Whichever spellings exist, all of them -- an instance carrying both (a
  // wrapper, or a caller who already wrote the wrong one once) must not be
  // left disagreeing with itself.
  let written = false;
  if (typeof target[`no${axis}`] === "boolean") {
    target[`no${axis}`] = !enabled;
    written = true;
  }
  if (typeof target[`enable${axis}`] === "boolean") {
    target[`enable${axis}`] = enabled;
    written = true;
  }
  // Nothing to write to means the controls class does not gate this axis;
  // inventing the property would be a lie the class never reads.
  if (!written) return;
}

export function isRotateEnabled(controls: AxisGatedControls): boolean {
  return read(controls, "Rotate");
}

export function setRotateEnabled(
  controls: AxisGatedControls,
  enabled: boolean
): void {
  write(controls, "Rotate", enabled);
}

export function isPanEnabled(controls: AxisGatedControls): boolean {
  return read(controls, "Pan");
}

export function setPanEnabled(
  controls: AxisGatedControls,
  enabled: boolean
): void {
  write(controls, "Pan", enabled);
}

export function isZoomEnabled(controls: AxisGatedControls): boolean {
  return read(controls, "Zoom");
}

export function setZoomEnabled(
  controls: AxisGatedControls,
  enabled: boolean
): void {
  write(controls, "Zoom", enabled);
}
