import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial";
import type { Annotation, AnnotationMode, AnnotationVertex, SurfaceHit, ExportOptions } from "./types";
import { worldHitToLocalVertex } from "./types";
import { raycastSurface } from "./raycastSurface";
import { makePointMarker, makeAnchorHandle } from "./pointMarkers";
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
  /** Computed from the mesh geometry's bounding-box diagonal when omitted. */
  bboxDiagonal?: number;
  /**
   * Outward offset of the annotation line from the surface (world units), defaults to bboxDiagonal*0.002.
   * Providing it separately decouples it from the sampling spacing (minGap/maxJump, still derived from
   * bboxDiagonal) — useful on bumpy/voxel surfaces where a larger offset is needed to float the line
   * above the relief without also coarsening the sampling.
   */
  epsilon?: number;
  /** Freehand contour color, defaults to #e5006e. */
  freehandColor?: string;
  /** Geodesic contour color, defaults to #ffa24e. */
  geodesicColor?: string;
  /** Point-marker color, defaults to #ffd166. */
  pointColor?: string;
  /** Line width (pixels), defaults to 3. */
  lineWidth?: number;
  /** Marker sphere radius, defaults to bboxDiagonal*0.006. */
  markerRadius?: number;
  onModeChange?: (m: AnnotationMode) => void;
  /** Callback when the annotation list changes (add/remove/undo/clear). */
  onChange?: (annotations: Annotation[]) => void;
  /** Callback when the engine changes the selection itself (delete, deselect-on-navigate) so the UI can mirror it. */
  onSelectionChange?: (id: string | null) => void;
  /** Callback when interaction state changes (drawing, armed tool, draw-lock status, geodesic-editing). */
  onInteractionChange?: (s: {
    drawing: boolean;
    armed: AnnotationMode;
    locked: boolean;
    /** True while a geodesic is editable (in-progress or a re-opened committed one) → its anchors can be dragged/deleted/inserted. */
    editing: boolean;
  }) => void;
}

const LINE_W = 3;
const LINE_W_SEL = 6;

/**
 * Main surface-annotation controller (Phase 4): four modes navigate / freehand / geodesic / point,
 * Enter closes the loop, and data is managed by AnnotationStore (multiple color-labeled strips,
 * undo/delete/clear, export).
 * The render layer reconciles the scene against store.list(); undo/delete automatically add/remove three objects.
 */
export class SurfaceAnnotator {
  private o: SurfaceAnnotatorOptions;
  private mode: AnnotationMode = "navigate";
  private spaceHeld = false;
  private drawLock = false;
  private armed: AnnotationMode = "freehand";
  private spaceDownAt = 0;
  private spaceDragged = false;
  private static readonly TAP_MS = 250;
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
  private activeGeoMarkers: THREE.Object3D[] = []; // visible anchor handles of the active geodesic
  private geoRay = new THREE.Raycaster();
  private geoNdc = new THREE.Vector2();
  private hoveredGeoMarker = -1;
  private draggingAnchor = -1; // anchor index currently being dragged (-1 = none)
  private geoRedrawScheduled = false; // rAF coalescing flag for live drag redraw
  private editingId: string | null = null; // committed geodesic re-opened for editing (Task 1.5)
  private geoClosed = false; // whether the active/edited geodesic is a closed loop
  private _projV = new THREE.Vector3();
  private listenersOn = false;

