# Segmentation Module Documentation

> Source: `annotator-frontend/src/ts/Utils/segmentation/`

> ⚠️ **注意**：文档中所有行号引用均来自历史版本，经过多轮重构（State Management Refactor + NrrdTools God Class Split + 继承→组合重构）后已过时，仅作结构参考，请以实际代码为准。

## 1. Architecture Overview

### 1.1 Class Composition（组合模式）

```
NrrdTools (Facade)
  ├── CanvasState              ← 纯状态容器（nrrd_states, gui_states, protectedData 等）
  ├── DrawToolCore             ← 事件编排、Undo/Redo、Tool 初始化与委托
  │     ├── CanvasState (共享)  ← 引用同一 CanvasState 实例
  │     └── RenderingUtils     ← 渲染/切片缓冲区工具
  ├── LayerChannelManager      ← 图层/通道/SphereType 管理（211 行）
  ├── SliceRenderPipeline      ← 切片渲染管线（453 行）
  └── DataLoader               ← 数据加载（222 行）
```

> **继承→组合重构（已完成）**: 原先的三级继承链 `NrrdTools → DrawToolCore → CommToolsData` 已完全替换为组合关系。`CommToolsData` 已删除。状态提取到 `CanvasState`，渲染方法提取到 `RenderingUtils`。
>
> **DrawToolCore** 现在是纯编排层 — 所有工具逻辑已提取到各 Tool 类中。
> DrawToolCore 通过 EventRouter 永久路由所有 pointer/wheel 事件，并在 `start()` render loop 中调度各 Tool 的渲染方法。
> 不再有手动 `addEventListener`/`removeEventListener` 调用（wheel 行为通过 `activeWheelMode` 状态派发）。
>
> **NrrdTools God Class Split（已完成）**: NrrdTools 经过 4 个 Phase 的重构，从 2007 行 God Class 拆分为 Facade + 3 个功能模块。公开 API 不变，内部通过 `ToolContext` + `ToolHost` `Pick<>` 类型解耦。
>
> **Callback 接口统一（已完成）**: 原先 10 个 `*Callbacks` 接口已统一为单一 `ToolHost` 接口（`tools/ToolHost.ts`），每个 Tool 通过 `Pick<ToolHost, ...>` 选择所需的宿主方法子集。

- [CanvasState.ts](annotator-frontend/src/ts/Utils/segmentation/CanvasState.ts) — 纯状态容器
- [RenderingUtils.ts](annotator-frontend/src/ts/Utils/segmentation/RenderingUtils.ts) — 渲染工具
- [DrawToolCore.ts](annotator-frontend/src/ts/Utils/segmentation/DrawToolCore.ts) — 绘画核心（组合 CanvasState + RenderingUtils）
- [NrrdTools.ts](annotator-frontend/src/ts/Utils/segmentation/NrrdTools.ts) — 对外 API Facade（组合 CanvasState + DrawToolCore）
- [tools/LayerChannelManager.ts](annotator-frontend/src/ts/Utils/segmentation/tools/LayerChannelManager.ts) — 图层/通道管理
- [tools/SliceRenderPipeline.ts](annotator-frontend/src/ts/Utils/segmentation/tools/SliceRenderPipeline.ts) — 切片渲染管线
- [tools/DataLoader.ts](annotator-frontend/src/ts/Utils/segmentation/tools/DataLoader.ts) — 数据加载

### 1.2 Canvas 层级结构

共有 **5 个系统 Canvas** + **N 个 Layer Canvas**（默认 3 个 Layer）。

```
┌──────────────────────────────────┐
│ drawingCanvas (顶层交互层)         │  ← 捕获鼠标/笔事件，实时绘制笔画
├──────────────────────────────────┤
│ drawingSphereCanvas              │  ← 3D Sphere 工具的覆盖层
├──────────────────────────────────┤
│ drawingCanvasLayerMaster (合成层)  │  ← 所有可见 Layer 合成后的结果
│   ├─ layerTargets[layer1].canvas │  ← 隐藏的 per-layer canvas
│   ├─ layerTargets[layer2].canvas │
│   └─ layerTargets[layer3].canvas │
├──────────────────────────────────┤
│ displayCanvas (背景医学图像)       │  ← CT/MRI 切片图像
├──────────────────────────────────┤
│ originCanvas (从 Three.js 获取)   │  ← 缓存 Three.js 渲染的原始切片
├──────────────────────────────────┤
│ emptyCanvas (临时处理用)           │  ← 离屏画布，用于图像处理和格式转换
└──────────────────────────────────┘
```

**Canvas 创建位置:**
- 系统 Canvas: [CanvasState.ts](annotator-frontend/src/ts/Utils/segmentation/CanvasState.ts) `generateSystemCanvases()`
- Layer Canvas: [CanvasState.ts](annotator-frontend/src/ts/Utils/segmentation/CanvasState.ts) `generateLayerTargets(layerIds)`
- Canvas 注释说明: [CanvasState.ts](annotator-frontend/src/ts/Utils/segmentation/CanvasState.ts) constructor

### 1.3 NrrdTools Facade 内部模块

NrrdTools 通过 `ToolContext` 将共享状态传递给各模块，通过 `Pick<ToolHost, ...>` 类型别名声明宿主方法依赖：

```
ToolContext = {
  nrrd_states: NrrdState,
  gui_states: GuiState,
  protectedData: IProtected,
  cursorPage: ICursorPage,
  callbacks: IAnnotationCallbacks,
}
```

| 模块 | 文件 | 职责 | HostDeps 类型 |
|------|------|------|---------------|
| **LayerChannelManager** | `tools/LayerChannelManager.ts` | setActiveLayer/Channel/SphereType、可见性控制、自定义通道颜色 | `LayerChannelHostDeps` (3 methods) |
| **SliceRenderPipeline** | `tools/SliceRenderPipeline.ts` | 切片轴配置、canvas 渲染、mask 重载、canvas 翻转、view/canvas 辅助 | `SliceRenderHostDeps` (10 methods) |
| **DataLoader** | `tools/DataLoader.ts` | NRRD 切片加载、legacy mask 加载、NIfTI voxel 加载 | `DataLoaderHostDeps` (7 methods) |

NrrdTools 中的委托方法均为一行调用 (`this.layerChannelManager.xxx()`)，不包含任何业务逻辑。

### 1.4 Layer 与 MaskVolume 对应关系

每个 Layer 对应一个独立的 `MaskVolume` 实例：

```
protectedData.maskData.volumes = {
  "layer1": MaskVolume(width, height, depth, 1),
  "layer2": MaskVolume(width, height, depth, 1),
  "layer3": MaskVolume(width, height, depth, 1),
}
```

- 初始化（1x1x1 占位）: [CanvasState.ts](annotator-frontend/src/ts/Utils/segmentation/CanvasState.ts) constructor
- 用实际 NRRD 尺寸重新初始化: `DataLoader.setAllSlices()` → `tools/DataLoader.ts`（已从 NrrdTools 提取）

---

## 2. NrrdTools 暴露的 API

> ⚠️ **行号均已过时**。NrrdTools 经过 God Class Split 重构后（1300 行，13 个分区），方法实现已迁移到各提取模块（LayerChannelManager、SliceRenderPipeline、DataLoader），NrrdTools 中仅保留一行委托。行号仅供历史参考，请以实际代码为准。
>
> 实现位置：Layer/Channel 方法 → `tools/LayerChannelManager.ts`，渲染方法 → `tools/SliceRenderPipeline.ts`，数据加载 → `tools/DataLoader.ts`。

### 2.1 Layer & Channel 管理

> **实现**: `tools/LayerChannelManager.ts`，NrrdTools 中一行委托。

