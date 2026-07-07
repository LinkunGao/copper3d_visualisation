# Copper3D 表面标注 API（Surface Annotation）— 中文文档

> 适用版本：`copper3d_visualisation` v3.6.0-beta 起
> 模块位置：`src/ts/Utils/surfaceAnnotation/`，通过 `copperScene.createSurfaceAnnotator()` 暴露

## 1. 概述

表面标注让你在**任意 3D 模型表面**上：

- 画 **contour 轮廓线**，两种模式：
  - **Freehand（自由手绘）**：按住左键拖拽，笔触实时投射到表面。
  - **Geodesic（测地线）**：点击若干锚点，自动沿网格表面求最短路径连接（贴合表面），并做平滑处理。**拖拽**锚点可移动它，**右键**删除，**点击线段**可在两点间插入新锚点；按 `Enter` 结束。已完成的测地线之后可再次选中，继续编辑它的锚点。
- 放 **标记点（fiducial points）**。
- 轮廓可**闭合成环**（闭合段也沿表面走，不穿模）。
- **多条标注**，每条带颜色 / 标签，支持选中 / 改名 / 改色 / 删除 / 撤销 / 清空。
- **导出坐标**为 JSON，默认 **模型 local 坐标**（不受相机或模型摆放影响，可复现）。

**格式无关**：标注器作用于 `THREE.Mesh`，不绑定任何 loader。OBJ / glTF / GLB / VTK / STL… 只要能加载成 mesh 都支持。也可直接传 `Group/Object3D`（内部自动挑顶点数最多的 mesh）。

**不破坏你的模型**：测地线需要"按表面位置连通"的几何。标注器**内部单独焊接一份"仅位置"的几何**给寻路用，**不会改动你 mesh 的法线 / UV / 纹理**。

## 2. 快速开始

```ts
import * as Copper from "copper3d_visualisation";

const appRenderer = new Copper.copperRenderer(container, { guiOpen: false });
const scene = appRenderer.createScene("annot") as Copper.copperScene;
appRenderer.setCurrentScene(scene);
appRenderer.animate();

// 加载模型（用 copper 自带 loader），在回调里创建标注器
scene.loadOBJ("/models/heart.obj", (group) => {
  const annotator = scene.createSurfaceAnnotator(group);

  // 武装一个工具；随后按住/轻点 Space 进入绘制（见 §4）
  annotator.setMode("freehand"); // 或 "geodesic" / "point" / "navigate"

  // 导出（默认 local 坐标）
  // const data = annotator.exportJSON("heart.obj");
});
```

> **取景与光照由你负责**：标注器只复用 scene 的 camera/container/controls，不主动设相机或加灯。用 `scene.loadViewUrl()`、手动设相机、或自加灯光。

## 3. API 参考

### 3.1 `copperScene.createSurfaceAnnotator(target, opts?)`

```ts
createSurfaceAnnotator(
  target: THREE.Mesh | THREE.Object3D,
  opts?: {
    freehandColor?: string;   // 自由手绘色，默认 "#e5006e"
    geodesicColor?: string;   // 测地线色，默认 "#ffa24e"
    pointColor?: string;      // 标记点色，默认 "#ffd166"
    lineWidth?: number;       // 线宽(像素)，默认 3
    markerRadius?: number;    // 小球半径，默认 bbox 对角线 * 0.0032
    bboxDiagonal?: number;    // 手动指定尺寸基准，缺省自动从几何算
    onModeChange?: (mode: AnnotationMode) => void;
    onChange?: (annotations: Annotation[]) => void; // 标注列表增删/撤销/清空时触发
    onInteractionChange?: (s: InteractionState) => void; // 绘制状态/武装工具/锁定/编辑态变化时触发（见 §4）
    onSelectionChange?: (id: string | null) => void;     // 引擎自身改变选中时触发（删除、回到 navigate 时取消选中）—— 用于同步你的列表 UI 高亮
  }
): SurfaceAnnotator
```

- `target` 为 `Mesh` 时直接用；为 `Group/Object3D` 时挑顶点数最多的 mesh。找不到 mesh 会抛错。
- 复用 `scene.camera / scene.container / scene.controls`，无需手动传。
- 几何非索引时内部会处理（仅用于寻路，不动你的 mesh）。

### 3.2 `copperScene.disposeSurfaceAnnotators()`

释放该 scene 创建的所有标注器（移除全局事件监听）。

### 3.3 `SurfaceAnnotator` 实例方法

