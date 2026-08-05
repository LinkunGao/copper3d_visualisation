import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventRouter } from "../Utils/segmentation/eventRouter/EventRouter";
import { DragOperator } from "../Utils/segmentation/DragOperator";

/**
 * Regression cover for the "Shift after clicking a form field" trap.
 *
 * Keyboard events are bound to the annotator container, so any focus that sits
 * in a panel input swallows the Shift keydown. The router then still believes
 * Shift is up, left-drag scrubs slices instead of painting, and the drag can
 * never be released.
 */

/** jsdom has no PointerEvent; MouseEvent carries every field these handlers read. */
function pointer(type: string, init: MouseEventInit & { pointerId?: number } = {}) {
  return new MouseEvent(type, { bubbles: true, button: 0, ...init });
}

function makeRouter() {
  const container = document.createElement("div");
  const canvas = document.createElement("canvas");
  container.appendChild(canvas);
  document.body.appendChild(container);
  const router = new EventRouter({ container, canvas });
  router.bindAll();
  return { router, container, canvas };
}

describe("EventRouter modifier reconciliation", () => {
  it("enters draw mode when the Shift keydown never reached the container", () => {
    const { router, canvas } = makeRouter();
    router.setGuiTool("pencil");

    // Focus was in a findings input, so no keydown was ever delivered here.
    expect(router.isShiftHeld()).toBe(false);

    canvas.dispatchEvent(pointer("pointerdown", { shiftKey: true }));

    expect(router.getMode()).toBe("draw");
    // The critical consequence: this must NOT read as a slice-drag.
    expect(router.isDragSliceActive()).toBe(false);
  });

  it("leaves draw mode when Shift was released off-container", () => {
    const { router, container, canvas } = makeRouter();
    router.setGuiTool("pencil");

    container.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Shift", bubbles: true })
    );
    expect(router.getMode()).toBe("draw");

    // Keyup went to the input instead; the next pointer event is the only
    // evidence the router gets that Shift is no longer held.
    canvas.dispatchEvent(pointer("pointermove", { shiftKey: false }));

    expect(router.isShiftHeld()).toBe(false);
    expect(router.getMode()).toBe("idle");
  });

  it("clears held modifiers when the window loses focus", () => {
    const { router, container } = makeRouter();
    router.setGuiTool("pencil");

    container.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Shift", bubbles: true })
    );
    expect(router.getMode()).toBe("draw");

    // Alt-tab away while holding Shift: the keyup is never delivered.
    window.dispatchEvent(new Event("blur"));

    expect(router.isShiftHeld()).toBe(false);
    expect(router.getMode()).toBe("idle");
  });
});

describe("DragOperator listener lifecycle", () => {
  /** Counts live listeners per event type on the container. */
  function trackListeners(el: HTMLElement) {
    const live = new Map<string, number>();
    const add = el.addEventListener.bind(el);
    const remove = el.removeEventListener.bind(el);
    el.addEventListener = (type: string, ...rest: any[]) => {
      live.set(type, (live.get(type) ?? 0) + 1);
      return add(type, ...(rest as [any, any]));
    };
    el.removeEventListener = (type: string, ...rest: any[]) => {
      live.set(type, (live.get(type) ?? 0) - 1);
      return remove(type, ...(rest as [any, any]));
    };
    return live;
  }

  function makeOperator() {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const live = trackListeners(container);

    const gui_states = {
      viewConfig: { max_sensitive: 5, dragSensitivity: 1 },
      mode: { sphere: false, sphereBrush: false, sphereEraser: false },
    };
    const protectedData = {
      canvases: {
        drawingCanvasLayerMaster: document.createElement("canvas"),
        displayCanvas: document.createElement("canvas"),
      },
      layerTargets: new Map(),
    };

    const op = new DragOperator(
      container,
      {} as never,
      gui_states as never,
      protectedData as never,
      {} as never,
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn(),
      vi.fn()
    );
    op.drag();
    return { op, container, live };
  }

  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("detaches an in-flight pointermove when drag mode is torn down mid-drag", () => {
    const { op, container, live } = makeOperator();

    // Left button goes down -> drag starts and binds pointermove.
    container.dispatchEvent(pointer("pointerdown"));
    expect(live.get("pointermove")).toBe(1);

    // Shift auto-repeat now reaches the container and flips the mode to draw,
    // which tears down drag mode while the button is still held.
    (op as unknown as { removeDragMode: () => void }).removeDragMode();

    // pointerup is gone, so nothing else can ever detach the move listener.
    expect(live.get("pointermove")).toBe(0);
  });

  it("shift-click after a panel input draws instead of starting a stuck drag", () => {
    const { op, container, live } = makeOperator();
    const canvas = document.createElement("canvas");
    container.appendChild(canvas);

    const router = new EventRouter({ container, canvas });
    router.bindAll();
    router.setGuiTool("pencil");
    op.setEventRouter(router);

    // The user clicked a findings input, so the Shift keydown never arrived.
    // They press the left button on the canvas with Shift physically held.
    canvas.dispatchEvent(pointer("pointerdown", { shiftKey: true }));

    expect(router.getMode()).toBe("draw");
    expect(router.isDragSliceActive()).toBe(false);
    // The container's capture-phase listener starts the drag before the canvas
    // handler runs, so the mode flip must also unwind it in the same dispatch.
    expect(live.get("pointermove")).toBe(0);
  });
});
