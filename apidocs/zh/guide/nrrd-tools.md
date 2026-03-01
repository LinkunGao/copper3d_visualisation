# NrrdTools 使用指南

> Copper3D `NrrdTools` — 医学图像分割标注引擎

`NrrdTools` 管理多层掩膜（mask）体积、分层画布管线、绘图工具、撤销/重做历史、通道颜色自定义和键盘快捷键 —— 所有这些都构建在基于 Three.js 的医学影像查看器之上。

> **内部架构**：`NrrdTools` 是一个使用了**组合**（而非继承）模式的 **Facade（外观）** 类。它组合了以下模块：
> - **`CanvasState`** —— 统一的状态容器（包含 nrrd_states、gui_states、protectedData、callbacks、keyboardSettings）
> - **`DrawToolCore`** —— 工具编排与事件路由
> - **`RenderingUtils`** —— 切片提取与画布合成辅助工具
> - **`LayerChannelManager`** —— 图层/通道/球体类型管理与颜色自定义
> - **`SliceRenderPipeline`** —— 切片设置、画布渲染、掩膜重载、画布翻转
> - **`DataLoader`** —— NRRD 切片加载、NIfTI 体素加载
>
> 旧的继承链（`NrrdTools → DrawToolCore → CommToolsData`）已被完全替换。所有的模块都通过 `ToolContext`（共享状态）以及 `Pick<ToolHost, ...>` 类型别名进行通信。下方记录的公共 API 保持不变。

---

## 目录

