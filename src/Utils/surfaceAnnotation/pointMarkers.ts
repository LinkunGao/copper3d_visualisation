import * as THREE from "three";
import type { AnnotationVertex } from "./types";
import { localVertexToWorld } from "./types";

/**
 * 在 local 顶点处生成一个标记小球(fiducial)。local→world 后沿 world 法线略外移,
 * 避免一半埋进表面。radius 由调用方按模型 bbox 缩放传入。
 */
export function makePointMarker(
  v: AnnotationVertex,
  mesh: THREE.Mesh,
  color: string,
  radius: number
): THREE.Mesh {
  const geo = new THREE.SphereGeometry(radius, 16, 16);
  const mat = new THREE.MeshBasicMaterial({ color });
  const m = new THREE.Mesh(geo, mat);
  const { p, n } = localVertexToWorld(v, mesh);
  m.position.copy(p.addScaledVector(n, radius * 0.5));
  m.renderOrder = 999;
  return m;
}
