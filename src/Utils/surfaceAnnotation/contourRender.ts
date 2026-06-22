import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial";
import type { AnnotationVertex } from "./types";
import { localVertexToWorld } from "./types";

/**
 * 把标注顶点(local)序列展平成 Line2 需要的 world [x,y,z, ...]。
 * 每个点 local→world,再沿 world 法线外移 epsilon,避免与模型表面 z-fighting。
 * closed 时把首点追加到末尾形成环。
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
  // Line2 至少需要 2 个点;不足时给一个退化占位,后续 update 会补上。
  geo.setPositions(pos.length >= 6 ? pos : [0, 0, 0, 0, 0, 0]);
  const mat = new LineMaterial({
    color: new THREE.Color(color).getHex(),
    linewidth: 3, // 像素宽(需 resolution 配合)
    // depthTest stays ON so the model correctly occludes the line when it is on the far side
    // (no see-through). The host applies polygonOffset to the SURFACE material so the line still
    // wins where it lies coplanar with the surface (no z-fighting / sinking on bumpy meshes).
  });
  mat.resolution.set(container.clientWidth, container.clientHeight);
  const line = new Line2(geo, mat);
  line.computeLineDistances();
  line.renderOrder = 998;
  // 关键:Line2 的包围球停留在初始点,拖拽生长后真实几何会被错误剔除。
  // 关闭视锥剔除,保证线始终渲染。
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
  if (pos.length < 6) return; // Line2 需要 >=2 点
  // 关键:Line2 在原 geometry 上 setPositions 扩容后只渲染首段(已知坑)。
  // 改为每次重建一个新 LineGeometry 并替换,保证实例数正确、全段渲染。
  const geo = new LineGeometry();
  geo.setPositions(pos);
  const old = line.geometry as LineGeometry;
  line.geometry = geo;
  old.dispose();
  line.computeLineDistances();
}

/** 改变已有 contour 线的颜色。 */
export function setContourColor(line: Line2, color: string): void {
  (line.material as LineMaterial).color.set(color);
}
