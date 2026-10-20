/**
 * `nrrdTools.start` is what hosts register as their per-frame callback.
 *
 * It used to be whatever function `draw()` had last installed, read at registration time: a host
 * that registered before `draw()` held the empty placeholder for good, and the overlay never drew.
 * And once installed it drew from the first frame -- before the first slice had sized the
 * canvases, where `drawImage` of the 0x0 master canvas throws, every frame, from inside the
 * scene's render.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { DrawToolCore } from "../Utils/segmentation/DrawToolCore";
import { NrrdTools } from "../Utils/segmentation/NrrdTools";

function makeCore(width: number, height: number) {
  const core: any = Object.create(DrawToolCore.prototype);
  core.state = {
    protectedData: { canvases: { drawingCanvasLayerMaster: { width, height } } },
  };
  core.renderFrame = () => {};
  return core;
}

afterEach(() => vi.restoreAllMocks());

describe("DrawToolCore.start", () => {
  it("is one function for the life of the instance", () => {
    const core = makeCore(10, 10);
    expect(typeof core.start).toBe("function");
    expect(core.start).toBe(core.start);
  });

  it("runs the frame draw() installs, even when taken before draw()", () => {
    const core = makeCore(10, 10);
    const registered = core.start; // a host registering before draw()
    const frame = vi.fn();
    core.renderFrame = frame; // what draw() does
    registered();
    expect(frame).toHaveBeenCalledTimes(1);
  });

  it("skips frames until the first slice has sized the canvases", () => {
    const core = makeCore(0, 0);
    const frame = vi.fn();
    core.renderFrame = frame;
    core.start();
    expect(frame).not.toHaveBeenCalled();

    core.state.protectedData.canvases.drawingCanvasLayerMaster.width = 512;
    core.state.protectedData.canvases.drawingCanvasLayerMaster.height = 512;
    core.start();
    expect(frame).toHaveBeenCalledTimes(1);
  });
});

describe("NrrdTools.start", () => {
  it("hands out the engine's stable callback", () => {
    const core = makeCore(10, 10);
    const tools: any = Object.create(NrrdTools.prototype);
    tools.drawCore = core;
    expect(typeof tools.start).toBe("function");
    expect(tools.start).toBe(core.start);
    expect(tools.start).toBe(tools.start);
  });
});
