# Copper3D Surface Annotation API — English

> Available since `copper3d_visualisation` v3.6.0-beta
> Module: `src/ts/Utils/surfaceAnnotation/`, exposed via `copperScene.createSurfaceAnnotator()`

## 1. Overview

Surface annotation lets you draw on the surface of **any 3D model**:

- Draw **contour lines**, in two modes:
  - **Freehand**: hold the left mouse button and drag; the stroke is projected onto the surface in real time.
  - **Geodesic**: click a few anchor points; the path is the shortest route along the mesh surface (hugs the terrain), smoothed for a clean curve. **Drag** an anchor to move it, **right-click** to delete, **click the line** to insert one; `Enter` finishes. A finished geodesic can be re-selected later to edit its anchors again.
- Drop **fiducial points**.
- Contours can be **closed into a loop** (the closing segment also follows the surface — it does not cut through the model).
- **Multiple annotations**, each with a color and label; select / rename / recolor / delete / undo / clear.
- **Export coordinates** as JSON, defaulting to **model-local coordinates** (reproducible, unaffected by camera or model placement).

**Format-agnostic**: the annotator operates on a `THREE.Mesh` and bundles no loader. OBJ / glTF / GLB / VTK / STL… anything you can load into a mesh works. You may also pass a `Group/Object3D` (the largest mesh is picked automatically).

**Non-destructive**: geodesics require geometry that is connected by surface position. The annotator internally welds a **position-only copy** of the geometry for pathfinding and **never modifies your mesh's normals / UVs / textures**.

## 2. Quick Start

```ts
import * as Copper from "copper3d_visualisation";

const appRenderer = new Copper.copperRenderer(container, { guiOpen: false });
const scene = appRenderer.createScene("annot") as Copper.copperScene;
appRenderer.setCurrentScene(scene);
appRenderer.animate();

// Load a model with a copper loader, create the annotator in the callback
scene.loadOBJ("/models/heart.obj", (group) => {
  const annotator = scene.createSurfaceAnnotator(group);

  annotator.setMode("freehand"); // or "geodesic" / "point" / "navigate"

  // Export (local coordinates by default)
  // const data = annotator.exportJSON("heart.obj");
});
```

> **Framing & lighting are your responsibility.** The annotator only reuses the scene's camera/container/controls; it does not set the camera or add lights. Use `scene.loadViewUrl()`, set the camera yourself, or add your own lights.

## 3. API Reference

### 3.1 `copperScene.createSurfaceAnnotator(target, opts?)`

```ts
createSurfaceAnnotator(
  target: THREE.Mesh | THREE.Object3D,
  opts?: {
    freehandColor?: string;   // freehand color, default "#e5006e"
    geodesicColor?: string;   // geodesic color, default "#ffa24e"
    pointColor?: string;      // marker color, default "#ffd166"
    lineWidth?: number;       // line width (px), default 3
    markerRadius?: number;    // sphere radius, default bboxDiagonal * 0.0032
    bboxDiagonal?: number;    // size reference; auto-computed from geometry if omitted
    onModeChange?: (mode: AnnotationMode) => void;
    onChange?: (annotations: Annotation[]) => void; // fired on add/delete/undo/clear
    onInteractionChange?: (s: InteractionState) => void; // fired when drawing/armed/lock/editing changes (see §4)
    onSelectionChange?: (id: string | null) => void;     // fired when the ENGINE changes the selection itself (delete, deselect-on-navigate) — mirror it into your list UI
  }
): SurfaceAnnotator
```

- If `target` is a `Mesh` it is used directly; if a `Group/Object3D`, the mesh with the most vertices is chosen. Throws if no mesh is found.
- Reuses `scene.camera / scene.container / scene.controls` — no need to pass them.
- Non-indexed geometry is handled internally (for pathfinding only; your mesh is untouched).

### 3.2 `copperScene.disposeSurfaceAnnotators()`

Disposes every annotator created by this scene (removes the global event listeners).

### 3.3 `SurfaceAnnotator` instance methods

