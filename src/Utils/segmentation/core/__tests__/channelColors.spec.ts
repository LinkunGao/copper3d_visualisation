/**
 * The palette beyond channel 8, and the promise that channels 1-8 do not move.
 *
 * Every delivered case's chips, its 3D overlay tints and the outlines printed in its report
 * are keyed on these values. Regenerating 1-8 from a formula — however good the formula —
 * would silently recolour work that has already been read and signed off, so those stay
 * literal and only 9 upward is generated.
 *
 * The expected values here are written out rather than imported from the module under test.
 * A test that reads its expectations from the thing it is testing cannot fail.
 */
import { describe, expect, it } from "vitest";

import {
  AI_CHANNEL_HEX_COLORS,
  AI_MASK_CHANNEL_COLORS,
  CHANNEL_HEX_COLORS,
  MASK_CHANNEL_COLORS,
  MASK_CHANNEL_CSS_COLORS,
} from "../types";

describe("the delivered palette is untouched", () => {
  it("keeps the RGBA table's first eight channels", () => {
    expect(MASK_CHANNEL_COLORS[0]).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    expect(MASK_CHANNEL_COLORS[1]).toEqual({ r: 16, g: 185, b: 129, a: 255 });
    expect(MASK_CHANNEL_COLORS[2]).toEqual({ r: 244, g: 63, b: 94, a: 255 });
    expect(MASK_CHANNEL_COLORS[3]).toEqual({ r: 59, g: 130, b: 246, a: 255 });
    expect(MASK_CHANNEL_COLORS[4]).toEqual({ r: 251, g: 191, b: 36, a: 255 });
    expect(MASK_CHANNEL_COLORS[5]).toEqual({ r: 217, g: 70, b: 239, a: 255 });
    expect(MASK_CHANNEL_COLORS[6]).toEqual({ r: 6, g: 182, b: 212, a: 255 });
    expect(MASK_CHANNEL_COLORS[7]).toEqual({ r: 249, g: 115, b: 22, a: 255 });
    expect(MASK_CHANNEL_COLORS[8]).toEqual({ r: 139, g: 92, b: 246, a: 255 });
  });

  it("keeps the CSS strings byte for byte", () => {
    // `rgba(...,1)`, not `rgba(...,1.00)`. rgbaToCss produces the latter, so deriving these
    // from the RGBA table would change every one of them.
    expect(MASK_CHANNEL_CSS_COLORS[0]).toBe("rgba(0,0,0,0)");
    expect(MASK_CHANNEL_CSS_COLORS[1]).toBe("rgba(16,185,129,1)");
    expect(MASK_CHANNEL_CSS_COLORS[8]).toBe("rgba(139,92,246,1)");
  });

  it("keeps the hex strings", () => {
    expect(CHANNEL_HEX_COLORS[1]).toBe("#10b981");
    expect(CHANNEL_HEX_COLORS[8]).toBe("#8b5cf6");
  });

  it("keeps the AI palette's two deliberate swaps", () => {
    // Channel 1 is the AI accent cyan so the 2D overlay matches the ai_generated GLB;
    // channel 6 absorbs the emerald channel 1 vacated.
    expect(AI_CHANNEL_HEX_COLORS[1]).toBe("#5ec8ff");
    expect(AI_CHANNEL_HEX_COLORS[6]).toBe("#10b981");
    expect(AI_MASK_CHANNEL_COLORS[1]).toEqual({ r: 94, g: 200, b: 255, a: 255 });
    expect(AI_MASK_CHANNEL_COLORS[6]).toEqual({ r: 16, g: 185, b: 129, a: 255 });
  });
});

describe("the palette continues past channel 8", () => {
  it("defines every channel up to 255 in all four tables", () => {
    for (const ch of [9, 16, 32, 128, 255]) {
      expect(MASK_CHANNEL_COLORS[ch], `rgba ${ch}`).toBeDefined();
      expect(MASK_CHANNEL_CSS_COLORS[ch], `css ${ch}`).toBeDefined();
      expect(CHANNEL_HEX_COLORS[ch], `hex ${ch}`).toBeDefined();
      expect(AI_CHANNEL_HEX_COLORS[ch], `ai hex ${ch}`).toBeDefined();
    }
  });

  it("stops at 255 — a Uint8 label holds no more", () => {
    expect(MASK_CHANNEL_COLORS[256]).toBeUndefined();
    expect(CHANNEL_HEX_COLORS[256]).toBeUndefined();
  });

  it("gives every channel in the usable range its own colour", () => {
    // 32 is well past any cap the product will offer. Beyond roughly 20 the hues stop being
    // tellable apart by eye, but they must at least remain distinct values.
    const hexes = Array.from({ length: 32 }, (_, i) => CHANNEL_HEX_COLORS[i + 1]);
    expect(new Set(hexes).size).toBe(32);
  });

  it("agrees between the RGBA, CSS and hex tables for a generated channel", () => {
    const rgba = MASK_CHANNEL_COLORS[12];
    expect(CHANNEL_HEX_COLORS[12]).toBe(
      `#${[rgba.r, rgba.g, rgba.b].map((v) => v.toString(16).padStart(2, "0")).join("")}`
    );
    expect(MASK_CHANNEL_CSS_COLORS[12]).toContain(`${rgba.r},${rgba.g},${rgba.b}`);
  });

  it("shares the generated range with the AI palette", () => {
    // The two palettes differ only in their seeded swaps; there is no reason for channel 40
    // to be one colour on the clinician layer and another on the AI scratch layer.
    // Asserted defined as well as equal: two undefineds are equal, which would make this
    // pass on exactly the state it exists to rule out.
    expect(CHANNEL_HEX_COLORS[40]).toBeDefined();
    expect(AI_CHANNEL_HEX_COLORS[40]).toBe(CHANNEL_HEX_COLORS[40]);
  });
});
