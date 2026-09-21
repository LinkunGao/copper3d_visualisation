# Segmentation Module Documentation

> Source: `src/Utils/segmentation/`

> ⚠️ **Note**: All line number references in this document are from historical versions. After multiple rounds of refactoring (State Management Refactor, NrrdTools God Class Split, inheritance → composition refactor), these references are outdated and provided for structural reference only. Always refer to the actual source code.

## 1. Architecture Overview

### 1.1 Class Composition

```
NrrdTools (Facade)
  ├── CanvasState              ← Pure state container (nrrd_states, gui_states, protectedData, etc.)
  ├── DrawToolCore             ← Event orchestration, Undo/Redo, Tool initialization and delegation
  │     ├── CanvasState (shared)  ← References the same CanvasState instance
  │     └── RenderingUtils     ← Rendering / slice-buffer helpers
  ├── LayerChannelManager      ← Layer/Channel/SphereType management (211 lines)
  ├── SliceRenderPipeline      ← Slice rendering pipeline (453 lines)
  └── DataLoader               ← Data loading (222 lines)
```

> **Inheritance → Composition Refactor (complete)**: The original three-level inheritance chain `NrrdTools → DrawToolCore → CommToolsData` has been fully replaced by composition. `CommToolsData` has been deleted. State is extracted into `CanvasState`, rendering methods into `RenderingUtils`.
>
> **DrawToolCore** is now a pure orchestration layer — all tool logic has been extracted into individual Tool classes.
> DrawToolCore permanently routes all pointer/wheel events via EventRouter, and dispatches each Tool's render methods in the `start()` render loop.
> There are no more manual `addEventListener`/`removeEventListener` calls (wheel behavior is dispatched via `activeWheelMode` state).
>
> **NrrdTools God Class Split (complete)**: NrrdTools was refactored across 4 phases from a 2007-line God Class into a Facade + 3 functional modules. The public API is unchanged; internals are decoupled via `ToolContext` + `ToolHost` `Pick<>` types.
>
> **Callback interface unification (complete)**: The original 10 separate `*Callbacks` interfaces have been unified into a single `ToolHost` interface (`tools/ToolHost.ts`). Each Tool selects its required host method subset via `Pick<ToolHost, ...>`.

