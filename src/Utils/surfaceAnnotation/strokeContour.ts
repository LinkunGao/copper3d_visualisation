import * as THREE from "three";
import type { AnnotationVertex, SurfaceHit } from "./types";
import { worldHitToLocalVertex } from "./types";

/**
 * State machine for one stroke in mode A (freehand).
 * On pointermove it keeps calling addSample; samples whose world distance from the previous
 * sample is < minGap are dropped to avoid over-density.
 * Vertices are stored in local space (the mesh converts the world hit point to local).
 */
export class StrokeContour {
  private verts: AnnotationVertex[] = [];
  private last = new THREE.Vector3();
  private lastNormal = new THREE.Vector3();
  private has = false;

  /**
   * @param minGap  minimum sample spacing (world space), debounce
   * @param maxJump jump threshold (world space): drop the sample when distance > maxJump and the
   *                normal flips sharply, to prevent adjacent points landing at different depths
   *                (and the straight segment cutting through the model) when the stroke grazes a
   *                groove or contour edge.
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
      if (d < this.minGap) return; // too close, debounce
      // Jump rejection: distance suddenly large AND normal flips sharply (>~75°) → likely jumped to
      // the back/far side, so drop it, otherwise the straight segment between adjacent points cuts
      // through the model interior. Only reject when both conditions hold:
      // fast drawing (large distance, similar normals) isn't falsely dropped, and drawing over a
      // sharp edge (normal changes, distance small) isn't falsely dropped either.
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
