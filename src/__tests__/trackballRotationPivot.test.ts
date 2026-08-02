import { PerspectiveCamera, Vector3 } from "three";
import { beforeEach, describe, expect, it } from "vitest";
import { Copper3dTrackballControls } from "../Controls/Copper3dTrackballControls";

/**
 * `rotationPivot` decides what a rotate does to a pan.
 *
 * `panCamera` moves `target` with the camera, so after a pan `target` is no
 * longer the content's centre and a rotate swings the content through an arc
 * around an empty point. The alternative -- snapping `target` back -- fixes the
 * axis but throws the pan away. The pivot keeps both: the camera AND the target
 * rotate rigidly about it.
 *
 * The invariant a rigid rotation about C gives, and the only one worth pinning,
 * is that every distance to C survives it. Both of these are silent failures --
 * the wrong one still renders a plausible picture -- so they are asserted rather
 * than eyeballed.
 */

let element: HTMLElement;
let camera: PerspectiveCamera;

/** The volume's centre in these tests. */
const PIVOT = new Vector3(0, 0, 0);

function makeControls(): Copper3dTrackballControls {
  const controls = new Copper3dTrackballControls(camera, element);
  // happy-dom reports an all-zero box, which makes every pointer position
  // degenerate. A real canvas box is what the class caches here.
  controls.screen = { left: 0, top: 0, width: 800, height: 600 };
  controls.staticMoving = true;
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

/** A rotate gesture, applied. */
function rotate(controls: Copper3dTrackballControls) {
  element.dispatchEvent(pointer("pointerdown", 400, 300));
  element.dispatchEvent(pointer("pointermove", 500, 260));
  controls.update();
}

/**
 * The state a pan leaves behind: camera and target both displaced by the same
 * vector. Written directly rather than driven through a pan gesture, so these
 * tests pin the rotation and not the pan's own plumbing.
 */
function panBy(controls: Copper3dTrackballControls, offset: Vector3) {
  camera.position.add(offset);
  controls.target.add(offset);
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

describe("rotationPivot unset (the historical behaviour)", () => {
  it("orbits the panned target, leaving it where the pan put it", () => {
    const controls = makeControls();
    panBy(controls, new Vector3(3, 0, 0));

    rotate(controls);

    // The target never moves, so rotation orbits a point 3 units off the volume's
    // centre -- which is exactly the complaint the pivot exists to answer.
    expect(controls.target.x).toBeCloseTo(3, 6);
    expect(camera.position.distanceTo(controls.target)).toBeCloseTo(10, 5);
    expect(camera.position.distanceTo(PIVOT)).not.toBeCloseTo(
      Math.hypot(3, 0, 10),
      3
    );
  });
});

describe("rotationPivot set to the content's centre", () => {
  it("keeps the camera's distance to the pivot", () => {
    const controls = makeControls();
    controls.rotationPivot = PIVOT.clone();
    panBy(controls, new Vector3(3, 0, 0));
    const before = camera.position.distanceTo(PIVOT);

    rotate(controls);

    expect(camera.position.distanceTo(PIVOT)).toBeCloseTo(before, 5);
  });

  it("keeps the pan offset, so the content stays where it was dragged to", () => {
    const controls = makeControls();
    controls.rotationPivot = PIVOT.clone();
    panBy(controls, new Vector3(3, 0, 0));

    rotate(controls);

    // The offset is carried around the pivot rather than discarded: same length,
    // different direction.
    expect(controls.target.distanceTo(PIVOT)).toBeCloseTo(3, 5);
    expect(controls.target.x).not.toBeCloseTo(3, 3);
  });

  it("holds the camera-to-target distance, so the framing does not change", () => {
    const controls = makeControls();
    controls.rotationPivot = PIVOT.clone();
    panBy(controls, new Vector3(3, -2, 0));
    const before = camera.position.distanceTo(controls.target);

    rotate(controls);

    expect(camera.position.distanceTo(controls.target)).toBeCloseTo(before, 5);
  });

  it("actually rotates -- the pivot is not a lock", () => {
    const controls = makeControls();
    controls.rotationPivot = PIVOT.clone();
    panBy(controls, new Vector3(3, 0, 0));
    const before = camera.position.clone();

    rotate(controls);

    expect(camera.position.distanceTo(before)).toBeGreaterThan(0.01);
  });

  it("is a no-op with nothing panned, so an un-panned viewer cannot tell", () => {
    const pivoted = makeControls();
    pivoted.rotationPivot = PIVOT.clone();
    rotate(pivoted);
    const withPivot = camera.position.clone();
    const targetWithPivot = pivoted.target.clone();

    // Same gesture again on a fresh, pivot-less pair.
    camera = new PerspectiveCamera(45, 4 / 3, 0.1, 1000);
    camera.position.set(0, 0, 10);
    element = document.createElement("div");
    (element as any).setPointerCapture = () => {};
    (element as any).releasePointerCapture = () => {};
    document.body.appendChild(element);
    const plain = makeControls();
    rotate(plain);

    expect(camera.position.distanceTo(withPivot)).toBeCloseTo(0, 6);
    expect(plain.target.distanceTo(targetWithPivot)).toBeCloseTo(0, 6);
  });
});
