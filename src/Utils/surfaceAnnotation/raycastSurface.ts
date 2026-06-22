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
 * 用重心坐标在命中三角形上插值"逐顶点平滑法线",而不是用逐面法线。
 *
 * 体素 / marching-cubes 网格的逐面法线是轴对齐的台阶方向(±x/±y/±z),用它把标注线沿法线外移
 * 会把点推向相邻台阶、而不是干净地"朝外",导致线在凹凸面上忽进忽出、被台阶遮断。平滑法线沿表面
 * 连续变化,外移方向稳定一致,线才能平滑地浮在起伏之上。返回 false 表示无法插值(调用方回退到面法线)。
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
  // 重心坐标(局部空间):u/v/w
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
