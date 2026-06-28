import { describe, it, expect, beforeEach } from "vitest";
import * as THREE from "three";
import { SurfaceAnnotator } from "../SurfaceAnnotator";

function makeAnnotator() {
  const geo = new THREE.PlaneGeometry(2, 2, 4, 4).toNonIndexed();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial());
  mesh.updateMatrixWorld(true);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera();
  const container = document.createElement("div");
  return new SurfaceAnnotator({
    scene, camera, container, controls: { enabled: true }, mesh,
  } as never);
}

describe("importAnnotations", () => {
  let a: SurfaceAnnotator;
  beforeEach(() => { a = makeAnnotator(); });

  it("rebuilds a points annotation and adds it to the store", () => {
    const n = a.importAnnotations({ annotations: [{
      type: "points", mode: null, label: "p1", color: "#0f0",
      closed: false, points: [[0, 0, 0]] }] });
    expect(n).toBe(1);
    const list = a.getAnnotations();
    expect(list).toHaveLength(1);
    expect(list[0].label).toBe("p1");
    expect(list[0].object3D).not.toBeNull();
    expect(list[0].visible).toBe(true);
  });

  it("rebuilds a contour with >=2 points", () => {
    a.importAnnotations({ annotations: [{
      type: "contour", mode: "geodesic", label: "c1", color: "#f0f",
      closed: true, points: [[-0.5, 0, 0], [0.5, 0, 0], [0, 0.5, 0]] }] });
    expect(a.getAnnotations()[0].type).toBe("contour");
  });
});