| Method | Description |
|---|---|
| `setMode(mode)` | Switch mode: `"navigate"` / `"freehand"` / `"geodesic"` / `"point"` |
| `getMode()` | Current mode |
| `getAnnotations()` | Snapshot of the current annotation list `Annotation[]` |
| `getStore()` | The underlying `AnnotationStore` (advanced: subscribe / rename / recolor) |
| `selectAnnotation(id \| null)` | Select one (highlight: thicker contour / larger point), or pass `null` to deselect. Selecting **switches to the tool that drew it** (points → `point`, contour → its `freehand`/`geodesic` mode); a geodesic then re-opens its anchor handles for editing |
| `refreshAnnotation(id)` | Re-render the 3D object after a color change (pairs with `store.setColor`) |
| `setVisible(id, visible)` | Show / hide a single annotation (its 3D object is toggled; data is kept) |
| `deleteAnnotation(id)` | Delete one. If it's the geodesic currently being edited, its anchor handles are torn down too (no orphans) |
| `undo()` | Undo the most recent add / delete. During a geodesic that is being drawn/edited, undoes the last anchor edit instead (add / move / remove / insert) |
| `clearAll()` | Clear everything |
| `importAnnotations(payload)` | Rebuild annotations from an exported payload (see §6). Returns the count imported. Missing normals are recovered from the mesh's nearest vertex; missing `visible` defaults to `true`. Each imported item is first-class (select / recolor / hide / delete / export) |
| `exportJSON(modelName, opts?)` | Export to a JS object, see §6 |
| `activate()` | *(multi-model)* Make this annotator the **live** one — (re)attaches its global listeners so `Space` / tools / pointer act on **this** model. Idempotent. Activate exactly one at a time (deactivate the previous first) |
| `deactivate()` | *(multi-model)* Put this annotator **dormant** — commits an in-progress geodesic (or discards an uncommitted one), resets draw-lock, un-gates the camera (`controls.enabled = true`), then detaches its listeners. Its committed lines/markers **stay in the scene, visible**; they just stop responding to input. Idempotent |
| `setAllVisible(visible)` | *(multi-model)* Show / hide **every** annotation of this model in one call (single reconcile) — backs a per-model "hide all annotations" toggle. Does not delete data |
| `dispose()` | Release (removes event listeners). Always call on teardown |

### 3.4 `getStore()` common methods (`AnnotationStore`)

| Method | Description |
|---|---|
| `subscribe(cb)` | Subscribe to list changes; returns an unsubscribe function |
| `list()` / `get(id)` | Get the list / a single item |
| `setLabel(id, label)` | Rename (UI refreshes automatically; no 3D re-render needed) |
| `setColor(id, color)` | Recolor (**then call `annotator.refreshAnnotation(id)` to update the 3D object**) |
| `setVisible(id, visible)` | Show / hide (also reachable via `annotator.setVisible`) |

### 3.5 Types

```ts
type AnnotationMode = "navigate" | "freehand" | "geodesic" | "point";

interface AnnotationVertex {       // position and normal are in model-LOCAL space
  x: number; y: number; z: number;
  nx: number; ny: number; nz: number;
  faceIndex: number;
}

interface Annotation {
  id: string;
  type: "contour" | "points";
  mode: "freehand" | "geodesic" | null; // null for points
  label: string;
  color: string;                         // hex
  closed: boolean;
  visible: boolean;                      // per-annotation show/hide (default true)
  vertices: AnnotationVertex[];
  anchors?: AnnotationVertex[];          // geodesic contours only: the control points, so a committed contour can be re-opened for editing (survives export/import)
  object3D: THREE.Object3D | null;       // render object reference
}

interface ExportOptions {
  space?: "local" | "world";   // default "local"
  includeNormals?: boolean;    // when true, points are [x,y,z,nx,ny,nz]
}

// Live interaction state, emitted by onInteractionChange (see §4)
interface InteractionState {
  drawing: boolean;            // true while strokes/clicks draw (Space held or draw-lock on)
  armed: AnnotationMode;       // the tool that will draw — "freehand" | "geodesic" | "point"
  locked: boolean;             // draw-lock is on (toggled by tapping Space)
  editing: boolean;            // a geodesic is editable now (in-progress or a re-opened committed one) → its anchors can be dragged/deleted/inserted; use it to show an edit hint
}
```

## 4. Interaction & Shortcuts

The annotator is **navigate-first**: choosing a drawing mode (`freehand` / `geodesic` / `point`) **arms** that tool but does **not** take over the mouse — camera rotate / zoom / pan stay active. You enter the **drawing** state explicitly with `Space`:

- **Hold `Space`** — momentary: draw while held; release returns to navigation.
- **Tap `Space`** (a quick press, < 250 ms) — toggles **draw-lock**: drawing stays on until you tap `Space` again.

Only while drawing does the annotator capture the left mouse button and disable camera rotation; otherwise the camera is free. The **armed tool** (not the menu mode) is what acts when you draw, so you can rotate the model, then hold/tap `Space` and immediately draw with the tool you picked. Shortcuts are bound on `window` (capture phase, so TrackballControls cannot intercept them), and are ignored while typing in an `<input>` / `<textarea>`.

| Action | Behavior |
|---|---|
| `1` / `2` / `3` / `4` | Arm navigate / freehand / geodesic / point |
| Hold `Space` | Momentary draw (release → navigate) |
| Tap `Space` (< 250 ms) | Toggle **draw-lock** (drawing stays on) |
| Left drag (Freehand, while drawing) | Draw along the surface |
| Left click on open surface (Geodesic, while drawing) | Add an anchor; adjacent anchors are connected by a smoothed geodesic |
| Left **drag** an anchor (Geodesic) | Move it; the connected segments re-flow live. Works whenever the geodesic is editable — even in the navigate sub-state — so you can rotate, then grab a point |
| **Right-click** an anchor (Geodesic) | Delete it (the OS context menu is suppressed over the canvas) |
| Left click **on the line** between two anchors (Geodesic) | Insert a new anchor there |
| Left click (Place point, while drawing) | Drop a fiducial marker |
| `Esc` | Two-stage: first clears the current selection / cancels an in-progress geodesic (staying in the tool); pressed again (nothing selected) returns to navigate |
| `Enter` | Close / finish the current contour. Editing a committed geodesic → finalizes the edit and hides the handles |
| `Ctrl + Z` | Undo. While a geodesic is being drawn/edited, undoes the last anchor edit (add / move / remove / insert) |
| `Delete` / `Backspace` | Delete the selected annotation |

**Anchor picking** uses a screen-space pixel tolerance, so you don't need to hit the tiny marker exactly. Anchor handles are drawn as a white-rim + tool-colored-core so they stand out against both the line and the surface; deletion is right-click (there is no per-anchor ✕ affordance).

**Editing a committed geodesic.** Select it (in the list or via `selectAnnotation`) — because selecting switches to the Geodesic tool, its anchors re-appear as draggable handles. Drag / right-click / insert edit it live; `Enter`, switching tool, selecting another, or `Esc` finalizes. Reducing it below 2 anchors deletes it. `Annotation.anchors` (and the exported `anchors`) are what make this re-editable across sessions.

Subscribe to `onInteractionChange({ drawing, armed, locked, editing })` to drive a live mode indicator and a geodesic edit hint (show it while `editing`). Subscribe to `onSelectionChange(id)` so engine-initiated selection changes (delete, deselect-on-navigate) stay mirrored in your list UI.

## 5. Coordinate Space (important)

- **Camera pan / zoom / rotate do not change coordinates** — they move the camera, not the model.
- If the **model** is moved / rotated / scaled (object transform or animation), only **local coordinates stay constant**.
- Therefore the annotator **stores coordinates in local space** and derives world coordinates for rendering.
- `exportJSON` **defaults to `space:"local"`** — reproducible and bound to the model's own coordinate frame. Pass `{ space:"world" }` when you need the actual scene position.

> Note: if you **bake** scale/translation into the geometry after loading (e.g. `geometry.scale()`), "local" lands in that transformed space. To keep local = original model-file coordinates, place the model with an **object transform** (`mesh.position/scale`) or via the camera, and **do not bake the geometry**.

## 6. Export Format

`annotator.exportJSON("heart.obj")` returns:

```json
{
  "model": "heart.obj",
  "exportedAt": "2026-06-21T...Z",
  "space": "local",
  "annotations": [
    {
      "id": "a1",
      "type": "contour",
      "mode": "geodesic",
      "label": "LV outline",
      "color": "#ffa24e",
      "closed": true,
      "visible": true,
      "points": [[x, y, z], ["..."]],
      "anchors": [[x, y, z], ["..."]]
    },
    {
      "id": "a2",
      "type": "points",
      "mode": null,
      "label": "Point 2",
      "color": "#ffd166",
      "closed": false,
      "visible": true,
      "points": [[x, y, z]]
    }
  ]
}
```

