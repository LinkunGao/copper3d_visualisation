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

- [CanvasState.ts](Utils/segmentation/CanvasState.ts) — Pure state container
- [RenderingUtils.ts](Utils/segmentation/RenderingUtils.ts) — Rendering utilities
- [DrawToolCore.ts](Utils/segmentation/DrawToolCore.ts) — Drawing core (composes CanvasState + RenderingUtils)
- [NrrdTools.ts](Utils/segmentation/NrrdTools.ts) — Public API Facade (composes CanvasState + DrawToolCore)
- [tools/LayerChannelManager.ts](Utils/segmentation/tools/LayerChannelManager.ts) — Layer/Channel management
- [tools/SliceRenderPipeline.ts](Utils/segmentation/tools/SliceRenderPipeline.ts) — Slice rendering pipeline
- [tools/DataLoader.ts](Utils/segmentation/tools/DataLoader.ts) — Data loading

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
| `setActiveChannel` | `(channel: ChannelValue): void` | Set the active Channel (1–8); updates brush color |
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
| `setMasksData` | `(masksData, loadingBar?): void` | Legacy loading method (deprecated, pending removal) |
| `setMasksFromNIfTI` | `(layerVoxels: Map<string, Uint8Array>, loadingBar?): void` | Load mask data from NIfTI files into MaskVolume |

### 2.5 Display & Rendering

> **Implementation**: `tools/SliceRenderPipeline.ts`, single-line delegation in NrrdTools.

| Method | Signature | Description |
|--------|-----------|-------------|
| `resizePaintArea` | `(factor: number): void` | Resize the canvas scale factor |
| `reloadMasksFromVolume` | `(): void` (private) | **Core re-render**: Re-renders all Layers from MaskVolume to Canvas |
| `flipDisplayImageByAxis` | `(): void` | Flip the CT image for correct display orientation |
| `redrawDisplayCanvas` | `(): void` | Redraw the contrast image onto the displayCanvas |
| `setEmptyCanvasSize` | `(axis?): void` | Set emptyCanvas dimensions based on the current axis |

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
| `activeChannel` | `number` | Currently active Channel (1–8) |
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

**`setSliceLabelsFromImageData(sliceIndex, imageData, axis, activeChannel, channelVisible?)`** — Canvas → Volume write: converts RGBA pixels into channel labels (1–8). Uses `ALPHA_THRESHOLD = 128` to avoid anti-aliasing edge artifacts.

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
1. Read label value (0–8)
2. `label === 0` → transparent (RGBA all zero)
3. `channelVisible && !channelVisible[label]` → hidden channel → transparent
4. Otherwise → read color from volume's `colorMap` (supports per-layer custom colors), apply opacity

::: tip
**Phase B change**: Color source changed from global `MASK_CHANNEL_COLORS` to each volume instance's `this.colorMap`. `buildRgbToChannelMap()` is also now an instance method, ensuring correct custom color mapping during canvas → volume write-back.
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
  │       [RenderingUtils.ts]
  │       │
  │       ├─ volume.renderLabelSliceInto(...)  → render voxels into buffer
  │       ├─ emptyCtx.putImageData(buffer)     → put into emptyCanvas
  │       └─ targetCtx.drawImage(emptyCanvas)  → draw to layer canvas
  │           ⚠️ coronal view (axis='y') applies scale(1,-1) vertical flip (see §6.2)
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
  | 'reloadMasksFromVolume' | 'getEraserUrls'
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
  | 'filterDrawedImage' | 'getVolumeForLayer' | 'pushUndoDelta' | 'getEraserUrls'
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

Pure stateless utility class for 3D Gaussian smoothing of segmentation masks. No DOM/Canvas/GUI dependencies.

### 12.1 Algorithm

Applies separable 3D Gaussian blur to a single label channel within a MaskVolume:

1. **Extract**: Create a Float32Array with 1.0 where voxel === channel, 0.0 elsewhere
2. **Blur**: Apply separable Gaussian convolution (X → Y → Z) using 1D kernels truncated at ±3σ
3. **Threshold**: Binarize at 0.5
4. **Write back**: Overwrite/erase voxels according to the thresholded result

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
