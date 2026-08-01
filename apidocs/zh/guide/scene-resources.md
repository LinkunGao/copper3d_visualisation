# copper3d — 场景资源管理

释放场景持有的资源、限制常驻内存总量，以及把一个模型交叉淡变成另一个。全部从包入口导出
（`copper3d`）。

::: tip 3.8.0 新增
纯新增。驻留预算**默认关闭**——不主动创建并处理它的返回值，就不会有任何东西被逐出。
:::

---

## 1. `disposeObject3D()` 与 `disposeMaterial()`

```ts
disposeObject3D(root: DisposableObject3D): void
disposeMaterial(material: DisposableMaterial | DisposableMaterial[] | null | undefined): void
```

`scene.remove()` 只是解除挂接。three.js 会一直保留几何体的 buffer 和材质的贴图直到显式释放，
而 copper3d 从不释放自己创建的东西——所以任何会替换模型或逐出场景的代码都需要这两个函数，
否则内存占用没有上界。

```ts
scene.scene.remove(oldModel);
disposeObject3D(oldModel);
```

两个值得知道的点：

- **`Material.dispose()` 不会级联到它的贴图。** canvas backed 的切片贴图、或 glTF 的
  baseColor map，不显式调用就会一直留在 GPU 上。`disposeMaterial` 会遍历 three 内置材质使用
  的贴图槽位（`map`、`normalMap`、`roughnessMap`、`metalnessMap`、`aoMap`、`emissiveMap`、
  `alphaMap`、`bumpMap`、`displacementMap`、`envMap`、`lightMap`、`specularMap`）。
- **它支持数组形式。** 多材质网格否则会走到 `Array.prototype.dispose`，而那个方法并不存在。

`disposeObject3D` 既能处理整棵子树，也能处理单个网格——`traverse` 会访问根节点自身——所以
一个从未加入场景的切片平面用同一个调用就能释放。这对 `loadNrrd` 很要紧：它会为 **x、y、z**
三个方向各构建一个完整的 `VolumeSlice`（各自的几何体、材质和 canvas backed 贴图），无论你是否
显示全部三个：

```ts
scene.loadNrrd(url, bar, true, (volume, meshes, slices) => {
  scene.addObject(meshes.z);
  // 只看轴位的 viewer 永远不会显示这两个，而不释放的话它们会在
  // `volume.sliceList` 里跟着体数据活一辈子。
  disposeObject3D(meshes.x);
  disposeObject3D(meshes.y);
});
```

---

## 2. `disposeScene()` 与 `removeSceneFromMap()`

```ts
disposeScene(host: SceneDisposalHost, name: string): DisposableScene | undefined
removeSceneFromMap(host: SceneDisposalHost, name: string): void

// 或作为方法
copperRendererOnDemond.disposeScene(name)
```

在 3.8.0 之前，**根本没有任何办法从 `sceneMap` 里移除条目**——没有任何代码删除它，所以一个
长生命周期的 renderer 会累积它建过的每一个场景，包括已解码的体数据。

`disposeScene` 会注销该场景、禁用它的 controls、摘掉 `change` 监听，并释放每一个子对象的几何体、
材质和贴图。返回被释放的场景，若该名字下没有场景则返回 `undefined`。

`removeSceneFromMap` 只注销、**不释放任何资源**，供需要把场景改名重新注册的调用方使用。

### 它故意不调用 `controls.dispose()`

那看上去是切断最后一处引用的显然做法，其实是个陷阱。同一个 renderer 建出的所有场景**共用一块
canvas**，而 `OrbitControls.dispose()` 会调 `disconnect()`，后者的最后一步是
`domElement.style.touchAction = ''`——而只有 `connect()` 会把它设回 `'none'`。于是释放一个被逐出
场景的 controls，会为**当前真正显示在屏幕上**的那个场景重新打开浏览器的触摸滚动：逐出一次，
整个会话剩余时间里的触摸旋转就都坏了。

只摘掉 `change` 监听同样能切断那条引用链，而且不动任何共享的东西。

### 移除没生效时会大声报错

`delete` 一个不存在的属性是静默无操作，所以如果哪天把 `sceneMap` 改成真正的 `Map`，逐出会
悄无声息地失效——不崩溃、不报类型错，而 map 会重新无界增长且完全不可见。因此移除后会通过宿主
自己的访问器确认，条目仍在就抛异常。

