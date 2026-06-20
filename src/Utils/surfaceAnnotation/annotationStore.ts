import * as THREE from "three";
import type { Annotation, AnnotationVertex, ExportOptions } from "./types";

type Op = { kind: "add" | "remove"; ann: Annotation };

/**
 * 标注数据模型 + 撤销栈 + 导出。纯数据,无 three / DOM 依赖。
 * 撤销只记录 add / remove 两类原子操作(满足"撤销最近添加 / 恢复删除")。
 * 通过 subscribe 通知 UI 与渲染层(后者据 list() 做场景对账)。
 */
export class AnnotationStore {
  private items: Annotation[] = [];
  private undoStack: Op[] = [];
  private subs: Set<() => void> = new Set();

  private notify() {
    this.subs.forEach((f) => f());
  }

  subscribe(cb: () => void): () => void {
    this.subs.add(cb);
    return () => this.subs.delete(cb);
  }

  add(a: Annotation) {
    this.items.push(a);
    this.undoStack.push({ kind: "add", ann: a });
    this.notify();
  }

  remove(id: string): Annotation | undefined {
    const i = this.items.findIndex((x) => x.id === id);
    if (i < 0) return undefined;
    const [ann] = this.items.splice(i, 1);
    this.undoStack.push({ kind: "remove", ann });
    this.notify();
    return ann;
  }

  undo() {
    const op = this.undoStack.pop();
    if (!op) return;
    if (op.kind === "add") {
      const i = this.items.findIndex((x) => x.id === op.ann.id);
      if (i >= 0) this.items.splice(i, 1);
    } else {
      this.items.push(op.ann);
    }
    this.notify();
  }

  /** 清空,返回被清掉的项(供渲染层 dispose three 对象)。 */
  clear(): Annotation[] {
    const old = this.items;
    this.items = [];
    this.undoStack = [];
    this.notify();
    return old;
  }

  list(): Annotation[] {
    return this.items;
  }

  get(id: string): Annotation | undefined {
    return this.items.find((x) => x.id === id);
  }

  setLabel(id: string, label: string) {
    const a = this.get(id);
    if (a) {
      a.label = label;
      this.notify();
    }
  }

  setColor(id: string, color: string) {
    const a = this.get(id);
    if (a) {
      a.color = color;
      this.notify();
    }
  }

  toJSON(modelName: string, mesh: THREE.Mesh, opts: ExportOptions = {}) {
    const space = opts.space ?? "local";
    const toPt = (v: AnnotationVertex): number[] => {
      let x = v.x,
        y = v.y,
        z = v.z;
      if (space === "world") {
        const p = new THREE.Vector3(v.x, v.y, v.z).applyMatrix4(
          mesh.matrixWorld
        );
        x = p.x;
        y = p.y;
        z = p.z;
      }
      return opts.includeNormals ? [x, y, z, v.nx, v.ny, v.nz] : [x, y, z];
    };
    return {
      model: modelName,
      exportedAt: new Date().toISOString(),
      space,
      annotations: this.items.map((a) => ({
        id: a.id,
        type: a.type,
        mode: a.mode,
        label: a.label,
        color: a.color,
        closed: a.closed,
        points: a.vertices.map(toPt),
      })),
    };
  }
}
