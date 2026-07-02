import * as THREE from "three";
import type { AnnotationVertex } from "./types";
import { localVertexToWorld } from "./types";

/**
 * Create a marker sphere (fiducial) at a local vertex. After local→world, nudge it
 * outward along the world normal so it doesn't sink halfway into the surface.
 * radius is passed in by the caller, scaled to the model bbox.
 */
export function makePointMarker(
  v: AnnotationVertex,
  mesh: THREE.Mesh,
  color: string,
  radius: number
): THREE.Mesh {
  const geo = new THREE.SphereGeometry(radius, 16, 16);
  // depthTest ON so markers are occluded by the model when they are on the far side (no
  // see-through), consistent with the contour lines. Markers are volumetric spheres lifted off
  // the surface, so they still show on the visible side without z-fighting.
  const mat = new THREE.MeshBasicMaterial({ color });
  const m = new THREE.Mesh(geo, mat);
  const { p, n } = localVertexToWorld(v, mesh);
  m.position.copy(p.addScaledVector(n, radius * 0.5));
  m.renderOrder = 999;
  return m;
}

/**
 * Create a draggable ANCHOR HANDLE (for the geodesic editor): a white outer rim around a
 * tool-colored core, so the handle stands out against both the (same-colored) contour line and the
 * grey surface. Returned as a Group; scale it to show hover/selection feedback. depthTest stays ON
 * (occluded by the model on the far side) and it's lifted a touch more than a plain marker so it
 * sits above the thickened line rather than sinking into it.
 */
export function makeAnchorHandle(
  v: AnnotationVertex,
  mesh: THREE.Mesh,
  coreColor: string,
  radius: number
): THREE.Group {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 16, 16),
    new THREE.MeshBasicMaterial({ color: "#ffffff" })
  );
  rim.renderOrder = 1000;
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 0.6, 16, 16),
    new THREE.MeshBasicMaterial({ color: coreColor })
  );
  core.renderOrder = 1001;
  g.add(rim);
  g.add(core);
  const { p, n } = localVertexToWorld(v, mesh);
  g.position.copy(p.addScaledVector(n, radius * 0.7));
  return g;
}