### 它遍历子对象，而不是按名字清理

用遍历 `scene.children` 而不是一份写死的名字列表：名字列表一定会漏掉后来有人以别的名字加进去的
东西。

---

## 3. 驻留预算

```ts
createSceneBudget(limitBytes: number): SceneBudget
defaultBudgetBytes(deviceMemoryGiB?: number): number
```

一个**按字节**计的 LRU 预算，带 pin。它只负责决定*该逐出哪些*场景；你拿它给出的名字去调
`disposeScene`。

```ts
const budget = createSceneBudget(defaultBudgetBytes(navigator.deviceMemory));

// 场景加载完成后
budget.register(name, volume.data.byteLength);
budget.pin(name);                    // 它正显示在屏幕上
for (const victim of budget.overflow()) {
  renderer.disposeScene(victim);
  budget.release(victim);
}
```

| 方法 | 含义 |
|---|---|
| `register(key, bytes)` | 记录（或更新）一个常驻场景的解码后大小，并标记为最近使用。 |
| `touch(key)` | 把一个已注册的场景标记为最近使用。未注册则空操作。 |
| `pin(key)` / `unpin(key)` | 场景显示在屏幕上期间保护它不被逐出。 |
| `release(key)` | 彻底忘记一个场景。在它的 GPU 资源释放之后调用。 |
| `rename(from, to)` | 把字节数、队列位置和 pin 状态一并转移，供替换场景内容并改键的调用方使用。 |
| `overflow()` | 需要逐出的 key，最久未使用的在前，永不包含被 pin 的。总量在预算内、或已无可逐出者时返回空数组。 |
| `bytes()` | 当前总量。 |

### 为什么按字节而不是按场景数量

数量不是真正有风险的东西。一个 NRRD 体数据在磁盘上可以是 51 KB，也可以是 53 MB，而 NRRD 解码
后的原始类型化数组比压缩尺寸还要大——所以"三个场景"可能是 150 KB，也可能是 250 MB。

### 为什么需要 pin

当多个视口共用一个 renderer 时，同时可见的场景不止一个。屏幕上的那些应当被 pin 住，并且永远
不作为逐出对象，**无论这让总量超出限额多少**——把读者正在看的画面清空，比它省下的那点内存
糟糕得多。`overflow()` 宁可返回空数组，也不会逐出被 pin 的场景。

### `defaultBudgetBytes`

设备内存 ≥ 8 GiB 返回 500 MB，否则 250 MB。`navigator.deviceMemory` 是 Chromium 独有的提示值，
Safari 和所有 iOS 浏览器都没有——而**"未知"必须对应小预算**：iPad 既是不提供这个 API 的设备，
也是最可能因为占用过多而被系统杀掉标签页的设备。

---

## 4. 模型交叉淡变

```ts
collectFadeTargets(root: DisposableObject3D): FadeTarget[]
setFade(targets: FadeTarget[], factor: number): void
restoreFade(targets: FadeTarget[]): void
```

拆成"采集 / 施加 / 还原"三步，时序由调用方掌握——淡变由你已有的动画循环逐帧驱动，而不是由这里
再起一个循环。

```ts
const outgoing = collectFadeTargets(previous);
const incoming = collectFadeTargets(next);
setFade(incoming, 0);

// 每帧，t 从 0 到 1
setFade(incoming, t);
setFade(outgoing, 1 - t);

// 结束时
restoreFade(incoming);
scene.scene.remove(previous);
disposeObject3D(previous);
```

两条不显然的规则，都编码在 `setFade` 里：

- **opacity 是按比例缩放，不是直接赋值。** `opacity = factor` 会让本来就半透明的材质在淡变结束
  时变成完全不透明——一层 40% 透明的外壳会停在 1.0，把它本该透出来的东西全遮住。
- **`depthWrite` 在整个淡变过程中被压掉**，只在完全不透明的那一端才恢复。半透明面片如果还写
  深度，就会遮挡画在它后面的一切；淡变时若不关掉，会看到淡出的模型在淡入的模型上"打洞"。
  本来就没有 `depthWrite` 的材质不会被恢复出来。

`restoreFade` 会把每一个采集到的属性精确还原成 `collectFadeTargets` 当初看到的样子。**即使淡变
被中断也要在结束时调用它**——直接跳到终态，好过让两个半透明模型冻结在屏幕上。
