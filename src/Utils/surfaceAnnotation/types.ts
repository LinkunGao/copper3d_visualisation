import * as THREE from "three";

export type AnnotationMode = "navigate" | "freehand" | "geodesic" | "point";

export interface SurfaceHit {
  point: THREE.Vector3; // world
  normal: THREE.Vector3; // interpolated normal (world)
  faceIndex: number;
}

/** Annotation vertex: position and normal are both in **model local space** (single source of truth, unaffected by camera/placement). */
export interface AnnotationVertex {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  faceIndex: number;
}

export interface Annotation {
  id: string;
  type: "contour" | "points";
  mode: "freehand" | "geodesic" | null; // null for points
  label: string;
  color: string; // hex, e.g. "#ff5a6e"
  closed: boolean;
  vertices: AnnotationVertex[];
  object3D: THREE.Object3D | null; // render-object reference (stripped on export)
}

export interface ExportOptions {
  /** Export coordinate space, defaults to "local" (model space, reproducible and unaffected by camera/placement). */
  space?: "local" | "world";
  /** Whether to attach a normal to each point [x,y,z,nx,ny,nz]. */
  includeNormals?: boolean;
}

const _inv = new THREE.Matrix4();

/** World-space hit point → local vertex (position via worldToLocal, normal via inverse transform). */
export function worldHitToLocalVertex(
  h: SurfaceHit,
  mesh: THREE.Mesh
): AnnotationVertex {
  const lp = mesh.worldToLocal(h.point.clone());
  _inv.copy(mesh.matrixWorld).invert();
  const ln = h.normal.clone().transformDirection(_inv).normalize();
  return {
    x: lp.x,
    y: lp.y,
    z: lp.z,
    nx: ln.x,
    ny: ln.y,
    nz: ln.z,
    faceIndex: h.faceIndex,
  };
}

const _nm = new THREE.Matrix3();

/** Local vertex → world position + world normal (for rendering). */
export function localVertexToWorld(
  v: AnnotationVertex,
  mesh: THREE.Mesh
): { p: THREE.Vector3; n: THREE.Vector3 } {
  const p = new THREE.Vector3(v.x, v.y, v.z).applyMatrix4(mesh.matrixWorld);
  _nm.getNormalMatrix(mesh.matrixWorld);
  const n = new THREE.Vector3(v.nx, v.ny, v.nz).applyMatrix3(_nm).normalize();
  return { p, n };
}