With `includeNormals: true`, each point is `[x, y, z, nx, ny, nz]`. Each annotation carries its `visible` flag, so a round-trip through `exportJSON` → `importAnnotations` preserves show/hide state. **Geodesic contours** additionally carry `anchors` (their control points, same `[x,y,z]` / `[x,y,z,nx,ny,nz]` shape), so a re-imported geodesic stays editable; `importAnnotations` maps them back to the nearest graph vertices.

> **Round-trip with `importAnnotations`.** Feed the exported object straight back to rebuild the annotations on a freshly loaded model. Points should be in **local** space (the export default). `id` is reused only for single-point entries (so a round-trip keeps stable ids); every other item gets a fresh id to avoid collisions. If a point lacks normals (`[x,y,z]` only), the normal is recovered from the welded graph's nearest vertex.

## 7. Usage Examples

### Example 1 — Minimal (OBJ)

```ts
scene.loadOBJ("/models/heart.obj", (group) => {
  const annotator = scene.createSurfaceAnnotator(group);
  annotator.setMode("geodesic");
});
```

### Example 2 — GLB + custom colors

```ts
scene.loadPureGLB("/models/heart.glb", (group) => {
  const annotator = scene.createSurfaceAnnotator(group, {
    freehandColor: "#00e5ff",
    geodesicColor: "#ff3b6b",
    pointColor: "#ffe066",
    lineWidth: 4,
  });
});
```

### Example 3 — Drive a list UI with `onChange` + rename / recolor

```ts
let annotator;
scene.loadOBJ("/models/heart.obj", (group) => {
  annotator = scene.createSurfaceAnnotator(group, {
    onChange: (annotations) => renderList(annotations), // refresh your UI on change
    onModeChange: (mode) => updateModeButtons(mode),
  });
});

function onSelect(id) { annotator.selectAnnotation(id); }
function onRename(id, label) { annotator.getStore().setLabel(id, label); }
function onRecolor(id, color) {
  annotator.getStore().setColor(id, color);
  annotator.refreshAnnotation(id); // required to update the 3D color
}
```

### Example 4 — Export (local / world / with normals) + browser download

```ts
const local = annotator.exportJSON("heart.obj");                       // local (default)
const world = annotator.exportJSON("heart.obj", { space: "world" });   // world space
const withN = annotator.exportJSON("heart.obj", { includeNormals: true });

// Trigger a download (note: the <a> must be in the DOM to fire in some browsers)
function download(obj, filename = "annotations.json") {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
download(local);
```

### Example 5 — Import a saved file + per-annotation visibility

```ts
scene.loadOBJ("/models/heart.obj", (group) => {
  const annotator = scene.createSurfaceAnnotator(group);

  // Re-hydrate previously exported annotations (e.g. fetched from a backend)
  const saved = await (await fetch("/api/annotations/heart.json")).json();
  const n = annotator.importAnnotations(saved); // returns how many were rebuilt

  // Hide / show a single annotation without deleting it
  annotator.setVisible(saved.annotations[0].id, false);
});
```

### Example 6 — Live mode indicator with `onInteractionChange`

```ts
scene.createSurfaceAnnotator(group, {
  onInteractionChange: ({ drawing, armed, locked, editing }) => {
    badge.textContent = drawing ? `Drawing — ${armed}${locked ? " (locked)" : ""}` : "Navigate";
    editHint.hidden = !editing; // show "drag move · right-click delete · click line insert" while editing a geodesic
  },
  onSelectionChange: (id) => refreshListHighlight(id), // engine may deselect on its own (delete / navigate)
});
```

### Example 7 — Teardown

```ts
// on component unmount / model switch
annotator.dispose();          // or scene.disposeSurfaceAnnotators();
appRenderer.dispose();
```

### Example 8 — Multiple models in one scene (activate / deactivate)

