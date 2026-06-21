import * as THREE from "three";
import type { AnnotationVertex } from "./types";
import { MeshGraph } from "./MeshGraph";

/**
 * 模式 B(测地线)状态机:逐次点击锚点,相邻锚点之间用 MeshGraph 求最短路径,
 * 拼成一条贴合表面的折线。Enter 结束并可闭合(首尾再求一段)。
 */
export class GeodesicContour {
  private anchors: number[] = []; // 顶点索引
  private segments: number[][] = []; // 相邻锚点间路径(含端点)
  private history: number[][] = []; // 每次增删前的锚点快照,用于撤销

  constructor(private graph: MeshGraph, private mesh: THREE.Mesh) {}

  /** 任何改动锚点前先存一份快照(顶点索引数组很小,快照成本可忽略)。 */
  private snapshot() {
    this.history.push(this.anchors.slice());
  }

  /** 传入 local 命中点,snap 到最近顶点并对上一锚点求路径。 */
  addAnchor(localHitPoint: THREE.Vector3) {
    const v = this.graph.nearestVertex(localHitPoint);
    this.snapshot();
    if (this.anchors.length > 0) {
      const prev = this.anchors[this.anchors.length - 1];
      this.segments.push(this.graph.shortestPath(prev, v));
    }
    this.anchors.push(v);
  }

  /** 删除指定下标的锚点,重算相邻段(支持取消中间任意一点)。 */
  removeAnchorAt(index: number) {
    if (index < 0 || index >= this.anchors.length) return;
    this.snapshot();
    this.anchors.splice(index, 1);
    this.rebuildSegments();
  }

  /** 是否还有可撤销的编辑(加点/删点)。 */
  canUndo(): boolean {
    return this.history.length > 0;
  }

  /** 撤销上一次锚点编辑(加点 → 删回去;删点 → 恢复)。无历史返回 false。 */
  undoEdit(): boolean {
    const prev = this.history.pop();
    if (!prev) return false;
    this.anchors = prev;
    this.rebuildSegments();
    return true;
  }

  /** 据当前锚点序列整体重算所有相邻段路径。 */
  private rebuildSegments() {
    this.segments = [];
    for (let i = 1; i < this.anchors.length; i++) {
      this.segments.push(
        this.graph.shortestPath(this.anchors[i - 1], this.anchors[i])
      );
    }
  }

  /** 各锚点的 local 顶点(用于绘制可见的锚点标记)。 */
  getAnchorLocals(): AnnotationVertex[] {
    return this.anchors.map((i) => this.graph.vertexLocal(i));
  }

  get anchorCount(): number {
    return this.anchors.length;
  }

  /** 把所有路径顶点(world)+ 法线 拼成折线;closed 时补一段首尾路径。 */
  buildVertices(closed: boolean): AnnotationVertex[] {
    const segs = this.segments.slice();
    if (closed && this.anchors.length > 2) {
      segs.push(
        this.graph.shortestPath(
          this.anchors[this.anchors.length - 1],
          this.anchors[0]
        )
      );
    }
    const idxPath: number[] = [];
    segs.forEach((s, si) => {
      const start = si === 0 ? 0 : 1; // 去重相邻段共享端点
      for (let k = start; k < s.length; k++) idxPath.push(s[k]);
    });
    if (idxPath.length === 0 && this.anchors.length === 1) {
      idxPath.push(this.anchors[0]);
    }
    // 图几何即 local 空间,直接产出 local 顶点(渲染时再派生 world)。
    return idxPath.map((i) => this.graph.vertexLocal(i));
  }
}
