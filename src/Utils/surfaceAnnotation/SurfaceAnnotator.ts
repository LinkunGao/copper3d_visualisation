import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial";
import type { Annotation, AnnotationMode, AnnotationVertex, SurfaceHit, ExportOptions } from "./types";
import { worldHitToLocalVertex } from "./types";
import { raycastSurface } from "./raycastSurface";
import { makePointMarker } from "./pointMarkers";
import { StrokeContour } from "./strokeContour";
import { makeContourLine, updateContourLine, setContourColor } from "./contourRender";
import { MeshGraph } from "./MeshGraph";
import { GeodesicContour } from "./geodesicContour";
import { AnnotationStore } from "./annotationStore";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils";

export interface SurfaceAnnotatorOptions {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  container: HTMLElement;
  controls: { enabled: boolean };
  mesh: THREE.Mesh;
  /** 缺省时从 mesh 几何包围盒对角线自算。 */
  bboxDiagonal?: number;
  /** 自由手绘 contour 颜色,默认 #e5006e。 */
  freehandColor?: string;
  /** 测地线 contour 颜色,默认 #ffa24e。 */
  geodesicColor?: string;
  /** 放点标记颜色,默认 #ffd166。 */
  pointColor?: string;
  /** 线宽(像素),默认 3。 */
  lineWidth?: number;
  /** 标记小球半径,默认 bboxDiagonal*0.006。 */
  markerRadius?: number;
  onModeChange?: (m: AnnotationMode) => void;
  /** 标注列表变化回调(增删/撤销/清空)。 */
  onChange?: (annotations: Annotation[]) => void;
}

const LINE_W = 3;
const LINE_W_SEL = 6;

/**
 * 表面标注主控制器(Phase 4):navigate / freehand / geodesic / point 四模式,
 * Enter 闭合,数据交给 AnnotationStore 管理(多条带颜色标签、撤销/删除/清空、导出)。
 * 渲染层据 store.list() 做场景对账(reconcile),撤销/删除自动加/移 three 对象。
 */
export class SurfaceAnnotator {
  private o: SurfaceAnnotatorOptions;
  private mode: AnnotationMode = "navigate";
  private spaceHeld = false;
  private pointerDown = false;
  private readonly markerRadius: number;
  private readonly epsilon: number;
  private readonly minGap: number;
  private readonly maxJump: number;

  private graph: MeshGraph;
  private store = new AnnotationStore();
  private managed = new Set<THREE.Object3D>();
  private seq = 0;
  private selectedId: string | null = null;

  private activeStroke?: StrokeContour;
  private activeLine?: Line2;
  private lastFreehand?: Annotation;
  private activeGeo?: GeodesicContour;
  private activeGeoLine?: Line2;

  constructor(opts: SurfaceAnnotatorOptions) {
    this.o = opts;
    const meshGeo = opts.mesh.geometry as THREE.BufferGeometry;
    if (!meshGeo.getAttribute("normal")) meshGeo.computeVertexNormals(); // 渲染需要法线
    meshGeo.computeBoundingBox();
    const diag =
      opts.bboxDiagonal ??
      (meshGeo.boundingBox as THREE.Box3).getSize(new THREE.Vector3()).length();
    this.markerRadius = opts.markerRadius ?? diag * 0.006;
    this.epsilon = diag * 0.002;
    this.minGap = diag * 0.004;
    this.maxJump = diag * 0.05;

    // 测地线连通性:单独焊接一份"仅位置"的几何给 MeshGraph 用——
    // 不动被渲染的 mesh(保留其法线/UV/纹理)。仅位置可保证同表面位置的顶点
    // 被 mergeVertices 合并(否则逐面法线/UV 会阻止合并,图断裂 → 闭合穿模)。
    const posOnly = new THREE.BufferGeometry();
    posOnly.setAttribute(
      "position",
      (meshGeo.getAttribute("position") as THREE.BufferAttribute).clone()
    );
    const graphGeo = mergeVertices(posOnly);
    graphGeo.computeVertexNormals();
    this.graph = new MeshGraph(graphGeo);

    this.store.subscribe(() => this.reconcile());
    // 监听挂到 window 的捕获阶段(capture=true):在 copper 的 TrackballControls
    // 之前拿到每一个指针事件,避免它的 setPointerCapture / 事件路由导致拖拽中途丢 move。
    window.addEventListener("pointerdown", this.onPointerDown, true);
    window.addEventListener("pointermove", this.onPointerMove, true);
    window.addEventListener("pointerup", this.onPointerUp, true);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("resize", this.onResize);
    this.applyCameraGating();
  }

