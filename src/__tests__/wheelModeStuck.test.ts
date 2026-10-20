/**
 * A press that never starts a stroke must not leave the wheel switched off.
 *
 * `onCanvasPointerDown` turns the wheel off (`activeWheelMode = 'none'`) whenever the router
 * is in 'draw' mode, so a stroke is not zoomed mid-drag. The release turns it back on -- but
 * only along the branches that end a stroke. A press that started no stroke took none of them,
 * and the wheel stayed off for good: no zoom, no slice, no error.
 */
import { describe, expect, it, vi } from "vitest";
import { DrawToolCore } from "../Utils/segmentation/DrawToolCore";

function makeCore({ suspended = false } = {}) {
  const drawingTool = {
    onPointerDown: vi.fn(),
    onPointerUp: vi.fn(),
    onPointerLeave: vi.fn(() => false),
    isActive: false,
    painting: false,
  };
  const core: any = Object.create(DrawToolCore.prototype);
  core.drawingTool = drawingTool;
  core.panTool = { onPointerDown: vi.fn(), onPointerUp: vi.fn(), onPointerLeave: vi.fn(), isActive: false };
  core.sphereBrushTool = { isActive: false };
  core.aiAssistTool = { onPointerDown: vi.fn() };
  core.setIsDrawFalse = vi.fn();
  core.paintSliceIndex = 0;
  core.activeWheelMode = "zoom";
  core.annotationSuspended = suspended;
  // Shift held with a drawing tool selected: the router reports 'draw'.
  core.eventRouter = { getMode: () => "draw", isCrosshairEnabled: () => false };
  core.state = {
    protectedData: {
      ctxes: { drawingLayerMasterCtx: { closePath: vi.fn() } },
      mainPreSlices: { index: 0 },
    },
    gui_states: {
      mode: { sphere: false, sphereBrush: false, sphereEraser: false, pencil: false },
      viewConfig: { defaultPaintCursor: "default" },
    },
    nrrd_states: { interaction: {}, view: { sizeFactor: 1 } },
  };
  return { core, drawingTool };
}

const press = (button: number) =>
  ({ button, offsetX: 10, offsetY: 10 }) as unknown as MouseEvent;

describe("the wheel after a press that started no stroke", () => {
  it("control: a real stroke turns the wheel off and back on", () => {
    const { core, drawingTool } = makeCore();
    core.onCanvasPointerDown(press(0));
    expect(drawingTool.onPointerDown).toHaveBeenCalledTimes(1);
    expect(core.activeWheelMode).toBe("none");
    drawingTool.painting = true;
    core.onCanvasPointerUp(press(0));
    expect(core.activeWheelMode).toBe("zoom");
  });

  it("Shift + left click while annotation is suspended", () => {
    const { core, drawingTool } = makeCore({ suspended: true });
    core.onCanvasPointerDown(press(0));
    core.onCanvasPointerUp(press(0));
    expect(drawingTool.onPointerDown).not.toHaveBeenCalled();
    expect(core.activeWheelMode).toBe("zoom");
  });

  it("Shift + middle click", () => {
    const { core, drawingTool } = makeCore();
    core.onCanvasPointerDown(press(1));
    core.onCanvasPointerUp(press(1));
    expect(drawingTool.onPointerDown).not.toHaveBeenCalled();
    expect(core.activeWheelMode).toBe("zoom");
  });
});
