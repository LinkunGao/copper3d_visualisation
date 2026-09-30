/**
 * Contour building and painting, shared by a viewer's own layers and by a mirror.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("../Utils/segmentation/core/MarchingSquares", () => ({
  findLabelsInSlice: vi.fn(() => [1, 2]),
  extractLabelContours: vi.fn(() => ({ fill: true })),
  extractLabelOutline: vi.fn(() => ({ outline: true })),
}));

import { contourEntry, paintContours, type ContourEntry } from "../Utils/segmentation/contourPaint";
import { extractLabelContours, extractLabelOutline } from "../Utils/segmentation/core/MarchingSquares";

const slice = () => ({ data: new Uint8Array(4), width: 2, height: 2, stride: 1 });

function ctx() {
  const c: any = { fills: [] as string[], strokes: [] as string[] };
  Object.assign(c, {
    save: vi.fn(), restore: vi.fn(), scale: vi.fn(), translate: vi.fn(),
    fill: vi.fn(() => c.fills.push(c.fillStyle)),
    stroke: vi.fn(() => c.strokes.push(c.strokeStyle)),
  });
  return c;
}

describe("contourEntry", () => {
  it("builds once per key and reuses the entry", () => {
    const cache = new Map<string, ContourEntry>();
    const read = vi.fn(slice);
    const a = contourEntry(cache, "layer1", "z:0:0", read, false);
    const b = contourEntry(cache, "layer1", "z:0:0", read, false);
    expect(b).toBe(a);
    expect(read).toHaveBeenCalledTimes(1);
    contourEntry(cache, "layer1", "z:0:1", read, false);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("builds the other mode's paths the first time that mode is asked for", () => {
    const cache = new Map<string, ContourEntry>();
    const e = contourEntry(cache, "l", "k", slice, false);
    expect(e.outlines.size).toBe(0);
    contourEntry(cache, "l", "k", slice, true);
    expect(e.outlines.size).toBe(2);
    expect(extractLabelOutline).toHaveBeenCalled();
    expect(extractLabelContours).toHaveBeenCalled();
  });
});

describe("paintContours", () => {
  const colour = (l: number) => (l === 1 ? { r: 255, g: 0, b: 0, a: 255 } : { r: 0, g: 0, b: 255, a: 255 });

  it("fills each visible label in its colour", () => {
    const e = contourEntry(new Map(), "l", "k", slice, false);
    const c = ctx();
    paintContours(e, c, "z", 10, 10, false, colour, { 2: false });
    expect(c.fills).toEqual(["rgba(255, 0, 0, 1)"]);
  });

  it("strokes in outline mode", () => {
    const e = contourEntry(new Map(), "l", "k", slice, true);
    const c = ctx();
    paintContours(e, c, "z", 10, 10, true, colour);
    expect(c.strokes).toEqual(["rgba(255, 0, 0, 1)", "rgba(0, 0, 255, 1)"]);
    expect(c.fill).not.toHaveBeenCalled();
  });
});