| 方法 | 说明 |
|---|---|
| `setMode(mode)` | 切换模式：`"navigate"` / `"freehand"` / `"geodesic"` / `"point"` |
| `getMode()` | 返回当前模式 |
| `getAnnotations()` | 返回当前标注列表快照 `Annotation[]` |
| `getStore()` | 返回底层 `AnnotationStore`（高级用法：订阅/改名/改色） |
| `selectAnnotation(id \| null)` | 选中某条（高亮：轮廓加粗 / 点放大），传 `null` 取消选中。选中会**自动切换到画它所用的工具**（点 → `point`，轮廓 → 其 `freehand`/`geodesic` 模式）；若是测地线，会随之重新打开它的锚点手柄以供编辑 |
| `refreshAnnotation(id)` | 改色后重画对应 3D 对象（配合 `store.setColor`） |
| `setVisible(id, visible)` | 显示 / 隐藏某条标注（只切换其 3D 对象，数据保留） |
| `deleteAnnotation(id)` | 删除某条。若删的正是当前正在编辑的测地线，会一并拆除它的锚点手柄（不留残余） |
| `undo()` | 撤销最近的添加 / 删除。当某条测地线正在绘制/编辑时，改为撤销最近一次锚点编辑（加 / 移动 / 删除 / 插入） |
| `clearAll()` | 清空全部 |
| `importAnnotations(payload)` | 从导出对象重建标注（见 §6），返回导入条数。缺法线时从网格最近顶点恢复，缺 `visible` 默认为 `true`。导入的每条均为一等公民（可选中 / 改色 / 隐藏 / 删除 / 导出） |
| `exportJSON(modelName, opts?)` | 导出为 JS 对象，见 §6 |
| `activate()` | *（多模型）* 把此标注器设为**活动**的那个 —— （重新）挂上它的全局监听，使 `Space` / 工具 / 指针作用于**这个**模型。幂等。同一时刻只激活一个（先 `deactivate` 上一个） |
| `deactivate()` | *（多模型）* 让此标注器进入**休眠**：提交正在编辑的测地线（未定稿的则丢弃），复位 draw-lock，解除相机门控（`controls.enabled = true`），再摘掉监听。它已提交的线/点**仍留在场景中、保持可见**，只是不再响应输入。幂等 |
| `setAllVisible(visible)` | *（多模型）* 一次性显示 / 隐藏此模型的**全部**标注（单次 reconcile）—— 用于每个模型的「一键隐藏所有标注」开关。不删除数据 |
| `dispose()` | 释放（移除事件监听）。卸载组件时务必调用 |

### 3.4 `getStore()` 常用方法（`AnnotationStore`）

| 方法 | 说明 |
|---|---|
| `subscribe(cb)` | 订阅列表变化，返回取消订阅函数 |
| `list()` / `get(id)` | 取列表 / 取单条 |
| `setLabel(id, label)` | 改名（改后 UI 自动刷新；3D 无需重画） |
| `setColor(id, color)` | 改色（**改后需调 `annotator.refreshAnnotation(id)` 更新 3D**） |
| `setVisible(id, visible)` | 显示 / 隐藏（也可经 `annotator.setVisible` 调用） |

### 3.5 类型

```ts
type AnnotationMode = "navigate" | "freehand" | "geodesic" | "point";

interface AnnotationVertex {       // 位置与法线均为模型 local 空间
  x: number; y: number; z: number;
  nx: number; ny: number; nz: number;
  faceIndex: number;
}

interface Annotation {
  id: string;
  type: "contour" | "points";
  mode: "freehand" | "geodesic" | null; // points 为 null
  label: string;
  color: string;                         // hex
  closed: boolean;
  visible: boolean;                      // 单条显示/隐藏（默认 true）
  vertices: AnnotationVertex[];
  anchors?: AnnotationVertex[];          // 仅测地线轮廓：控制点，使已提交的轮廓可被重新打开编辑（随导出/导入一同保存）
  object3D: THREE.Object3D | null;       // 渲染对象引用
}

interface ExportOptions {
  space?: "local" | "world";   // 默认 "local"
  includeNormals?: boolean;    // true 时点为 [x,y,z,nx,ny,nz]
}

// 实时交互状态，由 onInteractionChange 发出（见 §4）
interface InteractionState {
  drawing: boolean;            // 正在绘制时为 true（按住 Space 或处于 draw-lock）
  armed: AnnotationMode;       // 将要绘制的工具 —— "freehand" | "geodesic" | "point"
  locked: boolean;             // draw-lock 是否开启（轻点 Space 切换）
  editing: boolean;            // 当前有可编辑的测地线（正在绘制或重新打开的已提交轮廓）→ 其锚点可拖拽/删除/插入；可据此显示编辑提示
}
```

