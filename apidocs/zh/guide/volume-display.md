# copper3d — 体数据切片显示

两个决定切片最终灰阶的函数：一个让拖动切片变便宜，一个让偏暗的序列变得可读。

两者都从包入口导出（`copper3d`），并且都是 **opt-in**——
`loadNrrd` 不会自动调用，现有代码不受影响。

::: tip 3.8.0 新增
纯新增。既有的 loader 和 `VolumeSlice` 行为一处未改。
:::

---

## 1. `installFastSliceRepaint()`

把某个 `VolumeSlice` 的 `repaint` 方法替换成一个不会在每次滚动切片时重建整个世界的等价实现。

```ts
installFastSliceRepaint(slice: unknown, exposure?: number): Promise<void>
```

| 参数 | 类型 | 默认 | 含义 |
|---|---|---|---|
| `slice` | `VolumeSlice` | — | 要打补丁的切片，如 `nrrdSlices.z`。 |
| `exposure` | `number` | `1` | gamma 指数，通常来自 [`exposureExponent()`](#_2-exposureexponent)。`1` 表示灰阶与原实现完全一致。 |

```ts
scene.loadNrrd(url, bar, true, async (volume, meshes, slices) => {
  scene.addObject(meshes.z);
  await installFastSliceRepaint(slices.z);
  slices.z.repaint.call(slices.z);
});
```

### 为什么需要它

给 `slice.index` 赋值会置上 `geometryNeedsUpdate`，于是下一次 `repaint()` 会先跑
`updateGeometry()`。这个方法无条件地：

- 给 `canvas.width` / `canvas.height` 赋值，`canvasBuffer` 同样——**只要赋值就会重置整个
  2D backing store**，哪怕值根本没变；
- 重新获取两个 2D context；
- 调用 `geometry.dispose()` 并新建 `new PlaneGeometry(...)`，也就是**每一帧**删除并重建
  GPU buffer。

然后 `repaint()` 本身还会调 `ctx.getImageData(...)`，把整张画布读回来并分配一个新的
`Uint8ClampedArray`——而紧接着的循环会把其中每一个像素都覆盖掉，这次读取纯属浪费。

在同一个体数据、同一条轴上，`planeWidth`、`planeHeight`、`iLength`、`jLength` 对每一张切片
都是相同的，只有 `sliceAccess` 和 `matrix` 会变。所以上面这些工作，除了第一次以外，每一步
滚动都是多余的。

在真实浏览器里实测拖动切片平面：**2 秒内 59 个 long task（>50 ms），p90 帧时间 61 ms**；
作为对照，在一个只旋转、从不重绘的场景上做同样的拖动是**零个** long task。开销出在纯 JS
上，不是渲染器。

`VolumeSlice` 来自 three.js 而非本库，也没有暴露任何相关选项，所以按实例替换方法是唯一
可行的切入点。

### 保真度

像素循环是从原实现逐字节抄来的，算术、阈值和窗宽窗位处理完全一致。差异只有三处：缓存的
`ImageData`、平面尺寸未变时跳过几何体工作、以及可选的曝光 LUT。

`label` 类型的体数据会原样交回原实现处理。

### 注意事项

- **幂等。** 对已打过补丁的切片再调一次是空操作，因此第一次调用的 `exposure` 生效。
- **必须在第一次绘制之前调用。** LUT 住在打过补丁的方法里，先绘制会先画出一帧未提亮的画面，
  等用户第一次滚动切片时才修正——那是一次肉眼可见的颜色跳变。
- 之所以是 `async`，仅仅因为 `PlaneGeometry` 是按需导入的。

---

## 2. `exposureExponent()`

解出让体数据的组织中位体素落在目标灰阶上的 gamma 指数。

```ts
exposureExponent(volume: ExposureVolume, targetGrey?: number): number
```

| 参数 | 类型 | 默认 | 含义 |
|---|---|---|---|
| `volume` | `ExposureVolume` | — | `{ data, min, max }`——加载好的 NRRD 体数据即满足。 |
| `targetGrey` | `number` | `DEFAULT_TARGET_GREY`（75） | 组织中位体素应落在 0–255 灰阶的哪个位置。 |

当体数据不需要提亮、或无法测量（数据为空、`max <= min`）时返回 `1`。它**只会提亮**——已经
达到或超过目标的体数据保持原样。

```ts
const exposure = exposureExponent(volume);
await installFastSliceRepaint(slices.z, exposure);
slices.z.repaint.call(slices.z);
```

### 为什么用 gamma 曲线而不是收窄显示窗

切片的绘制公式是 `(raw - windowLow) * 255 / (windowHigh - windowLow)`，而 NRRD loader 把这个
窗设成体数据自身的 `min` / `max`。当最大值只是少数几个亮的离群点时——在增强 MRI 上这很常见
——组织就被压在灰阶的底部，画面看上去就是暗的。在九个临床体数据上实测，组织中位体素落在
**255 中的 31–55**。

收窄显示窗是最直觉的做法，而它行不通。**任何亮到足以提起组织的线性窗，都会让灰阶顶端饱和；
而在增强序列上，病灶恰恰_就是_灰阶顶端。** 有两次尝试正是因此被否：肿瘤和画在它上面的白色
包围框双双消失在一片白里。这不是参数取值的问题，任何取值都逃不掉。

`out = 255 * (in / 255) ** exponent` 单调且两端固定——0 仍是 0，255 仍是 255——所以无论中间
被提得多高都不会截断，病灶与周围组织的区分度得以保留。

### 为什么用 Otsu

空气与组织的分离用的是 [Otsu 方法](https://zh.wikipedia.org/wiki/大津算法)，而不是取值域的
某个比例。值域恰恰是各个体数据最不一致的东西——最大值相差两个数量级是常态（实测九个体数据
从 246 到 27014）——所以任何从 `max` 推导出来的阈值，在每个体数据里落点都不一样。Otsu 从直方
图自身的形状挑分界点，这正是同一个目标值能让整批数据看起来一致的原因。

直方图采样采用均匀步长，最多 4 百万个体素：对一个 3500 万体素的体数据做完整遍历约需 100 ms，
而均匀步长对强度分布是无偏的。

---

## 3. `addVolumeBoundingBox()` <Badge type="tip" text="3.9.0" />

```ts
addVolumeBoundingBox(
  scene: BoundingBoxHost,
  rasDimensions: ArrayLike<number>,
  opts?: { color?: ColorRepresentation; name?: string }
): THREE.BoxHelper | undefined
```

体数据外面那个线框盒子。它是唯一能给一个孤零零的切片面提供空间参照的东西 —— 没有它，切片
面就悬在一片没有边界的虚空里，读者完全不知道自己滚到体数据的哪个位置了。

```ts
scene.loadNrrd(url, loadingBar, false, (volume, meshes) => {
  scene.addObject(meshes.z);
  Copper.addVolumeBoundingBox(scene, volume.RASDimensions, { color: 0x8a7f84 });
});
```

返回这个 helper，方便你隐藏、移动或释放它；体数据退化时返回 `undefined` —— 任何一个轴上
的尺寸为 0，画出来的都不是盒子而是一个压平的东西。默认名字是 `"volume-bounds"`，这样后续
遍历子对象清理时能像场景里其他东西一样找到并释放它。

`color` 默认白色 —— 那是在深色 viewer 上能看清的颜色。浅色背景请传一个深一点的色值，白线
在那上面是看不见的。

### 它替代 `addBoxHelper()`

`addBoxHelper` 从 3.9.0 起标记为 **deprecated**，代码原样保留 —— 传了第三个可选参数的调用
方，它现在是能用的。而两参数的形式不能用，而且从来就没能用过：

- 不传 `boxCube` 时，它包的是一个模块级的 `cube`，而 `copperNrrdLoader` 只声明了它、从没
  赋过值，也就是 `new THREE.BoxHelper(undefined)`
- 它的类型写的是收 `copperScene`，所以 `copperSceneOnDemond`（是兄弟子类，不是后代）过不了
  类型检查 —— 尽管它有这里真正需要的那个 `addObject`
- 它用 `volume.matrix` 而不是体数据的 RAS 尺寸来定盒子大小，那不是读者期望的那个盒子

---

## 类型

```ts
interface ExposureVolume {
  data: ArrayLike<number>;
  min: number;
  max: number;
}

const DEFAULT_TARGET_GREY = 75;
```
