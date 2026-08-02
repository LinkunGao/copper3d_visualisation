# 绕内容转，而不是绕 pan 之后的那个点

`Copper3dTrackballControls.rotationPivot` 决定读者 pan 过之后，一次 rotate 手势会
发生什么。它回答的是那个问题："我把模型挪开之后，一转它怎么飞出去了？"

::: tip 3.10.0 新增
纯增量、可选。`rotationPivot` 默认 `null`，也就是此前所有版本的行为 —— 不碰它，
什么都不会变。
:::

想要一个能在运行时切换三种行为的现成 helper，以及怎么在屏幕上分辨它们，见
[切换 pan 之后的旋转行为](/zh/examples/rotation-pivot-switch)。

---

## 1. 问题出在哪

`panCamera()` 把**相机和 `target` 一起**平移：

```ts
scope.object.position.add(pan);
scope.target.add(pan);          // <- 旋转中心跟着相机走了
```

这正是 pan 之所以是 pan：画面横移，构图不变。但 `target` 同时也是旋转绕的那个点 ——
`rotateCamera()` 作用在 `_eye = position - target` 上，而 `update()` 再把相机放回
`target + eye`。

所以只要 pan 一次，旋转中心就不在内容上了。下一次 rotate 会让体数据绕着空中某个点
画一道大弧，而不是原地转。pan 得越远越离谱 —— 而且不抛异常、不打警告，只是手感坏掉。

## 2. 显而易见的那个修法，以及它的代价

常见修法是在 rotate 开始时把 `target` 拍回内容中心。`Copper3dOrbitControls` 就是这么
做的，挂在控制器的 `start` 事件上：

```ts
this._onStart = () => {
  if (isRotateGesture(this.state)) this.target.copy(this._pivot);
};
```

它把轴修对了，但也**把 pan 丢掉了**：赋值 `target` 不会移动相机（`update()` 会从相机
当前位置反推偏移），可是 `object.lookAt(target)` 会重新对准，于是旋转一开始，内容就
滑回视口中间。

对很多 viewer 来说这没问题，甚至正是想要的。但对一个刻意 pan 过的读者 —— 把病灶放到
面板边上、挨着某个测量值 —— 就不是。

## 3. `rotationPivot`

```ts
controls.rotationPivot = new THREE.Vector3(cx, cy, cz);   // 世界坐标
controls.rotationPivot = null;                            // 恢复成绕 target 转
```

| | 类型 | 默认值 |
|---|---|---|
| `rotationPivot` | `Vector3 \| null` | `null` |

**这里没有任何东西是默认开启的。** 默认值 `null` 就是第 1 节描述的轨迹球原本行为
—— pan 会把旋转中心一起拖走。3.10.0 和此前所有版本都一样；不设 pivot，什么都不会变。

设了 pivot 之后，本帧的旋转 `q` 除了作用在 `_eye` 和 `object.up` 上，还会作用到
`target - pivot` 上。记 pivot 为 `C`：

```
target'   = C + q(target − C)
eye'      = q(eye)
position' = target' + eye'
          = C + q(target − C) + q(position − target)
          = C + q(position − C)
```

整个"相机 + target"装配绕 `C` 做刚体旋转。由此得到两件事：

- **所有到 `C` 的距离都守恒**，内容绕自己的中心转。
- **`C` 在屏幕上的投影不动**，pan 的位移原样保留：内容一边转，一边停在你拖到的位置。

没有 pan 时 `target` 就**是** pivot，被旋转的偏移是零向量，整件事是个 no-op。一个从不
pan 的 viewer 分辨不出区别。

## 4. 怎么用

每份内容设一次，世界坐标：

```ts
const box = new THREE.Box3();
box.expandByObject(nrrdMesh.x);
box.expandByObject(nrrdMesh.y);
box.expandByObject(nrrdMesh.z);

controls.rotationPivot = box.getCenter(new THREE.Vector3());
```

::: warning 是世界坐标，而且它不会自动跟随任何东西
从物体本身量，别默认是原点。切片面带着体数据自己的偏移，GLB 的包围盒也很少正好居中，
所以世界原点通常是错的点 —— `fitView` 用 `bounds.center` 避开的正是同一个坑。

