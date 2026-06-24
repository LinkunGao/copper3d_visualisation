# copper3d — AI Assist API(使用指南)

copper3d 包中 **AI Assist**(交互式提示分割)功能的公开 API。所有能力都挂在 `NrrdTools`
实例上,另外导出了几个类型和颜色常量。

> English version: `ai-assist-api.en.md`

```ts
import { NrrdTools } from "copper3d";
import type { AiPromptPayload, AiMaskResult, AiPromptTool } from "copper3d";
```

---

## 心智模型

copper3d **不**与你的模型/后端通信。它只负责:

1. 在当前切片上捕获用户的**提示**(点 / 框 / 涂鸦 / 套索);
2. 通过你的 `onPrompt` 回调,把可序列化的 `AiPromptPayload` 抛给你;
3. 把你回传的 **mask 结果**经 `aiApplyMask` 画进一块独立的**涂层(scratch)**(作为叠加层渲染)。

中间的网络调用由你负责。流程:

```
用户手势 ──▶ onPrompt(payload) ──▶ [你的后端] ──▶ aiApplyMask(result)
```

涂层是一个**沙箱**:在你调用 `aiCommitToLayer(...)`(合并)之前,什么都不会动到真正的 mask 图层。
进入 AI 模式会隐藏现有图层 mask、只显示 AI 叠加层;退出时恢复。

### Segmentations(颜色/标签模型)

涂层是一块**单通道**卷,voxel 的值就是一个**标签 label**(1–255)。一个 **Segmentation** =
一个 label + 你选的一个颜色。**不再有固定的 8 色调色板**:由宿主 app 持有 segmentation 列表
(id / 名字 / 颜色 / label),并通过 `aiSetSegmentColor` 把每个颜色推给 copper3d。可以有任意
多个 segmentation(最多 255 个 label)。

---

## 快速上手(端到端)

```ts
const tools = new NrrdTools(container);
// … 像平常一样把 NRRD case 加载进 `tools` …

// 1. 进入 AI Assist(创建涂层、隐藏图层 mask、接管画布)。
tools.enterAiAssistMode();

// 2. 配置提示工具 + 活动 segmentation(label + 颜色)。
tools.aiSetPromptTool("point");                       // "point" | "box" | "scribble" | "lasso"
tools.aiSetPolarity(1);                                // 1 = 前景(包含),0 = 背景(排除)
tools.aiSetSegmentColor(1, { r: 94, g: 200, b: 255, a: 255 }); // label 1 的颜色
tools.aiSetActiveSegment(1);                           // 画进 label 1

// 3. 接收提示 → 调你的模型 → 把结果画回去。
tools.aiOnPrompt(async (payload: AiPromptPayload) => {
  const result: AiMaskResult = await myBackend.predict(payload);
  tools.aiApplyMask(result);
});

// 4. 开一个新 segmentation(冻结当前、切到新 label/颜色)。
tools.aiSetSegmentColor(2, { r: 244, g: 63, b: 94, a: 255 });
tools.aiNewSegment(2);

// 5. 把 AI 叠加层合并进真正的 mask 图层(沙箱合并)。
if (tools.aiHasData()) tools.aiCommitToLayer("layer1");

// 6. 退出 AI 模式(恢复图层 mask)。
tools.exitAiAssistMode();
```

---

## API 参考

### 模式生命周期

#### `enterAiAssistMode(): void`
进入 AI 沙箱。隐藏所有图层 mask(并快照其可见性)、创建涂层、把左键路由为提示。右键拖拽仍可
平移;滚轮/滑块仍可翻切片。**不再应用固定调色板**——进入后用 `aiSetSegmentColor` 逐个推每个
segmentation 的颜色。已激活时为空操作。

#### `exitAiAssistMode(): void`
退出沙箱:丢弃涂层、恢复常规工具与进入时记录的图层 mask 可见性。若你先合并过
(`aiCommitToLayer`),合并结果已经在图层里,会随恢复的 mask 一起出现。未激活时为空操作。

#### `isAiAssistActive(): boolean`
AI 模式激活时返回 `true`。

---

### 提示配置

#### `aiSetPromptTool(tool: AiPromptTool): void`
选择手势:`"point"`(点种子)、`"box"`(拖矩形)、`"scribble"`(拖自由笔画)、`"lasso"`
(点点 → 闭合曲线,见**套索**)。**切换工具会重置当前提示集**(下一次手势是一次全新预测)。

#### `aiSetPolarity(label: number): void`
`1` = 前景(包含/添加),`0` = 背景(排除/抠除)。任何 ≠ 0 都按前景处理。