| 方法 | 签名 | 说明 |
|------|------|------|
| `setActiveLayer` | `(layerId: string): void` | 设置当前活跃 Layer，同时更新 fillColor/brushColor |
| `setActiveChannel` | `(channel: ChannelValue): void` | 设置当前活跃 Channel (1-8)，更新画笔颜色 |
| `getActiveLayer` | `(): string` | 获取当前 Layer ID |
| `getActiveChannel` | `(): number` | 获取当前 Channel 值 |
| `setLayerVisible` | `(layerId, visible): void` | 设置 Layer 可见性，触发 `reloadMasksFromVolume()` |
| `isLayerVisible` | `(layerId): boolean` | 检查 Layer 是否可见 |
| `setChannelVisible` | `(layerId, channel, visible): void` | 设置某 Layer 下某 Channel 可见性，触发重渲染 |
| `isChannelVisible` | `(layerId, channel): boolean` | 检查 Channel 是否可见 |
| `getLayerVisibility` | `(): Record<string, boolean>` | 获取所有 Layer 可见性副本 |
| `getChannelVisibility` | `(): Record<string, Record<number, boolean>>` | 获取所有 Channel 可见性副本 |
| `hasLayerData` | `(layerId): boolean` | 检查 Layer 是否有非零数据 |

### 2.2 Custom Channel Color API（Phase B）

Per-layer 自定义 channel 颜色。每个 layer 的 MaskVolume 有独立的 `colorMap`，互不影响。

| 方法 | 签名 | 说明 |
|------|------|------|
| `setChannelColor` | `(layerId: string, channel: number, color: RGBAColor): void` | 设置指定 layer 指定 channel 的颜色，触发重渲染和 `onChannelColorChanged` 回调 |
| `getChannelColor` | `(layerId: string, channel: number): RGBAColor` | 获取 RGBA 颜色对象 |
| `getChannelHexColor` | `(layerId: string, channel: number): string` | 获取 Hex 字符串（如 `#ff8000`） |
| `getChannelCssColor` | `(layerId: string, channel: number): string` | 获取 CSS rgba() 字符串（如 `rgba(255,128,0,1.00)`） |
| `setChannelColors` | `(layerId: string, colorMap: Partial<ChannelColorMap>): void` | 批量设置一个 layer 的多个 channel 颜色（一次 reload） |
| `setAllLayersChannelColor` | `(channel: number, color: RGBAColor): void` | 所有 layer 的同一 channel 设为相同颜色 |
| `resetChannelColors` | `(layerId?: string, channel?: number): void` | 重置为 `MASK_CHANNEL_COLORS` 默认颜色 |

**内部机制**:
- `syncBrushColor()` — 私有方法，从当前 layer 的 volume 动态获取颜色更新 `fillColor`/`brushColor`
- 在 `setActiveLayer()`、`setActiveChannel()`、`setChannelColor()` 等方法中自动调用

#### 外部使用方式

**前提**: `nrrdTools` 实例已创建，且 `setAllSlices()` 已调用完毕（即图像已加载，MaskVolume 已初始化）。
 
> ⚠️ **重要**: 必须在图像加载完成（`setAllSlices()` 调用后）才能设置颜色，否则 MaskVolume 尚未创建，调用会静默失败（`console.warn`）。
 
---

**场景 1：给某个 Layer 的某个 Channel 设置自定义颜色**

```typescript
// 将 layer2 的 channel 3 设为橙色
nrrdTools.setChannelColor('layer2', 3, { r: 255, g: 128, b: 0, a: 255 });
// 效果：layer2 上所有用 channel 3 画的 mask 变为橙色
// layer1、layer3 的 channel 3 颜色不受影响
```

---

**场景 2：批量设置一个 Layer 的多个 Channel 颜色（推荐，只触发一次重渲染）**

```typescript
nrrdTools.setChannelColors('layer1', {
  1: { r: 255, g: 0,   b: 0,   a: 255 },   // channel 1 → 红色
  2: { r: 0,   g: 0,   b: 255, a: 255 },   // channel 2 → 蓝色
  3: { r: 255, g: 255, b: 0,   a: 255 },   // channel 3 → 黄色
});
// 只触发一次 reloadMasksFromVolume()，性能优于多次调用 setChannelColor()
```

---

**场景 3：所有 Layer 的同一 Channel 使用相同颜色**

```typescript
// 把所有 layer 的 channel 1 统一改为红色
nrrdTools.setAllLayersChannelColor(1, { r: 255, g: 0, b: 0, a: 255 });
```

---

**场景 4：读取当前颜色**

```typescript
// 读取 layer2 的 channel 3 当前颜色
const rgba = nrrdTools.getChannelColor('layer2', 3);
// → { r: 255, g: 128, b: 0, a: 255 }

const hex = nrrdTools.getChannelHexColor('layer2', 3);
// → "#ff8000"  (用于 canvas fillStyle 或 CSS color)

const css = nrrdTools.getChannelCssColor('layer2', 3);
// → "rgba(255,128,0,1.00)"  (用于 Vue style binding)
```

---

**场景 5：重置颜色**

```typescript
// 重置 layer2 的 channel 3 为默认颜色
nrrdTools.resetChannelColors('layer2', 3);

// 重置 layer2 的所有 channel 为默认颜色
nrrdTools.resetChannelColors('layer2');

// 重置所有 layer 的所有 channel 为默认颜色
nrrdTools.resetChannelColors();
```

---

**场景 6：设置颜色后通知 Vue UI 刷新**

颜色修改后，canvas 会立即重渲染（`reloadMasksFromVolume()` 自动调用）。
但 Vue UI 中的 channel 颜色卡片（`LayerChannelSelector.vue`）需要手动触发刷新：

```typescript
// 在 Vue 组件中，拿到 composable 的 refreshChannelColors
const { refreshChannelColors } = useLayerChannel({ nrrdTools });

// 设置颜色后调用 refresh，让 Vue UI 同步更新颜色显示
nrrdTools.setChannelColor('layer2', 3, { r: 255, g: 128, b: 0, a: 255 });
refreshChannelColors();   // 递增 colorVersion → 触发 dynamicChannelConfigs 重计算
```

或者监听 `onChannelColorChanged` 回调来自动刷新：

```typescript
// 在初始化时注册回调（nrrd_states 是 NrrdTools 内部状态，需通过 draw() 选项设置）
// ⚠️ 目前 onChannelColorChanged 挂载在 nrrd_states 上，暂不支持直接从外部设置
// 推荐方式：手动在 setChannelColor() 后调用 refreshChannelColors()
```

---

**场景 7：完整的初始化+颜色设置示例（Vue 组件中）**

```typescript
// LeftPanelCore.vue 或其他父组件
import emitter from '@/plugins/custom-emitter';

// 图像加载完成后（onFinishLoadAllCaseImages 事件）
const nrrdTools = ref<Copper.NrrdTools>();

emitter.on('Core:NrrdTools', (tools) => {
  nrrdTools.value = tools;
});

emitter.on('Segmentation:FinishLoadAllCaseImages', () => {
  // 此时 setAllSlices() 已调用完毕，MaskVolume 已初始化，可以安全设置颜色
  if (!nrrdTools.value) return;

  // 为 layer1 设置自定义颜色方案
  nrrdTools.value.setChannelColors('layer1', {
    1: { r: 255, g: 80,  b: 80,  a: 255 },   // 浅红
    2: { r: 80,  g: 180, b: 255, a: 255 },   // 浅蓝
  });

  // layer2 保持默认颜色，无需操作
});
```

---

**颜色值范围**

`RGBAColor` 各字段取值 `0-255`（整数）：

```typescript
interface RGBAColor {
  r: number;  // 0-255
  g: number;  // 0-255
  b: number;  // 0-255
  a: number;  // 0-255，255 = 完全不透明，0 = 完全透明
}
```

