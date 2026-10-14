/**
 * The window/level drag measures every move against where the press started, as a fraction of
 * the container. The press used to divide by the previous fraction instead of the width, so the
 * horizontal start was meaningless (Infinity on the first press).
 */
import { describe, expect, it, vi } from "vitest";

import { ContrastTool } from "../Utils/segmentation/tools/ContrastTool";

function setup(width: number, height: number) {
  const container = document.createElement("div");
  Object.defineProperty(container, "offsetWidth", { value: width });
  Object.defineProperty(container, "offsetHeight", { value: height });
  const params: any = { x: 0, y: 0, w: 0, h: 0, move_x: 0, move_y: 0 };
  const tool = new ContrastTool({} as any, container, params, {} as any);
  tool.setupConrastEvents(vi.fn());
  return params;
}

describe("ContrastTool drag start", () => {
  it("records the press as a fraction of the container, on both axes", () => {
    const params = setup(200, 100);

    params.handleOnContrastMouseDown({ button: 0, offsetX: 100, offsetY: 25 } as MouseEvent);

    expect(params.x).toBe(0.5);
    expect(params.y).toBe(0.25);
  });

  it("does not depend on where the previous drag ended", () => {
    const params = setup(200, 100);
    params.x = 0.9;

    params.handleOnContrastMouseDown({ button: 0, offsetX: 50, offsetY: 0 } as MouseEvent);

    expect(params.x).toBe(0.25);
  });
});
