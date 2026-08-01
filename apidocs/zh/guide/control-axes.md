# 控制器轴开关与手势门控

关掉旋转 —— 无论是为了 2D 视图，还是只在用户拖别的东西的那一小会儿 —— 是两行代码，
而这两行写错的次数比写对的多。**3.9.0** 新增了一组小工具，让这两类错误写不出来。

## 命名陷阱

两套拼法，而且是反的：

| 类 | 旋转 | 平移 | 缩放 |
|---|---|---|---|
| `OrbitControls`、`Copper3dOrbitControls` | `enableRotate` | `enablePan` | `enableZoom` |
| `TrackballControls`、`Copper3dTrackballControls` | `noRotate` | `noPan` | `noZoom` |

两个类都不会校验对方的属性名。在轨迹球上写 `enableRotate` 不报错、不警告、也什么都不做
—— 它只是多出一个没人读的字段。视图照转不误，然后几个月后才有人报告说"那张 2D 图会转"。

`setRotateEnabled` 会写实例上真正存在的那套拼法：

```ts
import Copper from "copper3d";

Copper.setRotateEnabled(scene.controls, false);   // 轨迹球还是 orbit 都对
Copper.setPanEnabled(scene.controls, false);
Copper.setZoomEnabled(scene.controls, true);

if (Copper.isRotateEnabled(scene.controls)) { /* ... */ }
```

同时提供：`isPanEnabled`、`isZoomEnabled`、`setPanEnabled`、`setZoomEnabled`。

它们遵守三条规则：

- **两套拼法都没有**的轴，读出来是"启用"，写的时候原样不动。既然没有东西在管它，凭空造
  一个类根本不读的属性，只是一个长得像修复的谎。
- **两套都有**的实例（包装层，或者曾经写错过一次的代码库）两个都写，免得它自己跟自己
  矛盾。
- 它们接受任何带这些字段的对象，所以从发布 bundle 里拿到的控制器实例照样能用。

## 手势门控

另一半。当一次指针拖拽的含义不是"移动相机" —— 拖切片平面、拖标注锚点、在网格上画 ——
旋转必须在**恰好这段手势**的时间里被压住：

```ts
import Copper from "copper3d";

let release: (() => void) | null = null;

function onPointerDown(event) {
  if (!hitsMyDraggableThing(event)) return;
  release = Copper.beginGesture(scene.controls);
}

function onPointerUp() {
  release?.();
  release = null;
}

// 那个 `true` 是关键 —— 见下文
el.addEventListener("pointerdown", onPointerDown, true);
el.addEventListener("pointerup", onPointerUp);
el.addEventListener("pointercancel", onPointerUp);
el.addEventListener("pointerleave", onPointerUp);
```

默认只压旋转。手势需要更多就明说：

```ts
Copper.beginGesture(scene.controls, { rotate: true, pan: true, zoom: true });
Copper.beginGesture(scene.controls, { rotate: false, pan: true });  // 只压平移
```

### 为什么不能直接设回"启用"

因为在你的手势开始之前，视图可能本来就是锁着的。一个出厂就关掉旋转的 2D 模态，会被第一次
拖拽悄悄解锁，而且此后再没有任何东西把它锁回去 —— 这个 bug 在造成它的那次手势里完全看不
出来，要等到某个本不该转的视图转起来时才暴露。

`beginGesture` 在压任何东西**之前**先把值记下来，结束时原样放回去。本来锁着的，还它锁着。

### 监听要挂在捕获阶段

这件事工具替你做不了，而写错要付出整整一次手势的代价。

`Copper3dTrackballControls` 的监听挂在 canvas 上、冒泡阶段，而它的 `pointerdown` handler
就在那里**锁定**了 rotate 状态 —— 它在那一刻读 `noRotate` 并记下拖拽起点。挂在祖先元素
冒泡阶段的监听器跑在它**之后**，于是你刚设的压制来晚了一整个手势，第一次拖拽会既滚切片
又转相机。

用 `capture: true` 注册，把你的 handler 排到它前面：

```ts
el.addEventListener("pointerdown", onPointerDown, true);
```

### 释放

- 返回的函数是**幂等**的。同时挂到 `pointerup`、`pointercancel`、`pointerleave` 上是安全
  的，而且你正需要这样：指针在拖拽途中移出元素时，只有 `pointerleave` 会触发，少了它视图
  就永久转不动了。
- 同一个 controls 对象上的门控会**引用计数**。两个重叠的手势都压制，最后一个释放时才还回去。
- `isGestureActive(controls)` 告诉你当前有没有东西持有它。

## 从 3.8.x 升级

纯新增 —— 只多了导出，没有改任何既有行为。如果你现在直接写 `noRotate` 并且工作正常，它
继续正常。值得改用这组工具的场景是：控制器的类型不是静态已知的，或者一次手势需要"还原
成它找到的样子"。
