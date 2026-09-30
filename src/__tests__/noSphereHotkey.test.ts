/**
 * Sphere mode has no keyboard shortcut. It is entered only through `setMode` (the calculator
 * uses it), so the host always knows which tool is active. A shortcut used to toggle it on "q"
 * behind the host's back: the masks were cleared from the view while the host still showed
 * its own tool as selected.
 */
import { describe, expect, it, vi } from "vitest";
import { DrawToolCore } from "../Utils/segmentation/DrawToolCore";
import { CanvasState } from "../Utils/segmentation/CanvasState";

function makeCore() {
  const container = document.createElement("div");
  const drawingCanvas = document.createElement("canvas");
  container.appendChild(drawingCanvas);
  document.body.appendChild(container);

  const core: any = Object.create(DrawToolCore.prototype);
  core.container = container;
  core.state = {
    configKeyBoard: false,
    keyboardSettings: new (CanvasState as any)().keyboardSettings,
    gui_states: { mode: { sphere: false, sphereBrush: false, sphereEraser: false }, viewConfig: {} },
    protectedData: { canvases: { drawingCanvas } },
  };
  core.sphereTool = { ctx: {} };
  core.enterSphereMode = vi.fn();
  core.exitSphereMode = vi.fn();
  core.initDrawToolCore();
  core.eventRouter.bindAll();
  return { core, container };
}

describe("sphere mode keyboard shortcut", () => {
  it("has no sphere key in the default keyboard settings", () => {
    const settings = new (CanvasState as any)().keyboardSettings;
    expect("sphere" in settings).toBe(false);
  });

  it("pressing q does not enter sphere mode", () => {
    const { core, container } = makeCore();
    container.dispatchEvent(new KeyboardEvent("keydown", { key: "q", bubbles: true }));
    expect(core.enterSphereMode).not.toHaveBeenCalled();
    expect(core.state.gui_states.mode.sphere).toBe(false);
  });
});
