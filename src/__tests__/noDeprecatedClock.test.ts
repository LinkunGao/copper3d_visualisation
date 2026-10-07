/**
 * three r185 deprecates `THREE.Clock` and warns on every construction; every viewer panel
 * built one per renderer and one per scene. The engine uses `THREE.Timer` instead, which only
 * advances on `update()`, so these also pin that each frame updates it before reading.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";

// The real base builds a WebGLRenderer, which jsdom cannot; the frame loop needs none of it.
vi.mock("../Renderer/baseRenderer", () => ({
  baseRenderer: class {
    running = true;
    options: unknown;
    constructor(_container: unknown, options?: unknown) {
      this.options = options;
    }
  },
}));

import { copperRenderer } from "../Renderer/copperRenderer";
import { copperScene } from "../Scene/copperScene";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("copperRenderer frame timer", () => {
  it("is a Timer, not the deprecated Clock", () => {
    const r: any = new copperRenderer(document.createElement("div"));
    expect(r.renderClock).toBeInstanceOf(THREE.Timer);
  });

  it("advances the timer on each animated frame", () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);
    const r: any = new copperRenderer(document.createElement("div"));
    r.render = vi.fn();
    const update = vi.spyOn(r.renderClock, "update");

    r.animate();
    r.animate();

    expect(update).toHaveBeenCalledTimes(2);
  });
});

describe("copperScene animation timer", () => {
  function scene(modelReady: boolean) {
    const s: any = Object.create(copperScene.prototype);
    Object.assign(s, {
      clock: new THREE.Timer(),
      controls: { update: vi.fn() },
      modelReady,
      mixer: { update: vi.fn() },
      playRate: 1,
      preRenderCallbackFunctions: { cache: [] },
      renderer: { render: vi.fn() },
    });
    return s;
  }

  it("advances the timer every frame, even before a model is ready", () => {
    const s = scene(false);
    const update = vi.spyOn(s.clock, "update");

    s.render();

    expect(update).toHaveBeenCalledOnce();
  });

  it("steps the mixer by the frame's delta", () => {
    const s = scene(true);
    vi.spyOn(s.clock, "getDelta").mockReturnValue(0.016);

    s.render();

    expect(s.mixer.update).toHaveBeenCalledWith(0.016);
  });
});