## 4. 交互与快捷键

标注器是 **navigate 优先**：选择某个绘制模式（`freehand` / `geodesic` / `point`）只会**武装（arm）**该工具，并**不会**接管鼠标 —— 相机旋转 / 缩放 / 平移默认保持可用。需要用 `Space` 显式进入**绘制**状态：

- **按住 `Space`** —— 瞬时：按住期间绘制，松开即回到导航。
- **轻点 `Space`**（快速一按，< 250 毫秒）—— 切换 **draw-lock（绘制锁定）**：绘制保持开启，直到再次轻点 `Space`。

只有在绘制状态下，标注器才接管左键并关闭相机旋转；否则相机自由。真正生效的是**被武装的工具**（而非菜单里的 mode），所以你可以先旋转模型，再按住/轻点 `Space` 立刻用选好的工具绘制。快捷键挂在 `window`（捕获阶段，确保不被 TrackballControls 抢走），并在 `<input>` / `<textarea>` 中输入时自动忽略。

| 操作 | 行为 |
|---|---|
| `1` / `2` / `3` / `4` | 武装 navigate / freehand / geodesic / point |
| 按住 `Space` | 瞬时绘制（松开 → 导航） |
| 轻点 `Space`（< 250ms） | 切换 **draw-lock**（绘制保持开启） |
| 左键拖拽（Freehand，绘制中） | 沿表面画线 |
| 左键点击空白表面（Geodesic，绘制中） | 加一个锚点；相邻锚点自动连成平滑测地线 |
| 左键**拖拽**锚点（Geodesic） | 移动它，相连的线段实时重算。只要测地线可编辑就能拖 —— 即使在 navigate 子态下 —— 于是你可以先旋转，再抓住某个点 |
| **右键**点击锚点（Geodesic） | 删除它（画布上的系统右键菜单已被屏蔽） |
| 左键点击**线段**（两锚点之间，Geodesic） | 在该处插入一个新锚点 |
| 左键点击（Place point，绘制中） | 放一个标记点 |
| `Esc` | 两段式：先取消当前选中 / 放弃正在绘制的测地线（仍留在当前工具）；再按一次（无选中时）回到 navigate |
| `Enter` | 闭合 / 结束当前 contour。若在编辑已提交的测地线 → 定稿并隐藏手柄 |
| `Ctrl + Z` | 撤销。当测地线正在绘制/编辑时，撤销最近一次锚点编辑（加 / 移动 / 删除 / 插入） |
| `Delete` / `Backspace` | 删除当前选中标注 |

**锚点命中**采用屏幕像素容差，不必精确点中小球。锚点手柄绘制为「白色外圈 + 工具色内核」，在线条与表面上都醒目；删除用右键（不再有逐点的 ✕ 图标）。

**编辑已提交的测地线。** 选中它（在列表里或通过 `selectAnnotation`）—— 因为选中会切换到 Geodesic 工具，它的锚点会作为可拖拽手柄重新出现。拖拽 / 右键 / 插入即可实时编辑；`Enter`、切换工具、选中别的、或 `Esc` 都会定稿。若锚点少于 2 个则删除该条。`Annotation.anchors`（以及导出的 `anchors`）正是它跨会话可再编辑的依据。

订阅 `onInteractionChange({ drawing, armed, locked, editing })` 可驱动实时模式指示器与测地线编辑提示（`editing` 为 true 时显示）。订阅 `onSelectionChange(id)`，让引擎自身触发的选中变化（删除、回到 navigate 时取消选中）同步到你的列表 UI。

## 5. 坐标空间（重要）

- **相机 pan / zoom / rotate 不改变坐标** —— 它们动的是相机，不是模型。
- 模型若被**移动 / 旋转 / 缩放**（对象变换或动画），只有 **local 坐标不变**。
- 因此标注器**内部以 local 存坐标**，渲染时再派生 world。
- `exportJSON` **默认 `space:"local"`** —— 可复现、绑定模型自身坐标系。需要场景实际位置时传 `{ space:"world" }`。

> 提示：若你在加载后**烘焙了缩放/平移进 geometry**（如 `geometry.scale()`），local 就会落在"已变换"的空间。想让 local = 原始模型文件坐标，请用**对象变换**（`mesh.position/scale`）或相机取景，**不要烘焙几何**。

## 6. 导出格式