  /** 窗口尺寸变化时更新所有 fat line 的像素分辨率,否则线宽会失真。 */
  private onResize = () => {
    const w = this.o.container.clientWidth;
    const h = this.o.container.clientHeight;
    for (const a of this.store.list()) {
      if (a.type === "contour" && a.object3D) {
        const mat = (a.object3D as Line2).material as LineMaterial;
        mat.resolution.set(w, h);
      }
    }
    if (this.activeLine)
      ((this.activeLine.material as LineMaterial).resolution.set(w, h));
    if (this.activeGeoLine)
      ((this.activeGeoLine.material as LineMaterial).resolution.set(w, h));
  };

  private get freehandColor() {
    return this.o.freehandColor ?? "#e5006e";
  }
  private get geodesicColor() {
    return this.o.geodesicColor ?? "#ffa24e";
  }
  private get pointColorVal() {
    return this.o.pointColor ?? "#ffd166";
  }

  // ---- 对外 API(供 Vue 调用) ----

  getMode(): AnnotationMode {
    return this.mode;
  }

  setMode(m: AnnotationMode) {
    this.mode = m;
    this.applyCameraGating();
    this.o.onModeChange?.(m);
  }

  getStore(): AnnotationStore {
    return this.store;
  }

  /** 当前标注列表快照。 */
  getAnnotations(): Annotation[] {
    return this.store.list();
  }

  undo() {
    this.store.undo();
  }

  clearAll() {
    const removed = this.store.clear();
    removed.forEach((a) => {
      if (a.object3D) {
        this.o.scene.remove(a.object3D);
        this.disposeObject(a.object3D);
      }
    });
    this.managed.clear();
    this.selectedId = null;
  }

  deleteAnnotation(id: string) {
    if (this.selectedId === id) this.selectedId = null;
    this.store.remove(id);
  }

  selectAnnotation(id: string | null) {
    this.selectedId = id;
    this.applySelection();
  }

  /** 颜色变更后重画对应 three 对象。 */
  refreshAnnotation(id: string) {
    const a = this.store.get(id);
    if (!a || !a.object3D) return;
    if (a.type === "contour") {
      setContourColor(a.object3D as Line2, a.color);
    } else {
      const m = a.object3D as THREE.Mesh;
      (m.material as THREE.MeshBasicMaterial).color.set(a.color);
    }
  }

  exportJSON(modelName: string, opts?: ExportOptions) {
    return this.store.toJSON(modelName, this.o.mesh, opts);
  }

  // ---- 内部 ----

  private applyCameraGating() {
    // 按住 Space 临时旋转优先;否则仅 navigate 模式开相机。
    this.o.controls.enabled = this.spaceHeld || this.mode === "navigate";
  }

  /** 据 store.list() 对账场景:补齐缺失对象、移除已删对象(不 dispose,留给撤销恢复)。 */
  private reconcile() {
    const present = new Set<THREE.Object3D>();
    for (const a of this.store.list()) if (a.object3D) present.add(a.object3D);
    for (const o of this.managed) {
      if (!present.has(o)) this.o.scene.remove(o);
    }
    for (const o of present) {
      if (!this.managed.has(o)) this.o.scene.add(o);
    }
    this.managed = present;
    this.applySelection();
    this.o.onChange?.(this.store.list());
  }