Channel `a`（alpha）决定 mask 的不透明度基准值。通常设为 `255`，实际渲染时还会乘以 `gui_states.drawing.globalAlpha`（默认 0.6）。

### 2.3 Keyboard & History

> **实现**: 直接在 NrrdTools Facade 中（分区 4）。

| 方法 | 签名 | 说明 |
|------|------|------|
| `undo` | `(): void` | 撤销上一次绘画操作 |
| `redo` | `(): void` | 重做上一次撤销的操作 |
| `enterKeyboardConfig` | `(): void` | 进入键盘配置模式（抑制所有快捷键） |
| `exitKeyboardConfig` | `(): void` | 退出键盘配置模式 |
| `setContrastShortcutEnabled` | `(enabled: boolean): void` | 启用/禁用 Contrast 快捷键 |
| `isContrastShortcutEnabled` | `(): boolean` | Contrast 快捷键是否启用 |
| `setKeyboardSettings` | `(settings: Partial<IKeyBoardSettings>): void` | 更新键盘快捷键绑定 |
| `getKeyboardSettings` | `(): IKeyBoardSettings` | 获取当前键盘设置快照 |

### 2.4 Data Loading

> **实现**: `tools/DataLoader.ts`，NrrdTools 中一行委托。

| 方法 | 签名 | 说明 |
|------|------|------|
| `setAllSlices` | `(allSlices: Array<nrrdSliceType>): void` | **入口函数**：加载 NRRD 切片，初始化所有 MaskVolume 到正确尺寸 |
| `setMasksData` | `(masksData, loadingBar?): void` | 旧版加载方法（Legacy，待移除） |
| `setMasksFromNIfTI` | `(layerVoxels: Map<string, Uint8Array>, loadingBar?): void` | 从 NIfTI 文件加载 mask 到 MaskVolume |

### 2.5 Display & Rendering

> **实现**: `tools/SliceRenderPipeline.ts`，NrrdTools 中一行委托。

| 方法 | 签名 | 说明 |
|------|------|------|
| `resizePaintArea` | `(factor: number): void` | 调整画布缩放 |
| `reloadMasksFromVolume` | `(): void` (private) | **核心重渲染**：从 MaskVolume 重新渲染所有 Layer 到 Canvas |
| `flipDisplayImageByAxis` | `(): void` | 翻转 CT 图像以正确显示 |
| `redrawDisplayCanvas` | `(): void` | 重绘 contrast 图像到 displayCanvas |
| `setEmptyCanvasSize` | `(axis?): void` | 根据 axis 设置 emptyCanvas 尺寸 |

### 2.6 Programmatic Sphere Placement

| 方法 | 签名 | 说明 |
|------|------|------|
| `setCalculateDistanceSphere` | `(x: number, y: number, sliceIndex: number, cal_position: SphereType): void` | 编程式放置 calculator sphere，模拟完整的鼠标点击流程 |

**参数**:
- `x`, `y` — 未缩放的图像空间坐标（方法内部会自动乘以 `sizeFactor`）
- `sliceIndex` — 目标切片索引
- `cal_position` — Sphere 类型: `"tumour"` / `"skin"` / `"nipple"` / `"ribcage"`

**内部流程** (模拟 `DrawToolCore.handleSphereClick` + `pointerup`):

```
setCalculateDistanceSphere(x, y, sliceIndex, cal_position)
  │
  ├─ sphereRadius = 5
  ├─ setSliceMoving(...)                          → 导航到目标切片
  │
  ├─ --- simulate mouse-down ---
  │  ├─ mouseX = x * sizeFactor
  │  ├─ sphereOrigin[axis] = [mouseX, mouseY, sliceIndex]
  │  ├─ crosshairTool.setUpSphereOrigins(...)     → 计算三轴 origin
  │  ├─ tumourSphereOrigin = deepCopy(sphereOrigin)  → 按 cal_position 存储
  │  └─ drawCalculatorSphere(radius)              → 绘制预览
  │
  └─ --- simulate mouse-up ---
     ├─ sphereTool.writeAllCalculatorSpheresToVolume()  → 写入 sphereMaskVolume
     └─ sphereTool.refreshSphereCanvas()               → 重渲染 overlay
```

**典型用法** (后端返回 sphere 坐标后调用):

```typescript
// 后端 AI 检测到 tumour 位置后，自动放置 sphere
nrrdTools.setCalculateDistanceSphere(120, 95, 42, 'tumour');
nrrdTools.setCalculateDistanceSphere(200, 150, 42, 'skin');
```

### 2.7 其他 API

> **实现**: 直接在 NrrdTools Facade 中（分区 5 View Control、分区 6 Data Getters）。

| 方法 | 说明 |
|------|------|
| `drag(opts?)` | 启用拖拽切片功能 |
| `setBaseDrawDisplayCanvasesSize(size)` | 设置 Canvas 基础尺寸 (1-8) |
| `setupGUI(gui)` | 设置 dat.gui 面板 |
| `enableContrastDragEvents(callback)` | 启用 contrast 拖拽事件 |
| `getCurrentImageDimension()` | 获取图像体素维度 `[w, h, d]` |
| `getVoxelSpacing()` | 获取体素间距 (mm) |
| `getSpaceOrigin()` | 获取世界坐标系原点 |
| `getMaxSliceNum()` | 获取各轴最大切片数 |
| `getCurrentSlicesNumAndContrastNum()` | 获取当前切片索引和 contrast 索引 |
| `getMaskData()` | 获取 `IMaskData` 原始数据结构 |
| `getContainer()` | 获取内部主区域容器 |
| `getDrawingCanvas()` | 获取顶层交互 Canvas |
| `getNrrdToolsSettings()` | 获取完整 NrrdState 快照（5 个子对象） |

---

## 3. States（状态）

### 3.1 nrrd_states (NrrdState)

**类型**: `NrrdState` class（定义: [coreTools/NrrdState.ts](annotator-frontend/src/ts/Utils/segmentation/coreTools/NrrdState.ts)）
**接口**: `INrrdStates` extends `IImageMetadata`, `IViewState`, `IInteractionState`, `ISphereState`, `IInternalFlags`（定义: [core/types.ts](annotator-frontend/src/ts/Utils/segmentation/core/types.ts)）

NrrdState 将 44 个属性分组为 5 个语义子对象：

#### nrrd_states.image (IImageMetadata)
| 字段 | 类型 | 说明 |
|------|------|------|
| `dimensions` | `[width, height, depth]` | 体素维度 |
| `nrrd_x_pixel` / `y` / `z` | `number` | 各轴像素数 |
| `voxelSpacing` | `number[]` | 体素间距 |
| `spaceOrigin` | `number[]` | 空间原点 |
| `layers` | `string[]` | Layer ID 列表 |

#### nrrd_states.view (IViewState)
| 字段 | 类型 | 说明 |
|------|------|------|
| `currentSliceIndex` | `number` | 当前切片索引 |
| `maxIndex` / `minIndex` | `number` | 切片索引范围 |
| `changedWidth` / `changedHeight` | `number` | Canvas 显示尺寸 |
| `sizeFactor` | `number` | 缩放因子 |
| `originWidth` / `originHeight` | `number` | 原始图像尺寸 |

#### nrrd_states.interaction (IInteractionState)
| 字段 | 类型 | 说明 |
|------|------|------|
| `mouseOverX` / `mouseOverY` | `number` | 鼠标位置 |
| `mouseOver` | `boolean` | 鼠标是否在画布上 |
| `cursorPageX` / `cursorPageY` | `number` | 光标页面坐标 |
| `drawStartPos` | `ICommXY` | 绘画起始点 |

