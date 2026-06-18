# copper3d — 对齐 4D MRI + 模型 API 文档

这份文档说明为 copper3d 新增的能力:从原始 DICOM + VTK 出发,把一组 cine MRI(单切面、N
个心动相位)与会形变的模型序列(如左室 endo/epi)在**空间和时间上对齐**渲染,共享一个时钟
并能正确释放资源。

所有内容都从包入口导出(`copper3d_visualisation` / `../ts/index`)。

---

## 1. 顶层入口:`copperScene.loadAligned4D()`

平时只需调这一个方法。它加载 DICOM cine 和模型序列,把 MRI 平面摆到真实病人坐标位姿,模型
保持各自的世界坐标,两者由同一个帧时钟驱动,并返回一个控制器。

```ts
loadAligned4D(
  opts: aligned4DOptsType,
  callback?: (ctrl: Aligned4DController) => void
): void
```

### 参数 `aligned4DOptsType`

| 字段 | 类型 | 必填 | 含义 |
|---|---|---|---|
| `dicomUrls` | `string[]` | 是 | N 帧 DICOM(单切面、N 个相位)。**顺序无所谓**,内部按 TriggerTime/SliceLocation 排序。 |
| `surfaces` | `aligned4DSurfaceType[]` | 否 | 0 个或多个模型序列(如 endo、epi)。 |
| `cycleMs` | `number` | 否 | 一个完整循环的播放周期(毫秒)。默认 `1012`(约一个心动周期)。 |
| `window` | `{ center: number; width: number }` | 否 | 覆盖 DICOM 的窗位/窗宽。不填则用 DICOM 自带值。 |

### 模型序列 `aligned4DSurfaceType`

| 字段 | 类型 | 必填 | 含义 |
|---|---|---|---|
| `name` | `string` | 是 | 之后在控制器里用的键名(如 `"endo"`)。 |
| `urls` | `string[]` | 是 | 该模型的 N 帧 VTK,按心动相位顺序(索引 0..N-1)。 |
| `opts` | `IOptVTKLoader` | 否 | 材质选项:`{ wireframe?, color?, transparent?, opacity? }`。 |
| `offset` | `number` | 否 | 该模型相对 MRI 的相位偏移(帧数)。默认 `0`。 |

> 模型保持 VTK 原始坐标(病人空间,mm),**不做 center/scale**——这正是它能和 MRI 平面对齐的原因。

### 用法示例

```ts
const dicomUrls = Array.from({ length: 32 }, (_, i) => `/data/mri_4ch/${i + 1}.dcm`);
const pad3 = (n: number) => String(n).padStart(3, "0");
const endo = Array.from({ length: 32 }, (_, i) => `/data/lv/endo_${pad3(i)}.vtk`);
const epi  = Array.from({ length: 32 }, (_, i) => `/data/lv/epi_${pad3(i)}.vtk`);

scene.loadAligned4D(
  {
    dicomUrls,
    surfaces: [
      { name: "endo", urls: endo, opts: { color: 0xff5a6e, transparent: true, opacity: 0.85 } },
      { name: "epi",  urls: epi,  opts: { color: 0x4ea1ff, transparent: true, opacity: 0.25 } },
    ],
    // cycleMs: 900,
    // window: { center: 226, width: 537 },
  },
  (ctrl) => {
    // 全部加载并显示后执行一次
    ctrl.setPlaneOpacity(0.9);
    scene.loadViewUrl("/data/heart4d_view.json"); // 用 copper3d 标准方式设相机
  }
);
```

---

## 2. 控制器:`Aligned4DController`

传给 `callback` 的对象,用于运行时控制播放与外观。

| 方法 / 字段 | 签名 | 作用 |
|---|---|---|
| `plane` | `THREE.Mesh` | MRI 平面网格(ShaderMaterial)。 |
| `surfaceMeshes` | `Record<string, THREE.Mesh>` | 按 `name` 取每个模型网格。 |
| `frameCount` | `number` | 心动相位帧数(= `dicomUrls.length`)。 |
| `play()` | `() => void` | 继续播放。 |
| `pause()` | `() => void` | 暂停。 |
| `toggle()` | `() => void` | 播放/暂停切换。 |
| `setSpeed(x)` | `(x: number) => void` | 播放速度倍率(如 `0.5`、`2`)。 |
| `setFrame(i)` | `(i: number) => void` | 跳到绝对帧 `i`(自动取模;适合暂停时做逐帧拖动条)。 |
| `setFrameOffset(name, n)` | `(name: string, n: number) => void` | 把某个模型相对 MRI 偏移 `n` 帧(实时)。 |
| `setWindow(center, width)` | `(center: number, width: number) => void` | 重新调窗(16-bit,重算)。 |
| `setPlaneOpacity(v)` | `(v: number) => void` | MRI 平面透明度 `0..1`,`v<1` 自动开启透明。 |
| `setSurfaceOpacity(name, v)` | `(name: string, v: number) => void` | 某个模型透明度 `0..1`,`v<1` 自动开启透明。 |
| `setSurfaceVisible(name, visible)` | `(name: string, visible: boolean) => void` | 显示/隐藏某个模型。 |
| `dispose()` | `() => void` | 停止时钟,释放所有几何体/纹理/材质,并从场景移除网格。**卸载时必须调。** |