  private applySelection() {
    for (const a of this.store.list()) {
      if (!a.object3D) continue;
      const sel = a.id === this.selectedId;
      if (a.type === "contour") {
        const mat = (a.object3D as Line2).material as LineMaterial;
        mat.linewidth = sel ? LINE_W_SEL : LINE_W;
      } else {
        a.object3D.scale.setScalar(sel ? 1.6 : 1);
      }
    }
  }

  private disposeObject(o: THREE.Object3D) {
    const any = o as THREE.Mesh;
    any.geometry?.dispose?.();
    const mat = any.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat?.dispose?.();
  }

  private nextId(): string {
    return "a" + ++this.seq;
  }

  private hit(e: PointerEvent): SurfaceHit | null {
    return raycastSurface(
      this.o.camera,
      this.o.container,
      this.o.mesh,
      e.clientX,
      e.clientY
    );
  }

  /** 事件目标是否落在标注容器内(排除面板/页面其它区域的点击)。 */
  private insideContainer(e: Event): boolean {
    const t = e.target as Node | null;
    return !!t && this.o.container.contains(t);
  }

  private onPointerDown = (e: PointerEvent) => {
    if (this.spaceHeld) return;
    if (e.button !== 0) return; // 仅左键
    if (!this.insideContainer(e)) return;
    this.pointerDown = true;

    if (this.mode === "point") {
      const h = this.hit(e);
      if (!h) return;
      const v = worldHitToLocalVertex(h, this.o.mesh);
      const marker = makePointMarker(
        v,
        this.o.mesh,
        this.pointColorVal,
        this.markerRadius
      );
      this.o.scene.add(marker);
      const ann: Annotation = {
        id: this.nextId(),
        type: "points",
        mode: null,
        label: `Point ${this.seq}`,
        color: this.pointColorVal,
        closed: false,
        vertices: [v],
        object3D: marker,
      };
      this.store.add(ann);
      return;
    }

    if (this.mode === "freehand") {
      this.activeStroke = new StrokeContour(this.minGap, this.maxJump, this.o.mesh);
      this.activeStroke.begin();
      const h = this.hit(e);
      if (h) this.activeStroke.addSample(h);
      this.activeLine = makeContourLine(
        this.activeStroke.vertices,
        this.freehandColor,
        false,
        this.o.container,
        this.epsilon,
        this.o.mesh
      );
      this.o.scene.add(this.activeLine);
      return;
    }

    if (this.mode === "geodesic") {
      const h = this.hit(e);
      if (!h) return;
      if (!this.activeGeo) {
        this.activeGeo = new GeodesicContour(this.graph, this.o.mesh);
      }
      const local = this.o.mesh.worldToLocal(h.point.clone());
      this.activeGeo.addAnchor(local);
      const verts = this.activeGeo.buildVertices(false);
      if (!this.activeGeoLine) {
        this.activeGeoLine = makeContourLine(
          verts,
          this.geodesicColor,
          false,
          this.o.container,
          this.epsilon,
          this.o.mesh
        );
        this.o.scene.add(this.activeGeoLine);
      } else {
        updateContourLine(
          this.activeGeoLine,
          verts,
          false,
          this.epsilon,
          this.o.mesh
        );
      }
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.spaceHeld) return;
    if (
      this.mode === "freehand" &&
      this.pointerDown &&
      this.activeStroke &&
      this.activeLine
    ) {
      const h = this.hit(e);
      if (!h) return;
      this.activeStroke.addSample(h);
      updateContourLine(
        this.activeLine,
        this.activeStroke.vertices,
        false,
        this.epsilon,
        this.o.mesh
      );
    }
  };

