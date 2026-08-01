import { PerspectiveCamera } from "three";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Copper3dTrackballControls } from "../Controls/Copper3dTrackballControls";

/**
 * `updateOnInput` exists for on-demand rendering, where the only thing that
 * ever schedules a frame is a `change` listener -- and `change` only comes out
 * of `update()`, which only a frame runs. These pin both sides of that: the
 * historical default still records-and-waits, and the flag makes a drag move
 * the camera on the spot.
 */

let element: HTMLElement;
let camera: PerspectiveCamera;

function makeControls(): Copper3dTrackballControls {
  const controls = new Copper3dTrackballControls(camera, element);
  // The screen box happy-dom reports is all zeros, which makes every pointer
  // position degenerate. A real canvas box is what the class caches here.
  controls.screen = { left: 0, top: 0, width: 800, height: 600 };
  return controls;
}

function pointer(type: string, x: number, y: number): PointerEvent {
  const event = new Event(type, { bubbles: true }) as any;
  event.pointerId = 1;
  event.pointerType = "mouse";
  event.button = 0;
  event.pageX = x;
  event.pageY = y;
  event.clientX = x;
  event.clientY = y;
  return event as PointerEvent;
}

function drag(el: HTMLElement, from: [number, number], to: [number, number]) {
  el.dispatchEvent(pointer("pointerdown", from[0], from[1]));
  el.dispatchEvent(pointer("pointermove", to[0], to[1]));
}

beforeEach(() => {
  element = document.createElement("div");
  // happy-dom implements neither, and the class calls both around a gesture.
  (element as any).setPointerCapture = () => {};
  (element as any).releasePointerCapture = () => {};
  document.body.appendChild(element);

  camera = new PerspectiveCamera(45, 4 / 3, 0.1, 1000);
  camera.position.set(0, 0, 10);
});

describe("updateOnInput off (the default)", () => {
  it("records a drag without moving the camera or dispatching change", () => {
    const controls = makeControls();
    const onChange = vi.fn();
    controls.addEventListener("change" as never, onChange);
    const before = camera.position.clone();

    drag(element, [400, 300], [500, 300]);

    expect(onChange).not.toHaveBeenCalled();
    expect(camera.position.equals(before)).toBe(true);
  });

  it("still moves once something calls update(), as it always did", () => {
    const controls = makeControls();
    const onChange = vi.fn();
    controls.addEventListener("change" as never, onChange);

    drag(element, [400, 300], [500, 300]);
    controls.update();

    expect(onChange).toHaveBeenCalled();
    expect(camera.position.x).not.toBe(0);
  });
});

describe("updateOnInput on", () => {
  it("moves the camera and dispatches change from the drag itself", () => {
    const controls = makeControls();
    controls.updateOnInput = true;
    const onChange = vi.fn();
    controls.addEventListener("change" as never, onChange);

    drag(element, [400, 300], [500, 300]);

    expect(onChange).toHaveBeenCalled();
    expect(camera.position.x).not.toBe(0);
  });

  it("reports the moved camera to the listener, not a stale one", () => {
    const controls = makeControls();
    controls.updateOnInput = true;
    let xAtDispatch = Number.NaN;
    controls.addEventListener("change" as never, () => {
      xAtDispatch = camera.position.x;
    });

    drag(element, [400, 300], [500, 300]);

    expect(xAtDispatch).toBe(camera.position.x);
    expect(xAtDispatch).not.toBe(0);
  });

  it("wheel zoom lands within the gesture instead of waiting for a frame", () => {
    const controls = makeControls();
    controls.updateOnInput = true;
    controls.staticMoving = true;
    const distanceBefore = camera.position.length();

    const wheel = new Event("wheel", { bubbles: true }) as any;
    wheel.deltaY = -120;
    wheel.deltaMode = 0;
    element.dispatchEvent(wheel);

    expect(camera.position.length()).not.toBeCloseTo(distanceBefore, 6);
  });

  it("respects noRotate -- the lock is not a rendering concern", () => {
    const controls = makeControls();
    controls.updateOnInput = true;
    controls.noRotate = true;
    const before = camera.position.clone();

    drag(element, [400, 300], [500, 300]);

    expect(camera.position.equals(before)).toBe(true);
  });

  it("does nothing at all while disabled", () => {
    const controls = makeControls();
    controls.updateOnInput = true;
    controls.enabled = false;
    const onChange = vi.fn();
    controls.addEventListener("change" as never, onChange);
    const before = camera.position.clone();

    drag(element, [400, 300], [500, 300]);

    expect(onChange).not.toHaveBeenCalled();
    expect(camera.position.equals(before)).toBe(true);
  });
});
