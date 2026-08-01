# 加载 GLB：Draco 与 KTX2 解码器

一个 Draco 压缩过的 GLB 通常只有未压缩版本的十分之一 —— 本项目的一个解剖模型从 10.18MB
降到 598KB。代价是浏览器自己解不了：three 需要在加载时另外去取一份 WebAssembly 解码器，
而它的路径你必须能设。

**3.9.0 之前你设不了，而且默认值是 404 的。** 两件事都修好了。

## 原来错在哪

```ts
// 3.9.0 之前，模块级 const，没有导出
new DRACOLoader(MANAGER).setDecoderPath(`${THREE_PATH}/examples/js/libs/draco/gltf/`)
new KTX2Loader(MANAGER).setTranscoderPath(`${THREE_PATH}/examples/js/libs/basis`)
```

三个独立的问题：

- **`examples/js/` 根本不存在。** three 很早就删掉了这个目录，解码器在 `examples/jsm/`
  下面。于是每一个 Draco 压缩的 GLB 都加载失败，而控制台里冒出来的是那个 404 上的 CORS
  错误 —— 完全说不出真正的原因。
- **transcoder 路径少了结尾斜杠。** three 是把文件名直接拼上去的，所以它去请求的是
  `libs/basisbasis_transcoder.js`。
- **两个都够不着。** 它们是模块级 `const`，它们和 `copperGltfLoader` 都没有导出，下游
  没有任何办法纠正。

## 设置你自己的路径

```ts
import Copper from "copper3d";

Copper.setDracoDecoderPath("/draco/");
Copper.setKTX2TranscoderPath("/basis/");
```

两个都要求**结尾带斜杠** —— three 会把 `draco_wasm_wrapper.js`、`draco_decoder.wasm`、
`basis_transcoder.js` 直接拼在你给的字符串后面。

部署在子路径下时必须带上 base URL。放在 `/te-uma/draco/` 的解码器，在 `/draco/` 是找不
到的：

```ts
// 以 Nuxt 为例
Copper.setDracoDecoderPath(`${useRuntimeConfig().app.baseURL.replace(/\/$/, "")}/draco/`);
```

在启动时调一次，赶在第一个 GLB 加载之前。两个路径写的都是共享的 loader，所以调用会影响
**已经创建出来**的 loader —— 但解码器模块本身在第一次使用时就被 fetch 并缓存在
`DRACOLoader` 内部了，所以已经解过码之后再改路径不会重新去取。

## 为什么你多半想自己托管

默认值指向 unpkg 上与 copper3d 构建时同版本的 three。它能用，但那是一个对第三方 CDN 的
硬性运行时依赖 —— 离线、内网隔离、有防火墙的部署满足不了，而一个在医院里用的教学资源，
很可能也满足不了。

构建时把文件拷进你自己的静态目录：

```
public/
  draco/
    draco_wasm_wrapper.js
    draco_decoder.wasm
  basis/
    basis_transcoder.js
    basis_transcoder.wasm
```

它们在你的 `node_modules` 里的 `three/examples/jsm/libs/draco/gltf/` 和
`three/examples/jsm/libs/basis/`。**要从你实际构建用的那个 three 版本里拷** —— 解码器和
`GLTFLoader` 版本不一致时不保证能配合。

## `copperGltfLoader()` <Badge type="tip" text="3.9.0" />

```ts
copperGltfLoader(renderer: THREE.WebGLRenderer): GLTFLoader
```

同时新导出的：copper3d 内部构建的那个 `GLTFLoader`，已经接好了共享的 Draco 和 KTX2
loader。当你需要自己的 loader 时用它 —— 自己的 `LoadingManager`、一个 `onError` 处理、
或者一次不经过 copper3d 场景的加载 —— 而不必把解码器那套接线重写一遍、再把路径重新弄对
一次。

```ts
const loader = Copper.copperGltfLoader(renderer.renderer);
loader.load(url, onLoad, onProgress, onError);
```

注意第四个参数。`scene.loadGltf()` 不接受它 —— 这正是今天一个需要上报 GLB 加载失败的调用
方不得不自建 loader 的原因。

## 从 3.8.x 升级

什么都不用改。修正后的默认路径只可能在原来 404 的地方开始工作，而两个 setter 是新增导出。
如果你之前是自己建 `GLTFLoader` 和 `DRACOLoader` 绕过去的，那套继续有效 —— 换成
`setDracoDecoderPath` + `scene.loadGltf` 是可选的，而且只有在你并不同时需要当初促使你绕过
去的那套错误处理时才划算。