  private onPointerUp = () => {
    if (!this.pointerDown) return;
    this.pointerDown = false;
    if (this.activeStroke && this.activeLine) {
      const verts = this.activeStroke.end();
      if (verts.length >= 2) {
        const ann: Annotation = {
          id: this.nextId(),
          type: "contour",
          mode: "freehand",
          label: `Contour ${this.seq}`,
          color: this.freehandColor,
          closed: false,
          vertices: verts,
          object3D: this.activeLine,
        };
        this.store.add(ann);
        this.lastFreehand = ann;
      } else {
        this.o.scene.remove(this.activeLine);
      }
      this.activeStroke = undefined;
      this.activeLine = undefined;
    }
  };

  private closeLastContour() {
    const last = this.lastFreehand;
    if (!last || last.closed || last.vertices.length < 3 || !last.object3D) return;
    // 用测地线沿表面把末点连回首点,避免直线弦从模型内部"抄近路"被遮挡。
    const tail = last.vertices[last.vertices.length - 1];
    const head = last.vertices[0];
    const closing = this.surfacePathBetween(tail, head);
    last.vertices = last.vertices.concat(closing);
    last.closed = true;
    updateContourLine(
      last.object3D as Line2,
      last.vertices,
      true,
      this.epsilon,
      this.o.mesh
    );
  }

  /** 沿网格表面求 a→b 的测地路径(local 顶点),去掉与 a 重合的首点。a/b 已是 local。 */
  private surfacePathBetween(
    a: AnnotationVertex,
    b: AnnotationVertex
  ): AnnotationVertex[] {
    const va = this.graph.nearestVertex(new THREE.Vector3(a.x, a.y, a.z));
    const vb = this.graph.nearestVertex(new THREE.Vector3(b.x, b.y, b.z));
    const path = this.graph.shortestPath(va, vb);
    return path.slice(1).map((i) => this.graph.vertexLocal(i));
  }

  /** 结束当前测地线:闭合成环并落定为一条 contour。 */
  private finishGeodesic() {
    if (!this.activeGeo || !this.activeGeoLine) return;
    const closed = this.activeGeo.anchorCount > 2;
    const verts = this.activeGeo.buildVertices(closed);
    if (verts.length >= 2) {
      updateContourLine(
        this.activeGeoLine,
        verts,
        closed,
        this.epsilon,
        this.o.mesh
      );
      const ann: Annotation = {
        id: this.nextId(),
        type: "contour",
        mode: "geodesic",
        label: `Contour ${this.seq}`,
        color: this.geodesicColor,
        closed,
        vertices: verts,
        object3D: this.activeGeoLine,
      };
      this.store.add(ann);
    } else {
      this.o.scene.remove(this.activeGeoLine);
    }
    this.activeGeo = undefined;
    this.activeGeoLine = undefined;
  }

  private isTypingTarget(e: KeyboardEvent): boolean {
    const t = e.target as HTMLElement | null;
    if (!t) return false;
    const tag = t.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (this.isTypingTarget(e)) return;
    if (e.code === "Space") {
      this.spaceHeld = true;
      this.applyCameraGating();
      return;
    }
    if (e.key === "Escape") {
      this.setMode("navigate");
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
      e.preventDefault();
      this.undo();
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      if (this.selectedId) this.deleteAnnotation(this.selectedId);
      return;
    }
    if (e.key === "Enter") {
      // 测地线进行中 → 结束并闭合;否则闭合最近一条自由手绘线。
      if (this.activeGeo) this.finishGeodesic();
      else this.closeLastContour();
      return;
    }
    if (e.key === "1") this.setMode("navigate");
    if (e.key === "2") this.setMode("freehand");
    if (e.key === "3") this.setMode("geodesic");
    if (e.key === "4") this.setMode("point");
  };

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.code === "Space") {
      this.spaceHeld = false;
      this.applyCameraGating();
    }
  };

  dispose() {
    window.removeEventListener("pointerdown", this.onPointerDown, true);
    window.removeEventListener("pointermove", this.onPointerMove, true);
    window.removeEventListener("pointerup", this.onPointerUp, true);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("resize", this.onResize);
  }
}
