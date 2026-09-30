/**
 * `dispose()` releases what a NrrdTools instance holds outside its own DOM subtree, so a
 * viewer that is torn down can be garbage-collected. The EventRouter's window `blur` listener
 * is the one that matters: it closes over the router, which reaches the whole engine graph.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { NrrdTools } from "../Utils/segmentation/NrrdTools";
import { EventRouter } from "../Utils/segmentation/eventRouter/EventRouter";

function makeInstance() {
  const container = document.createElement("div");
  const canvas = document.createElement("canvas");
  container.appendChild(canvas);
  const eventRouter = new EventRouter({ container, canvas });
  eventRouter.bindAll();
  const instance: any = Object.create(NrrdTools.prototype);
  instance.drawCore = { eventRouter };
  instance._sliceRAFId = null;
  instance._mirrors = new Set();
  instance._mirrorSource = null;
  instance._mirrorFrame = null;
  instance.preTimer = undefined;
  return { instance, eventRouter };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("NrrdTools.dispose", () => {
  it("removes the event router's window blur listener", () => {
    const { instance } = makeInstance();
    const remove = vi.spyOn(window, "removeEventListener");
    instance.dispose();
    expect(remove.mock.calls.some(([type]) => (type as string) === "blur")).toBe(true);
  });

  it("unbinds the event router so it can be bound again", () => {
    const { instance, eventRouter } = makeInstance();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    instance.dispose();
    eventRouter.bindAll();
    expect(warn).not.toHaveBeenCalled();
    eventRouter.unbindAll();
  });

  it("cancels a pending slice step and the drawing-flag timer", () => {
    const { instance } = makeInstance();
    const cancel = vi.spyOn(window, "cancelAnimationFrame");
    const clear = vi.spyOn(window, "clearTimeout");
    instance._sliceRAFId = 42;
    instance.preTimer = 7;
    instance.dispose();
    expect(cancel).toHaveBeenCalledWith(42);
    expect(clear).toHaveBeenCalledWith(7);
    expect(instance._sliceRAFId).toBeNull();
    expect(instance.preTimer).toBeUndefined();
  });

  it("is safe to call twice", () => {
    const { instance } = makeInstance();
    instance.dispose();
    expect(() => instance.dispose()).not.toThrow();
  });
});