```ts
// Load several models of the same case into ONE scene. Each gets its own
// annotator; only one is "active" (editable) at a time. Dormant models keep
// their contours visible but ignore input.
const annotators = new Map<string, Copper.SurfaceAnnotator>();
let activeId: string | null = null;

function addModel(id: string, group: THREE.Object3D) {
  const a = scene.createSurfaceAnnotator(group);
  a.deactivate();                 // dormant on load — no camera/lighting/framing here (that's yours)
  annotators.set(id, a);
}

function setActive(id: string) {
  if (activeId) annotators.get(activeId)?.deactivate(); // commits/cleans up the old one
  annotators.get(id)?.activate();                       // this model now owns Space / tools
  activeId = id;
}

// Per-model "hide all annotations" toggle (distinct from hiding the surface mesh)
function hideAllAnnotations(id: string, hidden: boolean) {
  annotators.get(id)?.setAllVisible(!hidden);
}

// Teardown one model, or the whole case
function removeModel(id: string) {
  annotators.get(id)?.dispose();  // removes its contours + listeners
  annotators.delete(id);
  if (activeId === id) activeId = null;
}
```

> The engine does not choose which model is "primary" or frame the camera — that's the host app's call (e.g. the Surface Annotator app frames the largest-bounding-box model). The annotator only reuses the scene's existing camera/controls.

## 8. Caveats

- **Framing / lighting / loading are yours.** The annotator touches none of them — add lights and set the camera for each new model.
- **After a color change you must call `refreshAnnotation(id)`.** `store.setColor` only updates data; the 3D object's color is updated by `refreshAnnotation`. `setLabel` needs no re-render.
- **Shortcuts are global (window-level).** `1/2/3/4`, `Enter`, `Delete`, `Ctrl+Z`, `Space` are all listened for. If your page uses these keys elsewhere, conflicts are possible — call `dispose()` when you are done to unbind.
- **Exactly one *active* annotator at a time — but many may coexist.** Events are on the window capture phase, so two *active* instances would both respond to `Space` / tools / pointer. For multiple models in one scene, create an annotator per model and immediately `deactivate()` all but one; call `activate()` on the model you want to edit (and `deactivate()` the previous). Dormant annotators keep their contours in the scene but ignore input, so you no longer have to `dispose()` and reload to switch models. A freshly constructed annotator is **active by default** (backward-compatible), so single-model callers need no changes.
- **Geodesic connectivity.** If the model consists of **several disconnected shells**, a geodesic (or closing segment) across shells falls back to a straight line. A single connected mesh works best.
- **Geodesic performance.** Heap Dijkstra; ~30k vertices is < 100ms per click. **Very large meshes** (hundreds of thousands of vertices) may lag (nearest-vertex lookup is O(V)).
- **Your mesh is not modified.** Pathfinding uses a position-only welded copy; your mesh's normals/UVs/textures are untouched. The geometry must have a `position` attribute.
- **Export returns an object; it does not download for you.** The browser download / UI trigger is up to you (see the `appendChild` gotcha in Example 4).
- **Closing follows the surface.** `Enter` connects the last point back to the first via a geodesic, not a straight chord, so it never cuts through the model.
- **Freehand is a screen-stroke projection.** Consecutive samples are joined by straight segments (unlike Geodesic, which strictly follows the surface). When the stroke grazes a cleft or silhouette edge, samples that jump to a far/back face are **dropped automatically** (distance-spike + normal-flip test) to avoid a segment cutting through the model; for strict surface hugging, use **Geodesic** mode.
- **Camera gating (navigate-first).** The annotator toggles `scene.controls.enabled`: **enabled by default** (you can always orbit), and **disabled only while drawing** — i.e. while `Space` is held or draw-lock is on. Coordinate with any other code that controls it.
- **Contours & markers sit on the surface, occluded by the model.** Contour lines are lifted along the normal by `epsilon` and depth-tested (with a polygon-offset "decal" bias on the surface triangles), so they read cleanly on rough / voxelised meshes without z-fighting, yet are correctly hidden when on the model's far side (no see-through). Point and geodesic-anchor markers are lifted spheres, likewise depth-tested. Geodesic anchor **handles** are drawn as a white rim around a tool-colored core and lifted a touch more, so they stand out against both the line and the surface.

## 9. Exports

From the package root:

```ts
import {
  SurfaceAnnotator,            // value (for instanceof / typing)
} from "copper3d_visualisation";
import type {
  SurfaceAnnotatorOptions,
  Annotation,
  AnnotationMode,
  ExportOptions,
  InteractionState,
} from "copper3d_visualisation";
```

`createSurfaceAnnotator` is a method on `copperScene`, called on a scene instance.
