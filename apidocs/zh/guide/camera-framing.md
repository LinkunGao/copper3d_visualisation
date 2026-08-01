# copper3d — 相机取景与位姿过渡

把相机对准它要展示的内容，以及让它从一个位姿移动到另一个。全部从包入口导出
（`copper3d`）。

::: tip 3.8.0 新增
纯新增。`computeFraming`、`resolveViewPose`、`resolveFarPlane`、`Copper3dOrbitControls`、
`loadView` 以及 `loadGltf` 自己的相机处理均未改动——只要不调用下面这些函数，相机行为与
3.7.x 完全一致。
:::

---

## 1. `fitDistance()`

透视相机要离物体中心多远，整个物体才能装进画面。

```ts
fitDistance(bounds: FitBounds, aspect: number, fovDeg: number, margin?: number): number
```

| 参数 | 类型 | 默认 | 含义 |
|---|---|---|---|
| `bounds` | `FitBounds` | — | 物体的轴对齐尺寸与中心，场景单位。 |
| `aspect` | `number` | — | 视口宽 / 高。传 0 或非有限值时按 `1` 处理。 |
| `fovDeg` | `number` | — | 相机的**垂直**视场角，度。 |
| `margin` | `number` | `0.85` | 最后乘上去的系数。**越小，物体在屏幕上越大。** |

### 与 `computeFraming` 的区别

`computeFraming`（未改动，仍由 `Copper3dOrbitControls` 使用）只用包围盒对角线和垂直视场角。
`fitDistance` 有两处不同。

**它考虑 aspect。** aspect 小于 1 时，**水平**视场才是较窄的那个，而必须装下物体的正是较窄
的那个。只按垂直视场取景的相机，在任何"高而窄"的视口里都会取景过小——一旦把视图拆成并排的
多个面板，这个问题立刻出现。

**它拟合包围球，而不是包围盒。** 用"朝向相机的那个盒面 + 一半深度"来取景，等于让每个物体
由恰好朝向相机的那一维决定大小。一块薄片（33 层的乳腺 X 线体数据）几乎不需要把相机推远，
于是铺满整个面板；而体量相当、接近立方体的 MRI 体数据会被推得很远，并排看上去只有前者一半
大。球没有朝向，所以体量相当的物体会得到相当的屏幕尺寸——这也是旋转时角落再也不会被推出画面
的原因。

### 关于 `margin`

它**故意小于 1**。包围球外接于物体——立方体的外接球半径是其半边长的 1.73 倍——所以正好装下
球，等于物体本身只占不到半屏。让球稍微溢出一点，物体本身才能读起来大小合适。

这是一个调参旋钮，不是正确性阈值。在真实面板上试过 `1.35` 和 `1.05`，都偏小；`0.75` 又偏大，
体数据的包围框会紧贴面板边缘。

---

## 2. `fitView()`

按内容重新取景，并保留视图预设的方向。

```ts
// 自由函数
fitView(
  scene: FitViewScene,
  preset: CameraViewPreset,
  aspect: number,
  bounds: FitBounds,
  margin?: number
): boolean

// 或作为方法
copperSceneOnDemond.fitView(preset, aspect, bounds, margin?)
```

以下两种情况返回 `false`：正交相机（没有视场角可供拟合），或预设的 eye 正好落在 target 上。
**不会触发渲染**——何时绘制由调用方决定，这在按需渲染下很重要。

```ts
const { width, height } = container.getBoundingClientRect();
const [x, y, z] = volume.RASDimensions;

scene.fitView(preset, width / height, {
  width: x, height: y, depth: z,
  center: [0, 0, 0],
});
renderer.render();
```

### 它保留什么、替换什么

一个视图预设里手写的 `eyePosition` 同时编码了两件事：读者应该从哪个方向看这份数据，以及看
多远。**只有前者是决策。** 后者撑不过一个只有原设计三分之一宽的视口，而且手写的值常常让内容
只占画面的四分之一。

所以预设的**视线方向和 up 向量原样保留**——它们往往是临床判断——只有距离由 `fitDistance`
重新算出。

### 它瞄准物体自身中心，而不是预设的 target

预设通常 target 原点。这对 NRRD 体数据是对的，`RASDimensions` 描述的就是以原点为中心的盒子；
对 GLB 就是错的——它的包围盒不在原点，从原点取景会把模型的一部分推出画面，视口一窄就特别明显。
把真实中心通过 `bounds.center` 传进来即可；体数据传 `[0, 0, 0]`，这一步就是空操作。

### 它会同步 `controls.target`

