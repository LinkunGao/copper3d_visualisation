# copper3d — AI Assist API(使用指南)

copper3d 包中 **AI Assist**(交互式提示分割)功能的公开 API。所有能力都挂在 `NrrdTools`
实例上,另外导出了几个类型和颜色常量。

> English version: `ai-assist-api.en.md`

```ts
import { NrrdTools, AI_CHANNEL_HEX_COLORS } from "copper3d";
import type { AiPromptPayload, AiMaskResult, AiPromptTool } from "copper3d";
```

---

## 心智模型

copper3d **不**与你的模型/后端通信。它只负责:

1. 在当前切片上捕获用户的**提示**(点 / 框 / 涂鸦);
2. 通过你的 `onPrompt` 回调,把可序列化的 `AiPromptPayload` 抛给你;
3. 把你回传的**mask 结果**经 `aiApplyMask` 画进一块独立的**涂层(scratch)**(作为叠加层渲染)。

中间的网络调用由你负责。流程:

```
用户手势 ──▶ onPrompt(payload) ──▶ [你的后端] ──▶ aiApplyMask(result)
```

涂层是一个**沙箱**:在你调用 `aiCommitToLayer(...)`(合并)之前,什么都不会动到真正的 mask 图层。
进入 AI 模式会隐藏现有图层 mask、只显示 AI 叠加层;退出时恢复。

---

## 快速上手(端到端)

```ts
const tools = new NrrdTools(container);
// … 像平常一样把 NRRD case 加载进 `tools` …

// 1. 进入 AI Assist(创建涂层、隐藏图层 mask、接管画布)。
tools.enterAiAssistMode();

// 2. 配置提示工具。
tools.aiSetPromptTool("point");   // "point" | "box" | "scribble"
tools.aiSetPolarity(1);           // 1 = 前景(包含),0 = 背景(排除)
tools.aiSetChannel(1);            // AI 叠加层通道/标签 1-8(1 = 青色)

// 3. 接收提示 → 调你的模型 → 把结果画回去。
tools.aiOnPrompt(async (payload: AiPromptPayload) => {
  const result: AiMaskResult = await myBackend.predict(payload);
  tools.aiApplyMask(result);
});

// 4.(可选)在不抹掉当前区域的前提下,开始一个独立的新区域。
tools.aiCommitRegion();

// 5. 把 AI 叠加层合并进真正的 mask 图层(沙箱合并)。
if (tools.aiHasData()) tools.aiCommitToLayer("layer1");

// 6. 退出 AI 模式(恢复图层 mask)。
tools.exitAiAssistMode();
```

---

## API 参考

### 模式生命周期

#### `enterAiAssistMode(): void`
进入 AI 沙箱。隐藏所有图层 mask(并快照其可见性)、创建涂层、应用 AI 调色板(通道 1 = 青色),
并把左键路由为提示。右键拖拽仍可平移;滚轮/滑块仍可翻切片。已激活时为空操作。

#### `exitAiAssistMode(): void`
退出沙箱:丢弃涂层、恢复常规工具与进入时记录的图层 mask 可见性。若你先合并过
(`aiCommitToLayer`),合并结果已经在图层里,会随恢复的 mask 一起出现。未激活时为空操作。

#### `isAiAssistActive(): boolean`
AI 模式激活时返回 `true`。

```ts
if (!tools.isAiAssistActive()) tools.enterAiAssistMode();
```

---

### 提示配置

#### `aiSetPromptTool(tool: AiPromptTool): void`
选择手势:`"point"`(点种子)、`"box"`(拖一个矩形)、`"scribble"`(拖一道自由笔画)。
**切换工具会重置当前提示集**(下一次手势是一次全新预测)。

#### `aiSetPolarity(label: number): void`
`1` = 前景(包含/添加),`0` = 背景(排除/抠除)。任何 ≠ 0 都按前景处理。

#### `aiSetChannel(channel: number): void`
预测要画进的 AI 叠加层通道/标签(`1`–`8`)。每个通道一种独立颜色(通道 1 = 青色)。
**切换通道会开始一个新区域**(清空当前提示集,以免把上一个通道的区域重新上色)。

#### `aiSetScribbleSize(size: number): void`
涂鸦画笔半径(像素,夹在 1–40)。同时驱动实时预览圈和 payload 里的 `scribbleRadius`。

```ts
tools.aiSetPromptTool("scribble");
tools.aiSetScribbleSize(8);
tools.aiSetPolarity(0); // 擦除式涂鸦
```

---

### 提示 ↔ 结果 管道

#### `aiOnPrompt(cb: (payload: AiPromptPayload) => void): void`
注册"提示手势完成"时触发的回调(点 = 点击时;框/涂鸦 = 抬起时)。在回调里调用你的模型,
然后 `aiApplyMask`。payload 携带当前区域的**累积**提示集,所以每次都从整组重新预测。

#### `aiApplyMask(result: AiMaskResult): void`
把返回的 mask 画进涂层;叠加层下一帧重绘。支持 2D(单切片)和 3D(多切片)结果——见 `AiMaskResult`。

```ts
tools.aiOnPrompt(async (payload) => {
  try {
    const result = await fetch("/api/ai/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((r) => r.json());
    tools.aiApplyMask(result);
  } catch (e) {
    console.error("predict failed", e);
  }
});
```

