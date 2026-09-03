# 加载进度与错误

copper3d 的所有加载器在 **3.9.0** 都补上了 `onProgress` 和 `onError`。在此之前你没有任何
办法知道一次加载失败了 —— URL 写错、404、文件损坏、以及一次非常慢的下载，从外面看完全
一样：callback 就是不触发。

## 之前是什么样

```ts
// 3.9.0 之前，copperSceneOnDemond.loadGltf
loader.load(
  url,
  (gltf) => { /* ... */ },
  (error) => {}          // <- 这是 onPROGRESS 槽位，取名叫 error，而且是空的
);
```

`GLTFLoader.load(url, onLoad, onProgress, onError)` 收四个参数。第三个是一个取名叫
`error` 的空函数 —— 一眼看过去像是对的，而它在出错时永远不会被调用 —— 第四个根本没传。
`loadNrrd` 有一个给内置进度条用的真 progress handler，同样没有 error 槽位。

## `scene.loadGltf`

```ts
scene.loadGltf(url, callback?, {
  onProgress: (event) => console.log(event.loaded, event.total),
  onError: (error) => showFailure(error),
});
```

两个都是可选的、默认都不做任何事，所以已有调用不受影响。

`copperSceneOnDemond`、`copperScene`、`copperMScene` 上都有。（`copperScene.loadPureGLB`
本来就带 `onError`，没有改动。）

## `scene.loadNrrd`

回调挂在已有的 `opts` 对象上：

```ts
scene.loadNrrd(url, loadingBar, segmentation, callback, {
  openGui: false,
  onProgress: (event) => { /* ... */ },
  onError: (error) => showFailure(error),
});
```

`onProgress` 是**在内置进度条之外**额外触发的，进度条照旧把百分比写进
`loadingBar.progress`，一个字都没变。

::: warning 唯一一处可见的行为变化
NRRD 的加载条现在会在**加载失败时隐藏**。它原本没有任何失败状态，所以一个失败的体数据会
让进度条永远停在它走到的那个百分比上 —— 而这恰恰就是"失败和慢分不出来"的直接原因。进度
条其他方面没有变化。
:::

## `opts.axes`：只抽你会显示的切片面 <Badge type="tip" text="3.9.0" />

`loadNrrd` 一直是把 x、y、z **三个**切片面全抽出来的，不管你显示不显示。`extractSlice`
每调一次就要走一遍整个体数据，而结果会挂在 `volume.sliceList` 上，跟着这个体数据活到最后。
在一个 50MB 的 MRI 上，一个没人看的轴要付出：完整扫一遍 buffer，外加一份没有任何东西会去
释放的 geometry、material 和 canvas 纹理。

```ts
scene.loadNrrd(url, loadingBar, false, callback, {
  openGui: false,
  axes: ["z"],          // 只看横断面的 viewer
});
```

默认是 `["x", "y", "z"]`，也就是原来的行为。

::: warning
没抽的轴，在回调拿到的 `nrrdMeshes` / `nrrdSlices` 上是 `undefined`。它们的类型仍然声明
三个都在 —— 改成可选会让所有现存调用方编译不过 —— 所以一旦你收窄了 `axes`，就只能读你
要过的那些。
:::

### 事后补抽被跳过的轴 <Badge type="tip" text="3.10.0" />

收窄 `axes` 原本只有在"你永远不会显示其他面"时才安全。`ensureAxisExtracted` 解除了这个限制：
第一次有东西要用某个面时，再把它抽出来。

```ts
import { ensureAxisExtracted } from "copper3d";

// slices 来自 axes: ["z"] 的一次加载 —— 此时还没有矢状面
ensureAxisExtracted(slices, "x");         // 现在抽出来
ensureAxisExtracted(slices, "x", meshes); // 顺带填上 meshes.x
```

它是**原地修改 `slices`（以及传了的话，`meshes`）**的，所以所有指向同一个对象的现存引用都会
拿到新抽出来的面 —— 你不需要替换任何东西。轴已经存在时它什么都不做，因此无条件调用是安全的。

三个轴共用同一个 `Volume` 实例，所以维度、spacing 和 RAS 维度都从**已经**抽出来的那个轴上读。
晚抽出来的面也会继承兄弟面上的 `contrastOrder`，和加载时就抽出来的面没有区别。

::: tip 通常不需要你自己调
`NrrdTools.setSliceOrientation(axis)` 已经会在显示管线读取新面之前，为每个已加载的 contrast
调用 `ensureAxisExtracted`。所以一次只抽横断面的加载（`axes: ["z"]`）之后切到矢状/冠状面是直接
可用的 —— 抽取的开销从加载时挪到了切换时。
:::

## `opts.knownMinMax`：跳过全体数据的强度扫描 <Badge type="tip" text="3.10.0" />

解析完之后，three 的 `Volume.computeMinMax()` 会遍历每一个体素去找强度范围。在大的 MRI 上，
这个函数通常是整个病例加载 CPU profile 里最大的一块 —— 而这个答案后端一般早就知道了，因为
后端写 header 的时候解压的就是同一份字节。

