import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils";
import { MeshGraph } from "../Utils/surfaceAnnotation/MeshGraph";
import { GeodesicContour } from "../Utils/surfaceAnnotation/geodesicContour";

function setup() {
  const geo = mergeVertices(new THREE.PlaneGeometry(4, 4, 8, 8));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
  const graph = new MeshGraph(geo);
  return { graph, mesh };
}

describe("geodesic anchor editing", () => {
  it("getAnchorIndices reflects the placed anchors", () => {
    const { graph, mesh } = setup();
    const gc = new GeodesicContour(graph, mesh);
    gc.addAnchor(new THREE.Vector3(-2, -2, 0));
    gc.addAnchor(new THREE.Vector3(0, 0, 0));
    gc.addAnchor(new THREE.Vector3(2, 2, 0));
    expect(gc.getAnchorIndices()).toHaveLength(3);
  });

  it("moveAnchorTo relocates one anchor and rebuilds adjacent segments", () => {
    const { graph, mesh } = setup();
    const gc = new GeodesicContour(graph, mesh);
    gc.addAnchor(new THREE.Vector3(-2, 0, 0));
    gc.addAnchor(new THREE.Vector3(0, 0, 0));
    gc.addAnchor(new THREE.Vector3(2, 0, 0));
    const before = gc.getAnchorIndices()[1];

    gc.moveAnchorTo(1, new THREE.Vector3(0, 2, 0)); // pull the middle anchor up
    const after = gc.getAnchorIndices()[1];
    expect(after).not.toBe(before);

    // The middle anchor's new local position is now near (0, 2).
    const anchorLocals = gc.getAnchorLocals();
    expect(anchorLocals[1].y).toBeCloseTo(2, 5);

    // The rebuilt line still starts/ends at the outer anchors.
    const verts = gc.buildVertices(false);
    expect(verts[0].x).toBeCloseTo(-2, 5);
    expect(verts[verts.length - 1].x).toBeCloseTo(2, 5);
  });

  it("insertAnchorAt adds an anchor between two existing ones", () => {
    const { graph, mesh } = setup();
    const gc = new GeodesicContour(graph, mesh);
    gc.addAnchor(new THREE.Vector3(-2, 0, 0));
    gc.addAnchor(new THREE.Vector3(2, 0, 0));
    expect(gc.getAnchorIndices()).toHaveLength(2);
    gc.insertAnchorAt(1, new THREE.Vector3(0, 0, 0));
    const locals = gc.getAnchorLocals();
    expect(locals).toHaveLength(3);
    expect(locals[1].x).toBeCloseTo(0, 5);
    expect(locals[1].y).toBeCloseTo(0, 5);
  });

  it("nearestInsertIndex finds the edge the click lands on", () => {
    const { graph, mesh } = setup();
    mesh.updateMatrixWorld(true);
    const gc = new GeodesicContour(graph, mesh);
    gc.addAnchor(new THREE.Vector3(-2, 0, 0));
    gc.addAnchor(new THREE.Vector3(2, 0, 0)); // single edge along y=0
    // A point on the edge is within tolerance â†’ interval 0.
    expect(
      gc.nearestInsertIndex(new THREE.Vector3(0, 0, 0), mesh.matrixWorld, false, 0.5)
    ).toBe(0);
    // A point far from the edge â†’ -1.
    expect(
      gc.nearestInsertIndex(new THREE.Vector3(0, 1.8, 0), mesh.matrixWorld, false, 0.2)
    ).toBe(-1);
  });

  it("fromAnchors reproduces an identical contour from anchor indices", () => {
    const { graph, mesh } = setup();
    const gc = new GeodesicContour(graph, mesh);
    gc.addAnchor(new THREE.Vector3(-2, 0, 0));
    gc.addAnchor(new THREE.Vector3(0, 2, 0));
    gc.addAnchor(new THREE.Vector3(2, 0, 0));

    const rebuilt = GeodesicContour.fromAnchors(graph, mesh, gc.getAnchorIndices());
    const a = gc.buildVertices(false);
    const b = rebuilt.buildVertices(false);
    expect(b.length).toBe(a.length);
    for (let i = 0; i < a.length; i++) {
      expect(b[i].x).toBeCloseTo(a[i].x, 6);
      expect(b[i].y).toBeCloseTo(a[i].y, 6);
      expect(b[i].z).toBeCloseTo(a[i].z, 6);
    }
  });
});
