import * as THREE from "three";

/**
 * Build a vertex adjacency graph from a BufferGeometry's index, used for the shortest path in
 * mode B (geodesic). Vertex coordinates are stored in local space; query points must be converted
 * to local first (mesh.worldToLocal).
 *
 * Note: the geometry must be indexed. modelLoader welds duplicate vertices with mergeVertices so
 * that vertices at the same surface position are shared, otherwise the adjacency graph won't be connected.
 *
 * Performance: O(V²) Dijkstra + O(V) nearest-vertex lookup. Acceptable for a single click on tens
 * of thousands of vertices; if too large it can later be sped up with a binary heap + spatial grid
 * (left as a future upgrade).
 */
export class MeshGraph {
  private positions: Float32Array;
  private normals: Float32Array | null;
  private adj: Array<Set<number>> = [];
  readonly vertexCount: number;

  constructor(geometry: THREE.BufferGeometry) {
    const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
    this.positions = pos.array as Float32Array;
    const nrm = geometry.getAttribute("normal") as
      | THREE.BufferAttribute
      | undefined;
    this.normals = nrm ? (nrm.array as Float32Array) : null;
    this.vertexCount = pos.count;

    for (let i = 0; i < this.vertexCount; i++) this.adj.push(new Set());
    const addEdge = (a: number, b: number) => {
      this.adj[a].add(b);
      this.adj[b].add(a);
    };

    const index = geometry.getIndex();
    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        const a = index.getX(i);
        const b = index.getX(i + 1);
        const c = index.getX(i + 2);
        addEdge(a, b);
        addEdge(b, c);
        addEdge(c, a);
      }
    } else {
      // Non-indexed fallback (poor connectivity, only to avoid crashing).
      for (let i = 0; i + 2 < this.vertexCount; i += 3) {
        addEdge(i, i + 1);
        addEdge(i + 1, i + 2);
        addEdge(i + 2, i);
      }
    }
  }

  private px(i: number) {
    return this.positions[i * 3];
  }
  private py(i: number) {
    return this.positions[i * 3 + 1];
  }
  private pz(i: number) {
    return this.positions[i * 3 + 2];
  }

  /** Nearest vertex (pass in local coordinates). */
  nearestVertex(localPoint: THREE.Vector3): number {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < this.vertexCount; i++) {
      const dx = this.px(i) - localPoint.x;
      const dy = this.py(i) - localPoint.y;
      const dz = this.pz(i) - localPoint.z;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  /**
   * Shortest path between two vertices (sequence of vertex indices including endpoints).
   * Binary-heap Dijkstra, O(E log V). Falls back to [start,end] when disconnected.
   */
  shortestPath(startV: number, endV: number): number[] {
    if (startV === endV) return [startV];
    const dist = new Float64Array(this.vertexCount).fill(Infinity);
    const prev = new Int32Array(this.vertexCount).fill(-1);
    const done = new Uint8Array(this.vertexCount);
    dist[startV] = 0;

    const heap = new MinHeap();
    heap.push(startV, 0);

    while (heap.size > 0) {
      const u = heap.pop();
      if (done[u]) continue;
      done[u] = 1;
      if (u === endV) break;
      const ud = dist[u];
      const ux = this.px(u);
      const uy = this.py(u);
      const uz = this.pz(u);
      for (const w of this.adj[u]) {
        if (done[w]) continue;
        const dx = this.px(w) - ux;
        const dy = this.py(w) - uy;
        const dz = this.pz(w) - uz;
        const nd = ud + Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (nd < dist[w]) {
          dist[w] = nd;
          prev[w] = u;
          heap.push(w, nd);
        }
      }
    }

    if (prev[endV] === -1 && startV !== endV) return [startV, endV];
    const path: number[] = [];
    for (let c = endV; c !== -1; c = prev[c]) {
      path.push(c);
      if (c === startV) break;
    }
    return path.reverse();
  }

  vertexWorld(i: number, matrixWorld: THREE.Matrix4): THREE.Vector3 {
    return new THREE.Vector3(this.px(i), this.py(i), this.pz(i)).applyMatrix4(
      matrixWorld
    );
  }

  vertexNormalWorld(i: number, mesh: THREE.Mesh): THREE.Vector3 {
    const n = new THREE.Vector3(0, 0, 1);
    if (this.normals) {
      n.set(
        this.normals[i * 3],
        this.normals[i * 3 + 1],
        this.normals[i * 3 + 2]
      );
    }
    const nm = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
    return n.applyMatrix3(nm).normalize();
  }

  /** Vertex local normal at index i (reads from the welded graphGeo normal attribute). */
  vertexNormalLocal(i: number): THREE.Vector3 {
    return new THREE.Vector3(
      this.normals ? this.normals[i * 3] : 0,
      this.normals ? this.normals[i * 3 + 1] : 0,
      this.normals ? this.normals[i * 3 + 2] : 1
    );
  }

  /** Normal at the vertex nearest to localPoint (for recovering normals from imported point coordinates). */
  nearestNormalLocal(p: THREE.Vector3): THREE.Vector3 {
    const i = this.nearestVertex(p);
    return this.vertexNormalLocal(i);
  }

  /** Vertex local coordinates + local normal (the graph geometry is already local space). */
  vertexLocal(i: number): {
    x: number;
    y: number;
    z: number;
    nx: number;
    ny: number;
    nz: number;
    faceIndex: number;
  } {
    return {
      x: this.px(i),
      y: this.py(i),
      z: this.pz(i),
      nx: this.normals ? this.normals[i * 3] : 0,
      ny: this.normals ? this.normals[i * 3 + 1] : 0,
      nz: this.normals ? this.normals[i * 3 + 2] : 1,
      faceIndex: -1,
    };
  }
}

/** Minimal binary min-heap (ordered by priority, stores vertex indices). Used for Dijkstra. */
class MinHeap {
  private ids: number[] = [];
  private prio: number[] = [];

  get size(): number {
    return this.ids.length;
  }

  push(id: number, priority: number) {
    this.ids.push(id);
    this.prio.push(priority);
    let i = this.ids.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.prio[parent] <= this.prio[i]) break;
      this.swap(i, parent);
      i = parent;
    }
  }

  pop(): number {
    const topId = this.ids[0];
    const lastId = this.ids.pop() as number;
    const lastPrio = this.prio.pop() as number;
    if (this.ids.length > 0) {
      this.ids[0] = lastId;
      this.prio[0] = lastPrio;
      let i = 0;
      const n = this.ids.length;
      for (;;) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let smallest = i;
        if (l < n && this.prio[l] < this.prio[smallest]) smallest = l;
        if (r < n && this.prio[r] < this.prio[smallest]) smallest = r;
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }
    return topId;
  }

  private swap(a: number, b: number) {
    const ti = this.ids[a];
    this.ids[a] = this.ids[b];
    this.ids[b] = ti;
    const tp = this.prio[a];
    this.prio[a] = this.prio[b];
    this.prio[b] = tp;
  }
}
