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

  /** Move the anchor at `index` to the vertex nearest `localHitPoint`, rebuilding adjacent segments live. */
  moveAnchorTo(index: number, localHitPoint: THREE.Vector3) {
    if (index < 0 || index >= this.anchors.length) return;
    this.snapshot();
    this.anchors[index] = this.graph.nearestVertex(localHitPoint);
    this.rebuildSegments();
  }

  /** Anchor vertex indices (persisted on a committed geodesic so it can be re-opened for editing). */
  getAnchorIndices(): number[] {
    return this.anchors.slice();
  }

  /** Rebuild an editable contour from stored anchor vertex indices (re-opening a committed geodesic). */
  static fromAnchors(graph: MeshGraph, mesh: THREE.Mesh, indices: number[]): GeodesicContour {
    const gc = new GeodesicContour(graph, mesh);
    gc.anchors = indices.slice();
    gc.rebuildSegments();
    return gc;
  }

  /** Insert a new anchor (snapped to the nearest vertex) at position `index`, rebuilding segments. */
  insertAnchorAt(index: number, localHitPoint: THREE.Vector3) {
    const v = this.graph.nearestVertex(localHitPoint);
    this.snapshot();
    const i = Math.max(0, Math.min(index, this.anchors.length));
    this.anchors.splice(i, 0, v);
    this.rebuildSegments();
  }

  /**
   * Which anchor interval's surface path passes closest to `worldPoint` — i.e. the edge the user
   * clicked on, so a new anchor can be inserted there. Returns the interval index (insert after that
   * anchor, i.e. at index+1), or -1 when there are fewer than 2 anchors or the click is farther than
   * `maxDist` (world units) from every edge. For a closed contour the trailing closing edge
   * (last→first) is considered and maps to appending at the end.
   */
  nearestInsertIndex(
    worldPoint: THREE.Vector3,
    matrixWorld: THREE.Matrix4,
    closed: boolean,
    maxDist: number
  ): number {
    if (this.anchors.length < 2) return -1;
    const segs = this.segments.slice();
    if (closed && this.anchors.length > 2) {
      segs.push(
        this.graph.shortestPath(this.anchors[this.anchors.length - 1], this.anchors[0])
      );
    }
    let best = -1;
    let bestD = maxDist;
    for (let si = 0; si < segs.length; si++) {
      for (const vi of segs[si]) {
        const d = this.graph.vertexWorld(vi, matrixWorld).distanceTo(worldPoint);
        if (d < bestD) {
          bestD = d;
          best = si;
        }
      }
    }
    return best;
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
    return this.smoothPath(idxPath, closed);
  }

  /**
   * Relax the stitched shortest-path polyline so it reads as a smooth curve instead of the raw
   * voxel staircase, WITHOUT changing the point count (keeps editing/index mapping simple) and
   * WITHOUT moving the anchors (they stay exact control points). A few Laplacian passes pull each
   * interior point toward the midpoint of its neighbours; anchors and (for open paths) the two
   * endpoints are pinned. Normals are carried over from each point's original graph vertex — the
   * points only shift slightly and the line already floats above the surface by `epsilon`, so the
   * approximation is invisible and avoids an O(V) nearest-vertex scan per point on every redraw.
   */
  private smoothPath(idxPath: number[], closed: boolean): AnnotationVertex[] {
    const base = idxPath.map((i) => this.graph.vertexLocal(i));
    const n = base.length;
    if (n <= 2) return base;

    const anchorSet = new Set(this.anchors);
    const pinned = idxPath.map((i) => anchorSet.has(i));
    const P = base.map((v) => new THREE.Vector3(v.x, v.y, v.z));

    const ITER = 2;
    const LAMBDA = 0.5;
    const mid = new THREE.Vector3();
    for (let it = 0; it < ITER; it++) {
      const next = P.map((p) => p.clone());
      for (let k = 0; k < n; k++) {
        if (pinned[k]) continue;
        if (!closed && (k === 0 || k === n - 1)) continue;
        const a = P[(k - 1 + n) % n];
        const b = P[(k + 1) % n];
        mid.addVectors(a, b).multiplyScalar(0.5).sub(P[k]);
        next[k].copy(P[k]).addScaledVector(mid, LAMBDA);
      }
      for (let k = 0; k < n; k++) P[k].copy(next[k]);
    }

    return P.map((p, k) => ({
      x: p.x,
      y: p.y,
      z: p.z,
      nx: base[k].nx,
      ny: base[k].ny,
      nz: base[k].nz,
      faceIndex: -1,
    }));
  }
}
