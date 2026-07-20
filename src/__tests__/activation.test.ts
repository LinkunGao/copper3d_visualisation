import { describe, it, expect, vi } from "vitest";
import * as THREE from "three";
import { SurfaceAnnotator } from "../Utils/surfaceAnnotation/SurfaceAnnotator";

function make(onInteractionChange?: any) {
  const geo = new THREE.PlaneGeometry(2, 2, 2, 2).toNonIndexed();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
  const controls = { enabled: true };
  const a = new SurfaceAnnotator({ scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(), container: document.createElement("div"),
    controls, mesh, onInteractionChange } as never);
  return { a, controls };
}
const key = (type: string, code = "Space") =>
  window.dispatchEvent(new KeyboardEvent(type, { code, key: code === "Space" ? " " : code }));

describe("activate / deactivate", () => {
  it("dormant annotator ignores Space (no draw-lock toggle)", async () => {
    const cb = vi.fn();
    const { a, controls } = make(cb);
    a.setMode("freehand");
    a.deactivate();
    key("keydown"); key("keyup");
    await new Promise((r) => setTimeout(r, 0));
    expect(controls.enabled).toBe(true); // still navigable, no lock
  });

  it("re-activating restores input handling", async () => {
    const cb = vi.fn();
    const { a, controls } = make(cb);
    a.setMode("freehand");
    a.deactivate();
    a.activate();
    key("keydown"); key("keyup");
    await new Promise((r) => setTimeout(r, 0));
    expect(controls.enabled).toBe(false); // draw-lock toggled on again
  });

  it("deactivate un-gates the camera if it was locked", async () => {
    const { a, controls } = make(vi.fn());
    a.setMode("freehand");
    key("keydown"); key("keyup"); // tap → draw-lock on → controls disabled
    await new Promise((r) => setTimeout(r, 0));
    expect(controls.enabled).toBe(false);
    a.deactivate();
    expect(controls.enabled).toBe(true);
  });
});