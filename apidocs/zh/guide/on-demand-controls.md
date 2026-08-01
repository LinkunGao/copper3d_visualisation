# 按需渲染与轨迹球控制器

`copperSceneOnDemond` 只在有人要求时才画一帧，而不是永远跑一个
`requestAnimationFrame` 循环。这样省电，也让一个页面上并存多个 viewer 成为可能 ——
但它改变了对控制器类的要求，而 `Copper3dTrackballControls` 一直到 **3.9.0** 才满足。

## 那个死锁

`Copper3dTrackballControls` 把一次手势拆成两半。它的 pointer handler 只负责**记录**
位置：

```ts
function onMouseMove(event) {
  if (state === STATE.ROTATE && !scope.noRotate) {
    _movePrev.copy(_moveCurr);
    _moveCurr.copy(getMouseOnCircle(event.pageX, event.pageY));
  }
  // ……此时什么都还没动
}
```

相机真正移动只发生在 `update()` 里，而 `change` 也只有那里派发。

在连续渲染循环下这没问题 —— `render()` 每秒调六十次 `update()`，记下的输入下一帧就
应用了。但在按需渲染下，它闭成了一个进不去的环：

> 不渲染 → 不 `update()` → 相机永远不动 → 不派发 `change` → 没人请求渲染

viewer 对鼠标完全无反应。不抛异常，不打警告，所有单测照样全绿 —— 因为控制器内部
状态**确实**在正确更新，只是永远传不到相机上。

`OrbitControls` 没有这个问题：它在 pointer handler 里就把相机移了并派发 `change`。
这也是为什么把 OrbitControls 换成轨迹球，会让一个本来好好的 viewer 看起来"坏了"。

## 修法：`updateOnInput`

```ts
const controls = new Copper.Copper3dTrackballControls(scene.camera, canvas);
controls.updateOnInput = true;
controls.addEventListener("change", scene.requestRenderIfNotRequested);
```

打开之后，`onMouseMove`、`onTouchMove` 和滚轮 handler 会各自调用 `update()`。相机在
手势过程中就移动，`change` 派发时相机已经在新位置上，你的监听器再去安排那一帧。

**默认是关的**，而且是刻意的 —— 见下一节。

### 请和 `staticMoving` 一起用

```ts
controls.updateOnInput = true;
controls.staticMoving = true;  // 强烈建议
```

`staticMoving = false`（默认值）会给相机惯性：指针停下后它还会继续滑，而每次
`update()` 都把这段滑行衰减一步。于是有两个后果：

- 输入驱动的 update 会让滑行**变短** —— 输入事件在每帧的衰减之外又加了额外的衰减步。
  这正是这个开关不能默认打开的原因：那会改掉所有现存连续渲染 viewer 的手感。
- 惯性需要输入**停止之后**还有帧，而按需渲染没有任何东西来触发它们，滑行会停在半路。
  如果你确实想在按需渲染下保留惯性，那就在手势期间临时开一个连续渲染循环。

设成 `staticMoving = true` 后，相机停在指针离开的位置 —— 这本来就是按需渲染 viewer
想要的效果，而且此时多余的 `update()` 是空操作。

### 它不改变什么

`updateOnInput` 管的是**什么时候**更新相机，不是**允不允许**更新。`enabled`、
`noRotate`、`noZoom`、`noPan` 一律照常生效 —— 锁住的轴还是锁住的。

## 在创建时就选好控制器 <Badge type="tip" text="3.9.0" />

`copperSceneOnDemond` 原本写死了 `new OrbitControls(...)`，所以下面那段替换是拿到轨迹球的
唯一办法。现在 `createScene` 接受一个按场景的选项：

```ts
const scene = renderer.createScene("case-1", { controls: "copper3d" });
```

| 取值 | 类 | 说明 |
|---|---|---|
| *不传* | `OrbitControls` | 默认，未改变 |
| `"copper3d"` | `Copper3dTrackballControls` | `updateOnInput` 已经替你打开 |
| `"trackball"` | three 自带的 `TrackballControls` | 同样的死锁，且没有对应开关 —— 你得自己 pump 帧。优先用 `"copper3d"` |

默认仍是 `OrbitControls`，尽管 `copperScene` 的默认是轨迹球：改掉它会把所有现存按需渲染
viewer 的控制器悄悄换掉。

renderer 自己的 `options.controls` **刻意不读**。它对按需渲染的场景从来就没有任何效果
（只有 `copperScene` 读它），所以现在开始认它，反而会改变那些设了它却从没注意到的项目的
行为。请传给 `createScene`。

## 完整示例

只有在替换一个**已经存在**的场景的控制器时才需要这一段 —— 新场景直接给 `createScene` 传
`{ controls: "copper3d" }` 就行。

```ts
const renderer = new Copper.copperRendererOnDemond(container);
const scene = renderer.getSceneByName("case-1")
  ?? renderer.createScene("case-1");

// 换成轨迹球，同时保住按需渲染
scene.controls.removeEventListener("change", scene.requestRenderIfNotRequested);
scene.controls.enabled = false;
scene.controls.dispose?.();

const controls = new Copper.Copper3dTrackballControls(
  scene.camera,
  renderer.renderer.domElement
);
controls.staticMoving = true;
controls.updateOnInput = true;
controls.addEventListener("change", scene.requestRenderIfNotRequested);

scene.controls = controls;
controls.handleResize();  // 它缓存了 canvas 的位置盒；每次 resize 后都要调

```

这段替换里有两点值得知道：

- 要**先**摘掉旧的 `change` 监听再 dispose 旧控制器，否则一个已经 dispose 的实例还可能
  在退场路上再请求一帧。
- `handleResize()` 不是可选的。和 `OrbitControls` 不同，轨迹球把 canvas 相对页面的位置
  盒缓存在 `screen` 里，且只在这个方法里重算 —— 容器一 resize，不调它的话之后每一个
  指针位置都是错的。

## 从 3.8.x 升级

什么都不用做。`updateOnInput` 默认 `false`，就是你今天的行为。只在按需渲染的 viewer
上把它设成 `true`。

如果你之前是自己监听 pointer / wheel 事件、手动调 `requestRenderIfNotRequested()` 来
绕过这个问题的，打开开关后那段就可以删了。但请留一个浏览器级别的测试：拖动 viewer，
断言画面确实变了 —— 这个故障模式对单测是完全隐形的，对"只检查监听器有没有注册"的测试
也一样。