#### nrrd_states.sphere (ISphereState)
| 字段 | 类型 | 说明 |
|------|------|------|
| `sphereOrigin` / `skinSphereOrigin` 等 | `ICommXYZ \| null` | 各类型 sphere 原点 |
| `sphereRadius` | `number` | sphere 半径 |
| `sphereMaskVolume` | `MaskVolume \| null` | sphere 体积数据 |

#### nrrd_states.flags (IInternalFlags)
| 字段 | 类型 | 说明 |
|------|------|------|
| `stepClear` | `number` | 清除步长（内部用） |
| `clearAllFlag` | `boolean` | 当前是否为全层清除操作 |
| `loadingMaskData` | `boolean` | 是否正在加载 mask 数据 |

> ⚠️ `loadMaskByDefault` 和 `isCalcContrastByDrag` 字段**已不存在**，文档之前有误。

> ⚠️ `INrrdStates` 扁平接口保留用于向后兼容（extends 所有 5 个子接口），但运行时使用 `NrrdState` 类实例，属性通过 `nrrd_states.image.xxx`、`nrrd_states.view.xxx` 等访问。

### 3.2 gui_states (GuiState)

**类型**: `GuiState` class（定义: [coreTools/GuiState.ts](annotator-frontend/src/ts/Utils/segmentation/coreTools/GuiState.ts)）
**接口**: `IGUIStates` extends `IToolModeState`, `IDrawingConfig`, `IViewConfig`, `ILayerChannelState`（定义: [core/types.ts](annotator-frontend/src/ts/Utils/segmentation/core/types.ts)）

GuiState 将 20 个属性分组为 4 个语义子对象：

#### gui_states.mode (IToolModeState)
| 字段 | 类型 | 说明 |
|------|------|------|
| `pencil` | `boolean` | 铅笔工具激活 |
| `eraser` | `boolean` | 橡皮擦工具激活 |
| `sphere` | `boolean` | 球体工具激活 |
| `activeSphereType` | `"tumour" \| "skin" \| "nipple" \| "ribcage"` | 当前 sphere 类型 |

#### gui_states.drawing (IDrawingConfig)
| 字段 | 类型 | 说明 |
|------|------|------|
| `globalAlpha` | `number` | 全局透明度 (0.6) |
| `lineWidth` | `number` | 线宽 |
| `color` / `fillColor` / `brushColor` | `string` | 画笔颜色 (Hex) |
| `brushAndEraserSize` | `number` | 画笔/橡皮擦大小 |

#### gui_states.viewConfig (IViewConfig)
| 字段 | 类型 | 说明 |
|------|------|------|
| `mainAreaSize` | `number` | 主区域大小 |
| `dragSensitivity` | `number` | 拖拽灵敏度 |
| `cursor` / `defaultPaintCursor` | `string` | 光标样式 |
| `readyToUpdate` | `boolean` | 准备更新标志 |

#### gui_states.layerChannel (ILayerChannelState)
| 字段 | 类型 | 说明 |
|------|------|------|
| `layer` | `string` | 当前活跃 Layer (默认 `"layer1"`) |
| `activeChannel` | `number` | 当前活跃 Channel (1-8) |
| `layerVisibility` | `Record<string, boolean>` | Layer 可见性 |
| `channelVisibility` | `Record<string, Record<number, boolean>>` | Channel 可见性 |

### 3.3 protectedData (IProtected)

定义位置: [CanvasState.ts](annotator-frontend/src/ts/Utils/segmentation/CanvasState.ts) constructor

| 字段 | 说明 |
|------|------|
| `axis` | 当前视图轴 `"x"` / `"y"` / `"z"` |
| `maskData.volumes` | `Record<string, MaskVolume>` — 每个 Layer 对应的 3D 体积 |
| `layerTargets` | `Map<string, ILayerRenderTarget>` — 每个 Layer 的 canvas+ctx |
| `canvases` | 5 个系统 Canvas |
| `ctxes` | 对应的 2D Context |
| `isDrawing` | 当前是否正在绘画 |

> ⚠️ `Is_Shift_Pressed` / `Is_Ctrl_Pressed` 已删除，键盘修饰键状态现在由 `EventRouter` 内部管理，不再暴露到 `protectedData`。

---

## 4. Callbacks

### 4.1 onMaskChanged / getMaskData (后端同步)

存储位置: `CanvasState.annotationCallbacks.onMaskChanged`（`IAnnotationCallbacks` 接口）

> ⚠️ **注意**: 原文档中的 `nrrd_states.getMask` 字段已不存在。外部通过 `nrrdTools.draw({ getMaskData: ... })` 注册，内部映射到 `annotationCallbacks.onMaskChanged`。

```ts
// IAnnotationCallbacks 接口 (core/types.ts)
onMaskChanged: (
  sliceData: Uint8Array,    // 当前切片的原始体素数据
  layerId: string,          // layer 名
  channelId: number,        // active channel
  sliceIndex: number,       // 切片索引
  axis: "x" | "y" | "z",   // 当前轴
  width: number,            // 切片宽度
  height: number,           // 切片高度
  clearFlag: boolean        // 是否为清除操作
) => void
```

**调用时机**: 每次绘画结束（mouseup）、undo/redo 之后。

### 4.2 onLayerVolumeCleared

存储位置: `CanvasState.annotationCallbacks.onLayerVolumeCleared`

```ts
onLayerVolumeCleared: (layerId: string) => void
```

### 4.3 onChannelColorChanged（Phase B 新增）

存储位置: `CanvasState.annotationCallbacks.onChannelColorChanged`（`IAnnotationCallbacks` 接口，`core/types.ts`）

> ⚠️ **注意**: 原文档说定义在 `INrrdStates` 上，**已不正确**。该回调现在属于 `IAnnotationCallbacks`，存储在 `CanvasState.annotationCallbacks` 中，不在 `nrrd_states` 上。

```ts
onChannelColorChanged: (layerId: string, channel: number, color: RGBAColor) => void
```

**调用时机**: `NrrdTools.setChannelColor()` 修改颜色后触发。默认空实现，暂不支持从外部直接注册（推荐通过 `setChannelColor()` 后手动调用 `refreshChannelColors()` 刷新 Vue UI）。

### 4.4 onSphereChanged / onCalculatorPositionsChanged

存储位置: `CanvasState.annotationCallbacks`（`IAnnotationCallbacks`，外部通过 `draw()` 注册）

**`onSphereChanged`** (`getSphereData` in `IDrawOpts`): Sphere 模式下左键松开时调用。

```ts
onSphereChanged: (sphereOrigin: number[], sphereRadius: number) => void
// sphereOrigin = [mouseX, mouseY, sliceIndex] — z-axis 坐标
// sphereRadius = 半径 (1-50 像素)
```

**`onCalculatorPositionsChanged`** (`getCalculateSpherePositionsData` in `IDrawOpts`): Sphere 模式下放置 sphere 后调用（所有类型通用）。

```ts
onCalculatorPositionsChanged: (
  tumourSphereOrigin: ICommXYZ | null,  // channel 1
  skinSphereOrigin: ICommXYZ | null,    // channel 4
  ribSphereOrigin: ICommXYZ | null,     // channel 3
  nippleSphereOrigin: ICommXYZ | null,  // channel 2
  axis: "x" | "y" | "z"
) => void
// 每个 origin 为 { x: [mx, my, slice], y: [...], z: [...] }
// null 表示该类型尚未放置
```

**Channel 映射** (exported as `SPHERE_CHANNEL_MAP`):

| Sphere Type | Layer  | Channel | 颜色 |
|-------------|--------|---------|------|
| tumour      | layer1 | 1       | `#10b981` (Emerald) |
| nipple      | layer1 | 2       | `#f43f5e` (Rose) |
| ribcage     | layer1 | 3       | `#3b82f6` (Blue) |
| skin        | layer1 | 4       | `#fbbf24` (Amber) |

