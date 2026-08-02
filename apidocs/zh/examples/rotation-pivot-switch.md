# 切换 pan 之后的旋转行为

一个可以直接拿走的 helper，让同一个 viewer 在"读者 pan 过之后，rotate 该怎么转"的
三种行为之间切换 —— 外加每种行为**看起来**是什么样，好让你能分辨出自己在哪一种。

原理和推导见：[旋转中心与 pan](/zh/guide/rotation-pivot)。

---

## 默认哪个都不开

`Copper3dTrackballControls` 出厂 `rotationPivot = null`，也就是轨迹球原本的行为：
**pan 会把旋转中心一起拖走**，于是下一次 rotate 绕着 pan 结束的那个位置画弧。所有
版本都是这样，3.10.0 也不例外。下面两种修法都是 opt-in 的。

另外要说清楚：这里其实有**三种**行为，不是两种 —— `null` 不等于 "recentre"：

| 模式 | 怎么得到 | 旋转绕什么 | 读者做过的 pan |
|---|---|---|---|
| `orbit-target` | 什么都不做（默认） | pan 之后的 `target` | 保留，但轴是错的 |
| `recentre` | rotate 开始时 snap `target` | 内容中心 | 旋转开始时**丢弃** |
| `keep-pan` | `controls.rotationPivot = centre` | 内容中心 | **保留** |

`recentre` 是 `Copper3dOrbitControls` 一直以来的行为，也是在 3.9.x 及更早版本上只能
退到的那一种。

## Helper

```ts
import * as THREE from "three";
import * as Copper from "copper3d";

export type RotationMode = "orbit-target" | "recentre" | "keep-pan";

export interface RotationModeHandle {
  set(mode: RotationMode): void;
  /** 内容中心，**世界坐标**。内容一变就要再调一次；传 `null` 则无论哪种模式
   *  都不生效。 */
  setPivot(pivot: THREE.Vector3 | null): void;
  current(): RotationMode;
  dispose(): void;
}

export function attachRotationMode(
  controls: Copper.Copper3dTrackballControls,
  container: HTMLElement,
  initial: RotationMode = "keep-pan",
): RotationModeHandle {
  // `rotationPivot` 是构造函数里初始化的普通字段，所以 `in` 就能把 3.10.0+ 和
  // 之前所有版本区分开。
  const supportsPivot = "rotationPivot" in controls;

  let mode: RotationMode = initial;
  let pivot: THREE.Vector3 | null = null;
  let snapping = false;

  const onPointerDownCapture = (event: PointerEvent) => {
    if (!pivot || !isRotateGesture(controls, event)) return;
    controls.target.copy(pivot);
  };

  function snap(on: boolean) {
    if (on === snapping) return;
    snapping = on;
    // 必须是捕获阶段：轨迹球的监听在下层 canvas 上、冒泡阶段，而且它在自己的
    // pointerdown handler 里就锁定了手势状态。挂在冒泡阶段会晚整整一个手势 ——
    // 第一次拖拽照样绕着过期的中心转。
    if (on) container.addEventListener("pointerdown", onPointerDownCapture, true);
    else container.removeEventListener("pointerdown", onPointerDownCapture, true);
  }

  function apply() {
    const effective = mode === "keep-pan" && !supportsPivot ? "recentre" : mode;
    if (supportsPivot) {
      controls.rotationPivot = effective === "keep-pan" ? pivot : null;
    }
    // 绝不能两个同时开：snap 会把 pivot 正在保留的那个偏移直接丢掉。
    snap(effective === "recentre" && pivot !== null);
  }

  apply();

  return {
    set(next) { mode = next; apply(); },
    setPivot(next) { pivot = next; apply(); },
    current() { return mode; },
    dispose() {
      snap(false);
      if (supportsPivot) controls.rotationPivot = null;
    },
  };
}

/** 从控制器自己的按键映射表读手势意图，而不是硬编码"左键 = 转" ——
 *  这样以后重映射按键，也不会变成在 pan 上乱 repivot。 */
function isRotateGesture(
  controls: Copper.Copper3dTrackballControls,
  event: PointerEvent,
): boolean {
  // 触摸：第一根手指算 rotate。第二根手指永远不是 `isPrimary`，它会把手势变成
  // zoom/pan，那种不该 repivot。
  if (event.pointerType === "touch") return event.isPrimary;
  const { LEFT, MIDDLE, RIGHT } = controls.mouseButtons;
  const intent =
    event.button === 0 ? LEFT
    : event.button === 1 ? MIDDLE
    : event.button === 2 ? RIGHT
    : -1;
  return intent === THREE.MOUSE.ROTATE;
}
```

