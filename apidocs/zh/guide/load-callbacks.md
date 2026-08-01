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
