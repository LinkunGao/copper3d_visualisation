import * as THREE from "three";
import type { Annotation, AnnotationVertex, ExportOptions } from "./types";

type Op = { kind: "add" | "remove"; ann: Annotation };

/**
 * Annotation data model + undo stack + export. Pure data, no three / DOM dependencies.
 * Undo only records two atomic operations, add / remove (enough for "undo last add / restore delete").
 * Notifies the UI and render layer via subscribe (the latter reconciles the scene against list()).
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

  /** Clear all, returning the removed items (so the render layer can dispose three objects). */
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
