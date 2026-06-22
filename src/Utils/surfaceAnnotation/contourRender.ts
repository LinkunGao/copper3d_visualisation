import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial";
import type { AnnotationVertex } from "./types";
import { localVertexToWorld } from "./types";

/**
 * Flatten a sequence of annotation vertices (local) into the world [x,y,z, ...] that Line2 needs.
 * Each point goes local→world, then is pushed outward along the world normal by epsilon to avoid
 * z-fighting with the model surface.
 * When closed, the first point is appended to the end to form a ring.
 */
function flatten(
  verts: AnnotationVertex[],
  closed: boolean,
  epsilon: number,
  mesh: THREE.Mesh
): number[] {
  const pts: number[] = [];
  const push = (v: AnnotationVertex) => {
    const { p, n } = localVertexToWorld(v, mesh);
    pts.push(p.x + n.x * epsilon, p.y + n.y * epsilon, p.z + n.z * epsilon);
  };
  verts.forEach(push);
  if (closed && verts.length > 1) push(verts[0]);
  return pts;
}

export function makeContourLine(
  verts: AnnotationVertex[],
  color: string,
  closed: boolean,
  container: HTMLElement,
  epsilon: number,
  mesh: THREE.Mesh
): Line2 {
  const geo = new LineGeometry();
  const pos = flatten(verts, closed, epsilon, mesh);
  // Line2 needs at least 2 points; when there aren't enough, give a degenerate placeholder that a later update fills in.
  geo.setPositions(pos.length >= 6 ? pos : [0, 0, 0, 0, 0, 0]);
  const mat = new LineMaterial({
    color: new THREE.Color(color).getHex(),
    linewidth: 3, // width in pixels (requires resolution to be set)
    // depthTest stays ON so the model correctly occludes the line when it is on the far side
    // (no see-through). The host applies polygonOffset to the SURFACE material so the line still
    // wins where it lies coplanar with the surface (no z-fighting / sinking on bumpy meshes).
  });
  mat.resolution.set(container.clientWidth, container.clientHeight);
  const line = new Line2(geo, mat);
  line.computeLineDistances();
  line.renderOrder = 998;
  // Important: Line2's bounding sphere stays at the initial point, so once the geometry grows by
  // dragging, the real geometry gets wrongly culled. Disable frustum culling so the line always renders.
  line.frustumCulled = false;
  return line;
}

export function updateContourLine(
  line: Line2,
  verts: AnnotationVertex[],
  closed: boolean,
  epsilon: number,
  mesh: THREE.Mesh
): void {
  const pos = flatten(verts, closed, epsilon, mesh);
  if (pos.length < 6) return; // Line2 needs >=2 points
  // Important: calling setPositions on the existing geometry to grow it only renders the first
  // segment (a known pitfall). Instead, rebuild and swap in a new LineGeometry each time so the
  // instance count is correct and every segment renders.
  const geo = new LineGeometry();
  geo.setPositions(pos);
  const old = line.geometry as LineGeometry;
  line.geometry = geo;
  old.dispose();
  line.computeLineDistances();
}

/** Change the color of an existing contour line. */
export function setContourColor(line: Line2, color: string): void {
  (line.material as LineMaterial).color.set(color);
}