`annotator.exportJSON("heart.obj")` 返回：

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
      "visible": true,
      "points": [[x, y, z], ["..."]],
      "anchors": [[x, y, z], ["..."]]
    },
    {
      "id": "a2",
      "type": "points",
      "mode": null,
      "label": "Point 2",
      "color": "#ffd166",
      "closed": false,
      "visible": true,
      "points": [[x, y, z]]
    }
  ]
}
```

`includeNormals: true` 时每个点为 `[x, y, z, nx, ny, nz]`。每条标注都带 `visible` 字段，因此经 `exportJSON` → `importAnnotations` 往返后，显示/隐藏状态会被保留。**测地线轮廓**还会额外带 `anchors`（其控制点，格式同 `[x,y,z]` / `[x,y,z,nx,ny,nz]`），因此重新导入的测地线仍可编辑；`importAnnotations` 会把它们映射回最近的图顶点。

> **用 `importAnnotations` 往返**：把导出的对象直接喂回去，即可在重新加载的模型上重建标注。点应为 **local** 空间（导出默认值）。`id` 仅对单点条目复用（让往返保持稳定 id），其余每条都会分配新 id 以避免冲突。若某点缺法线（只有 `[x,y,z]`），法线会从焊接图的最近顶点恢复。

## 7. 使用案例

### 案例 1 — 最小用法（OBJ）

```ts
scene.loadOBJ("/models/heart.obj", (group) => {
  const annotator = scene.createSurfaceAnnotator(group);
  annotator.setMode("geodesic");
});
```

### 案例 2 — GLB + 自定义颜色

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

### 案例 3 — 用 `onChange` 驱动列表 UI + 改名 / 改色

```ts
let annotator;
scene.loadOBJ("/models/heart.obj", (group) => {
  annotator = scene.createSurfaceAnnotator(group, {
    onChange: (annotations) => renderList(annotations), // 列表变化时刷新你的 UI
    onModeChange: (mode) => updateModeButtons(mode),
  });
});

// 选中 / 改名 / 改色
function onSelect(id) { annotator.selectAnnotation(id); }
function onRename(id, label) { annotator.getStore().setLabel(id, label); }
function onRecolor(id, color) {
  annotator.getStore().setColor(id, color);
  annotator.refreshAnnotation(id); // 必须，更新 3D 颜色
}
```

### 案例 4 — 导出（local / world / 带法线）+ 浏览器下载

```ts
const local = annotator.exportJSON("heart.obj");                       // 默认 local
const world = annotator.exportJSON("heart.obj", { space: "world" });   // 世界系
const withN = annotator.exportJSON("heart.obj", { includeNormals: true });

// 触发下载（注意：a 必须挂到 DOM 才能在部分浏览器触发）
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

### 案例 5 — 导入已存文件 + 单条显隐

```ts
scene.loadOBJ("/models/heart.obj", (group) => {
  const annotator = scene.createSurfaceAnnotator(group);

  // 重建此前导出的标注（例如从后端取回）
  const saved = await (await fetch("/api/annotations/heart.json")).json();
  const n = annotator.importAnnotations(saved); // 返回重建条数

  // 不删除，仅隐藏某一条
  annotator.setVisible(saved.annotations[0].id, false);
});
```

### 案例 6 — 用 `onInteractionChange` 做实时模式指示

```ts
scene.createSurfaceAnnotator(group, {
  onInteractionChange: ({ drawing, armed, locked, editing }) => {
    badge.textContent = drawing ? `Drawing — ${armed}${locked ? "（锁定）" : ""}` : "Navigate";
    editHint.hidden = !editing; // editing 时显示「拖拽移动·右键删除·点线段插入」提示
  },
  onSelectionChange: (id) => refreshListHighlight(id), // 引擎可能自行取消选中（删除 / 回到 navigate）
});
```

### 案例 7 — 卸载

```ts
// 组件卸载 / 切换模型时
annotator.dispose();          // 或 scene.disposeSurfaceAnnotators();
appRenderer.dispose();
```

### 案例 8 — 同一场景多个模型（activate / deactivate）

