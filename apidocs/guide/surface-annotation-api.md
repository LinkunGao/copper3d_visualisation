# Copper3D Surface Annotation API — English

> Available since `copper3d_visualisation` v3.6.0-beta
> Module: `src/ts/Utils/surfaceAnnotation/`, exposed via `copperScene.createSurfaceAnnotator()`

## 1. Overview

Surface annotation lets you draw on the surface of **any 3D model**:

- Draw **contour lines**, in two modes:
  - **Freehand**: hold the left mouse button and drag; the stroke is projected onto the surface in real time.
  - **Geodesic**: click a few anchor points; the path is computed as the shortest route along the mesh surface (hugs the terrain). Each anchor is shown as a marker you can click again to remove (hovering it shows a ✕); `Enter` finishes the contour and removes the anchor markers, leaving only the line.
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
| `selectAnnotation(id \| null)` | Select one (highlight: thicker contour / larger point) |
| `refreshAnnotation(id)` | Re-render the 3D object after a color change (pairs with `store.setColor`) |
| `deleteAnnotation(id)` | Delete one |
| `undo()` | Undo the most recent add / delete |
| `clearAll()` | Clear everything |
| `exportJSON(modelName, opts?)` | Export to a JS object, see §6 |
| `dispose()` | Release (removes event listeners). Always call on teardown |

### 3.4 `getStore()` common methods (`AnnotationStore`)

| Method | Description |
|---|---|
| `subscribe(cb)` | Subscribe to list changes; returns an unsubscribe function |
| `list()` / `get(id)` | Get the list / a single item |
| `setLabel(id, label)` | Rename (UI refreshes automatically; no 3D re-render needed) |
| `setColor(id, color)` | Recolor (**then call `annotator.refreshAnnotation(id)` to update the 3D object**) |

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
  vertices: AnnotationVertex[];
  object3D: THREE.Object3D | null;       // render object reference
}

interface ExportOptions {
  space?: "local" | "world";   // default "local"
  includeNormals?: boolean;    // when true, points are [x,y,z,nx,ny,nz]
}
```

## 4. Interaction & Shortcuts

In an annotation mode, the annotator captures the left mouse button and disables camera rotation. Shortcuts are bound on `window` (capture phase, so TrackballControls cannot intercept them).

| Action | Behavior |
|---|---|
| Left drag (Freehand) | Draw along the surface |
| Left click (Geodesic) | Add an anchor; adjacent anchors are connected by a geodesic. Click on **or near** an existing anchor (hover shows a ✕) to remove it — picking uses a screen-space pixel tolerance, so you don't have to hit the marker exactly. Clicking in open space adds a new anchor |
| Left click (Place point) | Drop a fiducial marker |
| `1` / `2` / `3` / `4` | Switch to navigate / freehand / geodesic / point |
| `Esc` | Back to navigate |
| Hold `Space` | Temporarily re-enable camera rotation (release to resume annotating) |
| `Enter` | Close / finish the current contour (closes along the surface; for a geodesic, removes the anchor markers and leaves only the line) |
| `Ctrl + Z` | Undo. During an in-progress geodesic, undoes the last anchor edit (add **or** removal), so a cancelled anchor can be restored |
| `Delete` | Delete the selected annotation |

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
      "points": [[x, y, z], ["..."]]
    },
    {
      "id": "a2",
      "type": "points",
      "mode": null,
      "label": "Point 2",
      "color": "#ffd166",
      "closed": false,
      "points": [[x, y, z]]
    }
  ]
}
```

With `includeNormals: true`, each point is `[x, y, z, nx, ny, nz]`.

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

### Example 5 — Teardown

```ts
// on component unmount / model switch
annotator.dispose();          // or scene.disposeSurfaceAnnotators();
appRenderer.dispose();
```

## 8. Caveats

- **Framing / lighting / loading are yours.** The annotator touches none of them — add lights and set the camera for each new model.
- **After a color change you must call `refreshAnnotation(id)`.** `store.setColor` only updates data; the 3D object's color is updated by `refreshAnnotation`. `setLabel` needs no re-render.
- **Shortcuts are global (window-level).** `1/2/3/4`, `Enter`, `Delete`, `Ctrl+Z`, `Space` are all listened for. If your page uses these keys elsewhere, conflicts are possible — call `dispose()` when you are done to unbind.
- **Prefer a single active annotator per page.** Events are on the window capture phase; multiple instances would all respond. In multi-model scenarios, `dispose()` the old one before creating a new one.
- **Geodesic connectivity.** If the model consists of **several disconnected shells**, a geodesic (or closing segment) across shells falls back to a straight line. A single connected mesh works best.
- **Geodesic performance.** Heap Dijkstra; ~30k vertices is < 100ms per click. **Very large meshes** (hundreds of thousands of vertices) may lag (nearest-vertex lookup is O(V)).
- **Your mesh is not modified.** Pathfinding uses a position-only welded copy; your mesh's normals/UVs/textures are untouched. The geometry must have a `position` attribute.
- **Export returns an object; it does not download for you.** The browser download / UI trigger is up to you (see the `appendChild` gotcha in Example 4).
- **Closing follows the surface.** `Enter` connects the last point back to the first via a geodesic, not a straight chord, so it never cuts through the model.
- **Freehand is a screen-stroke projection.** Consecutive samples are joined by straight segments (unlike Geodesic, which strictly follows the surface). When the stroke grazes a cleft or silhouette edge, samples that jump to a far/back face are **dropped automatically** (distance-spike + normal-flip test) to avoid a segment cutting through the model; for strict surface hugging, use **Geodesic** mode.
- **Camera gating.** The annotator toggles `scene.controls.enabled` (on in navigate, off in annotation modes, on while `Space` is held). Coordinate with any other code that controls it.
- **Contours & markers render on top.** Contour lines and point / geodesic-anchor markers are drawn with depth testing disabled, so they stay fully visible on rough or voxelised surfaces (never swallowed by ridges between the camera and the line) and during drawing. The trade-off is that they are also visible through the model from the far side — intentional, for annotation legibility. A geometric surface offset (`epsilon`) alone cannot achieve this on bumpy meshes (too little sinks into the surface, too much floats above it), which is why depth testing is disabled instead.

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
} from "copper3d_visualisation";
```

`createSurfaceAnnotator` is a method on `copperScene`, called on a scene instance.
