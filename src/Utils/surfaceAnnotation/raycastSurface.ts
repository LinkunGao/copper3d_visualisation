import * as THREE from "three";
import type { SurfaceHit } from "./types";

const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();

/**
 * 把屏幕坐标(clientX/Y)投射到 mesh 表面,返回命中点、world-space 法线与 faceIndex。
 * 未命中返回 null。本地实现,不依赖 Copper3D 未导出的 raycast 内部函数。
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
    normal.copy(h.face.normal);
    const nm = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    normal.applyMatrix3(nm).normalize();
  }
  return { point, normal, faceIndex: h.faceIndex ?? -1 };
}
