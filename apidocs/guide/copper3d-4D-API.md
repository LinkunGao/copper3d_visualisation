# copper3d — Aligned 4D MRI + Surface API

Reference for the changes added to copper3d that let you render a cine MRI (one slice,
N cardiac phases) **spatially and temporally aligned** with deforming surface meshes
(e.g. LV endo/epi), all from raw DICOM + VTK, with one shared clock and proper disposal.

Everything is exported from the package entry (`copper3d_visualisation` / `../ts/index`).

> 📖 **Want the "why" behind the API?** See the companion deep dive
> [4D Heart (MRI + LV Surfaces) Aligned Rendering](./4D-MRI-LV-rendering.md), which walks
> through how the 32 MRI frames + 64 VTK models are loaded, aligned, and animated on a single
> cardiac clock.

---

## 1. High-level entry: `copperScene.loadAligned4D()`

The one call you normally use. Loads the DICOM cine and the surface sequences, places the
MRI plane at its true patient-space pose, keeps the surfaces in their own world
coordinates, drives both off a single frame clock, and hands you a controller.

```ts
loadAligned4D(
  opts: aligned4DOptsType,
  callback?: (ctrl: Aligned4DController) => void
): void
```

### Options — `aligned4DOptsType`

| field | type | required | meaning |
|---|---|---|---|
| `dicomUrls` | `string[]` | yes | The N DICOM frames (one slice, N cardiac phases). Order does not matter — they are sorted internally by TriggerTime/SliceLocation. |
| `surfaces` | `aligned4DSurfaceType[]` | no | Zero or more surface sequences (e.g. endo, epi). |
| `cycleMs` | `number` | no | Playback period for one full loop in ms. Default `1012` (≈ one cardiac cycle). |
| `window` | `{ center: number; width: number }` | no | Override the DICOM window center/width. Omit to use the value baked in the DICOM. |

### Surface sequence — `aligned4DSurfaceType`

| field | type | required | meaning |
|---|---|---|---|
| `name` | `string` | yes | Key used later in the controller (e.g. `"endo"`). |
| `urls` | `string[]` | yes | The N VTK frames for this surface, in cardiac-phase order (index 0..N-1). |
| `opts` | `IOptVTKLoader` | no | Material options: `{ wireframe?, color?, transparent?, opacity? }`. |
| `offset` | `number` | no | Phase offset (in frames) of this surface relative to the MRI. Default `0`. |

> Surfaces keep their original VTK coordinates (patient space, mm). They are **not**
> centered or scaled — that is what makes them line up with the MRI plane.

### Example

```ts
const dicomUrls = Array.from({ length: 32 }, (_, i) => `/data/mri_4ch/${i + 1}.dcm`);
const pad3 = (n: number) => String(n).padStart(3, "0");
const endo = Array.from({ length: 32 }, (_, i) => `/data/lv/endo_${pad3(i)}.vtk`);
const epi  = Array.from({ length: 32 }, (_, i) => `/data/lv/epi_${pad3(i)}.vtk`);

scene.loadAligned4D(
  {
    dicomUrls,
    surfaces: [
      { name: "endo", urls: endo, opts: { color: 0xff5a6e, transparent: true, opacity: 0.85 } },
      { name: "epi",  urls: epi,  opts: { color: 0x4ea1ff, transparent: true, opacity: 0.25 } },
    ],
    // cycleMs: 900,
    // window: { center: 226, width: 537 },
  },
  (ctrl) => {
    // runs once everything is loaded and on screen
    ctrl.setPlaneOpacity(0.9);
    scene.loadViewUrl("/data/heart4d_view.json"); // set the camera the usual copper3d way
  }
);
```

---

## 2. The controller: `Aligned4DController`

The object passed to your `callback`. Use it to drive playback and appearance at runtime.

| method / field | signature | what it does |
|---|---|---|
| `plane` | `THREE.Mesh` | The MRI plane mesh (ShaderMaterial). |
| `surfaceMeshes` | `Record<string, THREE.Mesh>` | Each surface mesh by `name`. |
| `frameCount` | `number` | Number of cardiac phases (= `dicomUrls.length`). |
| `play()` | `() => void` | Resume playback. |
| `pause()` | `() => void` | Pause playback. |
| `toggle()` | `() => void` | Toggle play/pause. |
| `setSpeed(x)` | `(x: number) => void` | Playback speed multiplier (e.g. `0.5`, `2`). |
| `setFrame(i)` | `(i: number) => void` | Jump to an absolute frame `i` (wraps; good for a scrub slider while paused). |
| `setFrameOffset(name, n)` | `(name: string, n: number) => void` | Phase-shift one surface by `n` frames vs the MRI (live). |
| `setWindow(center, width)` | `(center: number, width: number) => void` | Re-window the MRI (16-bit, recomputed). |
| `setPlaneOpacity(v)` | `(v: number) => void` | MRI plane opacity, `0..1`. Auto-enables transparency when `v < 1`. |
| `setSurfaceOpacity(name, v)` | `(name: string, v: number) => void` | Opacity of one surface, `0..1`. Auto-enables transparency when `v < 1`. |
| `setSurfaceVisible(name, visible)` | `(name: string, visible: boolean) => void` | Show/hide one surface. |
| `dispose()` | `() => void` | Stops the clock and disposes all geometries / textures / materials, and removes meshes from the scene. **Call this on teardown.** |

