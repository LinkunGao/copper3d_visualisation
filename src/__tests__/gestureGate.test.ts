import { describe, expect, it } from "vitest";
import { beginGesture, isGestureActive } from "../Controls/gestureGate";

const trackball = () => ({ noRotate: false, noPan: false, noZoom: false });

describe("beginGesture", () => {
  it("suppresses rotation for the gesture and gives it back", () => {
    const controls = trackball();

    const release = beginGesture(controls);
    expect(controls.noRotate).toBe(true);

    release();
    expect(controls.noRotate).toBe(false);
  });

  it("leaves an already-locked view locked", () => {
    // The 2D modality case: rotation was deliberately off before the gesture,
    // and a restore that hardcodes "enabled" silently unlocks it forever.
    const controls = { ...trackball(), noRotate: true };

    beginGesture(controls)();

    expect(controls.noRotate).toBe(true);
  });

  it("touches only the axes the gesture asked for", () => {
    const controls = trackball();

    const release = beginGesture(controls);

    expect(controls.noPan).toBe(false);
    expect(controls.noZoom).toBe(false);
    release();
  });

  it("can take pan and zoom too", () => {
    const controls = trackball();

    const release = beginGesture(controls, { pan: true, zoom: true });
    expect([controls.noRotate, controls.noPan, controls.noZoom])
      .toEqual([true, true, true]);

    release();
    expect([controls.noRotate, controls.noPan, controls.noZoom])
      .toEqual([false, false, false]);
  });

  it("can leave rotation alone when that is the point", () => {
    const controls = trackball();

    const release = beginGesture(controls, { rotate: false, pan: true });

    expect(controls.noRotate).toBe(false);
    expect(controls.noPan).toBe(true);
    release();
  });

  it("works on the orbit spelling as well", () => {
    const controls = { enableRotate: true };

    const release = beginGesture(controls);
    expect(controls.enableRotate).toBe(false);

    release();
    expect(controls.enableRotate).toBe(true);
  });

  it("is idempotent, so pointerup and pointercancel can both fire it", () => {
    const controls = trackball();
    const release = beginGesture(controls);

    release();
    // Something else locks rotation between the two calls; the second release
    // must not undo that.
    controls.noRotate = true;
    release();

    expect(controls.noRotate).toBe(true);
  });
});

describe("nesting", () => {
  it("restores only once the last holder releases", () => {
    const controls = trackball();

    const outer = beginGesture(controls);
    const inner = beginGesture(controls);

    inner();
    expect(controls.noRotate, "the outer gesture is still running").toBe(true);

    outer();
    expect(controls.noRotate).toBe(false);
  });

  it("captures an axis the outer gesture did not ask for, from its real value", () => {
    const controls = { ...trackball(), noPan: true };

    const outer = beginGesture(controls);
    const inner = beginGesture(controls, { pan: true });

    expect(controls.noPan).toBe(true);
    inner();
    outer();

    // Pan was locked before either gesture, so it stays locked.
    expect(controls.noPan).toBe(true);
    expect(controls.noRotate).toBe(false);
  });

  it("reports whether anything holds the controls", () => {
    const controls = trackball();
    expect(isGestureActive(controls)).toBe(false);

    const release = beginGesture(controls);
    expect(isGestureActive(controls)).toBe(true);

    release();
    expect(isGestureActive(controls)).toBe(false);
  });

  it("keeps separate controls objects independent", () => {
    const a = trackball();
    const b = trackball();

    const releaseA = beginGesture(a);

    expect(a.noRotate).toBe(true);
    expect(b.noRotate).toBe(false);
    expect(isGestureActive(b)).toBe(false);

    releaseA();
  });
});
