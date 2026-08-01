import { describe, expect, it } from "vitest";
import {
  isPanEnabled,
  isRotateEnabled,
  isZoomEnabled,
  setPanEnabled,
  setRotateEnabled,
  setZoomEnabled,
} from "../Controls/controlsAxes";

/**
 * The bug these exist to make impossible: `noRotate` and `enableRotate` are
 * opposites belonging to different classes, and writing the wrong one lands as
 * an unread extra field rather than an error.
 */

const trackball = () => ({ noRotate: false, noPan: false, noZoom: false });
const orbit = () => ({ enableRotate: true, enablePan: true, enableZoom: true });

describe("reading", () => {
  it("inverts the trackball's negative spelling", () => {
    const controls = trackball();
    expect(isRotateEnabled(controls)).toBe(true);

    controls.noRotate = true;
    expect(isRotateEnabled(controls)).toBe(false);
  });

  it("takes the orbit spelling as written", () => {
    const controls = orbit();
    expect(isRotateEnabled(controls)).toBe(true);

    controls.enableRotate = false;
    expect(isRotateEnabled(controls)).toBe(false);
  });

  it("treats an axis nothing gates as enabled", () => {
    expect(isRotateEnabled({})).toBe(true);
    expect(isPanEnabled({})).toBe(true);
    expect(isZoomEnabled({})).toBe(true);
  });
});

describe("writing", () => {
  it("writes the trackball spelling and does not invent the other", () => {
    const controls = trackball();

    setRotateEnabled(controls, false);

    expect(controls.noRotate).toBe(true);
    expect("enableRotate" in controls).toBe(false);
  });

  it("writes the orbit spelling and does not invent the other", () => {
    const controls = orbit();

    setRotateEnabled(controls, false);

    expect(controls.enableRotate).toBe(false);
    expect("noRotate" in controls).toBe(false);
  });

  it("keeps both spellings in agreement when an instance carries both", () => {
    const controls = { noRotate: false, enableRotate: true };

    setRotateEnabled(controls, false);

    expect(controls.noRotate).toBe(true);
    expect(controls.enableRotate).toBe(false);
  });

  it("leaves an ungated axis alone rather than adding a field nothing reads", () => {
    const controls: Record<string, unknown> = {};

    setRotateEnabled(controls, false);

    expect(Object.keys(controls)).toEqual([]);
  });

  it("round-trips every axis on both spellings", () => {
    for (const controls of [trackball(), orbit()]) {
      setRotateEnabled(controls, false);
      setPanEnabled(controls, false);
      setZoomEnabled(controls, false);
      expect([
        isRotateEnabled(controls),
        isPanEnabled(controls),
        isZoomEnabled(controls),
      ]).toEqual([false, false, false]);

      setRotateEnabled(controls, true);
      setPanEnabled(controls, true);
      setZoomEnabled(controls, true);
      expect([
        isRotateEnabled(controls),
        isPanEnabled(controls),
        isZoomEnabled(controls),
      ]).toEqual([true, true, true]);
    }
  });
});