### 用法示例(绑定 UI)

```ts
let ctrl: Aligned4DController | undefined;
// ... 在 loadAligned4D 回调里:ctrl = controller;

playBtn.onclick    = () => ctrl?.toggle();
speedSlider.oninput = (e) => ctrl?.setSpeed(+e.target.value);
endoAlpha.oninput  = (e) => ctrl?.setSurfaceOpacity("endo", +e.target.value);
epiToggle.onchange = (e) => ctrl?.setSurfaceVisible("epi", e.target.checked);
mriAlpha.oninput   = (e) => ctrl?.setPlaneOpacity(+e.target.value);
windowSlider.oninput = () => ctrl?.setWindow(center, width);

// 卸载(如 Vue onBeforeUnmount):
appRenderer.stop();
ctrl?.dispose();
```

---

## 3. 渲染器收尾:`copperRenderer.stop()`

停止渲染循环(终止 requestAnimationFrame 链),让 canvas/GPU 上下文能被回收。离开页面时和
`ctrl.dispose()` 一起调用,避免"用一会儿就卡"的泄漏。

```ts
stop(): void
```

```ts
onBeforeUnmount(() => {
  appRenderer.stop();
  ctrl?.dispose();
});
```

---

## 4. 底层构件(只有当你绕开 `loadAligned4D` 时才需要)

### 4.1 `computeImagePlaneCorners()` —— DICOM tag → 世界角点

从 DICOM loader 导出。根据 DICOM tag 算出图像平面的 4 个世界角点。IPP 是像素 (0,0) 的
**中心**,所以角点向外偏半个像素;`PixelSpacing` 为 `[行间距, 列间距]`;IOP 第一个向量是
+列索引方向。

```ts
import { computeImagePlaneCorners } from "copper3d_visualisation";

function computeImagePlaneCorners(
  ipp: number[],     // ImagePositionPatient [x,y,z]
  iop: number[],     // ImageOrientationPatient [rx,ry,rz, cx,cy,cz]
  spacing: number[], // PixelSpacing [行间距, 列间距]
  cols: number,      // Columns 列数
  rows: number       // Rows 行数
): planeCorners;     // { tl, tr, bl, br } 每个为 [x,y,z]
```

### 4.2 `copperVolumeType` —— 新增字段

DICOM loader 现在会额外填充这些(均可选,tag 存在时才有):

```ts
interface copperVolumeType {
  /* ...原有字段... */
  instanceNumber?: number;
  imagePositionPatient?: number[];    // IPP [x,y,z]
  imageOrientationPatient?: number[]; // IOP [rx,ry,rz, cx,cy,cz]
  pixelSpacing?: number[];            // [行间距, 列间距]
  corners?: planeCorners;             // 预先算好的世界平面角点
}
```

### 4.3 `createTexture2D_Array()` —— 对齐平面 + 帧/调窗控制

2D 纹理构建函数新增了 `aligned` 开关和两个控制方法。当 `aligned = true` 且 volume 带有
`corners` 时,平面按真实世界位姿构建(而不是居中的 `PlaneGeometry`)。

```ts
function createTexture2D_Array(
  copperVolume: copperVolumeType,
  depth: number,            // 堆叠帧数(cine 长度)
  scene: THREE.Scene,
  gui?: GUI,
  aligned?: boolean         // 默认 false;true → 世界角点平面
): {
  mesh: THREE.Mesh;
  copperVolume: copperVolumeType;
  updateTexture: (v: copperVolumeType) => void;
  setFrame: (i: number) => void;            // 设置当前可见帧(depth uniform)
  setWindow: (center: number, width: number) => void; // 重新调窗(16-bit)
};
```

> 默认(`aligned = false`)保持 `loadDicom` 的旧行为,所以原有的体数据滚动示例不受影响。

---

## 5. 对齐原理(一段话)

DICOM 和模型本来就在**同一个病人坐标系**(LPS,mm)。MRI 平面由 `ImagePositionPatient` +
`ImageOrientationPatient` + `PixelSpacing` 反算出的 4 个世界角点构建;模型按 VTK 原始坐标
加载(不 center/scale)。两者因此自动重合,无需任何手动变换。时间对齐来自一个共享的
`frameIndex`,同时驱动 MRI 纹理层(`depth` uniform)和模型几何体切换。平面的纹理 UV 是固定的
结构映射(角点 `tl` ↔ 像素 (0,0)),所以对任意数据集都正确,不只适用于某一个 case。

---

## 6. 使用方速查清单

- [ ] `dicomUrls` 传入全部 DICOM 帧(顺序无所谓,内部排序)。
- [ ] 每个模型的 VTK 帧按心动相位顺序传(索引 0..N-1)。
- [ ] 相机用 `scene.loadViewUrl(...)` 控制(相机**不写进包**)。
- [ ] 模型与 MRI 相位错开时用 `setFrameOffset(name, n)` 校正。
- [ ] 卸载时务必调用 `appRenderer.stop()` + `ctrl.dispose()`。