- [CanvasState.ts](https://github.com/LinkunGao/copper3d_visualisation/blob/main/src/Utils/segmentation/CanvasState.ts) — Pure state container
- [RenderingUtils.ts](https://github.com/LinkunGao/copper3d_visualisation/blob/main/src/Utils/segmentation/RenderingUtils.ts) — Rendering utilities
- [DrawToolCore.ts](https://github.com/LinkunGao/copper3d_visualisation/blob/main/src/Utils/segmentation/DrawToolCore.ts) — Drawing core (composes CanvasState + RenderingUtils)
- [NrrdTools.ts](https://github.com/LinkunGao/copper3d_visualisation/blob/main/src/Utils/segmentation/NrrdTools.ts) — Public API Facade (composes CanvasState + DrawToolCore)
- [tools/LayerChannelManager.ts](https://github.com/LinkunGao/copper3d_visualisation/blob/main/src/Utils/segmentation/tools/LayerChannelManager.ts) — Layer/Channel management
- [tools/SliceRenderPipeline.ts](https://github.com/LinkunGao/copper3d_visualisation/blob/main/src/Utils/segmentation/tools/SliceRenderPipeline.ts) — Slice rendering pipeline
- [tools/DataLoader.ts](https://github.com/LinkunGao/copper3d_visualisation/blob/main/src/Utils/segmentation/tools/DataLoader.ts) — Data loading

### 1.2 Canvas Layer Structure

There are **5 system canvases** + **N layer canvases** (3 layers by default).

```
┌──────────────────────────────────┐
│ drawingCanvas (top interaction)   │  ← Captures mouse/pen events, real-time stroke rendering
├──────────────────────────────────┤
│ drawingSphereCanvas              │  ← Overlay for the 3D Sphere tool
├──────────────────────────────────┤
│ drawingCanvasLayerMaster (composite) │  ← Result of compositing all visible layers
│   ├─ layerTargets[layer1].canvas │  ← Hidden per-layer canvas
│   ├─ layerTargets[layer2].canvas │
│   └─ layerTargets[layer3].canvas │
├──────────────────────────────────┤
│ displayCanvas (background image)  │  ← CT/MRI slice image
├──────────────────────────────────┤
│ originCanvas (from Three.js)      │  ← Cached original slice rendered by Three.js
├──────────────────────────────────┤
│ emptyCanvas (temporary)           │  ← Off-screen canvas for image processing and format conversion
└──────────────────────────────────┘
```

**Canvas creation locations:**
- System canvases: `CanvasState.ts` → `generateSystemCanvases()`
- Layer canvases: `CanvasState.ts` → `generateLayerTargets(layerIds)`
- Canvas annotations: `CanvasState.ts` constructor

### 1.3 NrrdTools Facade Internal Modules

NrrdTools passes shared state to each module via `ToolContext`, and declares host method dependencies via `Pick<ToolHost, ...>` type aliases:

```
ToolContext = {
  nrrd_states: NrrdState,
  gui_states: GuiState,
  protectedData: IProtected,
  cursorPage: ICursorPage,
  callbacks: IAnnotationCallbacks,
}
```

| Module | File | Responsibility | HostDeps Type |
|--------|------|----------------|---------------|
| **LayerChannelManager** | `tools/LayerChannelManager.ts` | setActiveLayer/Channel/SphereType, visibility control, custom channel colors | `LayerChannelHostDeps` (3 methods) |
| **SliceRenderPipeline** | `tools/SliceRenderPipeline.ts` | Slice axis config, canvas rendering, mask reload, canvas flip, view/canvas helpers | `SliceRenderHostDeps` (10 methods) |
| **DataLoader** | `tools/DataLoader.ts` | NRRD slice loading, legacy mask loading, NIfTI voxel loading | `DataLoaderHostDeps` (7 methods) |

Delegation methods in NrrdTools are single-line calls (`this.layerChannelManager.xxx()`), containing no business logic.

### 1.4 Layer and MaskVolume Correspondence

Each Layer maps to an independent `MaskVolume` instance:

```
protectedData.maskData.volumes = {
  "layer1": MaskVolume(width, height, depth, 1),
  "layer2": MaskVolume(width, height, depth, 1),
  "layer3": MaskVolume(width, height, depth, 1),
}
```

- Initialized (1×1×1 placeholder): `CanvasState.ts` constructor
- Re-initialized with actual NRRD dimensions: `DataLoader.setAllSlices()` → `tools/DataLoader.ts`

---

## 2. NrrdTools Public API

> ⚠️ **Line numbers are outdated**. After the God Class Split refactor (1300 lines, 13 sections), method implementations have been migrated to the extracted modules (LayerChannelManager, SliceRenderPipeline, DataLoader). NrrdTools retains only single-line delegations. Line numbers are for historical reference only — always refer to the actual source code.
>
> Implementation locations: Layer/Channel methods → `tools/LayerChannelManager.ts`, rendering methods → `tools/SliceRenderPipeline.ts`, data loading → `tools/DataLoader.ts`.

### 2.1 Layer & Channel Management

> **Implementation**: `tools/LayerChannelManager.ts`, single-line delegation in NrrdTools.

| Method | Signature | Description |
|--------|-----------|-------------|
| `setActiveLayer` | `(layerId: string): void` | Set the active Layer; also updates fillColor/brushColor |
| `setActiveChannel` | `(channel: ChannelValue): void` | Set the active Channel (1–`MAX_ENGINE_CHANNEL`); updates brush color |
| `clearChannel` | `(layerId: string, channel: number): void` | Erase one label across a whole layer, undoably. Throws on an unknown layer (deliberately not via `getVolumeForLayer`, whose fallback would erase a different layer) or a channel outside [1, 255] |
| `getLayerVolume` | `(layerId: string): Uint8Array \| null` | A **copy** of the layer's voxel buffer — not the live array, which a caller could mutate with nothing invalidating the slice cache. Delegates to `DrawToolCore.getLayerVolume` |
| `replaceLayerVolume` | `(layerId, data, opts?): void` | Replace the whole buffer. `{ undoable: true }` pushes one `VolumeSnapshot`. Does **not** fire `onLayerVolumeReplaced` itself — that fires only on a later undo/redo, when the backend holds the newer volume and must be told to fall back |
| `copyLayerData` | `(sourceLayerId, targetLayerId): void` | Direct buffer copy between layers, **not** undoable. Warns and returns if either volume is unresolvable or the lengths differ; preserves the target's colour map |
| `getActiveLayer` | `(): string` | Get the current Layer ID |
| `getActiveChannel` | `(): number` | Get the current Channel value |
| `setLayerVisible` | `(layerId, visible): void` | Set Layer visibility, triggers `reloadMasksFromVolume()` |
| `isLayerVisible` | `(layerId): boolean` | Check if a Layer is visible |
| `setChannelVisible` | `(layerId, channel, visible): void` | Set Channel visibility within a Layer, triggers re-render |
| `isChannelVisible` | `(layerId, channel): boolean` | Check if a Channel is visible |
| `getLayerVisibility` | `(): Record<string, boolean>` | Get a copy of all Layer visibility states |
| `getChannelVisibility` | `(): Record<string, Record<number, boolean>>` | Get a copy of all Channel visibility states |
| `hasLayerData` | `(layerId): boolean` | Check if a Layer has any non-zero data |
| `setLayerOpacity` | `(layerId: string, opacity: number): void` | Set per-layer opacity (0.1–1.0), triggers `reloadMasksFromVolume()` |
| `getLayerOpacity` | `(layerId: string): number` | Get opacity for a specific layer (defaults to 1.0) |
| `getLayerOpacityMap` | `(): Record<string, number>` | Get all per-layer opacity values |

### 2.2 Custom Channel Color API

Per-layer custom channel colors. Each layer's MaskVolume has an independent `colorMap` — changes do not affect other layers.

| Method | Signature | Description |
|--------|-----------|-------------|
| `setChannelColor` | `(layerId: string, channel: number, color: RGBAColor): void` | Set color for a specific channel in a layer; triggers re-render and `onChannelColorChanged` callback |
| `getChannelColor` | `(layerId: string, channel: number): RGBAColor` | Get the RGBA color object |
| `getChannelHexColor` | `(layerId: string, channel: number): string` | Get Hex string (e.g. `#ff8000`) |
| `getChannelCssColor` | `(layerId: string, channel: number): string` | Get CSS rgba() string (e.g. `rgba(255,128,0,1.00)`) |
| `setChannelColors` | `(layerId: string, colorMap: Partial<ChannelColorMap>): void` | Batch-set multiple channel colors for one layer (single reload) |
| `setAllLayersChannelColor` | `(channel: number, color: RGBAColor): void` | Set the same channel color across all layers |
| `resetChannelColors` | `(layerId?: string, channel?: number): void` | Reset to `MASK_CHANNEL_COLORS` defaults |

**Internal mechanism:**
- `syncBrushColor()` — private method that dynamically reads the current layer's volume color to update `fillColor`/`brushColor`
- Called automatically in `setActiveLayer()`, `setActiveChannel()`, `setChannelColor()`, etc.

#### External Usage

**Prerequisite**: The `nrrdTools` instance must be created and `setAllSlices()` must have been called (i.e., image is loaded and MaskVolume is initialized).

::: warning
Colors must be set **after** image loading is complete (`setAllSlices()` called). If `protectedData.maskData.volumes[layerId]` does not yet exist, the method silently fails — it hits the internal guard, emits `console.warn`, and returns immediately with no visual effect and no thrown exception.

**Common mistake**: calling `setChannelColor` inside `onFinishedCopperInit`. That callback fires when the Copper3D renderer is ready, but no NRRD images have been loaded yet — `volumes["layer1"]` is `undefined` at that point.

```typescript
// ❌ WRONG — too early, MaskVolume does not exist yet
const onFinishedCopperInit = (data) => {
  nrrdTools.value = data.nrrdTools;
  nrrdTools.value.setChannelColor('layer1', 1, { r: 25, g: 0, b: 0, a: 255 }); // silent no-op
};

// ✅ CORRECT — call after images are loaded (setAllSlices() has already run)
const handleAllImagesLoaded = (res) => {
  nrrdTools.value.setChannelColor('layer1', 1, { r: 25, g: 0, b: 0, a: 255 }); // works
};
```
:::

---

**Scenario 1: Set a custom color for a specific channel in a layer**

```typescript
// Set layer2's channel 3 to orange
nrrdTools.setChannelColor('layer2', 3, { r: 255, g: 128, b: 0, a: 255 });
// Effect: all masks drawn with channel 3 on layer2 become orange
// layer1 and layer3's channel 3 colors are unaffected
```

---

**Scenario 2: Batch-set multiple channel colors in one layer (recommended — triggers a single re-render)**

```typescript
nrrdTools.setChannelColors('layer1', {
  1: { r: 255, g: 0,   b: 0,   a: 255 },   // channel 1 → red
  2: { r: 0,   g: 0,   b: 255, a: 255 },   // channel 2 → blue
  3: { r: 255, g: 255, b: 0,   a: 255 },   // channel 3 → yellow
});
// Triggers only one reloadMasksFromVolume() — more efficient than multiple setChannelColor() calls
```

---

**Scenario 3: Apply the same channel color across all layers**

```typescript
// Set channel 1 to red across all layers
nrrdTools.setAllLayersChannelColor(1, { r: 255, g: 0, b: 0, a: 255 });
```

---

**Scenario 4: Read the current color**

```typescript
const rgba = nrrdTools.getChannelColor('layer2', 3);
// → { r: 255, g: 128, b: 0, a: 255 }

const hex = nrrdTools.getChannelHexColor('layer2', 3);
// → "#ff8000"  (suitable for canvas fillStyle or CSS color)

const css = nrrdTools.getChannelCssColor('layer2', 3);
// → "rgba(255,128,0,1.00)"  (suitable for Vue style binding)
```

---

**Scenario 5: Reset colors**

```typescript
// Reset channel 3 of layer2 to default
nrrdTools.resetChannelColors('layer2', 3);

// Reset all channels of layer2 to default
nrrdTools.resetChannelColors('layer2');

// Reset all channels of all layers to default
nrrdTools.resetChannelColors();
```

---

**Scenario 6: Notify Vue UI to refresh after setting colors**

After a color change, the canvas re-renders automatically (`reloadMasksFromVolume()` is called automatically). However, Vue UI components showing channel color swatches need a manual nudge:

```typescript
// In a Vue component, get the refreshChannelColors function from the composable
const { refreshChannelColors } = useLayerChannel({ nrrdTools });

// After setting a color, call refresh to sync the Vue UI
nrrdTools.setChannelColor('layer2', 3, { r: 255, g: 128, b: 0, a: 255 });
refreshChannelColors(); // Increments colorVersion → triggers recomputation of dynamicChannelConfigs
```

Or listen to the `onChannelColorChanged` callback for automatic refresh:

```typescript
// ⚠️ onChannelColorChanged is currently attached to nrrd_states and cannot be set directly from outside
// Recommended: manually call refreshChannelColors() after setChannelColor()
```

---

**Scenario 7: Complete initialization + color setup example (in a Vue component)**

```typescript
import emitter from '@/plugins/custom-emitter';

const nrrdTools = ref<Copper.NrrdTools>();

emitter.on('Core:NrrdTools', (tools) => {
  nrrdTools.value = tools;
});

emitter.on('Segmentation:FinishLoadAllCaseImages', () => {
  // At this point setAllSlices() is complete, MaskVolume is initialized
  if (!nrrdTools.value) return;

  nrrdTools.value.setChannelColors('layer1', {
    1: { r: 255, g: 80,  b: 80,  a: 255 },   // light red
    2: { r: 80,  g: 180, b: 255, a: 255 },   // light blue
  });
  // layer2 keeps default colors — no action needed
});
```

---

**Color value range**

```typescript
interface RGBAColor {
  r: number;  // 0-255
  g: number;  // 0-255
  b: number;  // 0-255
  a: number;  // 0-255 (255 = fully opaque, 0 = fully transparent)
}
```

The `a` (alpha) field determines the base mask opacity. Usually set to `255`; actual rendering multiplies by `gui_states.drawing.globalAlpha` (default 0.6) and `gui_states.layerChannel.layerOpacity[layerId]` (default 1.0).

> **Per-Layer Alpha**: Final rendering opacity = `globalAlpha × layerOpacity[layerId]`. The global alpha controls all layers uniformly, while per-layer opacity allows independent control per layer.

### 2.3 Keyboard & History

> **Implementation**: Directly in the NrrdTools Facade (section 4).

| Method | Signature | Description |
|--------|-----------|-------------|
| `undo` | `(): void` | Undo the last drawing operation |
| `redo` | `(): void` | Redo the last undone operation |
| `enterKeyboardConfig` | `(): void` | Suppress all shortcuts |
| `exitKeyboardConfig` | `(): void` | Restore shortcuts |
| `setContrastShortcutEnabled` | `(enabled: boolean): void` | Enable/disable the Contrast shortcut key |
| `isContrastShortcutEnabled` | `(): boolean` | Check if the Contrast shortcut is enabled |
| `setKeyboardSettings` | `(settings: Partial<IKeyBoardSettings>): void` | Update keyboard shortcut bindings |
| `getKeyboardSettings` | `(): IKeyBoardSettings` | Get a snapshot of current keyboard settings |

### 2.4 Data Loading

> **Implementation**: `tools/DataLoader.ts`, single-line delegation in NrrdTools.

| Method | Signature | Description |
|--------|-----------|-------------|
| `setAllSlices` | `(allSlices: Array<nrrdSliceType>): void` | **Entry point**: Load NRRD slices and initialize all MaskVolumes to the correct dimensions |
| `initFromHeader` | `(header: NrrdHeaderLike): void` | Size image metadata and MaskVolumes from volume geometry alone, before any pixel data exists. `allSlicesArray` is untouched |
| `appendSlice` | `(slice: nrrdSliceType, order: number): void` | Append one already-loaded slice to the contrast series and refresh display slices / undo state |
| `setMasksData` | `(masksData, loadingBar?): void` | Legacy loading method (deprecated, pending removal) |
| `setMasksFromNIfTI` | `(layerVoxels: Map<string, Uint8Array>, loadingBar?): void` | Load mask data from NIfTI files into MaskVolume, validating each buffer's grid |
| `registerNiftiMaskGrid` | `(data: Uint8Array, dims: number[]): void` *(module export)* | Record a mask buffer's NIfTI voxel grid, keyed by buffer identity, for `setMasksFromNIfTI` to check |

#### Bulk vs. progressive loading

`setAllSlices` is the bulk path and is still what almost every caller wants. Internally it is
now a composition of two smaller pieces, which are also usable on their own:

```
setAllSlices(allSlices)
  │
  ├─ initFromHeader(headerFromSlice(allSlices[0]))   → image metadata + MaskVolume sizing
  │    └─ headerFromSlice reads dimensions/spacing/space_origin off the shared Volume
  │
  ├─ allSlicesArray.length = 0                       → replace, not append
  └─ setContrastOrder(slice, i) for each slice       → stamp contrastOrder on x/y/z
```

The split exists so a progressive loader can size everything from a backend headers response
(`{ dimensions, spacing, space_origin }` as JSON — the same `NrrdHeaderLike` shape) and then
feed slices in one at a time with `appendSlice` as they arrive.

::: warning `appendSlice` is not a loop-friendly substitute for `setAllSlices`
It calls `setDisplaySlicesBaseOnAxis()` per slice, which rebuilds the display-slice list from
a still-growing `allSlicesArray`, and whose `skipSlicesDic` bookkeeping assumes it is seeing
the final array. For N slices already in hand, use `setAllSlices`.
:::

**Why `nrrd_x_mm` is derivable without a canvas.** The mm extents used to be read off
`slice.z.canvas.width/height` and `slice.x.canvas.width` — the physical size of the plane
`VolumeSlice` extracted. Those canvases are always sized to `dimensions[axis] * spacing[axis]`
(`Volume.extractPerpendicularPlane` sets `planeWidth`/`planeHeight` to the voxel counts times
spacing), so the same values follow from dimensions and spacing alone. `canvas.width` is an
HTML `unsigned long`, so a non-integer product truncates (44.8 → 44); `initFromHeader`
reproduces that with `Math.floor`, which agrees with the DOM because spacing is a magnitude
and never negative.

**Narrowed-axes tolerance.** `headerFromSlice` and `setContrastOrder` read and stamp
`slice.x ?? slice.y ?? slice.z` rather than assuming `.x`, because a
[narrowed-axes load](./load-callbacks) may only have `z` extracted at this point. A plane
extracted later by `ensureAxisExtracted` inherits `contrastOrder` from its siblings, so it
ends up indistinguishable from one extracted at load time.

#### Mask grid validation

`setMasksFromNIfTI` used to truncate a longer buffer and zero-pad a shorter one, which
rendered a wrong-grid mask silently offset onto the wrong voxels. It now compares the
buffer's registered grid against `nrrd_states.image.dimensions` and refuses on mismatch:

```
for each [layerId, rawData] of layerVoxels
  ├─ volume missing?              → console.warn, skip layer
  ├─ maskGridByBuffer.get(rawData) → undefined, or dims !== image dims?
  │     → console.error + notifyUser, skip layer   (never truncate, never pad)
  └─ volume.setRawData(rawData)
```

`notifyUser(message, level)` is a `ToolHost` dependency backed by the public
`NrrdTools.notifyUser` property. It defaults to a console write: this engine has no UI of its
own, and importing the host application's is exactly what made the package unbuildable on its
own. A host with a toast or a banner assigns its own implementation after construction.

A buffer with **no** registered grid is refused rather than assumed to match. The registry is
a `WeakMap` keyed by buffer identity — not by layer id — so a caller may decode several layers
before `setMasksFromNIfTI` is consulted, and entries are collected with the buffers.

### 2.5 Display & Rendering

> **Implementation**: `tools/SliceRenderPipeline.ts`, single-line delegation in NrrdTools.

| Method | Signature | Description |
|--------|-----------|-------------|
| `resizePaintArea` | `(factor: number): void` | Resize the canvas scale factor |
| `reloadMasksFromVolume` | `(): void` (private) | **Core re-render**: Re-renders all Layers from MaskVolume to Canvas |
| `flipDisplayImageByAxis` | `(): void` | Flip the CT image for correct display orientation |
| `redrawDisplayCanvas` | `(): void` | Redraw the contrast image onto the displayCanvas |
| `setEmptyCanvasSize` | `(axis?): void` | Set emptyCanvas dimensions based on the current axis |
| `setMaskRenderMode` | `(mode: MaskRenderMode): void` | Set `"fill"` / `"outline"` globally, then `reloadMasksFromVolume()`. Repaints immediately because nothing else would bring the change to screen |
| `getMaskRenderMode` | `(): MaskRenderMode` | Read the current mode |

#### Fill vs. outline rendering

Two render paths, one silhouette. `extractLabelPolygons` / `extractLabelContours` cover the
region; `extractLabelBoundarySegments` / `extractLabelOutline` trace its edge. Both walk the
same cells with the same sampling, the same out-of-bounds rule and the same `+0.5` shift, so
the mask ends in exactly the same place whichever you draw — the edge does not appear to move
when the mode is toggled.

```
RenderingUtils
  │
  ├─ renderSliceToCanvas(...)   → drawSlice(..., outline = maskRenderMode === "outline")
  └─ renderSliceForBake(...)    → drawSlice(..., outline = false)      ◀ always filled
```

**`renderSliceForBake` is not an optimisation, it is a correctness requirement.** For the
tools that bake (`syncLayerSliceData` — pencil and eraser) the layer canvas is not a picture
of the mask, it is the input the mask is rebuilt from: the bake replaces the whole slice in
`MaskVolume` with whatever pixels it finds. An outline is a *lossy* picture — it says where a
mask ends, not what it contains — so baking one back writes rings and erases every interior on
that slice, taking every other finding on the layer with it. One pencil stroke was enough.

It is a separate entry point rather than a flag threaded through the display path because a
render that is about to be read back has a different requirement from one that is about to be
looked at; the two only coincided while there was one way to draw a mask.

`DrawingTool` uses it in two places:

| Method | When | Why |
|--------|------|-----|
| `redrawPreviousImageToLayerCtx` | before a pencil fill | what lands here is about to be read straight back by `syncLayerSliceData` |
| `solidifyLayerForErase` | at pointer-down, if the eraser is active | the eraser removes pixels matching the active channel's colour; against an outline there is nothing to match *inside* a mask, so a drag over a lesion would erase nothing — and the bake that follows would write the ring back |

`solidifyLayerForErase` runs unconditionally rather than checking the display mode: in fill
mode it redraws what is already on screen, and a mode-dependent branch there is one more thing
that can fall out of step with the renderer. The display mode returns at pointer-up, via
`refreshLayerFromVolume`.

##### Path cache

The render mode is **not** part of the cache key. Each entry holds two lazily-built maps:

```ts
{
  key: `${axis}:${sliceIndex}:${volume.getVersion()}`,
  W, H,
  labels:   number[],
  fills:    Map<number, Path2D>,   // built on first use of fill mode for this slice
  outlines: Map<number, Path2D>,   // built on first use of outline mode for this slice
}
```

On a hit, `drawSlice` checks whether the map it needs is fully populated
(`size !== labels.length`) and builds it if not. So switching mode costs one extraction per
visible label the first time and is a pure cache hit after; a session that never leaves fill
mode never builds an outline. Building both eagerly would make every slice scrub pay for a
mode most sessions never turn on.

##### Stroking on an untransformed context

Outline mode does **not** stroke under `ctx.scale(sx, sy)`. The voxel→display mapping is
carried in a `DOMMatrix` applied to the path (`display.addPath(path, matrix)`), and the
context is left untransformed, so `lineWidth` is measured in **screen pixels**
(`OUTLINE_WIDTH_PX = 1.5`).

Stroking under the scale gets two things wrong: the line thickens with the zoom — exactly when
the clinician has magnified the image to look at the boundary — and because voxels are rarely
isotropic (`sx !== sy`) it comes out thicker in one axis than the other.

The coronal (`axis === 'y'`) Z-flip is folded into the same matrix rather than applied to the
context.

::: tip Why the segments are left unjoined
`extractLabelBoundarySegments` emits open two-point segments per cell and does not chain them
into polylines. Canvas rasterises a whole `Path2D` in one compositing pass, so segments meeting
at a shared endpoint produce no seam and no doubled alpha where their round caps overlap —
joining them would buy nothing and cost a chaining pass. `lineJoin` / `lineCap` are `'round'`
to close those joins.
:::

### 2.6 Programmatic Sphere Placement

| Method | Signature | Description |
|--------|-----------|-------------|
| `setCalculateDistanceSphere` | `(x: number, y: number, sliceIndex: number, cal_position: SphereType): void` | Programmatically place a calculator sphere, simulating a full mouse click flow |

**Parameters:**
- `x`, `y` — Unscaled image-space coordinates (the method applies `sizeFactor` internally)
- `sliceIndex` — Target slice index
- `cal_position` — Sphere type: `"tumour"` / `"skin"` / `"nipple"` / `"ribcage"`

**Internal flow** (simulates `DrawToolCore.handleSphereClick` + `pointerup`):

```
setCalculateDistanceSphere(x, y, sliceIndex, cal_position)
  │
  ├─ sphereRadius = 5
  ├─ setSliceMoving(...)                          → navigate to target slice
  │
  ├─ --- simulate mouse-down ---
  │  ├─ mouseX = x * sizeFactor
  │  ├─ sphereOrigin[axis] = [mouseX, mouseY, sliceIndex]
  │  ├─ crosshairTool.setUpSphereOrigins(...)     → compute origins on all 3 axes
  │  ├─ tumourSphereOrigin = deepCopy(sphereOrigin)  → store by cal_position type
  │  └─ drawCalculatorSphere(radius)              → draw preview
  │
  └─ --- simulate mouse-up ---
     ├─ sphereTool.writeAllCalculatorSpheresToVolume()  → write to sphereMaskVolume
     └─ sphereTool.refreshSphereCanvas()               → re-render overlay
```

**Typical usage** (called after backend returns sphere coordinates):

```typescript
nrrdTools.setCalculateDistanceSphere(120, 95, 42, 'tumour');
nrrdTools.setCalculateDistanceSphere(200, 150, 42, 'skin');
```

### 2.7 Other APIs

> **Implementation**: Directly in the NrrdTools Facade (section 5 View Control, section 6 Data Getters).

| Method | Description |
|--------|-------------|
| `drag(opts?)` | Enable drag-to-scroll slice navigation |
| `setAnnotationSuspended(bool)` | Block every input that can write into a mask, at `DrawToolCore.onCanvasPointerDown`. Slice scrubbing, zoom, pan and the crosshair stay live (see 7.1) |
| `isAnnotationSuspended()` | Query the suspension state |
| `setSliceOrientation(axis)` | Switch viewing axis. Calls `ensureAxisExtracted` for every loaded contrast first, so a narrowed-axes load can still switch planes |
| `addSkip(index)` / `removeSkip(index)` | Hide / show one contrast. `index` addresses the **full** contrast list |
| `setSkips(entries)` | Batched `addSkip`/`removeSkip`: writes every `skipSlicesDic` entry, then one `resetDisplaySlicesStatus()` |
| `setContrastIndex(index)` | Move to a contrast **within `displaySlices`** (the selected subset), clamped to its bounds |
| `commitSkipsAndContrast(entries, i)` | `setSkips` + `setContrastIndex` in one refresh. `contrastNum` is written *before* the refresh so its callbacks paint the target contrast directly; the clamp runs after, against the rebuilt `displaySlices` |
| `commitSeriesLoad(slices, entries, i)` | Case-load completion: replaces `allSlicesArray`, then delegates to `commitSkipsAndContrast` — one refresh instead of three |
| `switchAllSlicesArrayData(slices)` | Swap the loaded series and rebuild the display (resets view state) |
| `switchSlicesPreservingView(slices)` | Swap the loaded series via `switchPreservingView()`, keeping slice index, zoom and pan |
| `setSliceMoving(step)` | Step the current slice; steps are accumulated and applied in one `requestAnimationFrame` |
| `setMainAreaSize(factor)` | Clamp the zoom factor to [1, 8], resize the paint area and reset its UI position |
| `setBaseDrawDisplayCanvasesSize(size)` | Set canvas base size multiplier (1–8) |
| `setupGUI(gui)` | Set up the dat.GUI panel |
| `enableContrastDragEvents(callback)` | Enable contrast drag (window/level) events |
| `getCurrentImageDimension()` | Get voxel dimensions `[w, h, d]` |
| `getVoxelSpacing()` | Get voxel spacing (mm) |
| `getSpaceOrigin()` | Get world-space origin |
| `getMaxSliceNum()` | Get max slice count per axis |
| `getCurrentSlicesNumAndContrastNum()` | Get current slice index and contrast index |
| `getMaskData()` | Get raw `IMaskData` structure |
| `getContainer()` | Get the internal main-area container element |
| `getDrawingCanvas()` | Get the top-level interactive canvas |
| `getNrrdToolsSettings()` | Get a full NrrdState snapshot (5 sub-objects) |
| `executeAction(action)` | Execute a named action: `"undo"`, `"redo"`, `"clearActiveSliceMask"`, `"clearActiveLayerMask"`, `"resetZoom"`, `"downloadCurrentMask"`, `"gaussianSmooth"`. `"gaussianSmooth"` accepts optional `opts?: { sigma?: number }` |

---

## 3. States

### 3.1 nrrd_states (NrrdState)

**Type**: `NrrdState` class (defined in `coreTools/NrrdState.ts`)
**Interface**: `INrrdStates` extends `IImageMetadata`, `IViewState`, `IInteractionState`, `ISphereState`, `IInternalFlags` (defined in `core/types.ts`)

NrrdState groups 44 properties into 5 semantic sub-objects:

#### nrrd_states.image (IImageMetadata)

| Field | Type | Description |
|-------|------|-------------|
| `dimensions` | `[width, height, depth]` | Voxel dimensions |
| `nrrd_x_pixel` / `y` / `z` | `number` | Pixel count per axis |
| `voxelSpacing` | `number[]` | Voxel spacing |
| `spaceOrigin` | `number[]` | World-space origin |
| `layers` | `string[]` | List of Layer IDs |

#### nrrd_states.view (IViewState)

| Field | Type | Description |
|-------|------|-------------|
| `currentSliceIndex` | `number` | Current slice index |
| `maxIndex` / `minIndex` | `number` | Slice index range |
| `changedWidth` / `changedHeight` | `number` | Canvas display dimensions |
| `sizeFactor` | `number` | Scale factor |
| `originWidth` / `originHeight` | `number` | Original image dimensions |

#### nrrd_states.interaction (IInteractionState)

| Field | Type | Description |
|-------|------|-------------|
| `mouseOverX` / `mouseOverY` | `number` | Mouse position |
| `mouseOver` | `boolean` | Whether mouse is over the canvas |
| `cursorPageX` / `cursorPageY` | `number` | Cursor page coordinates |
| `drawStartPos` | `ICommXY` | Drawing start point |

#### nrrd_states.sphere (ISphereState)

| Field | Type | Description |
|-------|------|-------------|
| `sphereOrigin` / `skinSphereOrigin` etc. | `ICommXYZ \| null` | Origin for each sphere type |
| `sphereRadius` | `number` | Sphere radius |
| `sphereBrushRadius` | `number` | SphereBrush/SphereEraser radius (1-50) |
| `sphereMaskVolume` | `MaskVolume \| null` | Sphere volumetric data |

#### nrrd_states.flags (IInternalFlags)

| Field | Type | Description |
|-------|------|-------------|
| `stepClear` | `number` | Clear step (internal use) |
| `clearAllFlag` | `boolean` | Whether the current operation is a full-layer clear |
| `loadingMaskData` | `boolean` | Whether mask data is currently being loaded |

::: warning
The `loadMaskByDefault` and `isCalcContrastByDrag` fields **no longer exist** — previous documentation was incorrect.

`INrrdStates` flat interface is kept for backward compatibility (extends all 5 sub-interfaces), but at runtime the `NrrdState` class instance is used, with properties accessed via `nrrd_states.image.xxx`, `nrrd_states.view.xxx`, etc.
:::

### 3.2 gui_states (GuiState)

**Type**: `GuiState` class (defined in `coreTools/GuiState.ts`)
**Interface**: `IGUIStates` extends `IToolModeState`, `IDrawingConfig`, `IViewConfig`, `ILayerChannelState` (defined in `core/types.ts`)

GuiState groups 20 properties into 4 semantic sub-objects:

#### gui_states.mode (IToolModeState)

| Field | Type | Description |
|-------|------|-------------|
| `pencil` | `boolean` | Pencil tool active |
| `eraser` | `boolean` | Eraser tool active |
| `sphere` | `boolean` | Sphere tool active |
| `sphereBrush` | `boolean` | Sphere Brush tool active |
| `sphereEraser` | `boolean` | Sphere Eraser tool active |
| `activeSphereType` | `"tumour" \| "skin" \| "nipple" \| "ribcage"` | Current sphere type |

#### gui_states.drawing (IDrawingConfig)

| Field | Type | Description |
|-------|------|-------------|
| `globalAlpha` | `number` | Global opacity (default 0.6) |
| `lineWidth` | `number` | Line width |
| `color` / `fillColor` / `brushColor` | `string` | Brush color (Hex) |
| `brushAndEraserSize` | `number` | Brush/eraser size |
| `maskRenderMode` | `MaskRenderMode` | `"fill"` (default) or `"outline"`. Applies to every layer and channel at once; read only by the renderer, never by the write path |

#### gui_states.viewConfig (IViewConfig)

| Field | Type | Description |
|-------|------|-------------|
| `mainAreaSize` | `number` | Main area size |
| `dragSensitivity` | `number` | Drag sensitivity |
| `cursor` / `defaultPaintCursor` | `string` | Cursor style |
| `readyToUpdate` | `boolean` | Ready-to-update flag |

#### gui_states.layerChannel (ILayerChannelState)

| Field | Type | Description |
|-------|------|-------------|
| `layer` | `string` | Currently active Layer (default `"layer1"`) |
| `activeChannel` | `number` | Currently active Channel (1–255; 0 = empty/erased) |
| `layerVisibility` | `Record<string, boolean>` | Layer visibility map |
| `channelVisibility` | `Record<string, Record<number, boolean>>` | Channel visibility map |
| `layerOpacity` | `Record<string, number>` | Per-layer opacity map (0.1–1.0, default 1.0) |

### 3.3 protectedData (IProtected)

Defined in `CanvasState.ts` constructor.

| Field | Description |
|-------|-------------|
| `axis` | Current viewing axis `"x"` / `"y"` / `"z"` |
| `maskData.volumes` | `Record<string, MaskVolume>` — 3D volume for each Layer |
| `layerTargets` | `Map<string, ILayerRenderTarget>` — canvas + ctx for each Layer |
| `canvases` | 5 system canvases |
| `ctxes` | Corresponding 2D contexts |
| `isDrawing` | Whether drawing is currently active |

::: warning
`Is_Shift_Pressed` / `Is_Ctrl_Pressed` have been removed. Keyboard modifier key state is now managed internally by `EventRouter` and is no longer exposed through `protectedData`.
:::

---

## 4. Callbacks

### 4.1 onMaskChanged / getMaskData (backend sync)

Storage location: `CanvasState.annotationCallbacks.onMaskChanged` (`IAnnotationCallbacks` interface)

::: warning
The `nrrd_states.getMask` field referenced in previous documentation **no longer exists**. Register externally via `nrrdTools.draw({ getMaskData: ... })`, which maps internally to `annotationCallbacks.onMaskChanged`.
:::

```ts
onMaskChanged: (
  sliceData: Uint8Array,    // Raw voxel data for the current slice
  layerId: string,          // Layer name
  channelId: number,        // Active channel
  sliceIndex: number,       // Slice index
  axis: "x" | "y" | "z",   // Current axis
  width: number,            // Slice width
  height: number,           // Slice height
  clearFlag: boolean        // Whether this is a clear operation
) => void
```

**Called**: After each completed drawing stroke (mouseup), and after undo/redo.

### 4.2 onLayerVolumeCleared

Storage location: `CanvasState.annotationCallbacks.onLayerVolumeCleared`

```ts
onLayerVolumeCleared: (layerId: string) => void
```

### 4.3 onChannelColorChanged

Storage location: `CanvasState.annotationCallbacks.onChannelColorChanged` (`IAnnotationCallbacks`, `core/types.ts`)

::: warning
Previous documentation stated this was defined on `INrrdStates` — **that is incorrect**. This callback now belongs to `IAnnotationCallbacks`, stored in `CanvasState.annotationCallbacks`.
:::

```ts
onChannelColorChanged: (layerId: string, channel: number, color: RGBAColor) => void
```

**Called**: After `NrrdTools.setChannelColor()` modifies a color. Default is a no-op. Currently cannot be registered directly from outside — recommended approach: manually call `refreshChannelColors()` after `setChannelColor()`.

### 4.4 onSphereChanged / onCalculatorPositionsChanged

Storage location: `CanvasState.annotationCallbacks` (`IAnnotationCallbacks`, registered externally via `draw()`)

**`onSphereChanged`** (`getSphereData` in `IDrawOpts`): Called when the left mouse button is released in sphere mode.

```ts
onSphereChanged: (sphereOrigin: number[], sphereRadius: number) => void
// sphereOrigin = [mouseX, mouseY, sliceIndex] — z-axis view coordinates
// sphereRadius = radius in pixels (1–50)
```

**`onCalculatorPositionsChanged`** (`getCalculateSpherePositionsData` in `IDrawOpts`): Called after a sphere is placed (applies to all sphere types).

```ts
onCalculatorPositionsChanged: (
  tumourSphereOrigin: ICommXYZ | null,  // channel 1
  skinSphereOrigin: ICommXYZ | null,    // channel 4
  ribSphereOrigin: ICommXYZ | null,     // channel 3
  nippleSphereOrigin: ICommXYZ | null,  // channel 2
  axis: "x" | "y" | "z"
) => void
// Each origin is { x: [mx, my, slice], y: [...], z: [...] }
// null means that sphere type has not yet been placed
```

**Channel mapping** (exported as `SPHERE_CHANNEL_MAP`):

| Sphere Type | Layer  | Channel | Color |
|-------------|--------|---------|-------|
| tumour      | layer1 | 1       | `#10b981` (Emerald) |
| nipple      | layer1 | 2       | `#f43f5e` (Rose) |
| ribcage     | layer1 | 3       | `#3b82f6` (Blue) |
| skin        | layer1 | 4       | `#fbbf24` (Amber) |

::: tip
Sphere data currently does not write to the layer MaskVolume — it is displayed as an overlay only. The channel mapping is reserved for future integration.
:::

---

## 5. MaskVolume Storage & Rendering

### 5.1 Memory Layout

**File**: `core/MaskVolume.ts`

```
Memory layout: [z][y][x][channel]
index = z * bytesPerSlice + y * width * channels + x * channels + channel
bytesPerSlice = width * height * channels
```

Underlying data structure: a single contiguous `Uint8Array`

### 5.2 Slice Dimensions per Axis

| Axis | Slice Width | Slice Height | Notes |
|------|-------------|--------------|-------|
| z (Axial) | width | height | Most common, contiguous memory |
| y (Coronal) | width | depth | Extracted row by row |
| x (Sagittal) | depth | height | Extracted pixel by pixel, slowest |

emptyCanvas size configuration: `SliceRenderPipeline.setEmptyCanvasSize()` → `tools/SliceRenderPipeline.ts`

### 5.3 Slice Extraction (reading mask)

**`getSliceUint8(sliceIndex, axis)`**

Returns a raw `Uint8Array`, used for backend sync and Undo/Redo snapshots.

Per-axis implementation:
- **Z axis**: Contiguous memory `subarray` bulk copy (fastest)
- **Y axis**: Row-by-row iteration copy
- **X axis**: Pixel-by-pixel extraction (slowest)

### 5.4 Slice Write

**`setSliceUint8(sliceIndex, data, axis)`** — Inverse of `getSliceUint8`, used for Undo/Redo restoration.

**`setSliceLabelsFromImageData(sliceIndex, imageData, axis, activeChannel, channelVisible?)`** — Canvas → Volume write: converts RGBA pixels into channel labels. Uses `ALPHA_THRESHOLD = 128` to avoid anti-aliasing edge artifacts.

An exact RGB match is resolved through `buildRgbToChannelMap()`. A pixel that matches nothing — an anti-aliased edge — falls through to a nearest-colour search, and **that search is restricted to candidate labels**: the labels already present on this slice, plus `activeChannel`. One cheap pass collects them.

Widening the search to all 255 would not merely be 255 distance computations per fringe pixel. It would be wrong: the more colours the guess can choose from, the more readily a fringe resolves to a label that is nowhere on the slice, which puts voxels into another finding's mask with nothing on screen to show for it.

**`clearChannel(channel)`** — Zero every voxel carrying one label, leaving the others in place. Label-based volumes only (`numChannels === 1`, i.e. the voxel value *is* the label); a multi-plane volume stores channels as separate planes and would need a different sweep. Throws `RangeError` outside [1, 255]. The `version` counter is bumped **only if a voxel actually changed** — every derived cache keyed on it (the contour cache above all) is invalidated by a bump, so bumping for a clear that found nothing would redraw the layer for no reason.

### 5.5 Rendering to Canvas

**Core render method: `renderLabelSliceInto()`**

```ts
renderLabelSliceInto(
  sliceIndex: number,
  axis: 'x' | 'y' | 'z',
  target: ImageData,
  channelVisible?: Record<number, boolean>,
  opacity: number = 1.0
): void
```

Rendering logic:
1. Read label value (0–255)
2. `label === 0` → transparent (RGBA all zero)
3. `channelVisible?.[label] === false` → hidden channel → transparent
4. Otherwise → read color from volume's `colorMap` (supports per-layer custom colors), apply opacity

::: tip
**Phase B change**: Color source changed from global `MASK_CHANNEL_COLORS` to each volume instance's `this.colorMap`. `buildRgbToChannelMap()` is also now an instance method, ensuring correct custom color mapping during canvas → volume write-back.
:::

::: warning Two readback rules that changed with the 255-channel range
**`=== false`, not falsy** (step 3). `channelVisible` records what has been *hidden* and never
covers every label. `setSliceLabelsFromImageData` already read it that way; reading it as
falsy here made any label the map did not mention render as invisible — which was harmless
while eight channels were always listed, and is not once a label can be any of 255.

**`buildRgbToChannelMap()` covers every label the instance has a colour for**, not a fixed
1–8. A pixel painted in channel 12's colour used to miss the table entirely and fall through
to the nearest-colour guess, which could only ever answer 1–8 — so a high channel could be
drawn and could never be read back. Size is not a cost: the map is built once per readback
and every lookup against it is O(1).
:::

### 5.6 Full Rendering Pipeline

**Entry point: `reloadMasksFromVolume()`** — `SliceRenderPipeline.reloadMasksFromVolume()`

```
reloadMasksFromVolume()
  │
  ├─ getOrCreateSliceBuffer(axis)          → get/create reusable ImageData buffer
  │   [RenderingUtils.ts]
  │
  ├─ FOR EACH layer:
  │   ├─ target.ctx.clearRect(...)         → clear layer canvas
  │   └─ renderSliceToCanvas(layerId, axis, sliceIndex, buffer, target.ctx, w, h)
  │       [RenderingUtils.ts] → drawSlice(..., outline = maskRenderMode === "outline")
  │       │
  │       ├─ cache miss? volume.getSliceUint8 → findLabelsInSlice → buildPaths
  │       │   fill:    extractLabelContours(...)  → Path2D per label
  │       │   outline: extractLabelOutline(...)   → Path2D per label
  │       │
  │       └─ FOR EACH visible label: set fill/stroke from volume.getChannelColor(lbl)
  │           fill:    ctx.scale(sw/W, sh/H)  then ctx.fill(path, 'nonzero')
  │           outline: DOMMatrix on the PATH, ctx untransformed, ctx.stroke(...)
  │           ⚠️ coronal view (axis='y') applies a scale(1,-1) vertical flip (see §6.2) —
  │              on the context in fill mode, folded into the matrix in outline mode
  │
  └─ compositeAllLayers()                  → composite onto master canvas
      ├─ masterCtx.clearRect(...)
      └─ FOR EACH layer:
          ├─ if !layerVisibility[layerId] → skip
          ├─ masterCtx.save()
          ├─ masterCtx.globalAlpha = layerOpacity[layerId]  ← per-layer alpha
          ├─ masterCtx.drawImage(layerCanvas)
          └─ masterCtx.restore()
```

> **Per-Layer Alpha in Rendering**: Each layer's canvas is composited with its individual `layerOpacity` value applied via `masterCtx.globalAlpha`. The existing `globalAlpha` (from `gui_states.drawing`) controls overall mask transparency, while `layerOpacity` provides independent per-layer control. Final alpha = `globalAlpha × layerOpacity[layerId]`.

### 5.7 Marching Squares (`core/MarchingSquares.ts`)

The vector extraction behind both render modes. All four are exported from the package root.

| Function | Returns | Description |
|----------|---------|-------------|
| `findLabelsInSlice(labels, w, h, stride?, offset?, bbox?)` | `number[]` | Distinct non-zero labels present in the region |
| `extractLabelPolygons(...)` | `ContourPolygon[]` | Per-cell polygons covering the region |
| `extractLabelContours(...)` | `Path2D` | The above as a path — **fill** this |
| `extractLabelBoundarySegments(...)` | `ContourPolygon[]` | The region's edge, as open two-point segments |
| `extractLabelOutline(...)` | `Path2D` | The above as a path — **stroke** this |

All take `(labels, width, height, targetLabel, stride = 1, channelOffset = 0, bbox?)`.

::: danger Do not stroke the contour path
`extractLabelContours` is per-cell polygons whose *union* is the silhouette. Stroking it draws
every internal cell edge as well, covering the mask in a grid. Stroke `extractLabelOutline`.
:::

**How the two tables relate.** `CELL_SEGMENTS` has one entry per marching-squares case, and
each is the cut line of the corresponding `CELL_POLYGONS` entry — the one polygon edge that
does *not* lie on the cell border. Filling the polygons and stroking the segments therefore
describe the same silhouette, which is what lets the renderer swap fill for outline without
the mask's edge appearing to move. Endpoints are side midpoints in the same cell-local 0..1
space, so the caller adds `(i, j) + 0.5` identically for both.

Cases 0 and 15 emit no segments. **15 is why an outline is cheap**: solid interior has no
boundary, so the segment count follows the perimeter rather than the area.

Saddles (5 and 10) follow `CELL_POLYGONS`' convention — the two in-corners are disconnected
(4-connectivity) — because the other reading would run a boundary straight through mask the
fill considers solid.

---

## 6. Flip Mechanism

### 6.1 Display Flip (CT/MRI image only)

**`flipDisplayImageByAxis()`** — `SliceRenderPipeline.flipDisplayImageByAxis()`

Because the slices rendered by Three.js are not in the correct 2D orientation, the displayCanvas must be flipped:

| Axis | Flip |
|------|------|
| x (Sagittal) | `scale(-1, -1)` + `translate(-w, -h)` |
| y (Coronal) | `scale(1, -1)` + `translate(0, -h)` |
| z (Axial) | `scale(1, -1)` + `translate(0, -h)` |

Called from: `SliceRenderPipeline.redrawDisplayCanvas()`

### 6.2 Mask Flip (Coronal only)

**Important**: In `renderSliceToCanvas()` (RenderingUtils.ts), mask rendering **applies a vertical flip for the coronal view (axis='y')**:

```ts
if (axis === 'y') {
  targetCtx.save();
  targetCtx.scale(1, -1);
  targetCtx.translate(0, -scaledHeight);
}
targetCtx.drawImage(emptyCanvas, 0, 0, scaledWidth, scaledHeight);
if (axis === 'y') targetCtx.restore();
```

| Axis | Mask Flip | Notes |
|------|-----------|-------|
| z (Axial) | **None** | Storage coordinates match Three.js slice |
| y (Coronal) | **Vertical flip** `scale(1,-1)` | Cancels out the flip in the write path, ensuring cross-axis display consistency |
| x (Sagittal) | **None** | Storage coordinates match Three.js slice |

::: warning
Previous documentation stating "mask has no flip" is outdated. A Y-axis flip was introduced for the coronal view to fix a cross-axis slice alignment bug.
:::

### 6.3 applyMaskFlipForAxis (helper method)

`RenderingUtils.applyMaskFlipForAxis()` — provides the same flip transform as `flipDisplayImageByAxis()`, available for scenarios requiring manual coordinate alignment.

---

## 7. Tools

Location: `src/Utils/segmentation/tools/`

All Tools / modules extend `BaseTool` (`tools/BaseTool.ts`):

```ts
interface ToolContext {
  nrrd_states: NrrdState;
  gui_states: GuiState;
  protectedData: IProtected;
  cursorPage: ICursorPage;
  callbacks: IAnnotationCallbacks;
}
abstract class BaseTool {
  constructor(ctx: ToolContext)
  setContext(ctx: ToolContext): void
}
```

### 7.1 Tool List

::: tip
**ToolHost unified interface (complete)**: All Tool host method dependencies have been unified into the `ToolHost` interface in `tools/ToolHost.ts`. Each Tool selects its required method subset via `Pick<ToolHost, ...>`. The original 10 independent `*Callbacks` interfaces have been removed.
:::

#### NrrdTools Extracted Modules (God Class Split)

| Module | File | Lines | HostDeps Type |
|--------|------|-------|---------------|
| **LayerChannelManager** | `tools/LayerChannelManager.ts` | 211 | `LayerChannelHostDeps` (3 methods) |
| **SliceRenderPipeline** | `tools/SliceRenderPipeline.ts` | 453 | `SliceRenderHostDeps` (10 methods) |
| **DataLoader** | `tools/DataLoader.ts` | 222 | `DataLoaderHostDeps` (7 methods) |

#### DrawToolCore-Managed Tools (event handling)

| Tool | File | Description |
|------|------|-------------|
| **SphereTool** | `tools/SphereTool.ts` | 3D sphere annotation; 4 types (tumour/skin/ribcage/nipple); click-to-place + release-to-confirm |
| **CrosshairTool** | `tools/CrosshairTool.ts` | Crosshair position marker, coordinate conversion, crosshair rendering |
| **ContrastTool** | `tools/ContrastTool.ts` | Window/Level (brightness/contrast) adjustment |
| **ZoomTool** | `tools/ZoomTool.ts` | Zoom and pan |
| **EraserTool** | `tools/EraserTool.ts` | Eraser |
| **PanTool** | `tools/PanTool.ts` | Right-click drag to pan the canvas |
| **DrawingTool** | `tools/DrawingTool.ts` | Pencil/brush/eraser drawing; brush hover tracking; circle preview |
| **SphereBrushTool** | `tools/SphereBrushTool.ts` | 3D sphere volume painting (sphereBrush) and erasing (sphereEraser); drag-to-erase; grouped multi-slice undo |
| **ImageStoreHelper** | `tools/ImageStoreHelper.ts` | Canvas ↔ Volume sync |
| **DragSliceTool** | `tools/DragSliceTool.ts` | Drag to scroll through slices |

Tool initialization: `DrawToolCore.ts` → `initTools()`

#### Annotation suspension gate

`DrawToolCore.onCanvasPointerDown(e)` is the single point at which an input is allowed to
modify a mask. It exists as a named method rather than an inline closure in `draw()` so the
gate can be exercised directly in tests.

```
onCanvasPointerDown(e)
  │
  ├─ drawingTool.isActive || panTool.isActive?  → closePath, return
  ├─ sync paintSliceIndex to the current slice
  ├─ mode === 'draw'?                           → activeWheelMode = 'none'
  │
  ├─ e.button === 0
  │   ├─ annotationSuspended && !crosshairEnabled?  → return  ◀ the gate
  │   ├─ mode 'aiAssist'  → aiAssistTool.onPointerDown
  │   ├─ mode 'draw'      → drawingTool.onPointerDown
  │   ├─ crosshair on     → enableCrosshair            (read-only, survives the gate)
  │   ├─ sphereBrush      → sphereBrushTool.onSphereBrushClick
  │   ├─ sphereEraser     → sphereBrushTool.onSphereEraserClick
  │   └─ sphere           → handleSphereClick
  │
  └─ e.button === 2       → panTool.onPointerDown      (pan survives the gate)
```

`handleOnDrawingMouseMove` carries the same early return, so a drag that began before
suspension cannot continue painting through it.

Two consequences of gating here rather than per tool:

- A tool added later is covered without being told about suspension.
- The `!crosshairEnabled` escape applies only to a read-only probe. It cannot leak a stroke
  through, because `EventRouter` makes crosshair and `draw` mutually exclusive:
  `applyDrawKeyDown` refuses to enter `draw` while the crosshair is on, and `toggleCrosshair`
  refuses to turn it on while the mode is `draw`.

Exposed on the facade as `NrrdTools.setAnnotationSuspended()` / `isAnnotationSuspended()`.

### 7.2 ImageStoreHelper (key tool)

**`storeAllImages(index, layer)`** — Canvas → Volume sync flow:
1. Draw the layer canvas onto emptyCanvas
2. Read ImageData from emptyCanvas
3. Call `volume.setSliceLabelsFromImageData()` to write to MaskVolume
4. Extract the slice and notify the backend

**`filterDrawedImage(axis, sliceIndex)`** — Volume → Canvas read: calls `volume.renderLabelSliceInto()`.

### 7.3 SphereTool

**File**: `tools/SphereTool.ts`

```ts
type SphereType = 'tumour' | 'skin' | 'nipple' | 'ribcage';

const SPHERE_CHANNEL_MAP: Record<SphereType, { layer: string; channel: number }>;
// SPHERE_COLORS removed — colors derived dynamically from each volume's colorMap
const SPHERE_LABELS: Record<SphereType | 'default', number>;
```

**Interaction Methods:**

| Method | Description |
|--------|-------------|
| `onSphereClick(e)` | Left-click: record origin, store typed origin, enable crosshair, draw preview |
| `onSpherePointerUp()` | Left-click release: write all spheres to volume, refresh overlay, fire callbacks |

**SphereHostDeps:**

```ts
type SphereHostDeps = Pick<ToolHost,
  'setEmptyCanvasSize' | 'drawImageOnEmptyImage' | 'enableCrosshair' | 'setUpSphereOrigins'
>;
```

**Interaction constraints when sphere mode is active:**
- ❌ Shift key disabled (cannot enter draw mode)
- ✅ Crosshair toggle available (S key)
- ❌ Contrast mode blocked

**Interaction flow:**

```
Left mouse down → record origin for activeSphereType → activeWheelMode = 'sphere' → draw preview
Scroll wheel (while held) → sphereRadius ±1 [1, 50] → redraw
Left mouse up → write all spheres to volume → fire getSphere + getCalculateSpherePositions → activeWheelMode = 'zoom'
```

**SphereMaskVolume:** An independent `MaskVolume` (`nrrd_states.sphereMaskVolume`) stores sphere 3D data without polluting layer draw masks. Created in `setAllSlices()`, cleared in `reset()`.

### 7.4 PanTool

**File**: `tools/PanTool.ts` — 124 lines. Handles all right-click drag pan logic.

::: warning
`getPanelOffset` / `setPanelOffset` callbacks no longer exist. PanTool reads offsets directly via `canvas.offsetLeft` / `canvas.offsetTop`.
:::

```ts
type PanHostDeps = Pick<ToolHost, 'zoomActionAfterDrawSphere'>;
```

### 7.5 SphereBrushTool

**File**: `tools/SphereBrushTool.ts` — 584 lines. Handles 3D sphere volume painting (SphereBrush mode) and 3D sphere volume erasing (SphereEraser mode), including drag-to-erase and grouped multi-slice undo.

Unlike the SphereTool (which writes to a separate `sphereMaskVolume` overlay), SphereBrushTool writes directly to the active layer's shared `MaskVolume`, making its output fully compatible with NIfTI/GLTF export.

#### SphereBrushHostDeps

```ts
type SphereBrushHostDeps = Pick<ToolHost,
  'getVolumeForLayer' | 'compositeAllLayers' | 'pushUndoGroup'
  | 'renderSliceToCanvas' | 'getOrCreateSliceBuffer' | 'setEmptyCanvasSize'
  | 'reloadMasksFromVolume'
>;
```

#### Key Methods

| Method | Description |
|--------|-------------|
| `onSphereBrushClick(e)` | Left-click: record center, draw preview, set active |
| `onSphereBrushPointerUp()` | Release: write 3D sphere to volume, push undo group, fire onMaskChanged for all affected slices |
| `onSphereEraserClick(e)` | Left-click: record center, capture before-snapshots for all affected Z-slices |
| `onSphereEraserMove(e)` | Drag: continuously erase along path, lazily expand before-snapshots |
| `onSphereEraserPointerUp()` | Release: finalize cumulative erase, push undo group, fire onMaskChanged for all affected slices |
| `configSphereBrushWheel()` | Returns wheel handler that adjusts `sphereBrushRadius` ±1 [1, 50] |
| `drawPreview(x, y, r, isEraser)` | Render sphere preview circle on sphereCanvas |
| `clearPreview()` | Clear preview from sphereCanvas |

#### 3D Geometry

- **`canvasToVoxelCenter()`**: Converts canvas pixel coordinates to 3D voxel center `[cx, cy, cz]`
- **`getVoxelRadii()`**: Computes per-axis voxel radii from mm radius and voxel spacing
- **`computeBoundingBox()`**: Computes axis-aligned bounding box clamped to volume bounds
- **Sphere equation**: `(dx/rx)² + (dy/ry)² + (dz/rz)² <= 1` (ellipsoid to handle anisotropic spacing)

#### Undo Mechanism

SphereBrush uses **grouped undo** (`pushUndoGroup(MaskDelta[])`) instead of single-delta undo:

```
SphereBrush:
  mousedown → capture before-snapshot for all Z-slices in bounding box
  mouseup   → capture after-snapshot, diff → push MaskDelta[] group

SphereEraser (click-release):
  mousedown → capture before-snapshots (dragBeforeSnapshots)
  mouseup   → diff before vs current → push MaskDelta[] group

SphereEraser (drag):
  mousedown → init dragBeforeSnapshots for initial bounding box
  mousemove → expandDragBeforeSnapshots for newly touched Z-slices
  mouseup   → diff cumulative before vs current → push single MaskDelta[] group
```

#### Backend Sync

`refreshDisplay()` fires `onMaskChanged` for **every** affected Z-slice (not just the current viewing slice), ensuring correct NIfTI and GLTF export of the full 3D sphere.

### 7.6 DrawingTool

**File**: `tools/DrawingTool.ts` — 284 lines. Handles pencil, brush, and eraser drawing logic including Undo snapshots.

```ts
type DrawingHostDeps = Pick<ToolHost,
  'setCurrentLayer' | 'compositeAllLayers' | 'syncLayerSliceData'
  | 'filterDrawedImage' | 'getVolumeForLayer' | 'pushUndoDelta'
  | 'renderSliceToCanvas' | 'renderSliceForBake' | 'getOrCreateSliceBuffer'
>;
```

**`onPointerLeave()` return value**: Returns `true` if the user was drawing when leaving the canvas, signaling DrawToolCore to restore `activeWheelMode = 'zoom'`.

**Undo snapshot mechanism:**

```
mousedown → capturePreDrawSnapshot()
  → volume.getSliceUint8(sliceIndex, axis)  ← before operation
  → saved to preDrawSlice / preDrawAxis / preDrawSliceIndex

mouseup → pushUndoDelta()
  → volume.getSliceUint8(sliceIndex, axis)  ← after operation
  → pushUndoDelta({ layerId, axis, sliceIndex, oldSlice: preDrawSlice, newSlice })
```

---

## 8. EventRouter

**File**: `eventRouter/EventRouter.ts`

### 8.1 Interaction Modes

| Mode | Trigger | Description |
|------|---------|-------------|
| `idle` | Default | No interaction |
| `draw` | Shift held | Drawing mode |
| `drag` | Vertical drag | Slice navigation |
| `contrast` | Ctrl/Meta held | Window/Level adjustment |
| `crosshair` | S key | Crosshair mode |

### 8.2 Permanent Event Routing

EventRouter permanently binds all pointer/keyboard/wheel events to the drawingCanvas in `bindAll()`. DrawToolCore registers handlers via `set*Handler()` — no more manual `addEventListener`/`removeEventListener`.

| Handler | Guard Condition |
|---------|-----------------|
| `setPointerDownHandler` | None |
| `setPointerMoveHandler` | `drawingTool.isActive \|\| panTool.isActive` |
| `setPointerUpHandler` | `drawingTool.isActive \|\| drawingTool.painting \|\| panTool.isActive \|\| sphere mode` |
| `setPointerLeaveHandler` | None |
| `setWheelHandler` | Dispatches based on `activeWheelMode` |

::: warning
**Guard conditions are essential**: Without them, idle mouse movement would prevent the Brush preview and Crosshair from rendering (DrawingTool.onPointerMove unconditionally sets `isDrawing=true`).
:::

### 8.3 Wheel Dispatcher (`activeWheelMode`)

| Mode | Trigger | Dispatch Target |
|------|---------|-----------------|
| `'zoom'` | Default / restored after mouseUp | `handleMouseZoomSliceWheel` |
| `'sphere'` | Set by `handleSphereClick` | `handleSphereWheel` |
| `'sphereBrush'` | Set by sphereBrush/sphereEraser mouseDown | `handleSphereBrushWheel` (adjusts `sphereBrushRadius`) |
| `'none'` | Set by mouseDown in draw mode | No-op (wheel suppressed) |

### 8.4 Default Keyboard Settings

```ts
IKeyBoardSettings = {
  draw: "Shift",
  undo: "z",
  redo: "y",
  contrast: ["Control", "Meta"],
  crosshair: "s",
  sphere: "q",
  mouseWheel: "Scroll:Zoom",   // or "Scroll:Slice"
}

// Additional global shortcuts (handled in DrawToolCore keydown, not configurable):
// Ctrl+1 → switch to Scroll:Zoom
// Ctrl+2 → switch to Scroll:Slice
```

---

## 9. Undo/Redo System

**File**: `core/UndoManager.ts`

```ts
interface MaskDelta {
  layerId: string;
  axis: "x" | "y" | "z";
  sliceIndex: number;
  oldSlice: Uint8Array;   // Slice data before the operation
  newSlice: Uint8Array;   // Slice data after the operation
}
```

- Independent undo/redo stack per layer
- `MAX_STACK_SIZE = 50`

**Stacks are created on demand** <Badge type="tip" text="3.10.4" />, keyed by layer id, so any
layer name works. They used to be pre-created for exactly `layer1` / `layer2` / `layer3`, which
broke in two different ways for any other id — and `NrrdTools`'s constructor has always taken
`options.layers`, so any other id is reachable:

| Call | Old behaviour with a custom layer id |
|------|--------------------------------------|
| `pushGroup` / `pushVolumeSnapshot` | resolved with `?? get("layer1")` and silently appended to **another layer's** history, so a later undo popped a stroke the user never made there |
| `undo` / `redo` | asserted non-null on the same lookup and **threw** |

`stackFor(stacks, layerId)` creates the entry on first use, which removes both. Nothing else
needs to know which layers exist, and `clearAll()` now iterates the maps rather than a fixed
id list.

**Undo flow:**

```
DrawToolCore.undoLastPainting()
  → UndoManager.undo() → MaskDelta
  → vol.setSliceUint8(delta.sliceIndex, delta.oldSlice, delta.axis)
  → applyUndoRedoToCanvas(layerId)
    → getOrCreateSliceBuffer(axis)
    → renderSliceToCanvas(...)
    → compositeAllLayers()
  → annotationCallbacks.onMaskChanged(...) → notify backend
```

---

## 10. DragOperator

**File**: `DragOperator.ts` — Responsible for drag-based slice navigation.

::: warning
**Event Lifecycle Refactor change**: DragOperator no longer manually manages wheel event listeners. Wheel events are now entirely managed by EventRouter's `activeWheelMode` dispatcher.
:::

| Method | Description |
|--------|-------------|
| `drag(opts?)` | Enable drag mode |
| `configDragMode()` | Bind drag event listeners |
| `removeDragMode()` | Remove drag event listeners |
| `updateIndex(move)` | Delegates to DragSliceTool |
| `setEventRouter(eventRouter)` | Subscribe to mode changes |

---

## 11. Channel Color Definitions

**File**: `core/types.ts`

### 11.1 Default Colors (global constants)

| Channel | Color | Hex | RGBA |
|---------|-------|-----|------|
| 0 | Transparent | `#000000` | `(0,0,0,0)` |
| 1 | Emerald (Tumour) | `#10b981` | `(16,185,129,255)` |
| 2 | Rose (Edema) | `#f43f5e` | `(244,63,94,255)` |
| 3 | Blue (Necrosis) | `#3b82f6` | `(59,130,246,255)` |
| 4 | Amber (Enhancement) | `#fbbf24` | `(251,191,36,255)` |
| 5 | Fuchsia (Vessel) | `#d946ef` | `(217,70,239,255)` |
| 6 | Cyan (Additional) | `#06b6d4` | `(6,182,212,255)` |
| 7 | Orange (Auxiliary) | `#f97316` | `(249,115,22,255)` |
| 8 | Violet (Extended) | `#8b5cf6` | `(139,92,246,255)` |

Exported as: `MASK_CHANNEL_COLORS` (RGBA), `MASK_CHANNEL_CSS_COLORS` (CSS), `CHANNEL_HEX_COLORS` (Hex)

#### Channels 9–255 (generated)

`MAX_ENGINE_CHANNEL = 255` — one byte per voxel, the value *is* the label, so 0 is empty and
1–255 are channels. The engine does not cap below what the byte allows; a smaller product
limit is the product's business.

Each palette is built by `extendPalette(seed, from)`, which copies the 0–8 table verbatim and
fills 9–255 from `generatedChannelColor(channel)`:

```
hue        = ((channel - 8 - 1) * 137.508) % 360     // golden angle
saturation = 0.68                                    // fixed
lightness  = 0.55                                    // fixed
```

Two decisions worth knowing:

- **Only hue varies.** These sit on greyscale MRI; a mask whose *brightness* changes between
  channels reads as a difference in the image rather than in the annotation.
- **The seeds are not regenerated.** Delivered cases' chips, 3D overlay tints and printed
  report outlines are keyed on the eight literals, so a formula that happened to produce
  different values would silently recolour work already read and signed off.

Built eagerly rather than behind a `Proxy`: `applyLayerChannelColors` walks these with
`Object.entries`, which a `Proxy`'s `get` trap would not serve.

::: warning
`CHANNEL_COLORS` is declared *after* the tables it aliases. It used to sit above them, which
was fine while they were object literals and is a temporal-dead-zone error now that they are
built.
:::

### 11.2 Color Conversion Utilities

| Function | Signature | Description |
|----------|-----------|-------------|
| `rgbaToHex` | `(color: RGBAColor) → string` | Convert to Hex, e.g. `#ff8000` |
| `rgbaToCss` | `(color: RGBAColor) → string` | Convert to CSS rgba(), e.g. `rgba(255,128,0,1.00)` |

### 11.3 Per-Layer Custom Colors

Each `MaskVolume` instance owns an independent `colorMap: ChannelColorMap`, deep-copied from `MASK_CHANNEL_COLORS` at construction. Modifying a layer's color does not affect other layers.

**Color flow path:**

```
volume.colorMap[channel]
  ↓ renderLabelSliceInto()     → canvas rendering reads colorMap
  ↓ buildRgbToChannelMap()     → canvas → volume write-back reads colorMap
  ↓ EraserTool.getChannelColor → eraser color matching reads colorMap
  ↓ syncBrushColor()           → brush color reads colorMap
  ↓ getChannelCssColor()       → Vue UI reads colorMap for display
```

---

## 12. GaussianSmoother

**File**: `core/GaussianSmoother.ts`

Pure stateless utility class for 3D Gaussian smoothing of segmentation masks. No DOM/Canvas/GUI dependencies. Includes performance optimizations for direct typed-array access and branch-free convolution.

### 12.1 Algorithm

Applies separable 3D Gaussian blur to a single label channel within a MaskVolume:

1. **Extract**: Create a Float32Array with 1.0 where voxel === channel, 0.0 elsewhere (direct `rawData[]` access)
2. **Blur**: Apply separable Gaussian convolution (X → Y → Z) using 1D kernels truncated at ±3σ (branch-free middle segment)
3. **Threshold**: Binarize at 0.5
4. **Write back**: Overwrite/erase voxels according to the thresholded result (direct `rawData[]` access)

### 12.1.1 Performance Optimizations

Two key optimizations reduce execution time significantly:

1. **Direct array access** — The extract and write-back phases bypass `getVoxel()`/`setVoxel()` (which perform 6 boundary checks + function call overhead per voxel). Instead, `volume.getRawData()` gives direct access to the underlying `Uint8Array`, and indices are computed inline using `volume.getBytesPerSlice()` and `volume.getChannels()`:

   ```typescript
   const rawData = volume.getRawData();
   const channels = volume.getChannels();
   const bytesPerSlice = volume.getBytesPerSlice();
   const rowStride = width * channels;
   // Direct access: rawData[zOffset + yOffset + x * channels]
   ```

2. **Branch-free convolution** — `convolve1D` splits the loop into three segments: left boundary (lower bound check), middle interior (no branching, ~95% of work), right boundary (upper bound check):

   ```typescript
   // Middle segment — NO bounds check
   for (let i = midStart; i < midEnd; i++) {
     let sum = 0;
     const lineOffset = i - radius;
     for (let k = 0; k < kLen; k++) {
       sum += line[lineOffset + k] * kernel[k];
     }
     data[lineStart + i * stride] = sum;
   }
   ```

> **Impact scope**: Only `GaussianSmoother.ts` is modified. All other tools continue using `getVoxel`/`setVoxel` with full boundary checks — zero impact on existing code.

### 12.2 Public API

| Method | Signature | Description |
|--------|-----------|-------------|
| `gaussianSmooth3D` | `(volume: MaskVolume, channel: number, sigma?: number, spacing?: [number, number, number]): void` | Smooth a single label channel in-place using separable 3D Gaussian blur |
| `generateKernel1D` | `(sigma: number): Float32Array` | Generate a normalized 1D Gaussian kernel truncated at ±3σ |

### 12.3 Anisotropic Spacing

When `spacing` is provided, per-axis sigma is computed as `sigma / spacing[axis]` to ensure isotropic physical smoothing:

```typescript
const sigmaX = spacing ? sigma / spacing[0] : sigma;
const sigmaY = spacing ? sigma / spacing[1] : sigma;
const sigmaZ = spacing ? sigma / spacing[2] : sigma;
```

### 12.4 NrrdTools Integration

`executeAction("gaussianSmooth", { sigma })` in NrrdTools:

1. Identifies the active layer and channel
2. Snapshots all Z-slices containing the target channel (undo support via `MaskDelta[]`)
3. Calls `GaussianSmoother.gaussianSmooth3D()` with voxel spacing from `nrrd_states.image.voxelSpacing`
4. Captures post-smoothing slice data and pushes undo group via `undoManager.pushGroup()`
5. Fires `onMaskChanged` callback for each modified slice (backend sync)
6. Calls `reloadMasksFromVolume()` to refresh canvas display

```
executeAction("gaussianSmooth", { sigma })
  │
  ├─ snapshot all affected Z-slices (oldSlice)
  │
  ├─ GaussianSmoother.gaussianSmooth3D(volume, channel, sigma, spacing)
  │
  ├─ capture newSlice for each delta
  │
  ├─ undoManager.pushGroup(deltas)
  │
  ├─ FOR EACH affected slice:
  │   └─ onMaskChanged(sliceData, layerId, channel, z, "z", width, height, false)
  │
  └─ reloadMasksFromVolume()
```

### 12.5 Vue UI Integration

- **Button**: "Smoothing: Gaussian" in `OperationCtl.vue` (`commFuncBtnValues`)
- **Slider**: "Smooth Sigma" radio in `commSliderRadioValues` (range 0.5–5.0, step 0.5, default 1.0)
- **Loading animation**: Emits `Segmentation:SwitchAnimationStatus` event during execution
- **Toast notification**: Success/failure toast via `useToast` composable
- **Emitter event**: `Segmentation:SwitchAnimationStatus` (registered in `custom-emitter.ts` event whitelist)
