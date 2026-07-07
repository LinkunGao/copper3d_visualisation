import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { AnnotationStore } from "../annotationStore";
import { SurfaceAnnotator } from "../SurfaceAnnotator";
import type { Annotation } from "../types";

function ann(id: string): Annotation {
  return { id, type: "points", mode: null, label: id, color: "#fff",
           closed: false, visible: true, vertices: [], object3D: null };
}

describe("visibility", () => {
  it("setVisible flips the flag and notifies", () => {
    const s = new AnnotationStore();
    let hits = 0; s.subscribe(() => hits++);
    s.add(ann("a1"));
    s.setVisible("a1", false);
    expect(s.get("a1")!.visible).toBe(false);
    expect(hits).toBeGreaterThanOrEqual(2);
  });

  it("toJSON includes visible", () => {
    const s = new AnnotationStore();
    s.add(ann("a1"));
    const out = s.toJSON("m", { matrixWorld: {} } as never, {});
    expect(out.annotations[0]).toHaveProperty("visible", true);
  });

  it("setAllVisible flips every annotation and its object3D", () => {
    // Build an annotator, import two annotations, then hide all.
    const geo = new THREE.PlaneGeometry(2, 2, 2, 2).toNonIndexed();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
    const a = new SurfaceAnnotator({ scene: new THREE.Scene(),
      camera: new THREE.PerspectiveCamera(), container: document.createElement("div"),
      controls: { enabled: true }, mesh } as never);
    a.importAnnotations({ annotations: [
      { type: "points", mode: null, label: "p", color: "#fff", closed: false, points: [[0,0,0]] },
      { type: "points", mode: null, label: "q", color: "#fff", closed: false, points: [[1,0,0]] },
    ] });
    a.setAllVisible(false);
    expect(a.getAnnotations().every((x) => x.visible === false)).toBe(true);
    expect(a.getAnnotations().every((x) => x.object3D!.visible === false)).toBe(true);
    a.setAllVisible(true);
    expect(a.getAnnotations().every((x) => x.visible === true)).toBe(true);
  });
});