> ⚠️ 当前 sphere 数据不写入 layer MaskVolume，仅作为 overlay 显示。Channel 映射预留供未来使用。

---

## 5. MaskVolume 存储与渲染

### 5.1 内存布局

**文件**: [core/MaskVolume.ts](annotator-frontend/src/ts/Utils/segmentation/core/MaskVolume.ts)

```
内存布局: [z][y][x][channel]
index = z * bytesPerSlice + y * width * channels + x * channels + channel
bytesPerSlice = width * height * channels
```

底层数据结构: 单一连续 `Uint8Array`

### 5.2 各轴切片维度

定义: [MaskVolume.ts:1117-1126](annotator-frontend/src/ts/Utils/segmentation/core/MaskVolume.ts#L1117-L1126)

| 轴 | 切片宽度 | 切片高度 | 说明 |
|----|---------|---------|------|
| z (Axial) | width | height | 最常用，连续内存 |
| y (Coronal) | width | depth | 按行提取 |
| x (Sagittal) | depth | height | 逐像素提取，最慢 |

对应 emptyCanvas 尺寸设置: `SliceRenderPipeline.setEmptyCanvasSize()` → [tools/SliceRenderPipeline.ts](annotator-frontend/src/ts/Utils/segmentation/tools/SliceRenderPipeline.ts)（已从 NrrdTools 提取）

### 5.3 切片提取 (读取 Mask)

**`getSliceUint8(sliceIndex, axis)`** — [MaskVolume.ts:1019-1058](annotator-frontend/src/ts/Utils/segmentation/core/MaskVolume.ts#L1019-L1058)

返回原始 `Uint8Array`，用于：
- 后端同步 (`getMask` callback)
- Undo/Redo 快照

各轴实现：
- **Z 轴** [L1032-1035](annotator-frontend/src/ts/Utils/segmentation/core/MaskVolume.ts#L1032-L1035): 连续内存 `subarray` 批量复制（最快）
- **Y 轴** [L1036-1042](annotator-frontend/src/ts/Utils/segmentation/core/MaskVolume.ts#L1036-L1042): 按行迭代复制
- **X 轴** [L1043-1055](annotator-frontend/src/ts/Utils/segmentation/core/MaskVolume.ts#L1043-L1055): 逐像素提取（最慢）

### 5.4 切片写入

**`setSliceUint8(sliceIndex, data, axis)`** — [MaskVolume.ts:1072-1108](annotator-frontend/src/ts/Utils/segmentation/core/MaskVolume.ts#L1072-L1108)

`getSliceUint8` 的逆操作，用于 Undo/Redo 恢复。

**`setSliceLabelsFromImageData(sliceIndex, imageData, axis, activeChannel, channelVisible?)`** — [MaskVolume.ts:575-661](annotator-frontend/src/ts/Utils/segmentation/core/MaskVolume.ts#L575-L661)

Canvas→Volume 写入，将 RGBA 像素转换为 channel label (1-8)。
- 构建 RGB→Channel 映射 [L593](annotator-frontend/src/ts/Utils/segmentation/core/MaskVolume.ts#L593)
- ALPHA_THRESHOLD = 128 [L601](annotator-frontend/src/ts/Utils/segmentation/core/MaskVolume.ts#L601) 避免抗锯齿边缘

### 5.5 渲染到 Canvas

**核心渲染方法: `renderLabelSliceInto()`** — [MaskVolume.ts:695-770](annotator-frontend/src/ts/Utils/segmentation/core/MaskVolume.ts#L695-L770)

```ts
renderLabelSliceInto(
  sliceIndex: number,
  axis: 'x' | 'y' | 'z',
  target: ImageData,              // 预分配的 ImageData buffer
  channelVisible?: Record<number, boolean>,  // Channel 可见性
  opacity: number = 1.0
): void
```

渲染逻辑:
1. 读取 label 值 (0-8)
2. `label === 0` → 透明 (RGBA 全 0)
3. `channelVisible && !channelVisible[label]` → 隐藏该 Channel → 透明
4. 否则 → 从 volume 的 `colorMap` 取颜色（支持 per-layer 自定义颜色），应用 opacity

> **Phase B 变更**: 颜色来源从全局 `MASK_CHANNEL_COLORS` 改为每个 volume 实例的 `this.colorMap`。`buildRgbToChannelMap()` 也改为 instance 方法，确保 canvas→volume 写回时使用正确的自定义颜色映射。

### 5.6 渲染管线完整流程

**入口: `reloadMasksFromVolume()`** — `SliceRenderPipeline.reloadMasksFromVolume()` → [tools/SliceRenderPipeline.ts](annotator-frontend/src/ts/Utils/segmentation/tools/SliceRenderPipeline.ts)（已从 NrrdTools 提取，NrrdTools 中为 private 委托）

```
reloadMasksFromVolume()
  │
  ├─ getOrCreateSliceBuffer(axis)          → 获取/创建可复用的 ImageData buffer
  │   [RenderingUtils.ts]
  │
  ├─ FOR EACH layer:
  │   ├─ target.ctx.clearRect(...)         → 清空 layer canvas
  │   └─ renderSliceToCanvas(layerId, axis, sliceIndex, buffer, target.ctx, w, h)
  │       [RenderingUtils.ts]
  │       │
  │       ├─ volume.renderLabelSliceInto(sliceIndex, axis, buffer, channelVis)
  │       │   [MaskVolume.ts]              → 渲染体素到 buffer
  │       │
  │       ├─ emptyCtx.putImageData(buffer) → 放到 emptyCanvas
  │       │   [RenderingUtils.ts]
  │       │
  │       └─ targetCtx.drawImage(emptyCanvas, ...) → 绘制到 layer canvas
  │           [RenderingUtils.ts]
  │           ⚠️ 注意：冠状面（axis='y'）会做 scale(1,-1) 垂直翻转（详见 §6.2）
  │
  └─ compositeAllLayers()                  → 合成到 master canvas
      [RenderingUtils.ts]
      │
      ├─ masterCtx.clearRect(...)
      └─ FOR EACH layer:
          ├─ if !layerVisibility[layerId] → skip
          └─ masterCtx.drawImage(layerCanvas)
```

---

## 6. 翻转 (Flip) 机制

### 6.1 Display 翻转（仅 CT/MRI 图像）

**`flipDisplayImageByAxis()`** — `SliceRenderPipeline.flipDisplayImageByAxis()` → [tools/SliceRenderPipeline.ts](annotator-frontend/src/ts/Utils/segmentation/tools/SliceRenderPipeline.ts)（已从 NrrdTools 提取）

因为 Three.js 渲染的切片不在正确的 2D 位置，需要翻转 displayCanvas：

| 轴 | 翻转方式 |
|----|---------|
| x (Sagittal) | `scale(-1, -1)` + `translate(-w, -h)` |
| y (Coronal) | `scale(1, -1)` + `translate(0, -h)` |
| z (Axial) | `scale(1, -1)` + `translate(0, -h)` |

调用位置: `SliceRenderPipeline.redrawDisplayCanvas()` → 内部调用 `flipDisplayImageByAxis()`

### 6.2 Mask 翻转（仅冠状面）

**重要**: `renderSliceToCanvas()`（RenderingUtils.ts）中 Mask 渲染**对冠状面（axis='y'）做垂直翻转**：

```ts
// RenderingUtils.renderSliceToCanvas() — Y 轴翻转：
if (axis === 'y') {
  targetCtx.save();
  targetCtx.scale(1, -1);
  targetCtx.translate(0, -scaledHeight);
}
targetCtx.drawImage(emptyCanvas, 0, 0, scaledWidth, scaledHeight);
if (axis === 'y') {
  targetCtx.restore();
}
```

| 轴 | Mask 翻转 | 说明 |
|----|---------|------|
| z (Axial) | **无翻转** | 存储坐标与 Three.js 切片一致 |
| y (Coronal) | **垂直翻转** `scale(1,-1)` | 与写入路径（syncLayerSliceData）的翻转对消，保证跨轴显示一致 |
| x (Sagittal) | **无翻转** | 存储坐标与 Three.js 切片一致 |

> ⚠️ 原文档描述"Mask 不翻转"已过时。冠状面引入了 Y 轴翻转以修复跨轴切片对齐 bug。

### 6.3 applyMaskFlipForAxis（辅助方法）

`RenderingUtils.applyMaskFlipForAxis()` — 提供与 `flipDisplayImageByAxis()` 相同的翻转变换，可供需要手动对齐坐标的场景使用。目前在主渲染路径中的具体冠状面翻转已内联到 `renderSliceToCanvas()`。

---

## 7. Tools（工具）

位置: `annotator-frontend/src/ts/Utils/segmentation/tools/`

所有 Tool / 模块继承自 `BaseTool`:

**BaseTool** — [tools/BaseTool.ts](annotator-frontend/src/ts/Utils/segmentation/tools/BaseTool.ts)

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

### 7.1 Tool 列表

> **ToolHost 统一接口（已完成）**: 所有 Tool 的宿主方法依赖已统一到 `tools/ToolHost.ts` 中的 `ToolHost` 接口。每个 Tool 通过 `Pick<ToolHost, ...>` 类型别名（如 `SphereHostDeps`、`DrawingHostDeps`）声明所需方法子集，构造函数接收该子集类型的 callbacks 参数。原先的 10 个独立 `*Callbacks` 接口已全部删除。

#### NrrdTools 提取模块（God Class Split）

这三个模块由 `NrrdTools.initNrrdToolsModules()` 初始化，通过 `ToolContext` + `Pick<ToolHost, ...>` 类型与 NrrdTools 解耦：

| 模块 | 文件 | 行数 | HostDeps 类型 |
|------|------|------|---------------|
| **LayerChannelManager** | [tools/LayerChannelManager.ts](annotator-frontend/src/ts/Utils/segmentation/tools/LayerChannelManager.ts) | 211 | `LayerChannelHostDeps` (3 methods: `reloadMasksFromVolume`, `getVolumeForLayer`, `onChannelColorChanged`) |
| **SliceRenderPipeline** | [tools/SliceRenderPipeline.ts](annotator-frontend/src/ts/Utils/segmentation/tools/SliceRenderPipeline.ts) | 453 | `SliceRenderHostDeps` (10 methods) |
| **DataLoader** | [tools/DataLoader.ts](annotator-frontend/src/ts/Utils/segmentation/tools/DataLoader.ts) | 222 | `DataLoaderHostDeps` (7 methods) |

#### DrawToolCore 管理的 Tool（事件处理）

这些 Tool 由 `DrawToolCore.initTools()` 初始化，处理用户交互事件：

| Tool | 文件 | HostDeps 类型 | 说明 |
|------|------|---------------|------|
| **SphereTool** | [tools/SphereTool.ts](annotator-frontend/src/ts/Utils/segmentation/tools/SphereTool.ts) | `SphereHostDeps` | 3D 球形标注工具，支持 4 种类型 (tumour/skin/ribcage/nipple)，包含点击放置 (`onSphereClick`) 和松开完成 (`onSpherePointerUp`) |
| **CrosshairTool** | [tools/CrosshairTool.ts](annotator-frontend/src/ts/Utils/segmentation/tools/CrosshairTool.ts) | —（无 callbacks） | 十字准星位置标记、坐标转换、crosshair 渲染 (`renderCrosshair`) |
| **ContrastTool** | [tools/ContrastTool.ts](annotator-frontend/src/ts/Utils/segmentation/tools/ContrastTool.ts) | `ContrastHostDeps` | 窗位/窗宽调节 |
| **ZoomTool** | [tools/ZoomTool.ts](annotator-frontend/src/ts/Utils/segmentation/tools/ZoomTool.ts) | `ZoomHostDeps` | 缩放/平移 |
| **EraserTool** | [tools/EraserTool.ts](annotator-frontend/src/ts/Utils/segmentation/tools/EraserTool.ts) | —（无 callbacks） | 橡皮擦 |
| **PanTool** | [tools/PanTool.ts](annotator-frontend/src/ts/Utils/segmentation/tools/PanTool.ts) | `PanHostDeps` | 右键拖拽平移画布 |
| **DrawingTool** | [tools/DrawingTool.ts](annotator-frontend/src/ts/Utils/segmentation/tools/DrawingTool.ts) | `DrawingHostDeps` | 铅笔/画笔/橡皮擦绘画逻辑，含笔刷 hover 追踪 (`createBrushTrackingHandler`) 和圆圈预览 (`renderBrushPreview`) |
| **ImageStoreHelper** | [tools/ImageStoreHelper.ts](annotator-frontend/src/ts/Utils/segmentation/tools/ImageStoreHelper.ts) | `ImageStoreHostDeps` | Canvas↔Volume 同步 |
| **DragSliceTool** | [tools/DragSliceTool.ts](annotator-frontend/src/ts/Utils/segmentation/tools/DragSliceTool.ts) | `DragSliceHostDeps` | 拖拽切换切片 |

Tool 初始化: [DrawToolCore.ts](annotator-frontend/src/ts/Utils/segmentation/DrawToolCore.ts) `initTools()` 方法

### 7.2 ImageStoreHelper（关键工具）

**`storeAllImages(index, layer)`** — [ImageStoreHelper.ts:116-178](annotator-frontend/src/ts/Utils/segmentation/tools/ImageStoreHelper.ts#L116-L178)

Canvas → Volume 同步流程:
1. 将 layer canvas 绘制到 emptyCanvas [L124]
2. 从 emptyCanvas 获取 ImageData [L127-132]
3. 调用 `volume.setSliceLabelsFromImageData()` [L142-148] 写入 MaskVolume
4. 提取切片通知后端 [L161]

**`filterDrawedImage(axis, sliceIndex)`** — [ImageStoreHelper.ts:85-107](annotator-frontend/src/ts/Utils/segmentation/tools/ImageStoreHelper.ts#L85-L107)

Volume → Canvas 读取，调用 `volume.renderLabelSliceInto()`.

### 7.3 SphereTool（球形标注工具）

**文件**: [tools/SphereTool.ts](annotator-frontend/src/ts/Utils/segmentation/tools/SphereTool.ts)

#### 类型与常量

```ts
type SphereType = 'tumour' | 'skin' | 'nipple' | 'ribcage';

const SPHERE_CHANNEL_MAP: Record<SphereType, { layer: string; channel: number }>;
// SPHERE_COLORS 已删除 — 颜色改为从各 volume 的 colorMap 动态获取
const SPHERE_LABELS: Record<SphereType | 'default', number>;
```

#### 辅助方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `getChannelForSphereType` | `(type: SphereType): number` | 获取 sphere 类型对应的 channel 号 |
| `getLayerForSphereType` | `(type: SphereType): string` | 获取 sphere 类型对应的 layer ID |
| `getColorForSphereType` | `(type: SphereType): string` | 获取 sphere 类型对应的预览颜色 |

#### 交互方法（从 DrawToolCore 提取）

| 方法 | 签名 | 说明 |
|------|------|------|
| `onSphereClick` | `(e: MouseEvent): void` | 左键点击：记录 origin、存储类型 origin、启用 crosshair、绘制预览圆。事件绑定（wheel/pointerup）留在 DrawToolCore |
| `onSpherePointerUp` | `(): void` | 左键松开：写入所有 sphere 到 volume、刷新 overlay、触发 `onSphereChanged` + `onCalculatorPositionsChanged` 回调。事件清理留在 DrawToolCore |

#### SphereHostDeps 类型（Pick<ToolHost, ...>）

```ts
// tools/ToolHost.ts
type SphereHostDeps = Pick<ToolHost,
  'setEmptyCanvasSize' | 'drawImageOnEmptyImage' | 'enableCrosshair' | 'setUpSphereOrigins'
>;
```

#### 使用边界

Sphere 模式激活时：
- ❌ **Shift 键被禁用** — 不能进入 draw 模式
- ✅ **Crosshair 切换可用** (S 键)
- ❌ **clearPaint 不通知后端**
- ❌ **Contrast 模式被阻止**

#### 交互流程

```
左键按下 → 根据 activeSphereType 记录 origin → activeWheelMode = 'sphere' → 绘制预览圆
           (tumour/skin/nipple/ribcage 各自存储 origin)
滚轮 (左键按住) → EventRouter wheel 派发到 handleSphereWheel → sphereRadius ±1 [1, 50] → 重绘
左键松开 → 写入所有已放置 sphere 到 volume → 触发 getSphere + getCalculateSpherePositions → activeWheelMode = 'zoom'
```

#### SphereMaskVolume

独立 `MaskVolume`，存储 sphere 3D 数据，不污染 layer draw mask。

| 生命周期 | 位置 | 操作 |
|---------|------|------|
| 创建 | `NrrdTools.setAllSlices()` | `new MaskVolume(vw, vh, vd, 1)` |
| 清空 | `NrrdTools.reset()` | `sphereMaskVolume = null` |
| 存储 | `nrrd_states.sphereMaskVolume` | — |

### 7.4 PanTool（右键平移工具）

**文件**: [tools/PanTool.ts](annotator-frontend/src/ts/Utils/segmentation/tools/PanTool.ts) — 124 lines

从 `DrawToolCore.paintOnCanvas()` 提取（Phase 2, 2026-02-26）。处理所有右键拖拽平移逻辑。

#### PanHostDeps 类型（Pick<ToolHost, ...>）

```ts
// tools/ToolHost.ts
type PanHostDeps = Pick<ToolHost, 'zoomActionAfterDrawSphere'>;
```

> ⚠️ 原文档中的 `getPanelOffset` / `setPanelOffset` 回调**已不存在**。PanTool 现在直接通过 `canvas.offsetLeft` / `canvas.offsetTop` 读取偏移，无需外部回调。

#### 关键属性与方法

| 成员 | 说明 |
|------|------|
| `rightClicked: boolean` | 右键是否按下 |
| `panMoveInnerX/Y: number` | 平移拖拽起始位置偏移（clientX − canvas.offsetLeft） |
| `isActive: boolean` (getter) | 是否正在平移（用于 DrawToolCore re-entry guard）|
| `onPointerDown(e)` | 右键按下：记录起始偏移，更改光标为 grab |
| `onPointerMove(e)` | 拖拽中：计算并更新 canvas 位置 |
| `onPointerUp(e)` | 右键松开：清理状态，恢复光标 |
| `onPointerLeave()` | canvas 离开：清理状态 |

#### 与 DrawToolCore 集成

```ts
// DrawToolCore.initTools()
this.panTool = new PanTool(toolCtx, {
  zoomActionAfterDrawSphere: () => this.zoomActionAfterDrawSphere(),
});

// handleOnDrawingMouseDown — right-click branch
this.panTool.onPointerDown(e);
// pointerup permanently routed by EventRouter

// handleOnDrawingMouseUp — right-click branch
this.panTool.onPointerUp(e);

// handlePointerLeave (registered once via EventRouter)
this.panTool.onPointerLeave();
```

---

### 7.5 DrawingTool（绘画工具）

**文件**: [tools/DrawingTool.ts](annotator-frontend/src/ts/Utils/segmentation/tools/DrawingTool.ts) — 284 lines

从 `DrawToolCore.paintOnCanvas()` 提取（Phase 3, 2026-02-26）。处理铅笔、画笔、橡皮擦的所有绘画逻辑，包含 Undo 快照。

#### DrawingHostDeps 类型（Pick<ToolHost, ...>）

```ts
// tools/ToolHost.ts
type DrawingHostDeps = Pick<ToolHost,
  'setCurrentLayer' | 'compositeAllLayers' | 'syncLayerSliceData'
  | 'filterDrawedImage' | 'getVolumeForLayer' | 'pushUndoDelta' | 'getEraserUrls'
>;
```

#### 关键属性与方法

| 成员 | 说明 |
|------|------|
| `leftClicked: boolean` | 左键是否按下 |
| `isPainting: boolean` | 是否正在绘画（mousedown 到 mouseup 期间）|
| `drawingLines: ICommXY[]` | 铅笔模式路径点集合 |
| `clearArcFn` | 当前帧的橡皮擦函数（由 `reset()` 注入）|
| `preDrawSlice/Axis/SliceIndex` | mousedown 时的 undo 快照数据 |
| `isActive: boolean` (getter) | 暴露 `leftClicked`，用于 DrawToolCore re-entry guard |
| `painting: boolean` (getter) | 暴露 `isPainting`，用于 mouseUp 条件判断 |
| `reset(clearArcFn)` | 每次 `paintOnCanvas()` 调用时重置状态并注入新橡皮擦函数 |
| `onPointerDown(e)` | 左键按下：设置光标、初始化路径、capturePreDrawSnapshot |
| `onPointerMove(e)` | 移动：橡皮擦分支用 clearArcFn，绘画分支积累路径并调用 paintOnCanvasLayer |
| `onPointerUp(e)` | 左键松开：铅笔 fill/画笔 closePath、syncLayerSliceData、pushUndoDelta |
| `onPointerLeave()` | canvas 离开：重置状态，**返回 `boolean`** 表示是否有未完成绘画 |
| `createBrushTrackingHandler()` | 返回 mouseover/mouseout/mousemove handler，追踪 mouseOverX/Y 和 mouseOver 状态 |
| `renderBrushPreview(ctx, w, h)` | 在 draw 模式渲染笔刷圆圈预览（start() render loop 调用） |

#### onPointerLeave 返回值约定

`onPointerLeave()` 返回 `true` 表示用户正在绘画时离开（即 DrawToolCore 需要恢复 wheel 状态）：

```ts
// DrawToolCore.handlePointerLeave() — 通过 EventRouter 永久路由
const wasDrawing = this.drawingTool.onPointerLeave();
if (wasDrawing) {
  // 恢复 zoom wheel 模式（不再需要手动 removeEventListener）
  this.activeWheelMode = 'zoom';
}
this.panTool.onPointerLeave();
```

#### 与 DrawToolCore 集成

```ts
// DrawToolCore.initTools()
this.drawingTool = new DrawingTool(toolCtx, {
  setCurrentLayer: () => this.setCurrentLayer(),
  compositeAllLayers: () => this.renderer.compositeAllLayers(),
  syncLayerSliceData: (index, layer) => this.syncLayerSliceData(index, layer),
  filterDrawedImage: (axis, index) => this.renderer.filterDrawedImage(axis, index),
  getVolumeForLayer: (layer) => this.renderer.getVolumeForLayer(layer),
  pushUndoDelta: (delta) => this.undoManager.push(delta),
  getEraserUrls: () => this.eraserUrls,
});

// paintOnCanvas() — reset each call
this.drawingTool.reset(this.useEraser());

// Re-entry guard
if (this.drawingTool.isActive || this.panTool.isActive) return;
```

#### Undo 快照机制

```
mousedown → capturePreDrawSnapshot()
  → callbacks.getVolumeForLayer(layer).getSliceUint8(sliceIndex, axis)
  → 保存到 preDrawSlice / preDrawAxis / preDrawSliceIndex

mouseup → pushUndoDelta()
  → callbacks.getVolumeForLayer(layer).getSliceUint8(sliceIndex, axis)  ← 操作后
  → callbacks.pushUndoDelta({ layerId, axis, sliceIndex, oldSlice: preDrawSlice, newSlice })
```

---

## 8. EventRouter（事件路由）

**文件**: [eventRouter/EventRouter.ts](annotator-frontend/src/ts/Utils/segmentation/eventRouter/EventRouter.ts)

### 8.1 交互模式

| Mode | 触发条件 | 说明 |
|------|---------|------|
| `idle` | 默认 | 无交互 |
| `draw` | Shift 按住 | 绘画模式 |
| `drag` | 垂直拖拽 | 切片导航 |
| `contrast` | Ctrl/Meta 按住 | 窗位/窗宽调节 |
| `crosshair` | S 键 | 十字准星 |

### 8.2 事件永久路由（Event Lifecycle Refactor）

EventRouter 在 `bindAll()` 时永久绑定所有 pointer/keyboard/wheel 事件到 drawingCanvas。DrawToolCore 通过 `set*Handler()` 注册处理器，不再手动 `addEventListener`/`removeEventListener`。

#### 注册的处理器

| 方法 | Handler 内容 | 守卫条件 |
|------|-------------|----------|
| `setPointerDownHandler` | 转发到 `handleOnDrawingMouseDown` | 无（每次 pointerdown 都转发）|
| `setPointerMoveHandler` | 转发到 `handleOnDrawingMouseMove` | `drawingTool.isActive \|\| panTool.isActive`（仅活跃交互时转发）|
| `setPointerUpHandler` | 转发到 `handleOnDrawingMouseUp` | `drawingTool.isActive \|\| drawingTool.painting \|\| panTool.isActive \|\| sphere模式` |
| `setPointerLeaveHandler` | 调用 `handlePointerLeave()` | 无 |
| `setWheelHandler` | 根据 `activeWheelMode` 派发 | 无 |

> ⚠️ **守卫条件是必须的**：`drawingTool.onPointerMove()` 无条件设置 `isDrawing=true`（DrawingTool L108），如果不加守卫，空闲时鼠标移动会导致 Brush 预览和 Crosshair 无法渲染。

#### Wheel 派发器（`activeWheelMode`）

DrawToolCore 新增 `activeWheelMode: 'zoom' | 'sphere' | 'none'` 字段，替代原来的手动 wheel add/remove：

| Mode | 触发场景 | 派发目标 |
|------|---------|----------|
| `'zoom'` | 默认 / mouseUp 恢复 | `handleMouseZoomSliceWheel` |
| `'sphere'` | `handleSphereClick` 设置 | `handleSphereWheel` |
| `'none'` | draw 模式 mouseDown 设置 | 无操作（抑制滚轮）|

### 8.3 默认键盘设置

定义: [CanvasState.ts](annotator-frontend/src/ts/Utils/segmentation/CanvasState.ts) `keyboardSettings` 字段

```ts
IKeyBoardSettings = {
  draw: "Shift",
  undo: "z",
  redo: "y",
  contrast: ["Control", "Meta"],
  crosshair: "s",
  sphere: "q",
  mouseWheel: "Scroll:Zoom",   // 或 "Scroll:Slice"
}
```

---

## 9. Undo/Redo 系统

**文件**: [core/UndoManager.ts](annotator-frontend/src/ts/Utils/segmentation/core/UndoManager.ts)

### Delta 结构

```ts
interface MaskDelta {
  layerId: string;
  axis: "x" | "y" | "z";
  sliceIndex: number;
  oldSlice: Uint8Array;   // 操作前的切片数据
  newSlice: Uint8Array;   // 操作后的切片数据
}
```

- 每个 Layer 独立的 undo/redo 栈
- MAX_STACK_SIZE = 50

### Undo 流程

```
DrawToolCore.undoLastPainting()
  → UndoManager.undo() → MaskDelta
  → vol.setSliceUint8(delta.sliceIndex, delta.oldSlice, delta.axis)
  → applyUndoRedoToCanvas(layerId)
    → getOrCreateSliceBuffer(axis)
    → renderSliceToCanvas(...)
    → compositeAllLayers()
  → annotationCallbacks.onMaskChanged(sliceData, ...) → 通知后端
```

---

## 10. DragOperator

**文件**: [DragOperator.ts](annotator-frontend/src/ts/Utils/segmentation/DragOperator.ts)

负责拖拽交互（切片导航）。

> ⚠️ **Event Lifecycle Refactor 变更**: DragOperator 不再手动管理 wheel 事件监听器。原先在 `handleOnDragMouseDown` 中 `removeEventListener("wheel", ...)` 和在 `handleOnDragMouseUp` 中 `addEventListener("wheel", ...)` 的操作已删除，wheel 现在完全由 EventRouter 的 `activeWheelMode` 派发器管理。

| 方法 | 说明 |
|------|------|
| `drag(opts?)` | 启用拖拽模式 |
| `configDragMode()` | 绑定拖拽监听器 |
| `removeDragMode()` | 移除拖拽监听器 |
| `updateIndex(move)` | 委托给 DragSliceTool |
| `setEventRouter(eventRouter)` | 订阅模式变化 |

---

## 11. Channel 颜色定义

**文件**: [core/types.ts](annotator-frontend/src/ts/Utils/segmentation/core/types.ts)

### 11.1 默认颜色（全局常量）

| Channel | 颜色 | Hex | RGBA |
|---------|------|-----|------|
| 0 | 透明 | `#000000` | `(0,0,0,0)` |
| 1 | 祖母绿 (Primary/Tumor) | `#10b981` | `(16,185,129,255)` |
| 2 | 玫瑰红 (Secondary/Edema) | `#f43f5e` | `(244,63,94,255)` |
| 3 | 蓝色 (Tertiary/Necrosis) | `#3b82f6` | `(59,130,246,255)` |
| 4 | 琥珀黄 (Enhancement) | `#fbbf24` | `(251,191,36,255)` |
| 5 | 紫红 Fuchsia (Vessel/Boundary) | `#d946ef` | `(217,70,239,255)` |
| 6 | 青绿 Cyan (Additional) | `#06b6d4` | `(6,182,212,255)` |
| 7 | 橙色 (Auxiliary) | `#f97316` | `(249,115,22,255)` |
| 8 | 紫色 Violet (Extended) | `#8b5cf6` | `(139,92,246,255)` |

定义位置:
- RGBA: `MASK_CHANNEL_COLORS`
- CSS: `MASK_CHANNEL_CSS_COLORS`
- Hex: `CHANNEL_HEX_COLORS`

### 11.2 颜色转换工具函数（Phase B 新增）

| 函数 | 签名 | 说明 |
|------|------|------|
| `rgbaToHex` | `(color: RGBAColor) → string` | 转 Hex 字符串，如 `#ff8000` |
| `rgbaToCss` | `(color: RGBAColor) → string` | 转 CSS rgba() 字符串，如 `rgba(255,128,0,1.00)` |

### 11.3 Per-Layer 自定义颜色（Phase B）

每个 `MaskVolume` 实例拥有独立的 `colorMap: ChannelColorMap`，在构造时从 `MASK_CHANNEL_COLORS` 深拷贝。通过 `NrrdTools.setChannelColor(layerId, channel, color)` 修改某个 layer 的颜色不会影响其他 layer。

**颜色流转路径**:
```
volume.colorMap[channel]
  ↓ renderLabelSliceInto()     → Canvas 渲染使用 colorMap
  ↓ buildRgbToChannelMap()     → Canvas→Volume 写回使用 colorMap
  ↓ EraserTool.getChannelColor → 橡皮擦颜色匹配使用 colorMap
  ↓ syncBrushColor()           → 画笔颜色从 colorMap 获取
  ↓ getChannelCssColor()       → Vue UI 从 colorMap 获取显示颜色
```
