import { describe, it, expect } from "vitest";
import { AnnotationStore } from "../annotationStore";
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
});