#### `aiSetScribbleSize(size: number): void`
涂鸦画笔半径(像素,夹在 1–40)。同时驱动实时预览圈和 payload 里的 `scribbleRadius`。

---

### Segmentations(label + 颜色)

一个 Segmentation 就是 AI 要画进的一个 **label 值** + 一个颜色。(取代旧的固定
`aiSetChannel(1-8)`。)

#### `aiSetActiveSegment(label: number): void`
按 label 值(1–255)选择活动 segmentation——之后的提示画进它。**切换 label 会重置当前提示集**
(以免进行中的预测把上一个 segmentation 重新上色)。

#### `aiSetSegmentColor(label: number, color: { r: number; g: number; b: number; a: number }): void`
设置某 segmentation 的颜色(该 label 在涂层 colorMap 里的项)。2D 叠加层下一帧重绘。进入后
每个 segmentation 调一次,用户改色时再调。

#### `aiNewSegment(label: number): void`  *("New segmentation" 按钮用这个)*
冻结当前区域(在后续预测中保留)**并**把活动 label 切到 `label`。等价于
`aiCommitRegion()` + `aiSetActiveSegment(label)`。

#### `aiClearSegment(label: number): void`
删除某 segmentation 的画:把该 label 的**所有**体素从活动涂层和冻结卷里清零,使该区域从画面
消失。宿主从列表里移除一个 segmentation 时用它。

```ts
// 新建 segmentation 按钮:
const next = currentMaxLabel + 1;
tools.aiSetSegmentColor(next, nextColour);
tools.aiNewSegment(next);

// 删除一个 segmentation(宿主从列表移除后):
tools.aiClearSegment(label);
```

---

### 套索 Lasso(闭合轮廓,点击落点)

套索**不是**自由拖拽。用户在目标周围**点击落点**,copper3d 用**平滑闭合曲线**(Catmull-Rom,
按极角排序所以永不自交)连起来并实时填充。在**完成**之前,什么都不发给你的模型。

- **加点**:左键点空白处。
- **删点**:hover 已有顶点(变红色 ✕)→ 左键点它。
- **完成**:双击,或调 `aiFinishLasso()`(如面板按钮 / Enter 键)。需 ≥3 个顶点;以
  `payload.lasso` 携带密采样后的轮廓触发 `onPrompt`。
- **撤销/重做顶点**:`aiLassoUndo()` / `aiLassoRedo()`。
- **取消**:`aiCancelLasso()`(如 Esc)。

#### `aiOnLassoChange(cb: (count: number, editing: boolean) => void): void`
注册回调,套索顶点集变化(加/删/撤销/重做/完成/取消)时触发。用于驱动 UI 里响应式的
「Finish lasso (N)」按钮。

#### `aiFinishLasso(): void`
闭合并发送套索(需 ≥3 顶点)。把闭合曲线密采样成轮廓,以 `payload.lasso` 触发 `onPrompt`,
然后清空编辑状态。

#### `aiLassoUndo(): void` / `aiLassoRedo(): void`
撤销/重做最后一次加点或删点(顶点级历史,独立于 mask 撤销)。

#### `aiCancelLasso(): void`
放弃进行中的套索。

#### `aiIsLassoEditing(): boolean` / `aiLassoVertCount(): number`
是否正在放顶点、放了几个——用于给 Finish 按钮 + 键盘做门控。

```ts
tools.aiSetPromptTool("lasso");
tools.aiOnLassoChange((count, editing) => {
  finishBtn.disabled = !editing || count < 3;
  finishBtn.textContent = `Finish lasso (${count})`;
});
// Enter → tools.aiFinishLasso(); Ctrl+Z → tools.aiLassoUndo(); Esc → tools.aiCancelLasso();
```

> **point 工具反馈**:`"point"` 模式下每次点击画一个种子 marker,光标显示十字准星;一旦预测
> 结果落地,marker 自动隐藏(只剩 mask)。

---

### 提示 ↔ 结果 管道

#### `aiOnPrompt(cb: (payload: AiPromptPayload) => void): void`
注册"提示手势完成"时触发的回调(点 = 点击时;框/涂鸦 = 抬起时;套索 = 完成时)。在回调里调用
你的模型,然后 `aiApplyMask`。payload 携带当前区域的**累积**提示集,所以每次都从整组重新预测。

#### `aiApplyMask(result: AiMaskResult): void`
把返回的 mask 画进涂层(画进活动 segmentation 的 label);叠加层下一帧重绘。支持 2D(单切片)和
3D(多切片)结果。

---

### 区域 / 沙箱管理

#### `aiClearPrompts(): void`
重置进行中的提示集(点/框/涂鸦/套索)。在切片/轴变化时使用。**不**冻结。

