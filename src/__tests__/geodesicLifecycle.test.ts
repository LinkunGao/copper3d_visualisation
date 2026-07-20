import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { SurfaceAnnotator } from "../Utils/surfaceAnnotation/SurfaceAnnotator";

function makeAnnotator() {
  const geo = new THREE.PlaneGeometry(2, 2, 6, 6).toNonIndexed();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
  mesh.updateMatrixWorld(true);
  const scene = new THREE.Scene();
  const a = new SurfaceAnnotator({
    scene,
    camera: new THREE.PerspectiveCamera(),
    container: document.createElement("div"),
    controls: { enabled: true },
    mesh,
  } as never);
  return { a, scene };
}

function importGeodesic(a: SurfaceAnnotator) {
  a.importAnnotations({
    annotations: [{
      type: "contour", mode: "geodesic", label: "c1", color: "#a855f7", closed: true,
      points: [[-0.5, 0, 0], [0.5, 0, 0], [0, 0.5, 0], [-0.5, 0, 0]],
      anchors: [[-0.5, 0, 0], [0.5, 0, 0], [0, 0.5, 0]],
    }],
  });
  return a.getAnnotations()[0].id;
}

describe("geodesic edit lifecycle", () => {
  it("deleting the annotation being edited removes its anchor handles (no orphans)", () => {
    const { a, scene } = makeAnnotator();
    const id = importGeodesic(a);
    a.setMode("geodesic");
    a.selectAnnotation(id); // opens the edit session → anchor handles added to the scene
    expect(scene.children.length).toBeGreaterThan(1); // line + handles

    a.deleteAnnotation(id);
    expect(scene.children.length).toBe(0); // line + all handles gone, nothing orphaned
  });

  it("clearing all while editing leaves nothing in the scene", () => {
    const { a, scene } = makeAnnotator();
    const id = importGeodesic(a);
    a.setMode("geodesic");
    a.selectAnnotation(id);
    a.clearAll();
    expect(scene.children.length).toBe(0);
  });

  it("deselecting (re-click / select null) while editing ends the session, keeps the line", () => {
    const { a, scene } = makeAnnotator();
    const id = importGeodesic(a);
    a.setMode("geodesic");
    a.selectAnnotation(id);
    expect(scene.children.length).toBeGreaterThan(1); // line + handles
    a.selectAnnotation(null); // toggle-off / deselect
    expect(scene.children.length).toBe(1); // handles gone, committed line remains
  });

  it("selecting a geodesic switches to Geodesic mode and opens its anchor handles", () => {
    const { a, scene } = makeAnnotator();
    const id = importGeodesic(a);
    a.selectAnnotation(id); // from the default Navigate mode
    expect(a.getMode()).toBe("geodesic");
    expect(scene.children.length).toBeGreaterThan(1); // line + handles
  });

  it("returning to Navigate deselects and notifies the UI", () => {
    const geo = new THREE.PlaneGeometry(2, 2, 6, 6).toNonIndexed();
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
    mesh.updateMatrixWorld(true);
    const selections: (string | null)[] = [];
    const a = new SurfaceAnnotator({
      scene: new THREE.Scene(),
      camera: new THREE.PerspectiveCamera(),
      container: document.createElement("div"),
      controls: { enabled: true },
      mesh,
      onSelectionChange: (id: string | null) => selections.push(id),
    } as never);
    const id = importGeodesic(a);
    a.setMode("geodesic");
    a.selectAnnotation(id);
    a.setMode("navigate");
    expect(selections.at(-1)).toBe(null); // engine cleared selection and told the UI
  });
});