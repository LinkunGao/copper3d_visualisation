import * as THREE from "three";
import type { AnnotationVertex } from "./types";
import { MeshGraph } from "./MeshGraph";

/**
 * State machine for mode B (geodesic): click anchors one by one, find the shortest path between
 * adjacent anchors with MeshGraph, and stitch them into a polyline that hugs the surface.
 * Enter finishes and can close the loop (computing one more segment between first and last).
 */
export class GeodesicContour {
  private anchors: number[] = []; // vertex indices
  private segments: number[][] = []; // path between adjacent anchors (endpoints included)
  private history: number[][] = []; // anchor snapshot before each add/remove, for undo

  constructor(private graph: MeshGraph, private mesh: THREE.Mesh) {}

  /** Save a snapshot before any anchor change (the vertex-index array is tiny, so snapshot cost is negligible). */
  private snapshot() {
    this.history.push(this.anchors.slice());
  }

  /** Given a local hit point, snap to the nearest vertex and compute the path to the previous anchor. */
  addAnchor(localHitPoint: THREE.Vector3) {
    const v = this.graph.nearestVertex(localHitPoint);
    this.snapshot();
    if (this.anchors.length > 0) {
      const prev = this.anchors[this.anchors.length - 1];
      this.segments.push(this.graph.shortestPath(prev, v));
    }
    this.anchors.push(v);
  }

  /** Remove the anchor at the given index and recompute adjacent segments (allows canceling any middle point). */
  removeAnchorAt(index: number) {
    if (index < 0 || index >= this.anchors.length) return;
    this.snapshot();
    this.anchors.splice(index, 1);
    this.rebuildSegments();
  }

  /** Whether there is still an editable change to undo (add/remove point). */
  canUndo(): boolean {
    return this.history.length > 0;
  }

  /** Undo the last anchor edit (add → remove it; remove → restore it). Returns false when no history. */
  undoEdit(): boolean {
    const prev = this.history.pop();
    if (!prev) return false;
    this.anchors = prev;
    this.rebuildSegments();
    return true;
  }

  /** Recompute all adjacent-segment paths from the current anchor sequence. */
  private rebuildSegments() {
    this.segments = [];
    for (let i = 1; i < this.anchors.length; i++) {
      this.segments.push(
        this.graph.shortestPath(this.anchors[i - 1], this.anchors[i])
      );
    }
  }

  /** Local vertex of each anchor (used to draw visible anchor markers). */
  getAnchorLocals(): AnnotationVertex[] {
    return this.anchors.map((i) => this.graph.vertexLocal(i));
  }

  get anchorCount(): number {
    return this.anchors.length;
  }

  /** Stitch all path vertices (world) + normals into a polyline; when closed, add one first-to-last segment. */
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
      const start = si === 0 ? 0 : 1; // dedupe the endpoint shared between adjacent segments
      for (let k = start; k < s.length; k++) idxPath.push(s[k]);
    });
    if (idxPath.length === 0 && this.anchors.length === 1) {
      idxPath.push(this.anchors[0]);
    }
    // The graph geometry is already local space, so emit local vertices directly (world is derived at render time).
    return idxPath.map((i) => this.graph.vertexLocal(i));
  }
}
