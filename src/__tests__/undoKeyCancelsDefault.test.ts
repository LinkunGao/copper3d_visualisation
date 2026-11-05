/**
 * The undo and redo keys the engine handles are cancelled, so the browser does not undo too.
 *
 * Chrome runs its own page-level undo on Ctrl+Z unless the key is cancelled. One Ctrl+Z on
 * the image removed the stroke and also reverted the last text typed anywhere on the page;
 * the browser's undo then moved focus into that field, so the next Ctrl+Y went to the browser
 * and never reached the engine.
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
  core.undoLastPainting = vi.fn();
  core.redoLastPainting = vi.fn();
  core.initDrawToolCore();
  core.eventRouter.bindAll();
  return { core, container };
}

function press(container: HTMLElement, init: KeyboardEventInit) {
  const e = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  container.dispatchEvent(e);
  return e;
}

describe("undo and redo keys", () => {
  it("Ctrl+Z undoes once and cancels the browser's own undo", () => {
    const { core, container } = makeCore();
    const e = press(container, { key: "z", ctrlKey: true });
    expect(core.undoLastPainting).toHaveBeenCalledOnce();
    expect(core.redoLastPainting).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(true);
  });

  it("Ctrl+Y redoes once and cancels the browser's own redo", () => {
    const { core, container } = makeCore();
    const e = press(container, { key: "y", ctrlKey: true });
    expect(core.redoLastPainting).toHaveBeenCalledOnce();
    expect(e.defaultPrevented).toBe(true);
  });

  it("Ctrl+Shift+Z redoes once, does not undo, and cancels the browser's redo", () => {
    const { core, container } = makeCore();
    const e = press(container, { key: "Z", ctrlKey: true, shiftKey: true });
    expect(core.redoLastPainting).toHaveBeenCalledOnce();
    expect(core.undoLastPainting).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(true);
  });

  it("leaves a plain z alone", () => {
    const { core, container } = makeCore();
    const e = press(container, { key: "z" });
    expect(core.undoLastPainting).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
  });
});
