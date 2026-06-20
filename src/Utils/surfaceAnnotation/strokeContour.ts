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
  private has = false;

  constructor(private minGap: number, private mesh: THREE.Mesh) {}

  begin() {
    this.verts = [];
    this.has = false;
  }

  addSample(hit: SurfaceHit) {
    // gap 判定用世界距离(屏幕笔触在世界系采样)
    if (this.has && hit.point.distanceTo(this.last) < this.minGap) return;
    this.verts.push(worldHitToLocalVertex(hit, this.mesh));
    this.last.copy(hit.point);
    this.has = true;
  }

  get vertices(): AnnotationVertex[] {
    return this.verts;
  }

  end(): AnnotationVertex[] {
    return this.verts;
  }
}
