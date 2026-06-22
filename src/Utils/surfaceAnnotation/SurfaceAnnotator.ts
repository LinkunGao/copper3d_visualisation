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
  /**
   * 标注线离开表面的外移量(world 单位),默认 bboxDiagonal*0.002。
   * 单独提供可与采样间距(minGap/maxJump,仍由 bboxDiagonal 推导)解耦 —— 在凹凸/体素表面上
   * 需要较大外移把线浮到起伏之上、又不想因此把采样变粗时使用。
   */
  epsilon?: number;
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
  private activeGeoMarkers: THREE.Mesh[] = []; // 进行中测地线的可见锚点
  private geoRay = new THREE.Raycaster();
  private geoNdc = new THREE.Vector2();
  private geoHoverBadge?: HTMLDivElement; // 悬停锚点时显示的"✕(可取消)"小标
  private hoveredGeoMarker = -1;
  private _projV = new THREE.Vector3();

  constructor(opts: SurfaceAnnotatorOptions) {
    this.o = opts;
    const meshGeo = opts.mesh.geometry as THREE.BufferGeometry;
    if (!meshGeo.getAttribute("normal")) meshGeo.computeVertexNormals(); // 渲染需要法线
    meshGeo.computeBoundingBox();
    const diag =
      opts.bboxDiagonal ??
      (meshGeo.boundingBox as THREE.Box3).getSize(new THREE.Vector3()).length();
    this.markerRadius = opts.markerRadius ?? diag * 0.0032;
    this.epsilon = opts.epsilon ?? diag * 0.002;
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
    // 离开测地线模式时丢弃尚未 Enter 落定的进行中测地线(清掉残留的锚点与线)。
    if (m !== "geodesic" && this.activeGeo) this.clearActiveGeo();
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
    // 测地线进行中 → 撤销最近一次锚点编辑(加点 / 取消点都能回退);
    // 否则撤销最近一条已落定的标注。
    if (this.activeGeo && this.activeGeo.canUndo()) {
      this.activeGeo.undoEdit();
      if (this.activeGeo.anchorCount === 0) this.clearActiveGeo();
      else {
        this.rebuildGeoMarkers();
        this.redrawGeoLine();
      }
      return;
    }
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
    this.clearActiveGeo();
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

  /**
   * 事件目标是否是容器内的 WebGL canvas。
   * 仅认 canvas:面板(GUIDE / 控制面板 / 标注列表的 ✕ 按钮)都是 container 的子元素,
   * 若只判断 contains 会把面板上的点击也当成在模型上作画 —— 这会"穿透"删除按钮、
   * 让 ✕ 难以点中。只响应 canvas 上的指针事件即可彻底隔离 UI 与画布。
   */
  private insideContainer(e: Event): boolean {
    const t = e.target as HTMLElement | null;
    return !!t && t.tagName === "CANVAS" && this.o.container.contains(t);
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
      // 先判断是否点中了一个已有锚点 → 取消该点(支持取消其中任意一点)。
      const pick = this.pickGeoMarker(e);
      if (pick >= 0 && this.activeGeo) {
        this.activeGeo.removeAnchorAt(pick);
        if (this.activeGeo.anchorCount === 0) this.clearActiveGeo();
        else {
          this.rebuildGeoMarkers();
          this.redrawGeoLine();
        }
        return;
      }
      // 否则在表面落一个新锚点。
      const h = this.hit(e);
      if (!h) return;
      if (!this.activeGeo) {
        this.activeGeo = new GeodesicContour(this.graph, this.o.mesh);
      }
      const local = this.o.mesh.worldToLocal(h.point.clone());
      this.activeGeo.addAnchor(local);
      this.rebuildGeoMarkers();
      this.redrawGeoLine();
    }
  };

  /**
   * 拾取进行中的锚点:返回最近锚点的下标(屏幕像素距离 < 容差),未命中返回 -1。
   *
   * 改用「屏幕空间像素距离」而非射线/球相交:锚点小球很小,严格的 ray/sphere 命中要求像素级
   * 精准对中,绝大多数点击都会落空 —— 而落空会穿到「新增锚点」分支,导致想删点反而多放了一个点,
   * 也就是之前「删点要点好几下、必须正中小球」的根因。把每个锚点投影到屏幕、取容差内最近的一个,
   * 删点就稳定可靠了。容差按小球的屏幕半径放大,保证好点中。
   */
  private pickGeoMarker(e: PointerEvent): number {
    if (!this.activeGeoMarkers.length) return -1;
    const rect = this.o.container.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const TOL = 16; // 命中容差(像素),比小球本身大,容错点击
    let best = -1;
    let bestDist = TOL;
    const v = this._projV;
    for (let i = 0; i < this.activeGeoMarkers.length; i++) {
      v.copy(this.activeGeoMarkers[i].position).project(this.o.camera);
      if (v.z > 1) continue; // 投影到相机背后,跳过
      const sx = (v.x * 0.5 + 0.5) * rect.width;
      const sy = (-v.y * 0.5 + 0.5) * rect.height;
      const d = Math.hypot(sx - px, sy - py);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  }

  /** 设置当前悬停的锚点(-1 = 无):更新高亮缩放、光标与"✕(可取消)"悬浮标。 */
  private setGeoHover(idx: number) {
    if (idx === this.hoveredGeoMarker) {
      if (idx >= 0) this.positionGeoBadge(this.activeGeoMarkers[idx]);
      return;
    }
    const prev = this.activeGeoMarkers[this.hoveredGeoMarker];
    if (prev) prev.scale.setScalar(1);
    this.hoveredGeoMarker = idx;
    const cur = this.activeGeoMarkers[idx];
    if (cur) {
      cur.scale.setScalar(1.3);
      this.ensureGeoBadge().style.display = "flex";
      this.positionGeoBadge(cur);
      this.o.container.style.cursor = "pointer";
    } else {
      if (this.geoHoverBadge) this.geoHoverBadge.style.display = "none";
      this.o.container.style.cursor = "";
    }
  }

  /** 懒创建悬浮 ✕ 标(挂在 container 内,pointer-events:none 不挡点击)。 */
  private ensureGeoBadge(): HTMLDivElement {
    if (this.geoHoverBadge) return this.geoHoverBadge;
    const b = document.createElement("div");
    b.textContent = "✕";
    Object.assign(b.style, {
      position: "absolute",
      width: "16px",
      height: "16px",
      borderRadius: "50%",
      background: "#ff5d6c",
      color: "#fff",
      font: "700 10px/1 system-ui, sans-serif",
      display: "none",
      alignItems: "center",
      justifyContent: "center",
      pointerEvents: "none",
      zIndex: "15",
      boxShadow: "0 2px 6px rgba(0,0,0,.45)",
      transform: "translate(-50%, -50%)",
      left: "0px",
      top: "0px",
    } as Partial<CSSStyleDeclaration>);
    this.o.container.appendChild(b);
    this.geoHoverBadge = b;
    return b;
  }

  /** 把 ✕ 标定位到锚点投影到屏幕的位置(正中心,即光标悬停处,避免歧义)。 */
  private positionGeoBadge(marker: THREE.Mesh) {
    if (!marker) return;
    const b = this.ensureGeoBadge();
    this._projV.copy(marker.position).project(this.o.camera);
    const rect = this.o.container.getBoundingClientRect();
    const x = (this._projV.x * 0.5 + 0.5) * rect.width;
    const y = (-this._projV.y * 0.5 + 0.5) * rect.height;
    b.style.left = `${x}px`;
    b.style.top = `${y}px`;
  }

  /** 据当前锚点重建可见的锚点小球(锚点比放点稍大,便于看见与点中取消)。 */
  private rebuildGeoMarkers() {
    this.setGeoHover(-1);
    for (const m of this.activeGeoMarkers) {
      this.o.scene.remove(m);
      this.disposeObject(m);
    }
    this.activeGeoMarkers = [];
    if (!this.activeGeo) return;
    for (const v of this.activeGeo.getAnchorLocals()) {
      const marker = makePointMarker(
        v,
        this.o.mesh,
        this.geodesicColor,
        this.markerRadius * 1.15
      );
      this.o.scene.add(marker);
      this.activeGeoMarkers.push(marker);
    }
  }

  /** 据当前锚点重画进行中的测地线(不闭合);不足两点时移除线。 */
  private redrawGeoLine() {
    if (!this.activeGeo) return;
    const verts = this.activeGeo.buildVertices(false);
    if (verts.length < 2) {
      if (this.activeGeoLine) {
        this.o.scene.remove(this.activeGeoLine);
        this.disposeObject(this.activeGeoLine);
        this.activeGeoLine = undefined;
      }
      return;
    }
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

  /** 丢弃进行中的测地线:移除并 dispose 线与全部锚点。 */
  private clearActiveGeo() {
    this.setGeoHover(-1);
    if (this.activeGeoLine) {
      this.o.scene.remove(this.activeGeoLine);
      this.disposeObject(this.activeGeoLine);
      this.activeGeoLine = undefined;
    }
    for (const m of this.activeGeoMarkers) {
      this.o.scene.remove(m);
      this.disposeObject(m);
    }
    this.activeGeoMarkers = [];
    this.activeGeo = undefined;
  }

  /** 移除进行中测地线的全部锚点小球(落定后调用:只留下线)。 */
  private removeGeoMarkers() {
    this.setGeoHover(-1);
    for (const m of this.activeGeoMarkers) {
      this.o.scene.remove(m);
      this.disposeObject(m);
    }
    this.activeGeoMarkers = [];
  }

  private onPointerMove = (e: PointerEvent) => {
    if (this.spaceHeld) {
      this.setGeoHover(-1);
      return;
    }
    // 测地线模式下,悬停到锚点小球时显示"✕"提示(该点可被点击取消)。
    if (this.mode === "geodesic" && !this.pointerDown) {
      this.setGeoHover(
        this.insideContainer(e) ? this.pickGeoMarker(e) : -1
      );
    }
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
      this.disposeObject(this.activeGeoLine);
    }
    // 落定后清掉可见锚点,只留下贴合表面的线。
    this.removeGeoMarkers();
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
    this.clearActiveGeo();
    this.geoHoverBadge?.remove();
    this.geoHoverBadge = undefined;
    window.removeEventListener("pointerdown", this.onPointerDown, true);
    window.removeEventListener("pointermove", this.onPointerMove, true);
    window.removeEventListener("pointerup", this.onPointerUp, true);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("resize", this.onResize);
  }
}
