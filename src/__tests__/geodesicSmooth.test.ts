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

type P = { x: number; y: number; z: number };
function roughness(pts: P[]): number {
  let s = 0;
  for (let k = 1; k < pts.length - 1; k++) {
    const mx = (pts[k - 1].x + pts[k + 1].x) / 2;
    const my = (pts[k - 1].y + pts[k + 1].y) / 2;
    const mz = (pts[k - 1].z + pts[k + 1].z) / 2;
    s += Math.hypot(pts[k].x - mx, pts[k].y - my, pts[k].z - mz);
  }
  return s;
}

describe("geodesic smoothing", () => {
  it("pins endpoints, preserves point count, and reduces roughness", () => {
    const { graph, mesh } = setup();
    const gc = new GeodesicContour(graph, mesh);
    // A peak: up-right then down-right forces a staircased path with clear corners.
    gc.addAnchor(new THREE.Vector3(-2, 0, 0));
    gc.addAnchor(new THREE.Vector3(0, 2, 0));
    gc.addAnchor(new THREE.Vector3(2, 0, 0));
    const smoothed = gc.buildVertices(false);

    // Reconstruct the raw stitched path (mirrors buildVertices WITHOUT smoothing).
    const vA = graph.nearestVertex(new THREE.Vector3(-2, 0, 0));
    const vB = graph.nearestVertex(new THREE.Vector3(0, 2, 0));
    const vC = graph.nearestVertex(new THREE.Vector3(2, 0, 0));
    const idx = graph.shortestPath(vA, vB).concat(graph.shortestPath(vB, vC).slice(1));
    const raw = idx.map((i) => graph.vertexLocal(i));

    // Same number of points (smoothing repositions, it does not resample).
    expect(smoothed.length).toBe(raw.length);

    // Endpoints (anchors) stay pinned.
    expect(smoothed[0].x).toBeCloseTo(raw[0].x, 5);
    expect(smoothed[0].y).toBeCloseTo(raw[0].y, 5);
    expect(smoothed[smoothed.length - 1].x).toBeCloseTo(raw[raw.length - 1].x, 5);
    expect(smoothed[smoothed.length - 1].y).toBeCloseTo(raw[raw.length - 1].y, 5);

    // The raw path actually zigzags, and smoothing reduces that zigzag.
    const rawR = roughness(raw);
    expect(rawR).toBeGreaterThan(0);
    expect(roughness(smoothed)).toBeLessThan(rawR);

    // All points stay on the z=0 plane and carry a valid normal.
    for (const p of smoothed) {
      expect(Math.abs(p.z)).toBeLessThan(1e-6);
      expect(Math.hypot(p.nx, p.ny, p.nz)).toBeGreaterThan(0.5);
    }
  });
});
