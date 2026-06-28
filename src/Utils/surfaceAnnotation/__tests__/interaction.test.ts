import { describe, it, expect, vi } from "vitest";
import * as THREE from "three";
import { SurfaceAnnotator } from "../SurfaceAnnotator";

function makeAnnotator(onInteractionChange: any) {
  const geo = new THREE.PlaneGeometry(2, 2, 2, 2).toNonIndexed();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
  const controls = { enabled: true };
  const a = new SurfaceAnnotator({ scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(), container: document.createElement("div"),
    controls, mesh, onInteractionChange } as never);
  return { a, controls };
}

function key(type: string, code = "Space") {
  window.dispatchEvent(new KeyboardEvent(type, { code, key: code === "Space" ? " " : code }));
}

describe("hybrid space", () => {
  it("defaults to navigate (camera enabled, not drawing)", () => {
    const cb = vi.fn();
    const { controls } = makeAnnotator(cb);
    expect(controls.enabled).toBe(true);
  });

  it("tap Space toggles draw lock", async () => {
    const cb = vi.fn();
    const { a, controls } = makeAnnotator(cb);
    a.setMode("freehand"); // arm but do not fire
    expect(controls.enabled).toBe(true); // still navigate by default
    key("keydown");
    key("keyup"); // quick tap
    await new Promise((r) => setTimeout(r, 0));
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ drawing: true, locked: true }));
    expect(controls.enabled).toBe(false);
  });
});
