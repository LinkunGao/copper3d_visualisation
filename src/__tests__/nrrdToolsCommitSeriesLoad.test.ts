/**
 * `useCaseManagement.handleAllImagesLoaded` used to finish a case load with three separate
 * engine calls -- `switchAllSlicesArrayData`, `setSkips` (via `reconcileSkips`), then
 * `setContrastIndex` (via `landOn`) -- and a series-switch completion with two
 * (`setSkips` then `setContrastIndex`). Each pays `resetDisplaySlicesStatus()`'s full
 * display/canvas/mask refresh; nothing reads the display between them and the later call's
 * contrast index always overwrote the earlier call's paint, so only the LAST refresh was ever
 * visible. Measured at ~300ms per refresh on a 5-phase series.
 *
 * `commitSkipsAndContrast`/`commitSeriesLoad` fold the trailing calls into one:
 * `resetDisplaySlicesStatus()` must fire exactly once, with the skip dictionary and contrast
 * index already at their final values.
 */
import { describe, expect, it, vi } from "vitest";
import { NrrdTools } from "../Utils/segmentation/NrrdTools";

function makeInstance(displaySlicesLength: number) {
  const resetDisplaySlicesStatus = vi.fn();
  const instance: any = Object.create(NrrdTools.prototype);
  instance.state = {
    protectedData: {
      allSlicesArray: ["old-a", "old-b"],
      skipSlicesDic: {} as Record<number, any>,
      backUpDisplaySlices: ["s0", "s1", "s2", "s3", "s4"],
      displaySlices: new Array(displaySlicesLength).fill("x"),
    },
    nrrd_states: { view: { contrastNum: -1 } },
  };
  instance.sliceRenderPipeline = { resetDisplaySlicesStatus };
  return { instance, resetDisplaySlicesStatus };
}

describe("NrrdTools.commitSkipsAndContrast", () => {
  it("writes skip entries exactly like setSkips would", () => {
    const { instance } = makeInstance(5);
    instance.commitSkipsAndContrast(
      [
        { index: 0, skip: true },
        { index: 1, skip: false },
        { index: 2, skip: true },
      ],
      1
    );
    const dic = instance.state.protectedData.skipSlicesDic;
    expect(dic[0]).toBe("s0");
    expect(dic[1]).toBeUndefined();
    expect(dic[2]).toBe("s2");
  });

  it("refreshes the display exactly once, regardless of entry count", () => {
    const { instance, resetDisplaySlicesStatus } = makeInstance(5);
    instance.commitSkipsAndContrast(
      [
        { index: 0, skip: true },
        { index: 1, skip: false },
        { index: 2, skip: true },
        { index: 3, skip: false },
        { index: 4, skip: true },
      ],
      2
    );
    expect(resetDisplaySlicesStatus).toHaveBeenCalledTimes(1);
  });

  it("lands on the given contrast index", () => {
    const { instance } = makeInstance(5);
    instance.commitSkipsAndContrast([{ index: 0, skip: true }], 3);
    expect(instance.state.nrrd_states.view.contrastNum).toBe(3);
  });

  it("clamps the contrast index to displaySlices.length, same as setContrastIndex", () => {
    const { instance } = makeInstance(2);
    instance.commitSkipsAndContrast([{ index: 0, skip: true }], 9);
    expect(instance.state.nrrd_states.view.contrastNum).toBe(1);
  });
});

describe("NrrdTools.commitSeriesLoad", () => {
  it("replaces allSlicesArray, reconciles skips, and lands on contrast -- one refresh total", () => {
    const { instance, resetDisplaySlicesStatus } = makeInstance(5);
    const newSlices = ["n0", "n1", "n2", "n3", "n4"];
    instance.commitSeriesLoad(
      newSlices,
      [
        { index: 0, skip: true },
        { index: 1, skip: true },
        { index: 2, skip: false },
        { index: 3, skip: false },
        { index: 4, skip: true },
      ],
      2
    );
    expect(instance.state.protectedData.allSlicesArray).toEqual(newSlices);
    expect(instance.state.protectedData.skipSlicesDic[2]).toBeUndefined();
    expect(instance.state.protectedData.skipSlicesDic[4]).toBe("s4");
    expect(instance.state.nrrd_states.view.contrastNum).toBe(2);
    expect(resetDisplaySlicesStatus).toHaveBeenCalledTimes(1);
  });
});
