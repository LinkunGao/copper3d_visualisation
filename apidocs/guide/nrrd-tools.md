# NrrdTools Usage Guide

> Copper3D `NrrdTools` — Medical Image Segmentation Annotation Engine

`NrrdTools` manages multi-layer mask volumes, a layered canvas pipeline, drawing tools, undo/redo history, channel color customization, and keyboard shortcuts — all on top of a Three.js medical image viewer.

> **Internal Architecture**: `NrrdTools` is a **Facade** using **composition** (no inheritance). It composes:
> - **`CanvasState`** — unified state container (nrrd_states, gui_states, protectedData, callbacks, keyboardSettings)
> - **`DrawToolCore`** — tool orchestration and event routing
> - **`RenderingUtils`** — slice extraction and canvas compositing helpers
> - **`LayerChannelManager`** — layer/channel/sphere-type management and color customization
> - **`SliceRenderPipeline`** — slice setup, canvas rendering, mask reload, canvas flip
> - **`DataLoader`** — NRRD slice loading, NIfTI voxel loading
>
> The old inheritance chain (`NrrdTools → DrawToolCore → CommToolsData`) has been fully replaced. All modules communicate via `ToolContext` (shared state) and `Pick<ToolHost, ...>` type aliases. The public API documented below is unchanged.

---

## Table of Contents

