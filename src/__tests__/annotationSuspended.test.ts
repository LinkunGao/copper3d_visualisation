/**
 * While a case's images are still arriving the reader may preview but must not annotate.
 *
 * Greying the Operation panel's buttons does not achieve that: a tool selected before the
 * load began stays armed on the canvas, so a left-drag still painted. Worse, the stroke could
 * not be taken back — `SliceRenderPipeline.afterLoadSlice` clears the undo stack every time a
 * slice lands, so the mask kept the paint while the history that would reverse it was thrown
 * away by the next arrival.
 *
 * These pin the enforcement at the input boundary, and pin equally that preview survives it.
 * A guard that also killed panning or the crosshair would have replaced one broken promise
 * with another, so both halves are tested.
 */
import { describe, expect, it, vi } from "vitest";
import { DrawToolCore } from "../Utils/segmentation/DrawToolCore";

type Mode = "draw" | "aiAssist" | "other";

interface CoreOpts {
  mode?: Mode;
  crosshair?: boolean;
  sphere?: boolean;
  sphereBrush?: boolean;
  sphereEraser?: boolean;
}

function makeCore(opts: CoreOpts = {}) {
  const {
    mode = "draw",
    crosshair = false,
    sphere = false,
    sphereBrush = false,
    sphereEraser = false,
  } = opts;

  const drawingTool = { onPointerDown: vi.fn(), onPointerMove: vi.fn(), isActive: false };
  const panTool = { onPointerDown: vi.fn(), isActive: false };
  const sphereBrushTool = { onSphereBrushClick: vi.fn(), onSphereEraserClick: vi.fn() };
  const aiAssistTool = { onPointerDown: vi.fn() };
  const enableCrosshair = vi.fn();
  const handleSphereClick = vi.fn();

  const core: any = Object.create(DrawToolCore.prototype);
  core.drawingTool = drawingTool;
  core.panTool = panTool;
  core.sphereBrushTool = sphereBrushTool;
  core.aiAssistTool = aiAssistTool;
  core.enableCrosshair = enableCrosshair;
  core.handleSphereClick = handleSphereClick;
  core.paintSliceIndex = 0;
  core.activeWheelMode = "zoom";
  core.annotationSuspended = false;
  core.eventRouter = { getMode: () => mode, isCrosshairEnabled: () => crosshair };
  core.state = {
    protectedData: {
      ctxes: { drawingLayerMasterCtx: { closePath: vi.fn() } },
      mainPreSlices: { index: 0 },
    },
    gui_states: { mode: { sphere, sphereBrush, sphereEraser } },
    nrrd_states: { interaction: {}, view: { sizeFactor: 1 } },
  };

  return {
    core,
    drawingTool,
    panTool,
    sphereBrushTool,
    aiAssistTool,
    enableCrosshair,
    handleSphereClick,
  };
}

/** A button press as the canvas delivers it. 0 = left, 2 = right. */
const press = (button: number) =>
  ({ button, offsetX: 10, offsetY: 10 }) as unknown as MouseEvent;

describe("the suspension flag itself", () => {
  it("allows annotation by default", () => {
    expect(makeCore().core.isAnnotationSuspended()).toBe(false);
  });

  it("reports what it was set to", () => {
    const { core } = makeCore();
    core.setAnnotationSuspended(true);
    expect(core.isAnnotationSuspended()).toBe(true);
    core.setAnnotationSuspended(false);
    expect(core.isAnnotationSuspended()).toBe(false);
  });
});

describe("while suspended, nothing may write into a mask", () => {
  it("a left press does not start a stroke", () => {
    const { core, drawingTool } = makeCore({ mode: "draw" });
    core.onCanvasPointerDown(press(0));
    expect(drawingTool.onPointerDown).toHaveBeenCalledTimes(1); // control: not suspended

    drawingTool.onPointerDown.mockClear();
    core.setAnnotationSuspended(true);
    core.onCanvasPointerDown(press(0));
    expect(drawingTool.onPointerDown).not.toHaveBeenCalled();
  });

  it("a sphere-brush click does not paint", () => {
    const { core, sphereBrushTool } = makeCore({ mode: "other", sphereBrush: true });
    core.setAnnotationSuspended(true);
    core.onCanvasPointerDown(press(0));
    expect(sphereBrushTool.onSphereBrushClick).not.toHaveBeenCalled();
  });

  it("a sphere-eraser click does not erase", () => {
    const { core, sphereBrushTool } = makeCore({ mode: "other", sphereEraser: true });
    core.setAnnotationSuspended(true);
    core.onCanvasPointerDown(press(0));
    expect(sphereBrushTool.onSphereEraserClick).not.toHaveBeenCalled();
  });

  it("a sphere click does not place a sphere", () => {
    const { core, handleSphereClick } = makeCore({ mode: "other", sphere: true });
    core.setAnnotationSuspended(true);
    core.onCanvasPointerDown(press(0));
    expect(handleSphereClick).not.toHaveBeenCalled();
  });

  it("an AI-assist prompt does not land", () => {
    const { core, aiAssistTool } = makeCore({ mode: "aiAssist" });
    core.setAnnotationSuspended(true);
    core.onCanvasPointerDown(press(0));
    expect(aiAssistTool.onPointerDown).not.toHaveBeenCalled();
  });
});

describe("preview survives the suspension", () => {
  it("right-drag still pans", () => {
    const { core, panTool } = makeCore();
    core.setAnnotationSuspended(true);
    core.onCanvasPointerDown(press(2));
    expect(panTool.onPointerDown).toHaveBeenCalledTimes(1);
  });

  it("the crosshair still places, because it only reads", () => {
    const { core, enableCrosshair } = makeCore({ mode: "other", crosshair: true });
    core.setAnnotationSuspended(true);
    core.onCanvasPointerDown(press(0));
    expect(enableCrosshair).toHaveBeenCalledTimes(1);
  });
});

describe("once resumed, annotation works again", () => {
  it("a left press starts a stroke after the load finishes", () => {
    const { core, drawingTool } = makeCore({ mode: "draw" });
    core.setAnnotationSuspended(true);
    core.onCanvasPointerDown(press(0));
    expect(drawingTool.onPointerDown).not.toHaveBeenCalled();

    core.setAnnotationSuspended(false);
    core.onCanvasPointerDown(press(0));
    expect(drawingTool.onPointerDown).toHaveBeenCalledTimes(1);
  });
});
