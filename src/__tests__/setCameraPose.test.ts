import { describe, expect, it, vi } from "vitest";
import type { Pose } from "../Controls/cameraTransitions";
import { setCameraPose } from "../Controls/setCameraPose";

function vec3() {
  const v = { x: 0, y: 0, z: 0, set: vi.fn((x, y, z) => { v.x = x; v.y = y; v.z = z; }) };
  return v;
}

function fakeScene(withControls = true) {
  return {
    camera: {
      position: vec3(),
      up: vec3(),
      lookAt: vi.fn(),
      updateProjectionMatrix: vi.fn(),
    },
    controls: withControls
      ? { target: vec3(), handleResize: vi.fn() }
      : undefined,
    calls: [] as string[],
  };
}

const pose: Pose = {
  position: [1, 2, 3],
  up: [0, 0, 1],
  target: [10, 20, 30],
};

describe("setCameraPose", () => {
  it("writes position, up and look-at", () => {
    const scene = fakeScene();

    setCameraPose(scene, pose);

    expect(scene.camera.position.set).toHaveBeenCalledWith(1, 2, 3);
    expect(scene.camera.up.set).toHaveBeenCalledWith(0, 0, 1);
    expect(scene.camera.lookAt).toHaveBeenCalledWith(10, 20, 30);
  });

  /**
   * The whole reason this function exists. Nothing syncs the orbit pivot with
   * `camera.lookAt()`, so without it the first drag calls `controls.update()`,
   * which re-aims the camera at the stale target and silently undoes the move.
   */
  it("syncs the controls' orbit pivot with the look-at point", () => {
    const scene = fakeScene();

    setCameraPose(scene, pose);

    expect(scene.controls!.target.set).toHaveBeenCalledWith(10, 20, 30);
  });

  it("sets up BEFORE lookAt, which builds the basis from it", () => {
    const order: string[] = [];
    const scene = fakeScene();
    scene.camera.up.set.mockImplementation(() => { order.push("up"); });
    scene.camera.lookAt.mockImplementation(() => { order.push("lookAt"); });

    setCameraPose(scene, pose);

    expect(order).toEqual(["up", "lookAt"]);
  });

  it("recomputes the trackball's cached canvas box", () => {
    const scene = fakeScene();

    setCameraPose(scene, pose);

    expect(scene.controls!.handleResize).toHaveBeenCalled();
  });

  it("does not render -- the caller decides when to draw", () => {
    const scene = fakeScene() as any;
    scene.render = vi.fn();
    scene.requestRenderIfNotRequested = vi.fn();

    setCameraPose(scene, pose);

    expect(scene.render).not.toHaveBeenCalled();
    expect(scene.requestRenderIfNotRequested).not.toHaveBeenCalled();
  });

  it("works on a scene with no controls, and on controls with no target", () => {
    expect(() => setCameraPose(fakeScene(false), pose)).not.toThrow();
    expect(() =>
      setCameraPose(
        { camera: fakeScene().camera, controls: {} },
        pose
      )
    ).not.toThrow();
  });
});