---

### 区域管理

#### `aiClearPrompts(): void`
重置进行中的提示集(点/框/涂鸦)。在切片/轴变化时使用。它**不**冻结——当前区域仍可能被下一次预测覆盖。

#### `aiCommitRegion(): void` *("New region" 按钮用这个*)
**冻结**目前画的一切,使其在后续预测中保留——即使同通道——然后清空提示集。这正是让你能画**多个互不覆盖
区域**的关键,否则最新预测会抹掉之前的。

```ts
// 画区域 1 …… 然后:
tools.aiCommitRegion();
// 画区域 2(同色或换色)—— 区域 1 被保留
```

#### `aiDiscard(): void`
擦除自 `enterAiAssistMode` 以来 AI 画的**所有**内容(恢复到空快照,包括冻结的区域)。

#### `aiHasData(): boolean`
涂层当前含有任何已画体素时返回 `true`。

---

### 持久化 / 导出 AI mask

#### `aiGetScratchSlices(): { axis: "z"; width: number; height: number; slices: { sliceIndex: number; rle: number[] }[] } | null`
把涂层序列化为紧凑的**逐切片 RLE**(只含非空 z 切片),用于发给后端(例如构建 3D 模型 / 写 NIfTI)。
没有涂层时返回 `null`。编码:
- 二值化(任意非零通道 → 1);
- RLE = 交替游程长度,以 0-游程开头;
- 只含非空切片。

```ts
const vol = tools.aiGetScratchSlices();
if (vol && vol.slices.length) {
  await fetch("/api/ai/save-volume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caseId, ...vol }),
  });
}
```

#### `aiCommitToLayer(targetLayer: string = "layer1"): void`
把 AI 涂层**合并**进真正的 mask 图层(保留通道),作为一次可撤销操作。会扫描所有 z 切片,因此从任意视图画的
体素都会被捕获。这是唯一把 AI 结果写进实际标注图层的调用。

```ts
if (tools.aiHasData()) tools.aiCommitToLayer("layer1"); // 然后退出即可看到
```

---

## 类型

```ts
type AiPromptTool = "point" | "box" | "scribble";

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

AI_CHANNEL_HEX_COLORS[1];  // "#5ec8ff"(青色)—— 通道 1
AI_MASK_CHANNEL_COLORS[1]; // { r: 94, g: 200, b: 255, a: 255 }
```

AI 涂层使用这套 **AI 专属**调色板(通道 1 = 青色;通道 6 = 翠绿,以避免重复青色)。在
`enterAiAssistMode` 时自动应用。用 `AI_CHANNEL_HEX_COLORS` 给你自己的通道色块上色,使 UI 与叠加层一致。
默认调色板(`CHANNEL_HEX_COLORS` / `MASK_CHANNEL_COLORS`)不变。

---

## 本次发布的新增 / 更新

### 新增函数
| 符号 | 类型 | 用途 |
|---|---|---|
| `NrrdTools.aiCommitRegion()` | 方法 | "New region":冻结当前区域 + 清空提示 |
| `NrrdTools.aiGetScratchSlices()` | 方法 | 把涂层序列化为逐切片 RLE,供后端持久化 |
| `AI_MASK_CHANNEL_COLORS` | 常量 | AI 专属 RGBA 调色板(通道 1 = 青色) |
| `AI_CHANNEL_HEX_COLORS` | 常量 | AI 专属 hex 调色板(通道 1 = 青色) |

### 行为变化(签名不变)
- **`aiClearPrompts()`** 不再兼作 "New region"——它只重置提示集。用 `aiCommitRegion()` 冻结 + 开新区域。
- **涂鸦预览圈**:涂鸦模式下,圆圈跟随鼠标显示画笔大小(随 `aiSetScribbleSize` 实时变化)。
- **进入时应用 AI 调色板**:`enterAiAssistMode()` 用 AI 调色板给涂层各通道重新上色(通道 1 = 青色),只作用于涂层。
- **多区域冻结**:叠加层写入不再抹掉冻结的同通道区域,所以 `aiCommitRegion()` 真正保留了之前的区域。

### 不变(原有)的 AI API
`enterAiAssistMode`、`exitAiAssistMode`、`isAiAssistActive`、`aiSetPromptTool`、
`aiSetPolarity`、`aiSetChannel`、`aiSetScribbleSize`、`aiOnPrompt`、`aiApplyMask`、
`aiClearPrompts`、`aiDiscard`、`aiHasData`、`aiCommitToLayer`。

---

## 注意 & 坑

- **一个提示集 = 一个区域。** 提示是累积的;每次预测替换当前区域。切换工具或通道会开始新的一组。要保留一个区域再画下一个,用 `aiCommitRegion()`。
- **切片索引是整数。** 涂层按整切片位置步进。
- **`aiApplyMask` 期望上面的 RLE 格式**(0-游程开头)。编码错了会让 mask 错位。
- **`aiGetScratchSlices` 的朝向**与 copper3d 自己的逐切片写入一致——若你的后端据此写 NIfTI,请用相同的轴向/转置约定以保持对齐。
- copper3d 不持久化任何东西;`enter`/`exit` 是单次会话。在你 `aiCommitToLayer` 或经 `aiGetScratchSlices` 导出之前,涂层视为临时数据。