内容变了（换病例、换体数据）要重新算。没有任何东西会替你让它失效。

:::

把它清成 `null` 是正常操作，不是清理步骤 —— 一个希望读者"pan 到哪就绕哪转"的场景，
本来就该是 `null`。

### 和 `fitView` / `setCameraPose` 的关系

不需要额外协调。两者都会写 `controls.target`，而且都瞄准内容中心，所以重新取景或
"重置视图"之后，target 和 pivot 又重合了，pan 偏移真的归零。用你传给 `fitView` 的
`bounds.center` 那个盒子来算 pivot，两者天然一致。

### 特性探测

这个属性是构造函数里初始化的普通字段，所以用 `in` 就能区分旧版本并降级到"rotate 开始
时拍回去"的写法：

```ts
if ("rotationPivot" in controls) {
  controls.rotationPivot = centre;
} else {
  // 3.9.x 及更早：改成在 rotate 开始时 snap target，接受 pan 被丢弃。
  // 必须挂在捕获阶段 —— 轨迹球在 canvas 上、冒泡阶段的 pointerdown handler 里
  // 就锁定了自己的手势状态。
  container.addEventListener("pointerdown", (event) => {
    if (isRotateButton(event)) controls.target.copy(centre);
  }, true);
}
```

## 5. 它不改变什么

- **缩放仍然朝 `target`**，不是朝 pivot —— `zoomCamera()` 缩放的是 `_eye`。这正是
  pan 过的画面在缩放时构图不跳的原因；朝 pivot 缩放会把内容往中间拽。
- **`minDistance` / `maxDistance` 仍然夹的是 `|position − target|`**，不是到 pivot 的
  距离。pan 很远时两者会有差，但这两个值本来就是手感边界，实际无影响。
- **阻尼已经处理**。松手后的滑行也会带着 target 一起转，那几帧里装配不会散。
- **`noRotate`、`enabled`、`updateOnInput` 都不受影响**。锁住的轴依然锁着；这里只改
  一次被允许的旋转**绕什么转**。

## 6. 该用哪个

一共**三种**状态，不是两种 —— 什么都不做也是一种，而且你就是从那儿开始的：

| | 怎么得到 | 旋转轴 | 读者做过的 pan | 版本要求 |
|---|---|---|---|---|
| **orbit-target** | 什么都不做，默认 | pan 之后的 `target` | 保留，但轴是错的 | — |
| **recentre** | rotate 开始时 snap `target` | 内容中心 | 旋转开始时丢弃 | 任意版本 |
| **keep-pan** | `rotationPivot = centre` | 内容中心 | 保留 | 3.10.0+ |

第一行正是这一页要修的行为，所以真正要选的是后两者。两者都能让"旋转中心就是图像中心"
成立，区别只在 pan 的去留 —— 按这一条选就行。

**后两者绝不能同时开** —— snap 会把 pivot 正在保留的那个偏移丢掉，你会得到
`recentre`，却以为自己配的是 `keep-pan`。

想知道一个 viewer 当前在哪一种：把内容 pan 到视口角落，然后拖拽旋转。沿大弧甩出去是
`orbit-target`，先弹回中间再转是 `recentre`，留在角落原地转是 `keep-pan`。

## 7. 从 3.9.x 升级

无需改动。默认 `null`，未设置或等于 `target` 时旋转路径与此前逐字节一致。

如果你现在是在 rotate 开始时 snap `target`，设了 pivot 之后要**把那段删掉** —— 那个
snap 会把 pivot 正在保留的偏移直接丢掉。

## 8. 测试

`src/ts/__tests__/trackballRotationPivot.test.ts` 钉住刚体旋转的不变量：到 pivot 的
距离、pan 偏移的长度、相机到 target 的距离在一次 rotate 后全部守恒，相机确实动了，
以及未 pan 的 viewer 在设与不设 pivot 下输出完全一致。这些全是安静的错误 —— 每种错法
都还能渲染出一张看着挺合理的画面 —— 所以值得断言，而不是靠眼看。