```ts
const { min, max } = await fetch(`/files/${caseId}/headers`).then((r) => r.json());

scene.loadNrrd(url, loadingBar, false, callback, {
  openGui: false,
  knownMinMax: [min, max],
});
```

不传 —— 或者传了一个过期的值 —— 行为和以前完全一样：three 自己的扫描照跑，出来的图像一模一样，
只是慢一点。

## `opts.signal`：取消一次被顶掉的加载 <Badge type="tip" text="3.10.0" />

以前切病例、切序列时，旧的传输会一直跑到结束，只是结果被丢掉。传一个 `AbortSignal` 进去，
传输本身就会停。

```ts
let inflight: AbortController | undefined;

function loadCase(url: string) {
  inflight?.abort();               // 掐掉上一次下载
  inflight = new AbortController();

  scene.loadNrrd(url, loadingBar, false, onLoaded, {
    openGui: false,
    signal: inflight.signal,
    onError: (error) => {
      if ((error as DOMException).name === "AbortError") return; // 预期之内
      showFailure(error);
    },
  });
}
```

被 abort 的加载**仍然会触发 `onError`** —— 拒绝原因是一个 `name === "AbortError"` 的
`DOMException`。已经在忽略过期加载错误的调用方不需要再改。

abort 会**立即**拒绝你自己的 promise，不等 worker。worker 只是被另外通知一声，好让它更新自己
对该 URL 的挂载计数，并在没人再等这个 URL 时停掉真正的网络传输。

## NRRD 解析跑在 Web Worker 里 <Badge type="tip" text="3.10.0" />

`loadNrrd` 不再在主线程上 fetch 和解析。fetch、gunzip、以及 NRRD header/类型化数组的解析，
全部发生在一个共享 Web Worker 里（`Loader/nrrdWorker.ts`，逻辑在 `Loader/nrrdWorkerCore.ts`）；
体数据的像素 buffer 以 **transferable** 的形式传回来，主线程只是在它外面重新套出一个真正的
`Volume` —— 不管体数据多大，都是微秒级。

公开 API 没有任何变化。`onProgress`、`onError`、内置进度条和 `callback` 的签名，行为都和上面
写的完全一致。

两个值得知道的结果：

- **URL 级别的 fetch 去重在 worker 里。** 同一个 URL 的两次并发 `loadNrrd` 共用一次网络传输，
  而每一次调用仍然各自拿到一个解析好的 `Volume`。
- **worker 被内联进 bundle**（`?worker&inline`），所以不需要额外再发一个资源文件。挂在构建时
  未知的 base path 下的 UMD bundle 也能正常工作。

## 检测卡死的下载

对一个大体数据来说，固定超时是错的工具：53MB 的 NRRD 在共享的 6 Mbps 网络上，正常也要跑
一分多钟，而一个固定的截止时间迟早会把一次完全健康的下载判成失败。你真正想要的是
**N 秒内没有任何进度**，用 `onProgress` 几行就够：

```ts
const STALL_MS = 15_000;
let timer: ReturnType<typeof setTimeout>;

function armStallTimer() {
  clearTimeout(timer);
  timer = setTimeout(() => showFailure(new Error("download stalled")), STALL_MS);
}

armStallTimer();
scene.loadNrrd(url, loadingBar, false, (volume, meshes, slices) => {
  clearTimeout(timer);
  /* ... */
}, {
  openGui: false,
  onProgress: armStallTimer,
  onError: (error) => { clearTimeout(timer); showFailure(error); },
});
```

3.9.0 之前，copper3d 唯一暴露出来的存活信号就是进度条自己的文字，所以这件事只能靠拿一个
`MutationObserver` 去盯那个 DOM 节点来做。

## `event.total` 不一定有

只有服务器发了 `Content-Length`，`ProgressEvent.total` 才不是 `0`，而 gzip 或分块响应是
不会发的。此时 `loaded / total` 是 `Infinity`，内置进度条会渲染成 `Infinity % loaded`。

把它当作**不确定**，而不是"卡在 0"：

```ts
onProgress: (event) => {
  const pct = event.total > 0 ? (event.loaded / event.total) * 100 : null;
  setProgress(pct);   // null -> 显示不确定态的转圈
}
```

## 从 3.8.x 升级

除了上面那条进度条的说明外，纯新增。每个参数都是可选的，每个默认值都是原来的行为。

## 从 3.9.x 升级

同样是纯新增。`knownMinMax`、`signal`、`ensureAxisExtracted` 都是可选的，而搬到 worker 这件事
从外面是看不见的 —— 回调一样、进度条一样、`Volume` 一样。

唯一要检查的是有没有代码绕过 `loadNrrd` 直接摸 `copperNrrdLoader` 的内部：旧的
`sharedFetchNrrdArrayBuffer` + 每个调用方各自 `loader.parse()` 这一对已经没有了，
取而代之的是 worker 里自己的 fetch 去重和解析。
