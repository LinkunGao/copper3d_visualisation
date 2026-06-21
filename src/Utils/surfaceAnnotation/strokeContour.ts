import * as THREE from "three";
import type { AnnotationVertex, SurfaceHit } from "./types";
import { worldHitToLocalVertex } from "./types";

/**
 * 模式 A(自由手绘)一笔的状态机。
 * pointermove 时不断 addSample;与上一采样点世界距离 < minGap 的样本丢弃,避免过密。
 * 顶点以 local 存(由 mesh 把世界命中点转 local)。
 */
export class StrokeContour {
  private verts: AnnotationVertex[] = [];
  private last = new THREE.Vector3();
  private lastNormal = new THREE.Vector3();
  private has = false;

  /**
   * @param minGap  采样最小间距(世界系),去抖
   * @param maxJump 跳变阈值(世界系):距离 > maxJump 且法线大幅翻转时丢弃该样本,
   *                避免笔触掠过沟缝/轮廓边时相邻点落在不同深度、直线段横穿模型。
   */
  constructor(
    private minGap: number,
    private maxJump: number,
    private mesh: THREE.Mesh
  ) {}

  begin() {
    this.verts = [];
    this.has = false;
  }

  addSample(hit: SurfaceHit) {
    if (this.has) {
      const d = hit.point.distanceTo(this.last);
      if (d < this.minGap) return; // 太近,去抖
      // 跳变剔除:距离突然很大「且」法线大幅翻转(>~75°)→ 多半跳到了背面/远面,丢弃,
      // 否则相邻两点之间的直线段会横穿模型内部。两个条件同时满足才剔除:
      // 快速画(距离大、法线相近)不误删;画过尖锐棱边(法线变、距离近)也不误删。
      if (d > this.maxJump && hit.normal.dot(this.lastNormal) < 0.25) return;
    }
    this.verts.push(worldHitToLocalVertex(hit, this.mesh));
    this.last.copy(hit.point);
    this.lastNormal.copy(hit.normal);
    this.has = true;
  }

  get vertices(): AnnotationVertex[] {
    return this.verts;
  }

  end(): AnnotationVertex[] {
    return this.verts;
  }
}
