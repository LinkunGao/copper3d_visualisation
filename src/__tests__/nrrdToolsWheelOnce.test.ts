/**
 * One wheel notch is one step. The EventRouter already listens for `wheel` on the drawing canvas
 * and calls the zoom/slice handler (only in zoom mode). `updateMouseWheelEvent` used to add the
 * same handler to the same canvas as well, so after Ctrl+1/2 or a slice drag every notch was
 * handled twice -- and the direct copy ignored the router's mode, firing during sphere placement.
 */
import { describe, expect, it, vi } from "vitest";
import { NrrdTools } from "../Utils/segmentation/NrrdTools";
import { EventRouter } from "../Utils/segmentation/eventRouter/EventRouter";

function makeInstance(routerDispatches: boolean) {
  const container = document.createElement("div");
  const canvas = document.createElement("canvas");
  container.appendChild(canvas);
  const eventRouter = new EventRouter({ container, canvas });

  const sliceHandler = vi.fn();
  const instance: any = Object.create(NrrdTools.prototype);
  instance.state = {
    protectedData: { canvases: { drawingCanvas: canvas } },
    keyboardSettings: { mouseWheel: "Scroll:Slice" },
  };
  instance.drawCore = {
    eventRouter,
    drawingPrameters: { handleMouseZoomSliceWheel: () => {} },
    configMouseZoomWheel: () => vi.fn(),
  };
  instance.configMouseSliceWheel = () => sliceHandler;

  // DrawToolCore's wheel handler: in zoom mode it calls the current zoom/slice handler; in a
  // sphere mode it calls a different one.
  eventRouter.setWheelHandler((e: WheelEvent) => {
    if (routerDispatches) instance.drawCore.drawingPrameters.handleMouseZoomSliceWheel(e);
  });
  eventRouter.bindAll();
  return { instance, canvas, sliceHandler, eventRouter };
}

describe("NrrdTools.updateMouseWheelEvent", () => {
  it("leaves one wheel event handled once", () => {
    const { instance, canvas, sliceHandler, eventRouter } = makeInstance(true);
    instance.updateMouseWheelEvent();

    canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: 100, cancelable: true }));

    expect(sliceHandler).toHaveBeenCalledTimes(1);
    eventRouter.unbindAll();
  });

  it("stays once after being called again (Ctrl+1/2, slice-drag start and end)", () => {
    const { instance, canvas, sliceHandler, eventRouter } = makeInstance(true);
    instance.updateMouseWheelEvent();
    instance.updateMouseWheelEvent();
    instance.updateMouseWheelEvent();

    canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: 100, cancelable: true }));

    expect(sliceHandler).toHaveBeenCalledTimes(1);
    eventRouter.unbindAll();
  });

  it("does not fire when the router's mode sends the wheel elsewhere (sphere placement)", () => {
    const { instance, canvas, sliceHandler, eventRouter } = makeInstance(false);
    instance.updateMouseWheelEvent();

    canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: 100, cancelable: true }));

    expect(sliceHandler).not.toHaveBeenCalled();
    eventRouter.unbindAll();
  });
});
