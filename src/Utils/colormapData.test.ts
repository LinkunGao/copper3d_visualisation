// src/ts/Utils/colormapData.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBlueOrangeRGBA } from "./colormapData.ts";

test("returns size*4 RGBA bytes", () => {
  assert.equal(buildBlueOrangeRGBA(256).length, 256 * 4);
  assert.equal(buildBlueOrangeRGBA(8).length, 32);
});

test("alpha ramps from fully transparent to fully opaque", () => {
  const cm = buildBlueOrangeRGBA(256);
  assert.equal(cm[3], 0);
  assert.equal(cm[255 * 4 + 3], 255);
});

test("alpha is monotonically non-decreasing", () => {
  const cm = buildBlueOrangeRGBA(256);
  for (let i = 1; i < 256; i++) {
    assert.ok(cm[i * 4 + 3] >= cm[(i - 1) * 4 + 3], `alpha dropped at ${i}`);
  }
});

test("low intensity is blue-dominant, high intensity is orange-dominant", () => {
  const cm = buildBlueOrangeRGBA(256);
  assert.ok(cm[2] > cm[0], "low end should have blue > red");
  const hi = 255 * 4;
  assert.ok(cm[hi] > cm[hi + 2], "high end should have red > blue");
});

test("all channels stay inside 0..255", () => {
  const cm = buildBlueOrangeRGBA(256);
  for (const v of cm) assert.ok(v >= 0 && v <= 255);
});

test("alpha is a concave gamma curve, not a linear ramp", () => {
  // pow(0.5, 1.6) * 255 ~= 84; a linear ramp would give ~127. This locks the
  // gamma curve that keeps low-intensity speckle transparent.
  const cm = buildBlueOrangeRGBA(256);
  assert.ok(cm[128 * 4 + 3] < 110, `midpoint alpha ${cm[128 * 4 + 3]} looks linear`);
});
