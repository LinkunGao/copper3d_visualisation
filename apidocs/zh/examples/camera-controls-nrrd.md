# copper3d 实战：相机自动取景、控制器配置、NRRD 单切片拖动

这份文档记录 **breast-educational-resource** 这个 app 是怎么用 copper3d 3.9.0 搭出它的
影像 viewer 的 —— 每一段都是仓库里跑着的真代码，以及**为什么是这样写的**。踩过的坑都留在
原地，因为它们大多不会报错，只会安静地表现错。

面向的场景：按需渲染（on-demand rendering）+ 多个 viewer 共用一块 canvas + 单张轴位切片
拖动。

**目录**

1. [场景与控制器：一次建好，别事后替换](#_1-场景与控制器)
2. [相机自动取景：`fitView`](#_2-相机自动取景)
3. [程序化移动相机：`setCameraPose`](#_3-程序化移动相机)
4. [NRRD 加载：只抽你要的那一片](#_4-nrrd-加载)
5. [单切片拖动：手势与相机抢输入](#_5-单切片拖动)
6. [体数据包围盒](#_6-体数据包围盒)
7. [资源释放与驻留预算](#_7-资源释放与驻留预算)
8. [速查表](#速查表)

---

## 1. 场景与控制器

### 一次建好

```ts
const renderer = new Copper.copperRendererOnDemond(container)

const scene = renderer.createScene(name, { controls: 'copper3d' })
if (!scene) throw new Error(`copper3d refused to create scene "${name}"`)

scene.controls.staticMoving = true                    // 松手即停，无惯性
scene.controls.rotateSpeed = 3.0                      // 轨迹球的量纲
scene.controls.panSpeed = is3dModel ? 0.2 : 0.5
```

`{ controls: 'copper3d' }` 是 3.9.0 新增的。在那之前 `copperSceneOnDemond` 写死
`new OrbitControls(...)`，renderer 的 `options.controls` 只有兄弟类 `copperScene` 读 ——
**传了不报错、也没有任何效果**。所以老代码只能构造完再把 `scene.controls` 整个换掉。

> **`rotateSpeed = 3.0` 是轨迹球的数字，不是 OrbitControls 的。**
> 同一个 3.0 在 OrbitControls 上是它默认值的 3 倍，手感会飞出去。换控制器类时这类调参值
> 不能直接搬。

### 为什么按需渲染必须用 `'copper3d'` 而不是 `'trackball'`

`Copper3dTrackballControls` 的 pointer handler **只记录位置**，相机真正移动发生在
`update()` 里，而 `change` 事件也只在那里派发。按需渲染下这会闭成一个进不去的环：

> 不渲染 → 不 `update()` → 相机不动 → 不派发 `change` → 没人请求渲染

viewer 对鼠标完全无反应，而且**不抛异常、不打警告、单测全绿** —— 控制器内部状态确实在
正确更新，只是永远传不到相机上。

3.9.0 用 `updateOnInput` 修掉了它，而 `{ controls: 'copper3d' }` 会**替你打开这个开关**。
three 自带的 `'trackball'` 没有这个开关，同样的死锁，得自己 pump 帧。

这个故障模式对单测是隐形的，所以值得留一个浏览器级测试：

```ts
// test-browser/camera-drag.spec.ts —— 截图像素差，不碰库的内部
const changed = await pixelChange(stage, async () => {
  await page.mouse.move(box.x + box.width * 0.35, midY)
  await page.mouse.down()
  for (let i = 1; i <= 8; i++)
    await page.mouse.move(box.x + box.width * (0.35 + 0.04 * i), midY)
  await page.mouse.up()
})
expect(changed, 'the drag did not move the camera').toBeGreaterThan(0.02)
```

### 多场景共用一块 canvas

一个 renderer 下所有场景**共用同一块 canvas**，而 `setCurrentScene` **不会**关掉切走那个
场景的控制器。于是一次拖拽会同时驱动所有缓存场景的控制器，最后创建的那个最后绘制 ——
不管哪个真的在屏幕上。每次切换都要手动开关：

```ts
function activateScene(renderer, next) {
  const current = renderer.getCurrentScene()
  if (current !== next) current.controls.enabled = false   // 有的话
  next.controls.enabled = true
  renderer.setCurrentScene(next)
}
```

> **不要用 `controls.dispose()` 来"关掉"一个场景。** 那条路通向
> `domElement.style.touchAction = ''`，而只有 `connect()` 会把它设回 `'none'`。逐出一个
> 场景会让整块 canvas 在这次会话剩下的时间里触摸旋转失效。`enabled = false` 就够了。

### 容器 resize

轨迹球把 canvas 相对页面的位置盒**缓存**在 `screen` 里，只在 `handleResize()` 里重算 ——
和 OrbitControls 每次事件现测不同。少了这个调用，resize 之后每一个指针位置都是错的，模型
会绕着歪掉的轴转。

用 `ResizeObserver` 而不是 `window.resize`：它是严格超集，还能抓到面板折叠这种没有窗口
resize 事件的布局变化。

```ts
const ro = new ResizeObserver(() => {
  renderer.getCurrentScene().onWindowResize()   // 内部会调 handleResize()
  onResize?.({ width, height })                 // 顺便重新取景，见 §2
})
ro.observe(host)
```

---

## 2. 相机自动取景

### 问题

每个模态都配了一份手写的 view preset（`eyePosition` / `targetPosition` / `upVector`）。
preset 编码了两件事：**从哪个方向看**（临床判断），和**离多远**（当时那个视口的产物）。

第二件事撑不住。面板宽度只有当初的三分之一时，固定距离必然出画；而手写的距离常常让内容
只占画面的四分之一。

### `fitView`

```ts
import { fitView } from 'copper3d'

function refit(aspect: number) {
  const bounds = boundsByScene.get(name)     // { width, height, depth, center }
  const preset = viewpointByScene.get(name)
  if (!bounds || !preset) return
  if (fitView(scene, preset, aspect, bounds)) renderer.render()
}
```

它**保留** preset 的视线方向和 up，只把距离换成算出来的值。三个关键点：

**① 用包围球，不用包围盒。** 盒会让薄片状的体数据（33 层的乳腺 X 线）铺满面板，而近立方
体的 MRI 被推得只有一半大。球没有朝向，同等体量的物体屏幕尺寸也就一致。

**② 吃 `aspect`，取水平/垂直半角的较小者。** 窄面板上垂直 FOV 不是约束边。

**③ 瞄准物体自己的中心，不是 preset 的 target。** preset 一律 target 原点，这对 NRRD 是
对的（`RASDimensions` 描述的就是以原点为中心的盒子），但 GLB 不是 —— 模型的包围盒可能离
原点挺远，从原点取景会把它推出画面一半，面板一窄就露馅。

`margin` 默认 0.85 且**故意小于 1**：包围球外接于物体，正好装下球等于物体只占不到半屏。
这是调参旋钮不是正确性阈值。

**它不渲染** —— 什么时候画由调用方决定，这在按需渲染下很重要，因为它可能只是一帧里的
若干变更之一。

### 什么时候取景

- 内容加载完、preset 应用之后
- 每次容器 resize（`ResizeObserver` 回调里）
- 切回一个缓存场景时

**但要跳过读者自己摆过相机的场景**，否则 resize 会把他的视角抢走：

```ts
const posedScenes = new Set<string>()   // 首次真实手势时加入，"重置视图"时移除
if (posedScenes.has(name)) return
```

---

## 3. 程序化移动相机

```ts
import { setCameraPose, viewPointToPose } from 'copper3d'

scene.setCameraPose(viewPointToPose(preset))   // 或 setCameraPose(scene, pose)
renderer.render()
```

它是四个赋值，第四个是所有人都会漏的那个：

```ts
camera.position.set(...)
camera.up.set(...)        // 要在 lookAt 之前 —— lookAt 是用 up 建相机基的
camera.lookAt(...)
controls.target.set(...)  // ← 这一行
```

copper3d 没有任何地方会把控制器的旋转中心和 `camera.lookAt()` 同步。**漏掉最后一行，一切
看起来都对，直到用户碰鼠标**：第一次拖拽调 `controls.update()`，把相机重新对准那个没更新
的 `target`，你的移动被静默撤销。症状是"我一拖相机就跳回去了"，指向控制器，而不是真正的
病因。

### 相机飞行

在两个 preset 之间做动画时，`cameraTransitions` 那组纯数学函数是零依赖的（只有数字和
`[x,y,z]` 元组，不碰 three）：

```ts
import { easeInOutCubic, interpolateFlightPose, viewPointToPose } from 'copper3d'

const from = viewPointToPose(currentPreset)
const to = viewPointToPose(nextPreset)

run(durationMs, (t) => {
  scene.setCameraPose(interpolateFlightPose(from, to, easeInOutCubic(t)))
  renderer.render()
})
```

> **为什么不直接 lerp `up`。** 两个 preset 的 up 反向时（本项目乳腺 X 线是 `[0,-1,0]`，
> MRI 是 `[0,1,0]`，同一条 +z 视轴），直接插值会在 t=0.5 穿过零向量：相机先倒过来，再
> 瞬间翻 180°。`interpolateFlightPose` 走的是"两组正交基 → 相对旋转矩阵 → 四元数 slerp"，
> 没有退化点。

---

## 4. NRRD 加载

```ts
scene.loadNrrd(
  url,
  Copper.loading(),          // 进度条 DOM
  true,                      // segmentation
  (volume, meshes, slices) => {
    scene.addObject(meshes.z)
    meshes.z.name = 'z'
    /* ... */
  },
  {
    openGui: false,
    axes: ['z'],             // ← 3.9.0
    onProgress,              // ← 3.9.0
    onError,                 // ← 3.9.0
  },
)
```

### `axes: ['z']`：只抽你会显示的那一片

`loadNrrd` 一直是把 x、y、z **三片全抽**的，不管你显示不显示。`extractSlice` 每调一次要
走一遍整个体数据，而结果挂在 `volume.sliceList` 上，跟着体数据活到最后。

这个 app 只显示一张轴位切片（`useSliceControl` 也只对它做射线检测）。在 50MB 的 MRI 上，
另外两个轴的代价是：**完整扫两遍 buffer**，外加两份没有任何东西会释放的 geometry +
material + canvas 纹理。

以前只能"抽完立刻 dispose"，白付扫描的钱。现在它们根本不会被建出来。

> ⚠️ 没抽的轴在 `meshes` / `slices` 上是 `undefined`，而它们的类型仍声明三个都在（改成
> 可选会让所有现存调用方编译不过）。收窄了 `axes`，就只能读你要过的那些。

### 卡死检测：不要用固定超时

53MB 的 NRRD 在共享的 6 Mbps 网络上正常也要跑一分多钟。固定截止时间迟早会把一次完全健康
的下载判成失败。要的是 **N 秒内没有任何进度**：

```ts
const STALL_MS = 15_000
let stallTimer: ReturnType<typeof setTimeout>

function armStallTimer() {
  clearTimeout(stallTimer)
  stallTimer = setTimeout(() => {
    reject(new Error(`Stalled loading ${id} (no progress for ${STALL_MS}ms): ${url}`))
  }, STALL_MS)
}

function onProgress(event: ProgressEvent) {
  if (token === currentToken) {
    // total 为 0 = 服务器没发 Content-Length（gzip / 分块）。字节还在来，只是没有
    // 分数可以表达 —— NaN 表示"不确定"，比冻结在上一个值（0）要诚实。
    progress.value = event.total > 0 ? event.loaded / event.total : Number.NaN
  }
  armStallTimer()   // 即使这次加载已被取代也要续期，否则它永远不会 settle
}

armStallTimer()      // 第一个 progress 事件之前就开始计时
```

`onProgress` 是**在内置进度条之外**额外触发的，进度条照旧工作。

> 3.9.0 之前 copper3d 唯一暴露的存活信号是它自己那个进度条的**文字**，所以这段只能靠拿
> `MutationObserver` 去盯那个 DOM 节点、再用正则从 `File: x 42 % loaded` 里抠数字来做。

### 竞态：加载被取代

用户在切换模态时会连着发起好几个加载。用一个自增 token：

```ts
const token = ++loadToken
// ...
if (token !== loadToken) return   // 被更新的加载取代了
```

三个容易漏的点：

- **stall 计时器要无条件续期**，即使这次加载已被取代 —— 它仍然需要最终 settle，否则失败
  场景的清理逻辑永远跑不到。
- **`progress` ref 只在还是当前加载时才写**，否则一次被取代的加载的迟到事件会把进度环在
  两个不相干的下载之间来回跳。
- **被取代但成功了的加载，簿记要照做完**（场景名、bounds、preset、预算登记）。否则用户切
  回那个模态时会拿到一个"缓存命中但半成品"的场景：没有切片状态、没有相机 preset，而
  `getSceneByName` 永远短路在它上面。

### 切片纹理不会自动画

`loadNrrd` 建好了切片对象和它们的 canvas 纹理，但**从不 paint**。在有东西移动切片之前，
那个面渲染出来是纯黑的。实测：一次完全成功的加载之后，纹理 canvas 上 1,161,405 个像素里
有 **0 个**非透明像素。

```ts
slices.z.repaint.call(slices.z)   // 用 .call 绑回 this
```

### 曝光：先打补丁，再画第一帧

客户反馈 MRI 太暗看不清。copper3d 按体数据自己的 min/max 做窗宽窗位，而这些 MRI 的最大值
是几个孤立的亮点，组织都挤在量程底部。

```ts
import { exposureExponent, installFastSliceRepaint } from 'copper3d'

const exposure = modality.id === 'mri' ? exposureExponent(volume) : 1

// 必须 await：曝光 LUT 住在打完补丁的 repaint 里
const painted = installFastSliceRepaint(slices.z, exposure)
  .catch(() => {})                              // 补丁失败就降级成无提升
  .then(() => { slices.z.repaint.call(slices.z) })
```

> **顺序是硬要求。** 先画后打补丁，会先画一帧暗的、等读者第一次拖动才修正 —— 正是客户
> 明确要求"不要看到颜色变化"的那条。所以 `painted` 这个 promise 要 gate 住 `resolve`，
> 而整个加载只在它之后画唯一那一帧。

`exposureExponent` 用 Otsu 从直方图自己的形状里找前景/背景的分界，而不是取固定分位数 ——
这才让同一个 target 在整个病例库上产出可比的图像。它保证**不裁剪**
（`out = 255 * (in/255) ** e`，e < 1 是提升）。

---

## 5. 单切片拖动

一块共用的 canvas 上有两个手势要抢同一个指针：**拖切片**和**转相机**。

### 用射线检测做闸门

```ts
function hitsSlicePlane(event: PointerEvent, el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect()
  const hit = scene.pickSpecifiedModel([sliceMesh], {
    x: event.clientX - rect.left,     // 相对容器，这是 copper3d 的射线检测所除的量
    y: event.clientY - rect.top,
  })
  return Boolean(hit.intersectedObject)
}
```

**每次手势只判一次，在 pointerdown。** 老实现每次 move 都重新检测，于是它会在拖到一半时
改主意。

### 手势期间压住相机

```ts
import { beginGesture } from 'copper3d'

let releaseCamera: (() => void) | null = null

function onPointerDown(event: PointerEvent) {
  if (!hitsSlicePlane(event, el)) return
  dragging = true
  releaseCamera = beginGesture(scene.controls)   // 默认只压 rotate
}

function endDrag() {
  releaseCamera?.()
  releaseCamera = null
}

// ↓ 这个 `true` 是关键
el.addEventListener('pointerdown', onPointerDown, true)
el.addEventListener('pointermove', onPointerMove)
el.addEventListener('pointerup', endDrag)
el.addEventListener('pointercancel', endDrag)
el.addEventListener('pointerleave', onPointerLeave)
```

三个坑，每一个都是安静地错：

**① 监听必须挂在捕获阶段。** 轨迹球的监听在 canvas（`host` 的后代）上、冒泡阶段，而它在
自己的 `pointerdown` handler 里就**锁定**了 rotate 状态。挂在祖先元素冒泡阶段的监听器跑
在它之后，压制来晚了整整一个手势 —— 第一次拖拽会既滚切片又转相机。

**② 松手要恢复到之前的值，不是 `true`。** 本项目的 2D 超声模态出厂就关掉了旋转。无条件
恢复会把它悄悄解锁，而且此后再没有任何东西把它锁回去。`beginGesture` 在压制**之前**先把
值记下来，release 时原样放回 —— 这就是有这个函数的全部理由。

**③ `pointerleave` 必须挂。** 指针拖出元素时 `pointermove` 立刻停，于是没有任何东西会去
清掉光标或者释放压制 —— viewer 会永久转不动，还顶着一个手型光标。

顺带：`beginGesture` 返回的函数是**幂等**的，所以 `pointerup` / `pointercancel` /
`pointerleave` 同时挂是安全的。

### 不要竞争 pointer capture

```ts
// onPointerDown 里没有 setPointerCapture —— 故意的
```

控制器会在同一次手势里对 canvas 做 capture，而**最后 capture 的那个赢**。它们的 capture
会继续把 move 事件送到 canvas，而那些事件本来就会冒泡到 `host`，所以去抢只会输给它，还
一点好处都没有。

### 拖动距离直接驱动切片

```ts
const SENSITIVITY = 0.25   // 每像素多少张切片

function onPointerMove(event: PointerEvent) {
  if (!dragging) return
  const dy = event.clientY - lastY
  lastY = event.clientY
  target = clamp(target + dy * SENSITIVITY, max)
  scheduleIndex(target)
}
```

老实现每个 `pointermove` 固定走 ±1 张，不管指针实际走了多远 —— 手感和手势完全脱钩。

也不要在这里做缓动跟随。试过，单看很顺，上手很别扭：图像明显滞后于指针，而这是一个读者
正拿来找东西的仪器。**拖动要直连。**

### repaint 很贵：一帧一次

```ts
let pending: number | null = null
let coalesceRaf: number | null = null

function scheduleIndex(next: number) {
  pending = next
  if (coalesceRaf !== null) return
  coalesceRaf = requestAnimationFrame(() => {
    coalesceRaf = null
    if (pending === null) return
    applyIndex(pending)
    pending = null
  })
}

function applyIndex(next: number) {
  const clamped = Math.round(clamp(next, max))     // ← 取整
  if (clamped === current) return                  // ← 没变就不画
  current = clamped
  slice.index = clamped * slice.volume.spacing[2]  // ← 世界坐标，不是切片号
  slice.repaint.call(slice)
}
```

`repaint()` 会在 JS 里把整个平面从体数据里重新抽出来、重绘它的 canvas，然后纹理在下一帧
重新上传。在大一点的 MRI 上这是每次调用几十万次迭代 —— **调用频率就是拖动性能的全部**。

三件事把它压下来：

- **合并到每帧一次。** 高回报率鼠标一秒能发一百多个 move 事件，而每帧只有最后一个看得见。
- **切片号取整。** 只有整数张切片存在（copper3d 入口处会取整），小数索引白付一次完整
  repaint 去显示已经在屏幕上的那张图。在 `SENSITIVITY = 0.25` 下，每 4 个像素里有 3 次是
  纯浪费。
- **没变就不画。**

> `slice.index` 是**世界坐标**，不是切片号。乘 `volume.spacing[2]`。

### 只有一份"当前切片"

```ts
// SliceState 里刻意没有 index 字段
current = slice.raw.index / slice.raw.volume.spacing[2]
```

曾经有过一个 `index` 字段：加载时算一次，之后再没写过（拖动和"定位病灶"改的都是
`raw.index`）。于是只要切回一个缓存场景，它就是真值的一份过期副本，而读数和跟随器都从它
起算。**`raw.index` 是当前切片唯一的存放处。** 只要只有一份，这个 bug 就是不可表达的。

### 按需渲染下：repaint ≠ 一帧

```ts
function jumpTo(sliceNumber: number) {
  applyIndex(sliceNumber)
  scene.requestRenderIfNotRequested()   // ← 少了这行，什么都不会发生
}
```

`applyIndex` 重绘了纹理，但**重绘不是一帧**。其他写切片索引的路径碰巧都骑在某个渲染源
上（拖动有控制器的 `change`，键盘步进有动画驱动的租约），但一个"定位病灶"按钮两样都没有。
症状：点了没反应，直到你去转一下视角，它才跳到那一张。

---

## 6. 体数据包围盒

```ts
import { addVolumeBoundingBox } from 'copper3d'

addVolumeBoundingBox(scene, volume.RASDimensions, { color: 0x8A7F84 })
```

它是唯一能给一张孤零零的切片面提供空间参照的东西 —— 没有它，切片面悬在一片没有边界的
虚空里，读者完全不知道自己滚到了体数据的哪个位置。

`color` 默认白色，那是在**深色** viewer 上能看清的颜色。这个 app 的舞台背景是浅色的，白线
在上面是隐形的，所以传了设计系统自己的边框色。

> 旧的 `addBoxHelper` 从 3.9.0 起 deprecated。它的**两参数形式根本不能用**：不传第三个
> 参数时它包的是一个模块级的 `cube`，而 `copperNrrdLoader` 只声明了它、从没赋过值 ——
> 也就是 `new THREE.BoxHelper(undefined)`。它的类型也写死收 `copperScene`，
> `copperSceneOnDemond` 传不进去。

---

## 7. 资源释放与驻留预算

### 缓存场景，但要有上限

切回一个已建好的场景比重新下载 10-50MB 的体数据划算得多。但 NRRD 解码出来是原始 typed
array，比压缩后的体积还大 —— 目录里最糟的一对（乳腺 X 线 + MRI）是 ~75MB。所以要有个
字节预算：

```ts
import { createSceneBudget, defaultBudgetBytes } from 'copper3d'

const budget = createSceneBudget(defaultBudgetBytes(navigator.deviceMemory))

// 加载完成后
budget.register(name, volume.data.byteLength)
budget.pin(name)                       // 它在屏幕上
for (const victim of budget.overflow()) {
  renderer.disposeScene(victim)
  budget.release(victim)
}
```

`pin` 是**唯一**挡在软内存上限和"读者正看着的面板变成空白"之间的东西。屏幕上的场景必须
在任何预算下都活着，多小的预算都一样。

### `disposeScene`

```ts
import { disposeScene } from 'copper3d'
disposeScene(renderer, name)      // 或 renderer.disposeScene(name)
```

它注销场景、关掉控制器、摘掉 `change` 监听、调场景自己的 `dispose()`（这是释放构造时挂在
`window` 上那个 resize 监听的唯一途径），再遍历释放每个子对象的 geometry / material /
纹理。

3.8.0 之前**根本没有出口** —— 没有任何东西会从 `sceneMap` 里删条目，一个长命的 renderer
会攒下它建过的每一个场景，解码好的体数据全在里面。

两个必须知道的点：

- **`Material.dispose()` 不会级联到 `material.map`。** 切片面的 canvas 纹理、GLB 的
  baseColor 贴图，都要单独释放。`disposeMaterial` 会走一遍 three 内置材质用到的 12 个
  纹理槽。
- **遍历 `scene.children`，不要按名字清。** 名字列表一定会漏掉后来有人以别的名字加进去的
  东西。

### GLB 交叉淡变

```ts
import { collectFadeTargets, restoreFade, setFade } from 'copper3d'

const outgoing = collectFadeTargets(previousModel)
const incoming = collectFadeTargets(nextModel)

// 每帧
setFade(outgoing, 1 - t)
setFade(incoming, t)

// 结束时
restoreFade(incoming)
scene.scene.remove(previousModel)
disposeObject3D(previousModel)
```

淡变时 opacity 要**按比例缩放**而不是直接赋值 —— 否则一个本来就半透明的材质（比如这个
app 那层 40% 的脂肪层）淡完会变成不透明。全程还必须压掉 `depthWrite`：半透明面片写深度
会在后面的模型上打洞。

---

## 速查表

### 会安静地表现错的地方

| 症状 | 原因 |
|---|---|
| viewer 对鼠标完全无反应 | 按需渲染 + 轨迹球，没开 `updateOnInput`（用 `{ controls: 'copper3d' }`） |
| 一拖相机就跳回去 | 移动相机时没同步 `controls.target`（用 `setCameraPose`） |
| 拖切片时相机也在转 | `pointerdown` 监听没挂在捕获阶段 |
| 2D 视图本该锁着却能转 | 写了 `enableRotate` 而不是 `noRotate`（用 `setRotateEnabled`） |
| 拖一次切片之后 2D 视图变得可转 | 松手时把旋转恢复成了 `true` 而不是之前的值 |
| 一次拖拽驱动了所有缓存场景 | 切换时没有 `controls.enabled = false` |
| resize 之后模型绕歪掉的轴转 | 没调 `handleResize()` |
| 切片面是纯黑的 | `loadNrrd` 从不 paint，要自己 `repaint.call(slice)` |
| 点了按钮没反应，转一下才生效 | 按需渲染下漏了 `requestRenderIfNotRequested()` |
| viewer 永久转不动 + 手型光标 | 没挂 `pointerleave`，指针拖出去了 |
| 压缩 GLB 加载失败（CORS 报错） | draco 路径 —— 用 `setDracoDecoderPath('/draco/')` |
| 触摸旋转在逐出一个场景后失效 | 调了 `controls.dispose()`（共用 canvas） |
| 内存一路涨 | 没有 `disposeScene`；或 `material.map` 没单独释放 |

### 3.9.0 用到的 API

```ts
import {
  // 相机
  fitView, fitDistance, setCameraPose,
  viewPointToPose, interpolateFlightPose, easeInOutCubic,
  orbitStepPose, zoomPose, poseDistance, rotateAroundAxis, orbitSwingAngle,

  // 控制器
  setRotateEnabled, setPanEnabled, setZoomEnabled,
  isRotateEnabled, isPanEnabled, isZoomEnabled,
  beginGesture, isGestureActive,

  // 体数据
  exposureExponent, installFastSliceRepaint, addVolumeBoundingBox,

  // 加载
  setDracoDecoderPath, setKTX2TranscoderPath, copperGltfLoader,

  // 资源
  disposeScene, removeSceneFromMap, disposeObject3D, disposeMaterial,
  createSceneBudget, defaultBudgetBytes,
  collectFadeTargets, setFade, restoreFade,
} from 'copper3d'
```

`scene.loadNrrd` 的 `opts`：`{ openGui, axes, onProgress, onError }`。
`scene.loadGltf` 的第三参：`{ onProgress, onError }`。
`renderer.createScene` 的第二参：`{ controls: 'copper3d' | 'orbit' | 'trackball' }`。
