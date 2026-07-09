# 4D 心脏（MRI + LV 表面）对齐渲染原理详解

> 以 `src/pages/example15_mri_lv_4d.vue` 为例，讲清楚「32 张 MRI 图像 + 64 个 VTK 模型」是如何被加载、对齐、并以同一个心动节律一起播放的。
>
> 涉及核心文件：
> - `src/pages/example15_mri_lv_4d.vue` —— 入口
> - `src/ts/Scene/copperScene.ts` —— `loadAligned4D()` 与 `Aligned4DController`
> - `src/ts/Utils/texture2d.ts` —— `createTexture2D_Array` / `buildAlignedQuad`
> - `src/ts/Loader/copperDicomLoader.ts` —— DICOM 解析、几何标签、LUT
> - `src/ts/Utils/getVOILUT.ts` —— 窗宽窗位映射函数
> - `src/ts/lib/shader/texture2d_frag.glsl` —— 片元着色器
> - `src/ts/Renderer/copperRenderer.ts` / `src/ts/Scene/commonSceneMethod.ts` —— 渲染循环与 tick 回调

---

## 目录

1. [整体架构与数据流](#一整体架构与数据流)
2. [32 张 MRI 如何变成「1 个 mesh」](#二32-张-mri-如何变成1-个-mesh)
3. [64 个 VTK 如何变成「2 个 mesh」](#三64-个-vtk-如何变成2-个-mesh)
4. [动画：一个时钟驱动三个 mesh](#四动画一个时钟驱动三个-mesh)
5. [对齐原理：DICOM 病人坐标系](#五对齐原理dicom-病人坐标系)
6. [windowing / LUT 灰度映射](#六windowing--lut-灰度映射)
7. [three.js 动画循环与 tick 回调](#七threejs-动画循环与-tick-回调)
8. [从零做一遍：最小骨架](#八从零做一遍最小骨架)
9. [关键原则速记](#九关键原则速记)

---

## 一、整体架构与数据流

入口 `example15_mri_lv_4d.vue` 调 `scene.loadAligned4D()`，传入 32 个 `.dcm` URL + 两组 `.vtk` URL（endo / epi，各 32 个）。真正实现在 `copperScene.ts` 的 `loadAligned4D()`。

```
loadAligned4D
  ├─ loadDicomStack()        // 32 dcm → 1 个 DataArrayTexture
  ├─ loadSurfaceSequence×2   // 32+32 vtk → 2 个 geometry 数组
  └─ Promise.all 全部就绪后：
       ├─ 创建 1 个平面 mesh（贴 texture array）
       ├─ 创建 2 个 surface mesh（先用第 0 帧 geometry）
       └─ 注册一个 tick 回调进渲染循环 → 动画
```

**直觉校正**：常见的猜测是「全部加载进内存 → 只创建 3 个 mesh → 同时渲染 → 对齐动画」。这基本正确，但要点是：

- ✅ 32 个 dcm + 64 个 vtk **一次性全部加载进内存**。
- ⚠️ 确实是 **3 个 mesh**，但工作方式完全不同：
  - **1 个平面 mesh** 显示 32 张 MRI —— 靠**切换贴图层**，不换 mesh。
  - **2 个 surface mesh**（endo / epi）显示 64 个 vtk —— 靠**切换 geometry 引用**。
- ✅ 用 **一个共享的 `frameIndex`** + 一个 tick 时钟驱动，所以三者相位永远一致。
- ❗ **对齐不是渲染时算的**，而是在**加载时**就把所有东西放进同一个「病人坐标系」，靠 DICOM 几何标签，**全程不做 `center()` / `scale()`**。

---

## 二、32 张 MRI 如何变成「1 个 mesh」

核心技巧是 **WebGL2 的 `DataArrayTexture`（GLSL 里的 `sampler2DArray`）**：把 32 帧堆成一个「数组纹理」，平面 mesh 永远不变，只改 shader 里一个 `depth` 整数就切帧。

### 加载阶段（`copperScene.ts` `loadDicomStack`）

```ts
// 32 个 dcm 各自解码成一帧灰度数据，按心动周期排序后，
// 平铺拼进一个大数组 uint8[frameSize * 32]
volumes.sort((a, b) => a.order - b.order);   // 按 TriggerTime / SliceLocation 排序
const frameSize = w * h;
const uint8 = new Uint8ClampedArray(frameSize * 32);
volumes.forEach((v, i) => uint8.set(v.uint8, i * frameSize)); // 第 i 帧放到第 i 段
```

`order` 来自 DICOM 标签（`copperDicomLoader.ts`）：优先 `x00181060`（TriggerTime，心动触发时间），否则 `x00201041`（SliceLocation）。这保证 32 帧是**按心脏舒张/收缩的时间顺序**排好的，而不是按文件名。

### 建纹理（`texture2d.ts` `createTexture2D_Array`）

```ts
const texture = new THREE.DataArrayTexture(uint8, width, height, depth /*=32*/);
texture.format = THREE.RedFormat;  // 单通道灰度
```

### 切帧（`texture2d.ts` `setFrame`）

```ts
function setFrame(i) { material.uniforms.depth.value = i; }  // 只改一个 int
```

片元着色器（`texture2d_frag.glsl`）：

```glsl
vec4 color = texture(diffuse, vec3(vUv, depth));  // 第三个分量 depth = 第几帧
outColor = vec4(color.rrr * uBrightness, uOpacity);   // uBrightness 默认 1.5
```

> **关键点**：32 帧全部常驻显存，切帧成本 = 改一个 uniform。比每帧重建 / 重传纹理快几个数量级，所以能流畅播放 cine。

---

## 三、64 个 VTK 如何变成「2 个 mesh」

surface 用的是另一种技巧：**预解码所有 geometry，每帧只换 `mesh.geometry` 的引用**。

### 加载（`copperScene.ts` `loadSurfaceSequence`）

```ts
// 每组 32 个 vtk 解码成 32 个 BufferGeometry，存进数组
loader.load(url, (geometry) => {
  geometry.computeVertexNormals();   // 注意：没有 center()，没有 scale()！
  geometries[index] = geometry;      // 保留原始世界坐标
});
```

### 建 mesh（`copperScene.ts`）

每组只建 1 个 mesh，初始用第 0 帧：

```ts
const { vtkmaterial } = copperMultipleVtk(def.opts);
const mesh = new THREE.Mesh(geometries[0], vtkmaterial);
seqs.push({ mesh, geometries, offset: def.offset ?? 0 });
```

### 切帧（`copperScene.ts` `applyFrame`）

```ts
const applyFrame = () => {
  tex.setFrame(frameIndex);                    // MRI 切层
  for (const s of seqs) {
    const i = (frameIndex + s.offset + s.geometries.length) % s.geometries.length;
    s.mesh.geometry = s.geometries[i];         // surface 换 geometry 引用
  }
};
```

> endo 与 epi 是**两个独立 mesh**（材质不同：endo 红不透明，epi 蓝半透明），但共用同一个 `frameIndex`，所以心内膜与心外膜永远是同一个心动相位 —— 这就是它们之间也对齐的原因。

---

## 四、动画：一个时钟驱动三个 mesh

「对齐动画」的核心是 **只有一个 `frameIndex`**，三个 mesh 全部从它读（`copperScene.ts`）：

```ts
const dtBase = cycleMs / frameCount;   // 1012ms / 32 ≈ 31.6ms 一帧
const tick = () => {
  if (disposed || !playing) return;
  const now = performance.now();
  if (now - lastStep >= dtBase / speed) {  // 用真实时间控制帧率，跟刷新率解耦
    lastStep = now;
    frameIndex = (frameIndex + 1) % frameCount;  // 唯一的帧计数器
    applyFrame();                                // 一次性同步所有 mesh
  }
};
this.addPreRenderCallbackFunction(tick);  // 挂到渲染循环
```

它用 `performance.now()` 累计真实时间来决定「该不该进下一帧」，而不是每个渲染帧都 +1 —— 这样无论屏幕是 60Hz 还是 144Hz，**心跳速度都一致**，`speed` 滑块也能精确控制。

`frameOffset`（example 里的滑块）给 surface 加一个相位偏移，用来手动微调 surface 与 MRI 之间的相位差。

---

## 五、对齐原理：DICOM 病人坐标系

> **对齐不在渲染时做，而是在「把所有东西放进同一个世界坐标系」时就完成了。** 原则：MRI 平面与 VTK surface 都用各自原始的「病人坐标系」毫米坐标，谁都不许 center / scale。

### 1. 病人坐标系（DICOM Patient Coordinate System / LPS）

DICOM 所有空间标签都活在一个固定物理坐标系里，单位毫米，叫 **LPS**：

| 轴 | 方向 | 含义 |
|---|---|---|
| +X | **L**eft | 指向病人左手 |
| +Y | **P**osterior | 指向病人背后 |
| +Z | **S**uperior | 指向病人头顶 |

它跟「第几张图、第几行第几列像素」无关，而是**病人身体本身的物理空间**。只要 MRI 切片和 VTK 模型都用 LPS 毫米坐标，它们说的就是同一个物理空间里的同一个点 —— 这是自动对齐的根本。

> three.js 自己是右手 Y-up 坐标系，与 LPS 不同。本项目**不做转换**，直接把 LPS 毫米值塞进 three.js 的 position。因为 MRI 平面和 surface 用的是同一套 LPS 数值，两者之间的相对关系是精确的，相机随便转都对齐。

### 2. 三个关键标签（`copperDicomLoader.ts`）

```ts
const ipp = parseDS(dataSet.string("x00200032")); // ImagePositionPatient
const iop = parseDS(dataSet.string("x00200037")); // ImageOrientationPatient
const spacing = parseDS(dataSet.string("x00280030")); // PixelSpacing
```

- **ImagePositionPatient (0020,0032)** — 3 个数：像素 (0,0)（左上角第一个像素）**中心**在 LPS 里的毫米坐标，即锚点 `O`。
- **ImageOrientationPatient (0020,0037)** — 6 个数：两个单位向量，描述图像「行方向」「列方向」在 LPS 里的朝向，决定平面的**倾斜姿态**。
- **PixelSpacing (0028,0030)** — 2 个数：`[行间距, 列间距]`，每像素的物理毫米尺寸。

`parseDS` 把 DICOM 的 `"a\b\c"` 多值字符串（DS 类型用反斜杠分隔）拆成数字数组。

### 3. 角点公式（`computeImagePlaneCorners`）

```ts
const row = new THREE.Vector3(iop[0], iop[1], iop[2]); // +列索引方向（横着走）
const col = new THREE.Vector3(iop[3], iop[4], iop[5]); // +行索引方向（竖着走）
const sc = spacing[1]; // 列间距（沿 row 走一步的毫米）
const sr = spacing[0]; // 行间距（沿 col 走一步的毫米）
const O = new THREE.Vector3(ipp[0], ipp[1], ipp[2]); // 像素(0,0)中心
const p = (a, b) => O.clone()
    .addScaledVector(row, a * sc)
    .addScaledVector(col, b * sr);
return {
  tl: p(-0.5,     -0.5),
  tr: p(cols-0.5, -0.5),
  bl: p(-0.5,     rows-0.5),
  br: p(cols-0.5, rows-0.5),
};
```

**一行公式概括全部：**

```
任意像素(列a, 行b)的世界坐标 = O + a·sc·row⃗ + b·sr·col⃗
```

- `O`（IPP）给**位置**
- `row⃗ / col⃗`（IOP）给**朝向**
- `sc / sr`（PixelSpacing）给**物理尺寸**

`-0.5` 与 `cols-0.5` 的原因：IPP 指的是像素**中心**，要得到图像**外边缘**的角，左上角从中心往外退半个像素 → `-0.5`；右边缘是第 `cols-1` 个像素再往外推半个 → `cols-0.5`。

> 易错点 ①：IOP 第一个向量是「沿一行往右走（列索引增加）」的方向，理解成「图像的 +u 轴在物理空间的朝向」最清楚。
> 易错点 ②：PixelSpacing 是 `[row, col]` 顺序，但 row 间距对应「竖着走（col 向量）」的步长，所以代码里 `sc=spacing[1]` 配 `row`、`sr=spacing[0]` 配 `col`。

### 4. VTK surface 如何对上

VTK 文件里的顶点坐标**本来就已经是同一个病人坐标系下的毫米坐标**（数据生产端保证）。所以代码里那句注释才是重点：

```ts
// keep world coordinates — no center()/scale()
```

平面用 DICOM 几何标签放到世界坐标，surface 保持原始世界坐标 —— 两者天然落在同一坐标系里，**自动对齐**，不需要任何配准计算。

> 这是整个方案最巧妙的地方：**「对齐」靠尊重原始坐标系实现，而不是靠算法配准。** 全程不做 center/scale/平移，MRI 切片就会精确穿过心脏模型。

最后 `scene.loadViewUrl(VIEW)` 只是加载预设相机视角的 JSON，让初始镜头对准心脏，与对齐本身无关。

---

## 六、windowing / LUT 灰度映射

### 1. 为什么需要 windowing

DICOM 像素是 **16-bit**（`uint16`，0~65535，CT 还可能带符号的 HU 值），屏幕只能显示 **8-bit**（0~255）。直接线性压缩会让图像一片灰。**Windowing（窗宽窗位）** 就是只把关心的那段数值「拉伸」到 0~255，范围外全黑或全白。

- **Window Center（窗位 / WC）**：关心的中心亮度。
- **Window Width（窗宽 / WW）**：关心的数值跨度。

### 2. ⚠️ 关键架构：本项目的 windowing 在 CPU 端，不在 shader

片元着色器（`texture2d_frag.glsl`）只是采样后乘一个增益，**没有窗宽窗位**：

```glsl
vec4 color = texture(diffuse, vec3(vUv, depth));
outColor = vec4(color.rrr * uBrightness, uOpacity);   // uBrightness 默认 1.5
```

（这个增益救不了发灰的图，见 [6. 陷阱：窗的下界落在 0 以下](#6--陷阱窗的下界落在-0-以下)。）

真正的 windowing 发生在**加载时的 CPU 循环**（`copperDicomLoader.ts`）：

```ts
let lut = getLut(uint16, windowWidth, windowCenter, invert, voiLUT);
let uint8 = new Uint8ClampedArray(uint16.length);
for (let i = 0; i < uint16.length; i++) {
  uint8[i] = lut.lutArray[uint16[i]];   // 16-bit 原值 → 查表 → 8-bit
}
```

> 这意味着 `ctrl.setWindow()` 改窗宽窗位会**重算整张 LUT 并重新映射所有像素**（`texture2d.ts` 的 `updateTexture`），再 `texture.needsUpdate = true` 重传纹理。对 32 帧来说成本不小 —— 这是它换取 shader 极简的设计取舍。

### 3. LUT（查找表）建表（`copperDicomLoader.ts` `getLut`）

```ts
// ① 先扫一遍找出实际最小/最大像素值（表只覆盖真实范围，省内存）
for (...) { minPixelValue = min; maxPixelValue = max; }

let offset = Math.min(minPixelValue, 0);          // 处理带符号(负)像素
let lutArray = new Uint8ClampedArray(maxPixelValue - offset + 1);
const vlutfn = getVOILUT(windowWidth, windowCenter, voiLUT, true);

// ② 给范围内每个可能输入值预算好输出
for (let v = minPixelValue; v <= maxPixelValue; v++) {
  lutArray[v + -offset] = invert ? 255 - vlutfn(v) : vlutfn(v);
}
```

工程细节：
- **`offset`**：像素值可能为负（带符号 CT），用 offset 平移索引避免负下标。
- **`Uint8ClampedArray`**：自动把越界值钳到 0~255，正好实现「窗外全黑/全白」，不用手写 clamp。
- **MONOCHROME1 反相**：有些 DICOM 规定「值越大越黑」，用 `255 - vlutfn(v)` 翻转；普通 MONOCHROME2 是「值越大越白」。

### 4. 线性映射公式（`getVOILUT.ts`）

```ts
function generateLinearVOILUT(windowWidth, windowCenter) {
  return (v) => ((v - windowCenter) / windowWidth + 0.5) * 255.0;
}
```

拆解 `output = ((v - WC) / WW + 0.5) × 255`：

| 输入 v | 输出 | 含义 |
|---|---|---|
| `WC - WW/2`（下沿） | 0 | 纯黑 |
| `WC`（正中） | 127.5 | 中灰 |
| `WC + WW/2`（上沿） | 255 | 纯白 |
| `< WC - WW/2` | 钳到 0 | 全黑 |
| `> WC + WW/2` | 钳到 255 | 全白 |

即「窗内线性拉伸、窗外饱和」的标准 DICOM linear VOI LUT。

### 5. 完整管线

```
.dcm 文件
  │  dicom-parser 解析
  ▼
uint16[]  (16-bit 原始像素)
  │  getLut(WW, WC): 预算 输入值→8bit 查找表
  ▼
lutArray[]  (LUT, 长度 = 像素值域)
  │  for 每个像素: uint8[i] = lutArray[uint16[i]]
  ▼
uint8[]  (8-bit 灰度, 已烧入窗宽窗位)
  │  32 帧拼接 → DataArrayTexture
  ▼
GPU 纹理 → shader 采样 × uBrightness + uOpacity → 屏幕
```

`uint16` 原始数据被**保留**在 `copperVolume` 里，就是为了支持事后 `setWindow` 重算 —— 重算必须从 `uint16` 出发，不能从已损失信息的 `uint8` 出发。

### 6. ⚠️ 陷阱：窗的下界落在 0 以下

**症状**：本该是纯黑的背景渲染成了深灰，整幅图发灰、发飘。

很容易怪到 shader 头上。`texture2d_frag.glsl` 里原本硬编码了一个增益：

```glsl
outColor = vec4( color.rrr * 1.5, uOpacity );   // "lighten a bit"
```

**但这个增益不是黑色发灰的原因。** `0 × 1.5` 仍然是 `0`。乘法增益**永远抬不起真正的黑**，它只会把高光端截断。

真正的原因是窗本身的算术。这个序列声明的是：

```
WindowCenter = 226      WindowWidth = 537
下界 = 226 − 537/2 = −42.5
```

而 MR 的像素值**永远不为负**。所以扫描仪能给出的最暗采样 `0`，映射结果是

```
(0 − (−42.5)) / 537 × 255 ≈ 20
```

**原始黑落在 20/255**，图像里没有任何一个像素可能到达 0。在本序列第 1 帧上实测：

| 窗 / 增益 | 下界 | 纯黑像素 | 截断成纯白 | 均值 |
|---|---|---|---|---|
| DICOM 自带 (226 / 537)，×1.5 | −42.5 | **0.0 %** | 1.3 % | 84.1 |
| DICOM 自带 (226 / 537)，×1.0 | −42.5 | **0.0 %** | 0.0 % | 56.5 |
| 下界归零 (247 / 494)，×1.0 | 0 | **2.8 %** | 0.0 % | 39.5 |
| 下界归零 (247 / 494)，×1.5 | 0 | **2.8 %** | 1.0 % | 58.7 |

**正确做法是把窗的下界压到 0**，同时保持上界不变（`WC + WW/2 = 494.5`）：

```ts
scene.loadAligned4D({
  dicomUrls,
  window: { center: 247, width: 494 },   // 下界 = 0
  surfaces: [...],
});
```

注意最后一行：一旦下界归零，**即使保留 ×1.5 增益，黑色依然是黑的** —— 因为增益抬不起 0。但增益仍值得可控（1.5 会把约 1% 的像素截断成纯白），所以它现在是一个 uniform，而不再是魔法数字：

```glsl
uniform float uBrightness;   // 默认 1.5，即历史上硬编码的那个值
outColor = vec4( color.rrr * uBrightness, uOpacity );
```

运行时可控：

```ts
ctrl.setPlaneBrightness(1.0);   // 忠实还原；1.5 是历史默认值
ctrl.setWindow(247, 494);       // 从保留的 uint16 重算 LUT
```

**这条经验可以推广**：当一幅医学图像「黑不下去」时，先算 `WC − WW/2`，再去动 shader。DICOM 里声明的窗宽窗位只是一个*显示建议*，并不保证它把传感器的下限映射到 0。

### 7. 如果要做「实时拖动窗宽窗位」（GPU 版本）

把原始 16-bit 传进 shader，windowing 在 GPU 算：

```glsl
uniform sampler2DArray diffuse;   // 用 R16/R32F 存原始值，别预压成 8-bit
uniform int   depth;
uniform float windowCenter;
uniform float windowWidth;

void main() {
  float v = texture(diffuse, vec3(vUv, depth)).r;
  float g = clamp((v - windowCenter) / windowWidth + 0.5, 0.0, 1.0);
  outColor = vec4(vec3(g), uOpacity);
}
```

拖动只改两个 uniform，零纹理重传，32 帧也丝滑；代价是显存翻倍。这是「CPU 预计算 LUT」与「GPU 实时」的经典取舍：静态 / 低帧数用前者（简单），交互式窗宽 / 大数据用后者。

---

## 七、three.js 动画循环与 tick 回调

### 1. 动画的本质

屏幕没有「连续运动」，所谓动画是**每秒画 60 张略有不同的静态图**。three.js 不会自动让东西动 —— 你必须自己写循环，每帧**改数据 → 重画**。

### 2. 浏览器的心跳：requestAnimationFrame

`requestAnimationFrame(fn)` 意为「下次刷新屏幕前调用一次 `fn`」。它只调一次，想循环就在函数里**再调用自己**：

```js
function animate() {
  requestAnimationFrame(animate);    // 预约下一帧 → 形成无限循环
  // 改数据
  renderer.render(scene, camera);    // 画一帧
}
animate();  // 启动
```

相比 `setInterval`，rAF 与显示器刷新同步，标签页切后台时自动暂停省电。

### 3. 本项目的循环（`copperRenderer.ts`）

```ts
animate = (time?) => {
  if (!this.running) return;
  requestAnimationFrame(this.animate);   // 自我调度
  this.delta += this.renderClock.getDelta();
  if (this.delta > this.interval) {      // 攒够间隔才画（限制帧率）
    this.render();
  }
};

render() {
  this.currentScene.render();                       // ① 画当前场景
  this.preRenderCallbackFunctions.forEach((item) => {
    item.call(null);                                // ② 执行所有注册的回调
  });
}
```

`example15` 里的 `appRenderer.animate()` 就是「踢一脚启动心跳」。

### 4. 「注册一个 tick 回调」是什么意思

框架维护了一个注册表 `preRenderCallbackFunctions`，每帧都遍历它的 `cache`、把里面每个函数调用一次。**「注册 tick 回调」= 把你的函数加进这个每帧都会被执行的注册表**。加进去后，你的函数就自动获得了「每帧被调用」的能力。

```ts
addPreRenderCallbackFunction(callbackFunction) {
  return this.preRenderCallbackFunctions.add(callbackFunction);  // 返回 id
}
```

4D 代码里：

```ts
const tick = () => { /* 推进 frameIndex、切层、换 geometry */ };
const clockId = this.addPreRenderCallbackFunction(tick);   // 注册，保存 id
// dispose 时：this.removePreRenderCallbackFunction(clockId);  // 注销
```

#### ⚠️ id 不是数组下标

注册表（`Scene/preRenderRegistry.ts`）用**单调递增的计数器**发放 id，并把它们存在与 `cache` 平行的数组里。这个区分很关键，而早先的实现在三个地方同时搞错了：

1. `index` 从不自增，于是 `addPreRenderCallbackFunction` **永远返回 `0`**；
2. `add` 用 `if (!fn.id)` 判断，而第一个 id 恰好是 `0`（falsy），于是第一个回调永远「看起来没注册过」；
3. `remove(id)` 直接用 id 作为下标去 `splice(cache, id)`，**把 id 当成了数组下标** —— 删掉一个回调会让后面所有回调整体前移，静默地让它们持有者手里的 id 全部失效。

这不是纸上谈兵。`example13` 先注册了分割工具的 tick（id `0`），再注册第二个回调 `a`；注册 `a` 时返回的是 `0`，于是「移除 `a`」实际上删掉的是**分割工具的**回调。`loadAligned4D` 则一直偷偷绕过它 —— 去读 `add` 偷偷盖在函数上的私有属性 `(tick as any).id`。

现在 id 在删除操作中保持稳定、永不复用，`remove` 一个不存在的 id 是无操作 —— 这些行为由 `Scene/preRenderRegistry.test.ts` 的单元测试钉死。

**经验法则**：如果一个句柄要交给调用方、而调用方可能在其它增删之后才用它，那它就**不能**是可变数组里的位置下标。

**核心理解**：tick 本身**不画图**，只负责**改数据**（frameIndex+1、切贴图层、换几何体）；真正画图的是 `scene.render()`。两者在同一帧按顺序发生 —— 改完数据，画出来，于是动了。

### 5. 为什么用「回调数组」设计

为了**解耦**：通用循环不该知道「心脏 4D」这种具体业务。通过注册机制：加行为 → push 进数组；停行为 → 从数组移除（`dispose()` 就这么干）；多个动画互不干扰。这就是「钩子 / 发布订阅」模式用在渲染循环上 —— React Three Fiber 的 `useFrame`、游戏引擎的 `Update()` 本质都一样。

### 6. 三要素自测

```js
function animate() {
  requestAnimationFrame(animate);        // ① 循环
  tickCallbacks.forEach((fn) => fn());   // ② 改数据
  renderer.render(scene, camera);        // ③ 画图
}
```

- 删 ① → 只画一帧，不动（循环断了）。
- 删 ② → 不动（没人改数据，每帧都一样）。
- 删 ③ → 数据在变但屏幕不更新（没人画）。

三者缺一不可。4D 心脏无非把「转方块」换成「切 MRI 层 + 换心脏几何体」。

---

## 八、从零做一遍：最小骨架

遇到「图像序列 + 模型序列 + 对齐动画」时按此套路：

```ts
// ── 第 1 步：图像序列堆成一个 DataArrayTexture ──────────────
const frameSize = width * height;
const big = new Uint8ClampedArray(frameSize * N);
frames
  .sort((a, b) => a.time - b.time)              // ★ 按时间相位排序，不是文件名
  .forEach((f, i) => big.set(f.data, i * frameSize));

const tex = new THREE.DataArrayTexture(big, width, height, N);
tex.format = THREE.RedFormat;
tex.needsUpdate = true;

const planeMat = new THREE.ShaderMaterial({
  glslVersion: THREE.GLSL3,
  uniforms: { diffuse: { value: tex }, depth: { value: 0 } },
  vertexShader: /* 传 uv */,
  fragmentShader: `
    precision highp sampler2DArray;
    uniform sampler2DArray diffuse; uniform int depth; in vec2 vUv; out vec4 o;
    void main(){ o = texture(diffuse, vec3(vUv, depth)); }`,
});

// ── 第 2 步：平面放到「真实世界坐标」而不是原点 ─────────────
const g = new THREE.BufferGeometry();
g.setAttribute("position", new THREE.BufferAttribute(
  new Float32Array([...tl, ...bl, ...tr, ...tr, ...bl, ...br]), 3));
g.setAttribute("uv", new THREE.BufferAttribute(
  new Float32Array([0,1, 0,0, 1,1, 1,1, 0,0, 1,0]), 2));
const plane = new THREE.Mesh(g, planeMat);
scene.add(plane);

// ── 第 3 步：模型序列，每组只建 1 个 mesh，预存所有 geometry ──
const geos = await Promise.all(urls.map(loadGeometryKeepWorldCoords)); // ★ 不 center/scale
const surf = new THREE.Mesh(geos[0], surfMat);
scene.add(surf);

// ── 第 4 步：一个时钟驱动所有东西 ────────────────────────────
let frame = 0, last = performance.now();
const dt = cycleMs / N;
function tick() {
  const now = performance.now();
  if (now - last >= dt) {
    last = now;
    frame = (frame + 1) % N;
    planeMat.uniforms.depth.value = frame;  // 图像切层
    surf.geometry = geos[frame];            // 模型换引用
  }
  requestAnimationFrame(tick);
}
tick();
```

---

## 九、关键原则速记

1. **图像序列 → DataArrayTexture，切帧只改 `depth` uniform**（别每帧重传纹理）。
2. **模型序列 → 预解码所有 geometry，切帧只换 `mesh.geometry` 引用**（别每帧重建 mesh）。
3. **对齐 = 全程使用原始世界坐标，禁止 `center()` / `scale()`**（图像靠 DICOM 几何标签摆位，模型用原始顶点）。
4. **一个共享 `frameIndex` + 基于 `performance.now()` 的时钟**，让所有东西相位一致、速度与刷新率解耦。
5. **three.js 动画三要素**：循环（rAF）+ 改数据（tick 回调）+ 画图（render），缺一不可。
6. **windowing 取舍**：CPU 预计算 LUT（简单、低帧）vs GPU 实时（流畅、显存翻倍）。
