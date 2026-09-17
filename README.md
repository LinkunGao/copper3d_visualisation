# copper3d

[![NPM Package][npm]][npm-url]
[![Read the Docs][readthedocs]][readthedocs-url]
[![Copper3d Examples][examples]][examples-url]
[![NRRD_Segmentation_Tool example][nrrd_example]][nrrd_example-url]
[![MedTech Heart example][heart_example]][heart_example-url]

A 3D visualisation package based on three.js — multiple scenes, NRRD/DICOM image loading, and a full medical image segmentation annotation engine.

### Documentation

https://copper3d-visualisation.readthedocs.io/en/latest/

### Previous versions

Old: https://www.npmjs.com/package/copper3d_visualisation
Very old: https://www.npmjs.com/package/gltfloader-plugin-test

### Examples

[Pick model with Gltfloader](https://linkungao.github.io/loadHumanModel_example/)
[Copper3d_examples](https://linkungao.github.io/copper3d_examples)

---

### Basic Usage

**Load demo**

```ts
import * as Copper from "copper3d";
import { getCurrentInstance, onMounted } from "vue";

let appRenderer;
onMounted(() => {
  const { $refs } = (getCurrentInstance() as any).proxy;
  const bg: HTMLDivElement = $refs.classfy;
  appRenderer = new Copper.copperRenderer(bg);
  appRenderer.getCurrentScene().createDemoMesh();
  appRenderer.animate();
});
```

**Options**

```ts
appRenderer = new Copper.copperRenderer(bg, { guiOpen: true });
```

**Multiple scenes with glTF**

```ts
function loadModel(url: string, name: string) {
  let scene = appRenderer.getSceneByName(name);
  if (!scene) {
    scene = appRenderer.createScene(name);
    appRenderer.setCurrentScene(scene);
    scene.loadViewUrl("/noInfarct_view.json");
    scene.loadGltf(url);
  } else {
    appRenderer.setCurrentScene(scene);
  }
}
```

**View data structure**

```ts
CameraViewPoint {
  nearPlane: number = 0.1;
  farPlane: number = 2000.0;
  eyePosition: Array<number> = [0.0, 0.0, 0.0];
  targetPosition: Array<number> = [0.0, 0.0, 0.0];
  upVector: Array<number> = [0.0, 1.0, 0.0];
}
```

---

### Loading NRRD volumes

`scene.loadNrrd(url, loadingBar, segmentation, callback, opts?)` fetches, gunzips and parses
the volume **in a shared Web Worker**; the pixel buffer comes back as a transferable and the
main thread only rehydrates a `Volume` around it. Two concurrent loads of the same URL share
one network transfer. The worker is inlined into the bundle, so there is no second asset file
to serve.

```ts
const controller = new AbortController();

scene.loadNrrd(url, loadingBar, false, (volume, meshes, slices) => { /* ... */ }, {
  openGui: false,
  axes: ["z"],                  // extract only the planes you show
  knownMinMax: [min, max],      // skip three's whole-volume intensity scan
  signal: controller.signal,    // cancel a superseded load
  onProgress: (e) => setProgress(e.total > 0 ? e.loaded / e.total : null),
  onError: (err) => showFailure(err),
});
```

| Option | Type | Description |
|--------|------|-------------|
| `openGui` | `boolean` | Show the built-in volume GUI |
| `container` | `HTMLDivElement` | Host element for that GUI |
| `axes` | `readonly ("x"\|"y"\|"z")[]` | Which slice planes to extract. Default `["x","y","z"]`. Omitted axes are `undefined` on the callback's `meshes` / `slices` |
| `knownMinMax` | `[number, number]` | Volume intensity range, if already known (e.g. from a backend headers endpoint). Skips `Volume.computeMinMax()`'s full voxel scan |
| `signal` | `AbortSignal` | Aborts the in-flight fetch. `onError` fires with a `DOMException` whose `name` is `"AbortError"` |
| `onProgress` | `(e: ProgressEvent) => void` | Download progress, in addition to the built-in loading bar |
| `onError` | `(error: unknown) => void` | Fetch or parse failure |

Skipped a plane and need it later? `ensureAxisExtracted(slices, axis, meshes?)` extracts it on
demand, mutating `slices` (and `meshes`) in place. `NrrdTools.setSliceOrientation()` already
calls it for you, so an axial-only load can still switch to sagittal or coronal.

---

## NrrdTools Usage Guide

> Copper3D `NrrdTools` — Medical Image Segmentation Annotation Engine

`NrrdTools` manages multi-layer mask volumes, a layered canvas pipeline, drawing tools, undo/redo history, channel color customization, and keyboard shortcuts on top of a Three.js medical image viewer.

> **Internal Architecture**: `NrrdTools` is a **Facade** using **composition** (no inheritance). It composes:
> - **`CanvasState`** — unified state container (nrrd_states, gui_states, protectedData, callbacks, keyboardSettings)
> - **`DrawToolCore`** — tool orchestration and event routing
> - **`RenderingUtils`** — slice extraction and canvas compositing helpers
> - **`LayerChannelManager`** — layer/channel/sphere-type management and color customization
> - **`SliceRenderPipeline`** — slice setup, canvas rendering, mask reload, canvas flip
> - **`DataLoader`** — NRRD slice loading, NIfTI voxel loading
>
> The old inheritance chain (`NrrdTools → DrawToolCore → CommToolsData`) has been fully replaced. All modules communicate via `ToolContext` (shared state). The public API below is unchanged.

---

### 1. Quick Start

```typescript
import * as Copper from 'copper3d';

const container = document.getElementById('viewer') as HTMLDivElement;
const nrrdTools = new Copper.NrrdTools(container);

nrrdTools.reset();
nrrdTools.setAllSlices(allSlices); // allSlices from Copper scene loader

nrrdTools.drag({ getSliceNum: (index) => console.log('Slice:', index) });

nrrdTools.draw({
  getMaskData: (sliceData, layerId, channelId, sliceIndex, axis, width, height, clearFlag) => {
    // Called after every stroke, undo, redo — sync to backend here
  }
});

scene.addPreRenderCallbackFunction(nrrdTools.start);
```

---

### 2. Constructor & Initialization

```typescript
new Copper.NrrdTools(container: HTMLDivElement, options?: { layers?: string[] })
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `container` | `HTMLDivElement` | required | Host DOM element for all annotation canvases |
| `options.layers` | `string[]` | `["layer1","layer2","layer3"]` | Named layers to create |

```typescript
// Custom layer set
const nrrdTools = new Copper.NrrdTools(container, {
  layers: ['layer1', 'layer2', 'layer3', 'layer4']
});

// Optional: show current slice index in a panel
nrrdTools.setDisplaySliceIndexPanel(document.getElementById('slice-panel') as HTMLDivElement);

// Optional: connect dat.GUI / lil-gui
import GUI from 'lil-gui';
nrrdTools.setupGUI(new GUI() as any);
```

---

### 3. Data Loading

```typescript
// Reset state then load new slices
nrrdTools.reset();
nrrdTools.setAllSlices(allSlices);
```

**Loading existing NIfTI mask data**

Each buffer must have its own NIfTI voxel grid registered first. A buffer whose grid does not
match the loaded image — or that was never registered — is **refused**, not truncated or
zero-padded, because a wrong-grid mask would otherwise render silently offset onto the wrong
voxels. Other layers in the same map still load.

```typescript
import { registerNiftiMaskGrid } from 'copper3d';

registerNiftiMaskGrid(layer1Uint8Array, layer1Dims); // dims = NIfTI header [x, y, z]
registerNiftiMaskGrid(layer2Uint8Array, layer2Dims);

const layerVoxels = new Map<string, Uint8Array>([
  ['layer1', layer1Uint8Array],
  ['layer2', layer2Uint8Array],
]);
nrrdTools.setMasksFromNIfTI(layerVoxels);

// With loading progress bar
const loadingBar = { value: 0 };
nrrdTools.setMasksFromNIfTI(layerVoxels, loadingBar);
```

A refused layer is logged and reported through `notifyUser`, which defaults to a console
write — the package ships without a UI and does not reach into yours. Point it at your own:

```typescript
nrrdTools.notifyUser = (message, level) => toast[level](message); // 'error' | 'warning' | 'info'
```

**Contrast series**

A case is a series of contrasts. `addSkip` / `removeSkip` index the **full** contrast list;
`setContrastIndex` indexes `displaySlices`, the displayed subset. Each of those ends in a full
display refresh, so use the batched forms when changing several at once:

```typescript
nrrdTools.setSkips([{ index: 1, skip: true }, { index: 2, skip: true }]);
nrrdTools.commitSkipsAndContrast(skipEntries, 0);        // skips + contrast, one refresh
nrrdTools.commitSeriesLoad(allSlices, skipEntries, 0);   // whole case load, one refresh
```

**Read-only preview while loading**

`setAnnotationSuspended(true)` blocks every input that can write into a mask, while slice
scrubbing, zoom, pan and the crosshair stay live:

```typescript
nrrdTools.setAnnotationSuspended(true);
await loadAllContrasts(caseId);
nrrdTools.commitSeriesLoad(allSlices, skipEntries, 0);
nrrdTools.setAnnotationSuspended(false);
```

Disabling your own toolbar is not equivalent: a tool selected before the load began stays
armed on the canvas, and a stroke made during loading cannot be undone — `afterLoadSlice`
clears the undo stack each time a slice arrives.

---

### 4. Render Loop Integration

```typescript
// Register once after initialization
const callbackId = scene.addPreRenderCallbackFunction(nrrdTools.start);

// Unregister on teardown
scene.removePreRenderCallbackFunction(callbackId);
```

---

### 5. Drawing Setup

#### `drag()` — Slice navigation

```typescript
nrrdTools.drag({
  showNumber: true,
  getSliceNum: (sliceIndex, contrastIndex) => updateUI(sliceIndex),
});
```

#### `draw()` — Annotation callbacks

```typescript
nrrdTools.draw({
  getMaskData: (sliceData, layerId, channelId, sliceIndex, axis, width, height, clearFlag?) => {
    sendSliceToBackend({ sliceData, layerId, channelId, sliceIndex, axis, width, height, clearFlag });
  },
  onClearLayerVolume: (layerId) => notifyBackendLayerCleared(layerId),
  getSphereData: (sphereOrigin, sphereRadius) => sendSphereToBackend({ sphereOrigin, sphereRadius }),
  getCalculateSpherePositionsData: (tumour, skin, rib, nipple, axis) => {
    if (tumour && skin && rib && nipple) aiBackend.runSegmentation({ tumour, skin, rib, nipple, axis });
  },
});
```

#### `enableContrastDragEvents()` — Window/Level

```typescript
nrrdTools.enableContrastDragEvents((step, towards) => {
  console.log(`Contrast: ${towards} ${step}`);
});
```

#### SphereTool — Sphere Types & Channel Mapping

| Sphere Type | Channel | Default Color | `activeSphereType` value |
|-------------|---------|---------------|--------------------------|
| tumour      | 1       | `#10b981`     | `"tumour"` (default)     |
| nipple      | 2       | `#f43f5e`     | `"nipple"`               |
| ribcage     | 3       | `#3b82f6`     | `"ribcage"`              |
| skin        | 4       | `#fbbf24`     | `"skin"`                 |

```typescript
nrrdTools.setActiveSphereType('nipple');  // also updates brush/fill color
const type = nrrdTools.getActiveSphereType(); // → 'tumour' | 'skin' | 'nipple' | 'ribcage'
```

**Programmatic sphere placement (backend → frontend):**

```typescript
// Replicates full click flow internally — no user interaction needed
nrrdTools.setCalculateDistanceSphere(120, 95, 42, 'tumour');
// Coordinates are in unscaled image space; sizeFactor is applied internally
```

---

### 6. Layer & Channel Management

```typescript
// Active layer / channel
nrrdTools.setActiveLayer('layer2');
nrrdTools.setActiveChannel(3);
const layer   = nrrdTools.getActiveLayer();
const channel = nrrdTools.getActiveChannel();

// Layer visibility
nrrdTools.setLayerVisible('layer2', false);
const visible = nrrdTools.isLayerVisible('layer2');
const visMap  = nrrdTools.getLayerVisibility(); // { layer1: true, layer2: false, ... }

// Channel visibility (per layer)
nrrdTools.setChannelVisible('layer1', 2, false);
const allChannelVis = nrrdTools.getChannelVisibility();

// Check if a layer has annotations
if (nrrdTools.hasLayerData('layer1')) await saveLayer('layer1');
```

---

### 7. Channel Color Customization

**Default colors:**

| Channel | Color | Hex |
|---------|-------|-----|
| 1 | Emerald | `#10b981` |
| 2 | Rose | `#f43f5e` |
| 3 | Blue | `#3b82f6` |
| 4 | Amber | `#fbbf24` |
| 5 | Fuchsia | `#d946ef` |
| 6 | Cyan | `#06b6d4` |
| 7 | Orange | `#f97316` |
| 8 | Violet | `#8b5cf6` |

Channels **9–255** are generated from a golden-angle hue walk (137.508° per step) at fixed
saturation and lightness — only hue varies, because a mask that changes brightness between
channels reads as a difference in the greyscale image rather than in the annotation. The eight
seeds above are kept verbatim, so cases annotated before this keep the colours they were
signed off with. `Copper.MAX_ENGINE_CHANNEL` is the ceiling (`255` — one byte per voxel, and
the value *is* the label).

> Distinct is not the same as distinguishable: past roughly twenty channels, neighbouring hues
> stop being tellable apart by eye on a greyscale background. All 255 are addressable; how many
> your product should offer at once is a separate question.

```typescript
// Set one channel color (RGBAColor: { r, g, b, a } — 0-255)
nrrdTools.setChannelColor('layer1', 3, { r: 255, g: 128, b: 0, a: 255 });

// Batch-set (one reloadMasksFromVolume call — better performance)
nrrdTools.setChannelColors('layer1', {
  1: { r: 255, g: 80, b: 80, a: 255 },
  2: { r: 80, g: 180, b: 255, a: 255 },
});

// Apply same channel color across all layers
nrrdTools.setAllLayersChannelColor(1, { r: 0, g: 220, b: 100, a: 255 });

// Read colors
const rgba = nrrdTools.getChannelColor('layer1', 3);
const hex  = nrrdTools.getChannelHexColor('layer1', 3);  // → "#ff8000"
const css  = nrrdTools.getChannelCssColor('layer1', 3);  // → "rgba(255,128,0,1.00)"

// Reset
nrrdTools.resetChannelColors('layer1', 3); // one channel
nrrdTools.resetChannelColors('layer1');    // all channels in layer
nrrdTools.resetChannelColors();            // everything
```

---

### 8. Undo / Redo

Per-layer undo stack (max 50 entries). Every completed stroke pushes a delta snapshot.

```typescript
nrrdTools.undo();
nrrdTools.redo();

// Or via keyboard
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'z') nrrdTools.undo();
  if (e.ctrlKey && e.key === 'y') nrrdTools.redo();
});
```

---

### 9. Keyboard Shortcuts

| Action | Default Key |
|--------|-------------|
| Draw mode | `Shift` (hold) |
| Undo | `z` |
| Redo | `y` |
| Contrast adjust | `Ctrl` / `Meta` (hold) |
| Crosshair | `s` |
| Sphere mode | `q` |
| Mouse wheel | Zoom |

```typescript
nrrdTools.setKeyboardSettings({ undo: 'u', mouseWheel: 'Scroll:Slice' });
const settings = nrrdTools.getKeyboardSettings();

// Suppress shortcuts while a form input is focused
inputEl.addEventListener('focus', () => nrrdTools.enterKeyboardConfig());
inputEl.addEventListener('blur',  () => nrrdTools.exitKeyboardConfig());
```

---

### 10. Clearing Annotations

```typescript
nrrdTools.reset();            // Reset ALL layers, volumes, undo histories, canvases (use when switching cases)
nrrdTools.clearActiveLayer(); // Clear active layer's entire 3D volume + undo history, fire onClearLayerVolume
nrrdTools.clearActiveSlice(); // Clear only the currently viewed 2D slice (undoable)
nrrdTools.clearChannel('layer1', 3); // Erase ONE channel across the whole layer (undoable)
```

`clearChannel` is the only one of these that can delete a single annotation: a finding's mask
is one label inside a volume it shares with every other annotation on the layer, so anything
coarser takes the neighbours with it. Its deltas go on the undo stack, so `undo()` brings the
channel back — which is why you should use it rather than writing zeros into the volume
yourself. It throws on an unknown layer, or a channel outside `[1, 255]`.

---

### 11. API Summary

| Category | Method | Description |
|----------|--------|-------------|
| **Constructor** | `new NrrdTools(container, { layers })` | Create instance with optional layer config |
| **Setup** | `drag(opts?)` | Enable slice-drag navigation |
| | `draw(opts?)` | Bind annotation callbacks |
| | `setupGUI(gui)` | Connect dat.GUI / lil-gui panel |
| | `enableContrastDragEvents(cb)` | Enable Ctrl+drag windowing |
| | `setDisplaySliceIndexPanel(el)` | Show slice index in a panel |
| | `setBaseDrawDisplayCanvasesSize(n)` | Set canvas resolution multiplier (1–8) |
| **Data** | `reset()` | Reset all volumes, undo histories, canvases, sphere data |
| | `clearActiveLayer()` | Clear active layer volume + undo history |
| | `clearActiveSlice()` | Clear current slice (undoable) |
| | `clearChannel(id, ch)` | Erase one channel across a whole layer (undoable); throws on unknown layer or channel outside [1, 255] |
| | `setAllSlices(slices)` | Load NRRD slices, init MaskVolumes |
| | `setMasksFromNIfTI(map, bar?)` | Load saved NIfTI voxel data (grids must be registered first) |
| | `registerNiftiMaskGrid(data, dims)` | *(module export)* Record a mask buffer's NIfTI grid for validation |
| | `notifyUser` | *(assignable property)* How engine messages reach the reader; defaults to a console write |
| **Contrast Series** | `addSkip(i)` / `removeSkip(i)` | Hide / show one contrast (full-list index) |
| | `setSkips(entries)` | Batched skip changes — one display refresh |
| | `setContrastIndex(i)` | Move to a contrast within `displaySlices` |
| | `commitSkipsAndContrast(entries, i)` | Batched skips + contrast — one refresh |
| | `commitSeriesLoad(slices, entries, i)` | Case-load completion — one refresh |
| | `switchAllSlicesArrayData(slices)` | Swap the series (resets view state) |
| | `switchSlicesPreservingView(slices)` | Swap the series, keep slice index / zoom / pan |
| **Render** | `start` | Frame callback — pass to render loop |
| **Layer** | `setActiveLayer(id)` | Switch drawing target layer |
| | `getActiveLayer()` | Read current layer |
| | `setLayerVisible(id, bool)` | Toggle layer in composite view |
| | `isLayerVisible(id)` | Query layer visibility |
| | `getLayerVisibility()` | All layer visibility map |
| | `hasLayerData(id)` | Check if layer has non-zero voxels |
| | `setLayerOpacity(id, opacity)` | Set per-layer opacity (0.1–1.0), triggers re-render |
| | `getLayerOpacity(id)` | Read one layer's opacity |
| | `getLayerOpacityMap()` | All per-layer opacity values |
| **Sphere** | `setActiveSphereType(type)` | Set active sphere type, updates brush color |
| | `getActiveSphereType()` | Read current sphere type |
| | `setCalculateDistanceSphere(x, y, slice, type)` | Programmatically place a calculator sphere |
| **Channel** | `setActiveChannel(ch)` | Switch drawing target channel |
| | `getActiveChannel()` | Read current channel |
| | `setChannelVisible(id, ch, bool)` | Toggle channel visibility in a layer |
| | `isChannelVisible(id, ch)` | Query channel visibility |
| | `getChannelVisibility()` | All channel visibility map |
| **Color** | `setChannelColor(id, ch, rgba)` | Set one channel color in one layer |
| | `setChannelColors(id, map)` | Batch-set colors in one layer |
| | `setAllLayersChannelColor(ch, rgba)` | Set one channel color across all layers |
| | `getChannelColor(id, ch)` | Read RGBA |
| | `getChannelHexColor(id, ch)` | Read Hex string |
| | `getChannelCssColor(id, ch)` | Read CSS rgba() string |
| | `resetChannelColors(id?, ch?)` | Reset to defaults |
| | `MAX_ENGINE_CHANNEL` | *(module export)* Highest storable label, `255` |
| **Tool Mode** | `setMode(mode)` | Switch tool: `"pencil"` / `"brush"` / `"eraser"` / `"sphere"` / `"calculator"` / `"sphereBrush"` / `"sphereEraser"` |
| | `getMode()` | Read current tool mode |
| | `isCalculatorActive()` | Check if calculator (distance) mode is active |
| | `setAnnotationSuspended(bool)` | Block all mask-writing input; scrubbing, zoom, pan and crosshair stay live |
| | `isAnnotationSuspended()` | Query the suspension state |
| **Sphere Brush** | `setSphereBrushRadius(radius)` | Set sphere brush/eraser radius [1, 50] |
| | `getSphereBrushRadius()` | Read current sphere brush/eraser radius |
| **Drawing** | `setOpacity(value)` | Set mask overlay opacity [0.1, 1] |
| | `getOpacity()` | Read current opacity |
| | `setBrushSize(size)` | Set brush/eraser size [5, 50] |
| | `getBrushSize()` | Read current brush size |
| | `setPencilColor(hex)` | Set pencil stroke color (hex string) |
| | `getPencilColor()` | Read current pencil color |
| **Contrast** | `setWindowHigh(value)` | Set window high |
| | `setWindowLow(value)` | Set window low |
| | `finishWindowAdjustment()` | Repaint all contrast slices after drag ends |
| | `adjustContrast(type, delta)` | Nudge `"windowHigh"` / `"windowLow"` by a delta |
| | `getSliderMeta(key)` | Slider min/max/step/value for UI config (`"globalAlpha"`, `"layerAlpha"`, `"brushAndEraserSize"`, …) |
| **Actions** | `executeAction(action, opts?)` | Run: `"undo"` / `"redo"` / `"clearActiveSliceMask"` / `"clearActiveLayerMask"` / `"resetZoom"` / `"downloadCurrentMask"` / `"gaussianSmooth"` (takes `{ sigma? }`) |
| **Navigation** | `setSliceOrientation(axis)` | Switch viewing axis `"x"` / `"y"` / `"z"`; extracts the plane on demand if the load skipped it |
| | `setSliceMoving(step)` | Step the current slice (coalesced per animation frame) |
| | `setMainAreaSize(factor)` | Set the main-area zoom factor [1, 8] |
| **History** | `undo()` / `redo()` | Undo / redo last stroke |
| **Keyboard** | `setKeyboardSettings(partial)` | Remap shortcuts |
| | `getKeyboardSettings()` | Read current bindings |
| | `enterKeyboardConfig()` / `exitKeyboardConfig()` | Suppress / restore shortcuts |
| | `setContrastShortcutEnabled(bool)` | Enable/disable contrast key |
| **Inspect** | `getCurrentImageDimension()` | `[w, h, d]` voxel dims |
| | `getVoxelSpacing()` | Physical mm spacing |
| | `getSpaceOrigin()` | World-space origin |
| | `getMaxSliceNum()` | Max slice index per axis |
| | `getCurrentSlicesNumAndContrastNum()` | Current slice & contrast index |
| | `getMaskData()` | Raw `IMaskData` object |
| | `getNrrdToolsSettings()` | Full `NrrdState` snapshot |
| | `getContainer()` | Host `HTMLElement` |
| | `getDrawingCanvas()` | Top-layer `HTMLCanvasElement` |

---

### 12. Type Reference

```typescript
interface RGBAColor { r: number; g: number; b: number; a: number; } // 0-255

type ChannelColorMap = Record<number, RGBAColor>; // key = channel number, 1-255

interface IDrawOpts {
  getMaskData?: (
    sliceData: Uint8Array, layerId: string, channelId: number,
    sliceIndex: number, axis: 'x' | 'y' | 'z',
    width: number, height: number, clearFlag?: boolean
  ) => void;
  onClearLayerVolume?: (layerId: string) => void;
  getSphereData?: (sphereOrigin: number[], sphereRadius: number) => void;
  getCalculateSpherePositionsData?: (
    tumourOrigin: ICommXYZ | null, skinOrigin: ICommXYZ | null,
    ribOrigin: ICommXYZ | null, nippleOrigin: ICommXYZ | null,
    axis: 'x' | 'y' | 'z'
  ) => void;
}

interface IDragOpts {
  showNumber?: boolean;
  getSliceNum?: (sliceIndex: number, contrastIndex: number) => void;
}

interface IKeyBoardSettings {
  draw: string;
  undo: string;
  redo: string;
  contrast: string[];
  crosshair: string;
  sphere: string;
  mouseWheel: 'Scroll:Zoom' | 'Scroll:Slice';
}

interface ICommXYZ { x: number; y: number; z: number; }

type LayerId      = 'layer1' | 'layer2' | 'layer3' | 'layer4'; // or any string
type ChannelValue = number; // 0 = empty/erased, 1..MAX_ENGINE_CHANNEL (255)
```

---

## Acknowledgements

Special thanks to [Duke University dataset](https://wiki.cancerimagingarchive.net/pages/viewpage.action?pageId=70226903) for providing the MRI data.

---

[npm]: https://img.shields.io/npm/v/copper3d
[npm-url]: https://www.npmjs.com/package/copper3d
[readthedocs]: https://img.shields.io/readthedocs/copper3d_visualisation
[readthedocs-url]: https://copper3d-visualisation.readthedocs.io/en/latest/
[examples]: https://img.shields.io/badge/copper3d__visualisation-examples-orange
[examples-url]: https://linkungao.github.io/copper3d_examples
[nrrd_example]: https://img.shields.io/badge/Nrrd__Segmentation__tool-example-orange
[nrrd_example-url]: https://abi-web-apps.github.io/NRRD_Segmentation_Tool/
[heart_example-url]: https://uoa-heart-mechanics-research.github.io/medtech-heart/model-heart
[heart_example]: https://img.shields.io/badge/Medtech%20Heart-example-brightgreen
