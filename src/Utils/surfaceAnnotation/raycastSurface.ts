import * as THREE from "three";
import type { SurfaceHit } from "./types";

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();

// scratch objects for the smooth-normal interpolation (avoid per-call allocation)
const _nm = new THREE.Matrix3();
const _lp = new THREE.Vector3();
const _pa = new THREE.Vector3();
const _pb = new THREE.Vector3();
const _pc = new THREE.Vector3();
const _na = new THREE.Vector3();
const _nb = new THREE.Vector3();
const _nc = new THREE.Vector3();
const _v0 = new THREE.Vector3();
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();

/**
 * Interpolate a "smooth per-vertex normal" across the hit triangle using barycentric coordinates,
 * instead of using the per-face normal.
 *
 * Per-face normals on voxel / marching-cubes meshes are axis-aligned stair directions (±x/±y/±z);
 * using them to push the annotation line outward along the normal shoves points toward neighboring
 * stairs rather than cleanly "outward", making the line dip in and out on bumpy surfaces and get
 * occluded by the steps. A smooth normal varies continuously along the surface, so the outward
 * direction is stable and consistent and the line can float smoothly above the relief. Returns false
 * when interpolation isn't possible (caller falls back to the face normal).
 */
function interpolateLocalNormal(
  geom: THREE.BufferGeometry,
  face: { a: number; b: number; c: number },
  localPoint: THREE.Vector3,
  out: THREE.Vector3
): boolean {
  const posAttr = geom.getAttribute("position") as THREE.BufferAttribute | undefined;
  const norAttr = geom.getAttribute("normal") as THREE.BufferAttribute | undefined;
  if (!posAttr || !norAttr) return false;
  _pa.fromBufferAttribute(posAttr, face.a);
  _pb.fromBufferAttribute(posAttr, face.b);
  _pc.fromBufferAttribute(posAttr, face.c);
  // Barycentric coordinates (local space): u/v/w
  _v0.subVectors(_pb, _pa);
  _v1.subVectors(_pc, _pa);
  _v2.subVectors(localPoint, _pa);
  const d00 = _v0.dot(_v0);
  const d01 = _v0.dot(_v1);
  const d11 = _v1.dot(_v1);
  const d20 = _v2.dot(_v0);
  const d21 = _v2.dot(_v1);
  const denom = d00 * d11 - d01 * d01;
  if (Math.abs(denom) < 1e-12) return false;
  const v = (d11 * d20 - d01 * d21) / denom;
  const w = (d00 * d21 - d01 * d20) / denom;
  const u = 1 - v - w;
  _na.fromBufferAttribute(norAttr, face.a);
  _nb.fromBufferAttribute(norAttr, face.b);
  _nc.fromBufferAttribute(norAttr, face.c);
  out
    .set(0, 0, 0)
    .addScaledVector(_na, u)
    .addScaledVector(_nb, v)
    .addScaledVector(_nc, w);
  if (out.lengthSq() < 1e-12) return false;
  out.normalize();
  return true;
}

/**
 * Project screen coordinates (clientX/Y) onto the mesh surface, returning the hit point,
 * world-space normal, and faceIndex. Returns null on a miss. Local implementation that does not
 * depend on Copper3D's unexported raycast internals.
 */
export function raycastSurface(
  camera: THREE.PerspectiveCamera,
  container: HTMLElement,
  mesh: THREE.Mesh,
  clientX: number,
  clientY: number
): SurfaceHit | null {
  const rect = container.getBoundingClientRect();
  ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  ray.setFromCamera(ndc, camera);
  const hits = ray.intersectObject(mesh, false);
  if (hits.length === 0) return null;
  const h = hits[0];
  const point = h.point.clone();
  const normal = new THREE.Vector3(0, 0, 1);
  if (h.face) {
    // Prefer a smooth interpolated normal (stable outward direction on bumpy/voxel meshes);
    // fall back to the flat face normal if the geometry has no normal attribute.
    _lp.copy(h.point);
    mesh.worldToLocal(_lp);
    if (!interpolateLocalNormal(mesh.geometry as THREE.BufferGeometry, h.face, _lp, normal)) {
      normal.copy(h.face.normal);
    }
    _nm.getNormalMatrix(mesh.matrixWorld);
    normal.applyMatrix3(_nm).normalize();
  }
  return { point, normal, faceIndex: h.faceIndex ?? -1 };
}
