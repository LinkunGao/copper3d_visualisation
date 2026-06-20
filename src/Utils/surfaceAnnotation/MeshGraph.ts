import * as THREE from "three";

/**
 * 从 BufferGeometry 的索引构建顶点邻接图,用于模式 B(测地线)的最短路径。
 * 顶点坐标按 local 存;传入的查询点需先转为 local(mesh.worldToLocal)。
 *
 * 说明:几何须为已索引(indexed)。modelLoader 用 mergeVertices 焊接重复顶点,
 * 保证同一表面位置共享顶点,邻接图才连通。
 *
 * 性能:O(V²) Dijkstra + O(V) 最近顶点查找。对几万顶点单次点击可接受;
 * 若过大可后续换二叉堆 + 空间网格加速(留作升级)。
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
      // 非索引兜底(连通性差,仅避免崩溃)。
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

  /** 最近顶点(传入 local 坐标)。 */
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
   * 两顶点间最短路径(含端点的顶点索引序列)。二叉堆 Dijkstra,O(E log V)。
   * 不连通时返回 [start,end] 兜底。
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

  /** 顶点的 local 坐标 + local 法线(图几何即 local 空间)。 */
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

/** 极简二叉最小堆(按 priority 排序,存顶点索引)。用于 Dijkstra。 */
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
