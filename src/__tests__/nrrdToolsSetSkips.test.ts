/**
 * `reconcileSkips` (useCaseManagement.ts) used to call `addSkip`/`removeSkip` once per phase
 * of a just-loaded series -- each of those calls `resetDisplaySlicesStatus()`, a full
 * display/canvas/mask refresh. Measured at over 1 second of main-thread time for a 5-phase
 * series once per-volume `extractSlice` stopped dominating the case-load block (see
 * copperNrrdLoader's narrowed `axes` option): every one of those refreshes but the last is
 * immediately discarded, since nothing reads the display in between and the caller's own
 * follow-up (`landOn`) overwrites the contrast index right after anyway.
 *
 * `setSkips` batches the same per-index writes into one call, refreshing once. This pins that
 * it writes every entry exactly like `addSkip`/`removeSkip` would, but calls
 * `resetDisplaySlicesStatus()` exactly once regardless of how many entries it was given.
 */
import { describe, expect, it, vi } from "vitest";
import { NrrdTools } from "../Utils/segmentation/NrrdTools";

function makeInstance(displaySlicesLength: number) {
  const resetDisplaySlicesStatus = vi.fn();
  const instance: any = Object.create(NrrdTools.prototype);
  instance.state = {
    protectedData: {
      skipSlicesDic: {} as Record<number, any>,
      backUpDisplaySlices: ["s0", "s1", "s2", "s3", "s4"],
      displaySlices: new Array(displaySlicesLength).fill("x"),
    },
    nrrd_states: { view: { contrastNum: -1 } },
  };
  instance.sliceRenderPipeline = { resetDisplaySlicesStatus };
  return { instance, resetDisplaySlicesStatus };
}

describe("NrrdTools.setSkips", () => {
  it("writes each entry's skip state exactly like addSkip/removeSkip would", () => {
    const { instance } = makeInstance(5);

    instance.setSkips([
      { index: 0, skip: true },
      { index: 1, skip: false },
      { index: 2, skip: true },
      { index: 3, skip: false },
      { index: 4, skip: true },
    ]);

    const dic = instance.state.protectedData.skipSlicesDic;
    // addSkip writes backUpDisplaySlices[index]; removeSkip writes undefined.
    expect(dic[0]).toBe("s0");
    expect(dic[1]).toBeUndefined();
    expect(dic[2]).toBe("s2");
    expect(dic[3]).toBeUndefined();
    expect(dic[4]).toBe("s4");
  });

  it("refreshes the display exactly once, no matter how many entries are given", () => {
    const { instance, resetDisplaySlicesStatus } = makeInstance(5);

    instance.setSkips([
      { index: 0, skip: true },
      { index: 1, skip: false },
      { index: 2, skip: true },
      { index: 3, skip: false },
      { index: 4, skip: true },
    ]);

    expect(resetDisplaySlicesStatus).toHaveBeenCalledTimes(1);
  });

  it("clamps contrastNum to displaySlices.length for a skip index past the end, same as addSkip", () => {
    const { instance } = makeInstance(2); // displaySlices has length 2

    instance.setSkips([{ index: 4, skip: true }]);

    expect(instance.state.nrrd_states.view.contrastNum).toBe(2);
  });

  it("is a no-op safe call with an empty entry list (still refreshes once)", () => {
    const { instance, resetDisplaySlicesStatus } = makeInstance(0);

    expect(() => instance.setSkips([])).not.toThrow();
    expect(resetDisplaySlicesStatus).toHaveBeenCalledTimes(1);
  });
});
