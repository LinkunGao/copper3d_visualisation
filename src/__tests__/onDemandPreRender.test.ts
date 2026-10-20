/**
 * Per-frame callbacks on an on-demand scene.
 *
 * `copperSceneOnDemond` inherits `addPreRenderCallbackFunction` from the common scene, but its
 * render never ran the registry: registering returned an id and the callback never ran. The
 * documented `scene.addPreRenderCallbackFunction(nrrdTools.start)` therefore drew no mask, brush
 * ring or crosshair -- with no error. The scene now runs its own frame loop while anything is
 * registered, and none while nothing is.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { copperSceneOnDemond } from "../Scene/copperSceneOnDemond";
import { createPreRenderRegistry } from "../Scene/preRenderRegistry";

let frames: Map<number, () => void>;
let nextId: number;

/** Runs the frames queued so far; frames they queue wait for the next call. */
function flushFrame() {
  const due = [...frames.values()];
  frames.clear();
  due.forEach((cb) => cb());
}

beforeEach(() => {
  frames = new Map();
  nextId = 1;
  vi.stubGlobal("requestAnimationFrame", (cb: () => void) => {
    frames.set(nextId, cb);
    return nextId++;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
});

afterEach(() => vi.unstubAllGlobals());

function makeScene() {
  const scene: any = Object.create(copperSceneOnDemond.prototype);
  scene.preRenderCallbackFunctions = createPreRenderRegistry();
  scene.callbackFrame = null;
  scene.controls = { removeEventListener: vi.fn(), enabled: true };
  return scene;
}

describe("copperSceneOnDemond pre-render callbacks", () => {
  it("runs a registered callback every frame", () => {
    const scene = makeScene();
    const cb = vi.fn();
    scene.addPreRenderCallbackFunction(cb);

    flushFrame();
    flushFrame();
    flushFrame();
    expect(cb).toHaveBeenCalledTimes(3);
  });

  it("runs one loop however many callbacks are registered", () => {
    const scene = makeScene();
    const a = vi.fn();
    const b = vi.fn();
    scene.addPreRenderCallbackFunction(a);
    scene.addPreRenderCallbackFunction(b);
    expect(frames.size).toBe(1);

    flushFrame();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("stops when the last callback is removed", () => {
    const scene = makeScene();
    const cb = vi.fn();
    const id = scene.addPreRenderCallbackFunction(cb);
    flushFrame();

    scene.removePreRenderCallbackFunction(id);
    expect(frames.size).toBe(0);
    flushFrame();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("keeps running after a callback throws", () => {
    const scene = makeScene();
    const cb = vi.fn(() => {
      throw new Error("boom");
    });
    scene.addPreRenderCallbackFunction(cb);

    expect(() => flushFrame()).toThrow("boom");
    expect(frames.size).toBe(1);
    expect(() => flushFrame()).toThrow("boom");
    expect(cb).toHaveBeenCalledTimes(2);
  });

  it("stops on dispose", () => {
    const scene = makeScene();
    scene.addPreRenderCallbackFunction(vi.fn());
    scene.dispose();
    expect(frames.size).toBe(0);
  });

  it("schedules nothing while nothing is registered", () => {
    makeScene();
    expect(frames.size).toBe(0);
  });
});