  constructor(opts: SurfaceAnnotatorOptions) {
    this.o = opts;
    const meshGeo = opts.mesh.geometry as THREE.BufferGeometry;
    if (!meshGeo.getAttribute("normal")) meshGeo.computeVertexNormals(); // rendering needs normals
    meshGeo.computeBoundingBox();
    const diag =
      opts.bboxDiagonal ??
      (meshGeo.boundingBox as THREE.Box3).getSize(new THREE.Vector3()).length();
    this.markerRadius = opts.markerRadius ?? diag * 0.0032;
    this.epsilon = opts.epsilon ?? diag * 0.002;
    this.minGap = diag * 0.004;
    this.maxJump = diag * 0.05;

    // Geodesic connectivity: weld a separate "position-only" geometry for MeshGraph to use —
    // leaving the rendered mesh untouched (keeping its normals/UV/texture). Position-only ensures
    // vertices at the same surface position get merged by mergeVertices (otherwise per-face
    // normals/UV would block the merge, breaking the graph → the closed loop cuts through the model).
    const posOnly = new THREE.BufferGeometry();
    posOnly.setAttribute(
      "position",
      (meshGeo.getAttribute("position") as THREE.BufferAttribute).clone()
    );
    const graphGeo = mergeVertices(posOnly);
    graphGeo.computeVertexNormals();
    this.graph = new MeshGraph(graphGeo);

    this.store.subscribe(() => this.reconcile());
    // Listen on window in the capture phase (capture=true): receive every pointer event before
    // copper's TrackballControls, so its setPointerCapture / event routing doesn't drop moves mid-drag.
    this.addListeners();
    this.applyCameraGating();
  }

  /** Block the OS right-click menu when the pointer is over the WebGL canvas (not the HTML panels). */
  private onContextMenu = (e: MouseEvent) => {
    if (this.insideContainer(e)) e.preventDefault();
  };

  /** Update the pixel resolution of all fat lines on window resize, otherwise line width distorts. */
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

  // ---- Public API (called from Vue) ----

  getMode(): AnnotationMode {
    return this.mode;
  }

  setMode(m: AnnotationMode) {
    // When leaving geodesic mode: commit an in-progress EDIT of a committed contour, or discard a
    // not-yet-committed new geodesic (clear leftover anchors and line).
    if (m !== "geodesic") {
      if (this.editingId) this.recommitGeodesic();
      else if (this.activeGeo) this.clearActiveGeo();
    }
    this.mode = m;
    // Record armed tool when choosing a drawing mode (not navigate).
    // Camera gating is NOT changed here — the user must use Space to enter drawing.
    if (m !== "navigate") this.armed = m;
    // Returning to Navigate clears the selection too (put everything away).
    if (m === "navigate") this.setSelected(null);
    this.applyCameraGating();
    this.o.onModeChange?.(m);
  }

  getStore(): AnnotationStore {
    return this.store;
  }

  /** Snapshot of the current annotation list. */
  getAnnotations(): Annotation[] {
    return this.store.list();
  }

  undo() {
    // A geodesic being drawn/edited → undo the most recent anchor edit. afterGeoEdit() handles both
    // the in-progress and committed-edit cases uniformly, including degenerate cleanup (so undo can't
    // dispose a committed line or leave a stale edit session).
    if (this.activeGeo && this.activeGeo.canUndo()) {
      this.activeGeo.undoEdit();
      this.afterGeoEdit();
      return;
    }
    this.store.undo();
  }

  clearAll() {
    // Drop any edit session first; the edited line is owned by the store and disposed by clear() below.
    if (this.editingId) {
      this.activeGeoLine = undefined;
      this.editingId = null;
      this.geoClosed = false;
    }
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
    // If we're deleting the geodesic currently being edited, tear the edit session down first so
    // its anchor handles aren't orphaned in the scene (the line itself is removed by reconcile).
    if (this.editingId === id) {
      this.removeGeoMarkers();
      this.activeGeo = undefined;
      this.activeGeoLine = undefined;
      this.editingId = null;
      this.geoClosed = false;
    }
    if (this.selectedId === id) this.setSelected(null);
    this.store.remove(id);
    this.emitInteraction();
  }

  selectAnnotation(id: string | null) {
    // Commit any open geodesic edit before the selection changes.
    if (this.editingId && this.editingId !== id) this.recommitGeodesic();
    this.selectedId = id;
    this.applySelection();
    if (!id) return;
    const a = this.store.get(id);
    if (!a) return;
    // Selecting an annotation switches to the tool that drew it, so you can carry on editing it
    // (and a geodesic opens its anchor handles). points → Place point; contour → its draw mode.
    const tool: AnnotationMode = a.type === "points" ? "point" : a.mode ?? "freehand";
    if (this.mode !== tool) this.setMode(tool);
    // With Geodesic now active, re-open the contour's anchors for editing.
    if (this.mode === "geodesic") this.tryOpenGeoEdit(id);
  }