#### `aiCommitRegion(): void`
**冻结**目前画的一切,使其在后续预测中保留——即使同 label——但**不**切换 label。`aiNewSegment`
内部会调它;若你想要「冻结但留在当前 segmentation」的动作,可直接用它。

#### `aiDiscard(): void`
擦除自 `enterAiAssistMode` 以来 AI 画的**所有**内容(恢复到空快照,包括冻结的区域)。宿主通常还会
把自己的 segmentation 列表重置回 1 个。

#### `aiHasData(): boolean`
涂层当前含有任何已画体素时返回 `true`。

---

### 持久化 / 导出 AI mask

#### `aiGetScratchSegments(): { axis: "z"; width: number; height: number; segments: { label: number; slices: { sliceIndex: number; rle: number[] }[] }[] } | null`
把涂层**按 segmentation**序列化:**每个 label** 一组非空切片的二值 RLE(不二值化合并),这样后端能写出
**多 label** NIfTI 并给 GLB 按 segmentation 上色。没有涂层时返回 `null`。这是构建「按 segmentation
上色的 3D 模型」走的路径。

```ts
const vol = tools.aiGetScratchSegments();
if (vol && vol.segments.length) {
  const segments = vol.segments.map((s) => ({
    label: s.label,
    color: colourForLabel(s.label),   // [r,g,b] 你的 app 选的颜色
    slices: s.slices,
  }));
  await fetch("/api/ai/save-volume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caseId, axis: vol.axis, width: vol.width, height: vol.height, segments }),
  });
}
```

#### `aiGetScratchSlices(): { axis: "z"; width: number; height: number; slices: { sliceIndex: number; rle: number[] }[] } | null`
旧的**二值**序列化(任意非零 label → 1),每个非空 z 切片一条 RLE。保留给单 mask 的后端;要按颜色
输出请用 `aiGetScratchSegments`。

#### `aiCommitToLayerMapped(targetLayer: string, mapping: Record<number, number>): void`
按**逐 segmentation 映射**把 AI 涂层**合并**进真正的 mask 图层:`{ 涂层 label → 目标 channel }`。
`mapping` 里没有(或映射到 `0`)的 label 会被**丢弃**(不合并)。多个 label **可**映射到同一个
channel —— 合并后**身份按 channel 走**,所以合并的体素采用该 channel 的颜色(不是 AI segmentation
在沙箱里的颜色)。

**并集语义**:AI 体素只填目标里当前**为空(0)**的体素 —— 已有标注**永不抹除**。两个映射到不同 channel
的 label 在同一体素重叠时,先写者胜(迭代序)。扫描所有 z 切片(任意视图画的体素都捕获);单次可撤销。

```ts
// seg label 1 → channel 2,label 3 → channel 2(并到一起),label 4 丢弃:
tools.aiCommitToLayerMapped("layer3", { 1: 2, 3: 2 });
```

#### `aiCommitToLayer(targetLayer: string = "layer1"): void`
向后兼容薄壳:用 **identity 映射**(每个 label → 同号 channel)经 `aiCommitToLayerMapped` 合并。
同样的**并集**语义(只填空体素;已有标注保留)、单次可撤销、扫描所有 z 切片。这(或 mapped 形式)是
唯一把 AI 结果写进实际标注图层的调用。

---

## 类型

```ts
type AiPromptTool = "point" | "box" | "scribble" | "lasso";

interface AiPromptPoint {
  x: number;
  y: number;
  z?: number;
  label: number; // 1 = 前景, 0 = 背景
}

interface AiPromptPayload {
  axis: "x" | "y" | "z";
  sliceIndex: number;
  width: number;            // 提示坐标所在切片的尺寸
  height: number;
  points: AiPromptPoint[];
  box?: { x0: number; y0: number; x1: number; y1: number; label: number };
  scribble?: AiPromptPoint[];
  scribbleRadius?: number;
  lasso?: AiPromptPoint[];  // 有序、密采样的闭合轮廓(完成时发送)
}

interface AiMaskResult {
  axis: "x" | "y" | "z";
  sliceIndex: number;
  width: number;
  height: number;
  rle: number[];                  // 2D 单切片:交替游程长度,0-游程开头
  sliceRange?: [number, number];  // 仅 3D:闭区间 [lo, hi] 切片范围
  slices?: number[][];            // 仅 3D:[lo, hi] 范围内每片一条 RLE
}
```

**RLE 格式**(两个方向通用):在 `width * height` 上行优先,交替游程长度,**以 0-游程开头**
(`[zeros, ones, zeros, ones, …]`);各游程之和等于 `width * height`。3D 结果时把 `rle` 留空,填
`sliceRange` + `slices`。

