/**
 * A series with fewer contrasts than the previous one must not blank the canvas.
 *
 * skipSlicesDic is keyed by index and persists across switchSlicesPreservingView, which does
 * not reconcile it against the new array's length. Switching a five-phase series for a
 * two-phase one leaves indices 2..4 in the dict with no backing slice.
 */
import { describe, expect, it } from "vitest";

import { SliceRenderPipeline } from "../Utils/segmentation/tools/SliceRenderPipeline";

/**
 * Builds a pipeline whose ctx.protectedData.allSlicesArray has `sliceCount` slices along
 * axis "z", each shaped `{ id: 'slice-N' }` â€” that id is what tests assert on to confirm
 * *which* slices survived, not just how many.
 */
function pipelineWith(sliceCount: number, skipSlicesDic: Record<number, any>) {
  const displaySlices: any[] = [];
  const backUpDisplaySlices: any[] = [];
  const allSlicesArray = Array.from({ length: sliceCount }, (_, i) => ({
    z: { id: `slice-${i}` },
  }));

  const ctx: any = {
    protectedData: {
      axis: "z",
      displaySlices,
      backUpDisplaySlices,
      skipSlicesDic,
      allSlicesArray,
    },
    nrrd_states: { view: { contrastNum: 0 } },
  };

  const pipeline: any = Object.create(SliceRenderPipeline.prototype);
  pipeline.ctx = ctx;
  return { pipeline, ctx };
}

/**
 * Mirrors the exact shape addSkip/removeSkip leave in skipSlicesDic (NrrdTools.ts ~793-809):
 * a contiguous key set 0..keyCount-1, holding `backingSlices[i]` for a selected index and
 * `undefined` for a deselected one. removeSkip never deletes a key, only sets it to
 * `undefined`, so the dict's key set is always contiguous over the series' full length â€”
 * a dict with "missing" keys is not a state the engine can reach.
 */
function skipSlicesDicFor(
  keyCount: number,
  selectedIndices: number[],
  backingSlices: any[]
): Record<number, any> {
  const dic: Record<number, any> = {};
  for (let i = 0; i < keyCount; i++) {
    dic[i] = selectedIndices.includes(i) ? backingSlices[i] : undefined;
  }
  return dic;
}

describe("setDisplaySlicesBaseOnAxis", () => {
  it("never puts undefined into displaySlices when the new array is shorter", () => {
    // Five contrasts were all selected in the previous series (the dict addSkip/removeSkip
    // leave right after a full 5-phase load); the incoming series has only two.
    const staleSlices = Array.from({ length: 5 }, (_, i) => ({ id: `stale-${i}` }));
    const skipSlicesDic = skipSlicesDicFor(5, [0, 1, 2, 3, 4], staleSlices);
    const { pipeline, ctx } = pipelineWith(2, skipSlicesDic);

    pipeline.setDisplaySlicesBaseOnAxis();

    expect(ctx.protectedData.displaySlices).not.toContain(undefined);
    expect(ctx.protectedData.displaySlices.length).toBe(2);
  });

  it("still honours a partial selection when the lengths match", () => {
    // Five contrasts; phases 0, 1 and 4 are selected, 2 and 3 were removeSkip'd â€” left as
    // `undefined` in the dict rather than deleted.
    const backingSlices = Array.from({ length: 5 }, (_, i) => ({ id: `backing-${i}` }));
    const skipSlicesDic = skipSlicesDicFor(5, [0, 1, 4], backingSlices);
    const { pipeline, ctx } = pipelineWith(5, skipSlicesDic);

    pipeline.setDisplaySlicesBaseOnAxis();

    // Assert identity, not just count: the surviving slices must be exactly 0, 1 and 4,
    // in that order â€” not three arbitrary slices that merely add up to the right length.
    expect(ctx.protectedData.displaySlices).toEqual([
      { id: "slice-0" },
      { id: "slice-1" },
      { id: "slice-4" },
    ]);
  });
});

