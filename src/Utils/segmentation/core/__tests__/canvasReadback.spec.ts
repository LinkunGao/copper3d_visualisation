/**
 * Reading a painted canvas back into labels, once there are more than eight of them.
 *
 * The readback matches each pixel's RGB against the channel palette. Two things about that
 * stopped being safe when the palette grew past channel 8:
 *
 *  - the exact-match table was built from channels 1-8, so a pixel painted in channel 12's
 *    colour never matched and fell through to the nearest-colour guess — which could only
 *    ever answer 1-8. Channel 12 could be drawn and could not be read back.
 *
 *  - that guess ran over a fixed 1-8. Widened to the whole palette it would be 255 distance
 *    computations per anti-aliased edge pixel, and worse than slow: the more colours it can
 *    choose from, the more likely a fringe resolves to a label that is not on the slice at
 *    all, putting voxels in another finding's mask with nothing to show for it.
 */
import { describe, expect, it } from "vitest";

import { MaskVolume } from "../MaskVolume";
import { MASK_CHANNEL_COLORS } from "../types";

const W = 2;
const H = 2;

/** One slice of pixels, RGBA, all transparent until painted. */
function blank(): ImageData {
  return new ImageData(new Uint8ClampedArray(W * H * 4), W, H);
}

function paint(img: ImageData, index: number, rgb: { r: number; g: number; b: number }) {
  const p = index * 4;
  img.data[p] = rgb.r;
  img.data[p + 1] = rgb.g;
  img.data[p + 2] = rgb.b;
  img.data[p + 3] = 255;
}

describe("canvas readback with a palette past eight", () => {
  it("round-trips a channel above 8 through its exact colour", () => {
    const vol = new MaskVolume(W, H, 1, 1);
    const img = blank();
    paint(img, 0, MASK_CHANNEL_COLORS[12]);

    vol.setSliceLabelsFromImageData(0, img, "z", 12);

    // Before the exact-match table covered the whole palette this landed on whichever of
    // 1-8 happened to be nearest — the channel could be painted and never read back.
    expect(vol.getVoxel(0, 0, 0)).toBe(12);
  });

  it("gives a fringe pixel to the active channel, not to a colour nobody drew", () => {
    const vol = new MaskVolume(W, H, 1, 1);
    const img = blank();
    // Close to channel 5 (fuchsia), but nothing on this slice is channel 5 and the stroke
    // being committed is channel 1. A fringe cannot belong to a label that is not here.
    const fuchsia = MASK_CHANNEL_COLORS[5];
    paint(img, 0, { r: fuchsia.r - 4, g: fuchsia.g - 4, b: fuchsia.b - 4 });

    vol.setSliceLabelsFromImageData(0, img, "z", 1);

    expect(vol.getVoxel(0, 0, 0)).toBe(1);
  });

  it("still lets a fringe fall to a label that IS on the slice", () => {
    const vol = new MaskVolume(W, H, 1, 1);
    vol.setVoxel(1, 0, 0, 5); // channel 5 really is here

    const img = blank();
    const fuchsia = MASK_CHANNEL_COLORS[5];
    paint(img, 0, { r: fuchsia.r - 4, g: fuchsia.g - 4, b: fuchsia.b - 4 });
    paint(img, 1, fuchsia); // keep the existing voxel painted so it survives the readback

    vol.setSliceLabelsFromImageData(0, img, "z", 1);

    // The narrowing is "labels present plus the active one", not "the active one only" —
    // an edge between two drawn findings must still be able to resolve to the neighbour.
    expect(vol.getVoxel(0, 0, 0)).toBe(5);
  });

  it("leaves an exact match alone whichever channel is active", () => {
    const vol = new MaskVolume(W, H, 1, 1);
    const img = blank();
    paint(img, 0, MASK_CHANNEL_COLORS[3]);

    vol.setSliceLabelsFromImageData(0, img, "z", 7);

    expect(vol.getVoxel(0, 0, 0)).toBe(3);
  });
});