**这是关键的一半。** 没有任何东西会把 controls 的旋转中心与 `camera.lookAt()` 同步，所以少了
这一步，用户下一次拖拽会触发 `controls.update()`，把相机重新对准 `target` 里那个旧值——刚做完
的取景被无声地撤销。同时也会调 `handleResize()`，供那些会缓存 canvas 页面坐标的 trackball 变体
使用。

---

## 3. 位姿插值 —— `Controls/cameraTransitions`

一组用于移动相机的纯数值工具。**零依赖**：进出都是普通数字和 `[x, y, z]` 元组，不涉及任何
three.js 对象。这让它们无需 WebGL 即可单元测试，也让自带一份 three 的使用方可以直接用，不必
让任何对象跨越那个边界。

```ts
interface Pose {
  position: [number, number, number];
  up: [number, number, number];
  /** 注视点——即 controls 的旋转中心，不是相机自身位置。 */
  target: [number, number, number];
}
```

| 函数 | 签名 | 用途 |
|---|---|---|
| `easeInOutCubic` | `(t: number) => number` | 标准缓动，超出范围的输入会被钳制。 |
| `viewPointToPose` | `(vp: CameraViewPreset) => Pose` | 把视图预设读成 `Pose`。 |
| `interpolateFlightPose` | `(from: Pose, to: Pose, t: number) => Pose` | 在两个位姿之间插值。`t` 应当已经缓动过。 |
| `orbitStepPose` | `(pose: Pose, yawRad: number, pitchRad: number) => Pose` | 绕自身旋转中心转动一步。 |
| `zoomPose` | `(pose: Pose, factor: number, minDistance?: number) => Pose` | 缩放到旋转中心的距离。 |
| `poseDistance` | `(pose: Pose) => number` | 轨道半径。 |
| `rotateAroundAxis` | `(v, axis, angleRad) => [number, number, number]` | 罗德里格旋转公式。 |
| `orbitSwingAngle` | `(t: number, turns: number) => number` | 入场环绕的摆动角。 |

### `interpolateFlightPose` 为什么用四元数而不是两次 lerp

旋转中心从一个 target 线性插值到另一个，而相机的**朝向**——包括它相对中心的方向和它的 up
向量——由**一个**旋转承载，这个旋转是从两个位姿完整的正交基构造出来的，而不是把 `dir` 和
`up` 各自独立插值。

这是正确性要求，不是风格选择。真实的预设数据里经常出现**同一条视轴上方向相反的 up 向量**
——同一个体数据的两个视图按相反约定写成，例如 eye `[0,0,2000]` 配 `up: [0,-1,0]`，eye
`[0,0,650]` 配 `up: [0,1,0]`。朴素的 `lerp(upFrom, upTo, t)` 会在 `t = 0.5` 处正好穿过零向量，
此时 `normalize` 没有正确答案，只能退化成一条平行于视线方向的轴：**相机在前半段一直是倒过来
的，然后在中点一帧之内翻转 180 度。**

把两组基合成一个相对旋转矩阵、再转成四元数（最大对角元法）就没有这种退化——对一个合法的旋转
矩阵，总有某个分支的除数被下界隔开。同样这个情形会变成绕共享轴的、定义良好的 180 度滚转：
平滑地穿过中点。同一套构造也覆盖了绕同一 target 的两个**相反相机位置**——在那里，基于向量对
的 slerp 会在 `t = 1` 附近来回翻。

`t = 0` 时精确复现 `from.position`，`t = 1` 时精确复现 `to.position`。`up` 同样精确，**前提是**
每个位姿自身的 `up` 已经垂直于自身的视线方向；如果某个 `up` 偏向视轴，它会被无声地正交化——
这是有意为之，因为那本来就不是一个有意义的相机滚转。

### `orbitStepPose` 注意事项

旋转中心和轨道半径都不变，所以连续按键永远不会把相机从它注视的对象上"走开"。俯仰是绕**偏航
之后**的 right 向量施加的，不是原来那个——绕过时的轴旋转，会让"左 + 上"这种斜向组合键偏离球
面而不是沿球面走。

### `orbitSwingAngle` 注意事项

`turns` 是**摆动幅度，不是净旋转量**。`sin(t·π)` 荡出去再荡回零，所以无论 `turns` 多大，相机
最终都精确停在取景后的预设视角上（`t = 1` → 角度 0）。不要把它"修"成净旋转，那会让入场动画
停在预设之外。

---

## 类型

```ts
interface FitBounds {
  width: number;
  height: number;
  depth: number;
  /** 包围盒中心，场景单位。NRRD 体数据传 `[0, 0, 0]`。 */
  center: [number, number, number];
}
```