1. [Quick Start](#_1-quick-start)
2. [Constructor & Initialization](#_2-constructor-initialization)
3. [Data Loading](#_3-data-loading)
4. [Render Loop Integration](#_4-render-loop-integration)
5. [Drawing Setup](#_5-drawing-setup)
6. [Layer & Channel Management](#_6-layer-channel-management)
7. [Channel Color Customization](#_7-channel-color-customization)
8. [Undo / Redo](#_8-undo-redo)
9. [Keyboard Shortcuts](#_9-keyboard-shortcuts)
10. [Display & Canvas Control](#_10-display-canvas-control)
11. [Advanced Scenarios](#_11-advanced-scenarios)
12. [Vue 3 Integration Pattern](#_12-vue-3-integration-pattern)
13. [API Summary](#_13-api-summary)
14. [Type Reference](#_14-type-reference)

---

## 1. Quick Start

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
    console.log(`Layer ${layerId}, channel ${channelId}, slice ${sliceIndex} on ${axis}-axis`);
  }
});

scene.addPreRenderCallbackFunction(nrrdTools.start);
```

---

## 2. Constructor & Initialization

```typescript
new Copper.NrrdTools(container: HTMLDivElement, options?: { layers?: string[] })
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `container` | `HTMLDivElement` | required | The DOM element that will host all annotation canvases |
| `options.layers` | `string[]` | `["layer1","layer2","layer3"]` | Named layers to create. Each layer gets its own `MaskVolume` and canvas |

**Single-layer (minimal):**

```typescript
const nrrdTools = new Copper.NrrdTools(document.getElementById('viewer') as HTMLDivElement);
```

**Custom layer set:**

```typescript
// For a 4-layer segmentation workflow:
// layer1 = Tumour, layer2 = Edema, layer3 = Necrosis, layer4 = Enhancement
const nrrdTools = new Copper.NrrdTools(container, {
  layers: ['layer1', 'layer2', 'layer3', 'layer4']
});
```

::: warning
The layer list you pass here must match what your backend and UI expect.
Adding or removing layers later requires re-instantiation.
:::

**Optional display panel:**

```typescript
const slicePanel = document.getElementById('slice-index-panel') as HTMLDivElement;
nrrdTools.setDisplaySliceIndexPanel(slicePanel);
```

**Optional GUI (dat.GUI / lil-gui):**

```typescript
import GUI from 'lil-gui';
const gui = new GUI();
nrrdTools.setupGUI(gui as any);
```

---

## 3. Data Loading

### 3.1 Loading NRRD / NIfTI image slices

Must be called **after** Copper has loaded and decoded the NRRD files.

```typescript
nrrdTools.reset();
nrrdTools.setAllSlices(allSlices);
```

::: tip
After `setAllSlices()` returns, you may safely call all layer/channel/color APIs.
Calling color APIs **before** `setAllSlices()` will silently fail (no MaskVolume exists yet).
:::

### 3.2 Loading existing mask data (NIfTI)

```typescript
const layerVoxels = new Map<string, Uint8Array>([
  ['layer1', layer1Uint8Array],
  ['layer2', layer2Uint8Array],
]);
nrrdTools.setMasksFromNIfTI(layerVoxels);

// With loading progress bar
const loadingBar = { value: 0 }; // must be a reactive object with .value
nrrdTools.setMasksFromNIfTI(layerVoxels, loadingBar);
```

**Loading a saved case:**

```typescript
async function loadCase(caseDetail: ICaseDetail) {
  const layerVoxels = new Map<string, Uint8Array>();

  if (Number(caseDetail.output.mask_layer1_nii_size) > 0) {
    const voxels = await fetchNiftiVoxels(caseDetail.output.mask_layer1_nii_path!);
    if (voxels) layerVoxels.set('layer1', voxels);
  }

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

## 4. Render Loop Integration

`NrrdTools.start` must be called every frame to refresh the annotation overlay.

```typescript
// Register once after initialization
const callbackId = scene.addPreRenderCallbackFunction(nrrdTools.start);

// Unregister on teardown (e.g., Vue component unmount)
scene.removePreRenderCallbackFunction(callbackId);
```

**Manual render loop:**

```typescript
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
  nrrdTools.start();
}
animate();
```

---

## 5. Drawing Setup

### 5.1 `drag()` — Slice navigation

```typescript
nrrdTools.drag({
  showNumber: true,
  getSliceNum: (sliceIndex, contrastIndex) => {
    console.log('Now viewing slice:', sliceIndex);
    updateUISliceDisplay(sliceIndex);
  }
});
```

### 5.2 `draw()` — Annotation callbacks

```typescript
nrrdTools.draw({
  // Called after every draw stroke, undo, redo, or clear
  getMaskData: (
    sliceData: Uint8Array,
    layerId: string,
    channelId: number,
    sliceIndex: number,
    axis: 'x' | 'y' | 'z',
    width: number,
    height: number,
    clearFlag?: boolean
  ) => {
    sendSliceToBackend({ sliceData, layerId, channelId, sliceIndex, axis, width, height, clearFlag });
  },

  // Called when the user clears an entire layer volume
  onClearLayerVolume: (layerId: string) => {
    notifyBackendLayerCleared(layerId);
  },

  // Called when a sphere annotation is placed
  getSphereData: (sphereOrigin: number[], sphereRadius: number) => {
    sendSphereToBackend({ sphereOrigin, sphereRadius });
  },

  // Called when calculator sphere positions are updated
  getCalculateSpherePositionsData: (tumour, skin, rib, nipple, axis) => {
    if (tumour && skin && rib && nipple) {
      aiBackend.runSegmentation({ tumour, skin, rib, nipple, axis });
    }
  },
});
```

### 5.3 SphereTool — 3D Sphere Placement & Distance Calculator

#### Sphere Types & Channel Mapping

| Sphere Type | Channel | Default Color | `activeSphereType` value |
|-------------|---------|---------------|--------------------------|
| tumour      | 1       | `#10b981` (Emerald) | `"tumour"` (default) |
| nipple      | 2       | `#f43f5e` (Rose) | `"nipple"` |
| ribcage     | 3       | `#3b82f6` (Blue) | `"ribcage"` |
| skin        | 4       | `#fbbf24` (Amber) | `"skin"` |

```typescript
// Set active sphere type (also updates fillColor / brushColor)
nrrdTools.setActiveSphereType('nipple');
nrrdTools.setActiveSphereType('tumour');

// Read current type
const type = nrrdTools.getActiveSphereType();
// → 'tumour' | 'skin' | 'nipple' | 'ribcage'
```

::: tip
Use the public API — do NOT mutate `gui_states.mode.activeSphereType` directly, as `setActiveSphereType()` also updates brush/fill color as a side-effect.
:::

#### Programmatic Sphere Placement (Backend → Frontend)

When the backend returns sphere coordinates (e.g., from AI detection), use `setCalculateDistanceSphere()` to place them without user interaction:

```typescript
// Place a tumour sphere at (120, 95) on slice 42
nrrdTools.setCalculateDistanceSphere(120, 95, 42, 'tumour');
```

Internally, this method:
1. Sets `sphereRadius = 5` and navigates to the target slice
2. Records `sphereOrigin` on all 3 axes via `crosshairTool.setUpSphereOrigins`
3. Deep-copies the origin into the type-specific field (e.g., `tumourSphereOrigin`)
4. Draws the sphere preview on canvas
5. Writes all placed spheres to `sphereMaskVolume`
6. Re-renders the sphere overlay

::: warning
Coordinates (`x`, `y`) are in **unscaled** image space. The method automatically applies `sizeFactor` scaling internally.
:::

### 5.4 `enableContrastDragEvents()` — Window/Level

```typescript
nrrdTools.enableContrastDragEvents((step: number, towards: 'horizental' | 'vertical') => {
  console.log(`Contrast adjusted: ${towards} ${step}`);
});
```

---

## 6. Layer & Channel Management

NrrdTools supports **multi-layer** annotation (e.g., tumour, edema, necrosis) and **multi-channel** within each layer.

### 6.1 Active Layer & Channel

```typescript
nrrdTools.setActiveLayer('layer2');
nrrdTools.setActiveChannel(3);

const currentLayer   = nrrdTools.getActiveLayer();   // → 'layer2'
const currentChannel = nrrdTools.getActiveChannel(); // → 3
```

### 6.2 Layer Visibility

```typescript
nrrdTools.setLayerVisible('layer2', false);
nrrdTools.setLayerVisible('layer1', true);

const visible    = nrrdTools.isLayerVisible('layer2');  // → false
const visibilityMap = nrrdTools.getLayerVisibility();
// → { layer1: true, layer2: false, layer3: true, layer4: true }
```

**Eye-button toggle pattern:**

```typescript
function onToggleLayerEye(layerId: string) {
  const current = nrrdTools.isLayerVisible(layerId);
  nrrdTools.setLayerVisible(layerId, !current);
}
```

### 6.3 Channel Visibility

```typescript
nrrdTools.setChannelVisible('layer1', 2, false);
nrrdTools.setChannelVisible('layer1', 2, true);

const ch2Visible    = nrrdTools.isChannelVisible('layer1', 2);
const allChannelVis = nrrdTools.getChannelVisibility();
// → { layer1: { 1: true, 2: false, 3: true, ... }, layer2: { ... }, ... }
```

**Isolate a single channel:**

```typescript
function isolateChannel(layerId: string, targetChannel: number, totalChannels = 8) {
  for (let ch = 1; ch <= totalChannels; ch++) {
    nrrdTools.setChannelVisible(layerId, ch, ch === targetChannel);
  }
}
```

### 6.4 Checking if a layer has annotations

```typescript
if (nrrdTools.hasLayerData('layer2')) {
  await saveLayer('layer2');
} else {
  await initBlankLayerOnBackend('layer2');
}
```

---

## 7. Channel Color Customization

Each layer has its own independent color map.

### Default Channel Colors

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

### Set colors

```typescript
// Single channel (RGBAColor: { r, g, b, a } — all values 0-255)
nrrdTools.setChannelColor('layer1', 3, { r: 255, g: 128, b: 0, a: 255 });

// Batch-set (one reloadMasksFromVolume call — better performance)
nrrdTools.setChannelColors('layer1', {
  1: { r: 255, g: 80,  b: 80,  a: 255 },
  2: { r: 80,  g: 180, b: 255, a: 255 },
  3: { r: 255, g: 230, b: 50,  a: 255 },
});

// Apply same color across all layers
nrrdTools.setAllLayersChannelColor(1, { r: 0, g: 220, b: 100, a: 255 });
```

### Read colors

```typescript
const rgba = nrrdTools.getChannelColor('layer2', 3);
// → { r: 255, g: 128, b: 0, a: 255 }

const hex = nrrdTools.getChannelHexColor('layer2', 3);
// → "#ff8000"  — suitable for canvas fillStyle

const css = nrrdTools.getChannelCssColor('layer2', 3);
// → "rgba(255,128,0,1.00)"  — suitable for Vue :style binding
```

### Reset colors

```typescript
nrrdTools.resetChannelColors('layer1', 3); // one channel
nrrdTools.resetChannelColors('layer1');    // all channels in layer
nrrdTools.resetChannelColors();            // everything
```

**Color picker integration:**

```typescript
function onColorPicked(hexColor: string) {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);

  const activeLayer   = nrrdTools.getActiveLayer();
  const activeChannel = nrrdTools.getActiveChannel();
  nrrdTools.setChannelColor(activeLayer, activeChannel, { r, g, b, a: 255 });
}
```

**Vue reactivity after color change:**

After calling `setChannelColor()`, the canvas re-renders automatically. Vue computed properties need a manual nudge:

```typescript
const colorVersion = ref(0);

const channelCssColor = computed(() => {
  colorVersion.value; // subscribe to version
  return nrrdTools.value?.getChannelCssColor(activeLayer.value, activeChannel.value) ?? '#00ff00';
});

// After setting color:
nrrdTools.value.setChannelColor('layer1', 2, { r: 255, g: 0, b: 0, a: 255 });
colorVersion.value++; // forces recompute
```

---

## 8. Undo / Redo

Per-layer undo stack (max 50 entries). Every completed brush stroke pushes a delta snapshot.

```typescript
nrrdTools.undo();
nrrdTools.redo();
```

**Keyboard shortcut binding:**

```typescript
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'z') nrrdTools.undo();
  if (e.ctrlKey && e.key === 'y') nrrdTools.redo();
});
```

::: tip
The built-in keyboard system also handles undo/redo (default: `z` and `y` without Ctrl). See [Keyboard Shortcuts](#_9-keyboard-shortcuts).
:::

---

## 9. Keyboard Shortcuts

### Default bindings

| Action | Default Key |
|--------|-------------|
| Draw mode | `Shift` (hold) |
| Undo | `z` |
| Redo | `y` |
| Contrast adjust | `Ctrl` / `Meta` (hold) |
| Crosshair | `s` |
| Sphere mode | `q` |
| Mouse wheel | Zoom |

### Customizing

```typescript
nrrdTools.setKeyboardSettings({
  undo: 'u',
  mouseWheel: 'Scroll:Slice', // wheel scrolls slices instead of zooming
});

const settings = nrrdTools.getKeyboardSettings();
```

### Suppressing shortcuts during form input

```typescript
inputElement.addEventListener('focus', () => nrrdTools.enterKeyboardConfig());
inputElement.addEventListener('blur',  () => nrrdTools.exitKeyboardConfig());
```

### Contrast shortcut

```typescript
nrrdTools.setContrastShortcutEnabled(false);
nrrdTools.isContrastShortcutEnabled(); // → false
```

---

## 10. Display & Canvas Control

```typescript
// Canvas resolution multiplier (1–8)
nrrdTools.setBaseDrawDisplayCanvasesSize(2);

// Voxel dimensions [width, height, depth]
const dims = nrrdTools.getCurrentImageDimension(); // → [512, 512, 256]

// Physical spacing (mm per voxel, from NRRD header)
const spacing = nrrdTools.getVoxelSpacing(); // → [0.488, 0.488, 1.0]

// World-space origin
const origin = nrrdTools.getSpaceOrigin(); // → [-125.0, -125.0, -127.5]

// Max slice count per axis
const maxSlices = nrrdTools.getMaxSliceNum(); // → [512, 512, 256]

// Current viewing state
const { currentSliceIndex, contrastIndex } = nrrdTools.getCurrentSlicesNumAndContrastNum();

// Canvas references
const drawingCanvas = nrrdTools.getDrawingCanvas();
const container     = nrrdTools.getContainer();
```

### Clearing annotations

```typescript
nrrdTools.reset();           // ALL layers — volumes, undo histories, canvases, sphere data (use when switching cases)
nrrdTools.clearActiveLayer(); // Active layer entire 3D volume + undo history → fires onClearLayerVolume
nrrdTools.clearActiveSlice(); // Currently viewed 2D slice only (undoable)
```

---

## 11. Advanced Scenarios

### A: Complete multi-layer initialization from scratch

```typescript
async function initAnnotationTool(container: HTMLDivElement, allSlices: any[]) {
  const nrrdTools = new Copper.NrrdTools(container, {
    layers: ['layer1', 'layer2', 'layer3', 'layer4']
  });

  nrrdTools.setupGUI(gui as any);
  nrrdTools.enableContrastDragEvents((step, towards) => console.log('Windowing:', towards, step));

  nrrdTools.reset();
  nrrdTools.setAllSlices(allSlices);

  nrrdTools.drag({ getSliceNum: (idx) => updateSliceUI(idx) });

  nrrdTools.draw({
    getMaskData: (sliceData, layerId, channelId, sliceIndex, axis, w, h, clearFlag) => {
      syncSliceToBackend({ sliceData, layerId, channelId, sliceIndex, axis, clearFlag });
    },
    onClearLayerVolume: (layerId) => notifyBackendCleared(layerId),
  });

  scene.addPreRenderCallbackFunction(nrrdTools.start);
  return nrrdTools;
}
```

### B: Load existing annotations and apply custom color scheme

```typescript
async function loadAndColorCase(nrrdTools: Copper.NrrdTools, caseId: string) {
  const masks = await fetchCaseMasks(caseId);
  const layerVoxels = new Map<string, Uint8Array>(Object.entries(masks));
  nrrdTools.setMasksFromNIfTI(layerVoxels);

  nrrdTools.setChannelColors('layer1', {
    1: { r: 0,   g: 200, b:  80, a: 255 },  // Tumour core — green
    2: { r: 255, g: 200, b:   0, a: 255 },  // Tumour ring — yellow
  });
  nrrdTools.setChannelColors('layer2', {
    1: { r: 255, g: 60,  b:  60, a: 200 },  // Edema — semi-transparent red
  });

  nrrdTools.setActiveLayer('layer1');
  nrrdTools.setActiveChannel(1);
}
```

### C: Switching cases — full reset

```typescript
async function switchCase(nrrdTools: Copper.NrrdTools, newCaseData: ICaseData) {
  nrrdTools.reset();
  nrrdTools.setAllSlices(newCaseData.slices);
  nrrdTools.resetChannelColors();

  for (const layerId of ['layer1', 'layer2', 'layer3', 'layer4']) {
    nrrdTools.setLayerVisible(layerId, true);
    for (let ch = 1; ch <= 8; ch++) {
      nrrdTools.setChannelVisible(layerId, ch, true);
    }
  }

  nrrdTools.setActiveLayer('layer1');
  nrrdTools.setActiveChannel(1);

  if (newCaseData.hasExistingMasks) {
    nrrdTools.setMasksFromNIfTI(newCaseData.layerVoxels);
  }
}
```

### D: Save workflow with dirty-layer detection

```typescript
async function onSave(nrrdTools: Copper.NrrdTools, caseId: string) {
  const layers = ['layer1', 'layer2', 'layer3', 'layer4'];
  for (const layerId of layers) {
    if (!nrrdTools.hasLayerData(layerId)) {
      await initBlankLayerOnBackend(caseId, layerId);
    } else {
      await saveLayerToBackend(caseId, layerId);
    }
  }
}
```

### E: AI segmentation result — write back to volume

```typescript
async function applyAIResult(nrrdTools: Copper.NrrdTools, layerId: string) {
  const response = await fetch(`/api/ai-result/${layerId}`);
  const voxels = new Uint8Array(await response.arrayBuffer());
  nrrdTools.setMasksFromNIfTI(new Map([[layerId, voxels]]));
  nrrdTools.setActiveLayer(layerId);
}
```

### F: Sphere mode with AI backend (distance calculation)

```typescript
nrrdTools.draw({
  getCalculateSpherePositionsData: (tumour, skin, rib, nipple, axis) => {
    if (tumour && skin && rib && nipple) {
      aiBackend.runSegmentation({ tumour, skin, rib, nipple, axis });
    }
  },
  getSphereData: (origin, radius) => console.log('Sphere placed at', origin, 'radius', radius),
});
```

---

## 12. Vue 3 Integration Pattern

The recommended pattern distributes the `NrrdTools` instance via a Vue event emitter after NRRD loading completes.

### Creator component (LeftPanel)

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

function onAllImagesLoaded(allSlices: any[]) {
  nrrdTools!.reset();
  nrrdTools!.setAllSlices(allSlices);

  nrrdTools!.drag({ getSliceNum: (idx) => emit('sliceChanged', idx) });
  nrrdTools!.draw({
    getMaskData: (sliceData, layerId, channelId, sliceIndex, axis, w, h, clearFlag) => {
      emit('maskDataUpdated', { sliceData, layerId, channelId, sliceIndex, axis, w, h, clearFlag });
    },
    onClearLayerVolume: (layerId) => emit('layerCleared', layerId),
  });

  scene!.addPreRenderCallbackFunction(nrrdTools!.start);

  emitter.emit('Core:NrrdTools', nrrdTools!);
  emitter.emit('Segmentation:FinishLoadAllCaseImages');
}
</script>
```

### Consumer component (Annotation Panel)

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
  activeLayer.value       = nrrdTools.value.getActiveLayer();
  activeChannel.value     = nrrdTools.value.getActiveChannel();
  layerVisibility.value   = nrrdTools.value.getLayerVisibility();
  channelVisibility.value = nrrdTools.value.getChannelVisibility();
}

function onChannelColorPicked(hex: string) {
  if (!nrrdTools.value) return;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  nrrdTools.value.setChannelColor(activeLayer.value, activeChannel.value, { r, g, b, a: 255 });
  colorVersion.value++;
}
</script>
```

---

## 13. API Summary

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
| | `setAllSlices(slices)` | Load NRRD slices, init MaskVolumes |
| | `setMasksFromNIfTI(map, bar?)` | Load saved NIfTI voxel data |
| **Render** | `start` | Frame callback — pass to render loop |
| **Layer** | `setActiveLayer(id)` | Switch drawing target layer |
| | `getActiveLayer()` | Read current layer |
| | `setLayerVisible(id, bool)` | Toggle layer in composite view |
| | `isLayerVisible(id)` | Query layer visibility |
| | `getLayerVisibility()` | All layer visibility map |
| | `hasLayerData(id)` | Check if layer has non-zero voxels |
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
| **Tool Mode** | `setMode(mode)` | Switch tool: `"pencil"` / `"brush"` / `"eraser"` / `"sphere"` / `"calculator"` |
| | `getMode()` | Read current tool mode |
| | `isCalculatorActive()` | Check if calculator mode is active |
| **Drawing** | `setOpacity(value)` | Set mask overlay opacity [0.1, 1] |
| | `getOpacity()` | Read current opacity |
| | `setBrushSize(size)` | Set brush/eraser size [5, 50] |
| | `getBrushSize()` | Read current brush size |
| | `setPencilColor(hex)` | Set pencil stroke color |
| | `getPencilColor()` | Read current pencil color |
| **Contrast** | `setWindowHigh(value)` | Set window high |
| | `setWindowLow(value)` | Set window low |
| | `finishWindowAdjustment()` | Repaint all contrast slices after drag ends |
| | `getSliderMeta(key)` | Get slider min/max/step/value for UI config |
| **Actions** | `executeAction(action)` | Run: `"undo"` / `"redo"` / `"clearActiveSliceMask"` / `"clearActiveLayerMask"` / `"resetZoom"` / `"downloadCurrentMask"` |
| **Navigation** | `setSliceOrientation(axis)` | Switch viewing axis `"x"` / `"y"` / `"z"` |
| **History** | `undo()` / `redo()` | Undo / redo last stroke |
| **Keyboard** | `setKeyboardSettings(partial)` | Remap shortcuts |
| | `getKeyboardSettings()` | Read current bindings |
| | `enterKeyboardConfig()` / `exitKeyboardConfig()` | Suppress / restore shortcuts |
| | `setContrastShortcutEnabled(bool)` | Enable/disable contrast key |
| | `isContrastShortcutEnabled()` | Query contrast key state |
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

## 14. Type Reference

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
  contrast: string[];           // e.g. ["Control", "Meta"]
  crosshair: string;
  sphere: string;
  mouseWheel: 'Scroll:Zoom' | 'Scroll:Slice';
}

// 3D coordinate (used in sphere position callbacks)
interface ICommXYZ {
  x: number;
  y: number;
  z: number;
}

type LayerId      = 'layer1' | 'layer2' | 'layer3' | 'layer4'; // or any string
type ChannelValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
```
