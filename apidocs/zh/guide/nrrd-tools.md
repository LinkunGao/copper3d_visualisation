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
15. [高斯平滑](#_15-高斯平滑-gaussian-smoothing)

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

::: tip 图层 id 可以是任意字符串 <Badge type="tip" text="3.10.4" />
不一定非得是 `layerN`：

```typescript
const nrrdTools = new Copper.NrrdTools(container, {
  layers: ['tumour', 'edema', 'necrosis', 'vessel']
});
```

在 3.10.4 之前，undo 栈只为 `layer1` / `layer2` / `layer3` 预先创建，因此自定义 id 要么静默地
压进了别的图层的历史里，要么在 undo 时抛异常。现在这些栈按需创建，键就是你传进来的那个 id。
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

::: tip 支持只抽部分轴的加载 <Badge type="tip" text="3.10.0" />
`setAllSlices` 的几何信息（维度、spacing、space origin）是从**已经存在**的那个面背后的共享
`Volume` 上读的，所以用 [`axes: ["z"]`](./load-callbacks) 加载出来的切片在这里同样可用。
缺的面会在 `setSliceOrientation()` 第一次需要它们时按需抽取。
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

#### 网格校验 —— `registerNiftiMaskGrid()` <Badge type="tip" text="3.10.0" />

`setMasksFromNIfTI` 以前会把任何 buffer 硬塞进去：长的截断，短的补零。两种情况下，来自错误
网格的 mask 都会**静默地画到错误的体素上**，而且哪里都不报错。被拒绝的 mask 是可以补救的，
放错位置的不行。

现在 buffer 会和已加载图像的体素网格做比对，不匹配就**拒绝加载**。这个校验需要 buffer 自己的
NIfTI 网格，而 `setMasksFromNIfTI` 没有第二个参数可以接 —— 所以要在带外注册，以 buffer 本身为键：

```typescript
import { registerNiftiMaskGrid } from 'copper3d';

const { voxels, dims } = await fetchNiftiVoxels(path); // dims = header 的 [x, y, z]
registerNiftiMaskGrid(voxels, dims);                   // 必须在 setMasksFromNIfTI 之前

layerVoxels.set('layer1', voxels);
nrrdTools.setMasksFromNIfTI(layerVoxels);
```

::: warning 没注册过网格的 buffer 一律拒绝
不会"假定它匹配"。每一个要传给 `setMasksFromNIfTI` 的 buffer 都必须先调用一次
`registerNiftiMaskGrid`，否则该图层会被跳过。解码出来就顺手注册 —— 注册表是按 buffer 身份
索引的，所以你可以先解码好几个图层，再统一调用 `setMasksFromNIfTI`。
:::

被拒绝的图层会带着两个网格打印 `console.error`、调用 `notifyUser`（见下），然后被跳过；同一个
`Map` 里的其他图层照常加载。

#### `notifyUser` —— 把引擎的消息接到你的 UI 上 <Badge type="tip" text="3.10.0" />

本包自身不带 UI，也不会去引用你应用里的 UI。`NrrdTools.notifyUser` 就是这个接缝：它默认写
console，宿主如果有 toast 或 banner，在构造之后把自己的实现赋上去即可。

```typescript
nrrdTools.notifyUser = (message, level) => {
  // level: 'error' | 'warning' | 'info'
  toast[level](message);
};
```

目前只有"mask 被拒绝"这一件事会用到它。

**加载保存的病例：**

```typescript
import { registerNiftiMaskGrid } from 'copper3d';

async function loadCase(caseDetail: ICaseDetail) {
  const layerVoxels = new Map<string, Uint8Array>();

  if (Number(caseDetail.output.mask_layer1_nii_size) > 0) {
    const { voxels, dims } = await fetchNiftiVoxels(caseDetail.output.mask_layer1_nii_path!);
    if (voxels) {
      registerNiftiMaskGrid(voxels, dims);
      layerVoxels.set('layer1', voxels);
    }
  }

  if (Number(caseDetail.output.mask_layer2_nii_size) > 0) {
    const { voxels, dims } = await fetchNiftiVoxels(caseDetail.output.mask_layer2_nii_path!);
    if (voxels) {
      registerNiftiMaskGrid(voxels, dims);
      layerVoxels.set('layer2', voxels);
    }
  }

  if (layerVoxels.size > 0) {
    nrrdTools.setMasksFromNIfTI(layerVoxels);
  }
}
```

### 3.3 对比度序列：skip、contrast 索引与批量提交

一个加载好的病例是一串对比度（phase）序列。`allSlicesArray` 存全部对比度，`displaySlices` 存
真正显示的那个子集（由 skip 列表推出来）。由此产生了**两套索引空间**，混用它们是这里最常见的 bug：

| 名称 | 指向 | 说明 |
|------|------|------|
| skip `index` | **完整**对比度列表中的位置 | `addSkip` / `removeSkip` / `setSkips` 收的就是它 |
| `contrastIndex` | **`displaySlices`** 中的位置，即被选中的子集 | `setContrastIndex` 收的是它 |

5 个 phase 里选了 3 个时，合法的 `contrastIndex` 是 `0..2`。按 phase 名字思考的调用方必须先做转换。

```typescript
nrrdTools.addSkip(2);          // 隐藏第 2 个对比度
nrrdTools.removeSkip(2);       // 再显示出来
nrrdTools.setContrastIndex(1); // 跳到第 2 个**被显示的**对比度
```

#### 批量形式 <Badge type="tip" text="3.10.0" />

上面每一个调用最后都会走一次完整的 display/canvas/mask 刷新。放在循环里 —— 比如病例加载时一次性
对齐整套 phase 选择 —— 除最后一次之外的每次刷新都会立刻被覆盖掉，而这个开销是实打实的（5 个 phase
的序列实测超过 1 秒主线程时间）。批量形式做同样的事，只刷新**一次**：

```typescript
// 多次 skip 变更，一次刷新
nrrdTools.setSkips([
  { index: 0, skip: false },
  { index: 1, skip: true },
  { index: 2, skip: true },
]);

// skip 变更 + 落到某个对比度，一次刷新
nrrdTools.commitSkipsAndContrast(
  [{ index: 1, skip: true }, { index: 3, skip: true }],
  0
);

// 整个病例加载收尾：换序列 + 对齐 skip + 落到目标对比度
nrrdTools.commitSeriesLoad(allSlices, skipEntries, 0);
```

`commitSeriesLoad` 取代了 `switchAllSlicesArrayData` + `setSkips` + `setContrastIndex` 这一串
—— 原来要付三次完整刷新，其实一次就够。`contrastIndex` 会被夹取到重建后的 `displaySlices` 范围内，
和 `setContrastIndex` 自己的边界检查一致。

::: tip 该用哪一个
- 用户点一下的单次切换 → `addSkip` / `removeSkip`
- 同一轮里多次 skip 变更 → `setSkips`
- skip 变更再加一个目标对比度 → `commitSkipsAndContrast`
- 完整的病例 / 序列加载 → `commitSeriesLoad`
:::

#### 换序列时保留视图

```typescript
// 会重置切片索引 / 缩放 / 平移
nrrdTools.switchAllSlicesArrayData(allSlices);

// 保留当前切片索引、缩放和平移 —— 用于 register/origin 图像切换
nrrdTools.switchSlicesPreservingView(allSlices);
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

### 5.4 SphereBrush & SphereEraser — 3D 体积绘画与擦除

SphereBrush 和 SphereEraser 是直接操作 3D 体积的工具，将球体写入/擦除到**当前活跃 layer 的共享 MaskVolume** 中，使用当前 active channel 的标签值。与 Sphere（标记器）工具使用独立的 `sphereMaskVolume` 不同，这两个工具直接修改 layer 数据，完全兼容 undo/redo 系统、NIfTI 导出和 GLTF 生成。

#### 工具模式

| 工具 | 模式值 | 说明 |
|------|-------|------|
| Sphere Brush | `"sphereBrush"` | 左键点击在活跃 layer 中绘制一个 3D 球体 |
| Sphere Eraser | `"sphereEraser"` | 左键点击擦除一个 3D 球体（或拖动连续擦除）。只擦除当前 active channel。 |

#### 激活 SphereBrush / SphereEraser

```typescript
// 切换到 Sphere Brush 模式
nrrdTools.setMode('sphereBrush');

// 切换到 Sphere Eraser 模式
nrrdTools.setMode('sphereEraser');

// 读取当前模式
const mode = nrrdTools.getMode();
// → 'sphereBrush' | 'sphereEraser' | 'pencil' | 'brush' | 'eraser' | 'sphere' | 'calculator'
```

#### 半径控制

```typescript
// 设置球形画笔/橡皮擦半径（限制在 [1, 50]）
nrrdTools.setSphereBrushRadius(10);

// 读取当前半径
const radius = nrrdTools.getSphereBrushRadius(); // → 10
```

交互时，用户也可以在按住左键的同时通过滚轮调整半径。

#### 交互流程

```
SphereBrush 模式 (gui_states.mode.sphereBrush = true):
  ├─ Shift 键被禁用（不能进入 draw 模式）
  ├─ 拖拽切片被禁用
  ├─ Crosshair 切换可用 (S 键)
  │
  ├─ 左键按下 → 记录中心点，绘制预览圆
  │   此时 activeWheelMode = 'sphereBrush'
  │
  ├─ 滚轮（按住时）→ 调整半径 [1, 50]
  │
  └─ 左键松开 → 将 3D 球体写入 MaskVolume
      ├─ 推送 undo 组（所有受影响的 Z 切片）
      ├─ 重渲染 layer canvas
      ├─ 为所有受影响的切片触发 onMaskChanged
      └─ activeWheelMode = 'zoom'

SphereEraser 模式 (gui_states.mode.sphereEraser = true):
  ├─ 与 SphereBrush 相同的约束
  │
  ├─ 左键按下 → 记录中心点，捕获 before 快照
  │
  ├─ 拖动（可选）→ 沿路径连续擦除
  │   └─ 惰性捕获新触及的 Z 切片的 before 快照
  │
  ├─ 滚轮（按住时）→ 调整半径 [1, 50]
  │
  └─ 左键松开 → 完成擦除
      ├─ 推送累积 undo 组（整个拖拽过程中所有受影响的 Z 切片）
      ├─ 重渲染 layer canvas
      ├─ 为所有受影响的切片触发 onMaskChanged
      └─ activeWheelMode = 'zoom'
```

#### 与 Sphere（标记器）的关键区别

| 特性 | Sphere（标记器） | SphereBrush / SphereEraser |
|------|-----------------|---------------------------|
| 存储目标 | `sphereMaskVolume`（独立覆盖层） | 活跃 layer 的 `MaskVolume`（共享） |
| Channel 行为 | 固定按球体类型 | 使用 active channel |
| NIfTI/GLTF 导出 | 不导出（仅覆盖层） | 完整导出为 3D 体积 |
| Undo 支持 | 无 | 支持（分组多切片 undo） |
| 拖动支持 | 无 | SphereEraser 支持拖动擦除 |

#### 场景：使用 Sphere Eraser 审核 AI 结果

```typescript
// 加载 AI 分割结果
nrrdTools.setMasksFromNIfTI(layerVoxels);

// 切换到球形橡皮擦进行快速清理
nrrdTools.setMode('sphereEraser');
nrrdTools.setSphereBrushRadius(8);

// 用户现在可以点击或拖动来擦除错误区域
// 所有更改都可撤销，且会被正确导出
```

### 5.5 `enableContrastDragEvents()` — 窗宽 / 窗位调整 (Window/Level)

```typescript
nrrdTools.enableContrastDragEvents((step: number, towards: 'horizental' | 'vertical') => {
  console.log(`对比度调整: 拖动方向 ${towards} 步长 ${step}`);
});
```

### 5.6 暂停标注 —— 只读预览 <Badge type="tip" text="3.10.0" />

```typescript
nrrdTools.setAnnotationSuspended(true);   // 仅可预览
nrrdTools.setAnnotationSuspended(false);  // 恢复标注
const suspended = nrrdTools.isAnnotationSuspended();
```

暂停期间，**任何输入都无法写入 mask**。所有只读的操作照常可用，病例仍然可以完整浏览：

| 仍然可用 | 被拦截 |
|----------|--------|
| 切片浏览（拖动、滚轮、`setSliceMoving`） | 铅笔 / 画笔 / 橡皮擦 |
| 缩放与平移（右键拖动） | 放置 sphere |
| 放置十字准线 | SphereBrush / SphereEraser |
| 窗宽 / 窗位 | AI-assist 提示点 |

典型场景是"病例图像还在陆续到达"的那段时间：

```typescript
nrrdTools.setAnnotationSuspended(true);
await loadAllContrasts(caseId);
nrrdTools.commitSeriesLoad(allSlices, skipEntries, 0);
nrrdTools.setAnnotationSuspended(false);
```

::: warning 把自己的工具栏按钮置灰并不等价
必须在引擎内部拦截，有两个原因：

1. 在加载**开始之前**就已经选中的工具，在画布上仍然是激活的 —— 按钮是灰的，但左键拖动照样画得上去。
2. 加载期间画下的笔画撤不回来。每有一个切片到达，`afterLoadSlice` 都会清空 undo 栈，于是 mask
   留下了这一笔，而能撤销它的历史却被下一个到达的切片丢掉了。
:::

拦截点只有一处 —— `DrawToolCore.onCanvasPointerDown` —— 而不是分散在各个工具里，所以以后新增的
工具默认就被覆盖到。

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

### 6.5 Per-Layer 透明度

每个 layer 可以拥有独立的透明度值 (0.1–1.0)，与现有的全局透明度 (`setOpacity()`) 叠加。最终渲染透明度 = `globalAlpha × layerOpacity[layerId]`。

```typescript
// 将 layer2 的透明度设为 50%
nrrdTools.setLayerOpacity('layer2', 0.5);

// 读取某个 layer 的透明度
const opacity = nrrdTools.getLayerOpacity('layer2'); // → 0.5

// 读取所有 layer 的透明度
const opacityMap = nrrdTools.getLayerOpacityMap();
// → { layer1: 1.0, layer2: 0.5, layer3: 1.0, layer4: 1.0 }
```

> **渲染行为**: Per-layer 透明度在 `compositeAllLayers()` 合成时通过 `masterCtx.globalAlpha` 应用，不会修改体素数据。
>
> **默认值**: 所有 layer 初始透明度为 `1.0`（相对于 globalAlpha 完全不透明）。

**淡化背景层的使用场景：**

```typescript
// 淡化 layer1 和 layer3，保持 layer2 完全可见
nrrdTools.setLayerOpacity('layer1', 0.3);
nrrdTools.setLayerOpacity('layer3', 0.3);
nrrdTools.setLayerOpacity('layer2', 1.0);
```

**UI Slider 集成：**

`getSliderMeta("layerAlpha")` 返回当前活跃 layer 的透明度 slider 元数据：

```typescript
const meta = nrrdTools.getSliderMeta('layerAlpha');
// → { value: 0.5, min: 0.1, max: 1, step: 0.01 }
```

用于 `OperationCtl.vue` 的 "Layer Alpha" slider radio 选项。

### 6.6 整体读取与替换一个图层的 volume

有三种方式可以整体地把体素搬进/搬出一个图层。它们的区别在于**有没有东西进 undo 栈**，选哪个就看这一点：

| 方法 | 可撤销 | 说明 |
|------|--------|------|
| `getLayerVolume(id)` | — | 返回体素缓冲区的一份**拷贝**；图层没有 volume 时返回 `null` |
| `replaceLayerVolume(id, data, { undoable })` | 可选 | `undoable: true` 会为整个 volume 记一步 Ctrl+Z |
| `copyLayerData(src, dst)` | **否** | 直接写入目标缓冲区，不给 Ctrl+Z 留下任何东西 |

```typescript
// 把 mask 从 layer2 搬到 layer3，并且可撤销
const voxels = nrrdTools.getLayerVolume('layer2');
if (voxels) nrrdTools.replaceLayerVolume('layer3', voxels, { undoable: true });
```

`getLayerVolume` 交出来的是拷贝而不是活的缓冲区：渲染器自己的数组不能被外部改动，否则它背后的
切片缓存没有任何东西会去失效。

::: tip 优先用这一对，而不是 `copyLayerData` <Badge type="tip" text="3.10.4" />
`copyLayerData(src, dst)` 仍然保留，用于它当初被写出来的那个场景 —— 在前端镜像一次后端的级联
（改 layer2 意味着 layer3 也要改），省掉一次网络往返。它更快，也会保留目标图层的颜色映射，
但读片者撤销不了。只要这次变更是**人触发**的，就走 `getLayerVolume` + `replaceLayerVolume`。
:::

`replaceLayerVolume` 自身**不会**触发 `onLayerVolumeReplaced` —— 调用方（比如 mask 上传流程）
应当自己去持久化这个新 volume。该回调只在之后读片者撤销或重做这次替换时才触发，因为那时后端手里
还是更新的那一版，需要被告知回退。

### 6.7 擦除单个通道 —— `clearChannel()` <Badge type="tip" text="3.10.2" />

```typescript
nrrdTools.clearChannel('layer1', 3);  // 3 号 finding 被清除；1、2、4 保留
```

这是 clear 家族的第三个成员。`executeAction("clearActiveSliceMask")` 作用于一个切片，
`executeAction("clearActiveLayerMask")` 作用于整个图层 —— 两者都无法只针对一个 label。
而删除**某一个标注**恰恰需要这种粒度：它的 mask 只是一个 label，和该图层上所有其他标注共享
同一个 volume。

| 方法 | 作用范围 |
|------|----------|
| `clearActiveSlice()` | 一个切片，所有通道 |
| `clearChannel(id, ch)` | 一个通道，所有切片 |
| `clearActiveLayer()` | 一个图层，全部内容 |
| `reset()` | 所有图层，全部内容 |

**它可以撤销。** 产生的 delta 会进入引擎自己的 undo 栈，所以只要病例还开着，误操作就能救回来：

```typescript
nrrdTools.clearChannel('layer1', 3);
nrrdTools.undo();   // 3 号 finding 回来了
```

这正是要用它、而不是自己往 volume 里写 0 再强制重绘的原因 —— 从外部写入会绕过 undo 栈，
误清除就变成不可逆的了。

只有**确实带有该 label** 的切片才会被触碰，所以深体数据里的一个小标注，代价是一次扫描加少量
`getMaskData` 回调，而不是每个切片一次回调。如果该通道本来就是空的，既不会入栈也不会触发回调。

::: warning 错误是抛出的，不是吞掉的
- `layerId` 不存在 → 抛 `Error`，并列出已知图层。它**刻意**不走 `getVolumeForLayer` ——
  后者只会 warn 然后回退到第一个图层，而对一个破坏性操作来说，那等于悄悄擦掉了另一个图层的标注。
- `channel` 超出 `[1, 255]` → 由 `MaskVolume` 抛 `RangeError`。`0` 表示"空"，不是一个可以清除的通道。
:::

它没有并入 `executeAction`：后者的签名是"动作名 + 可选参数包"，而这个方法需要两个必填参数。

---

## 7. 通道颜色自定义

每个图层都有完全独立的颜色映射表。

### ⚠️ 时序要求 — 必须在 `setAllSlices()` 之后调用

颜色 API 依赖 `protectedData.maskData.volumes` 中存在对应的 `MaskVolume` 实例。如果在 `setAllSlices()` 完成之前调用，方法会触发内部守卫检查，输出 `console.warn` 后直接 `return`，**静默失败，无任何视觉变化，也不会抛出异常**。

```typescript
// ❌ 错误：onFinishedCopperInit 仅表示 Copper3D 渲染器初始化完毕，
//         此时尚未加载任何 NRRD 影像。
//         protectedData.maskData.volumes["layer1"] 为 undefined，
//         setChannelColor 触发 console.warn 后静默退出。
const onFinishedCopperInit = (data) => {
  nrrdTools.value = data.nrrdTools;
  nrrdTools.value.setChannelColor('layer1', 1, { r: 25, g: 0, b: 0, a: 255 }); // ← 静默失败
};

// ✅ 正确：在图像加载完成后调用（setAllSlices() 已在此之前执行）
const handleAllImagesLoaded = (res) => {
  nrrdTools.value.setChannelColor('layer1', 1, { r: 25, g: 0, b: 0, a: 255 }); // ← 生效
};
```

`LayerChannelManager.setChannelColor()` 内部守卫：

```typescript
const volume = this.protectedData.maskData.volumes[layerId];
if (!volume) {
  console.warn(`setChannelColor: unknown layer "${layerId}"`); // ← 静默警告
  return;  // ← 退出，颜色从未被设置
}
```

`MaskVolume` 实例（含正确的体素维度）仅在 `DataLoader.setAllSlices()` 内部创建。在此之前，`volumes` 映射表为空。

### 默认通道颜色表

通道 **1–8** 自带一套固定的、人工挑选的配色：

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

#### 通道 9–255 为自动生成 <Badge type="tip" text="3.10.2" />

`MaskVolume` 每个体素存一个字节，而这个值**本身就是** label，因此引擎支持 **255 个标注通道**
（`0` 表示空）。这个上限通过 `Copper.MAX_ENGINE_CHANNEL` 暴露。

8 号之后的通道，颜色由黄金角色相步进（每步 137.508°）生成，饱和度和亮度固定。只让**色相**变化
是刻意的：这些 mask 叠在灰度 MRI 上，如果不同通道之间**明度**也在变，读片者会把它当成图像本身的
差异，而不是标注的差异。

上面这 8 个种子色是原样保留的，不参与生成，所以在此改动之前标注并已签发的病例，颜色和当初读到的
完全一致。

::: warning "互不相同"不等于"能分辨"
超过大约 20 个通道之后，相邻色相在灰度背景上就无法用肉眼区分了。这是对"你的产品一次应该提供多少
个 finding"的限制，而不是对引擎返回什么的限制 —— 255 个都可寻址，但只有前 ~20 个是真正易读的。
:::

```typescript
import { MAX_ENGINE_CHANNEL, CHANNEL_HEX_COLORS } from 'copper3d';

MAX_ENGINE_CHANNEL;          // → 255
CHANNEL_HEX_COLORS[3];       // → '#3b82f6'（内置）
CHANNEL_HEX_COLORS[42];      // → 自动生成，多次运行结果稳定
```

四套调色板 —— `MASK_CHANNEL_COLORS`、`MASK_CHANNEL_CSS_COLORS` / `CHANNEL_COLORS`、
`CHANNEL_HEX_COLORS`，以及 AI scratch 的那一对 —— 都按同样方式扩展，并且是**预先构建**好的，
所以对它们用 `Object.entries` 遍历和以前一样可用。

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
| 滚轮:缩放 快捷键 | `Ctrl+1` |
| 滚轮:切片 快捷键 | `Ctrl+2` |

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

### Mask 渲染模式 —— 填充还是描边 <Badge type="tip" text="3.10.3" />

```typescript
nrrdTools.setMaskRenderMode('outline');  // 只描出边界
nrrdTools.setMaskRenderMode('fill');     // 填充整个轮廓内部（默认）
const mode = nrrdTools.getMaskRenderMode(); // → 'fill' | 'outline'
```

`"outline"` 只描每个 mask 的边缘，内部留空，让下面的组织依然可读 —— 这正是它的意义：读片者可以
同时看到自己标了什么、以及标在什么上面。

::: tip 这纯粹是显示层的决定
`MaskVolume` 的读取方式没有变，更完全不会被写入。无论哪种模式，存储、上传、导出、撤销的都是完整
的 mask，所以切换模式绝不可能丢数据。
:::

它对**所有图层和所有通道同时生效** —— 没有 per-layer 的版本。它会像 `setChannelVisible` 一样
立即重绘，所以设置的那一刻画面就变了，而不用等到下一次切片滚动。

默认是 `"fill"`，也就是所有现有调用方本来就得到的行为。

**开销。** 边界按每个可见 label 提取一次，并和该切片的填充路径缓存在一起。切换模式时，每个可见
label 第一次会付一次提取，之后每次都是缓存命中；而一个从不离开填充模式的会话，永远不会去构建
outline。outline 提取的代价随**周长**而不是面积增长，所以比它替代掉的填充更便宜。

::: warning 绘制始终作用在实心 mask 上
铅笔和橡皮擦是从图层画布上的像素重建切片的，所以无论当前显示模式是什么，它们在一次笔画期间都会把
图层渲染成实心，笔画结束（pointer-up）后再恢复显示模式。你不需要退出 outline 模式才能标注 ——
但如果你自己写的工具也要把画布烘焙回 volume，那它同样必须按实心渲染（见
[架构指南](./segmentation-module)）。
:::

### 画布尺寸

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
| | `clearChannel(id, ch)` | 跨整个图层擦除单个通道，可撤销。图层不存在或通道超出 [1, 255] 时抛错 |
| | `setAllSlices(slices)` | 传输入 NRRD 片帧并开起创办出 MaskVolume 及相关的一切后项基要 |
| | `setMasksFromNIfTI(map, bar?)` | 接收下载取回解包裹出的所有层 NIfTI 形式的三阶位像素块存组重返到屏幕显示面上（每个 buffer 必须先经 `registerNiftiMaskGrid` 注册，否则会被拒绝） |
| | `registerNiftiMaskGrid(data, dims)` | *（模块导出，不是实例方法）* 记录 mask buffer 的 NIfTI 体素网格，供 `setMasksFromNIfTI` 校验 |
| | `notifyUser` | *（可赋值属性）* 引擎消息如何呈现给用户；默认写 console |
| **对比度序列** | `addSkip(index)` | 隐藏一个对比度（索引指向完整对比度列表） |
| | `removeSkip(index)` | 重新显示一个被隐藏的对比度 |
| | `setSkips(entries)` | `addSkip`/`removeSkip` 的批量形式 —— 多次变更只刷新一次 |
| | `setContrastIndex(index)` | 在 **`displaySlices`** 内切换对比度，不移动切片 |
| | `commitSkipsAndContrast(entries, i)` | `setSkips` + `setContrastIndex` 的批量形式 —— 只刷新一次 |
| | `commitSeriesLoad(slices, entries, i)` | 病例加载收尾：换序列 + 对齐 skip + 落到目标对比度，只刷新一次 |
| | `switchAllSlicesArrayData(slices)` | 替换已加载的序列（会重置切片索引 / 缩放 / 平移） |
| | `switchSlicesPreservingView(slices)` | 替换已加载的序列，保留切片索引、缩放和平移 |
| **渲染部分** | `start` | 一组用去刷新重现覆盖表里的挂帧刷绘画层动作钩件方法函数 —— 它用来投入至全局循动描渲周期系统当中 |
| **图层** | `setActiveLayer(id)` | 指令调切换过去另至另一块为被作为画改作用焦聚的图层中去 |
| | `getActiveLayer()` | 查证核检取回当下现在被聚焦中用来修改活动所在的图层代号 |
| | `setLayerVisible(id, bool)` | 指令定准切换图块被开启可视亦或者是做暂蔽关闭起来的指令 |
| | `isLayerVisible(id)` | 给询取是否仍正在屏表呈可视化现中 |
| | `getLayerVisibility()` | 给取到整体一全套涵盖每样有跟所有的有关各家可见性的数据全字典信息 |
| | `hasLayerData(id)` | 让鉴查这个被指定的某个层面中究竟是不是真的存了非归 0 数字数值的内容像素区块等 |
| | `getLayerVolume(id)` | 返回该图层体素缓冲区的一份**拷贝**，或 `null` |
| | `replaceLayerVolume(id, data, opts?)` | 替换整个缓冲区；`{ undoable: true }` 记一步 Ctrl+Z |
| | `copyLayerData(src, dst)` | 在图层之间复制体素 —— **不可撤销**；保留目标图层的颜色映射 |
| | `setLayerOpacity(id, opacity)` | 设置 per-layer 透明度 (0.1–1.0)，触发重渲染 |
| | `getLayerOpacity(id)` | 获取指定 layer 的透明度 |
| | `getLayerOpacityMap()` | 获取所有 layer 的透明度值 |
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
| | `MAX_ENGINE_CHANNEL` | *（模块导出）* 可存储的最大 label 值，`255` |
| **笔具模式** | `setMode(mode)` | 切换工具模式: `"pencil"` / `"brush"` / `"eraser"` / `"sphere"` / `"calculator"` / `"sphereBrush"` / `"sphereEraser"` |
| | `getMode()` | 获取当前工具模式 |
| | `isCalculatorActive()` | 检查是否在 calculator 模式 |
| | `setAnnotationSuspended(bool)` | 拦截所有会写入 mask 的输入；切片浏览、缩放、平移、十字准线仍然可用 |
| | `isAnnotationSuspended()` | 查询当前是否处于暂停标注状态 |
| **球形画笔** | `setSphereBrushRadius(radius)` | 设置球形画笔/橡皮擦半径 [1, 50] |
| | `getSphereBrushRadius()` | 获取当前球形画笔/橡皮擦半径 |
| **注绘操作** | `setOpacity(value)` | 给那个透明盖图层罩薄厚度下注定义设 [ 从0.1 透明最清至 1 完全厚填实实底 ] 之间的范数 |
| | `getOpacity()` | 寻要探出当前的这盖覆实透明薄薄度现在正给多少数值内 |
| | `setMaskRenderMode(mode)` | 对所有图层/通道设置 `"fill"` 或 `"outline"`，立即重绘。仅影响显示，存储的 mask 不变 |
| | `getMaskRenderMode()` | 读取当前渲染模式 |
| | `setBrushSize(size)` | 为现在使用的涂画擦拭这些刷头物设定那 [最小5, 最大50 ]这域段面之大中小号体积 |
| | `getBrushSize()` | 要求交探出现在这个画笔刷的大体积给现多少数值啊 |
| | `setPencilColor(hex)` | 直接把那一串代表特定给拿做以画走着线条模式下才单独生效去展示的那股边线表线颜调换掉色吧 |
| | `getPencilColor()` | 那给找出给返回展示来看出看究竟那铅单划线上所带有附的色彩当前调何种样子样色呀 |
| **对比度** | `setWindowHigh(value)` | 给予特去设上把最高视亮度向高标数值定义 |
| | `setWindowLow(value)` | 给予专向底层向下那最为向至黑低值的那个定义设定底数区间值 |
| | `finishWindowAdjustment()` | 当松开发下放结束在做了那些拉调节过后，令令去全局各切面帧一起整体全面执行更新刷上一最新次底图展现吧 |
| | `getSliderMeta(key)` | 特给予前端专门界面拉推条提供给个它必须包含在最低，至上顶及进阶滑的数字全态底包包囊交由了 UI 那边去处理用（支持 key: `"globalAlpha"`, `"layerAlpha"`, `"brushAndEraserSize"` 等） |
| **动作操作** | `executeAction(action)` | 送指令执跑启动这套: 单次的撤退`"undo"` / 或一次追回`"redo"` / 清这当下一副全图`"clearActiveSliceMask"` / 扫去扫清那整一本满册所有的卷层包`"clearActiveLayerMask"` / 大视角回定复原`"resetZoom"` / 去直接给向外提取拉带载出去现今这个截页面遮版图图去留做别保存用 `"downloadCurrentMask"` / 高斯平滑 `"gaussianSmooth"` |
| **高斯平滑** | `GaussianSmoother.gaussianSmooth3D(volume, channel, sigma?, spacing?)` | 对 MaskVolume 中指定 channel 的 mask 执行 3D 高斯平滑 |
| | `GaussianSmoother.generateKernel1D(sigma)` | 生成归一化 1D 高斯核 |
| **浏览导向** | `setSliceOrientation(axis)` | 切换观察轴 `"x"` / `"y"` / `"z"`；若加载时跳过了该切片面，会在此按需抽取 |
| | `setSliceMoving(step)` | 按 `step` 移动当前切片（合并进一次 `requestAnimationFrame`） |
| | `setMainAreaSize(factor)` | 设置主区域缩放系数 [1, 8] 并重新摆放绘制区域 |
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
type ChannelColorMap = Record<number, RGBAColor>; // key = 通道编号，1-255

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

// 工具模式类型（用于 setMode/getMode）
type ToolMode = "pencil" | "brush" | "eraser" | "sphere" | "calculator" | "sphereBrush" | "sphereEraser";

// Mask 渲染模式（用于 setMaskRenderMode/getMaskRenderMode）
type MaskRenderMode = "fill" | "outline";

// 键盘快捷键设置
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
type ChannelValue = number; // 0 = 空/已擦除，1..MAX_ENGINE_CHANNEL (255)
```

::: tip 从 3.10.2 起，`ChannelValue` 是裸 `number`
它原本是联合类型 `1 | 2 | ... | 8`。255 个成员的联合类型写不出来，所以"字面量写错时的编译期报错"
这一层保护没有了 —— 现在改为运行时由 `MaskVolume` 抛 `RangeError`。这确实是一项损失，也是换取
这个取值范围的代价：存储是每体素一个字节、值本身就是 label，引擎没有立场把上限卡得比字节更低。
要不要卡到更小的范围，是产品自己的事。
:::

---

## 15. 高斯平滑 (Gaussian Smoothing)

NrrdTools 内置了 3D 高斯平滑功能，用于平滑分割 mask 的锯齿边缘和填充小孔。

### 原理

对指定 channel 的标注 mask 执行可分离 3D 高斯模糊（X→Y→Z 三轴依次卷积），然后以 0.5 为阈值二值化回 mask。

### 使用方式

通过 `executeAction` 调用：

```typescript
// 使用默认 sigma（1.0）
nrrdTools.executeAction("gaussianSmooth");

// 指定 sigma 值
nrrdTools.executeAction("gaussianSmooth", { sigma: 2.0 });
```

**参数**：
- `sigma`（可选，默认 `1.0`）：高斯核的标准差（以体素为单位）。值越大，平滑程度越高。

### 各向异性间距支持

当 NRRD 图像的体素间距不均匀时（如 `[0.488, 0.488, 1.0]`），平滑会自动根据间距调整各轴的 sigma，确保物理空间中的平滑半径是各向同性的：

```
per-axis sigma = sigma / spacing[axis]
```

间距信息自动从 `nrrd_states.image.voxelSpacing` 获取。

### Undo 支持

高斯平滑操作**完全可撤销**。执行前会对所有包含目标 channel 的 Z 切片进行快照，执行后推送到 UndoManager 的撤销栈。

```typescript
// 执行平滑
nrrdTools.executeAction("gaussianSmooth", { sigma: 1.5 });

// 撤销平滑操作（恢复所有受影响的切片）
nrrdTools.undo();
```

### 后端同步

平滑完成后，会自动为所有被修改的切片触发 `onMaskChanged` 回调，通知后端更新数据。

### Vue 组件集成

在 `OperationCtl.vue` 中，"Smoothing: Gaussian" 按钮和 "Smooth Sigma" slider 提供了完整的 UI 控制：

```typescript
// OperationCtl.vue 中的调用方式
emitter.emit("Segmentation:SwitchAnimationStatus", { status: "flex", text: "Smoothing: Gaussian..." });
setTimeout(() => {
  try {
    nrrdTools.executeAction("gaussianSmooth", { sigma: smoothSigma.value });
    toast.success("Gaussian smoothing completed");
  } catch (e) {
    toast.error("Gaussian smoothing failed");
  } finally {
    emitter.emit("Segmentation:SwitchAnimationStatus", { status: "none" });
  }
}, 50);
```

> **注意**：由于平滑是同步操作（在主线程执行），使用 `setTimeout` 延迟 50ms 让 UI 有机会先渲染加载动画。

### GaussianSmoother API

`GaussianSmoother` 是一个纯静态工具类，无 DOM/Canvas/GUI 依赖：

| 方法 | 签名 | 说明 |
|------|------|------|
| `gaussianSmooth3D` | `(volume: MaskVolume, channel: number, sigma?: number, spacing?: [number, number, number]): void` | 对指定 channel 执行可分离 3D 高斯平滑（就地修改 volume） |
| `generateKernel1D` | `(sigma: number): Float32Array` | 生成归一化 1D 高斯核，截断于 ±3σ |

### 性能优化

GaussianSmoother 经过两项关键性能优化：

1. **直接数组访问**：提取和写回阶段绕过 `getVoxel()`/`setVoxel()` 的边界检查和函数调用开销，直接通过 `volume.getRawData()` 访问底层 `Uint8Array`，使用 `volume.getBytesPerSlice()` 和 `volume.getChannels()` 内联计算索引。
2. **去分支卷积**：`convolve1D` 内部将卷积循环拆分为三段 — 左边界（带下界检查）、中间段（无任何分支判断，占 95%+ 工作量）、右边界（带上界检查）。

> **影响范围**：仅修改 `GaussianSmoother.ts`，不影响其他 Tool 的 `getVoxel`/`setVoxel` 调用。