1. [快速开始](#_1-快速开始)
2. [构造函数与初始化](#_2-构造函数与初始化)
3. [数据加载](#_3-数据加载)
4. [渲染循环集成](#_4-渲染循环集成)
5. [绘图设置](#_5-绘图设置)
6. [图层与通道管理](#_6-图层与通道管理)
7. [通道颜色自定义](#_7-通道颜色自定义)
8. [撤销 / 重做](#_8-撤销-重做)
9. [键盘快捷键](#_9-键盘快捷键)
10. [显示与画布控制](#_10-显示与画布控制)
11. [高级场景](#_11-高级场景)
12. [Vue 3 集成模式](#_12-vue-3-集成模式)
13. [API 总结](#_13-api-总结)
14. [类型参考](#_14-类型参考)

---

## 1. 快速开始

```typescript
import * as Copper from 'copper3d';

const container = document.getElementById('viewer') as HTMLDivElement;
const nrrdTools = new Copper.NrrdTools(container);

nrrdTools.reset();
nrrdTools.setAllSlices(allSlices); // allSlices 取自 Copper 场景加载器

nrrdTools.drag({ getSliceNum: (index) => console.log('Slice:', index) });

nrrdTools.draw({
  getMaskData: (sliceData, layerId, channelId, sliceIndex, axis, width, height, clearFlag) => {
    // 每次笔触之后、撤销、重做之后会被调用 — 在此同步到后端
    console.log(`图层 ${layerId}, 通道 ${channelId}, 位于 ${axis} 轴的切片 ${sliceIndex}`);
  }
});

scene.addPreRenderCallbackFunction(nrrdTools.start);
```

---

## 2. 构造函数与初始化

```typescript
new Copper.NrrdTools(container: HTMLDivElement, options?: { layers?: string[] })
```

| 参数 | 类型 | 默认值 | 描述 |
|-----------|------|---------|-------------|
| `container` | `HTMLDivElement` | 必填 | 将承载所有标注画布的 DOM 元素 |
| `options.layers` | `string[]` | `["layer1","layer2","layer3"]` | 要创建的具名图层。每个图层都会获得其自己的 `MaskVolume` 对象以及画布 |

**单图层（最简模式）：**

```typescript
const nrrdTools = new Copper.NrrdTools(document.getElementById('viewer') as HTMLDivElement);
```

**自定义图层集：**

```typescript
// 用于带有 4 个图层的分割工作流：
// layer1 = 肿瘤，layer2 = 水肿，layer3 = 坏死，layer4 = 增强
const nrrdTools = new Copper.NrrdTools(container, {
  layers: ['layer1', 'layer2', 'layer3', 'layer4']
});
```

::: warning 警告
您在此处传递的图层列表必须与您的后端和 UI 所期望的一致。
如果后期需要添加或移除图层，必须重新实例化。
:::

**可选：显示切片索引的面板：**

```typescript
const slicePanel = document.getElementById('slice-index-panel') as HTMLDivElement;
nrrdTools.setDisplaySliceIndexPanel(slicePanel);
```

**可选：连接 GUI (dat.GUI / lil-gui)：**

```typescript
import GUI from 'lil-gui';
const gui = new GUI();
nrrdTools.setupGUI(gui as any);
```

---

## 3. 数据加载

### 3.1 加载 NRRD / NIfTI 图像切片

必需在 Copper 加载并解码了 NRRD 文件之**后**调用。

```typescript
nrrdTools.reset();
nrrdTools.setAllSlices(allSlices);
```

::: tip 提示
在 `setAllSlices()` 返回后，您可以安全地调用所有的 图层/通道/颜色 API。
如果在 `setAllSlices()` 之**前**调用颜色 API，操作将被静默忽略（因为此时 MaskVolume 尚未创建完成）。
:::

### 3.2 加载已有的掩膜数据 (NIfTI)

```typescript
const layerVoxels = new Map<string, Uint8Array>([
  ['layer1', layer1Uint8Array],
  ['layer2', layer2Uint8Array],
]);
nrrdTools.setMasksFromNIfTI(layerVoxels);

// 带加载进度条
const loadingBar = { value: 0 }; // 必需是包含 .value 属性的响应式对象
nrrdTools.setMasksFromNIfTI(layerVoxels, loadingBar);
```

**加载保存的病例：**

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

## 4. 渲染循环集成

每一帧必须调用 `NrrdTools.start` 以刷新标注覆盖层。

```typescript
// 在初始化完成后注册一次
const callbackId = scene.addPreRenderCallbackFunction(nrrdTools.start);

// 清理时取消注册（比如 Vue 组件卸载时）
scene.removePreRenderCallbackFunction(callbackId);
```

**手动渲染循环：**

```typescript
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
  nrrdTools.start();
}
animate();
```

---

## 5. 绘图设置

### 5.1 `drag()` — 切片导航

```typescript
nrrdTools.drag({
  showNumber: true,
  getSliceNum: (sliceIndex, contrastIndex) => {
    console.log('正在查看的切片:', sliceIndex);
    updateUISliceDisplay(sliceIndex);
  }
});
```

### 5.2 `draw()` — 标注回调

```typescript
nrrdTools.draw({
  // 在每次绘图笔触之后，或者撤销、重做、清空后调用
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

  // 当用户清空整层体积掩膜时调用
  onClearLayerVolume: (layerId: string) => {
    notifyBackendLayerCleared(layerId);
  },

  // 当放置球体标注时调用
  getSphereData: (sphereOrigin: number[], sphereRadius: number) => {
    sendSphereToBackend({ sphereOrigin, sphereRadius });
  },

  // 当更新测距器球体位置时调用
  getCalculateSpherePositionsData: (tumour, skin, rib, nipple, axis) => {
    if (tumour && skin && rib && nipple) {
      aiBackend.runSegmentation({ tumour, skin, rib, nipple, axis });
    }
  },
});
```

### 5.3 SphereTool — 3D 球体放置与距离计算器

#### 球体类型 & 通道映射

| 球体类型 | 所属通道 | 默认颜色 | `activeSphereType` 值 |
|-------------|---------|---------------|--------------------------|
| 肿瘤 (tumour) | 1       | `#10b981` (翠绿) | `"tumour"` (默认) |
| 乳头 (nipple) | 2       | `#f43f5e` (玫瑰红) | `"nipple"` |
| 肋骨 (ribcage) | 3       | `#3b82f6` (蓝色) | `"ribcage"` |
| 皮肤 (skin) | 4       | `#fbbf24` (琥珀色) | `"skin"` |

```typescript
// 设置激活的球体类型（也会同时更新 fillColor / brushColor）
nrrdTools.setActiveSphereType('nipple');
nrrdTools.setActiveSphereType('tumour');

// 读取当前激活的类型
const type = nrrdTools.getActiveSphereType();
// → 'tumour' | 'skin' | 'nipple' | 'ribcage'
```

::: tip 提示
建议使用公开的 API —— **请不要**直接修改 `gui_states.mode.activeSphereType`，因为 `setActiveSphereType()` 还会自动将画笔/填充色更新为与之对应的颜色。
:::

#### 编程式放置球体（后端 → 前端）

当后端返回球体坐标时（比如 AI 检测结果返回的坐标），您可以使用 `setCalculateDistanceSphere()` 在不需要用户互动的情况下直接放置：

```typescript
// 在切片 42 的 (120, 95) 位置放置一个肿瘤球体
nrrdTools.setCalculateDistanceSphere(120, 95, 42, 'tumour');
```

在内部，该方法将进行以下步骤：
1. 将球体半径设为 `sphereRadius = 5` 并导向目标切片
2. 通过 `crosshairTool.setUpSphereOrigins` 在 3 个维度的轴上都记录 `sphereOrigin`
3. 对这个起源位置坐标进行深拷贝到特定的结构下（例如 `tumourSphereOrigin`）
4. 在画布上绘制球体预览图
5. 把所有放置好的球体保存进 `sphereMaskVolume`
6. 重新渲染基于球体的图层

::: warning 警告
其坐标 (`x`, `y`) 采用的是**未缩放**过的图像空间。本方法将在其内部自动进行 `sizeFactor` 缩放调整。
:::

### 5.4 `enableContrastDragEvents()` — 窗宽 / 窗位调整 (Window/Level)

```typescript
nrrdTools.enableContrastDragEvents((step: number, towards: 'horizental' | 'vertical') => {
  console.log(`对比度调整: 拖动方向 ${towards} 步长 ${step}`);
});
```

---

## 6. 图层与通道管理

NrrdTools 支持**多图层**（例如肿瘤、水肿、坏死）标注以及在每个图层内部的**多通道**标注。

### 6.1 设定激活图层 & 通道

```typescript
nrrdTools.setActiveLayer('layer2');
nrrdTools.setActiveChannel(3);

const currentLayer   = nrrdTools.getActiveLayer();   // → 'layer2'
const currentChannel = nrrdTools.getActiveChannel(); // → 3
```

### 6.2 图层可见性

```typescript
nrrdTools.setLayerVisible('layer2', false);
nrrdTools.setLayerVisible('layer1', true);

const visible    = nrrdTools.isLayerVisible('layer2');  // → false
const visibilityMap = nrrdTools.getLayerVisibility();
// → { layer1: true, layer2: false, layer3: true, layer4: true }
```

**小眼睛按钮的勾选模式：**

```typescript
function onToggleLayerEye(layerId: string) {
  const current = nrrdTools.isLayerVisible(layerId);
  nrrdTools.setLayerVisible(layerId, !current);
}
```

### 6.3 通道可见性

```typescript
nrrdTools.setChannelVisible('layer1', 2, false);
nrrdTools.setChannelVisible('layer1', 2, true);

const ch2Visible    = nrrdTools.isChannelVisible('layer1', 2);
const allChannelVis = nrrdTools.getChannelVisibility();
// → { layer1: { 1: true, 2: false, 3: true, ... }, layer2: { ... }, ... }
```

**独立显示单一通道 (Isolate)：**

```typescript
function isolateChannel(layerId: string, targetChannel: number, totalChannels = 8) {
  for (let ch = 1; ch <= totalChannels; ch++) {
    nrrdTools.setChannelVisible(layerId, ch, ch === targetChannel);
  }
}
```

### 6.4 检查图层是否存在标注数据

```typescript
if (nrrdTools.hasLayerData('layer2')) {
  await saveLayer('layer2');
} else {
  await initBlankLayerOnBackend('layer2');
}
```

---

## 7. 通道颜色自定义

每个图层都有完全独立的颜色映射表。

### 默认通道颜色表

| 通道 | 颜色 | Hex 编码 |
|---------|-------|-----|
| 1 | 翠绿 | `#10b981` |
| 2 | 玫瑰红 | `#f43f5e` |
| 3 | 蓝色 | `#3b82f6` |
| 4 | 琥珀色 | `#fbbf24` |
| 5 | 紫红色 | `#d946ef` |
| 6 | 蓝绿 | `#06b6d4` |
| 7 | 橘黄 | `#f97316` |
| 8 | 蓝紫 | `#8b5cf6` |

### 设置颜色

```typescript
// 单一通道 (RGBAColor 类型: { r, g, b, a } — 全部数值域为 0-255)
nrrdTools.setChannelColor('layer1', 3, { r: 255, g: 128, b: 0, a: 255 });

// 批量设置 (使用该方法只会调用一次 reloadMasksFromVolume — 获得更好的性能表现)
nrrdTools.setChannelColors('layer1', {
  1: { r: 255, g: 80,  b: 80,  a: 255 },
  2: { r: 80,  g: 180, b: 255, a: 255 },
  3: { r: 255, g: 230, b: 50,  a: 255 },
});

// 在所有图层设定相同的颜色映射
nrrdTools.setAllLayersChannelColor(1, { r: 0, g: 220, b: 100, a: 255 });
```

### 读取颜色

```typescript
const rgba = nrrdTools.getChannelColor('layer2', 3);
// → { r: 255, g: 128, b: 0, a: 255 }

const hex = nrrdTools.getChannelHexColor('layer2', 3);
// → "#ff8000"  — 非常适合赋给 canvas fillStyle

const css = nrrdTools.getChannelCssColor('layer2', 3);
// → "rgba(255,128,0,1.00)"  — 适合赋给 Vue 的 :style 绑定
```

### 重置颜色

```typescript
nrrdTools.resetChannelColors('layer1', 3); // 重置单一通道
nrrdTools.resetChannelColors('layer1');    // 重置图层里的所有通道
nrrdTools.resetChannelColors();            // 重置全部状态
```

**集成颜色选择组件：**

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

**颜色修改后保持 Vue 数据响应性：**

在调用 `setChannelColor()` 后，画布将自动重绘刷新。但是对于 Vue computed 方法则需要手动触发其重绘计算：

```typescript
const colorVersion = ref(0);

const channelCssColor = computed(() => {
  colorVersion.value; // 在内部订阅这个响应版数值
  return nrrdTools.value?.getChannelCssColor(activeLayer.value, activeChannel.value) ?? '#00ff00';
});

// 当更改任何一项颜色后:
nrrdTools.value.setChannelColor('layer1', 2, { r: 255, g: 0, b: 0, a: 255 });
colorVersion.value++; // 将会使得 Vue 重新执行 Computed
```

---

## 8. 撤销 / 重做

为每个图层单独管理的撤销记录系统 (封顶记录数 50)。 任意的一个笔触执行后都会将结果备份做成快照存入此历史。

```typescript
nrrdTools.undo();
nrrdTools.redo();
```

**绑定任意外部键盘快捷键：**

```typescript
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'z') nrrdTools.undo();
  if (e.ctrlKey && e.key === 'y') nrrdTools.redo();
});
```

::: tip 提示
内建的快捷键管理系统也已包含了撤回重做（默认下是单独使用按键 `z` 行使撤销及 `y` 去行使重做，不需要 Control 辅助键）。细节可参考下方 [键盘快捷键](#_9-键盘快捷键)。
:::

---

## 9. 键盘快捷键

### 默认快捷键

| 行为 (Action) | 默认键 |
|--------|-------------|
| 自由画模式 (Draw mode) | `Shift` (按住) |
| 撤回 (Undo) | `z` |
| 重做 (Redo) | `y` |
| 对比度 (Contrast) | `Ctrl` / `Meta` (按住) |
| 十字准星 (Crosshair) | `s` |
| 球体模式 (Sphere) | `q` |
| 鼠标滚轮 | 放大 / 缩小视觉区 |

### 自定义配置

```typescript
nrrdTools.setKeyboardSettings({
  undo: 'u',
  mouseWheel: 'Scroll:Slice', // 鼠标滚动将会直接调整切片帧而非放大图片
});

const settings = nrrdTools.getKeyboardSettings();
```

### 在输入表单时消除所有的键位限制机制

```typescript
inputElement.addEventListener('focus', () => nrrdTools.enterKeyboardConfig());
inputElement.addEventListener('blur',  () => nrrdTools.exitKeyboardConfig());
```

### 对比度调整的快捷键开关

```typescript
nrrdTools.setContrastShortcutEnabled(false);
nrrdTools.isContrastShortcutEnabled(); // → false
```

---

## 10. 显示与画布控制

```typescript
// 画布分别率缩放数值乘数 (1–8 之间)
nrrdTools.setBaseDrawDisplayCanvasesSize(2);

// 每个体素（Voxel）的 [宽, 高, 深度] 值
const dims = nrrdTools.getCurrentImageDimension(); // → [512, 512, 256]

// 从 NRRD 文件解析出来的物理空间间距 （每进行一体素间跳转表示实际走过多少毫米）
const spacing = nrrdTools.getVoxelSpacing(); // → [0.488, 0.488, 1.0]

// 世界空间的源心
const origin = nrrdTools.getSpaceOrigin(); // → [-125.0, -125.0, -127.5]

// 找到在全部轴上的封顶切面总数范围
const maxSlices = nrrdTools.getMaxSliceNum(); // → [512, 512, 256]

// 获得此刻查阅的整体参数信息状态
const { currentSliceIndex, contrastIndex } = nrrdTools.getCurrentSlicesNumAndContrastNum();

// 返回使用底层的组件引用对象
const drawingCanvas = nrrdTools.getDrawingCanvas();
const container     = nrrdTools.getContainer();
```

### 清空与擦掉注图

```typescript
nrrdTools.reset();           // 擦除 ALL 所有的 — 层图，回档历史， 画布及球坐标（最好在病例互相切换时立刻引发此机制）
nrrdTools.clearActiveLayer(); // 擦掉整一套的此刻被指定在绘画的 3D 数据+历史库记录状态 → 然后随即它引响发 onClearLayerVolume的机制
nrrdTools.clearActiveSlice(); // 只是单纯当前看到处于这屏幕视角范围二维面上进行清理掉（能借由撤回寻获补）
```

---

## 11. 高级场景

### A: 重新对新工程完成一次基于全套多图解式的初始化

```typescript
async function initAnnotationTool(container: HTMLDivElement, allSlices: any[]) {
  const nrrdTools = new Copper.NrrdTools(container, {
    layers: ['layer1', 'layer2', 'layer3', 'layer4']
  });

  nrrdTools.setupGUI(gui as any);
  nrrdTools.enableContrastDragEvents((step, towards) => console.log('窗口调整:', towards, step));

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

### B: 加载存在图集， 并注入高度定制式的专有彩色搭配集合表

```typescript
async function loadAndColorCase(nrrdTools: Copper.NrrdTools, caseId: string) {
  const masks = await fetchCaseMasks(caseId);
  const layerVoxels = new Map<string, Uint8Array>(Object.entries(masks));
  nrrdTools.setMasksFromNIfTI(layerVoxels);

  nrrdTools.setChannelColors('layer1', {
    1: { r: 0,   g: 200, b:  80, a: 255 },  // 肿瘤内核 —— 绿色
    2: { r: 255, g: 200, b:   0, a: 255 },  // 肿瘤光环边 —— 黄色
  });
  nrrdTools.setChannelColors('layer2', {
    1: { r: 255, g: 60,  b:  60, a: 200 },  // 水肿 —— 具有通透度下的艳红色
  });

  nrrdTools.setActiveLayer('layer1');
  nrrdTools.setActiveChannel(1);
}
```

### C: 完整做一次彻底转出病例并新加入操作

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

### D: 保存工作流机制（加入污渍识别拦截）

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

### E: 利用到机器智能模型自动化的切合后重新存回来本域的系统

```typescript
async function applyAIResult(nrrdTools: Copper.NrrdTools, layerId: string) {
  const response = await fetch(`/api/ai-result/${layerId}`);
  const voxels = new Uint8Array(await response.arrayBuffer());
  nrrdTools.setMasksFromNIfTI(new Map([[layerId, voxels]]));
  nrrdTools.setActiveLayer(layerId);
}
```

### F: 连接后端跑距离计算球

```typescript
nrrdTools.draw({
  getCalculateSpherePositionsData: (tumour, skin, rib, nipple, axis) => {
    if (tumour && skin && rib && nipple) {
      aiBackend.runSegmentation({ tumour, skin, rib, nipple, axis });
    }
  },
  getSphereData: (origin, radius) => console.log('发现被点击放置在了圆球坐标', origin, '带有的指定大小宽段', radius),
});
```

---

## 12. Vue 3 集成模式

推荐在 NRRD 完成下载且准备就绪的时候派发出一个 Event Emitter 用来统管所有的挂载服务分配.

### 创建组件端 (例如在 LeftPanel 组件)

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

### 使用组件端 (例如在 Annotation Panel 组件)

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
    // 此时刻可随意去叫唤用各项子指令组 —— 因为此时包含 MaskVolume 已经搭建出来了
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

## 13. API 总结

| 分类 | 方法 | 描述 |
|----------|--------|-------------|
| **构造函数** | `new NrrdTools(container, { layers })` | 依据指定列表项（不必须但建议）创建一个构建出来的容器结构 |
| **设置与配置** | `drag(opts?)` | 引导启用出滚条滑拽相关项监听以及其切片反馈 |
| | `draw(opts?)` | 绑定上标注画图相关所引申的所有反馈数据回传机制 |
| | `setupGUI(gui)` | 连接绑定基于 dat.GUI / 或 lil-gui 的窗组件交互器 |
| | `enableContrastDragEvents(cb)` | 开始接收基于 Control键进行滑拉修改窗口大小等设定事件反应 |
| | `setDisplaySliceIndexPanel(el)` | 将能被展示序号的地方面板位置暴露绑定给模块 |
| | `setBaseDrawDisplayCanvasesSize(n)` | 手柄调设底部分辨素清晰显示度的高清晰分辨率的乘度比 (位于 1–8 ) |
| **数据部分** | `reset()` | 重塑整理清除各全卷记录，重新退原回归初源, 包括所有层、球或者撤图回推所有 |
| | `clearActiveLayer()` | 专干抹除净身指定的现正在活层的整体全方面三阶图集记录加所有重制项历史 |
| | `clearActiveSlice()` | 止抹在视角当前那一小局部单一层的视图绘画历史内容（可进行使用推回救转挽回） |
| | `setAllSlices(slices)` | 传输入 NRRD 片帧并开起创办出 MaskVolume 及相关的一切后项基要 |
| | `setMasksFromNIfTI(map, bar?)` | 接收下载取回解包裹出的所有层 NIfTI 形式的三阶位像素块存组重返到屏幕显示面上 |
| **渲染部分** | `start` | 一组用去刷新重现覆盖表里的挂帧刷绘画层动作钩件方法函数 —— 它用来投入至全局循动描渲周期系统当中 |
| **图层** | `setActiveLayer(id)` | 指令调切换过去另至另一块为被作为画改作用焦聚的图层中去 |
| | `getActiveLayer()` | 查证核检取回当下现在被聚焦中用来修改活动所在的图层代号 |
| | `setLayerVisible(id, bool)` | 指令定准切换图块被开启可视亦或者是做暂蔽关闭起来的指令 |
| | `isLayerVisible(id)` | 给询取是否仍正在屏表呈可视化现中 |
| | `getLayerVisibility()` | 给取到整体一全套涵盖每样有跟所有的有关各家可见性的数据全字典信息 |
| | `hasLayerData(id)` | 让鉴查这个被指定的某个层面中究竟是不是真的存了非归 0 数字数值的内容像素区块等 |
| **球体** | `setActiveSphereType(type)` | 让激活切点变更使用的类型系统, 顺道同换掉相关的颜色设定 |
| | `getActiveSphereType()` | 验证当下此刻使用到的到底是哪一种求体积对象系统类型 |
| | `setCalculateDistanceSphere(x, y, slice, type)` | 以纯系统后方传点编码输入式自动完成放下求计算小球的过程指派动作 |
| **通道** | `setActiveChannel(ch)` | 更换聚焦用作用去接手受后续要绘制涂画所在的具体那一轨单号的通层中 |
| | `getActiveChannel()` | 检测验证并返回此刻当时正是目前做做正活通用的单层所在号 |
| | `setChannelVisible(id, ch, bool)` | 指定对特某通道里是否遮挡隐藏可示否开关锁钮命令开关口 |
| | `isChannelVisible(id, ch)` | 访问得知所查问通道口眼下状态究竟是不是露敞开启着的 |
| | `getChannelVisibility()` | 向问到当前整台体上所记载下着各通眼开掩等大全态分布字典集合 |
| **色彩** | `setChannelColor(id, ch, rgba)` | 向被定向好的明确标上名录了某号通处中替换植埋进自定出指定的那个特殊色彩项 |
| | `setChannelColors(id, map)` | 以组群捆的方式将多项自创定色彩图表一起一回灌植替代写覆盖掉原某特图位层内部里 |
| | `setAllLayersChannelColor(ch, rgba)` | 让这设定好要用来替代去所有各个层上具有着统一的那一样序号位置去统一全部覆盖更新过去 |
| | `getChannelColor(id, ch)` | 把以这所询项指取而去的带返回去一组 rgba 项信息元物件取交出给这 |
| | `getChannelHexColor(id, ch)` | 直接转换将其那项直接改型产出并吐给做呈现能做出的具有 Hex 那十六位形式文字传带给你 |
| | `getChannelCssColor(id, ch)` | 直接就将可以马上用来能放在 css 去引作带式表达项 `rgba()` 字串句子传递给交赋与去你处 |
| | `resetChannelColors(id?, ch?)` | 直接一把扫灭并还原把那些原本预存定设有的色彩初模色卡项全都还原变回复至归宗本最初期底色里头去 |
| **笔具模式** | `setMode(mode)` | 去切入转换其用使用拿握着的各小形功能模式如 : `"pencil(铅笔)"` / `"brush(笔刷)"` / `"eraser(橡皮擦)"` / `"sphere(立体球点)"` / `"calculator(立体仪算)"` |
| | `getMode()` | 寻查得到现在此刻当头上到底真捏拿着在哪功能工具态下作业中呢 |
| | `isCalculatorActive()` | 去特别检查判断看眼是不是在那处于仪算系统态内里面去启动用着呢 |
| **注绘操作** | `setOpacity(value)` | 给那个透明盖图层罩薄厚度下注定义设 [ 从0.1 透明最清至 1 完全厚填实实底 ] 之间的范数 |
| | `getOpacity()` | 寻要探出当前的这盖覆实透明薄薄度现在正给多少数值内 |
| | `setBrushSize(size)` | 为现在使用的涂画擦拭这些刷头物设定那 [最小5, 最大50 ]这域段面之大中小号体积 |
| | `getBrushSize()` | 要求交探出现在这个画笔刷的大体积给现多少数值啊 |
| | `setPencilColor(hex)` | 直接把那一串代表特定给拿做以画走着线条模式下才单独生效去展示的那股边线表线颜调换掉色吧 |
| | `getPencilColor()` | 那给找出给返回展示来看出看究竟那铅单划线上所带有附的色彩当前调何种样子样色呀 |
| **对比度** | `setWindowHigh(value)` | 给予特去设上把最高视亮度向高标数值定义 |
| | `setWindowLow(value)` | 给予专向底层向下那最为向至黑低值的那个定义设定底数区间值 |
| | `finishWindowAdjustment()` | 当松开发下放结束在做了那些拉调节过后，令令去全局各切面帧一起整体全面执行更新刷上一最新次底图展现吧 |
| | `getSliderMeta(key)` | 特给予前端专门界面拉推条提供给个它必须包含在最低，至上顶及进阶滑的数字全态底包包囊交由了 UI 那边去处理用 |
| **动作操作** | `executeAction(action)` | 送指令执跑启动这套: 单次的撤退`"undo"` / 或一次追回`"redo"` / 清这当下一副全图`"clearActiveSliceMask"` / 扫去扫清那整一本满册所有的卷层包`"clearActiveLayerMask"` / 大视角回定复原`"resetZoom"` / 去直接给向外提取拉带载出去现今这个截页面遮版图图去留做别保存用 `"downloadCurrentMask"` |
| **浏览导向** | `setSliceOrientation(axis)` | 让向直接转视角把当前被从这正平的视图里向给拨轮变作去转从别如头看过去切口样 `"x"` 或另向侧看 `"y"` 或者在切俯望底 `"z"`这各样的面向转去 |
| **历史倒推** | `undo()` / `redo()` | 退一步倒先推走下撤销走上次这一笔一划，亦或直接叫返追着刚补弄错返回上才取消去的那补回来重做这步骤嘛 |
| **键盘按键** | `setKeyboardSettings(partial)` | 供入进个重新配置并分配那几项有变动的特殊专键改替原键键名去变替原版绑位 |
| | `getKeyboardSettings()` | 要求交取出现版所实带运行中绑的那些配全字典全包集合组 |
| | `enterKeyboardConfig()` / `exitKeyboardConfig()` | 特给让其进行封口暂全阻住禁绝令所有绑给的功能去在某些那给在写填进文表单内用字打字的过路时间段避免误给干乱给引爆执行功能去封和在结束后全放解放启行归出功能限制回常状态用 |
| | `setContrastShortcutEnabled(bool)` | 全全管启与禁止叫关闭绝掉对于在那靠长持握对比明暗功能全锁门或启动开锁大口限功能 |
| | `isContrastShortcutEnabled()` | 让叫看一眼探询这个是否在锁全开的无禁门关限禁功能之锁究竟是上中没在阻挂限上的开启功能啊 |
| **探索验证** | `getCurrentImageDimension()` | 索探寻拿那体积形由的三长宽高点 [长x底，顶层y的，极深到底度d的厚] 到底一具都有数多少层构图体数组合吧 |
| | `getVoxelSpacing()` | 取出拿到带有那世界最最底层真实的物理每段一间隔多少小段公毫米长单位这原底质数字全组数据给你吧 |
| | `getSpaceOrigin()` | 向你要的并寻向拿出它基于三地虚拟建制的最初真真切界本世界发地原轴心座原标数值群点给出来供给你 |
| | `getMaxSliceNum()` | 点指出来让去那把到这至其极限最多切顶峰层数那各轴所持总顶数目数值包提给交付出现供这看用吧 |
| | `getCurrentSlicesNumAndContrastNum()` | 就是直接提取现眼这前所真处驻留在着当前的一块段那图的当前层位次加上同当时它的对与光暗对所具位点等现参数打包全给现拿看它出交给你去用看看吧 |
| | `getMaskData()` | 就直接将给那个它一原本原本带着的全源体内部底资料那个那源始体件也就是它本身内那被呼叫命被成为叫做以以原结构物件体对象 `IMaskData` 原封给拿取全包拿出全交付与你去使用 |
| | `getNrrdToolsSettings()` | 给也来去一并把现存所它具有这内部大全囊括了这一切设置的全集集合结构组的也就是包含那些源体库内总记录所有设置现全况它即叫为被命名那个叫作成为的它也就是指为这那个名为称做成为叫`NrrdState`状态截记全原原本交给你去看拿着好去使用去存记它吧 |
| | `getContainer()` | 取回来交与给当初包包含并收这画承接着去这图这全部底里承这它所在依其而的这个寄其宿托这个那个原体底盘结构大载组件的那一个源体的 HTML 网页上的那个它 `HTMLElement`组件全组件这大框大件组件给返回到你去吧 |
| | `getDrawingCanvas()` | 那么给叫取调把它在那覆盖所有在之面上高顶位于所真被人在动做给做那笔触用上涂用所在在的那一张属于是最高的一层面铺贴在那表层的最顶外里头的属于属于那个最前端最上它这的一层上的那叫以其名字称成为唤被做呼名叫这个叫做 `HTMLCanvasElement`给取把调把拿出现来供你去调看那给拿出被去使用下吧 |

---

## 14. 类型参考

```typescript
// 在所有调用颜色有关的 API 里通用的核心配置属性基本项对象定义表结构
interface RGBAColor {
  r: number;  // 数值区间为从 0 至 255
  g: number;  // 数值区间为从 0 至 255
  b: number;  // 数值区间为从 0 至 255
  a: number;  // 这个也就是其特有透明深清显度其区间数点也在这 0至 255 域里（其中如在定数值等指处于极峰为在 255 也就是表示着是全底顶厚绝对没能看通穿一点的不这它全透明显见状为这的这极态下限为全透明的态等）
}

// 供拿以去做一全套大批全替换覆盖使用的颜色指派所专用于集合打包它这定义配置表类型的在对调用 setChannelColors()的它内部用传交用等时候使用这的图颜色字典类型的构架式
type ChannelColorMap = Record<number, RGBAColor>; // key 这个即指代表为这正是那这这所处属于那对应的具体哪个那个它特定的所属第指的对应着的是为这个的这那一轨道单编号数值区间数为为这的在第这由从1 到为至它的上限数值也就是极极至于最上限最多止到那到这极限到这的这只在8 以里数为这内的在内的这个以从1起直到那的这8只只在只到它内的编号数值数字（区间 1-8） 

// 定义传赋予这画制行为它此的给画调传供带各项这回调设定选项等去定义它的这一包供用于的调选项那它等定义它的等这些全定义类型的表也就是对在 draw()方法选项中等传等的配置包的它的结构类型表
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

// 定义下它供调用传递赋那等给予用于拖拉切换图带回调的定义各项其用于它相关等配置包设定去这设那些的类型所选在这是用于它的这一那对它的供在对于在给予赋它给其的调用 drag() 它这的方法配带传设的等的这些配置项包它等的等那这些其选项它这是为其等的配置结构等表等
interface IDragOpts {
  showNumber?: boolean;
  getSliceNum?: (sliceIndex: number, contrastIndex: number) => void;
}

// 所关及涉联系的针对到那键盘绑操作那些设定全部组装全配在这类型的全这组合那包类型的设定表
interface IKeyBoardSettings {
  draw: string;
  undo: string;
  redo: string;
  contrast: string[];           // 其中比如好例子给像这就可会是像例如的指它会传如是如像为等它是像这个例 ["Control", "Meta"]这等的
  crosshair: string;
  sphere: string;
  mouseWheel: 'Scroll:Zoom' | 'Scroll:Slice';
}

// 三方立体的点轴所定位到这那一中心指向处点用来指向在那空内中某处一那位置的坐标原点结构配置（经常在会被那那于被调在球体积于回调参数那些用于参数的内位坐定标等的被传到这等结构定）
interface ICommXYZ {
  x: number;
  y: number;
  z: number;
}

type LayerId      = 'layer1' | 'layer2' | 'layer3' | 'layer4'; // 或许或者是可能为别的任一一这的那随其它意的其它那它的任何字元字串项
type ChannelValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
```