  /** Change the selection from inside the engine (delete / deselect-on-navigate) and mirror it to the UI. */
  private setSelected(id: string | null) {
    if (this.selectedId === id) return;
    this.selectedId = id;
    this.applySelection();
    this.o.onSelectionChange?.(id);
  }

  /** Redraw the corresponding three object after a color change. */
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

  setVisible(id: string, visible: boolean) {
    this.store.setVisible(id, visible);
  }

  /** Show/hide every annotation in this model in one reconcile (backs the per-model hide-all button). */
  setAllVisible(visible: boolean) {
    for (const a of this.store.list()) a.visible = visible;
    this.store.touch(); // one notify → reconcile() applies object3D.visible
  }

  /**
   * Rebuild annotations from an exported payload (local-space points). Normals are taken from the
   * point when present ([x,y,z,nx,ny,nz]); otherwise recovered from the welded graph's nearest
   * vertex. Each imported item becomes first-class (select/recolor/hide/delete/export).
   */
  importAnnotations(payload: { annotations: Array<{
    id?: string; type: "contour" | "points"; mode: "freehand" | "geodesic" | null;
    label: string; color: string; closed: boolean; visible?: boolean; points: number[][];
    anchors?: number[][];
  }> }): number {
    let count = 0;
    let maxImported = this.seq;
    for (const a of payload.annotations ?? []) {
      const verts: AnnotationVertex[] = a.points.map((p) => this.rawToVertex(p));
      // Geodesic control points, if the payload carries them → keep the contour editable.
      const anchors: AnnotationVertex[] | undefined =
        a.mode === "geodesic" && a.anchors && a.anchors.length
          ? a.anchors.map((p) => this.rawToVertex(p))
          : undefined;
      if (a.type === "points") {
        for (const v of verts) {
          // Only reuse the provided id for a single-point entry (the round-trip case);
          // a multi-point points entry must get a fresh id per marker to avoid duplicate keys.
          const id = a.id && verts.length === 1 ? a.id : this.nextId();
          const marker = makePointMarker(v, this.o.mesh, a.color, this.markerRadius);
          this.o.scene.add(marker);
          this.store.add({
            id,
            type: "points",
            mode: null,
            label: a.label,
            color: a.color,
            closed: false,
            visible: a.visible ?? true,
            vertices: [v],
            object3D: marker,
          });
          // track max numeric id
          const m = id.match(/^a(\d+)$/);
          if (m) maxImported = Math.max(maxImported, parseInt(m[1], 10));
          count++;
        }
      } else {
        if (verts.length < 2) continue;
        const id = a.id ?? this.nextId();
        const line = makeContourLine(verts, a.color, a.closed, this.o.container, this.epsilon, this.o.mesh);
        this.o.scene.add(line);
        this.store.add({
          id,
          type: "contour",
          mode: a.mode,
          label: a.label,
          color: a.color,
          closed: a.closed,
          visible: a.visible ?? true,
          vertices: verts,
          anchors,
          object3D: line,
        });
        const m = id.match(/^a(\d+)$/);
        if (m) maxImported = Math.max(maxImported, parseInt(m[1], 10));
        count++;
      }
    }
    // keep seq ahead of any imported numeric ids to avoid collisions
    if (maxImported > this.seq) this.seq = maxImported;
    return count;
  }

  // ---- Internal ----

  private get drawing(): boolean {
    return this.drawLock || this.spaceHeld;
  }

  private applyCameraGating() {
    // Default is navigate (camera enabled). Drawing only when drawLock or spaceHeld.
    this.o.controls.enabled = !this.drawing;
    this.emitInteraction();
  }