::: tip 用的是已发布的 3.9.0 类型定义？
里面还没有 `rotationPivot`，那两处赋值需要一次 cast：

```ts
const pivotable = controls as unknown as { rotationPivot?: THREE.Vector3 | null };
```

运行时那一侧 `supportsPivot` 已经处理了，所以同一份文件在两种构建下都能用。
:::

## 接进去

```ts
const scene = renderer.createScene("case-1", { controls: "copper3d" });
const controls = scene.controls as Copper.Copper3dTrackballControls;

const rotation = attachRotationMode(controls, container, "keep-pan");
```

内容出来之后给它一个 pivot，从物体本身量：

```ts
scene.loadNrrd(url, Copper.loading(), true, (volume, meshes) => {
  scene.addObject(meshes.x);
  scene.addObject(meshes.y);
  scene.addObject(meshes.z);

  // 三张正交切片面的并集就是体数据包围盒。是量出来的，不是假定在原点 ——
  // 切片面带着体数据自己的偏移。
  const box = new THREE.Box3()
    .expandByObject(meshes.x)
    .expandByObject(meshes.y)
    .expandByObject(meshes.z);

  rotation.setPivot(box.getCenter(new THREE.Vector3()));
});
```

然后想用什么 UI 切都行：

```ts
modeSelect.addEventListener("change", () => {
  rotation.set(modeSelect.value as RotationMode);
});
```

### 内容一变就要重新 `setPivot`

没有任何东西会替你让 pivot 失效。换病例、换体数据、或者任何让内容在世界坐标里挪位的
操作之后都要再调一次 —— 过期的 pivot 会绕着**上一个**病例待过的地方转，看起来跟这个
特性要修的 bug 一模一样。

`fitView` 和 `setCameraPose` 不需要额外协调：两者都会把 `target` 写成瞄准内容中心，
所以重新取景或"重置视图"之后，target 和 pivot 又重合了，pan 偏移真的归零。用你传给
`fitView` 当 `bounds.center` 的那个盒子来算 pivot，两者天然一致。

## 如果你只需要其中两种

viewer 只有一种既定行为、只是开发期想对比一下时，整个可切换的 handle 就过重了。一个
常量加两处调用就够：

```ts
/** 两种模式都让旋转绕内容中心；区别只在 pan 的去留。改这里对比。 */
const ROTATE_AFTER_PAN: "keep-pan" | "recentre" = "keep-pan";

const usingPivot =
  ROTATE_AFTER_PAN === "keep-pan" && "rotationPivot" in controls;

// 内容加载完之后
controls.rotationPivot = usingPivot ? centre : null;

container.addEventListener("pointerdown", (event) => {
  if (usingPivot) return;                       // 交给控制器自己处理
  if (!isRotateGesture(controls, event)) return;
  controls.target.copy(centre);
}, true);
```

## 怎么分辨自己在哪一种

三种都能渲染出一张看着挺合理的画面，所以"看起来没问题"什么也证明不了。能区分开的
操作是：

1. 把内容 pan 到明显偏离中心的地方 —— 拖到视口角落。
2. 别动别的，直接拖拽旋转。

| 你看到的 | 你在哪种模式 |
|---|---|
| 内容沿一道大弧甩出去，甚至出画 | `orbit-target` |
| 内容先弹回中间，然后原地转 | `recentre` |
| 内容留在角落，原地转 | `keep-pan` |

第 1 步 pan 得越远，区别越明显。只挪几个像素是看不出来的。

要做自动化检查，断言不变量而不是像素：`keep-pan` 下一次 rotate 前后，
`camera.position.distanceTo(pivot)` 和 `controls.target.distanceTo(pivot)` 都不变，
而 `controls.target` 确实动了。参见 `src/ts/__tests__/trackballRotationPivot.test.ts`。

## 几个坑

- **绝不要两种修法同时开**。snap 会把 pivot 正在保留的偏移丢掉；你会得到 `recentre`，
  却以为自己配的是 `keep-pan`。helper 的 `apply()` 就是照着"这种情况不可能发生"写的。
- **snap 的监听必须挂捕获阶段**，冒泡阶段晚整整一个手势。
- **控制器活得比 helper 久时，`dispose()` 很重要**。它会摘掉监听并清空
  `rotationPivot`；在共用的控制器上留一个过期 pivot，会让下一个场景绕错点转。
- **三种模式下缩放都仍然朝 `target`**，不是朝 pivot。这是刻意的 —— 它保证 pan 过的
  画面在缩放时构图不跳。