---

## 颜色常量

```ts
import { AI_CHANNEL_HEX_COLORS, AI_MASK_CHANNEL_COLORS } from "copper3d";
```

这两个常量仍作为**可选的默认调色板**导出,但在 `enterAiAssistMode` 时**不再自动应用**。
segmentation 的颜色现在是自由的(任意 RGB),由宿主通过 `aiSetSegmentColor(label, …)` 驱动。
只有当你想要一组起始色时才用它们;segmentation 颜色以宿主 app 为准。默认调色板
(`CHANNEL_HEX_COLORS` / `MASK_CHANNEL_COLORS`)不变。

---

## 本次发布的新增 / 更新

### Segmentations 取代固定通道
| 符号 | 类型 | 用途 |
|---|---|---|
| `aiSetActiveSegment(label)` | 方法 | 选择要画进的活动 segmentation(label)——**取代 `aiSetChannel`** |
| `aiSetSegmentColor(label, rgba)` | 方法 | 设 segmentation 颜色(自由色,2D 实时) |
| `aiNewSegment(label)` | 方法 | "New segmentation":冻结当前 + 切到新 label |
| `aiClearSegment(label)` | 方法 | 删除某 segmentation 的体素(活动 + 冻结) |
| `aiGetScratchSegments()` | 方法 | 按 label 序列化,供多 label / 按色 3D 构建 |
| `aiCommitToLayerMapped(layer, mapping)` | 方法 | 按显式 `{label → channel}` 映射合并(可多对一、可丢弃);**并集**(只填空体素) |

### 套索(新提示工具)
| 符号 | 类型 | 用途 |
|---|---|---|
| `AiPromptTool` 里的 `"lasso"` | 类型 | 点击落点的闭合轮廓工具 |
| `aiFinishLasso()` | 方法 | 闭合并发送套索(≥3 顶点) |
| `aiLassoUndo()` / `aiLassoRedo()` | 方法 | 顶点级撤销/重做 |
| `aiCancelLasso()` | 方法 | 放弃进行中的套索 |
| `aiIsLassoEditing()` / `aiLassoVertCount()` | 方法 | 给 Finish 按钮/键盘做门控 |
| `aiOnLassoChange(cb)` | 方法 | 响应式顶点数/编辑态回调 |
| `AiPromptPayload.lasso` | 字段 | 完成时发送的密采样闭合轮廓 |

### 行为变化
- **`enterAiAssistMode` 不再应用固定 AI 调色板**——用 `aiSetSegmentColor` 推 segmentation 颜色。
- **移除 `aiSetChannel`。** 改用 `aiSetActiveSegment` + `aiSetSegmentColor`。
- **合并改为叠加(并集)。** `aiCommitToLayer` / `aiCommitToLayerMapped` 只填**空**的目标体素——已有标注永不被覆盖(此前的合并是覆盖写)。`aiCommitToLayer` 现在是 `aiCommitToLayerMapped` 的 identity 映射薄壳。
- **point 工具**现在每次点击画一个种子 marker + hover 十字准星;预测落地后 marker 隐藏。
- **套索**是点击落点 → 平滑、不自交的闭合曲线;仅在完成时发送。

### 不变(原有)的 AI API
`enterAiAssistMode`、`exitAiAssistMode`、`isAiAssistActive`、`aiSetPromptTool`、
`aiSetPolarity`、`aiSetScribbleSize`、`aiOnPrompt`、`aiApplyMask`、`aiClearPrompts`、
`aiCommitRegion`、`aiDiscard`、`aiHasData`、`aiGetScratchSlices`、`aiCommitToLayer`。

---

## 注意 & 坑

- **一个提示集 = 一个区域。** 提示是累积的;每次预测替换当前区域。切换工具或 segmentation 会开始新的一组。要保留一个区域再画下一个,用 `aiNewSegment()`。
- **切片索引是整数。** 涂层按整切片位置步进。
- **`aiApplyMask` 期望上面的 RLE 格式**(0-游程开头)。编码错了会让 mask 错位。
- **`aiGetScratchSegments` / `aiGetScratchSlices` 的朝向**与 copper3d 自己的逐切片写入一致——若你的后端据此写 NIfTI,请用相同的轴向/转置约定以保持对齐。
- **按 segmentation 的 3D 颜色是构建时烘焙的**(后端按你发的颜色给每个 label 的 mesh 上色)。构建后再改某 segmentation 的颜色,需要重新构建才能刷新 3D。
- copper3d 不持久化任何东西;`enter`/`exit` 是单次会话。在你 `aiCommitToLayer` 或导出之前,涂层视为临时数据。