```ts
// 把同一 case 的多个模型加载进同一个 scene。每个模型一个标注器，
// 同一时刻只有一个「活动」（可编辑），休眠的模型轮廓保持可见但不响应输入。
const annotators = new Map<string, Copper.SurfaceAnnotator>();
let activeId: string | null = null;

function addModel(id: string, group: THREE.Object3D) {
  const a = scene.createSurfaceAnnotator(group);
  a.deactivate();                 // 加载即休眠 —— 取景/光照/框选仍由你负责
  annotators.set(id, a);
}

function setActive(id: string) {
  if (activeId) annotators.get(activeId)?.deactivate(); // 提交并清理旧的
  annotators.get(id)?.activate();                       // 此模型接管 Space / 工具
  activeId = id;
}

// 每个模型的「一键隐藏所有标注」（区别于隐藏模型表面网格）
function hideAllAnnotations(id: string, hidden: boolean) {
  annotators.get(id)?.setAllVisible(!hidden);
}

// 拆除单个模型，或整个 case
function removeModel(id: string) {
  annotators.get(id)?.dispose();  // 移除它的轮廓 + 监听
  annotators.delete(id);
  if (activeId === id) activeId = null;
}
```

> 引擎不会判断哪个是「主模型」，也不设相机 —— 那是宿主应用的职责（例如 Surface Annotator 应用会框选包围盒最大的模型）。标注器只复用 scene 里已有的相机 / controls。

## 8. 注意事项

- **取景 / 光照 / 加载** 都由你负责，标注器不碰。新模型记得自加灯光、设好相机。
- **改色后必须 `refreshAnnotation(id)`**：`store.setColor` 只改数据,3D 对象颜色靠它更新。`setLabel` 则不用（不影响 3D）。
- **快捷键是全局的（window）**：`1/2/3/4`、`Enter`、`Delete`、`Ctrl+Z`、`Space` 会被标注器监听。若你的页面别处也用这些键,可能冲突；不用时调 `dispose()` 解绑。
- **同一时刻只能有一个「活动」标注器，但可以共存多个**：事件挂在 window 捕获阶段，两个**活动**实例会同时响应 `Space` / 工具 / 指针。同一场景加载多个模型时，为每个模型建一个标注器并立即 `deactivate()`，只对要编辑的那个调 `activate()`（并 `deactivate()` 上一个）。休眠的标注器仍把轮廓留在场景里、只是不响应输入，所以切换模型不再需要 `dispose()` 后重新加载。新构造的标注器**默认是活动的**（向后兼容），因此单模型调用方无需改动。
- **测地线连通性**：若模型由**多个分离壳体**组成,跨壳体的测地线/闭合会退化成直线兜底。单一连通网格效果最好。
- **测地线性能**：堆 Dijkstra,约 3 万顶点单次点击 < 100ms。**超大网格**(几十万顶点)点击可能有延迟(最近顶点查找为 O(V))。
- **不会改你的 mesh**：内部用"仅位置"焊接的副本寻路,你 mesh 的法线/UV/纹理不受影响。但要求几何有 `position` 属性。
- **导出只给对象,不替你下载**:浏览器下载/UI 触发由你做(见案例 4 的 `appendChild` 坑)。
- **闭合是沿表面的**:`Enter` 用测地线把末点连回首点,不是直线弦,所以不会穿模。
- **Freehand 是屏幕笔触投射**:相邻采样点用直线段相连(不像 Geodesic 严格沿表面走)。掠过沟缝/轮廓边时,跳到背面/远面的采样点会被**自动剔除**(距离突变 + 法线翻转判据),避免直线段横穿模型;若需严格贴合表面,请用 **Geodesic** 模式。
- **相机门控（navigate 优先）**:标注器会改 `scene.controls.enabled`：**默认开启**（随时可旋转），**仅在绘制时关闭** —— 即按住 `Space` 或处于 draw-lock 期间。若你别处也在控制它,注意协调。
- **轮廓线与标记贴合表面、会被模型遮挡（不穿透）**：轮廓线沿法线抬升 `epsilon`，并开启深度测试（depthTest），配合对表面三角形的 polygon-offset「贴花」偏置——于是线在它所贴的表面上赢得深度测试（凹凸/体素网格上不闪烁），而位于模型背面时又会被正确遮挡（不穿透）。放点 / 测地线锚点标记是抬起的球体，同样开启深度测试。测地线锚点**手柄**绘制为「工具色内核 + 白色外圈」并再抬高一点，使其在线条与表面上都醒目。

## 9. 导出符号

从包根导出:

```ts
import {
  SurfaceAnnotator,            // 值(用于 instanceof / 类型)
} from "copper3d_visualisation";
import type {
  SurfaceAnnotatorOptions,
  Annotation,
  AnnotationMode,
  ExportOptions,
  InteractionState,
} from "copper3d_visualisation";
```

`createSurfaceAnnotator` 是 `copperScene` 的方法,通过 scene 实例调用。