  /** Emit the current interaction state (camera gating + whether a geodesic is editable). */
  private emitInteraction() {
    this.o.onInteractionChange?.({
      drawing: this.drawing,
      armed: this.armed,
      locked: this.drawLock,
      editing: !!this.activeGeo,
    });
  }

  /** Reconcile the scene against store.list(): add missing objects, remove deleted ones (no dispose, kept for undo restore). */
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
    // Apply per-annotation visibility
    for (const a of this.store.list()) {
      if (a.object3D) a.object3D.visible = a.visible;
    }
    this.applySelection();
    this.o.onChange?.(this.store.list());
  }

  private applySelection() {
    for (const a of this.store.list()) {
      if (!a.object3D) continue;
      if (!a.visible) continue;
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
    // Traverse so composite handles (Group of rim + core meshes) are fully freed, not just the root.
    o.traverse((c) => {
      const any = c as THREE.Mesh;
      any.geometry?.dispose?.();
      const mat = any.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose?.();
    });
  }

  private nextId(): string {
    return "a" + ++this.seq;
  }

  /** Parse a raw exported point ([x,y,z] or [x,y,z,nx,ny,nz], local space) into an AnnotationVertex, recovering the normal from the nearest graph vertex when absent. */
  private rawToVertex(p: number[]): AnnotationVertex {
    const [x, y, z] = p;
    let nx = p[3], ny = p[4], nz = p[5];
    if (nx === undefined || ny === undefined || nz === undefined) {
      const nrm = this.graph.nearestNormalLocal(new THREE.Vector3(x, y, z));
      nx = nrm.x; ny = nrm.y; nz = nrm.z;
    }
    return { x, y, z, nx, ny, nz, faceIndex: 0 };
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
   * Whether the event target is the WebGL canvas inside the container.
   * Only accept the canvas: panels (GUIDE / control panel / the ✕ buttons in the annotation list)
   * are all children of the container, so checking contains alone would treat clicks on the panels
   * as drawing on the model — which "leaks through" the delete buttons and makes ✕ hard to click.
   * Responding only to pointer events on the canvas fully isolates the UI from the drawing surface.
   */
  private insideContainer(e: Event): boolean {
    const t = e.target as HTMLElement | null;
    return !!t && t.tagName === "CANVAS" && this.o.container.contains(t);
  }

  private onPointerDown = (e: PointerEvent) => {
    if (!this.insideContainer(e)) return;

    // Geodesic anchor editing (drag to move / right-click to delete) is available whenever an
    // editable geodesic exists — even outside draw-lock — because it requires precisely hitting an
    // existing anchor. This lets the user rotate the model freely and still grab a point. Handled
    // BEFORE the button/drawing gates below.
    if (this.armed === "geodesic" && this.activeGeo) {
      if (e.button === 2) {
        const pick = this.pickGeoMarker(e);
        if (pick >= 0) {
          e.preventDefault();
          this.activeGeo.removeAnchorAt(pick);
          this.afterGeoEdit();
          return;
        }
      } else if (e.button === 0) {
        const pick = this.pickGeoMarker(e);
        if (pick >= 0) {
          e.preventDefault();
          this.draggingAnchor = pick;
          this.pointerDown = true;
          this.o.controls.enabled = false; // suppress camera while dragging the anchor
          this.o.container.style.cursor = "grabbing";
          return;
        }
        // Missed every anchor → if the click lands on the line body, insert a new anchor there
        // (works in an edit session or an in-progress geodesic, regardless of draw-lock).
        if (this.activeGeo.anchorCount >= 2) {
          const h = this.hit(e);
          if (h) {
            const insertAt = this.activeGeo.nearestInsertIndex(
              h.point,
              this.o.mesh.matrixWorld,
              this.geoClosed,
              this.minGap * 4
            );
            if (insertAt >= 0) {
              e.preventDefault();
              this.activeGeo.insertAnchorAt(
                insertAt + 1,
                this.o.mesh.worldToLocal(h.point.clone())
              );
              this.afterGeoEdit();
              return;
            }
          }
        }
      }
    }

    if (e.button !== 0) return; // the remaining tools are left-button only
    this.pointerDown = true;

    // Only act with the armed tool when in drawing mode (drawLock or spaceHeld).
    // When not drawing, navigation is the default — pointer events go to camera controls.
    if (!this.drawing) return;

    // Use armed tool (not this.mode which may be "navigate")
    const activeTool = this.armed;

    if (activeTool === "point") {
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
        visible: true,
        vertices: [v],
        object3D: marker,
      };
      this.store.add(ann);
      return;
    }

    if (activeTool === "freehand") {
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

    if (activeTool === "geodesic") {
      // Anchor grab/delete was already handled above; here we only drop a NEW anchor on the surface
      // (clicks on an existing anchor never reach this point).
      const h = this.hit(e);
      if (!h) return;
      if (!this.activeGeo) {
        this.activeGeo = new GeodesicContour(this.graph, this.o.mesh);
      }
      const local = this.o.mesh.worldToLocal(h.point.clone());
      this.activeGeo.addAnchor(local);
      this.afterGeoEdit();
    }
  };

  /** After any anchor edit: refresh markers + line; drop/delete the contour when it becomes degenerate. */
  private afterGeoEdit() {
    if (!this.activeGeo) return;
    if (this.editingId) {
      // Editing a committed contour: fewer than 2 anchors → delete the whole annotation.
      if (this.activeGeo.anchorCount < 2) {
        const id = this.editingId;
        this.removeGeoMarkers();
        this.activeGeo = undefined;
        this.activeGeoLine = undefined; // owned by the annotation; deleteAnnotation disposes it
        this.editingId = null;
        this.geoClosed = false;
        this.deleteAnnotation(id);
        this.emitInteraction();
        return;
      }
      this.rebuildGeoMarkers();
      this.redrawGeoLine();
      this.emitInteraction();
      return;
    }
    // In-progress new geodesic.
    if (this.activeGeo.anchorCount === 0) {
      this.clearActiveGeo();
    } else {
      this.rebuildGeoMarkers();
      this.redrawGeoLine();
    }
    this.emitInteraction();
  }

  /** Coalesce live drag redraws to one per animation frame (moveAnchorTo runs Dijkstra per move). */
  private scheduleGeoRedraw() {
    if (this.geoRedrawScheduled) return;
    this.geoRedrawScheduled = true;
    requestAnimationFrame(() => {
      this.geoRedrawScheduled = false;
      this.rebuildGeoMarkers();
      this.redrawGeoLine();
      if (this.draggingAnchor >= 0) {
        this.o.container.style.cursor = "grabbing";
        // keep the grabbed handle emphasized through the live rebuilds
        this.activeGeoMarkers[this.draggingAnchor]?.scale.setScalar(1.4);
      }
    });
  }

  /**
   * Pick an in-progress anchor: return the index of the nearest anchor (screen pixel distance <
   * tolerance), or -1 on a miss.
   *
   * Uses "screen-space pixel distance" instead of ray/sphere intersection: the anchor spheres are
   * tiny, so strict ray/sphere hits require pixel-perfect aiming and most clicks miss — and a miss
   * falls through to the "add anchor" branch, so trying to delete a point ends up adding one. That
   * was the root cause of the old "deleting a point takes several clicks, must hit the sphere dead
   * center" problem. Projecting each anchor to the screen and taking the nearest within tolerance
   * makes deletion stable and reliable. The tolerance is enlarged relative to the sphere's screen
   * radius to make it easy to hit.
   */
  private pickGeoMarker(e: PointerEvent): number {
    if (!this.activeGeoMarkers.length) return -1;
    const rect = this.o.container.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const TOL = 16; // hit tolerance (pixels), larger than the sphere itself for forgiving clicks
    let best = -1;
    let bestDist = TOL;
    const v = this._projV;
    for (let i = 0; i < this.activeGeoMarkers.length; i++) {
      v.copy(this.activeGeoMarkers[i].position).project(this.o.camera);
      if (v.z > 1) continue; // projects behind the camera, skip
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

  /**
   * Set the currently hovered anchor (-1 = none): scale it up as a highlight and show a "grab"
   * cursor to signal it's draggable. Delete is now a right-click (no floating ✕ affordance).
   */
  private setGeoHover(idx: number) {
    if (idx === this.hoveredGeoMarker) return;
    const prev = this.activeGeoMarkers[this.hoveredGeoMarker];
    if (prev) prev.scale.setScalar(1);
    this.hoveredGeoMarker = idx;
    const cur = this.activeGeoMarkers[idx];
    // Don't fight the "grabbing" cursor set during an active drag.
    if (this.draggingAnchor >= 0) return;
    if (cur) {
      cur.scale.setScalar(1.35);
      this.o.container.style.cursor = "grab";
    } else {
      this.o.container.style.cursor = "";
    }
  }

  /** Rebuild the visible anchor spheres from the current anchors (slightly larger than placed points, so they're easy to see and grab). */
  private rebuildGeoMarkers() {
    this.setGeoHover(-1);
    for (const m of this.activeGeoMarkers) {
      this.o.scene.remove(m);
      this.disposeObject(m);
    }
    this.activeGeoMarkers = [];
    if (!this.activeGeo) return;
    for (const v of this.activeGeo.getAnchorLocals()) {
      const marker = makeAnchorHandle(
        v,
        this.o.mesh,
        this.geodesicColor,
        this.markerRadius * 1.7
      );
      this.o.scene.add(marker);
      this.activeGeoMarkers.push(marker);
    }
  }

  /** Redraw the active geodesic from its current anchors (honoring the closed state); when editing a committed contour, also keep the stored annotation data in sync so export stays correct. */
  private redrawGeoLine() {
    if (!this.activeGeo) return;
    const closed = this.geoClosed;
    const verts = this.activeGeo.buildVertices(closed);
    if (verts.length < 2) {
      // Only dispose the line for an in-progress geodesic; when editing, the line belongs to the annotation.
      if (this.activeGeoLine && !this.editingId) {
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
        closed,
        this.o.container,
        this.epsilon,
        this.o.mesh
      );
      this.o.scene.add(this.activeGeoLine);
    } else {
      updateContourLine(
        this.activeGeoLine,
        verts,
        closed,
        this.epsilon,
        this.o.mesh
      );
    }
    // Live-sync the committed annotation's data while it is being edited.
    if (this.editingId) {
      const a = this.store.get(this.editingId);
      if (a) {
        a.vertices = verts;
        a.closed = closed;
        a.anchors = this.activeGeo.getAnchorLocals();
      }
    }
  }

  /** Discard the in-progress geodesic: remove and dispose the line and all anchors. */
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
    this.emitInteraction();
  }

  /** Remove all anchor spheres of the in-progress geodesic (called after committing: only the line remains). */
  private removeGeoMarkers() {
    this.setGeoHover(-1);
    for (const m of this.activeGeoMarkers) {
      this.o.scene.remove(m);
      this.disposeObject(m);
    }
    this.activeGeoMarkers = [];
  }

  private onPointerMove = (e: PointerEvent) => {
    // Live anchor drag: move the grabbed anchor to the surface point under the cursor and redraw
    // (both adjacent segments recompute inside moveAnchorTo). Takes priority over everything else.
    if (this.draggingAnchor >= 0) {
      const h = this.hit(e);
      if (h && this.activeGeo) {
        this.activeGeo.moveAnchorTo(
          this.draggingAnchor,
          this.o.mesh.worldToLocal(h.point.clone())
        );
        this.scheduleGeoRedraw();
      }
      return;
    }
    // Track if user dragged while space was held (so a hold-drag is not treated as a tap).
    if (this.spaceHeld && this.pointerDown) {
      this.spaceDragged = true;
    }
    // When not drawing, navigation is default — don't interfere with camera controls.
    if (!this.drawing) {
      // In geodesic mode we can still show the hover hint when not drawing.
      if (this.armed === "geodesic" && !this.pointerDown) {
        this.setGeoHover(
          this.insideContainer(e) ? this.pickGeoMarker(e) : -1
        );
      } else {
        this.setGeoHover(-1);
      }
      return;
    }
    // Drawing mode: geodesic hover hint
    if (this.armed === "geodesic" && !this.pointerDown) {
      this.setGeoHover(
        this.insideContainer(e) ? this.pickGeoMarker(e) : -1
      );
    }
    if (
      this.armed === "freehand" &&
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
    // Finish an anchor drag: restore camera gating + cursor. (Re-commit of an edited committed
    // contour is wired in Task 1.5.)
    if (this.draggingAnchor >= 0) {
      this.draggingAnchor = -1;
      this.pointerDown = false;
      this.o.container.style.cursor = this.hoveredGeoMarker >= 0 ? "grab" : "";
      this.applyCameraGating();
      return;
    }
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
          visible: true,
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
    // Use a geodesic along the surface to connect the last point back to the first, so a straight chord doesn't "shortcut" through the model interior and get occluded.
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

  /** Compute the geodesic path a→b along the mesh surface (local vertices), dropping the first point that coincides with a. a/b are already local. */
  private surfacePathBetween(
    a: AnnotationVertex,
    b: AnnotationVertex
  ): AnnotationVertex[] {
    const va = this.graph.nearestVertex(new THREE.Vector3(a.x, a.y, a.z));
    const vb = this.graph.nearestVertex(new THREE.Vector3(b.x, b.y, b.z));
    const path = this.graph.shortestPath(va, vb);
    return path.slice(1).map((i) => this.graph.vertexLocal(i));
  }

  /** Finish the current geodesic: close it into a ring and commit it as one contour. */
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
        visible: true,
        vertices: verts,
        anchors: this.activeGeo.getAnchorLocals(),
        object3D: this.activeGeoLine,
      };
      this.store.add(ann);
    } else {
      this.o.scene.remove(this.activeGeoLine);
      this.disposeObject(this.activeGeoLine);
    }
    // After committing, clear the visible anchors and leave only the surface-hugging line.
    this.removeGeoMarkers();
    this.activeGeo = undefined;
    this.activeGeoLine = undefined;
    this.geoClosed = false;
    this.emitInteraction();
  }

  /**
   * Re-open a committed geodesic contour for editing: rebuild its anchors (from the stored positions)
   * as draggable markers and reuse its line for live updates. No-op for non-geodesic / anchorless
   * annotations. The edit session ends on Enter / mode-switch / selecting another / Esc.
   */
  private tryOpenGeoEdit(id: string) {
    if (this.editingId === id) return;
    const a = this.store.get(id);
    if (!a || a.type !== "contour" || a.mode !== "geodesic" || !a.anchors || a.anchors.length < 2) {
      return;
    }
    // Discard a half-drawn (uncommitted) geodesic before entering the edit session.
    if (this.activeGeo && !this.editingId) this.clearActiveGeo();
    const indices = a.anchors.map((v) =>
      this.graph.nearestVertex(new THREE.Vector3(v.x, v.y, v.z))
    );
    this.activeGeo = GeodesicContour.fromAnchors(this.graph, this.o.mesh, indices);
    this.activeGeoLine = (a.object3D as Line2 | null) ?? undefined;
    this.editingId = id;
    this.geoClosed = a.closed;
    this.rebuildGeoMarkers();
    this.redrawGeoLine();
    this.emitInteraction();
  }

  /**
   * Finalize an edit session on a committed geodesic: the annotation data was kept in sync live
   * (redrawGeoLine), so here we just remove the edit markers, notify subscribers, and end the
   * session — or delete the annotation if it was reduced below 2 anchors.
   */
  private recommitGeodesic() {
    const id = this.editingId;
    if (!id) return;
    if (!this.activeGeo || this.activeGeo.anchorCount < 2) {
      this.removeGeoMarkers();
      this.activeGeo = undefined;
      this.activeGeoLine = undefined; // owned by the annotation
      this.editingId = null;
      this.geoClosed = false;
      this.deleteAnnotation(id);
      this.emitInteraction();
      return;
    }
    this.redrawGeoLine(); // final data sync
    this.removeGeoMarkers();
    this.activeGeo = undefined;
    this.activeGeoLine = undefined; // owned by the annotation, do not dispose
    this.editingId = null;
    this.geoClosed = false;
    this.store.touch();
    this.emitInteraction();
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
      if (!this.spaceHeld) {
        this.spaceDownAt = performance.now();
        this.spaceDragged = false;
      }
      this.spaceHeld = true;
      this.applyCameraGating();
      e.preventDefault();
      return;
    }
    if (e.key === "Escape") {
      // First Esc clears an active selection / in-progress geodesic while staying in the current
      // tool; a second Esc (nothing selected) returns to Navigate.
      if (this.selectedId || this.activeGeo) {
        if (this.editingId) this.recommitGeodesic();
        else if (this.activeGeo) this.clearActiveGeo();
        this.setSelected(null);
        this.drawLock = false;
        this.applyCameraGating();
        return;
      }
      this.drawLock = false;
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
      // Editing a committed geodesic → finalize the edit; a fresh geodesic in progress → finish and
      // close it; otherwise close the most recent freehand line.
      if (this.editingId) this.recommitGeodesic();
      else if (this.activeGeo) this.finishGeodesic();
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
      const held = performance.now() - this.spaceDownAt;
      this.spaceHeld = false;
      if (held <= SurfaceAnnotator.TAP_MS && !this.spaceDragged) {
        this.drawLock = !this.drawLock; // tap toggles lock
      }
      this.applyCameraGating();
    }
  };

  private addListeners() {
    if (this.listenersOn) return;
    window.addEventListener("pointerdown", this.onPointerDown, true);
    window.addEventListener("pointermove", this.onPointerMove, true);
    window.addEventListener("pointerup", this.onPointerUp, true);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("resize", this.onResize);
    window.addEventListener("contextmenu", this.onContextMenu, true);
    this.listenersOn = true;
  }

  private removeListeners() {
    if (!this.listenersOn) return;
    window.removeEventListener("pointerdown", this.onPointerDown, true);
    window.removeEventListener("pointermove", this.onPointerMove, true);
    window.removeEventListener("pointerup", this.onPointerUp, true);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("contextmenu", this.onContextMenu, true);
    this.listenersOn = false;
  }

  /** Attach input listeners and make this annotator live. Idempotent. */
  activate() { this.addListeners(); }

  /** Detach input listeners so this annotator ignores input while its lines stay in the scene. Idempotent. */
  deactivate() {
    if (!this.listenersOn) return;
    // Finish or discard any in-progress geodesic so a dormant annotator leaves no half-state.
    if (this.editingId) this.recommitGeodesic();
    else if (this.activeGeo) this.clearActiveGeo();
    // Discard any in-progress freehand stroke — only onPointerUp commits it, and we are detaching
    // that listener; committing a half-drawn stroke on an active-model switch would be surprising.
    if (this.activeStroke && this.activeLine) {
      this.o.scene.remove(this.activeLine);
      this.disposeObject(this.activeLine);
      this.activeStroke = undefined;
      this.activeLine = undefined;
    }
    // Reset transient pointer state so a later activate() cannot commit stale drag/stroke data.
    this.draggingAnchor = -1;
    this.pointerDown = false;
    // Release draw-lock / space and un-gate the camera so a dormant model never leaves controls locked.
    this.drawLock = false;
    this.spaceHeld = false;
    this.applyCameraGating();
    this.removeListeners();
  }

  dispose() {
    this.clearActiveGeo();
    this.removeListeners();
  }
}