### Example (wiring to UI)

```ts
let ctrl: Aligned4DController | undefined;
// ... inside loadAligned4D callback: ctrl = controller;

playBtn.onclick   = () => ctrl?.toggle();
speedSlider.oninput = (e) => ctrl?.setSpeed(+e.target.value);
endoAlpha.oninput  = (e) => ctrl?.setSurfaceOpacity("endo", +e.target.value);
epiToggle.onchange = (e) => ctrl?.setSurfaceVisible("epi", e.target.checked);
mriAlpha.oninput   = (e) => ctrl?.setPlaneOpacity(+e.target.value);
windowSlider.oninput = () => ctrl?.setWindow(center, width);

// teardown (e.g. Vue onBeforeUnmount):
appRenderer.stop();
ctrl?.dispose();
```

---

## 3. Renderer teardown: `copperRenderer.stop()`

Stops the render loop (cancels the requestAnimationFrame chain) so the canvas/GPU context
can be reclaimed. Call it together with `ctrl.dispose()` when leaving the page to avoid the
"laggy after a while" leak.

```ts
stop(): void
```

```ts
onBeforeUnmount(() => {
  appRenderer.stop();
  ctrl?.dispose();
});
```

---

## 4. Low-level building blocks (only if you bypass `loadAligned4D`)

### 4.1 `computeImagePlaneCorners()` — DICOM tags → world corners

Exported from the DICOM loader. Computes the 4 world-space corners of a DICOM image plane.
IPP is the **center** of pixel (0,0), so corners are half a pixel out. `PixelSpacing` is
`[rowSpacing, colSpacing]`; the first IOP vector is the +column-index direction.

```ts
import { computeImagePlaneCorners } from "copper3d_visualisation";

function computeImagePlaneCorners(
  ipp: number[],     // ImagePositionPatient [x,y,z]
  iop: number[],     // ImageOrientationPatient [rx,ry,rz, cx,cy,cz]
  spacing: number[], // PixelSpacing [rowSpacing, colSpacing]
  cols: number,      // Columns
  rows: number       // Rows
): planeCorners;     // { tl, tr, bl, br } each [x,y,z]
```

### 4.2 `copperVolumeType` — new fields

The DICOM loader now also fills these (all optional; present when the tags exist):

```ts
interface copperVolumeType {
  /* ...existing... */
  instanceNumber?: number;
  imagePositionPatient?: number[];    // IPP [x,y,z]
  imageOrientationPatient?: number[]; // IOP [rx,ry,rz, cx,cy,cz]
  pixelSpacing?: number[];            // [rowSpacing, colSpacing]
  corners?: planeCorners;             // pre-computed world-space plane corners
}
```

### 4.3 `createTexture2D_Array()` — aligned plane + frame/window control

The 2D texture builder gained an `aligned` flag and two control helpers. With
`aligned = true` and a volume that has `corners`, the plane is built at its real
world pose (instead of a centered `PlaneGeometry`).

```ts
function createTexture2D_Array(
  copperVolume: copperVolumeType,
  depth: number,            // number of stacked frames (cine length)
  scene: THREE.Scene,
  gui?: GUI,
  aligned?: boolean         // default false; true → world-placed corner quad
): {
  mesh: THREE.Mesh;
  copperVolume: copperVolumeType;
  updateTexture: (v: copperVolumeType) => void;
  setFrame: (i: number) => void;            // set the visible cine frame (depth uniform)
  setWindow: (center: number, width: number) => void; // re-window (16-bit)
};
```

> Default (`aligned = false`) keeps the legacy behaviour used by `loadDicom`, so the
> existing volume-scroll examples are unchanged.

---

## 5. How alignment works (one paragraph)

The DICOM and the surfaces are already in the **same patient coordinate frame** (LPS, mm).
The MRI plane is built from the 4 world corners derived from `ImagePositionPatient` +
`ImageOrientationPatient` + `PixelSpacing`; the surfaces are loaded with their original VTK
coordinates (no center/scale). Both therefore coincide automatically — no manual transform.
Temporal alignment comes from a single shared `frameIndex` that drives the MRI texture
layer (`depth` uniform) and the surface geometry swap simultaneously. The texture UV in the
plane is a fixed structural mapping (corner `tl` ↔ pixel (0,0)), so it is correct for any
dataset, not just one case.

---

## 6. Quick checklist for consumers

- [ ] Pass all DICOM frames in `dicomUrls` (order doesn't matter, sorted internally).
- [ ] Pass each surface's VTK frames in cardiac-phase order (index 0..N-1).
- [ ] Drive the camera with `scene.loadViewUrl(...)` (camera is NOT baked into the package).
- [ ] Use `setFrameOffset(name, n)` if a surface is phase-shifted vs the MRI.
- [ ] Always call `appRenderer.stop()` + `ctrl.dispose()` on teardown.
