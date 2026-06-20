import * as THREE from "three";

export type AnnotationMode = "navigate" | "freehand" | "geodesic" | "point";

export interface SurfaceHit {
  point: THREE.Vector3; // world
  normal: THREE.Vector3; // 插值法线 (world)
  faceIndex: number;
}

/** 标注顶点:位置与法线均为 **模型 local 空间**(单一真源,不受相机/摆放影响)。 */
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
  mode: "freehand" | "geodesic" | null; // points 为 null
  label: string;
  color: string; // hex, e.g. "#ff5a6e"
  closed: boolean;
  vertices: AnnotationVertex[];
  object3D: THREE.Object3D | null; // 渲染对象引用(导出时剔除)
}

export interface ExportOptions {
  /** 导出坐标空间,默认 "local"(模型空间,可复现、不受相机/摆放影响)。 */
  space?: "local" | "world";
  /** 是否在每个点附带法线 [x,y,z,nx,ny,nz]。 */
  includeNormals?: boolean;
}

const _inv = new THREE.Matrix4();

/** 世界系命中点 → local 顶点(位置 worldToLocal,法线用逆变换)。 */
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

/** local 顶点 → world 位置 + world 法线(供渲染)。 */
export function localVertexToWorld(
  v: AnnotationVertex,
  mesh: THREE.Mesh
): { p: THREE.Vector3; n: THREE.Vector3 } {
  const p = new THREE.Vector3(v.x, v.y, v.z).applyMatrix4(mesh.matrixWorld);
  _nm.getNormalMatrix(mesh.matrixWorld);
  const n = new THREE.Vector3(v.nx, v.ny, v.nz).applyMatrix3(_nm).normalize();
  return { p, n };
}
