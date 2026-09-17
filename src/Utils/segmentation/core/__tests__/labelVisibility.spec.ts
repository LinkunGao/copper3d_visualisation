/**
 * The channel-visibility map records what has been HIDDEN, and never covers every label.
 *
 * It is seeded for the first eight channels and grows only as the clinician toggles an eye.
 * Read as falsy, a label the map does not mention renders as invisible — so every channel
 * past the seed was drawn into the volume and then painted transparent, with nothing to say
 * why. `setSliceLabelsFromImageData` already read it as `=== false`; this is the other half
 * agreeing.
 */
import { describe, expect, it } from "vitest";

import { MaskVolume } from "../MaskVolume";
import { MASK_CHANNEL_COLORS } from "../types";

const W = 2;
const H = 2;

/** The RGBA at voxel (0,0,0) after rendering slice 0 with `visible`. */
function pixelOf(label: number, visible?: Record<number, boolean>) {
  const vol = new MaskVolume(W, H, 1, 1);
  vol.setVoxel(0, 0, 0, label);
  const image = new ImageData(new Uint8ClampedArray(W * H * 4), W, H);
  vol.renderLabelSliceInto(0, "z", image, visible);
  return {
    r: image.data[0],
    g: image.data[1],
    b: image.data[2],
    a: image.data[3],
  };
}

describe("label rendering and the visibility map", () => {
  it("draws a label the map does not mention", () => {
    // Channel 12 is past the seeded eight. Nobody hid it, so it shows.
    const expected = MASK_CHANNEL_COLORS[12];
    expect(pixelOf(12, { 1: true })).toEqual({
      r: expected.r,
      g: expected.g,
      b: expected.b,
      a: expected.a,
    });
  });

  it("hides a label the map says false for", () => {
    expect(pixelOf(3, { 3: false })).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });

  it("draws a label the map says true for", () => {
    const expected = MASK_CHANNEL_COLORS[3];
    expect(pixelOf(3, { 3: true }).a).toBe(expected.a);
  });

  it("draws everything when there is no map at all", () => {
    expect(pixelOf(5).a).toBe(MASK_CHANNEL_COLORS[5].a);
  });

  it("leaves label 0 transparent whatever the map says", () => {
    // 0 is "empty", not a channel anyone can choose to show.
    expect(pixelOf(0, { 0: true })).toEqual({ r: 0, g: 0, b: 0, a: 0 });
  });
});
