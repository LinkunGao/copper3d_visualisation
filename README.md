# copper3d

[![NPM Package][npm]][npm-url]
[![Read the Docs][readthedocs]][readthedocs-url]
[![Copper3d Examples][examples]][examples-url]
[![NRRD_Segmentation_Tool example][nrrd_example]][nrrd_example-url]
[![MedTech Heart example][heart_example]][heart_example-url]

A 3d visualisation package base on threejs provides multiple scenes and Nrrd image load funtion.

### Documentation:

https://copper3d-visualisation.readthedocs.io/en/latest/

### Previous versions

Old: https://www.npmjs.com/package/copper3d_visualisation
Very old: https://www.npmjs.com/package/gltfloader-plugin-test

### Example

[Pick model with Gltfloader](https://linkungao.github.io/loadHumanModel_example/)

[Copper3d_examples](https://linkungao.github.io/copper3d_examples)

### Useage

- Load demo

```ts
import * as Copper from "copper3d";
import { getCurrentInstance, onMounted } from "vue";
let refs = null;
let appRenderer;
onMounted(() => {
  let { $refs } = (getCurrentInstance() as any).proxy;
  refs = $refs;
  const bg: HTMLDivElement = refs.classfy;
  appRenderer = new Copper.copperRenderer(bg);
  const scene = appRenderer.getCurrentScene();
  scene.createDemoMesh();
  appRenderer.animate();
});
```

- Add options (curently only control gui)

```ts
appRenderer = new Copper.copperRenderer(bg, { guiOpen: true });
```

- Load multiple scenes with gltf-loader

```ts
import * as Copper from "copper3d";
import { getCurrentInstance, onMounted } from "vue";

let refs = null;
let appRenderer;
onMounted(() => {
  let { $refs } = (getCurrentInstance() as any).proxy;
  refs = $refs;
  const bg: HTMLDivElement = refs.classfy;
  appRenderer = new Copper.copperRenderer(bg);
  appRenderer.animate();
  loadModel("/Healthy.glb", "health");
});

function loadModel(url, name) {
  let scene1 = appRenderer.getSceneByName(name);
  if (scene1 == undefined) {
    const scene1 = appRenderer.createScene(name);
    appRenderer.setCurrentScene(scene1);
    scene1.loadViewUrl("/noInfarct_view.json");
    scene1.loadGltf(url);
  } else {
    appRenderer.setCurrentScene(scene1);
  }
}
```

#### Viewdata Structure

```ts
 CameraViewPoint {
  nearPlane: number = 0.1;
  farPlane: number = 2000.0;
  eyePosition: Array<number> = [0.0, 0.0, 0.0];
  targetPosition: Array<number> = [0.0, 0.0, 0.0];
  upVector: Array<number> = [0.0, 1.0, 0.0];
}
```

## NrrdTools Usage Guide

> Copper3D `NrrdTools` — Medical Image Segmentation Annotation Engine

`NrrdTools` is the core annotation engine of Copper3D. It manages multi-layer mask volumes, a layered canvas pipeline, drawing tools, undo/redo history, channel color customization, and keyboard shortcuts — all on top of a Three.js medical image viewer.

---

### Table of Contents

1. [Quick Start](#1-quick-start)
2. [Constructor & Initialization](#2-constructor--initialization)
3. [Data Loading](#3-data-loading)
4. [Render Loop Integration](#4-render-loop-integration)
5. [Drawing Setup](#5-drawing-setup)
6. [Layer & Channel Management](#6-layer--channel-management)
7. [Channel Color Customization](#7-channel-color-customization)
8. [Undo / Redo](#8-undo--redo)
9. [Keyboard Shortcuts](#9-keyboard-shortcuts)
10. [Display & Canvas Control](#10-display--canvas-control)
11. [Reading State & Diagnostics](#11-reading-state--diagnostics)
12. [Advanced Scenarios](#12-advanced-scenarios)
13. [Vue 3 Integration Pattern](#13-vue-3-integration-pattern)
14. [Type Reference](#14-type-reference)

---

### 1. Quick Start

```typescript
import * as Copper from 'copper3d';

// 1. Mount the tool on a container div
const container = document.getElementById('viewer') as HTMLDivElement;
const nrrdTools = new Copper.NrrdTools(container);

// 2. After NRRD images are loaded via Copper scene:
nrrdTools.clear();
nrrdTools.setAllSlices(allSlices);       // allSlices from Copper scene loader

// 3. Hook drawing callbacks
nrrdTools.drag({ getSliceNum: (index, contrastIndex) => {
  console.log('Slice changed to:', index);
}});

nrrdTools.draw({
  getMaskData: (sliceData, layerId, channelId, sliceIndex, axis, width, height, clearFlag) => {
    // Called after every stroke, undo, redo — sync to backend here
    console.log(`Layer ${layerId}, channel ${channelId}, slice ${sliceIndex} on ${axis}-axis`);
  }
});

// 4. Register with the Copper render loop
scene.addPreRenderCallbackFunction(nrrdTools.start);
```

---

### 2. Constructor & Initialization

#### Signature

```typescript
new Copper.NrrdTools(container: HTMLDivElement, options?: { layers?: string[] })
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `container` | `HTMLDivElement` | required | The DOM element that will host all annotation canvases |
| `options.layers` | `string[]` | `["layer1","layer2","layer3"]` | Named layers to create. Each layer gets its own `MaskVolume` and canvas |

#### Example: Single-layer (minimal)

```typescript
const nrrdTools = new Copper.NrrdTools(document.getElementById('viewer') as HTMLDivElement);
```

#### Example: Custom layer set

```typescript
// For a 4-layer segmentation workflow:
// layer1 = Tumour, layer2 = Edema, layer3 = Necrosis, layer4 = Enhancement
const nrrdTools = new Copper.NrrdTools(container, {
  layers: ['layer1', 'layer2', 'layer3', 'layer4']
});
```

> **Important**: The layer list you pass here must match what your backend and UI expect.
> Adding or removing layers later requires re-instantiation.

#### Optional display panel

Attach a panel element to show current slice index in the viewer:

```typescript
const slicePanel = document.getElementById('slice-index-panel') as HTMLDivElement;
nrrdTools.setDisplaySliceIndexPanel(slicePanel);
```

#### Optional GUI (dat.GUI)

If your project uses `dat.GUI`, wire up the built-in control panel:

```typescript
import GUI from 'lil-gui'; // or 'dat.gui'
const gui = new GUI();
nrrdTools.setupGUI(gui as any);
```

---

### 3. Data Loading

#### 3.1 Loading NRRD / NIfTI image slices

This is the entry point that initializes all `MaskVolume` instances to the correct voxel dimensions.
Must be called **after** Copper has loaded and decoded the NRRD files.

```typescript
// Reset state from previous case
nrrdTools.clear();

// allSlices is the array of decoded NRRD slice objects returned by Copper's loader
nrrdTools.setAllSlices(allSlices);
```

> After `setAllSlices()` returns, you may safely call all layer/channel/color APIs.
> Calling color APIs **before** `setAllSlices()` will silently fail (no MaskVolume exists yet).

#### 3.2 Loading existing mask data (NIfTI)

If the user has previously saved annotations, reload them into the volumes:

```typescript
// layerVoxels maps each layer ID to a Uint8Array of raw NIfTI voxels
const layerVoxels = new Map<string, Uint8Array>([
  ['layer1', layer1Uint8Array],
  ['layer2', layer2Uint8Array],
]);

nrrdTools.setMasksFromNIfTI(layerVoxels);
```

With a loading progress bar:

```typescript
const loadingBar = { value: 0 }; // must be a reactive object with .value
nrrdTools.setMasksFromNIfTI(layerVoxels, loadingBar);
```

#### Scenario: Loading a saved case

```typescript
async function loadCase(caseDetail: ICaseDetail) {
  const layerVoxels = new Map<string, Uint8Array>();

  // layer1 — always load from NIfTI if it exists
  if (Number(caseDetail.output.mask_layer1_nii_size) > 0) {
    const voxels = await fetchNiftiVoxels(caseDetail.output.mask_layer1_nii_path!);
    if (voxels) layerVoxels.set('layer1', voxels);
  }

  // layer2 — same pattern
  if (Number(caseDetail.output.mask_layer2_nii_size) > 0) {
    const voxels = await fetchNiftiVoxels(caseDetail.output.mask_layer2_nii_path!);
    if (voxels) layerVoxels.set('layer2', voxels);
  }

  if (layerVoxels.size > 0) {
    nrrdTools.setMasksFromNIfTI(layerVoxels);
  }
}
```

---

### 4. Render Loop Integration

`NrrdTools.start` is a function property that must be called every frame to refresh the annotation overlay on top of the Three.js rendered CT/MRI slice.

#### With Copper scene

```typescript
// Register once after initialization
const callbackId = scene.addPreRenderCallbackFunction(nrrdTools.start);

// Unregister on teardown (e.g., Vue component unmount)
scene.removePreRenderCallbackFunction(callbackId);
```

#### Manual render loop

```typescript
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
  nrrdTools.start();
}
animate();
```

---

### 5. Drawing Setup

#### 5.1 `drag()` — Slice navigation

Enables dragging to scroll through CT/MRI slices. Call once before adding to the render loop.

```typescript
nrrdTools.drag({
  showNumber: true,                                   // optional: show slice number overlay
  getSliceNum: (sliceIndex, contrastIndex) => {       // optional: callback on slice change
    console.log('Now viewing slice:', sliceIndex);
    updateUISliceDisplay(sliceIndex);
  }
});
```

#### 5.2 `draw()` — Annotation callbacks

Hooks into the drawing events. The `getMaskData` callback is the primary integration point for syncing annotations to a backend.

```typescript
nrrdTools.draw({
  // Called after every draw stroke, undo, redo, or clear
  getMaskData: (
    sliceData: Uint8Array,   // Raw voxel data for this slice (label values 0-8)
    layerId: string,          // Which layer was modified, e.g. "layer1"
    channelId: number,        // Active channel (1-8)
    sliceIndex: number,       // Index along the current axis
    axis: 'x' | 'y' | 'z',  // Current viewing axis
    width: number,            // Slice width in voxels
    height: number,           // Slice height in voxels
    clearFlag?: boolean        // true if the user cleared the slice
  ) => {
    sendSliceToBackend({ sliceData, layerId, channelId, sliceIndex, axis, width, height, clearFlag });
  },

  // Called when the user clears an entire layer volume
  onClearLayerVolume: (layerId: string) => {
    console.log(`Layer ${layerId} fully cleared`);
    notifyBackendLayerCleared(layerId);
  },

  // Called when the 3D sphere annotation tool places a sphere
  getSphereData: (sphereOrigin: number[], sphereRadius: number) => {
    console.log('Sphere placed at', sphereOrigin, 'radius', sphereRadius);
  },

  // Called when the calculate-sphere-positions tool fires
  getCalculateSpherePositionsData: (
    tumourOrigin, skinOrigin, ribOrigin, nippleOrigin, axis
  ) => {
    runAISegmentation({ tumourOrigin, skinOrigin, ribOrigin, nippleOrigin, axis });
  },
});
```

#### 5.3 `enableContrastDragEvents()` — Windowing

Enable Ctrl+drag to adjust window/level (brightness/contrast):

```typescript
nrrdTools.enableContrastDragEvents((step: number, towards: 'horizental' | 'vertical') => {
  // step: magnitude of drag movement
  // towards: direction of drag
  console.log(`Contrast adjusted: ${towards} ${step}`);
});
```

---

### 6. Layer & Channel Management

NrrdTools supports **multi-layer** annotation (e.g., tumour, edema, necrosis) and **multi-channel** within each layer (e.g., different anatomical structures painted in different colors).

#### 6.1 Active Layer & Channel

```typescript
// Switch the active layer (where new strokes go)
nrrdTools.setActiveLayer('layer2');

// Switch the active channel within the current layer
nrrdTools.setActiveChannel(3);   // channel 3 = blue by default

// Query current state
const currentLayer   = nrrdTools.getActiveLayer();   // → 'layer2'
const currentChannel = nrrdTools.getActiveChannel(); // → 3
```

#### 6.2 Layer Visibility

Toggle layers on/off in the composite canvas:

```typescript
// Hide layer2 (e.g., edema) while keeping layer1 visible
nrrdTools.setLayerVisible('layer2', false);
nrrdTools.setLayerVisible('layer1', true);

// Query visibility
const layer2Visible = nrrdTools.isLayerVisible('layer2'); // → false

// Get all at once
const visibilityMap = nrrdTools.getLayerVisibility();
// → { layer1: true, layer2: false, layer3: true, layer4: true }
```

#### Scenario: Eye-button toggle in UI

```typescript
function onToggleLayerEye(layerId: string) {
  const current = nrrdTools.isLayerVisible(layerId);
  nrrdTools.setLayerVisible(layerId, !current);
}
```

#### 6.3 Channel Visibility

Each layer can independently show/hide its channels:

```typescript
// Hide channel 2 in layer1 (e.g., secondary annotation color)
nrrdTools.setChannelVisible('layer1', 2, false);

// Show it again
nrrdTools.setChannelVisible('layer1', 2, true);

// Query
const ch2Visible = nrrdTools.isChannelVisible('layer1', 2); // → true

// Get all channel visibility for all layers
const allChannelVis = nrrdTools.getChannelVisibility();
// → { layer1: { 1: true, 2: false, 3: true, ... }, layer2: { 1: true, ... }, ... }
```

#### Scenario: Showing only the selected channel

```typescript
function isolateChannel(layerId: string, targetChannel: number, totalChannels = 8) {
  for (let ch = 1; ch <= totalChannels; ch++) {
    nrrdTools.setChannelVisible(layerId, ch, ch === targetChannel);
  }
}

// Show only channel 1 in layer1
isolateChannel('layer1', 1);

// Restore all
for (let ch = 1; ch <= 8; ch++) {
  nrrdTools.setChannelVisible('layer1', ch, true);
}
```

#### 6.4 Checking if a layer has annotations

```typescript
if (nrrdTools.hasLayerData('layer2')) {
  console.log('layer2 has annotated voxels — saving...');
  await saveLayer('layer2');
} else {
  console.log('layer2 is empty, skipping save');
}
```

---

### 7. Channel Color Customization

Each layer has its own independent color map. Changing channel 3's color in `layer1` does **not** affect `layer2`.

#### Default Channel Colors

| Channel | Color | Hex |
|---------|-------|-----|
| 1 | Green (Tumour) | `#00ff00` |
| 2 | Red (Edema) | `#ff0000` |
| 3 | Blue (Necrosis) | `#0000ff` |
| 4 | Yellow (Enhancement) | `#ffff00` |
| 5 | Magenta (Vessel) | `#ff00ff` |
| 6 | Cyan (Additional) | `#00ffff` |
| 7 | Orange (Auxiliary) | `#ff8000` |
| 8 | Purple (Extended) | `#8000ff` |

#### 7.1 Set a single channel color

```typescript
// RGBAColor: { r, g, b, a } — all values 0-255
nrrdTools.setChannelColor('layer1', 3, { r: 255, g: 128, b: 0, a: 255 }); // → orange
```

#### 7.2 Batch-set multiple channel colors (recommended)

One `reloadMasksFromVolume()` call instead of N calls — better performance:

```typescript
nrrdTools.setChannelColors('layer1', {
  1: { r: 255, g:  80, b:  80, a: 255 },   // Soft red
  2: { r:  80, g: 180, b: 255, a: 255 },   // Sky blue
  3: { r: 255, g: 230, b:  50, a: 255 },   // Golden yellow
});
```

#### 7.3 Apply the same color to all layers

```typescript
// Paint all layers' channel 1 in the same tumour color
nrrdTools.setAllLayersChannelColor(1, { r: 0, g: 220, b: 100, a: 255 });
```

#### 7.4 Read current colors

```typescript
const rgba = nrrdTools.getChannelColor('layer2', 3);
// → { r: 255, g: 128, b: 0, a: 255 }

const hex = nrrdTools.getChannelHexColor('layer2', 3);
// → "#ff8000"  — suitable for canvas fillStyle

const css = nrrdTools.getChannelCssColor('layer2', 3);
// → "rgba(255,128,0,1.00)"  — suitable for Vue :style binding
```

#### 7.5 Reset colors

```typescript
// Reset one channel in one layer
nrrdTools.resetChannelColors('layer1', 3);

// Reset all channels in one layer
nrrdTools.resetChannelColors('layer1');

// Reset everything across all layers
nrrdTools.resetChannelColors();
```

#### Scenario: Color picker integration

```typescript
// User picks a new color in the UI color picker
function onColorPicked(hexColor: string) {
  // Parse hex to RGBA (simple implementation)
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);

  const activeLayer   = nrrdTools.getActiveLayer();
  const activeChannel = nrrdTools.getActiveChannel();

  nrrdTools.setChannelColor(activeLayer, activeChannel, { r, g, b, a: 255 });
}
```

#### Scenario: Vue UI reactivity after color change

After calling `setChannelColor()`, the canvas re-renders automatically.
But Vue computed properties that show the color need a manual nudge:

```typescript
// In your composable or component
const colorVersion = ref(0);

const channelCssColor = computed(() => {
  colorVersion.value; // subscribe to version
  return nrrdTools.value?.getChannelCssColor(activeLayer.value, activeChannel.value) ?? '#00ff00';
});

function refreshColors() {
  colorVersion.value++; // forces recompute
}

// After setting color:
nrrdTools.value.setChannelColor('layer1', 2, { r: 255, g: 0, b: 0, a: 255 });
refreshColors();
```

---

### 8. Undo / Redo

NrrdTools maintains a per-layer undo stack (max 50 entries). Every completed brush stroke pushes a delta snapshot.

```typescript
// Undo the last stroke on the active layer
nrrdTools.undo();

// Redo the last undone stroke
nrrdTools.redo();
```

#### Scenario: Keyboard shortcut binding

```typescript
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'z') nrrdTools.undo();
  if (e.ctrlKey && e.key === 'y') nrrdTools.redo();
});
```

> The built-in keyboard system also handles undo/redo (default: `z` and `y` without Ctrl).
> See [Keyboard Shortcuts](#9-keyboard-shortcuts) for configuring this.

---

### 9. Keyboard Shortcuts

#### Default bindings

| Action | Default Key |
|--------|-------------|
| Draw mode | `Shift` (hold) |
| Undo | `z` |
| Redo | `y` |
| Contrast adjust | `Ctrl` / `Meta` (hold) |
| Crosshair | `s` |
| Mouse wheel | Zoom |

#### Reading current settings

```typescript
const settings = nrrdTools.getKeyboardSettings();
console.log(settings);
// {
//   draw: 'Shift',
//   undo: 'z',
//   redo: 'y',
//   contrast: ['Control', 'Meta'],
//   crosshair: 's',
//   mouseWheel: 'Scroll:Zoom'
// }
```

#### Customizing bindings

```typescript
nrrdTools.setKeyboardSettings({
  undo: 'u',                       // Remap undo to 'u'
  mouseWheel: 'Scroll:Slice',      // Mouse wheel scrolls slices instead of zooming
});
```

#### Scenario: Form input focus — suppressing shortcuts

When a user types in an input field, you don't want tool shortcuts firing:

```typescript
inputElement.addEventListener('focus', () => {
  nrrdTools.enterKeyboardConfig(); // Suppress all tool shortcuts
});

inputElement.addEventListener('blur', () => {
  nrrdTools.exitKeyboardConfig();  // Restore shortcuts
});
```

#### Enabling / disabling contrast shortcut independently

```typescript
// Disable only the contrast (window/level) keyboard shortcut
nrrdTools.setContrastShortcutEnabled(false);

// Check status
const isEnabled = nrrdTools.isContrastShortcutEnabled(); // → false

// Re-enable
nrrdTools.setContrastShortcutEnabled(true);
```

---

### 10. Display & Canvas Control

#### Canvas size scaling

Set the base display size multiplier (1–8). Larger values use more GPU memory but give sharper annotations:

```typescript
nrrdTools.setBaseDrawDisplayCanvasesSize(2); // 2× base resolution
```

#### Reading image metadata

```typescript
// Voxel dimensions [width, height, depth]
const dims = nrrdTools.getCurrentImageDimension();
// → [512, 512, 256]

// Physical spacing (mm per voxel, from NRRD header)
const spacing = nrrdTools.getVoxelSpacing();
// → [0.488, 0.488, 1.0]

// World-space origin
const origin = nrrdTools.getSpaceOrigin();
// → [-125.0, -125.0, -127.5]

// Max slice count per axis
const maxSlices = nrrdTools.getMaxSliceNum();
// → [512, 512, 256]  (one per axis)

// Current viewing state
const { currentIndex, contrastIndex } = nrrdTools.getCurrentSlicesNumAndContrastNum();
```

#### Accessing internal canvases

```typescript
// The topmost interactive canvas (mouse/pen events target here)
const drawingCanvas = nrrdTools.getDrawingCanvas();

// The container element passed to the constructor
const container = nrrdTools.getContainer();

// Raw NrrdStates (all internal state fields)
const states = nrrdTools.getNrrdToolsSettings();
console.log(states.layers);     // ["layer1", "layer2", ...]
console.log(states.dimensions); // [512, 512, 256]
```

#### Accessing full mask data

```typescript
// All MaskVolume data structures
const maskData = nrrdTools.getMaskData();
// maskData.volumes is Record<string, MaskVolume>
```

---

### 11. Reading State & Diagnostics

```typescript
// Full snapshot of current state
const state = nrrdTools.getNrrdToolsSettings();

// Active layer / channel
const layer   = nrrdTools.getActiveLayer();
const channel = nrrdTools.getActiveChannel();

// Visibility maps
const layerVis   = nrrdTools.getLayerVisibility();
const channelVis = nrrdTools.getChannelVisibility();

// Check if any real annotation exists in a layer
const hasTumour = nrrdTools.hasLayerData('layer1');

// Get current channel color as hex
const hex = nrrdTools.getChannelHexColor('layer1', 1); // → "#00ff00"

// Keyboard settings
const keys = nrrdTools.getKeyboardSettings();
```

---

### 12. Advanced Scenarios

#### Scenario A: Complete multi-layer initialization from scratch

```typescript
async function initAnnotationTool(container: HTMLDivElement, allSlices: any[]) {
  // Create tool with 4 layers
  const nrrdTools = new Copper.NrrdTools(container, {
    layers: ['layer1', 'layer2', 'layer3', 'layer4']
  });

  // Attach GUI
  nrrdTools.setupGUI(gui as any);

  // Attach contrast drag
  nrrdTools.enableContrastDragEvents((step, towards) => {
    console.log('Windowing:', towards, step);
  });

  // Load image volume
  nrrdTools.clear();
  nrrdTools.setAllSlices(allSlices);

  // Register callbacks
  nrrdTools.drag({ getSliceNum: (idx) => updateSliceUI(idx) });

  nrrdTools.draw({
    getMaskData: (sliceData, layerId, channelId, sliceIndex, axis, w, h, clearFlag) => {
      syncSliceToBackend({ sliceData, layerId, channelId, sliceIndex, axis, clearFlag });
    },
    onClearLayerVolume: (layerId) => {
      notifyBackendCleared(layerId);
    },
  });

  // Connect to render loop
  scene.addPreRenderCallbackFunction(nrrdTools.start);

  return nrrdTools;
}
```

#### Scenario B: Load existing annotations and apply custom color scheme

```typescript
async function loadAndColorCase(nrrdTools: Copper.NrrdTools, caseId: string) {
  // 1. Load existing NIfTI masks
  const masks = await fetchCaseMasks(caseId);
  const layerVoxels = new Map<string, Uint8Array>();
  for (const [layerId, data] of Object.entries(masks)) {
    layerVoxels.set(layerId, data);
  }
  nrrdTools.setMasksFromNIfTI(layerVoxels);

  // 2. Apply per-layer color schemes
  nrrdTools.setChannelColors('layer1', {
    1: { r: 0,   g: 200, b:  80, a: 255 },  // Tumour core — green
    2: { r: 255, g: 200, b:   0, a: 255 },  // Tumour ring — yellow
  });

  nrrdTools.setChannelColors('layer2', {
    1: { r: 255, g:  60, b:  60, a: 200 },  // Edema — semi-transparent red
  });

  // 3. Set initial active state
  nrrdTools.setActiveLayer('layer1');
  nrrdTools.setActiveChannel(1);
}
```

#### Scenario C: Switching cases — full reset

```typescript
async function switchCase(nrrdTools: Copper.NrrdTools, newCaseData: ICaseData) {
  // Reset annotation volumes
  nrrdTools.clear();

  // Load new image slices (from Copper's scene loader result)
  nrrdTools.setAllSlices(newCaseData.slices);

  // Reset colors to defaults
  nrrdTools.resetChannelColors();

  // Make all layers and channels visible
  for (const layerId of ['layer1', 'layer2', 'layer3', 'layer4']) {
    nrrdTools.setLayerVisible(layerId, true);
    for (let ch = 1; ch <= 8; ch++) {
      nrrdTools.setChannelVisible(layerId, ch, true);
    }
  }

  // Start fresh on layer1, channel1
  nrrdTools.setActiveLayer('layer1');
  nrrdTools.setActiveChannel(1);

  // Load existing masks if available
  if (newCaseData.hasExistingMasks) {
    nrrdTools.setMasksFromNIfTI(newCaseData.layerVoxels);
  }
}
```

#### Scenario D: Save workflow with dirty-layer detection

```typescript
async function onSave(nrrdTools: Copper.NrrdTools, caseId: string) {
  const layers = ['layer1', 'layer2', 'layer3', 'layer4'];

  for (const layerId of layers) {
    if (!nrrdTools.hasLayerData(layerId)) {
      console.log(`${layerId} is empty — initializing blank NIfTI on backend`);
      await initBlankLayerOnBackend(caseId, layerId);
    } else {
      console.log(`${layerId} has data — saving...`);
      await saveLayerToBackend(caseId, layerId);
    }
  }
}
```

#### Scenario E: AI segmentation result — write back to volume

After receiving a segmentation result from a backend AI model, write it directly into a layer:

```typescript
async function applyAIResult(nrrdTools: Copper.NrrdTools, layerId: string) {
  // Fetch AI-generated NIfTI from backend
  const response = await fetch(`/api/ai-result/${layerId}`);
  const buffer = await response.arrayBuffer();
  const voxels = new Uint8Array(buffer);

  // Write directly into the target layer volume
  const layerVoxels = new Map<string, Uint8Array>([[layerId, voxels]]);
  nrrdTools.setMasksFromNIfTI(layerVoxels);

  // Optionally switch to that layer so user sees the result
  nrrdTools.setActiveLayer(layerId);
}
```

#### Scenario F: Dynamic keyboard remap from user settings

```typescript
interface UserPreferences {
  undoKey: string;
  redoKey: string;
  sliceScrollMode: 'zoom' | 'slice';
}

function applyUserKeyboardPreferences(nrrdTools: Copper.NrrdTools, prefs: UserPreferences) {
  nrrdTools.setKeyboardSettings({
    undo: prefs.undoKey,
    redo: prefs.redoKey,
    mouseWheel: prefs.sliceScrollMode === 'slice' ? 'Scroll:Slice' : 'Scroll:Zoom',
  });
}

// Example: Apply on preference change
applyUserKeyboardPreferences(nrrdTools, {
  undoKey: 'u',
  redoKey: 'r',
  sliceScrollMode: 'slice',
});
```

#### Scenario G: Read layer colors to build a color legend

```typescript
function buildColorLegend(nrrdTools: Copper.NrrdTools, layerId: string) {
  const legend = [];
  for (let ch = 1; ch <= 8; ch++) {
    legend.push({
      channel: ch,
      cssColor: nrrdTools.getChannelCssColor(layerId, ch),
      hexColor: nrrdTools.getChannelHexColor(layerId, ch),
      rgba:     nrrdTools.getChannelColor(layerId, ch),
    });
  }
  return legend;
}

// → [
//   { channel: 1, cssColor: 'rgba(0,255,0,1.00)', hexColor: '#00ff00', rgba: { r:0, g:255, b:0, a:255 } },
//   { channel: 2, cssColor: 'rgba(255,0,0,1.00)', hexColor: '#ff0000', ... },
//   ...
// ]
```

---

### 13. Vue 3 Integration Pattern

The recommended pattern in Vue 3 is to distribute the `NrrdTools` instance via a Vue event emitter after NRRD loading completes, so any descendant component can access it.

#### LeftPanel (creator)

```vue
<script setup lang="ts">
import * as Copper from 'copper3d';
import emitter from '@/plugins/custom-emitter';

let nrrdTools: Copper.NrrdTools | undefined;

onMounted(() => {
  nrrdTools = new Copper.NrrdTools(canvasContainer.value as HTMLDivElement, {
    layers: ['layer1', 'layer2', 'layer3', 'layer4']
  });
});

// After all NRRD files are loaded by the Copper scene:
function onAllImagesLoaded(allSlices: any[]) {
  nrrdTools!.clear();
  nrrdTools!.setAllSlices(allSlices);

  nrrdTools!.drag({ getSliceNum: (idx) => emit('sliceChanged', idx) });

  nrrdTools!.draw({
    getMaskData: (sliceData, layerId, channelId, sliceIndex, axis, w, h, clearFlag) => {
      emit('maskDataUpdated', { sliceData, layerId, channelId, sliceIndex, axis, w, h, clearFlag });
    },
    onClearLayerVolume: (layerId) => emit('layerCleared', layerId),
  });

  scene!.addPreRenderCallbackFunction(nrrdTools!.start);

  // Broadcast to all other components
  emitter.emit('Core:NrrdTools', nrrdTools!);
  emitter.emit('Segmentation:FinishLoadAllCaseImages');
}
</script>
```

#### Annotation Control Panel (consumer)

```vue
<script setup lang="ts">
import * as Copper from 'copper3d';
import emitter from '@/plugins/custom-emitter';

const nrrdTools = ref<Copper.NrrdTools>();

onMounted(() => {
  emitter.on('Core:NrrdTools', (tools: Copper.NrrdTools) => {
    nrrdTools.value = tools;
  });

  emitter.on('Segmentation:FinishLoadAllCaseImages', () => {
    // Safe to call all APIs now — MaskVolume is initialized
    syncStateFromTools();
  });
});

function syncStateFromTools() {
  if (!nrrdTools.value) return;
  activeLayer.value   = nrrdTools.value.getActiveLayer();
  activeChannel.value = nrrdTools.value.getActiveChannel();
  layerVisibility.value   = nrrdTools.value.getLayerVisibility();
  channelVisibility.value = nrrdTools.value.getChannelVisibility();
}

function onChannelColorPicked(hex: string) {
  if (!nrrdTools.value) return;
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  nrrdTools.value.setChannelColor(activeLayer.value, activeChannel.value, { r, g, b, a: 255 });
  refreshColors(); // bump colorVersion to re-trigger computed
}
</script>
```

---

### 14. Type Reference

```typescript
// Color type used by all channel color APIs
interface RGBAColor {
  r: number;  // 0-255
  g: number;  // 0-255
  b: number;  // 0-255
  a: number;  // 0-255  (255 = fully opaque)
}

// Batch color map for setChannelColors()
type ChannelColorMap = Record<number, RGBAColor>; // key = channel number 1-8

// draw() options
interface IDrawOpts {
  getMaskData?: (
    sliceData: Uint8Array,
    layerId: string,
    channelId: number,
    sliceIndex: number,
    axis: 'x' | 'y' | 'z',
    width: number,
    height: number,
    clearFlag?: boolean
  ) => void;
  onClearLayerVolume?: (layerId: string) => void;
  getSphereData?: (sphereOrigin: number[], sphereRadius: number) => void;
  getCalculateSpherePositionsData?: (
    tumourOrigin: ICommXYZ | null,
    skinOrigin: ICommXYZ | null,
    ribOrigin: ICommXYZ | null,
    nippleOrigin: ICommXYZ | null,
    axis: 'x' | 'y' | 'z'
  ) => void;
}

// drag() options
interface IDragOpts {
  showNumber?: boolean;
  getSliceNum?: (sliceIndex: number, contrastIndex: number) => void;
}

// Keyboard settings
interface IKeyBoardSettings {
  draw: string;
  undo: string;
  redo: string;
  contrast: string | string[];
  crosshair: string;
  mouseWheel: 'Scroll:Zoom' | 'Scroll:Slice';
}

// 3D coordinate (used in sphere position callbacks)
interface ICommXYZ {
  x: number;
  y: number;
  z: number;
}
```

#### Common type aliases

```typescript
type LayerId     = 'layer1' | 'layer2' | 'layer3' | 'layer4'; // or any string
type ChannelValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
```

---

### API Summary

| Category | Method | Description |
|----------|--------|-------------|
| **Constructor** | `new NrrdTools(container, { layers })` | Create instance with optional layer config |
| **Setup** | `drag(opts?)` | Enable slice-drag navigation |
| | `draw(opts?)` | Bind annotation callbacks |
| | `setupGUI(gui)` | Connect dat.GUI panel |
| | `enableContrastDragEvents(cb)` | Enable Ctrl+drag windowing |
| | `setDisplaySliceIndexPanel(el)` | Show slice index in a panel |
| | `setBaseDrawDisplayCanvasesSize(n)` | Set canvas resolution multiplier (1-8) |
| **Data** | `clear()` | Reset all volumes |
| | `setAllSlices(slices)` | Load NRRD slices, init MaskVolumes |
| | `setMasksFromNIfTI(map)` | Load saved NIfTI voxel data |
| **Render** | `start` | Frame callback — pass to render loop |
| **Layer** | `setActiveLayer(id)` | Switch drawing target layer |
| | `getActiveLayer()` | Read current layer |
| | `setLayerVisible(id, bool)` | Toggle layer in composite view |
| | `isLayerVisible(id)` | Query layer visibility |
| | `getLayerVisibility()` | All layer visibility map |
| | `hasLayerData(id)` | Check if layer has non-zero voxels |
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
| **History** | `undo()` | Undo last stroke |
| | `redo()` | Redo last undone stroke |
| **Keyboard** | `setKeyboardSettings(partial)` | Remap shortcuts |
| | `getKeyboardSettings()` | Read current bindings |
| | `enterKeyboardConfig()` | Suppress all shortcuts |
| | `exitKeyboardConfig()` | Restore shortcuts |
| | `setContrastShortcutEnabled(bool)` | Enable/disable contrast key |
| | `isContrastShortcutEnabled()` | Query contrast key state |
| **Inspect** | `getCurrentImageDimension()` | `[w, h, d]` voxel dims |
| | `getVoxelSpacing()` | Physical mm spacing |
| | `getSpaceOrigin()` | World-space origin |
| | `getMaxSliceNum()` | Max slice index per axis |
| | `getCurrentSlicesNumAndContrastNum()` | Current slice & contrast index |
| | `getMaskData()` | Raw `IMaskData` object |
| | `getNrrdToolsSettings()` | Full `INrrdStates` snapshot |
| | `getContainer()` | Host `HTMLElement` |
| | `getDrawingCanvas()` | Top-layer `HTMLCanvasElement` |

---

## Acknowledgements

Special thanks to [Duke University dataset](https://wiki.cancerimagingarchive.net/pages/viewpage.action?pageId=70226903) provides these awsome MRI data!!!


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